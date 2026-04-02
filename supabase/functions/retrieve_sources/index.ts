import { XMLParser } from "https://esm.sh/fast-xml-parser@4";

// ─── Types ────────────────────────────────────────────────────────────────────

type Provider = "rss" | "finnhub" | "alphavantage" | "yahoo_news" | "newsdata";

type RetrieveInput = {
  query: string;
  asset_code?: string;
  event?: { event_date?: string; asset_code?: string };
  limit?: number;
  debug?: boolean;
  no_filter?: boolean;
};

type SourceItem = {
  url: string;
  title: string;
  domain: string;
  published_at?: string | null;
  snippet?: string | null;
  provider: Provider;
};

// ─── Utilities ────────────────────────────────────────────────────────────────

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function safeStr(x: unknown, maxLen = 400) {
  const s = typeof x === "string" ? x : String(x ?? "");
  return s.length > maxLen ? s.slice(0, maxLen) : s;
}

function toDomain(url: string) {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; }
}

function uniqByUrl(items: SourceItem[]) {
  const seen = new Set<string>();
  return items.filter((it) => {
    const key = (it.url ?? "").trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// Words that are too generic for RSS matching — would match unrelated articles
const TOKENIZE_SKIP = new Set([
  // Direction words (already in retrieveQuery for context, not useful for filtering)
  "rise", "fall", "drop", "surge", "rally", "jump", "decline", "crash", "plunge",
  // Month names (every article from that month would match)
  "january", "february", "march", "april", "june", "july",
  "august", "september", "october", "november", "december",
  // Other generic terms
  "stock", "price", "market", "shares", "index",
]);

function tokenize(q: string) {
  return q.toLowerCase()
    .split(/\W+/)
    .filter((t) => t && t.length >= 3 && !TOKENIZE_SKIP.has(t))
    .slice(0, 12);
}

function matchesQuery(item: SourceItem, tokens: string[]) {
  if (tokens.length === 0) return true;
  const hay = `${item.title} ${item.snippet ?? ""}`.toLowerCase();
  // Whole-word matching: avoids "mart" matching "walmart", "smart", "marketplace"
  return tokens.some((t) => {
    const escaped = t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`\\b${escaped}\\b`).test(hay);
  });
}

function envList(name: string): string[] {
  const v = Deno.env.get(name);
  if (!v) return [];
  return v.split(/[\s,]+/g).map((s) => s.trim()).filter(Boolean);
}

/** Days between an article date and event date (lower = more relevant). */
function dateDiffDays(articleDate: string | null | undefined, eventDate: string | null): number {
  if (!articleDate || !eventDate) return 999;
  try {
    const diff = Math.abs(new Date(articleDate).getTime() - new Date(eventDate).getTime());
    return diff / 86_400_000;
  } catch { return 999; }
}

/** Trusted financial domains — scored higher to surface quality sources. */
const TRUSTED_DOMAINS = new Set([
  "reuters.com", "ft.com", "wsj.com", "bloomberg.com", "bloomberght.com",
  "cnbc.com", "marketwatch.com", "investing.com", "tr.investing.com",
  "coindesk.com", "cointelegraph.com", "seekingalpha.com",
  "thestreet.com", "barrons.com", "economist.com",
]);

/**
 * Score sources by: date proximity + provider quality + domain trust +
 * question relevance (title match = 2×, snippet match = 1×).
 */
function scoreItem(
  it: SourceItem,
  eventDate: string | null,
  questionTokens: string[] = [],
): number {
  let s = 1.0;

  // Date proximity — strongest signal; window ±7 days is good, ±14 is ok
  const diff = dateDiffDays(it.published_at, eventDate);
  if (diff <= 1)       s += 1.0;
  else if (diff <= 3)  s += 0.7;
  else if (diff <= 7)  s += 0.4;
  else if (diff <= 14) s += 0.1;
  // Articles far outside window get a penalty
  else if (diff > 30)  s -= 0.5;

  // Provider quality — structured/ticker-specific APIs score higher
  if (it.provider === "alphavantage" || it.provider === "finnhub") s += 0.4;
  if (it.provider === "yahoo_news") s += 0.35; // asset-specific, high relevance

  // Domain trust
  if (TRUSTED_DOMAINS.has(it.domain)) s += 0.3;

  // Content richness
  if (it.title)   s += 0.1;
  if (it.snippet) s += 0.05;

  // ── Question relevance ──────────────────────────────────────────────────
  // Whole-word matching: title matches count 2×, snippet 1×.
  // Normalized so a perfect match adds up to +1.0.
  if (questionTokens.length > 0) {
    const titleHay   = it.title.toLowerCase();
    const snippetHay = (it.snippet ?? "").toLowerCase();
    let hits = 0;
    for (const tok of questionTokens) {
      const re = new RegExp(`\\b${tok.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`);
      if (re.test(titleHay))        hits += 2;
      else if (re.test(snippetHay)) hits += 1;
    }
    s += (hits / (questionTokens.length * 2)) * 1.0;
  }

  return s;
}

function rankAndTrim(
  items: SourceItem[],
  limit: number,
  eventDate: string | null,
  questionTokens: string[] = [],
) {
  const deduped = uniqByUrl(items).filter((x) => x.domain);

  // Hard date cutoff: drop articles more than 21 days from the event, UNLESS
  // we'd end up with fewer than half the requested limit (keep freshness as fallback).
  const withinWindow = deduped.filter((x) => dateDiffDays(x.published_at, eventDate) <= 21);
  const pool = withinWindow.length >= Math.ceil(limit / 2) ? withinWindow : deduped;

  return pool
    .sort((a, b) => scoreItem(b, eventDate, questionTokens) - scoreItem(a, eventDate, questionTokens))
    .slice(0, limit);
}

// ─── Asset code → API ticker mapping ─────────────────────────────────────────

const CURRENCIES = new Set(["USD","EUR","GBP","JPY","TRY","CHF","AUD","CAD","NZD","CNY","RUB","KRW"]);

/**
 * Maps an asset_code to an Alpha Vantage ticker string.
 * Returns null if no direct mapping exists (e.g. indices like BIST100).
 */
function toAlphaVantageTicker(assetCode: string): string | null {
  const upper = (assetCode ?? "").toUpperCase().replace(/\s/g, "");

  // Crypto with slash: BTC/USD, ETH/USDT
  const cryptoSlash = upper.match(/^([A-Z]{2,10})\/(USD|USDT|EUR|BTC|ETH)$/);
  if (cryptoSlash) return `CRYPTO:${cryptoSlash[1]}`;

  // Crypto flat: BTCUSD, ETHUSD
  const cryptoFlat = upper.match(/^([A-Z]{2,8})(USDT?|EUR)$/);
  if (cryptoFlat && cryptoFlat[1].length >= 2) return `CRYPTO:${cryptoFlat[1]}`;

  // Forex with slash: USD/TRY
  const forexSlash = upper.match(/^([A-Z]{3})\/([A-Z]{3})$/);
  if (forexSlash && CURRENCIES.has(forexSlash[1])) return `FOREX:${forexSlash[1]}`;

  // Forex flat: USDTRY, EURUSD (exactly 6 known currency chars)
  if (upper.length === 6 && CURRENCIES.has(upper.slice(0, 3)) && CURRENCIES.has(upper.slice(3))) {
    return `FOREX:${upper.slice(0, 3)}`;
  }

  // Stock ticker (1–5 uppercase letters, no numbers)
  if (/^[A-Z]{1,5}$/.test(upper)) return upper;

  return null; // indices, etc.
}

/**
 * Maps an asset_code to a Finnhub company-news symbol.
 * Only plain US/global stock tickers work with this endpoint.
 */
function toFinnhubSymbol(assetCode: string): string | null {
  const upper = (assetCode ?? "").toUpperCase().replace(/[/\s]/g, "");
  return /^[A-Z]{1,5}$/.test(upper) ? upper : null;
}

// ─── Alpha Vantage NEWS_SENTIMENT ─────────────────────────────────────────────

function parseAVDate(s: string): string | null {
  const m = s.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})$/);
  if (!m) return null;
  return `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z`;
}

