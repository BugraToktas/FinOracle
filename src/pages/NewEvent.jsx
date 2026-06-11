import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Sparkles, AlertCircle, ChevronRight, Zap, X, Gauge, PlusCircle } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import PageShell from '../components/PageShell'
import { callAskFinoracle, getTodayAnalysisCount } from '../services/analysisService'

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
  const { dailyLimit } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const prefill   = location.state?.prefill ?? null

  const [form, setForm] = useState({
    asset_code: prefill?.asset_code ?? '',
    event_date: prefill?.event_date ?? new Date().toISOString().slice(0, 10),
    direction:  prefill?.direction  ?? 'down',
    magnitude: '',
    question: prefill?.question ?? '',
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
    if (loading) return
    setError(null)

    // Daily limit check
    if (todayCount !== null && todayCount >= dailyLimit) {
      return setError(t('newEvent.limitReached', { limit: dailyLimit }))
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

  const limitReached = todayCount !== null && todayCount >= dailyLimit

  return (
    <PageShell maxWidth="max-w-5xl" className="flex flex-col items-center">
      <div className="analysis-page w-full">
        {/* Hero — centered, not left-stuck */}
        <header className="analysis-hero mb-6 md:mb-8">
          <div className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-fin-accent/15 text-fin-accent mb-4">
            <PlusCircle size={22} />
          </div>
          <h1 className="text-2xl md:text-[1.75rem] font-bold text-fin-text tracking-tight">
            {t('newEvent.title')}
          </h1>
          <p className="text-base text-fin-muted mt-2 max-w-md mx-auto leading-relaxed">
            {t('newEvent.subtitle')}
          </p>
          {todayCount !== null && (
            <div
              className={`inline-flex items-center gap-1.5 text-sm px-3.5 py-1.5 rounded-full border mt-4 transition-colors duration-200 ${
                limitReached
                  ? 'border-fin-down/40 bg-fin-down/10 text-fin-down'
                  : 'border-fin-border/80 bg-fin-card/60 text-fin-muted'
              }`}
            >
              <Gauge size={13} />
              {t('newEvent.limitInfo', { used: todayCount, limit: dailyLimit })}
            </div>
          )}
        </header>

        <form onSubmit={handleSubmit} className="analysis-form-card w-full">
          {/* 1 — Question */}
          <section className="analysis-section analysis-section-primary">
            <label className="analysis-field-label" htmlFor="analysis-question">
              {t('newEvent.questionLabel')}
            </label>
            <textarea
              id="analysis-question"
              value={form.question}
              onChange={(e) => set('question', e.target.value)}
              placeholder="e.g. Why did Turkish Airlines stock rise on March 20 2026?"
              rows={5}
              className="input-field w-full analysis-question-input"
              required
            />
            <p className="text-xs text-fin-muted mt-4 mb-2">{t('newEvent.quickTemplates')}</p>
            <div className="grid gap-1.5 sm:grid-cols-1">
              {QUESTION_TEMPLATES.map((tpl) => (
                <button
                  key={tpl}
                  type="button"
                  onClick={() => fillTemplate(tpl)}
                  className="analysis-template-btn"
                >
                  {tpl
                    .replace('{asset}', resolvedAsset ?? 'the asset')
                    .replace('{direction}', form.direction)
                    .replace('{date}', form.event_date)}
                </button>
              ))}
            </div>
          </section>

          {/* 2 — Asset */}
          <section className="analysis-section">
            <label className="analysis-field-label" htmlFor="analysis-asset">
              {t('newEvent.assetCode')}
              <span className="ml-1 normal-case font-normal text-fin-muted/55 tracking-normal">
                {t('newEvent.assetCodeOptional')}
              </span>
            </label>
            <div className="relative">
              <input
                id="analysis-asset"
                type="text"
                value={form.asset_code}
                onChange={(e) => set('asset_code', e.target.value.toUpperCase())}
                placeholder="e.g. BTC/USD, THYAO, USD/TRY"
                className="input-field w-full font-mono text-sm pr-10"
              />
              {form.asset_code && (
                <button
                  type="button"
                  onClick={() => set('asset_code', '')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-fin-muted hover:text-fin-text transition-colors p-1 rounded"
                  aria-label="Clear asset"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {!form.asset_code && detected && !dismissed && (
              <div className="flex items-center gap-2 mt-3 p-3 rounded-lg bg-fin-accent/10 border border-fin-accent/30 animate-fade-in-up">
                <Zap size={14} className="text-fin-accent shrink-0" />
                <span className="text-xs text-fin-muted flex-1 leading-snug">
                  {t('newEvent.detected')}
                </span>
                <button
                  type="button"
                  onClick={acceptDetected}
                  className="px-3 py-1 rounded-md text-xs font-mono font-semibold bg-fin-accent/20 text-fin-accent hover:bg-fin-accent/30 transition-colors"
                >
                  {detected}
                </button>
                <button
                  type="button"
                  onClick={() => setDismissed(true)}
                  className="text-fin-muted/60 hover:text-fin-muted transition-colors p-1"
                >
                  <X size={14} />
                </button>
              </div>
            )}

            <div className="flex flex-wrap gap-2 mt-3 justify-center sm:justify-start">
              {ASSET_SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => set('asset_code', s)}
                  className={`chip ${form.asset_code === s ? 'chip-active' : 'chip-inactive'}`}
                >
                  {s}
                </button>
              ))}
            </div>
          </section>

          {/* 3 — Event context */}
          <section className="analysis-section">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
              <div className="md:col-span-6">
                <label className="analysis-field-label" htmlFor="analysis-date">
                  {t('newEvent.eventDate')}
                </label>

                {/* Quick-pick preset buttons */}
                <div className="grid grid-cols-3 sm:grid-cols-6 md:grid-cols-3 xl:grid-cols-6 gap-2 mb-3">
                  {[
                    { label: t('newEvent.dateYesterday') || 'Dün',         days: 1  },
                    { label: t('newEvent.date1Week')     || '1 Hafta',      days: 7  },
                    { label: t('newEvent.date1Month')    || '1 Ay',         days: 30 },
                    { label: t('newEvent.date3Months')   || '3 Ay',         days: 90 },
                    { label: t('newEvent.date6Months')   || '6 Ay',         days: 180 },
                    { label: t('newEvent.date1Year')     || '1 Yıl',        days: 365 },
                  ].map(({ label, days }) => {
                    const d = new Date()
                    d.setDate(d.getDate() - days)
                    const val = d.toISOString().slice(0, 10)
                    return (
                      <button
                        key={days}
                        type="button"
                        onClick={() => set('event_date', val)}
                        className={`min-h-[2.5rem] px-2 flex items-center justify-center rounded-lg text-sm font-semibold border transition-all duration-200 ${
                          form.event_date === val
                            ? 'bg-fin-accent/20 border-fin-accent text-fin-accent shadow-sm shadow-fin-accent/10'
                            : 'border-fin-border text-fin-muted hover:border-fin-muted/80 hover:text-fin-text hover:bg-fin-border/20'
                        }`}
                      >
                        {label}
                      </button>
                    )
                  })}
                </div>

                <input
                  id="analysis-date"
                  type="date"
                  value={form.event_date}
                  max={new Date().toISOString().slice(0, 10)}
                  onChange={(e) => set('event_date', e.target.value)}
                  className="input-field w-full text-sm min-h-[2.5rem]"
                  required
                />

                {/* Human-readable date label */}
                {form.event_date && (() => {
                  const sel = new Date(form.event_date)
                  const today = new Date(); today.setHours(0,0,0,0)
                  const diffDays = Math.round((today - sel) / 86400000)
                  const rel = diffDays === 0 ? (t('newEvent.dateToday') || 'Bugün')
                    : diffDays === 1 ? (t('newEvent.dateYesterday') || 'Dün')
                    : diffDays < 7  ? `${diffDays} ${t('newEvent.dateDaysAgo') || 'gün önce'}`
                    : diffDays < 31 ? `${Math.round(diffDays/7)} ${t('newEvent.dateWeeksAgo') || 'hafta önce'}`
                    : diffDays < 365 ? `${Math.round(diffDays/30)} ${t('newEvent.dateMonthsAgo') || 'ay önce'}`
                    : `${Math.round(diffDays/365)} ${t('newEvent.dateYearsAgo') || 'yıl önce'}`
                  return (
                    <p className="text-xs text-fin-muted mt-2 font-mono">
                      {sel.toLocaleDateString(undefined, { day:'numeric', month:'short', year:'numeric' })}
                      <span className="ml-2 text-fin-accent/70">— {rel}</span>
                    </p>
                  )
                })()}
              </div>


              <div className="md:col-span-3">
                <span className="analysis-field-label block">{t('newEvent.direction')}</span>
                <div className="flex gap-2">
                  {['up', 'down'].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => set('direction', d)}
                      className={`flex-1 min-h-[2.5rem] rounded-lg text-sm font-semibold border transition-all duration-200 ${
                        form.direction === d
                          ? d === 'up'
                            ? 'bg-fin-up/20 border-fin-up text-fin-up shadow-sm shadow-fin-up/10'
                            : 'bg-fin-down/20 border-fin-down text-fin-down shadow-sm shadow-fin-down/10'
                          : 'border-fin-border text-fin-muted hover:border-fin-muted/80 hover:bg-fin-border/20'
                      }`}
                    >
                      {d === 'up' ? t('newEvent.dirUp') : t('newEvent.dirDown')}
                    </button>
                  ))}
                </div>
              </div>

              <div className="md:col-span-3">
                <label className="analysis-field-label" htmlFor="analysis-magnitude">
                  {t('newEvent.magnitude')}{' '}
                  <span className="normal-case font-normal tracking-normal text-fin-muted/55">
                    {t('newEvent.magnitudeOptional')}
                  </span>
                </label>
                <input
                  id="analysis-magnitude"
                  type="number"
                  step="0.1"
                  value={form.magnitude}
                  onChange={(e) => set('magnitude', e.target.value)}
                  placeholder={t('newEvent.magnitudePlaceholder')}
                  className="input-field w-full text-sm min-h-[2.5rem]"
                />
              </div>
            </div>
          </section>

          {/* Submit */}
          <section className="analysis-submit-section">
            {error && (
              <div className="alert-banner alert-error mb-4">
                <AlertCircle size={15} className="shrink-0" />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || limitReached}
              className="btn-primary w-full flex items-center justify-center gap-2 py-3.5 text-base rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Sparkles size={18} className="animate-pulse" />
                  {t('newEvent.analysing')}
                </>
              ) : (
                <>
                  <Sparkles size={18} />
                  {t('newEvent.submit')}
                  {resolvedAsset && (
                    <span className="ml-1 px-2.5 py-0.5 rounded-md font-mono text-xs bg-white/15">
                      {resolvedAsset}
                    </span>
                  )}
                  <ChevronRight size={16} />
                </>
              )}
            </button>

            {loading && (
              <p className="text-xs text-center text-fin-muted mt-3 animate-pulse leading-relaxed">
                {t('newEvent.analysingHint')}
              </p>
            )}
          </section>
        </form>
      </div>
    </PageShell>
  )
}
