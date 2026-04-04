import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Search, Filter, PlusCircle } from 'lucide-react'
import { format } from 'date-fns'
import StatusBadge from '../components/StatusBadge'
import DirectionBadge from '../components/DirectionBadge'
import ConfidenceBar from '../components/ConfidenceBar'
import { getAllEvents } from '../services/eventService'

export default function Events() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [filters, setFilters] = useState({
    assetCode: '',
    direction: '',
    status: '',
    from: '',
    to: '',
  })

  const STATUS_OPTIONS = [
    { value: '', label: t('events.allStatuses') },
    { value: 'pending',  label: t('events.statusPending')  },
    { value: 'verified', label: t('events.statusVerified') },
    { value: 'failed',   label: t('events.statusFailed')   },
  ]

  const DIRECTION_OPTIONS = [
    { value: '', label: t('events.allDirections') },
    { value: 'up',   label: t('events.dirUp')   },
    { value: 'down', label: t('events.dirDown') },
  ]

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getAllEvents(filters)
      setEvents(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => { load() }, [load])

  function setFilter(key, value) {
    setFilters((prev) => ({ ...prev, [key]: value }))
  }

  const hasFilters = filters.assetCode || filters.direction || filters.status || filters.from || filters.to

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-fin-text">{t('events.title')}</h1>
          <p className="text-sm text-fin-muted mt-0.5">
            {loading
              ? t('common.loading')
              : t('events.subtitleCount_other', { count: events.length })}
          </p>
        </div>
        <button
          onClick={() => navigate('/new-event')}
          className="btn-primary flex items-center gap-2 text-sm"
        >
          <PlusCircle size={15} />
          {t('events.newEvent')}
        </button>
      </div>

      {/* Filters */}
      <div className="glass-panel p-4">
        <div className="flex items-center gap-2 mb-3 text-xs text-fin-muted font-medium uppercase tracking-wide">
          <Filter size={12} />
          {t('events.filters')}
        </div>
        <div className="flex flex-wrap gap-3">
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-fin-muted pointer-events-none" />
            <input
              type="text"
              placeholder={t('events.filterAsset')}
              value={filters.assetCode}
              onChange={(e) => setFilter('assetCode', e.target.value)}
              className="input-field pl-8 text-sm h-9 w-36"
            />
          </div>

          <select
            value={filters.direction}
            onChange={(e) => setFilter('direction', e.target.value)}
            className="input-field text-sm h-9 pr-8"
          >
            {DIRECTION_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>

          <select
            value={filters.status}
            onChange={(e) => setFilter('status', e.target.value)}
            className="input-field text-sm h-9 pr-8"
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>

          <input
            type="date"
            value={filters.from}
            onChange={(e) => setFilter('from', e.target.value)}
            className="input-field text-sm h-9"
            title={t('events.filterFrom')}
          />
          <input
            type="date"
            value={filters.to}
            onChange={(e) => setFilter('to', e.target.value)}
            className="input-field text-sm h-9"
            title={t('events.filterTo')}
          />

          {hasFilters && (
            <button
              onClick={() => setFilters({ assetCode: '', direction: '', status: '', from: '', to: '' })}
              className="btn-secondary text-xs h-9 px-3"
            >
              {t('events.clear')}
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="glass-panel overflow-hidden">
        {error ? (
          <div className="p-6 text-fin-down text-sm">{error}</div>
        ) : loading ? (
          <div className="flex items-center justify-center py-16 text-fin-muted text-sm">
            {t('common.loading')}
          </div>
        ) : events.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <p className="text-fin-muted text-sm">{t('events.noEvents')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-fin-border/60">
                  {[
                    t('events.asset'),
                    t('events.date'),
                    t('events.direction'),
                    t('events.magnitude'),
                    t('events.analyses'),
                    t('events.latestStatus'),
                    t('events.confidence'),
                    '',
                  ].map((h) => (
                    <th key={h} className="px-5 py-3 text-left text-xs text-fin-muted font-medium uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {events.map((ev) => {
                  const analyses = ev.analysis_results ?? []
                  const latest   = analyses[analyses.length - 1] ?? null
                  return (
                    <tr
                      key={ev.id}
                      onClick={() => navigate(`/events/${ev.id}`)}
                      className="border-b border-fin-border/30 hover:bg-fin-border/10 cursor-pointer transition-colors"
                    >
                      <td className="px-5 py-3 font-mono font-semibold text-fin-text">
                        {ev.asset_code}
                      </td>
                      <td className="px-5 py-3 text-fin-muted font-mono text-xs whitespace-nowrap">
                        {format(new Date(ev.event_date), 'dd MMM yyyy')}
                      </td>
                      <td className="px-5 py-3">
                        <DirectionBadge direction={ev.direction} />
                      </td>
                      <td className="px-5 py-3 text-fin-muted font-mono text-xs">
                        {ev.magnitude != null
                          ? `${ev.magnitude > 0 ? '+' : ''}${ev.magnitude}%`
                          : '—'}
                      </td>
                      <td className="px-5 py-3 text-fin-muted text-xs">
                        {analyses.length}
                      </td>
                      <td className="px-5 py-3">
                        {latest
                          ? <StatusBadge status={latest.status} />
                          : <span className="text-xs text-fin-muted/50 italic">{t('events.none')}</span>
                        }
                      </td>
                      <td className="px-5 py-3 w-32">
                        {latest ? <ConfidenceBar value={latest.confidence} /> : '—'}
                      </td>
                      <td className="px-5 py-3 text-right whitespace-nowrap">
                        <span className="text-xs text-fin-accent">{t('common.view')}</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