/**
 * Maps a ticker to Alpha Vantage topic tags for better free-tier coverage.
 * Crypto and forex don't always index well by ticker; topics cast a wider net.
 */
function toAVTopic(ticker: string | null): string | null {
  if (!ticker) return null;
  if (ticker.startsWith("CRYPTO:")) return "blockchain,cryptocurrency";
  if (ticker.startsWith("FOREX:"))  return "economy_forex,economy_macro";
  return null; // stocks: use ticker directly
}

function parseAVFeed(feed: unknown[]): SourceItem[] {
  const items: SourceItem[] = [];
  for (const raw of feed) {
    const a = raw as Record<string, unknown>;
    const url = String(a?.url ?? "").trim();
    if (!url) continue;
    items.push({
      url,
      title: safeStr(String(a?.title ?? ""), 240),
      domain: toDomain(url),
      published_at: a?.time_published ? parseAVDate(String(a.time_published)) : null,
      snippet: a?.summary ? safeStr(String(a.summary), 320) : null,
      provider: "alphavantage",
    });
  }
  return items;
}

/** Remove the actual API key from AV error messages before logging. */
function redactAVKey(msg: string, apiKey: string): string {
  if (!apiKey || !msg) return msg;
  return msg.replace(new RegExp(apiKey.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"), "***REDACTED***");
}

async function fetchAV(
  params: URLSearchParams,
  apiKey: string,
  timeout: number,
): Promise<{ items: SourceItem[]; error?: string }> {
  try {
    const resp = await fetch(`https://www.alphavantage.co/query?${params}`, {
      signal: AbortSignal.timeout(timeout),
    });
    const data = await resp.json() as Record<string, unknown>;

    // AV uses "Note" for rate limits, "Information" for premium-only notices
    const blocked = data?.Note ?? data?.Information ?? data?.["Error Message"];
    if (!resp.ok || blocked) {
      const rawMsg = String(blocked ?? `HTTP ${resp.status}`).slice(0, 300);
      return { items: [], error: redactAVKey(rawMsg, apiKey) };
    }

    const feed = (data?.feed as unknown[]) ?? [];
    return { items: parseAVFeed(feed) };
  } catch (e) {
    return { items: [], error: String(e) };
  }
}

async function getFromAlphaVantage(
  ticker: string | null,
  eventDate: string | null,
  limit: number,
  debug: boolean,
): Promise<{ items: SourceItem[]; debugRows: unknown[] }> {
  const apiKey = Deno.env.get("ALPHAVANTAGE_API_KEY");
  if (!apiKey) {
    return { items: [], debugRows: debug ? [{ provider: "alphavantage", skipped: "no ALPHAVANTAGE_API_KEY" }] : [] };
  }

  const topic = toAVTopic(ticker);
  const fetchLimit = String(Math.min(50, limit * 4));

  const baseParams = (withDate: boolean): URLSearchParams => {
    const p = new URLSearchParams({
      function: "NEWS_SENTIMENT",
      sort: "RELEVANCE",
      limit: fetchLimit,
      apikey: apiKey,
    });
    // For crypto/forex use topic tags; for stocks use ticker
    if (topic)  p.set("topics", topic);
    else if (ticker) p.set("tickers", ticker);

    if (withDate && eventDate) {
      const base = new Date(eventDate);
      const from = new Date(base); from.setDate(from.getDate() - 4);
      const to   = new Date(base); to.setDate(to.getDate() + 4);
      const fmt  = (d: Date) =>
        `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,"0")}${String(d.getDate()).padStart(2,"0")}T0000`;
      p.set("time_from", fmt(from));
      p.set("time_to", fmt(to));
    }
    return p;
  };

  // 1st attempt: with date range
  const dated = await fetchAV(baseParams(true), apiKey, 12_000);
  if (dated.error) {
    return { items: [], debugRows: debug ? [{ provider: "alphavantage", error: dated.error }] : [] };
  }

  // Fallback: free tier often has no historical data > ~3 days old → retry without date
  if (dated.items.length === 0 && eventDate) {
    const undated = await fetchAV(baseParams(false), apiKey, 12_000);
    const items = undated.items;
    return {
      items,
      debugRows: debug ? [{ provider: "alphavantage", count: items.length, note: "date_fallback" }] : [],
    };
  }

  return {
    items: dated.items,
    debugRows: debug ? [{ provider: "alphavantage", count: dated.items.length }] : [],
  };
}

// ─── Finnhub Company News ─────────────────────────────────────────────────────

async function getFromFinnhub(
  symbol: string,
  eventDate: string | null,
  limit: number,
  debug: boolean,
): Promise<{ items: SourceItem[]; debugRows: unknown[] }> {
  const apiKey = Deno.env.get("FINNHUB_API_KEY");
  if (!apiKey) {
    return { items: [], debugRows: debug ? [{ provider: "finnhub", skipped: "no FINNHUB_API_KEY" }] : [] };
  }

  const base = eventDate ? new Date(eventDate) : new Date();
  const from = new Date(base); from.setDate(from.getDate() - 3);
  const to   = new Date(base); to.setDate(to.getDate() + 3);
  const fmt  = (d: Date) => d.toISOString().split("T")[0];

  const url = `https://finnhub.io/api/v1/company-news?symbol=${encodeURIComponent(symbol)}&from=${fmt(from)}&to=${fmt(to)}&token=${apiKey}`;

  try {
    const resp = await fetch(url, { signal: AbortSignal.timeout(8_000) });
    const data = await resp.json();

    if (!resp.ok || !Array.isArray(data)) {
      return { items: [], debugRows: debug ? [{ provider: "finnhub", error: `HTTP ${resp.status}` }] : [] };
    }

    const items: SourceItem[] = (data as Record<string, unknown>[])
      .slice(0, limit * 3)
      .map((a) => ({
        url: String(a?.url ?? "").trim(),
        title: safeStr(String(a?.headline ?? ""), 240),
        domain: toDomain(String(a?.url ?? "")),
        published_at: a?.datetime ? new Date(Number(a.datetime) * 1000).toISOString() : null,
        snippet: a?.summary ? safeStr(String(a.summary), 320) : null,
        provider: "finnhub" as Provider,
      }))
      .filter((it) => it.url && it.domain);

    return { items, debugRows: debug ? [{ provider: "finnhub", count: items.length }] : [] };
  } catch (e) {
    return { items: [], debugRows: debug ? [{ provider: "finnhub", error: String(e) }] : [] };
  }
}

// ─── Google News RSS (free, no key, date-ranged via after:/before: operators) ─

/** Known ticker → human-readable name for better Google News matching. */
const TICKER_NAMES: Record<string, string> = {
  // Turkish stocks (BIST)
  THYAO: "Turkish Airlines THY",
  GARAN: "Garanti Bank Turkey",
  AKBNK: "Akbank Turkey",
  ISCTR: "Is Bankasi Turkey",
  EREGL: "Eregli steel Turkey",
  BIMAS: "BIM Turkey",
  TUPRS: "Tupras Turkey",
  KCHOL: "Koc Holding Turkey",
  SAHOL: "Sabanci Holding Turkey",
  SISE: "Sise Cam Turkey",
  TCELL: "Turkcell Turkey",
  ASELS: "Aselsan Turkey",
  FROTO: "Ford Otosan Turkey",
  TOASO: "Tofas Turkey",
  KOZAL: "Koza Gold Turkey",
  PETKM: "Petkim Turkey",
  // US mega-caps
  AAPL: "Apple",
  MSFT: "Microsoft",
  GOOGL: "Google Alphabet",
  AMZN: "Amazon",
  TSLA: "Tesla",
  NVDA: "Nvidia",
  META: "Meta Facebook",
  NFLX: "Netflix",
  JPM: "JPMorgan Chase",
  GS: "Goldman Sachs",
  INTC: "Intel",
  AMD: "AMD Advanced Micro Devices",
  DIS: "Disney",
  V: "Visa",
  MA: "Mastercard",
  KO: "Coca-Cola",
  XOM: "ExxonMobil",
  JNJ: "Johnson Johnson",
  // Asian stocks — keyed by Yahoo-format ticker
  "1810.HK": "Xiaomi",
  "0700.HK": "Tencent",
  "9988.HK": "Alibaba",
  "005930.KS": "Samsung",
  "7203.T": "Toyota",
  "6758.T": "Sony",
  "9984.T": "SoftBank",
  BABA: "Alibaba",
  BIDU: "Baidu",
  TSM: "Taiwan Semiconductor TSMC",
  // European stocks
  "MC.PA": "LVMH Louis Vuitton",
  "OR.PA": "L'Oreal",
  "VOW3.DE": "Volkswagen",
  "BMW.DE": "BMW",
  "MBG.DE": "Mercedes-Benz",
  "SAP.DE": "SAP",
  "SIE.DE": "Siemens",
  "HSBA.L": "HSBC",
  "SHEL.L": "Shell",
  "BP.L": "BP",
  "NESN.SW": "Nestle",
  "ROG.SW": "Roche",
  "NOVN.SW": "Novartis",
  ASML: "ASML",
  NVS: "Novartis",
  // Indices
  BIST100: "Turkish stock market BIST100 Borsa Istanbul",
  XU100: "Turkish stock market BIST100 Borsa Istanbul",
  SPX: "S&P 500 US stock market",
  NDX: "NASDAQ technology",
  DJI: "Dow Jones",
  DAX: "Germany DAX index",
};

/**
 * Builds keyword search terms from the asset code + question for Google News.
 * Always appends meaningful words from the question so the search is never
 * limited to just a ticker symbol that Google News might not recognise.
 */
function assetToSearchTerms(assetCode: string, query: string): string {
  const upper = (assetCode ?? "").toUpperCase().replace(/\s/g, "");
  const terms: string[] = [];

  const cryptoNames: Record<string, string> = {
    BTC: "bitcoin", ETH: "ethereum", SOL: "solana", XRP: "ripple",
    BNB: "binance", ADA: "cardano", DOGE: "dogecoin", AVAX: "avalanche",
    LINK: "chainlink", DOT: "polkadot", MATIC: "polygon", LTC: "litecoin",
  };

  // Crypto with slash: BTC/USD
  const coinMatch = upper.match(/^([A-Z]{2,10})\/(USD|USDT|EUR|BTC|ETH)$/)?.[1]
    ?? upper.match(/^([A-Z]{2,8})(USDT?|EUR)$/)?.[1];
  if (coinMatch) {
    if (cryptoNames[coinMatch]) terms.push(cryptoNames[coinMatch]);
    terms.push(coinMatch);
  } else if (upper.length === 6 && CURRENCIES.has(upper.slice(0, 3)) && CURRENCIES.has(upper.slice(3))) {
    // Forex flat: USDTRY
    terms.push(upper.slice(0, 3), upper.slice(3), "forex exchange rate");
  } else if (upper.match(/^([A-Z]{3})\/([A-Z]{3})$/)) {
    // Forex with slash: USD/TRY
    const [base, quote] = upper.split("/");
    terms.push(base, quote, "forex exchange rate");
  } else if (TICKER_NAMES[upper]) {
    // Plain uppercase ticker with a known name (AAPL, THYAO, etc.)
    terms.push(TICKER_NAMES[upper], upper);
  } else if (TICKER_NAMES[assetCode]) {
    // Exchange-suffixed ticker stored with original case (1810.HK, 005930.KS, MC.PA)
    terms.push(TICKER_NAMES[assetCode], assetCode);
  } else if (/^[A-Z]{1,6}$/.test(upper)) {
    // Unknown plain ticker — rely heavily on question words
    terms.push(upper);
  } else {
    // Fallback (indices, coded tickers) — just use it and let question words carry
    terms.push(upper);
  }

  // Include meaningful words from the question — ENGLISH ONLY.
  // Non-ASCII words (Turkish: "yükseldi", "düştü") or Turkish stop words ("neden",
  // "mart") would break English Google News searches if included.
  const stopWords = new Set([
    // English
    "what", "when", "where", "which", "that", "this", "with", "from",
    "have", "will", "been", "were", "they", "them", "their", "would",
    "could", "should", "does", "about", "because", "during", "early",
    "stock", "price", "market", "share", "rise", "fell", "fall", "drop",
    "surge", "jump", "move", "went", "does", "make", "much", "many",
    // Turkish (ASCII ones that would pollute English search)
    "neden", "nasil", "hangi", "hisse", "fiyat", "piyasa", "borsa",
    "ocak", "mart", "nisan", "mayis", "eylul", "ekim", "kasim",
    "olan", "daha", "veya", "bile", "icin", "gibi", "kadar", "yani",
    "bunu", "buna", "beni", "seni", "onun", "bize", "size", "onlar",
  ]);
  const qWords = query.toLowerCase()
    .split(/\W+/)
    // Only pure ASCII letters — filters out Turkish special-char words like "yükseldi"
    .filter((t) => /^[a-z]+$/.test(t) && t.length >= 4 && !stopWords.has(t))
    .slice(0, 5);
  terms.push(...qWords);

  // If we have no useful asset terms at all (e.g. index with no mapping),
  // fall back to the raw question as the search string
  const result = [...new Set(terms)].join(" ");
  return result.trim() || query.slice(0, 120);
}

/** Turkish BIST tickers — need Turkish-language Google News search too. */
const TURKISH_TICKERS = new Set([
  "THYAO","GARAN","AKBNK","ISCTR","EREGL","BIMAS","TUPRS",
  "KCHOL","SAHOL","SISE","TCELL","ASELS","FROTO","TOASO","KOZAL","PETKM",
]);

/** Turkish search terms for known BIST tickers. */
const TURKISH_SEARCH_TERMS: Record<string, string> = {
  THYAO: "THYAO Türk Hava Yolları hisse",
  GARAN: "GARAN Garanti Bankası hisse",
  AKBNK: "AKBNK Akbank hisse",
  ISCTR: "ISCTR İş Bankası hisse",
  EREGL: "EREGL Ereğli Demir Çelik hisse",
  BIMAS: "BIMAS BİM hisse",
  TUPRS: "TUPRS Tüpraş hisse",
  KCHOL: "KCHOL Koç Holding hisse",
  SAHOL: "SAHOL Sabancı Holding hisse",
  SISE: "SISE Şişe Cam hisse",
  TCELL: "TCELL Turkcell hisse",
  ASELS: "ASELS Aselsan hisse",
  FROTO: "FROTO Ford Otosan hisse",
  TOASO: "TOASO Tofaş hisse",
};

// ─── Yahoo Finance News ───────────────────────────────────────────────────────

/**
 * Convert internal asset code → Yahoo Finance search query.
 * BIST stocks need the .IS suffix; crypto needs the -USD format.
 */
function toYahooQuery(assetCode: string): string {
  const upper = (assetCode ?? "").toUpperCase().replace(/\s/g, "");
  // Crypto with slash: BTC/USD → BTC-USD
  const cryptoMatch = upper.match(/^([A-Z]{2,10})\/(USD|USDT|EUR|BTC|ETH)$/);
  if (cryptoMatch) return `${cryptoMatch[1]}-${cryptoMatch[2]}`;
  // BIST stocks
  if (TURKISH_TICKERS.has(upper)) return `${upper}.IS`;
  // Plain ticker (US, global)
  return upper;
}

async function getFromYahooNews(
  assetCode: string | null,
  eventDate: string | null,
  limit: number,
  debug: boolean,
): Promise<{ items: SourceItem[]; debugRows: unknown[] }> {
  if (!assetCode) return { items: [], debugRows: [] };

  const query = toYahooQuery(assetCode);
  const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&newsCount=10&quotesCount=0&enableNavLinks=false&enableFuzzyQuery=false`;

  try {
    const resp = await fetch(url, {
      signal: AbortSignal.timeout(6_000),
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; FinOracle/1.0)",
        "Accept": "application/json",
      },
    });

    if (!resp.ok) {
      return { items: [], debugRows: debug ? [{ provider: "yahoo_news", error: `HTTP ${resp.status}`, query }] : [] };
    }

    const data = await resp.json() as Record<string, unknown>;
    const newsArr = (data?.news ?? []) as Record<string, unknown>[];

    const items: SourceItem[] = newsArr
      .filter((n) => n?.link && n?.title)
      .map((n): SourceItem => {
        const link = String(n.link ?? "").trim();
        const ts = n?.providerPublishTime;
        const published_at = ts ? new Date(Number(ts) * 1000).toISOString() : null;
        return {
          url: link,
          title: safeStr(String(n.title ?? ""), 240),
          domain: toDomain(link),
          published_at,
          snippet: n?.summary ? safeStr(String(n.summary), 320) : null,
          provider: "yahoo_news",
        };
      })
      .slice(0, limit);

    return {
      items,
      debugRows: debug ? [{ provider: "yahoo_news", count: items.length, query }] : [],
    };
  } catch (e) {
    return {
      items: [],
      debugRows: debug ? [{ provider: "yahoo_news", error: String(e).slice(0, 120), query }] : [],
    };
  }
}

function parseGoogleNewsRss(xml: string): SourceItem[] {
  return parseRss(xml)
    .filter((it) => it.domain)
    .map((it) => {
      // Google News titles end with " - PublisherName"; extract real domain
      const pubMatch = it.title.match(/\s[-–]\s([^-–]+)$/);
      if (pubMatch) {
        const pub = pubMatch[1].trim().toLowerCase().replace(/\s+/g, "");
        it.domain = pub.includes(".") ? pub : `${pub}.com`;
        it.title = it.title.replace(/\s[-–]\s[^-–]+$/, "").trim();
      }
      return it;
    });
}

function buildDateSuffix(eventDate: string, windowDays = 5): string {
  const base = new Date(eventDate);
  const from = new Date(base); from.setDate(from.getDate() - windowDays);
  const to   = new Date(base); to.setDate(to.getDate() + windowDays);
  const fmt  = (d: Date) => d.toISOString().split("T")[0]; // YYYY-MM-DD — confirmed working with Google News RSS
  return `+after:${fmt(from)}+before:${fmt(to)}`;
}

async function fetchGoogleNewsRss(
  terms: string,
  dateSuffix: string,
  locale: string, // e.g. "en-US&gl=US&ceid=US:en" or "tr-TR&gl=TR&ceid=TR:tr"
  timeout = 9_000,
): Promise<SourceItem[]> {
  // encodeURIComponent encodes the search terms, then the date suffix (+after:YYYY-MM-DD) is
  // appended as-is — the leading "+" acts as a space separator in Google's query parser.
  const q = encodeURIComponent(terms) + dateSuffix;
  const url = `https://news.google.com/rss/search?q=${q}&hl=${locale}`;

  try {
    const resp = await fetch(url, {
      signal: AbortSignal.timeout(timeout),
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "application/rss+xml, application/xml, text/xml, */*",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });
    if (!resp.ok) return [];
    const xml = await resp.text();
    // Google sometimes returns HTML (rate-limit page) instead of XML
    if (!xml.trim().startsWith("<")) return [];
    return parseGoogleNewsRss(xml);
  } catch { return []; }
}

async function getFromGoogleNews(
  assetCode: string | null,
  query: string,
  eventDate: string | null,
  limit: number,
  debug: boolean,
): Promise<{ items: SourceItem[]; debugRows: unknown[] }> {
  const upper = (assetCode ?? "").toUpperCase().replace(/\s/g, "");
  const searchTerms = assetCode ? assetToSearchTerms(assetCode, query) : query;
  const dateSuffix = eventDate ? buildDateSuffix(eventDate) : "";
  const isTurkish = TURKISH_TICKERS.has(upper);

  // Build parallel fetch list: English always, Turkish additionally for BIST stocks
  const fetches: Promise<SourceItem[]>[] = [
    fetchGoogleNewsRss(searchTerms, dateSuffix, "en-US&gl=US&ceid=US:en"),
  ];

  if (isTurkish) {
    const trTerms = TURKISH_SEARCH_TERMS[upper] ?? `${upper} hisse`;
    fetches.push(fetchGoogleNewsRss(trTerms, dateSuffix, "tr-TR&gl=TR&ceid=TR:tr"));
  }

  const results = await Promise.all(fetches);
  const combined = results.flat().slice(0, limit * 4);

  return {
    items: combined,
    debugRows: debug ? [{
      provider: "google_news",
      count: combined.length,
      terms: searchTerms,
      turkish_search: isTurkish,
    }] : [],
  };
}

// ─── RSS ──────────────────────────────────────────────────────────────────────

function getDefaultRssFeeds() {
  return [
    // ── Global financial ─────────────────────────────────────────────────
    "https://www.cnbc.com/id/10000664/device/rss/rss.html",       // CNBC Markets
    "https://www.cnbc.com/id/10001147/device/rss/rss.html",       // CNBC Top News
    "https://feeds.marketwatch.com/marketwatch/topstories/",
    "https://seekingalpha.com/market_currents.xml",
    "https://www.benzinga.com/feed",
    // ── Crypto ───────────────────────────────────────────────────────────
    "https://www.coindesk.com/arc/outboundfeeds/rss/?outputType=xml",
    "https://cointelegraph.com/rss",
    "https://decrypt.co/feed",
    // ── Asia-Pacific (for HK, KR, JP stocks) ─────────────────────────────
    "https://www.scmp.com/rss/2/feed",                            // South China Morning Post — Business
    "https://asia.nikkei.com/rss/feed/nar",                       // Nikkei Asia
    "https://www.thestreet.com/.rss/full",                        // TheStreet (tech/global)
    // ── Turkish financial news ───────────────────────────────────────────
    "https://www.bloomberght.com/rss",
    "https://tr.investing.com/rss/news_1.rss",
    "https://tr.investing.com/rss/news_25.rss",
    // ── Broad international ──────────────────────────────────────────────
    "https://www.investing.com/rss/news_1.rss",
    "https://www.investing.com/rss/news_25.rss",
  ];
}

function xmlText(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string" || typeof v === "number") return String(v);
  if (Array.isArray(v)) return v.map(xmlText).join(" ").trim();
  if (typeof v === "object") {
    const obj = v as Record<string, unknown>;
    if (typeof obj["#text"] === "string") return obj["#text"];
    if (typeof obj["__cdata"] === "string") return obj["__cdata"];
    return Object.values(obj).map(xmlText).join(" ").trim();
  }
  return "";
}

function parseRss(xml: string): SourceItem[] {
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_", cdataPropName: "__cdata" });
  let data: unknown;
  try { data = parser.parse(xml); } catch { return []; }

  const out: SourceItem[] = [];
  const d = data as Record<string, any>;

  const rssItems = d?.rss?.channel?.item;
  if (Array.isArray(rssItems)) {
    for (const it of rssItems) {
      const url = xmlText(it?.link).trim();
      if (!url) continue;
      const desc = xmlText(it?.description ?? it?.["content:encoded"])
        .replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
      out.push({
        url,
        title: safeStr(xmlText(it?.title).trim(), 240),
        domain: toDomain(url),
        published_at: xmlText(it?.pubDate).trim() || null,
        snippet: desc ? safeStr(desc, 320) : null,
        provider: "rss",
      });
    }
  }

  const entries = d?.feed?.entry;
  if (Array.isArray(entries)) {
    for (const e of entries) {
      let url = "";
      if (typeof e?.link === "string") url = e.link;
      else if (Array.isArray(e?.link)) url = String(e.link?.[0]?.["@_href"] ?? e.link?.[0] ?? "");
      else url = String(e?.link?.["@_href"] ?? "");
      url = url.trim();
      if (!url) continue;
      const rawSum = xmlText(e?.summary).trim().replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
      out.push({
        url,
        title: safeStr(xmlText(e?.title).trim(), 240),
        domain: toDomain(url),
        published_at: xmlText(e?.updated ?? e?.published).trim() || null,
        snippet: rawSum ? safeStr(rawSum, 320) : null,
        provider: "rss",
      });
    }
  }

  return out;
}

async function getFromRSS(
  tokens: string[],
  limit: number,
  noFilter: boolean,
  debug: boolean,
): Promise<{ items: SourceItem[]; debugRows: unknown[]; feedsCount: number }> {
  const userAgent = Deno.env.get("RETRIEVE_USER_AGENT") ??
    "Mozilla/5.0 (compatible; FinOracle/1.0; +https://example.invalid)";

  const fromEnv = [...envList("RSS_CORE_FEEDS"), ...envList("RSS_REGIONAL_FEEDS")];
  const feeds = fromEnv.length ? fromEnv : getDefaultRssFeeds();
  const perFeed = Math.max(2, Math.floor(limit / Math.max(1, feeds.length)) + 2);

  const results: SourceItem[] = [];
  const debugRows: unknown[] = [];

  for (const feedUrl of feeds) {
    try {
      const resp = await fetch(feedUrl, {
        signal: AbortSignal.timeout(6_000),
        headers: { "User-Agent": userAgent, "Accept": "application/rss+xml, application/xml, text/xml, */*" },
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const xml = await resp.text();
      const parsedAll = parseRss(xml).filter((it) => it.domain);
      const kept = (noFilter ? parsedAll : parsedAll.filter((it) => matchesQuery(it, tokens))).slice(0, perFeed);
      results.push(...kept);
      if (debug) debugRows.push({ feed: feedUrl, ok: true, total: parsedAll.length, kept: kept.length });
      if (results.length >= limit * 3) break;
    } catch (e) {
      if (debug) debugRows.push({ feed: feedUrl, ok: false, error: String(e).slice(0, 120) });
    }
  }

  return { items: results, debugRows, feedsCount: feeds.length };
}

// ─── NewsData.io ──────────────────────────────────────────────────────────────

/**
 * NewsData.io free tier: 200 credits/day, 10 articles per request.
 * Supports date range, language filter (en + tr), and category filter.
 * Endpoint: https://newsdata.io/api/1/news
 */
async function getFromNewsData(
  assetCode: string | null,
  query: string,
  eventDate: string | null,
  limit: number,
  debug: boolean,
): Promise<{ items: SourceItem[]; debugRows: unknown[] }> {
  const apiKey = Deno.env.get("NEWSDATA_API_KEY");
  if (!apiKey) {
    return { items: [], debugRows: debug ? [{ provider: "newsdata", skipped: "no NEWSDATA_API_KEY" }] : [] };
  }

  // Trim query to first 3 meaningful words to avoid overly restrictive searches
  const searchQ = query.trim().split(/\s+/).slice(0, 5).join(" ").slice(0, 200);

  // Detect if Turkish asset for language targeting
  const isTurkish = assetCode
    ? new Set(["THYAO","GARAN","AKBNK","ISCTR","EREGL","BIMAS","TUPRS",
               "KCHOL","SAHOL","SISE","TCELL","ASELS","FROTO","TOASO",
               "KOZAL","PETKM","USD/TRY","EUR/TRY"]).has(assetCode.toUpperCase())
    : false;

  // Free plan: use /api/1/news (latest news), no date filter (archive requires paid plan).
  // We rely on rankAndTrim to filter by date proximity later.
  const params = new URLSearchParams({
    apikey:   apiKey,
    q:        searchQ,
    language: isTurkish ? "tr,en" : "en",
    size:     String(Math.min(limit, 10)), // free plan max is 10
  });

  const url = `https://newsdata.io/api/1/news?${params}`;

  try {
    // 4s timeout — if unreachable, the outer race will also resolve to empty
    const resp = await fetch(url, { signal: AbortSignal.timeout(4_000) });
    const rawText = await resp.text().catch(() => "");

    if (!resp.ok) {
      console.error("[newsdata] HTTP error:", resp.status, rawText.slice(0, 200));
      return {
        items: [],
        debugRows: debug ? [{ provider: "newsdata", error: `HTTP ${resp.status}: ${rawText.slice(0, 150)}` }] : [],
      };
    }

    let data: Record<string, unknown>;
    try { data = JSON.parse(rawText); } catch {
      console.error("[newsdata] JSON parse error:", rawText.slice(0, 200));
      return { items: [], debugRows: debug ? [{ provider: "newsdata", error: "json_parse_failed" }] : [] };
    }

    if (data?.status !== "success") {
      const msg = String((data?.results as any)?.message ?? data?.message ?? data?.status ?? "non-success");
      console.error("[newsdata] API error:", msg);
      return {
        items: [],
        debugRows: debug ? [{ provider: "newsdata", error: msg.slice(0, 150) }] : [],
      };
    }

    const results = (data?.results ?? []) as Record<string, unknown>[];
    const items: SourceItem[] = results
      .filter((r) => r?.link && r?.title)
      .map((r): SourceItem => ({
        url:          String(r.link ?? "").trim(),
        title:        safeStr(String(r.title ?? ""), 240),
        domain:       toDomain(String(r.link ?? "")),
        // NewsData pubDate format: "2026-03-20 14:30:00"
        published_at: r.pubDate ? String(r.pubDate).replace(" ", "T") + "Z" : null,
        snippet:      r.description ? safeStr(String(r.description), 320) : null,
        provider:     "newsdata",
      }))
      .slice(0, limit);

    return {
      items,
      debugRows: debug ? [{
        provider: "newsdata",
        count: items.length,
        total_results: results.length,
        query: searchQ,
        language: isTurkish ? "tr,en" : "en",
      }] : [],
    };
  } catch (e) {
    console.error("[newsdata] fetch error:", String(e));
    return {
      items: [],
      debugRows: debug ? [{ provider: "newsdata", error: String(e).slice(0, 120) }] : [],
    };
  }
}

// ─── Entry point ──────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") return json(405, { ok: false, error: "Method Not Allowed" });

    const body = (await req.json().catch(() => null)) as RetrieveInput | null;
    if (!body || !body.query) return json(400, { ok: false, error: "query is required" });

    const limit     = Math.max(1, Math.min(20, Number(body.limit ?? 10)));
    const debug     = !!body.debug;
    const noFilter  = !!body.no_filter;
    const tokens    = tokenize(body.query);
    const assetCode = body.asset_code ?? body.event?.asset_code ?? null;
    const eventDate = body.event?.event_date ?? null;

    // Ticker mappings
    const avTicker     = assetCode ? toAlphaVantageTicker(assetCode) : null;
    const finnhubSym   = assetCode ? toFinnhubSymbol(assetCode) : null;

    // Source allocation:
    //  - Google News (date-filtered, best for known events):  10
    //  - NewsData.io (date-filtered, bilingual TR+EN):        10
    //  - Yahoo Finance News (ticker-specific, current):       10
    //  - Alpha Vantage / Finnhub (when API keys present):     up to 10 each
    //  - RSS (safety net):                                     5
    const GN_LIMIT  = 10;
    const ND_LIMIT  = 10;
    const YH_LIMIT  = 10;
    const RSS_LIMIT = 5;

    // Build NewsData query
    const ndQuery = body.query.trim();

    // Wrap NewsData in a 4s race — it frequently times out from Supabase infra.
    // Other providers run without a hard cap so they don't block each other.
    const emptyNd = { items: [] as SourceItem[], debugRows: debug ? [{ provider: "newsdata", skipped: "race_timeout" }] : [] };
    const ndPromise = Promise.race([
      getFromNewsData(assetCode, ndQuery, eventDate, ND_LIMIT, debug),
      new Promise<typeof emptyNd>((resolve) => setTimeout(() => resolve(emptyNd), 4_000)),
    ]);

    // Run all providers in parallel
    const [avOut, fhOut, ndOut, yhOut, gnOut, rssOut] = await Promise.all([
      getFromAlphaVantage(avTicker, eventDate, limit, debug),
      finnhubSym
        ? getFromFinnhub(finnhubSym, eventDate, limit, debug)
        : Promise.resolve({ items: [] as SourceItem[], debugRows: [] }),
      ndPromise,
      getFromYahooNews(assetCode, eventDate, YH_LIMIT, debug),
      getFromGoogleNews(assetCode, body.query, eventDate, GN_LIMIT, debug),
      getFromRSS(tokens, RSS_LIMIT, noFilter, debug),
    ]);

    const allItems = [
      ...avOut.items, ...fhOut.items,
      ...ndOut.items, ...yhOut.items,
      ...gnOut.items, ...rssOut.items,
    ];
    let finalItems = rankAndTrim(allItems, limit, eventDate, tokens);

    // Fallback: if too few results, retry RSS without filter
    if (finalItems.length < Math.ceil(limit / 2) && !noFilter) {
      const fallback = await getFromRSS(tokens, limit + 6, true, false);
      finalItems = rankAndTrim([...allItems, ...fallback.items], limit, eventDate, tokens);
    }

    return json(200, {
      ok: true,
      counts: {
        alphavantage: avOut.items.length,
        finnhub:      fhOut.items.length,
        newsdata:     ndOut.items.length,
        yahoo_news:   yhOut.items.length,
        google_news:  gnOut.items.length,
        rss:          rssOut.items.length,
        final:        finalItems.length,
      },
      items: finalItems,
      debug: debug ? {
        ticker_av:      avTicker,
        symbol_finnhub: finnhubSym,
        yahoo_query:    assetCode ? toYahooQuery(assetCode) : null,
        event_date:     eventDate,
        rows: [
          ...avOut.debugRows, ...fhOut.debugRows,
          ...ndOut.debugRows, ...yhOut.debugRows,
          ...gnOut.debugRows, ...rssOut.debugRows,
        ],
      } : undefined,
    });
  } catch (err) {
    return json(500, { ok: false, error: "internal_error", details: String(err) });
  }
});
