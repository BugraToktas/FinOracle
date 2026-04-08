# FinOracle

AI-powered financial market event analysis platform. Ask a question about any market move — FinOracle infers the asset, retrieves date-filtered news from 6 parallel sources, generates a Gemini-powered analysis, and periodically re-verifies its conclusions.

Supports **English and Turkish** questions. Focused on **US and Turkish markets** with full crypto and forex coverage.

---

## What Happens When You Ask a Question? (Example Flow)

Let's say a user asks: *"Why did Bitcoin surge on March 20, 2026?"*

Here is the step-by-step breakdown of how FinOracle seamlessly handles this request across the frontend and backend:

### 1. Frontend (React + Vite App)
* **User Input:** The user navigates to the New Event page, selecting the event date (March 20, 2026), direction (Up), and typing their question.
* **Validation & API Call:** The frontend validates the input and securely calls the Supabase Edge Function (`ask_finoracle`) utilizing the authenticated user's JWT.
* **Interactive UI:** The application enters a rich loading state, providing visual feedback while the complex backend process is underway.

### 2. Backend (Supabase Edge Functions & PostgreSQL)
* **Auth & Rate Limiting:** The `ask_finoracle` pipeline verifies the user's identity and checks their daily request quota.
* **Asset Inference (3-Tier Pipeline):** Since the user didn't explicitly provide a ticker, the system automatically detects "Bitcoin" as `BTC/USD` using regex patterns or the `llm_proxy`.
* **Parallel News Retrieval:** The `retrieve_sources` function launches parallel requests to 6 sources (Alpha Vantage, Finnhub, Google News, Yahoo, NewsData.io, RSS). To ensure relevance, it applies strict date-range filters based on "March 20, 2026".
* **Semantic Search:** In parallel, the backend queries the `pgvector` database. It vectorizes the user's question with Gemini embeddings and retrieves historically relevant articles via cosine similarity matching.
* **Synthesis & LLM Analysis:** Keyword-based and semantic news sources are merged, deduplicated, and ranked. The top documents are appended to the user’s prompt and sent to **Gemini 2.5 Flash** for a comprehensive analysis.
* **Database Persistence:** The generated analysis, confidence scores, and all fetched news articles (embedded asynchronously) are persisted to the database (`market_events`, `analysis_results`, `source_documents`).
* **Response Delivery:** The backend responds with the ID of the completed analysis. 

### 3. Display
* The React frontend redirects the user to the `EventDetail` page, dynamically rendering the Gemini-generated Markdown, the linked sources that back the claims, and a confidence bar.

---

## Architecture

