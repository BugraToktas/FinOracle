# FinOracle

AI-powered financial market event analysis platform. Ask a question about any market move — FinOracle infers the asset, retrieves date-filtered news from 6 parallel sources, generates a Gemini-powered analysis, and periodically re-verifies its conclusions.

Supports **English and Turkish** questions. Focused on **US and Turkish markets** with full crypto and forex coverage.

---

## Architecture

```
Browser (React + Vite + Tailwind v4)
        │   Supabase Auth (email/password, Google OAuth)
        ▼
Supabase Edge Functions (Deno)
        │
        ├── ask_finoracle          ← main pipeline
        │       ├── 1. Resolve user from JWT
        │       ├── 2. Infer asset code (3-tier: regex → Yahoo Finance → LLM)
        │       ├── 3. Retrieve sources (6 providers in parallel)
        │       │       ├── Alpha Vantage NEWS_SENTIMENT
        │       │       ├── Finnhub company-news
        │       │       ├── NewsData.io (TR+EN bilingual)
        │       │       ├── Yahoo Finance News (ticker-specific)
        │       │       ├── Google News RSS  (date-filtered)
        │       │       └── RSS feeds (CNBC, CoinDesk, MarketWatch, ...)
        │       ├── 4. Semantic search: Gemini embedding → pgvector match
        │       ├── 5. llm_proxy → Gemini 2.5 Flash (analysis)
        │       └── 6. Save to DB (market_events, analysis_results, source_documents)
        │               └── Store embeddings (fire-and-forget)
        │
        ├── verify_analysis        ← re-checks a single analysis, updates reputation
        ├── run_verification_queue ← batch re-check (pg_cron: 06:00 & 18:00 UTC)
        └── llm_proxy              ← Gemini wrapper (ask / recheck / extract_asset)
```

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite 8, Tailwind CSS v4, react-router-dom v7, recharts |
| i18n | react-i18next — English (default) + Turkish |
| Auth | Supabase Auth — email/password + Google OAuth |
| Backend | Supabase Edge Functions (Deno runtime) |
| Database | Supabase PostgreSQL 15 + pgvector (HNSW, 768-dim Gemini embeddings) |
| LLM | Google Gemini 2.5 Flash |
| Embeddings | Google Gemini text-embedding-004 (768 dims) |
| News | Alpha Vantage, Finnhub, NewsData.io, Yahoo Finance, Google News RSS, RSS |

---

## Database Schema

| Table | Purpose |
|---|---|
| `profiles` | User metadata, auto-created on first sign-in |
| `market_events` | Asset + date + direction + magnitude + user_id |
| `analysis_results` | LLM summary, confidence, status, verify_after, user_id |
| `source_documents` | Deduplicated news articles (url, domain, snippet, embedding) |
| `analysis_document_links` | Many-to-many: analysis ↔ source documents |
| `news_sources` | Publisher reputation scores (Laplace-smoothed) |
| `analysis_source_links` | LLM-cited sources linked to an analysis |
| `revalidations` | Re-check history with verdict (correct / partial / wrong) |

---

## Asset Code Inference (3-Tier)

When `asset_code` is omitted, FinOracle infers it automatically from the question:

| Tier | Method | Coverage |
|---|---|---|
| 1 | Regex pattern matching | ~90% — crypto, major US/TR/EU stocks, forex, commodities, indices |
| 2 | Yahoo Finance symbol search | Any globally listed ticker |
| 3 | Gemini LLM extraction | Free-form descriptions in any language |

The response includes `inferred_asset_code` and `infer_method` for transparency.

**Example — Turkish question, no asset_code needed:**
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

6 providers run in parallel, results ranked and trimmed to top 20:

| Provider | Articles | Strength |
|---|---|---|
| **Alpha Vantage** | up to 50 | Date-range filtered, 25 req/day free |
| **Finnhub** | up to 10 | US/global stocks, date-range filtered |
| **NewsData.io** | up to 10 | Bilingual TR+EN, free tier |
| **Yahoo Finance News** | 10 | Ticker-specific, global coverage |
| **Google News RSS** | 10 | Date-filtered (`after:/before:`), broad coverage |
| **RSS feeds** | 5 | Safety net (CNBC, MarketWatch, CoinDesk, tr.investing.com, ...) |

**Scoring factors** (higher = ranked first):
- Date proximity to event (≤1 day: +1.0, ≤3 days: +0.7, >21 days: excluded)
- Ticker-specific provider (Alpha Vantage, Finnhub, Yahoo: +0.35–0.4)
- Trusted domain (Reuters, Bloomberg, CoinDesk, etc.: +0.3)
- Whole-word question token match in title (+2×) or snippet (+1×)

---

## Semantic Search (pgvector)

After keyword retrieval, FinOracle also queries the historical document store:

1. The user's question is embedded via `text-embedding-004` (768 dims)
2. `match_source_documents()` RPC runs cosine similarity search (threshold: 0.55)
3. Semantic results are **merged** with keyword results and deduplicated by URL
4. Newly fetched articles are embedded and stored in the background (fire-and-forget)

Over time, as the document store grows, semantic search becomes increasingly effective.

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

