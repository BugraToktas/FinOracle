import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function getCorsHeaders(_req: Request): Record<string, string> {
  return CORS;
}

function json(status: number, body: unknown, cors: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...cors }
  });
}

function getSupabaseServiceClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key);
}

type Verdict = "correct" | "partial" | "wrong";

async function callLLMProxy(task: "recheck", payload: unknown) {
  const baseUrl = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  if (!baseUrl) throw new Error("Missing SUPABASE_URL");

  const resp = await fetch(`${baseUrl}/functions/v1/llm_proxy`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(anon ? { apikey: anon } : {})
    },
    body: JSON.stringify({ task, ...(payload as object) })
  });

  const text = await resp.text().catch(() => "");
  if (!resp.ok) throw new Error(`llm_proxy ${resp.status}: ${text}`);
  return JSON.parse(text);
}

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  let analysisIdForFailMark: string | null = null;

  try {
    if (req.method !== "POST") return json(405, { error: "Method Not Allowed" }, cors);

    const body = await req.json().catch(() => null);
    const analysis_id = body?.analysis_id;
    analysisIdForFailMark = typeof analysis_id === "string" ? analysis_id : null;

    if (!analysisIdForFailMark) {
      return json(400, { error: "analysis_id is required (string)" }, cors);
    }

    const supabase = getSupabaseServiceClient();

    // 0) Idempotency: already revalidated → mark verified and return
    const { data: existingReval } = await supabase
      .from("revalidations")
      .select("id")
      .eq("analysis_id", analysisIdForFailMark)
      .maybeSingle();

    if (existingReval?.id) {
      await supabase
        .from("analysis_results")
        .update({ status: "verified" })
        .eq("id", analysisIdForFailMark);

      return json(200, {
        ok: true,
        analysis_id: analysisIdForFailMark,
        already_verified: true,
        revalidation_id: existingReval.id
      }, cors);
    }

    // 1) Load analysis
    const { data: analysis, error: aErr } = await supabase
      .from("analysis_results")
      .select("id, event_id, summary, confidence")
      .eq("id", analysisIdForFailMark)
      .single();

    if (aErr || !analysis) {
      return json(404, { error: "analysis not found", details: aErr?.message }, cors);
    }

    // 2) Load event for richer recheck prompt
    const { data: event } = await supabase
      .from("market_events")
      .select("id, asset_code, event_date, direction, magnitude")
      .eq("id", analysis.event_id)
      .maybeSingle();

    // 3) Load linked sources for reputation update
    const { data: links, error: lErr } = await supabase
      .from("analysis_source_links")
      .select("source_id, weight_used")
      .eq("analysis_id", analysisIdForFailMark);

    if (lErr) {
      return json(500, { error: "failed to load analysis_source_links", details: lErr.message }, cors);
    }

    // 3b) Load the original source documents linked to this analysis for richer recheck context
    const { data: docLinks } = await supabase
      .from("analysis_document_links")
      .select("source_documents(url, title, domain, published_at, content_snippet)")
      .eq("analysis_id", analysisIdForFailMark);

    const sourcePriors = (docLinks ?? [])
      .map((l: Record<string, unknown>) => l.source_documents as Record<string, unknown> | null)
      .filter(Boolean)
      .slice(0, 10)
      .map((s: Record<string, unknown>) => ({
        domain:       String(s.domain       ?? ""),
        title:        String(s.title        ?? ""),
        url:          String(s.url          ?? ""),
        snippet:      s.content_snippet ? String(s.content_snippet) : null,
        published_at: s.published_at    ? String(s.published_at)    : null,
      }));

    // 4) Recheck via llm_proxy — returns { summary, confidence, verdict, raw_response }
    const llm = await callLLMProxy("recheck", {
      event: event ?? { id: analysis.event_id },
      initial_summary: analysis.summary ?? "",
      source_priors: sourcePriors,
    });

    const recheck = {
      summary: String(llm?.summary ?? ""),
      confidence: typeof llm?.confidence === "number" ? llm.confidence : 0.5,
      raw_response: String(llm?.raw_response ?? JSON.stringify(llm ?? {}))
    };

    // Use verdict from LLM directly; it now includes "correct"|"partial"|"wrong" in the JSON schema.
    // No bag-of-words fallback — if LLM didn't return a valid verdict, default to "partial".
    const VALID_VERDICTS = new Set<string>(["correct", "partial", "wrong"]);
    const verdict: Verdict = VALID_VERDICTS.has(llm?.verdict)
      ? llm.verdict as Verdict
      : "partial";

    // 5) Save revalidation
    const { data: revalRow, error: rErr } = await supabase
      .from("revalidations")
      .insert([{
        analysis_id: analysis.id,
        verdict,
        confidence: recheck.confidence,
        notes: "gemini recheck via llm_proxy",
        raw_response: recheck.raw_response
      }])
      .select("id, analysis_id, verdict, confidence, created_at")
      .single();

    if (rErr || !revalRow) {
      const msg = rErr?.message ?? "";
      // Race condition: another request already inserted — treat as success
      if (msg.toLowerCase().includes("duplicate") || msg.toLowerCase().includes("unique")) {
        await supabase
          .from("analysis_results")
          .update({ status: "verified" })
          .eq("id", analysisIdForFailMark);

        return json(200, { ok: true, analysis_id: analysisIdForFailMark, already_verified: true }, cors);
      }
      return json(500, { error: "failed to insert revalidation", details: rErr?.message }, cors);
    }

    // 6) Update reputation scores — atomic SQL to prevent race condition
    //    when run_verification_queue runs multiple analyses in parallel.
    const isCorrect = verdict === "correct";

    for (const link of links ?? []) {
      await supabase.rpc("increment_source_reputation", {
        p_source_id: link.source_id,
        p_is_correct: isCorrect
      });
    }

    // 7) Mark analysis verified (status only — verified column dropped)
    await supabase
      .from("analysis_results")
      .update({ status: "verified" })
      .eq("id", analysis.id);

    return json(200, {
      ok: true,
      analysis_id: analysis.id,
      verdict,
      revalidation_id: revalRow.id
    }, cors);
  } catch (err) {
    if (analysisIdForFailMark) {
      try {
        const supabase = getSupabaseServiceClient();
        await supabase
          .from("analysis_results")
          .update({ status: "failed" })
          .eq("id", analysisIdForFailMark);
      } catch (_) { /* ignore */ }
    }
    return json(500, { error: "internal_error", details: String(err) }, cors);
  }
});