```text
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

<br>
<br>

---
---
---

# 🇹🇷 Türkçe (Turkish)
# FinOracle

Yapay zeka destekli finansal piyasa olayları analiz platformu. Herhangi bir piyasa hareketi hakkında soru sorun — FinOracle varlığı algılar, 6 paralel kaynaktan tarihe göre filtrelenmiş haberleri çeker, Gemini destekli bir analiz üretir ve sonuçlarını periyodik olarak yeniden doğrular.

**İngilizce ve Türkçe** soruları destekler. Tam kripto ve forex kapsamı ile **ABD ve Türk piyasalarına** odaklanmıştır.

---

## Soru Sorduğunuzda Ne Olur? (Örnek Akış)

Diyelim ki bir kullanıcı şu soruyu sordu: *"Neden Bitcoin 20 Mart 2026'da aniden yükseldi?"*

İşte FinOracle'ın bu isteği hem frontend (ön uç) hem de backend (arka uç) tarafında adım adım nasıl işlediğinin özeti:

### 1. Frontend (React + Vite Uygulaması)
* **Kullanıcı Girdisi:** Kullanıcı "Yeni Olay" sayfasına gider, olay tarihini (20 Mart 2026), yönünü (Yükseliş) seçer ve sorusunu yazar.
* **Doğrulama ve API Çağrısı:** Frontend, girdiyi doğrular ve Supabase Edge Function API'sine (`ask_finoracle`) yetkilendirilmiş kullanıcının JWT'siyle (token) güvenli bir çağrı yapar.
* **Görsel Arayüz (UI):** Zengin bir yükleme animasyonu devreye girer. Karmaşık arka plan işlemleri devam ederken kullanıcıya görsel geri bildirim verilir.

### 2. Backend (Supabase Edge Functions & Veritabanı)
* **Yetki ve Kota Kontrolü:** `ask_finoracle` fonksiyonu kullanıcının kimliğini doğrular ve günlük istek kotasını (API limitini) kontrol eder.
* **Varlık Çıkarımı (3 Aşamalı Tahmin):** Kullanıcı bir sembol (ticker) vermediyse bile, sistem "Bitcoin" kelimesini yakalayarak Regex veya LLM aracılığıyla işlem görecek varlığın `BTC/USD` olduğunu otomatik algılar.
* **Paralel Haber Tarama:** `retrieve_sources` (kaynak alma) fonksiyonu 6 ayrı haber sağlayıcısına (Alpha Vantage, Google News, Yahoo, Finnhub, vb.) anında eşzamanlı istek atar. Alakasız sonuçlardan kaçınmak için arama sadece "20 Mart 2026" tarihi civarına filtrelenir.
* **Vektör & Semantik Arama:** Aynı zamanda, backend `pgvector` veritabanında kullanıcının sorusunu Gemini kullanarak vektörize eder (embedding) ve önceki analizlerin haber havuzundan kosinüs benzerliği ile tarihsel haberleri getirir.
* **Sentez ve Yapay Zeka (LLM) Analizi:** Anahtar kelime tabanlı ve anlamsal sonuçlar birleştirilir, çiftleşenler silinir ve kaynaklar puanlanarak sıralanır. En iyi kaynaklar kullanıcının istemiyle (prompt) birleştirilerek kapsamlı bir analiz metni yazması için **Gemini 2.5 Flash** modeline gönderilir.
* **Veri Kaydı:** Ortaya çıkan analiz metni, güven skoru (confidence) ve çekilen tüm kaynaklar doğrudan PostgreSQL veritabanına (`market_events`, `analysis_results`, `source_documents`) kalıcı olarak kayıt edilir.
* **Yanıtın İletilmesi:** Backend, tamamlanan analiz sürecinin ID numarasını React istemcisine geri döndürür.

### 3. Gösterim
* React frontend uygulaması, kullanıcıyı anında `EventDetail` (Olay Detayı) sayfasına yönlendirir. Gemini tarafından oluşturulan Markdown analiz metni, bu analizi destekleyen güvenilir kaynak linkleri ve oluşturulan güven yüzdesi barı ekranda dinamik olarak görüntülenir.

---

## Mimari

```text
Tarayıcı (React + Vite + Tailwind v4)
        │   Supabase Auth (e-posta/şifre, Google OAuth girişi)
        ▼
Supabase Edge Functions (Deno Arka Ucu)
        │
        ├── ask_finoracle          ← ana API ve işlem hattı
        │       ├── 1. JWT'den kullancı tespiti
        │       ├── 2. Varlık kodu bulma (3-katmanlı: regex → Yahoo Finance → LLM)
        │       ├── 3. Kaynak tarama (6 sağlayıcı paralel çalışır)
        │       │       ├── Alpha Vantage NEWS_SENTIMENT
        │       │       ├── Finnhub company-news
        │       │       ├── NewsData.io (Bölgesel İng. + Türk.)
        │       │       ├── Yahoo Finance News (Varlık kodu özelinde arama)
        │       │       ├── Google News RSS  (Tarih filtreli arama)
        │       │       └── Diğer RSS kaynakları (CNBC, CoinDesk vb.)
        │       ├── 4. Semantik arama: Gemini vektörleştirme → pgvector ile eşleşme
        │       ├── 5. llm_proxy → Gemini 2.5 Flash (Analiz üretim süreci)
        │       └── 6. DB Kaydı (market_events, analysis_results, source_documents)
        │               └── Metin embedding işlemi arka planda sürekler
        │
        ├── verify_analysis        ← Tekil bir analizi sonradan teyit etme
        ├── run_verification_queue ← Toplu geriye dönük analiz doğrulaması (günde 2 kez)
        └── llm_proxy              ← Gemini iletişim köprüsü (analiz, çıkarma, doğrulama)
