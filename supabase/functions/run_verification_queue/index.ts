import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  try {
    if (req.method !== "POST") return json(405, { error: "Method Not Allowed" });

    const supabase = getSupabaseServiceClient();
    const baseUrl = Deno.env.get("SUPABASE_URL");
    const anon = Deno.env.get("SUPABASE_ANON_KEY");
    if (!baseUrl || !anon) throw new Error("Missing SUPABASE_URL or SUPABASE_ANON_KEY");

    const functionUrl = `${baseUrl}/functions/v1/verify_analysis`;
    const nowIso = new Date().toISOString();

    // 1) Fetch due pending analyses
    const { data: due, error: qErr } = await supabase
      .from("analysis_results")
      .select("id")
      .eq("status", "pending")
      .lte("verify_after", nowIso)
      .limit(20);

    if (qErr) {
      return json(500, { error: "failed to load queue", details: qErr.message });
    }

    const ids = (due ?? []).map((r) => r.id);
    if (ids.length === 0) {
      return json(200, { ok: true, processed: 0, message: "no due analyses" });
    }

    // 2) Run all verifications in parallel
    const results = await Promise.all(
      ids.map(async (analysis_id) => {
        try {
          const resp = await fetch(functionUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${anon}`,
              "apikey": anon
            },
            body: JSON.stringify({ analysis_id })
          });

          if (!resp.ok) {
            const text = await resp.text().catch(() => "");
            // verify_analysis marks itself failed; mirror here for visibility
            await supabase
              .from("analysis_results")
              .update({ status: "failed" })
              .eq("id", analysis_id);

            return { analysis_id, ok: false, status: resp.status, error: text.slice(0, 300) };
          }

          return { analysis_id, ok: true, status: resp.status };
        } catch (err) {
          return { analysis_id, ok: false, error: String(err).slice(0, 300) };
        }
      })
    );

    const succeeded = results.filter((r) => r.ok).length;
    const failed = results.length - succeeded;

    return json(200, { ok: true, processed: results.length, succeeded, failed, results });
  } catch (err) {
    return json(500, { error: "internal_error", details: String(err) });
  }
});
