import { XMLParser } from "https://esm.sh/fast-xml-parser@4";

// ─── Types ────────────────────────────────────────────────────────────────────

type Provider = "rss" | "finnhub" | "alphavantage";

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

function tokenize(q: string) {
  return q.toLowerCase().split(/\W+/).filter((t) => t && t.length >= 3).slice(0, 12);
}

function matchesQuery(item: SourceItem, tokens: string[]) {
  if (tokens.length === 0) return true;
  const hay = `${item.title} ${item.snippet ?? ""}`.toLowerCase();
  return tokens.some((t) => hay.includes(t));
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

/** Score higher for date proximity, provider quality, and content richness. */
function scoreItem(it: SourceItem, eventDate: string | null): number {
  let s = 1.0;
  const diff = dateDiffDays(it.published_at, eventDate);
  if (diff <= 1) s += 0.6;
  else if (diff <= 3) s += 0.4;
  else if (diff <= 7) s += 0.2;
  if (it.provider === "alphavantage" || it.provider === "finnhub") s += 0.3;
  if (it.title) s += 0.1;
  if (it.snippet) s += 0.05;
  return s;
}

function rankAndTrim(items: SourceItem[], limit: number, eventDate: string | null) {
  return uniqByUrl(items)
    .filter((x) => x.domain)
    .sort((a, b) => scoreItem(b, eventDate) - scoreItem(a, eventDate))
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

/**
 * Builds a keyword summary from the asset code for Google News queries.
 * e.g. "BTC/USD" → "bitcoin BTC", "USDTRY" → "USD TRY forex"
 */
function assetToSearchTerms(assetCode: string, query: string): string {
  const upper = (assetCode ?? "").toUpperCase().replace(/\s/g, "");
  const terms: string[] = [];

  const cryptoNames: Record<string, string> = {
    BTC: "bitcoin", ETH: "ethereum", SOL: "solana", XRP: "ripple",
    BNB: "binance", ADA: "cardano", DOGE: "dogecoin", AVAX: "avalanche",
  };

  const coinMatch = upper.match(/^([A-Z]{2,10})\/(USD|USDT|EUR|BTC|ETH)$/)?.[1]
    ?? upper.match(/^([A-Z]{2,8})(USDT?|EUR)$/)?.[1];
  if (coinMatch) {
    if (cryptoNames[coinMatch]) terms.push(cryptoNames[coinMatch]);
    terms.push(coinMatch);
  } else if (upper.length === 6 && CURRENCIES.has(upper.slice(0, 3))) {
    terms.push(upper.slice(0, 3), upper.slice(3), "forex");
  } else {
    terms.push(upper);
  }

  // Add the first few meaningful words from the question
  const qWords = query.toLowerCase().split(/\W+/).filter((t) => t.length >= 4).slice(0, 3);
  terms.push(...qWords);

  return [...new Set(terms)].join(" ");
}

async function getFromGoogleNews(
  assetCode: string | null,
  query: string,
  eventDate: string | null,
  limit: number,
  debug: boolean,
): Promise<{ items: SourceItem[]; debugRows: unknown[] }> {
  const searchTerms = assetCode ? assetToSearchTerms(assetCode, query) : query;

  let q = encodeURIComponent(searchTerms);

  // Add date range if event date is available
  if (eventDate) {
    const base = new Date(eventDate);
    const from = new Date(base); from.setDate(from.getDate() - 4);
    const to   = new Date(base); to.setDate(to.getDate() + 4);
    const fmt  = (d: Date) => d.toISOString().split("T")[0]; // YYYY-MM-DD
    q += `+after:${fmt(from)}+before:${fmt(to)}`;
  }

  const url = `https://news.google.com/rss/search?q=${q}&hl=en-US&gl=US&ceid=US:en`;

  try {
    const resp = await fetch(url, {
      signal: AbortSignal.timeout(8_000),
      headers: { "User-Agent": "Mozilla/5.0 (compatible; FinOracle/1.0)" },
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const xml = await resp.text();
    // Google News RSS URLs are redirect links (news.google.com/rss/articles/...).
    // Extract the real publisher from the title suffix " - PublisherName".
    const parsed = parseRss(xml)
      .filter((it) => it.domain)
      .map((it) => {
        const pubMatch = it.title.match(/\s[-–]\s([^-–]+)$/);
        if (pubMatch) {
          const pub = pubMatch[1].trim().toLowerCase().replace(/\s+/g, "");
          it.domain = pub.includes(".") ? pub : `${pub}.com`;
          it.title = it.title.replace(/\s[-–]\s[^-–]+$/, "").trim();
        }
        return it;
      });

    return {
      items: parsed.slice(0, limit * 3),
      debugRows: debug ? [{ provider: "google_news", count: parsed.length, terms: searchTerms }] : [],
    };
  } catch (e) {
    return { items: [], debugRows: debug ? [{ provider: "google_news", error: String(e) }] : [] };
  }
}

// ─── RSS ──────────────────────────────────────────────────────────────────────

function getDefaultRssFeeds() {
  return [
    "http://feeds.marketwatch.com/marketwatch/topstories/",
    "https://www.cnbc.com/id/10001147/device/rss/rss.html",
    "https://www.coindesk.com/arc/outboundfeeds/rss/?outputType=xml",
    "https://www.investing.com/rss/news_1.rss",
    "https://feeds.feedburner.com/zerohedge/feed",
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

    // Run all providers in parallel
    const [avOut, fhOut, gnOut, rssOut] = await Promise.all([
      getFromAlphaVantage(avTicker, eventDate, limit, debug),
      finnhubSym
        ? getFromFinnhub(finnhubSym, eventDate, limit, debug)
        : Promise.resolve({ items: [] as SourceItem[], debugRows: [] }),
      getFromGoogleNews(assetCode, body.query, eventDate, limit, debug),
      getFromRSS(tokens, limit, noFilter, debug),
    ]);

    const allItems = [...avOut.items, ...fhOut.items, ...gnOut.items, ...rssOut.items];
    let finalItems = rankAndTrim(allItems, limit, eventDate);

    // Fallback: if structured APIs returned nothing and RSS matched too few, retry without filter
    if (finalItems.length < Math.ceil(limit / 2) && !noFilter) {
      const fallback = await getFromRSS(tokens, limit + 6, true, false);
      finalItems = rankAndTrim([...allItems, ...fallback.items], limit, eventDate);
    }

    return json(200, {
      ok: true,
      counts: {
        alphavantage: avOut.items.length,
        finnhub: fhOut.items.length,
        google_news: gnOut.items.length,
        rss: rssOut.items.length,
        final: finalItems.length,
      },
      items: finalItems,
      debug: debug ? {
        ticker_av: avTicker,
        symbol_finnhub: finnhubSym,
        event_date: eventDate,
        rows: [...avOut.debugRows, ...fhOut.debugRows, ...gnOut.debugRows, ...rssOut.debugRows],
      } : undefined,
    });
  } catch (err) {
    return json(500, { ok: false, error: "internal_error", details: String(err) });
  }
});
