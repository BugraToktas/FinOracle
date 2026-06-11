/**
 * llm_proxy (Gemini)
 * Stateless: no DB writes. Always returns normalized JSON:
 *   ok, summary, confidence, sources, raw_response
 * For task="recheck" also returns: verdict ("correct" | "partial" | "wrong")
 */

type Task = "ask" | "analyze" | "recheck" | "extract_asset";
type Verdict = "correct" | "partial" | "wrong";

// CORS — ALLOWED_ORIGINS env değişkeninden alınan domain whitelist
// llm_proxy şu an sadece edge function'lardan çağrılıyor;
// gelecekte direkt frontend çağrısı için hazır.
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

  // ── extract_asset ───────────────────────────────────────────────────────
  if (task === "extract_asset") {
    return `You are a financial asset identifier. Extract the primary financial asset from the question.
Return ONLY valid JSON (no markdown, no backticks):
{
  "asset_code": string | null,
  "name": string,
  "confidence": number
}
Format rules:
- Stocks: use exchange ticker (THYAO, AAPL, NVDA)
- Turkish stocks: BIST ticker without exchange suffix (THYAO not THYAO.IS)
- Crypto: SYMBOL/USD format (BTC/USD, ETH/USD, SOL/USD)
- Forex: BASE/QUOTE format (USD/TRY, EUR/USD, GBP/USD)
- Commodities: XAU/USD (gold), XAG/USD (silver), USOIL (crude oil)
- Indices: SPX, NDX, DJI, DAX, BIST100
- If no clear financial asset, return null with confidence 0.

Question: "${safeStr(inp?.question as string, 500)}"`;
  }

  // ── ask / analyze ───────────────────────────────────────────────────────
  if (task === "ask" || task === "analyze") {
    const event = inp?.event as Record<string, unknown> ?? {};
    const sources = inp?.source_priors as unknown[] ?? [];
    const eventDate = event?.event_date ?? "unknown date";
    const assetCode = event?.asset_code ?? "the asset";
    const direction = event?.direction ?? "moved";
    const questionText = safeStr(inp?.question as string, 500);
    const daysSince = typeof inp?.days_since_event === "number" ? inp.days_since_event : 0;

    // Detect question language: Turkish chars or common TR stop words → Turkish
    const TR_STOP = /\b(neden|nasıl|neden|hangi|hisse|yükseldi|düştü|artış|azalış|piyasa|borsa|neden|olan|için|ancak|çünkü|ama|veya|dolar|altın|fiyat)\b/i;
    const HAS_TR_CHARS = /[ğüşıöçĞÜŞİÖÇ]/.test(questionText);
    const isTurkish = HAS_TR_CHARS || TR_STOP.test(questionText);
    const summaryLanguage = isTurkish ? "Turkish" : "English";

    // Historical context note: for events > 30 days old, tell LLM to analyze from archive
    const historicalNote = daysSince > 30
      ? `\nHISTORICAL ANALYSIS NOTE: This event occurred ${daysSince} days ago. The sources below are archived news from that period — they are the best available evidence. Analyze confidently from what the sources say; do NOT claim you cannot analyze because the event is in the past.`
      : "";

    // Sanitize a string for safe inclusion in the prompt
    function sanitizeForPrompt(v: unknown, maxLen = 280): string {
      return String(v ?? "")
        .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&#\d+;/g, "")
        .replace(/[\u0000-\u001F\u007F]/g, " ")  // control characters
        .replace(/\|/g, "-")                       // pipe breaks our column format
        .replace(/\s+/g, " ").trim()
        .slice(0, maxLen);
    }

    // Format sources for readability — numbered list for LLM index references
    const sourcesBlock = (sources as Record<string, unknown>[]).map((s, i) => {
      const title   = sanitizeForPrompt(s?.title, 180);
      const domain  = sanitizeForPrompt(s?.domain, 60);
      const date    = sanitizeForPrompt(s?.published_at, 40) || "unknown date";
      const snippet = s?.snippet ? ` - ${sanitizeForPrompt(s.snippet, 200)}` : "";
      return `[${i + 1}] ${date} | ${domain} | ${title}${snippet}`;
    }).join("\n");

    return `You are a financial analyst. Explain why ${assetCode} moved ${direction} on ${eventDate}.${historicalNote}

Return ONLY valid JSON (no markdown, no backticks):
{
  "summary": string,
  "confidence": number,
  "used_indices": number[]
}

Rules for summary:
- CRITICAL: Write the summary in ${summaryLanguage}. The user asked in ${summaryLanguage} — always respond in the same language regardless of source languages.
- 2–4 sentences. Focus on the most probable causes based on what the sources say.
- If exact-date sources are unavailable, reason from the broader market context and sector dynamics described in the sources. State the reasoning is based on contextual evidence.
- NEVER return confidence 0 or say "I cannot determine" just because sources are dated outside the event window. Always produce a best-effort analysis.
- Do not fabricate specific prices, dates, or events not mentioned in the sources.

Rules for used_indices:
- List 1-based source numbers (e.g. [2, 5, 9]) of every source you used to write the summary.
- A source is "used" if it mentions ${assetCode}, related assets, or market conditions that contributed to the move.
- Sources may be in Turkish or English — treat both equally.
- Prefer sources within ±7 days of ${eventDate}. Accept sources up to 14 days away if nothing closer exists.

Rules for confidence:
- 0.75–1.0 : 2 or more sources within ±7 days that discuss ${assetCode} or direct market drivers for the period.
- 0.5–0.74 : 1 relevant source within ±7 days, OR 2+ sources that discuss indirect but clearly related factors.
- 0.25–0.49: Contextual sources (macro conditions, sector news) from outside the ±7 day window that still discuss ${assetCode} or related market dynamics.
- 0.1–0.24 : Sources are outside the time window but discuss the asset class or broader market context that plausibly explains the move.

User question: ${questionText}
Event: asset=${assetCode}, date=${eventDate}, direction=${direction}

Sources (numbered):
${sourcesBlock}
`;
  }



  // ── recheck ─────────────────────────────────────────────────────────────
  const recheckEvent   = inp?.event as Record<string, unknown> | undefined;
  const recheckSources = inp?.source_priors as Record<string, unknown>[] | undefined;
  const eventDateStr   = recheckEvent?.event_date ?? "unknown date";
  const assetCodeStr   = recheckEvent?.asset_code  ?? "the asset";
  const directionStr   = recheckEvent?.direction   ?? "moved";

  const sourcesBlock = recheckSources && recheckSources.length > 0
    ? recheckSources.map((s, i) => {
        const title   = safeStr(s?.title   ?? "", 180);
        const domain  = safeStr(s?.domain  ?? "", 60);
        const date    = safeStr(s?.published_at ?? "unknown date", 40);
        const snippet = s?.snippet ? ` - ${safeStr(s.snippet, 200)}` : "";
        return `[${i + 1}] ${date} | ${domain} | ${title}${snippet}`;
      }).join("\n")
    : "No source documents available.";

  return `You are a skeptical financial fact-checker auditing an AI-generated market analysis.
Your job is to find weaknesses, unsupported claims, and contradictions — NOT to confirm the analysis.

Return ONLY valid JSON (no markdown, no backticks) with exactly this schema:
{
  "summary": string,
  "confidence": number,
  "verdict": "correct" | "partial" | "wrong",
  "reasoning": string,
  "sources": [{ "organization": string, "author_name": string }]
}

Verdict rules (apply strictly):
- "correct" : EVERY specific claim in the initial summary is directly supported by at least one source.
              The main causal drivers are present in the sources. No material omissions.
- "partial" : The direction (up/down) is right but at least one key driver is missing OR a claim is
              only weakly supported (e.g. source is >14 days from ${eventDateStr}, or discusses a different asset).
- "wrong"   : The initial summary contradicts what the sources actually say, OR it asserts specific facts
              (prices, percentages, named events) that are absent from all sources.

Confidence rules (0.0 – 1.0):
- Start at 0.5. Add 0.25 for each source that directly mentions ${assetCodeStr} within ±7 days of ${eventDateStr}.
- Subtract 0.2 for each specific claim in the summary that is NOT backed by any source.
- Cap at 0.9 unless 3+ direct sources within ±3 days exist.

Critical checks you MUST perform:
1. Does the initial summary make any specific numerical claims (%, prices, dates)?  
   If yes, are they present in the sources? If not → lean toward "wrong".
2. Are any sources dated AFTER ${eventDateStr}?  
   Post-event sources cannot be used as proof the initial analysis was correct — note this in reasoning.
3. Are the sources about ${assetCodeStr} specifically, or just about the sector/macro?  
   Sector-only sources only weakly support asset-specific claims.
4. Does the summary attribute the move to a specific event (e.g. Fed decision, earnings beat)?  
   Is that event explicitly mentioned in the sources? If not → "partial" or "wrong".

Event being re-evaluated:
  Asset: ${assetCodeStr}
  Date:  ${eventDateStr}
  Direction: ${directionStr}

Initial summary under audit:
${safeStr(inp?.initial_summary as string, 1500)}

Original sources used in the analysis:
${sourcesBlock}

Provide a brief reasoning field explaining your verdict before the final confidence score.
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

    // New schema: used_indices (1-based) — passed back to ask_finoracle for source resolution
    const usedIndices: number[] = Array.isArray(obj.used_indices)
      ? obj.used_indices.filter((i: unknown) => typeof i === "number" && i >= 1).slice(0, 15)
      : [];

    // Legacy compat: some callers may still check obj.sources
    const legacySources = Array.isArray(obj.sources) ? obj.sources : [];

    // recheck: include the auditor's reasoning chain and verdict
    const reasoning = typeof obj.reasoning === "string" ? safeStr(obj.reasoning, 600) : null;

    const base = {
      summary: safeStr(summary, 1200),
      confidence,
      used_indices: usedIndices,
      // Keep legacy sources array for recheck compatibility
      sources: legacySources.slice(0, 10).map((s: any) => ({
        organization: safeStr(s?.organization ?? "", 120),
        author_name:  safeStr(s?.author_name  ?? "", 120)
      })),
      raw_response
    };

    if (task === "recheck") {
      const verdict = VALID_VERDICTS.has(obj.verdict) ? obj.verdict as Verdict : null;
      return { ...base, verdict, reasoning };
    }

    return base;
  } catch {
    const base = {
      summary:      safeStr(text || "No response.", 1200),
      confidence:   0.25,
      used_indices: [] as number[],
      sources:      [] as unknown[],
      raw_response
    };
    return task === "recheck" ? { ...base, verdict: null, reasoning: null } : base;
  }
}

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  try {
    if (req.method !== "POST") return json(405, { ok: false, error: "Method Not Allowed" }, cors);

    const body = await req.json().catch(() => null);
    const task = body?.task as Task;

    if (!task || !["ask", "analyze", "recheck", "extract_asset"].includes(task)) {
      return json(400, { ok: false, error: "task is required: ask | analyze | recheck | extract_asset" }, cors);
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
      text = JSON.stringify({ summary: "Dummy summary", confidence: 0.6, used_indices: [], sources: [], verdict: "correct" });
    }

    // extract_asset uses its own light normalizer
    if (task === "extract_asset") {
      try {
        const obj = JSON.parse(stripCodeFence(text)) as Record<string, unknown>;
        return json(200, {
          ok: true,
          provider,
          task,
          asset_code: obj?.asset_code ?? null,
          name: obj?.name ?? "",
          confidence: clamp01(Number(obj?.confidence ?? 0)),
        }, cors);
      } catch {
        return json(200, { ok: true, provider, task, asset_code: null, name: "", confidence: 0 }, cors);
      }
    }

    const norm = normalizeLLM(task, text, raw_response);
    return json(200, { ok: true, provider, task, ...norm }, cors);
  } catch (err) {
    console.error("[llm_proxy] unhandled error:", String(err));
    return json(500, { ok: false, error: "internal_error", details: String(err) }, cors);
  }
});
