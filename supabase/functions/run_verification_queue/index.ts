import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// CORS — ALLOWED_ORIGINS env değişkeninden alınan domain whitelist
// run_verification_queue sadece pg_cron / admin panelden çağrılmalı.
// CORS headers burada da tutarlılık için var ama asıl güvenlik CRON_SECRET ile.
const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") ?? "*")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";
  const allowOrigin =
    ALLOWED_ORIGINS[0] === "*"
      ? "*"
      : ALLOWED_ORIGINS.includes(origin)
      ? origin
      : (ALLOWED_ORIGINS[0] ?? "");
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
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

/** Batch'ler halinde Promise.all çalıştır — rate limit koruması */
async function runInBatches<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const batchResults = await Promise.all(batch.map(fn));
    results.push(...batchResults);
  }
  return results;
}

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  try {
    if (req.method !== "POST") return json(405, { error: "Method Not Allowed" }, cors);

    // ── CRON_SECRET auth kontrolü ─────────────────────────────────────────────
    // Prod'da Supabase → Edge Functions → Secrets'e CRON_SECRET ekleyin.
    // pg_cron da aynı secret'ı Authorization header'ında göndermelidir.
    const cronSecret = Deno.env.get("CRON_SECRET");
    if (cronSecret) {
      const authHeader = req.headers.get("Authorization") ?? "";
      if (authHeader !== `Bearer ${cronSecret}`) {
        return json(401, { error: "Unauthorized" }, cors);
      }
    }

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
      return json(500, { error: "failed to load queue", details: qErr.message }, cors);
    }

    const ids = (due ?? []).map((r) => r.id);
    if (ids.length === 0) {
      return json(200, { ok: true, processed: 0, message: "no due analyses" }, cors);
    }

    // 2) Batch'ler halinde çalıştır — 3 eş zamanlı Gemini çağrısı (rate limit koruması)
    const CONCURRENCY = 3;
    const results = await runInBatches(ids, CONCURRENCY, async (analysis_id) => {
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
    });

    const succeeded = results.filter((r) => r.ok).length;
    const failed = results.length - succeeded;

    return json(200, { ok: true, processed: results.length, succeeded, failed, results }, cors);
  } catch (err) {
    return json(500, { error: "internal_error", details: String(err) }, cors);
  }
});
