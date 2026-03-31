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
  asset_code?: string;   // optional — inferred from question if omitted
  event_date: string;
  direction: "up" | "down";
  question: string;
};

// ─── Asset code inference from natural language ───────────────────────────────

/**
 * Ordered list of [regex, assetCode] pairs.
 * Checked top-to-bottom; first match wins.
 * Covers Turkish & English names, common abbreviations, crypto, forex, indices.
 */
const ASSET_PATTERNS: [RegExp, string][] = [
  // ── Crypto ────────────────────────────────────────────────────────────
  [/\b(bitcoin|btc)\b/i,            "BTC/USD"],
  [/\b(ethereum|eth|ether)\b/i,     "ETH/USD"],
  [/\b(solana|sol)\b/i,             "SOL/USD"],
  [/\b(ripple|xrp)\b/i,             "XRP/USD"],
  [/\b(binance coin|bnb)\b/i,       "BNB/USD"],
  [/\b(cardano|ada)\b/i,            "ADA/USD"],
  [/\b(dogecoin|doge)\b/i,          "DOGE/USD"],
  [/\b(avalanche|avax)\b/i,         "AVAX/USD"],
  [/\b(chainlink|link)\b/i,         "LINK/USD"],
  [/\b(polkadot|dot)\b/i,           "DOT/USD"],
  [/\b(polygon|matic)\b/i,          "MATIC/USD"],
  [/\b(litecoin|ltc)\b/i,           "LTC/USD"],
  // ── Turkish stocks ────────────────────────────────────────────────────
  [/\b(thy|türk hava yollar[ıi]|turkish airlines|thyao)\b/i, "THYAO"],
  [/\b(garanti ban|garan)\b/i,      "GARAN"],
  [/\b(akbank|akbnk)\b/i,           "AKBNK"],
  [/\b(i[sş] bankas[ıi]|isctr)\b/i,"ISCTR"],
  [/\b(ere[gğ]li|eregl)\b/i,        "EREGL"],
  [/\b(bi[̇i]m market|bimas)\b/i,   "BIMAS"],
  [/\b(tüpra[sş]|tuprs)\b/i,        "TUPRS"],
  [/\b(ko[cç] holding|kchol)\b/i,   "KCHOL"],
  [/\b(sabanc[ıi]|sahol)\b/i,       "SAHOL"],
  [/\b([sş]i[sş]e cam|sise)\b/i,    "SISE"],
  [/\b(turkcell|tcell)\b/i,         "TCELL"],
  [/\b(aselsan|asels)\b/i,          "ASELS"],
  [/\b(ford otosan|froto)\b/i,       "FROTO"],
  [/\b(tofa[sş]|toaso)\b/i,         "TOASO"],
  // ── US stocks ─────────────────────────────────────────────────────────
  [/\b(apple|aapl)\b/i,             "AAPL"],
  [/\b(microsoft|msft)\b/i,         "MSFT"],
  [/\b(google|alphabet|googl)\b/i,  "GOOGL"],
  [/\b(amazon|amzn)\b/i,            "AMZN"],
  [/\b(tesla|tsla)\b/i,             "TSLA"],
  [/\b(nvidia|nvda)\b/i,            "NVDA"],
  [/\b(meta|facebook|fb)\b/i,       "META"],
  [/\b(netflix|nflx)\b/i,           "NFLX"],
  [/\b(jpmorgan|jpm)\b/i,           "JPM"],
  [/\b(goldman sachs|gs)\b/i,       "GS"],
  [/\b(intel|intc)\b/i,             "INTC"],
  [/\b(amd|advanced micro)\b/i,     "AMD"],
  [/\b(disney|dis)\b/i,             "DIS"],
  [/\b(berkshire|brk)\b/i,          "BRK-B"],
  [/\b(visa)\b/i,                   "V"],
  [/\b(mastercard|mc)\b/i,          "MA"],
  [/\b(coca.?cola|coke|ko)\b/i,     "KO"],
  [/\b(exxon|xom)\b/i,              "XOM"],
  [/\b(johnson.{0,5}johnson|jnj)\b/i, "JNJ"],
  // ── Asian stocks ──────────────────────────────────────────────────────
  [/\b(xiaomi)\b/i,                 "1810.HK"],
  [/\b(samsung)\b/i,                "005930.KS"],
  [/\b(toyota|7203)\b/i,            "7203.T"],
  [/\b(sony|6758)\b/i,              "6758.T"],
  [/\b(alibaba|baba)\b/i,           "BABA"],
  [/\b(tencent|0700)\b/i,           "0700.HK"],
  [/\b(baidu|bidu)\b/i,             "BIDU"],
  [/\b(taiwan semi|tsmc)\b/i,       "TSM"],
  [/\b(softbank|9984)\b/i,          "9984.T"],
  // ── European stocks ───────────────────────────────────────────────────
  [/\b(lvmh|louis vuitton)\b/i,     "MC.PA"],
  [/\b(volkswagen|vw|vow)\b/i,      "VOW3.DE"],
  [/\b(bmw)\b/i,                    "BMW.DE"],
  [/\b(mercedes|mbg)\b/i,           "MBG.DE"],
  [/\b(sap)\b/i,                    "SAP.DE"],
  [/\b(hsbc)\b/i,                   "HSBA.L"],
  [/\b(shell)\b/i,                  "SHEL.L"],
  [/\b(asml)\b/i,                   "ASML"],
  [/\b(nestl[eé])\b/i,              "NESN.SW"],
  [/\b(novartis)\b/i,               "NVS"],
  // ── Forex ─────────────────────────────────────────────────────────────
  [/\b(dolar|dollar|usd[\s/-]?try)\b/i, "USD/TRY"],
  [/\b(eur[\s/-]?usd|euro dolar)\b/i,   "EUR/USD"],
  [/\b(eur[\s/-]?try|euro t[uü]rk)\b/i, "EUR/TRY"],
  [/\b(gbp[\s/-]?usd|sterlin)\b/i,      "GBP/USD"],
  [/\b(jpy|japon yeni|yen)\b/i,         "USD/JPY"],
  // ── Commodities ───────────────────────────────────────────────────────
  [/\b(gold|alt[ıi]n|xau)\b/i,          "XAU/USD"],
  [/\b(silver|gümü[sş]|xag)\b/i,        "XAG/USD"],
  [/\b(oil|petrol|crude|wti|brent)\b/i, "USOIL"],
  // ── Indices ───────────────────────────────────────────────────────────
  [/\b(bist\s*100|xu100|borsa istanbul)\b/i, "BIST100"],
  [/\b(s&p\s*500|sp500|spx)\b/i,             "SPX"],
  [/\b(nasdaq|ndx|tech index)\b/i,           "NDX"],
  [/\b(dow jones|dji|djia)\b/i,              "DJI"],
  [/\b(dax)\b/i,                             "DAX"],
];

