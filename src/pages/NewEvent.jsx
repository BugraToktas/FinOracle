import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sparkles, AlertCircle, ChevronRight } from 'lucide-react'
import { callAskFinoracle } from '../services/analysisService'

const ASSET_SUGGESTIONS = ['BIST100', 'BTC', 'ETH', 'XAUUSD', 'SPX', 'EURUSD', 'TSLA', 'AAPL']

const QUESTION_TEMPLATES = [
  'What drove this move in {asset}?',
  'Why did {asset} move {direction} on {date}?',
  'What macro or news factors caused this {direction} move in {asset}?',
]

export default function NewEvent() {
  const navigate = useNavigate()

  const [form, setForm] = useState({
    asset_code: '',
    event_date: new Date().toISOString().slice(0, 10),
    direction: 'down',
    magnitude: '',
    question: '',
  })

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  function set(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function fillTemplate(tpl) {
    const q = tpl
      .replace('{asset}', form.asset_code || 'the asset')
      .replace('{direction}', form.direction)
      .replace('{date}', form.event_date)
    set('question', q)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)

    if (!form.asset_code.trim()) return setError('Asset code is required.')
    if (!form.event_date) return setError('Event date is required.')
    if (!form.question.trim()) return setError('Question is required.')

    setLoading(true)
    try {
      const result = await callAskFinoracle({
        asset_code: form.asset_code.trim().toUpperCase(),
        event_date: form.event_date,
        direction: form.direction,
        question: form.question.trim(),
      })

      navigate(`/events/${result.event.id}`, {
        state: { freshAnalysisId: result.analysis_id },
      })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-fin-text">New Market Event</h1>
        <p className="text-sm text-fin-muted mt-0.5">
          Submit an event to retrieve sources and generate an AI-powered analysis.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Asset code */}
        <div>
          <label className="block text-xs font-medium text-fin-muted uppercase tracking-wide mb-1.5">
            Asset Code
          </label>
          <input
            type="text"
            value={form.asset_code}
            onChange={(e) => set('asset_code', e.target.value.toUpperCase())}
            placeholder="e.g. BTC, BIST100, SPX"
            className="input-field w-full font-mono"
            required
          />
          <div className="flex flex-wrap gap-1.5 mt-2">
            {ASSET_SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => set('asset_code', s)}
                className="px-2.5 py-0.5 rounded text-xs font-mono bg-fin-border/40 text-fin-muted hover:text-fin-text hover:bg-fin-border transition-colors"
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
            placeholder="What caused this market move?"
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
                  → {tpl}
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
          disabled={loading}
          className="btn-primary w-full flex items-center justify-center gap-2 py-3"
        >
          {loading ? (
            <>
              <Sparkles size={16} className="animate-pulse" />
              Running AI analysis…
            </>
          ) : (
            <>
              <Sparkles size={16} />
              Analyze Event
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
