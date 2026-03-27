# FinOracle

AI-powered financial market event analysis platform. Submit a market event (e.g. "BTC surged 5% on March 20") and FinOracle automatically retrieves date-filtered news sources, generates an LLM-based analysis, and periodically re-verifies its own conclusions against new evidence.

---

## Architecture

```
Frontend (React + Vite + Tailwind v4)
        │
        ▼
Supabase (PostgreSQL + Edge Functions)
        │
        ├── ask_finoracle       → main analysis pipeline
        │       ├── retrieve_sources  → Google News RSS + Alpha Vantage + Finnhub + RSS feeds
        │       └── llm_proxy         → Gemini 2.5 Flash
        │
        ├── verify_analysis     → re-checks a past analysis, updates source reputation
        └── run_verification_queue → batch-processes all analyses due for recheck
```

### Database tables

| Table | Purpose |
|---|---|
| `market_events` | Asset + date + direction + magnitude |
| `analysis_results` | LLM summary, confidence, status, verify_after |
| `source_documents` | Deduplicated news articles (url, domain, snippet) |
| `analysis_document_links` | Many-to-many: analysis ↔ source documents |
| `news_sources` | Publisher reputation scores (Laplace-smoothed) |
| `analysis_source_links` | LLM-cited sources linked to an analysis |
| `revalidations` | Re-check history with verdict (correct/partial/wrong) |

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite 8, Tailwind CSS v4, react-router-dom v7, recharts |
| Backend | Supabase Edge Functions (Deno runtime) |
| Database | Supabase PostgreSQL (pgvector enabled) |
| LLM | Google Gemini 2.5 Flash via Generative Language API |
| News sources | Google News RSS (date-filtered), Alpha Vantage, Finnhub, static RSS feeds |

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

In **Supabase Dashboard → SQL Editor**, run each file in `supabase/migrations/` in chronological order:

1. `20260316_add_unique_constraints.sql`
2. `20260316_drop_redundant_columns.sql`
3. `20260316_drop_dead_columns.sql`
4. `20260316_atomic_reputation_update.sql`
5. `20260327_rls_public_read.sql`
6. `20260327_pgvector_embeddings.sql`
7. `20260327_pg_cron_verification.sql` *(requires pg_cron extension — enable it in Dashboard → Database → Extensions first)*
8. `supabase/migrations/pg_cron_credentials.local.sql` — **gitignored**, fill in your own values and run manually

### 4. Set Edge Function secrets

In **Supabase Dashboard → Settings → Edge Function Secrets**:

| Secret | Required | Description |
|---|---|---|
| `GEMINI_API_KEY` | ✅ | Google AI Studio API key |
| `GEMINI_MODEL` | ✅ | e.g. `gemini-2.5-flash` |
| `ALPHAVANTAGE_API_KEY` | optional | 25 req/day free — [alphavantage.co](https://www.alphavantage.co/support/#api-key) |
| `FINNHUB_API_KEY` | optional | For stock tickers — [finnhub.io](https://finnhub.io/register) |

### 5. Deploy Edge Functions

```bash
supabase functions deploy ask_finoracle
supabase functions deploy retrieve_sources
supabase functions deploy llm_proxy
supabase functions deploy verify_analysis
supabase functions deploy run_verification_queue
```

### 6. Run the frontend

```bash
npm run dev
# → http://localhost:5173
```

---

## Edge Functions

| Function | Trigger | Description |
|---|---|---|
| `ask_finoracle` | Frontend / manual | Full pipeline: retrieve → analyse → save |
| `retrieve_sources` | Called by ask_finoracle | Fetches date-filtered news from multiple providers |
| `llm_proxy` | Called by ask_finoracle / verify_analysis | Gemini API wrapper with JSON normalisation |
| `verify_analysis` | Frontend / queue | Re-checks a single analysis, updates reputation |
| `run_verification_queue` | pg_cron (06:00 & 18:00 UTC) | Batch-verifies all analyses past their `verify_after` date |

---

## News Source Priority

1. **Alpha Vantage NEWS_SENTIMENT** — ticker + date-range filtered (25 req/day free)
2. **Google News RSS** — free, no key, `after:` / `before:` date operators
3. **Finnhub company-news** — stock tickers only, date-range filtered
4. **Static RSS feeds** — CoinDesk, CNBC, MarketWatch, Investing.com (always-on fallback)

---

## Project Structure

```
finoracle/
├── src/
│   ├── components/         # Layout, Sidebar, StatCard, ConfidenceBar, ...
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
├── .env.local              # gitignored — add your own
├── package.json
└── vite.config.js
```

---

## License

MIT