function inferAssetCode(question: string): string | null {
  for (const [pattern, code] of ASSET_PATTERNS) {
    if (pattern.test(question)) return code;
  }
  return null;
}

// ─── Tier 2: Yahoo Finance symbol search ─────────────────────────────────────

/**
 * Normalise a Yahoo Finance symbol to our internal format.
 * Yahoo suffixes:  .IS=Istanbul, .L=London, .T=Tokyo, .PA=Paris, etc.
 * Yahoo crypto:    BTC-USD  →  BTC/USD
 * Yahoo forex:     EURUSD=X →  EUR/USD
 */
function normalizeYahooSymbol(symbol: string): string {
  const s = symbol.trim().toUpperCase();
  // Crypto: BTC-USD, ETH-BTC
  const cryptoMatch = s.match(/^([A-Z]{2,10})-(USD|USDT|EUR|BTC|ETH)$/);
  if (cryptoMatch) return `${cryptoMatch[1]}/${cryptoMatch[2]}`;
  // Forex: EURUSD=X (always 8 chars)
  if (s.endsWith("=X") && s.length === 8) return `${s.slice(0, 3)}/${s.slice(3, 6)}`;
  // BIST: THYAO.IS → THYAO
  if (s.endsWith(".IS")) return s.slice(0, -3);
  // Other exchange suffixes: .L .T .PA .DE → strip
  const dotIdx = s.lastIndexOf(".");
  if (dotIdx > 0 && s.length - dotIdx <= 3) return s.slice(0, dotIdx);
  return s;
}

// ─── Human-readable names for non-English ticker codes ───────────────────────
// Used to build better Google News search queries (e.g. "1810.HK Xiaomi fall")
const ASSET_DISPLAY_NAMES: Record<string, string> = {
  // Asian stocks
  "1810.HK":    "Xiaomi",
  "0700.HK":    "Tencent",
  "9988.HK":    "Alibaba",
  "005930.KS":  "Samsung",
  "7203.T":     "Toyota",
  "6758.T":     "Sony",
  "9984.T":     "SoftBank",
  "6861.T":     "Keyence",
  // European stocks
  "MC.PA":      "LVMH",
  "OR.PA":      "L'Oreal",
  "VOW3.DE":    "Volkswagen",
  "BMW.DE":     "BMW",
  "MBG.DE":     "Mercedes",
  "SAP.DE":     "SAP",
  "SIE.DE":     "Siemens",
  "HSBA.L":     "HSBC",
  "SHEL.L":     "Shell",
  "BP.L":       "BP",
  "NESN.SW":    "Nestle",
  "ROG.SW":     "Roche",
  "NOVN.SW":    "Novartis",
  "ASML.AS":    "ASML",
  // Turkish stocks
  "THYAO":      "Turkish Airlines",
  "GARAN":      "Garanti Bank",
  "AKBNK":      "Akbank",
  "ISCTR":      "Is Bankasi",
  "EREGL":      "Eregli Steel",
  "BIMAS":      "BIM",
  "TUPRS":      "Tupras",
  "KCHOL":      "Koc Holding",
  "SAHOL":      "Sabanci Holding",
  "SISE":       "Sise Cam",
  "TCELL":      "Turkcell",
  "ASELS":      "Aselsan",
  "FROTO":      "Ford Otosan",
  "TOASO":      "Tofas",
};

