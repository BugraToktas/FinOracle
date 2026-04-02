# FinOracle

AI-powered financial market event analysis platform. Submit a market event and FinOracle automatically retrieves date-filtered news from multiple sources, generates an LLM analysis, and periodically re-verifies its conclusions.

---

## Architecture

```
Frontend (React + Vite + Tailwind v4)
        │
        ▼
Supabase Edge Functions (Deno)
        │
        ├── ask_finoracle          ← main pipeline
        │       ├── 1. Infer asset code (3-tier)
        │       ├── 2. retrieve_sources (parallel)
        │       │       ├── Google News RSS  (date-filtered, 10 articles)
        │       │       ├── Yahoo Finance News (ticker-specific, 10 articles)
        │       │       ├── Alpha Vantage NEWS_SENTIMENT (optional)
        │       │       ├── Finnhub company-news (optional)
        │       │       └── RSS feeds (safety net, 5 articles)
        │       ├── 3. llm_proxy → Gemini (analysis)
        │       └── 4. Save to DB (market_events, analysis_results, source_documents)
        │
        ├── verify_analysis        ← re-checks a single analysis, updates reputation
        ├── run_verification_queue ← batch re-check (pg_cron: 06:00 & 18:00 UTC)
        └── llm_proxy              ← Gemini wrapper (ask / recheck / extract_asset)
```

---

## Database Tables

| Table | Purpose |
|---|---|
| `market_events` | Asset + date + direction + magnitude |
| `analysis_results` | LLM summary, confidence score, status, verify_after |
| `source_documents` | Deduplicated news articles (url, domain, snippet, embedding) |
| `analysis_document_links` | Many-to-many: analysis ↔ source documents |
| `news_sources` | Publisher reputation scores (Laplace-smoothed) |
| `analysis_source_links` | LLM-cited sources linked to an analysis |
| `revalidations` | Re-check history with verdict (correct / partial / wrong) |

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite 8, Tailwind CSS v4, react-router-dom v7, recharts |
| Backend | Supabase Edge Functions (Deno runtime) |
| Database | Supabase PostgreSQL 15 (pgvector enabled) |
| LLM | Google Gemini 2.5 Flash via Generative Language API |
| News | Google News RSS, Yahoo Finance News API, Alpha Vantage, Finnhub, RSS |

---

## Asset Code Inference (3-Tier)

When `asset_code` is not provided, FinOracle infers it automatically:

| Tier | Method | Coverage |
|---|---|---|
| 1 | Regex pattern matching | ~90% — crypto, major US/TR/EU stocks, forex |
| 2 | Yahoo Finance symbol search API | Any globally listed ticker |
| 3 | Gemini LLM extraction | Free-form descriptions in any language |

The response includes `inferred_asset_code` and `infer_method` when inference is used.

**Example — no `asset_code` needed:**
```json
{
  "event_date": "2026-03-20",
  "direction": "up",
  "question": "Bitcoin neden 20 Mart 2026'da yükseldi?"
}
```
→ `"inferred_asset_code": "BTC/USD"`, `"infer_method": "pattern"`

---

## News Source Pipeline

Sources are retrieved from 5 providers in parallel, then ranked and trimmed to the top 20:

| Provider | Articles | Strength |
|---|---|---|
| **Google News RSS** | 10 | Date-filtered (`after:/before:`), best for English-covered assets |
| **Yahoo Finance News** | 10 | Ticker-specific, works for global stocks (HK, KR, JP, EU) |
| **Alpha Vantage** | up to 10 | Date-range filtered, 25 req/day free tier |
| **Finnhub** | up to 10 | US/global stocks, date-range filtered |
| **RSS feeds** | 5 | Safety net (CNBC, MarketWatch, CoinDesk, SCMP, Nikkei, BloombergHT, etc.) |

**Scoring factors** (higher = ranked first):
- Date proximity to event (≤1 day: +1.0, ≤3 days: +0.7, >21 days: excluded)
- Ticker-specific provider (Alpha Vantage, Finnhub, Yahoo: +0.35–0.4)
- Trusted domain (Reuters, Bloomberg, CoinDesk, etc.: +0.3)
- Whole-word question token match in title (+2×) or snippet (+1×)