> Assets outside US/TR markets (HK, KR, JP stocks) are out of scope.

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 20+
- A Supabase project ([supabase.com](https://supabase.com))
- A Google Gemini API key ([aistudio.google.com/apikey](https://aistudio.google.com/apikey))

### 1. Clone & install

```bash
git clone https://github.com/your-username/finoracle.git
cd finoracle
npm install
```

### 2. Frontend environment

Create `.env.local` in project root:

```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

Both values: **Supabase Dashboard → Settings → API**

### 3. Run migrations

In **Supabase Dashboard → SQL Editor**, run in order:

```
1. 20260316_add_unique_constraints.sql
2. 20260316_drop_redundant_columns.sql
3. 20260316_drop_dead_columns.sql
4. 20260316_atomic_reputation_update.sql
5. 20260327_rls_public_read.sql
6. 20260327_pgvector_embeddings.sql   ← enables vector extension
7. 20260316_pgvector_768.sql          ← switch to 768-dim + HNSW index
8. 20260316_user_profiles.sql         ← profiles table + user_id columns
9. 20260327_pg_cron_verification.sql  ← requires pg_cron extension
   pg_cron_credentials.local.sql      ← gitignored, fill service_role_key manually
```

> Enable extensions first: **Dashboard → Database → Extensions → pg_cron, vector**

### 4. Supabase Auth

- **Dashboard → Authentication → Providers → Email**: enable
- **Dashboard → Authentication → Providers → Google**: add Client ID + Secret from Google Cloud Console

### 5. Edge Function secrets

**Dashboard → Settings → Edge Function Secrets:**

| Secret | Required | Description |
|---|---|---|
| `GEMINI_API_KEY` | ✅ | Google AI Studio — used for LLM + embeddings |
| `GEMINI_MODEL` | ✅ | e.g. `gemini-2.5-flash` |
| `NEWSDATA_API_KEY` | ✅ recommended | [newsdata.io](https://newsdata.io/register) — 200 req/day free |
| `ALPHAVANTAGE_API_KEY` | optional | [alphavantage.co](https://www.alphavantage.co/support/#api-key) — 25 req/day free |
| `FINNHUB_API_KEY` | optional | [finnhub.io](https://finnhub.io/register) |

### 6. Deploy Edge Functions

```bash
npx supabase login
npx supabase functions deploy ask_finoracle --no-verify-jwt
npx supabase functions deploy retrieve_sources --no-verify-jwt
npx supabase functions deploy llm_proxy --no-verify-jwt
npx supabase functions deploy verify_analysis --no-verify-jwt
npx supabase functions deploy run_verification_queue --no-verify-jwt
```

### 7. Run frontend

```bash
npm run dev
# → http://localhost:5173
```

---

## User Limits

| Tier | Analyses / day | Notes |
|---|---|---|
| Unauthenticated | 0 | Read-only access |
| Free user | 5 | Resets at midnight UTC |
| *(future)* Pro | Unlimited | Stripe subscription |

---

## Testing the API

### Full analysis

```json
POST ask_finoracle
{
  "event_date": "2026-03-20",
  "direction": "up",
  "question": "Why did Bitcoin surge on March 20 2026?"
}
```

### Debug source retrieval

```json
POST retrieve_sources
{
  "query": "Bitcoin surge rally",
  "asset_code": "BTC/USD",
  "event": { "event_date": "2026-03-20", "asset_code": "BTC/USD" },
  "limit": 20,
  "debug": true
}
```

### Re-verify an analysis

```json
POST verify_analysis
{ "analysis_id": "your-analysis-uuid" }
```

---

## Project Structure

```
finoracle/
├── src/
│   ├── components/       # Layout, Sidebar, StatCard, ConfidenceBar, SourceList, ...
│   ├── context/
│   │   └── AuthContext.jsx
│   ├── i18n/
│   │   ├── en.js         # English translations
│   │   └── tr.js         # Turkish translations
│   ├── pages/            # Dashboard, Events, NewEvent, EventDetail, CredibilityBoard, Login
│   ├── services/         # analysisService.js, eventService.js, credibilityService.js
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
│       ├── *.sql                          # run in order (see step 3)
│       └── pg_cron_credentials.local.sql  # gitignored — fill manually
├── .env.local            # gitignored
├── TODO.md
├── package.json
└── vite.config.js
```

---

## Edge Functions Reference

| Function | Trigger | Description |
|---|---|---|
| `ask_finoracle` | Frontend / API | Full pipeline: auth → infer → retrieve → analyse → embed → save |
| `retrieve_sources` | Internal | 6-provider parallel news retrieval with ranking |
| `llm_proxy` | Internal | Gemini wrapper — tasks: `ask`, `recheck`, `extract_asset` |
| `verify_analysis` | Frontend / queue | Re-checks one analysis, updates source reputation |
| `run_verification_queue` | pg_cron 06:00 & 18:00 UTC | Batch-processes all due re-checks |

---

## Roadmap

### Planned
- Landing page (hero, features, live stats)
- EventDetail source enrichment (snippet, date, provider badge)
- Mobile responsive sidebar
- Admin panel (verification queue, user management)
- Stripe subscription (Pro tier — unlimited analyses)
- Email notifications on analysis completion / verification result

---

## License

MIT