```

---

## Teknoloji Yığını (Stack)

| Katman | Teknoloji |
|---|---|
| Frontend (Arayüz) | React 19, Vite 8, Tailwind CSS v4, react-router-dom v7, recharts |
| Dil Desteği (i18n) | react-i18next — İngilizce (varsayılan) + Türkçe |
| Kimlik Doğrulama | Supabase Auth — e-posta/şifre + Google OAuth |
| Backend (Arka Uç) | Supabase Edge Functions (Deno çalışma zamanı) |
| Veritabanı | Supabase PostgreSQL 15 + pgvector (HNSW, 768-boyutlu vektörler) |
| Yapay Zeka (LLM) | Google Gemini 2.5 Flash |
| Vektörizasyon | Google Gemini text-embedding-004 (768 boyutlu) |
| Haber Sağlayıcılar | Alpha Vantage, Finnhub, NewsData.io, Yahoo Finance, Google News, RSS |

---

## Veritabanı Şeması

| Tablo | Amaç |
|---|---|
| `profiles` | Kullanıcı profili, ilk girişte otomatik yaratılır |
| `market_events` | Varlık + tarih + yön + şiddet + kimlik |
| `analysis_results` | YZ özeti, güven yüzdesi, doğrulama tarihi |
| `source_documents` | Haber dökümanları (url, domain, metin kısmı, vektör) |
| `analysis_document_links` | Analiz ve haber dökümanı arasındaki çoktan çoğa bağ |
| `news_sources` | Yayıncıların güvenilirlik ve itibar skorları |
| `analysis_source_links` | İçeriğe alıntılanmış kaynakların bağları |
| `revalidations` | Geçmişte yapılan "yeniden teyitlerin" skor kayıtları |

---

## Varlık Kodu Bulma (3 Katman)

Eğer `asset_code` gönderilmezse, FinOracle varlığı bu 3 adımdan biri ile bağlamdan çıkarır:

| Katman | Yöntem | Kapsam |
|---|---|---|
| 1 | Regex tespit | ~90% — kripto, TR/ABD hisseleri, forex vb. |
| 2 | Yahoo Finance Ticker Arama | Dünya çapında listelenmiş tüm borsa kodları |
| 3 | Gemini LLM Yorumlama | Her dilde serbest metin üzerinden tahminde bulunma |

**Örnek — Türkçe bir soru:**
```json
{
  "event_date": "2026-03-20",
  "direction": "up",
  "question": "Bitcoin neden 20 Mart 2026'da yükseldi?"
}
```
→ `"inferred_asset_code": "BTC/USD"`, `"infer_method": "pattern"` (Regex ile)

---

## Haber Kaynağı İşlem Hattı

6 sağlayıcı paralel olarak çalışır, sonuçlar sıralanır ve ilk 20 ile sınırlandırılır:

| Sağlayıcı | Makale | Güçlü Yönleri |
|---|---|---|
| **Alpha Vantage** | 50'ye kadar | Tarihe göre filtrelenmiş, günde 25 ücretsiz istek |
| **Finnhub** | 10'a kadar | ABD/küresel hisseler, tarihe göre filtrelenmiş |
| **NewsData.io** | 10'a kadar | Çift dilli (TR+EN), ücretsiz kullanım |
| **Yahoo Finance News** | 10 adet | Varlık koduna özel, küresel kapsam |
| **Google News RSS** | 10 adet | Tarihe göre filtrelenmiş (`after:/before:`), geniş kapsam |
| **RSS kaynakları** | 5 adet | Güvenlik ağı (CNBC, MarketWatch, CoinDesk, tr.investing.com, ...) |

**Puanlama faktörleri** (daha yüksek = daha üst sıralama):
- Olaya olan tarih yakınlığı (≤1 gün: +1.0, ≤3 gün: +0.7, >21 gün: hariç tutulur)
- Varlık koduna özel sağlayıcı olması (Alpha Vantage, Finnhub, Yahoo: +0.35–0.4)
- Güvenilir alan adı (Reuters, Bloomberg, CoinDesk vb.: +0.3)
- Soru kelimelerinin başlıkta (+2×) veya haber özetinde (+1×) birebir geçmesi

---

## Semantik Arama (pgvector)

Anahtar kelime aramasına ek olarak, FinOracle geçmiş belge veritabanını da sorgular:

1. Kullanıcının sorusu `text-embedding-004` (768 boyutlu) ile vektörize edilir.
2. `match_source_documents()` fonksiyonu kosinüs benzerliği araması yapar (eşik: 0.55).
3. Semantik sonuçlar, anahtar kelime sonuçlarıyla **birleştirilir** ve URL bazında çiftleşenler silinir.
4. Yeni çekilen makaleler arka planda vektörize edilerek veritabanına eklenir.

Zamanla haber havuzu büyüdükçe semantik arama çok daha etkili hale gelir.

---

## Desteklenen Piyasalar

FinOracle ağırlıklı olarak **ABD ve Türk borsalarına**, bunun yanı sıra kripto ve büyük döviz çiftlerine (forex) odaklanır.

| Varlık Tipi | Örnek | Beklenen Güvenilirlik Skoru |
|---|---|---|
| Kripto Para | BTC/USD, ETH/USD, SOL/USD | 0.7 – 0.9 |
| ABD Hisseleri | AAPL, TSLA, NVDA, MSFT, AMZN | 0.7 – 0.9 |
| Türk Hisseleri (BIST) | THYAO, GARAN, AKBNK, EREGL | 0.3 – 0.7 |
| Forex | USD/TRY, EUR/USD, EUR/TRY | 0.6 – 0.9 |
| Emtialar | XAU/USD (altın), USOIL | 0.6 – 0.8 |
| Endeksler | BIST100, SPX, NDX | 0.5 – 0.8 |

> ABD ve TR dışındaki hisseler (ör: Japonya, Kore pazarları vb.) tam kapsama dahil değildir.

---

## Kurulum ve Başlangıç

### Gereksinimler

- [Node.js](https://nodejs.org/) 20+
- Bir Supabase projesi ([supabase.com](https://supabase.com))
- Bir Google Gemini API Anahtarı ([aistudio.google.com/apikey](https://aistudio.google.com/apikey))

### 1. Klonlama ve İndirme

```bash
git clone https://github.com/kullaniciadi/finoracle.git
cd finoracle
npm install
```

### 2. Frontend Çevre (Environment) Ayarları

Proje kökünde `.env.local` oluşturun:

```env
VITE_SUPABASE_URL=https://sizin-proje-urlniz.supabase.co
VITE_SUPABASE_ANON_KEY=sizin-anon-anahtariniz
```

Her iki değer için: **Supabase Paneli → Settings → API**

### 3. Veritabanı Geçişlerini Çalıştırma (Migrations)

**Supabase Paneli → SQL Editor** bölümünde aşağıdaki SQL dosyalarını sırayla çalıştırın:

```text
1. 20260316_add_unique_constraints.sql
2. 20260316_drop_redundant_columns.sql
3. 20260316_drop_dead_columns.sql
4. 20260316_atomic_reputation_update.sql
5. 20260327_rls_public_read.sql
6. 20260327_pgvector_embeddings.sql   ← vektör eklentisini açar
7. 20260316_pgvector_768.sql          ← 768 boyutlu vektöre + HNSW indeksine geçer
8. 20260316_user_profiles.sql         ← profiller tablosu + user_id sütunları
9. 20260327_pg_cron_verification.sql  ← pg_cron eklentisini gerektirir
   pg_cron_credentials.local.sql      ← git tarafından yoksayılır, service_role_key değerini elle girin
