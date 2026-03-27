import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS }
  });
}

function getSupabaseServiceClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key);
}

type AskInput = {
  asset_code: string;
  event_date: string;
  direction: "up" | "down";
  question: string;
};

type RetrievedItem = {
  url: string;
  title: string;
  domain: string;
  published_at?: string | null;
  snippet?: string | null;
};

type AskAnswer = {
  summary: string;
  confidence: number;
  raw_response: string;
};

type LlmSource = {
  organization: string;
  author_name?: string;
};

async function postFn(fnName: string, payload: unknown) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  if (!supabaseUrl) throw new Error("Missing SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");

  const resp = await fetch(`${supabaseUrl}/functions/v1/${fnName}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(anon ? { Authorization: `Bearer ${anon}` } : {})
    },
    body: JSON.stringify(payload)
  });

  const text = await resp.text().catch(() => "");
  return { ok: resp.ok, status: resp.status, text };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  let step = "start";
  try {
    if (req.method !== "POST") return json(405, { error: "Method Not Allowed" });

    step = "parse_body";
    const body = (await req.json().catch(() => null)) as AskInput | null;
    if (!body?.asset_code || !body?.event_date || !body?.direction || !body?.question) {
      return json(400, { error: "asset_code, event_date, direction and question are required" });
    }

    const supabase = getSupabaseServiceClient();

    // 1) Upsert market_event
    step = "upsert_market_event";
    const { data: event, error: eErr } = await supabase
      .from("market_events")
      .upsert(
        { asset_code: body.asset_code, event_date: body.event_date, direction: body.direction },
        { onConflict: "asset_code,event_date,direction" }
      )
      .select("id, asset_code, event_date, direction")
      .single();

    if (eErr || !event) {
      return json(500, { step, error: "failed to upsert market_event", details: eErr?.message });
    }

    // 2) Retrieve sources
    step = "retrieve_sources_call";
    const rs = await postFn("retrieve_sources", {
      query: body.question,
      asset_code: body.asset_code,
      limit: 10,
      debug: false,
      event: { event_date: body.event_date, asset_code: body.asset_code }
    });

    if (!rs.ok) {
      return json(500, { step, error: "retrieve_sources_failed", status: rs.status, details: rs.text });
    }

    const rsJson = JSON.parse(rs.text);
    const retrieved: RetrievedItem[] = Array.isArray(rsJson.items) ? rsJson.items : [];

    // 3) Upsert source_documents
    // FIX: snippet → content_snippet; provider removed (not in schema)
    step = "upsert_source_documents";
    const docsToUpsert = retrieved
      .filter((it) => it?.url && it?.domain)
      .map((it) => ({
        url: it.url,
        title: it.title ?? "",
        domain: it.domain,
        published_at: it.published_at ?? null,
        content_snippet: it.snippet ?? null,
        fetched_at: new Date().toISOString()
      }));

    let upsertedDocs: Array<{ id: string; url: string }> = [];
    if (docsToUpsert.length > 0) {
      const { data: docRows, error: dErr } = await supabase
        .from("source_documents")
        .upsert(docsToUpsert, { onConflict: "url" })
        .select("id,url");

      if (dErr) {
        return json(500, { step, error: "failed_to_upsert_source_documents", details: dErr.message });
      }
      upsertedDocs = (docRows ?? []) as Array<{ id: string; url: string }>;
    }

    // 4) LLM analysis
    step = "llm_proxy_call";
    const lp = await postFn("llm_proxy", {
      task: "ask",
      question: body.question,
      event: { asset_code: body.asset_code, event_date: body.event_date, direction: body.direction },
      source_priors: retrieved.slice(0, 8).map((d) => ({
        domain: d.domain,
        title: d.title,
        url: d.url,
        snippet: d.snippet ?? null,
        published_at: d.published_at ?? null
      }))
    });

    if (!lp.ok) {
      return json(500, { step, error: "llm_proxy_failed", status: lp.status, details: lp.text });
    }

    const lpJson = JSON.parse(lp.text);
    const answer: AskAnswer = {
      summary: String(lpJson.summary ?? "No summary."),
      confidence: Number(lpJson.confidence ?? 0.3),
      raw_response: String(lpJson.raw_response ?? lp.text)
    };

    // 5) Insert analysis_results (verified column dropped — use status only)
    step = "insert_analysis_results";
    const verifyAfter = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: analysisRow, error: aErr } = await supabase
      .from("analysis_results")
      .insert([{
        event_id: event.id,
        summary: answer.summary,
        confidence: answer.confidence,
        raw_response: answer.raw_response,
        verify_after: verifyAfter,
        status: "pending"
      }])
      .select("id, created_at")
      .single();

    if (aErr || !analysisRow) {
      return json(500, { step, error: "failed_to_insert_analysis_results", details: aErr?.message });
    }

    // 6) Link source_documents → analysis_document_links
    step = "upsert_analysis_document_links";
    if (upsertedDocs.length > 0) {
      const used = upsertedDocs.slice(0, 5);
      const w = 1 / used.length;

      for (const d of used) {
        const { error: lErr } = await supabase
          .from("analysis_document_links")
          .upsert(
            { analysis_id: analysisRow.id, document_id: d.id, weight_used: w },
            { onConflict: "analysis_id,document_id" }
          );

        if (lErr) {
          return json(500, { step, error: "failed_to_upsert_analysis_document_links", details: lErr.message });
        }
      }
    }

    // 7) Upsert news_sources + analysis_source_links from LLM-identified sources
    //    This is what feeds the reputation system in verify_analysis.
    step = "upsert_news_sources_and_links";
    const llmSources: LlmSource[] = Array.isArray(lpJson.sources) ? lpJson.sources : [];

    for (const s of llmSources) {
      if (!s?.organization) continue;

      const { data: srcRow, error: srcErr } = await supabase
        .from("news_sources")
        .upsert(
          {
            organization: s.organization,
            author_name: s.author_name ?? "",
            last_updated: new Date().toISOString()
          },
          { onConflict: "organization,author_name" }
        )
        .select("id")
        .single();

      if (srcErr || !srcRow) continue;

      await supabase
        .from("analysis_source_links")
        .upsert(
          { analysis_id: analysisRow.id, source_id: srcRow.id, weight_used: null },
          { onConflict: "analysis_id,source_id" }
        );
    }

    return json(200, {
      ok: true,
      step: "done",
      event,
      analysis_id: analysisRow.id,
      counts: {
        retrieved: retrieved.length,
        docs_upserted: upsertedDocs.length,
        llm_sources_linked: llmSources.length
      },
      answer: {
        summary: answer.summary,
        confidence: answer.confidence,
        sources: retrieved.slice(0, 5).map((d) => ({ domain: d.domain, title: d.title, url: d.url }))
      }
    });
  } catch (err) {
    return json(500, { ok: false, step, error: "internal_error", details: String(err) });
  }
});
