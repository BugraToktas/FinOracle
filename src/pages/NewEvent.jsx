import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Sparkles, AlertCircle, ChevronRight, Zap, X, Gauge } from 'lucide-react'
import { callAskFinoracle, getTodayAnalysisCount, DAILY_LIMIT } from '../services/analysisService'

// ─── Asset inference (mirrors backend ASSET_PATTERNS) ────────────────────────
const ASSET_PATTERNS = [
  [/\b(bitcoin|btc)\b/i,             'BTC/USD'],
  [/\b(ethereum|eth|ether)\b/i,      'ETH/USD'],
  [/\b(solana|sol)\b/i,              'SOL/USD'],
  [/\b(ripple|xrp)\b/i,              'XRP/USD'],
  [/\b(binance coin|bnb)\b/i,        'BNB/USD'],
  [/\b(cardano|ada)\b/i,             'ADA/USD'],
  [/\b(dogecoin|doge)\b/i,           'DOGE/USD'],
  [/\b(avalanche|avax)\b/i,          'AVAX/USD'],
  [/\b(chainlink|link)\b/i,          'LINK/USD'],
  [/\b(polkadot|dot)\b/i,            'DOT/USD'],
  [/\b(polygon|matic)\b/i,           'MATIC/USD'],
  [/\b(litecoin|ltc)\b/i,            'LTC/USD'],
  [/\b(thy|türk hava yollar[ıi]|turkish airlines|thyao)\b/i, 'THYAO'],
  [/\b(garanti ban|garan)\b/i,       'GARAN'],
  [/\b(akbank|akbnk)\b/i,            'AKBNK'],
  [/\b(i[sş] bankas[ıi]|isctr)\b/i,  'ISCTR'],
  [/\b(ere[gğ]li|eregl)\b/i,         'EREGL'],
  [/\b(bim market|bimas)\b/i,        'BIMAS'],
  [/\b(tüpra[sş]|tuprs)\b/i,         'TUPRS'],
  [/\b(koç holding|kchol)\b/i,       'KCHOL'],
  [/\b(sabancı|sahol)\b/i,           'SAHOL'],
  [/\b(şişe cam|sise)\b/i,           'SISE'],
  [/\b(turkcell|tcell)\b/i,          'TCELL'],
  [/\b(aselsan|asels)\b/i,           'ASELS'],
  [/\b(ford otosan|froto)\b/i,       'FROTO'],
  [/\b(tofaş|toaso)\b/i,             'TOASO'],
  [/\b(apple|aapl)\b/i,              'AAPL'],
  [/\b(microsoft|msft)\b/i,          'MSFT'],
  [/\b(google|alphabet|googl)\b/i,   'GOOGL'],
  [/\b(amazon|amzn)\b/i,             'AMZN'],
  [/\b(tesla|tsla)\b/i,              'TSLA'],
  [/\b(nvidia|nvda)\b/i,             'NVDA'],
  [/\b(meta|facebook)\b/i,           'META'],
  [/\b(netflix|nflx)\b/i,            'NFLX'],
  [/\b(jpmorgan|jpm)\b/i,            'JPM'],
  [/\b(goldman sachs|gs)\b/i,        'GS'],
  [/\b(intel|intc)\b/i,              'INTC'],
  [/\b(amd|advanced micro)\b/i,      'AMD'],
  [/\b(disney)\b/i,                  'DIS'],
  [/\b(visa)\b/i,                    'V'],
  [/\b(mastercard)\b/i,              'MA'],
  [/\b(coca.?cola|coke)\b/i,         'KO'],
  // ── Asian
  [/\b(xiaomi)\b/i,                  '1810.HK'],
  [/\b(samsung)\b/i,                 '005930.KS'],
  [/\b(toyota)\b/i,                  '7203.T'],
  [/\b(sony)\b/i,                    '6758.T'],
  [/\b(alibaba|baba)\b/i,            'BABA'],
  [/\b(tencent)\b/i,                 '0700.HK'],
  [/\b(baidu|bidu)\b/i,              'BIDU'],
  [/\b(tsmc|taiwan semi)\b/i,        'TSM'],
  // ── European
  [/\b(lvmh|louis vuitton)\b/i,      'MC.PA'],
  [/\b(volkswagen|vw)\b/i,           'VOW3.DE'],
  [/\b(bmw)\b/i,                     'BMW.DE'],
  [/\b(mercedes)\b/i,                'MBG.DE'],
  [/\b(sap)\b/i,                     'SAP.DE'],
  [/\b(hsbc)\b/i,                    'HSBA.L'],
  [/\b(shell)\b/i,                   'SHEL.L'],
  [/\b(asml)\b/i,                    'ASML'],
  [/\b(dolar|dollar|usd[\s/-]?try)\b/i, 'USD/TRY'],
  [/\b(eur[\s/-]?usd|euro dolar)\b/i,   'EUR/USD'],
  [/\b(eur[\s/-]?try|euro türk)\b/i,    'EUR/TRY'],
  [/\b(sterlin|gbp[\s/-]?usd)\b/i,      'GBP/USD'],
  [/\b(jpy|japon yeni|yen)\b/i,         'USD/JPY'],
  [/\b(gold|altın|xau)\b/i,             'XAU/USD'],
  [/\b(silver|gümüş|xag)\b/i,           'XAG/USD'],
  [/\b(oil|petrol|crude|wti|brent)\b/i, 'USOIL'],
  [/\b(bist\s*100|xu100|borsa istanbul)\b/i, 'BIST100'],
  [/\b(s&p\s*500|sp500|spx)\b/i,             'SPX'],
  [/\b(nasdaq|ndx)\b/i,                      'NDX'],
  [/\b(dow jones|dji|djia)\b/i,              'DJI'],
  [/\b(dax)\b/i,                             'DAX'],
]