```

> Öncelikle eklentileri etkinleştirin: **Dashboard → Database → Extensions → pg_cron, vector**

### 4. Supabase Kimlik Doğrulama (Auth)

- **Dashboard → Authentication → Providers → Email**: etkinleştirin
- **Dashboard → Authentication → Providers → Google**: Google Cloud Console üzerinden aldığınız Client ID ve Secret bilgilerini ekleyin

### 5. Edge Function Gizli Anahtarları (Secrets)

**Dashboard → Settings → Edge Function Secrets:**

| Anahtar (Secret) | Zorunlu mu? | Açıklama |
|---|---|---|
| `GEMINI_API_KEY` | ✅ | Google AI Studio — LLM ve vektörizasyon için zorunlu |
| `GEMINI_MODEL` | ✅ | ör. `gemini-2.5-flash` |
| `NEWSDATA_API_KEY` | ✅ önerilir | [newsdata.io](https://newsdata.io/register) — günde 200 ücretsiz istek |
| `ALPHAVANTAGE_API_KEY` | isteğe bağlı | [alphavantage.co](https://www.alphavantage.co/support/#api-key) — günde 25 ücretsiz istek |
| `FINNHUB_API_KEY` | isteğe bağlı | [finnhub.io](https://finnhub.io/register) |

### 6. Edge Fonksiyonlarını Dağıtma

Terminal üzerinden:

```bash
npx supabase login
npx supabase functions deploy ask_finoracle --no-verify-jwt
npx supabase functions deploy retrieve_sources --no-verify-jwt
npx supabase functions deploy llm_proxy --no-verify-jwt
npx supabase functions deploy verify_analysis --no-verify-jwt
npx supabase functions deploy run_verification_queue --no-verify-jwt
```

### 7. Arayüzü Başlatma

```bash
npm run dev
# → http://localhost:5173
```

---

## Kullanıcı Limitleri

| Üyelik Tipi | Günlük Analiz | Notlar |
|---|---|---|
| Giriş yapmamış | 0 | Sadece okuma erişimi |
| Ücretsiz Kullanıcı | 5 | Gece yarısı (UTC) sıfırlanır |
| *(Gelecek)* Pro | Sınırsız | Stripe aboneliği |

---

## API'yi Test Etme

### Tam analiz döngüsü

```json
POST ask_finoracle
{
  "event_date": "2026-03-20",
  "direction": "up",
  "question": "Neden Bitcoin 20 Mart 2026'da yükseldi?"
}
```

### Kaynak getirmeyi test etme (Debug)

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

### Analizi yeniden doğrulama (Re-verify)

```json
POST verify_analysis
{ "analysis_id": "sizin-analiz-uuid-degeriniz" }
```

---

## Proje Yapısı

```text
finoracle/
├── src/
│   ├── components/       # Layout, Sidebar, StatCard, ConfidenceBar, SourceList, ...
│   ├── context/
│   │   └── AuthContext.jsx
│   ├── i18n/
│   │   ├── en.js         # İngilizce çeviriler
│   │   └── tr.js         # Türkçe çeviriler
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
│       ├── *.sql                          # sırayla çalıştırılır (bkz. adım 3)
│       └── pg_cron_credentials.local.sql  # git tarafından yoksayılır — el ile girin
├── .env.local            # git tarafından yoksayılır
├── TODO.md
├── package.json
└── vite.config.js
```

---

## Edge Functions Referansı

| Fonksiyon | Tetikleyici | Açıklama |
|---|---|---|
| `ask_finoracle` | Arayüz / API | Tam işlem hattı: auth → varlık tahmini → haber tarama → analiz → vektörleştirme → kayıt |
| `retrieve_sources` | Dahili (Internal)| 6 sağlayıcılı paralel haber getirme ve sıralama |
| `llm_proxy` | Dahili | Gemini köprüsü — görevler: `ask`, `recheck`, `extract_asset` |
| `verify_analysis` | Arayüz / Kuyruk | Tekil analizi doğrular, kaynak itibarını günceller |
| `run_verification_queue` | pg_cron (06:00 & 18:00 UTC) | Süresi gelen tüm teyit işlemlerini toplu çalıştırır |

---

## Yol Haritası (Roadmap)

### Planlananlar
- Açılış sayfası (Landing page) (hero, özellikler, canlı istatistikler)
- EventDetail ekranında daha detaylı kaynak gösterimi (özet metin, tarih, haber kanalı rozeti)
- Mobil uyumlu yan menü (Sidebar)
- Yönetim paneli (doğrulama kuyruğu kontrolü, kullanıcı yönetimi)
- Stripe aboneliği (Pro plan — sınırsız analiz)
- Analiz tamamlandığında / teyit edildiğinde e-posta bildirimleri

---

## Lisans

MIT