async function searchYahooFinance(query: string): Promise<string | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=3&newsCount=0&enableFuzzyQuery=false`;
    const resp = await fetch(url, {
      signal: AbortSignal.timeout(5_000),
      headers: { "User-Agent": "Mozilla/5.0 (compatible; FinOracle/1.0)" },
    });
    if (!resp.ok) return null;
    const data = await resp.json() as Record<string, unknown>;
    const quotes = data?.quotes as Record<string, unknown>[] | undefined;
    const first = quotes?.find((q) => q?.quoteType === "EQUITY" || q?.quoteType === "CRYPTOCURRENCY" || q?.quoteType === "CURRENCY");
    const sym = (first ?? quotes?.[0])?.symbol as string | undefined;
    return sym ? normalizeYahooSymbol(sym) : null;
  } catch { return null; }
}

// ─── Tier 3: LLM-based asset extraction ──────────────────────────────────────

async function extractAssetViaLLM(question: string, postFnImpl: (name: string, payload: unknown) => Promise<{ ok: boolean; text: string }>): Promise<string | null> {
  try {
    const { ok, text } = await postFnImpl("llm_proxy", { task: "extract_asset", question });
    if (!ok) return null;
    const data = JSON.parse(text) as Record<string, unknown>;
    const code = data?.asset_code as string | undefined;
    return code && code !== "null" ? code : null;
  } catch { return null; }
}

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
    const missing = ["event_date","direction","question"]
      .filter((k) => !body?.[k as keyof AskInput]);
    if (!body || missing.length > 0) {
      return json(400, {
        error: "Missing required fields",
        missing,
        example: {
          asset_code: "BTC/USD",   // optional — inferred from question if omitted
          event_date: "2026-03-20",
          direction: "up",
          question: "Why did Bitcoin surge on March 20 2026?"
        }
      });
    }

    // ── Asset code resolution: 3-tier fallback ───────────────────────────
    let inferredAssetCode: string | null = null;
    let inferMethod: string | undefined;

    if (!body.asset_code) {
      // Tier 1: regex pattern matching
      inferredAssetCode = inferAssetCode(body.question);
      if (inferredAssetCode) {
        inferMethod = "pattern";
      } else {
        // Tier 2: Yahoo Finance symbol search
        inferredAssetCode = await searchYahooFinance(body.question);
        if (inferredAssetCode) {
          inferMethod = "yahoo_finance";
        } else {
          // Tier 3: LLM extraction
          inferredAssetCode = await extractAssetViaLLM(body.question, postFn);
          if (inferredAssetCode) inferMethod = "llm";
        }
      }

      if (!inferredAssetCode) {
        return json(400, {
          error: "Could not identify the financial asset in your question.",
          hint: "Please provide asset_code explicitly (e.g. 'BTC/USD', 'THYAO', 'USD/TRY') or mention the asset name more clearly in your question.",
        });
      }
      body.asset_code = inferredAssetCode;
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

    // 2) Retrieve sources — ask for 20 (10 Google News + 10 Yahoo + RSS)
    // Use a clean English search query (never the raw user question which may be Turkish).
    // Format: "{asset} {direction_keywords} {month_year}"
    // This avoids non-English tokens polluting Google News search and RSS matching.
    step = "retrieve_sources_call";
    const dirKeywords   = body.direction === "up" ? "surge rally" : "fall decline";
    // Include human-readable name so Google News finds "Xiaomi" not just "1810.HK"
    const displayName   = ASSET_DISPLAY_NAMES[body.asset_code] ?? "";
    // Note: month/year are intentionally excluded from retrieveQuery —
    // they become overly broad tokens that match unrelated articles.
    // Date range is already handled by retrieve_sources via event.event_date.
    const retrieveQuery = [body.asset_code, displayName, dirKeywords]
      .filter(Boolean).join(" ");

    const rs = await postFn("retrieve_sources", {
      query: retrieveQuery,
      asset_code: body.asset_code,
      limit: 20,
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
      // Send up to 15 sources to LLM — more context = better analysis
      source_priors: retrieved.slice(0, 15).map((d) => ({
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
      ...(inferredAssetCode ? { inferred_asset_code: inferredAssetCode, infer_method: inferMethod } : {}),
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