function inferAssetCode(text) {
  for (const [pattern, code] of ASSET_PATTERNS) {
    if (pattern.test(text)) return code
  }
  return null
}

// ─── Quick-pick asset chips ───────────────────────────────────────────────────
const ASSET_SUGGESTIONS = [
  'BTC/USD', 'ETH/USD', 'THYAO', 'BIST100', 'USD/TRY',
  'SPX', 'XAU/USD', 'TSLA', 'AAPL', 'NVDA',
]

const QUESTION_TEMPLATES = [
  'What drove this move in {asset}?',
  'Why did {asset} move {direction} on {date}?',
  'What macro or news factors caused this {direction} move in {asset}?',
]

export default function NewEvent() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const [form, setForm] = useState({
    asset_code: '',
    event_date: new Date().toISOString().slice(0, 10),
    direction: 'down',
    magnitude: '',
    question: '',
  })

  const [detected, setDetected]       = useState(null)
  const [dismissed, setDismissed]     = useState(false)
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState(null)
  const [todayCount, setTodayCount]   = useState(null)

  // Load today's usage count on mount
  useEffect(() => {
    getTodayAnalysisCount().then(setTodayCount)
  }, [])

  // Live inference whenever question changes
  useEffect(() => {
    if (form.asset_code.trim()) {
      setDetected(null)
      return
    }
    setDismissed(false)
    const code = inferAssetCode(form.question)
    setDetected(code)
  }, [form.question, form.asset_code])

  function set(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function acceptDetected() {
    set('asset_code', detected)
    setDetected(null)
  }

  function fillTemplate(tpl) {
    const assetLabel = form.asset_code || (detected ?? 'the asset')
    const q = tpl
      .replace('{asset}', assetLabel)
      .replace('{direction}', form.direction)
      .replace('{date}', form.event_date)
    set('question', q)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)

    // Daily limit check
    if (todayCount !== null && todayCount >= DAILY_LIMIT) {
      return setError(t('newEvent.limitReached', { limit: DAILY_LIMIT }))
    }

    const resolvedAsset = form.asset_code.trim() || detected
    if (!resolvedAsset) {
      return setError(t('newEvent.errorMissing'))
    }
    if (!form.event_date) return setError(t('newEvent.errorMissing'))
    if (!form.question.trim()) return setError(t('newEvent.errorMissing'))

    setLoading(true)
    try {
      // Send asset_code only when explicitly set; backend infers otherwise
      const payload = {
        event_date: form.event_date,
        direction: form.direction,
        question: form.question.trim(),
      }
      if (form.asset_code.trim()) {
        payload.asset_code = form.asset_code.trim().toUpperCase()
      }

      const result = await callAskFinoracle(payload)

      navigate(`/events/${result.event.id}`, {
        state: {
          freshAnalysisId: result.analysis_id,
          inferredAsset: result.inferred_asset_code ?? null,
        },
      })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const resolvedAsset = form.asset_code.trim() || detected

  const limitReached = todayCount !== null && todayCount >= DAILY_LIMIT

  return (
    <div className="p-6 max-w-2xl">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-fin-text">{t('newEvent.title')}</h1>
          <p className="text-sm text-fin-muted mt-0.5">{t('newEvent.subtitle')}</p>
        </div>
        {todayCount !== null && (
          <div className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border shrink-0 ${
            limitReached
              ? 'border-fin-down/40 bg-fin-down/10 text-fin-down'
              : 'border-fin-border text-fin-muted'
          }`}>
            <Gauge size={13} />
            {t('newEvent.limitInfo', { used: todayCount, limit: DAILY_LIMIT })}
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Asset code */}
        <div>
          <label className="block text-xs font-medium text-fin-muted uppercase tracking-wide mb-1.5">
            Asset Code
            <span className="ml-1 normal-case font-normal text-fin-muted/60">(optional — inferred from question)</span>
          </label>
          <div className="relative">
            <input
              type="text"
              value={form.asset_code}
              onChange={(e) => set('asset_code', e.target.value.toUpperCase())}
              placeholder="e.g. BTC/USD, THYAO, USD/TRY"
              className="input-field w-full font-mono pr-10"
            />
            {form.asset_code && (
              <button
                type="button"
                onClick={() => set('asset_code', '')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-fin-muted hover:text-fin-text transition-colors"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Auto-detected badge */}
          {!form.asset_code && detected && !dismissed && (
            <div className="flex items-center gap-2 mt-2 p-2 rounded-lg bg-fin-accent/10 border border-fin-accent/30">
              <Zap size={13} className="text-fin-accent shrink-0" />
              <span className="text-xs text-fin-muted flex-1">
                Detected from question:
              </span>
              <button
                type="button"
                onClick={acceptDetected}
                className="px-2.5 py-0.5 rounded text-xs font-mono font-semibold bg-fin-accent/20 text-fin-accent hover:bg-fin-accent/30 transition-colors"
              >
                {detected}
              </button>
              <button
                type="button"
                onClick={() => setDismissed(true)}
                className="text-fin-muted/60 hover:text-fin-muted transition-colors"
              >
                <X size={12} />
              </button>
            </div>
          )}

          {/* Quick-pick chips */}
          <div className="flex flex-wrap gap-1.5 mt-2">
            {ASSET_SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => set('asset_code', s)}
                className={`px-2.5 py-0.5 rounded text-xs font-mono transition-colors ${
                  form.asset_code === s
                    ? 'bg-fin-accent/20 text-fin-accent border border-fin-accent/40'
                    : 'bg-fin-border/40 text-fin-muted hover:text-fin-text hover:bg-fin-border'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Date + Direction + Magnitude */}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-fin-muted uppercase tracking-wide mb-1.5">
              Event Date
            </label>
            <input
              type="date"
              value={form.event_date}
              onChange={(e) => set('event_date', e.target.value)}
              className="input-field w-full text-sm"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-fin-muted uppercase tracking-wide mb-1.5">
              Direction
            </label>
            <div className="flex gap-2">
              {['up', 'down'].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => set('direction', d)}
                  className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition-colors ${
                    form.direction === d
                      ? d === 'up'
                        ? 'bg-fin-up/20 border-fin-up text-fin-up'
                        : 'bg-fin-down/20 border-fin-down text-fin-down'
                      : 'border-fin-border text-fin-muted hover:border-fin-muted'
                  }`}
                >
                  {d === 'up' ? '▲ UP' : '▼ DOWN'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-fin-muted uppercase tracking-wide mb-1.5">
              Magnitude % <span className="normal-case">(optional)</span>
            </label>
            <input
              type="number"
              step="0.01"
              value={form.magnitude}
              onChange={(e) => set('magnitude', e.target.value)}
              placeholder="e.g. -3.5"
              className="input-field w-full text-sm font-mono"
            />
          </div>
        </div>

        {/* Question */}
        <div>
          <label className="block text-xs font-medium text-fin-muted uppercase tracking-wide mb-1.5">
            Analysis Question
          </label>
          <textarea
            value={form.question}
            onChange={(e) => set('question', e.target.value)}
            placeholder="e.g. Why did Turkish Airlines stock rise on March 20 2026?"
            rows={3}
            className="input-field w-full text-sm resize-none"
            required
          />
          <div className="mt-2 space-y-1">
            <p className="text-xs text-fin-muted">Quick templates:</p>
            <div className="flex flex-col gap-1">
              {QUESTION_TEMPLATES.map((tpl) => (
                <button
                  key={tpl}
                  type="button"
                  onClick={() => fillTemplate(tpl)}
                  className="text-left text-xs text-fin-muted/70 hover:text-fin-accent transition-colors truncate"
                >
                  → {tpl
                      .replace('{asset}', resolvedAsset ?? 'the asset')
                      .replace('{direction}', form.direction)
                      .replace('{date}', form.event_date)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-fin-down/10 border border-fin-down/30 text-fin-down text-sm">
            <AlertCircle size={15} className="shrink-0" />
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || limitReached}
          className="btn-primary w-full flex items-center justify-center gap-2 py-3 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <Sparkles size={16} className="animate-pulse" />
              {t('newEvent.analysing')}
            </>
          ) : (
            <>
              <Sparkles size={16} />
              {t('newEvent.submit')}
              {resolvedAsset && (
                <span className="ml-1 px-2 py-0.5 rounded font-mono text-xs bg-white/10">
                  {resolvedAsset}
                </span>
              )}
              <ChevronRight size={15} />
            </>
          )}
        </button>

        {loading && (
          <p className="text-xs text-center text-fin-muted animate-pulse">
            Retrieving sources and generating analysis — this may take 10–25 seconds…
          </p>
        )}
      </form>
    </div>
  )
}
