/**
 * llm_proxy (Gemini)
 * Stateless: no DB writes. Always returns normalized JSON:
 *   ok, summary, confidence, sources, raw_response
 * For task="recheck" also returns: verdict ("correct" | "partial" | "wrong")
 */

type Task = "ask" | "analyze" | "recheck";
type Verdict = "correct" | "partial" | "wrong";

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

function clamp01(x: number) {
  if (!Number.isFinite(x)) return 0.3;
  return Math.max(0, Math.min(1, x));
}

function safeStr(x: unknown, maxLen = 2000) {
  const s = typeof x === "string" ? x : String(x ?? "");
  return s.length > maxLen ? s.slice(0, maxLen) : s;
}

function buildPrompt(task: Task, input: unknown) {
  const inp = input as Record<string, unknown>;

  if (task === "ask" || task === "analyze") {
    return `Return ONLY valid JSON (no markdown, no backticks) with exactly this schema:
{
  "summary": string,
  "confidence": number,
  "sources": [{ "organization": string, "author_name": string }]
}
Rules:
- Do NOT invent URLs.
- If uncertain, say so in summary and reduce confidence.
- Keep summary 1-3 short sentences.

Task: Explain the most likely drivers of this market move.
User question: ${safeStr(inp?.question, 500)}
Event: ${JSON.stringify(inp?.event ?? {})}
Source context: ${JSON.stringify((inp?.source_priors ?? []))}
`;
  }

  // recheck — adds verdict to output schema so verify_analysis doesn't need bag-of-words
  return `Return ONLY valid JSON (no markdown, no backticks) with exactly this schema:
{
  "summary": string,
  "confidence": number,
  "verdict": "correct" | "partial" | "wrong",
  "sources": [{ "organization": string, "author_name": string }]
}
verdict rules:
- "correct"  : initial summary is substantively accurate given the event
- "partial"  : initial summary has the right direction but misses key drivers
- "wrong"    : initial summary significantly contradicts current assessment

Task: Re-evaluate whether the initial analysis was accurate.
Event: ${JSON.stringify(inp?.event ?? {})}
Initial summary: ${safeStr(inp?.initial_summary, 1500)}
`;
}

async function callGemini(promptText: string) {
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  const model = Deno.env.get("GEMINI_MODEL") ?? "gemini-2.0-flash";
  const base = (Deno.env.get("GEMINI_BASE_URL") ?? "https://generativelanguage.googleapis.com")
    .replace(/\/$/, ""); // trim trailing slash if any

  if (!apiKey) throw new Error("Missing GEMINI_API_KEY");

  // gemini-2.x+ uses v1; older models use v1beta
  const apiVersion = model.startsWith("gemini-1.") ? "v1beta" : "v1";
  const url = `${base}/${apiVersion}/models/${encodeURIComponent(model)}:generateContent`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);

  try {
    const resp = await fetch(url, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey
      },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: promptText }] }],
        generationConfig: { temperature: 0.2 }
      })
    });

    const raw = await resp.text().catch(() => "");
    if (!resp.ok) throw new Error(`Gemini ${resp.status}: ${raw}`);

    let data: unknown = null;
    try { data = JSON.parse(raw); } catch { return { raw_response: raw, text: raw }; }

    const text =
      (data as any)?.candidates?.[0]?.content?.parts
        ?.map((p: any) => p?.text)
        .filter(Boolean)
        .join("\n") ?? "";

    return { raw_response: raw, text };
  } finally {
    clearTimeout(timeout);
  }
}

const VALID_VERDICTS = new Set<string>(["correct", "partial", "wrong"]);

function stripCodeFence(text: string): string {
  // Remove ```json ... ``` or ``` ... ``` wrappers Gemini sometimes adds
  return text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/, "")
    .trim();
}

function normalizeLLM(task: Task, text: string, raw_response: string) {
  try {
    const obj = JSON.parse(stripCodeFence(text));

    const summary = typeof obj.summary === "string"
      ? obj.summary
      : "Unable to determine a reliable summary.";

    const confidence = clamp01(Number(obj.confidence));
    const sources = Array.isArray(obj.sources) ? obj.sources : [];

    const base = {
      summary: safeStr(summary, 1200),
      confidence,
      sources: sources.slice(0, 10).map((s: any) => ({
        organization: safeStr(s?.organization ?? "", 120),
        author_name: safeStr(s?.author_name ?? "", 120)
      })),
      raw_response
    };

    // Include verdict only for recheck task
    if (task === "recheck") {
      const verdict = VALID_VERDICTS.has(obj.verdict) ? obj.verdict as Verdict : null;
      return { ...base, verdict };
    }

    return base;
  } catch {
    const base = {
      summary: safeStr(text || "No response.", 1200),
      confidence: 0.25,
      sources: [] as unknown[],
      raw_response
    };
    return task === "recheck" ? { ...base, verdict: null } : base;
  }
}

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") return json(405, { ok: false, error: "Method Not Allowed" });

    const body = await req.json().catch(() => null);
    const task = body?.task as Task;

    if (!task || !["ask", "analyze", "recheck"].includes(task)) {
      return json(400, { ok: false, error: "task is required: ask | analyze | recheck" });
    }

    const provider = (Deno.env.get("LLM_PROVIDER") ?? "gemini").toLowerCase();
    const prompt = buildPrompt(task, body);

    let raw_response = "";
    let text = "";

    if (provider === "gemini") {
      const out = await callGemini(prompt);
      raw_response = out.raw_response;
      text = out.text;
    } else {
      raw_response = JSON.stringify({ provider: "dummy" });
      text = JSON.stringify({ summary: "Dummy summary", confidence: 0.6, sources: [], verdict: "correct" });
    }

    const norm = normalizeLLM(task, text, raw_response);

    return json(200, { ok: true, provider, task, ...norm });
  } catch (err) {
    console.error("[llm_proxy] unhandled error:", String(err));
    return json(500, { ok: false, error: "internal_error", details: String(err) });
  }
});