**Known limitation:** Asian stocks (HK, KR, JP) listed outside major English-language news networks may return low-confidence results due to limited English coverage in free sources.

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 20+
- [Supabase CLI](https://supabase.com/docs/guides/cli)
- A Supabase project ([supabase.com](https://supabase.com))
- A Google Gemini API key ([aistudio.google.com/apikey](https://aistudio.google.com/apikey))

### 1. Clone & install

```bash
git clone https://github.com/your-username/finoracle.git
cd finoracle
npm install
```

### 2. Configure frontend environment

Create `.env.local` in the project root:

```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

Both values are in **Supabase Dashboard → Settings → API**.

### 3. Run database migrations

In **Supabase Dashboard → SQL Editor**, run each file in `supabase/migrations/` in order:

1. `20260316_add_unique_constraints.sql`
2. `20260316_drop_redundant_columns.sql`
3. `20260316_drop_dead_columns.sql`
4. `20260316_atomic_reputation_update.sql`
5. `20260327_rls_public_read.sql`
6. `20260327_pgvector_embeddings.sql`
7. `20260327_pg_cron_verification.sql` *(enable pg_cron extension first: Dashboard → Database → Extensions)*
8. `pg_cron_credentials.local.sql` — **gitignored**, fill in your own `service_role_key` and run manually

### 4. Set Edge Function secrets

**Supabase Dashboard → Settings → Edge Function Secrets:**

| Secret | Required | Description |
|---|---|---|
| `GEMINI_API_KEY` | ✅ | Google AI Studio API key |
| `GEMINI_MODEL` | ✅ | e.g. `gemini-2.5-flash` |
| `ALPHAVANTAGE_API_KEY` | optional | 25 req/day free — [alphavantage.co](https://www.alphavantage.co/support/#api-key) |
| `FINNHUB_API_KEY` | optional | For stock tickers — [finnhub.io](https://finnhub.io/register) |

### 5. Deploy Edge Functions

```bash
npx supabase login
npx supabase functions deploy ask_finoracle --no-verify-jwt
npx supabase functions deploy retrieve_sources --no-verify-jwt
npx supabase functions deploy llm_proxy --no-verify-jwt
npx supabase functions deploy verify_analysis --no-verify-jwt
npx supabase functions deploy run_verification_queue --no-verify-jwt
```

### 6. Run the frontend

```bash
npm run dev
# → http://localhost:5173
```

---

## Testing the API

All Edge Functions accept POST requests. Test via Supabase Dashboard → Edge Functions → [function] → Test.

### Full analysis (ask_finoracle)

```json
{
  "asset_code": "BTC/USD",
  "event_date": "2026-03-20",
  "direction": "up",
  "question": "Why did Bitcoin surge on March 20 2026?"
}
```

`asset_code` is optional — inferred from the question if omitted.

### Re-verify an analysis (verify_analysis)

```json
{ "analysis_id": "your-analysis-uuid" }
```

### Debug source retrieval (retrieve_sources)

```json
{
  "query": "Bitcoin surge rally",
  "asset_code": "BTC/USD",
  "event": { "event_date": "2026-03-20", "asset_code": "BTC/USD" },
  "limit": 20,
  "debug": true
}
```

---

## Supported Markets

FinOracle is focused on **US and Turkish markets**, with full crypto and major forex coverage.

| Asset Type | Examples | Expected Confidence |
|---|---|---|
| Crypto | BTC/USD, ETH/USD, SOL/USD | 0.7 – 0.9 |
| US stocks | AAPL, TSLA, NVDA, MSFT, AMZN | 0.7 – 0.9 |
| Turkish stocks (BIST) | THYAO, GARAN, AKBNK, EREGL | 0.3 – 0.7 |
| Forex | USD/TRY, EUR/USD, EUR/TRY | 0.6 – 0.9 |
| Commodities | XAU/USD (gold), USOIL | 0.6 – 0.8 |
| Indices | BIST100, SPX, NDX | 0.5 – 0.8 |

> Assets outside US/TR markets (e.g. HK, KR, JP stocks) are out of scope and may return low-confidence results due to limited free English-language coverage.

---

## Edge Functions Reference

| Function | Trigger | Description |
|---|---|---|
| `ask_finoracle` | Frontend / API | Full pipeline: infer asset → retrieve → analyse → save |
| `retrieve_sources` | Called by ask_finoracle | Parallel news retrieval with scoring |
| `llm_proxy` | Called internally | Gemini wrapper — tasks: `ask`, `recheck`, `extract_asset` |
| `verify_analysis` | Frontend / queue | Re-checks one analysis, updates source reputation |
| `run_verification_queue` | pg_cron 06:00 & 18:00 UTC | Batch-processes all due re-checks |

---

## Project Structure

```
finoracle/
├── src/
│   ├── components/         # Layout, Sidebar, StatCard, ConfidenceBar, SourceList, ...
│   ├── pages/              # Dashboard, Events, NewEvent, EventDetail, CredibilityBoard
│   ├── services/           # analysisService.js, eventService.js, credibilityService.js
│   └── lib/
│       └── supabaseClient.js
├── supabase/
│   ├── functions/
│   │   ├── ask_finoracle/
│   │   ├── retrieve_sources/
│   │   ├── llm_proxy/
│   │   ├── verify_analysis/
│   │   └── run_verification_queue/
│   └── migrations/
│       ├── *.sql                        # run in order
│       └── pg_cron_credentials.local.sql  # gitignored — fill manually
├── .env.local              # gitignored — add your own Supabase keys
├── .gitignore
├── package.json
└── vite.config.js
```

---

## Roadmap

### In Progress
- pgvector semantic search for source retrieval
- Frontend improvements (Dashboard charts, EventDetail enrichment)

### Planned
- NewsData.io or GNews API integration for higher daily limits
- Alpha Vantage premium tier (currently 25 req/day)
- Public deployment (Vercel + Supabase)

---

## License

MIT
