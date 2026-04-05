import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import { Activity, Clock, BarChart2, Star, ChevronRight, TrendingUp, Sparkles } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import StatCard from '../components/StatCard'
import StatusBadge from '../components/StatusBadge'
import DirectionBadge from '../components/DirectionBadge'
import ConfidenceBar from '../components/ConfidenceBar'
import { getEventStats, getRecentEvents } from '../services/eventService'
import { getTopSourceLabel } from '../services/credibilityService'
import { getConfidenceTrend, getAssetDistribution } from '../services/analysisService'

const BAR_COLORS = ['#6366f1','#8b5cf6','#a78bfa','#c4b5fd','#818cf8','#7c3aed','#4f46e5','#4338ca']

export default function Dashboard() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const [stats, setStats]           = useState(null)
  const [events, setEvents]         = useState([])
  const [topSource, setTopSource]   = useState(null)
  const [trendData, setTrendData]   = useState([])
  const [assetData, setAssetData]   = useState([])
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    try {
      const [s, ev, src, trend, assets] = await Promise.all([
        getEventStats(),
        getRecentEvents(10),
        getTopSourceLabel(),
        getConfidenceTrend(30),
        getAssetDistribution(),
      ])
      setStats(s)
      setEvents(ev)
      setTopSource(src)
      setTrendData(trend)
      setAssetData(assets)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-fin-text">{t('dashboard.title')}</h1>
        <p className="text-sm text-fin-muted mt-0.5">{t('dashboard.subtitle')}</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 md:gap-4">
        <StatCard
          label={t('dashboard.totalEvents')}
          value={loading ? '—' : (stats?.totalEvents ?? 0)}
          icon={Activity}
          accent
        />
        <StatCard
          label={t('dashboard.pendingVerification')}
          value={loading ? '—' : (stats?.pendingVerification ?? 0)}
          sub={t('dashboard.awaiting')}
          icon={Clock}
        />
        <StatCard
          label={t('dashboard.avgConfidence')}
          value={loading ? '—' : `${Math.round((stats?.avgConfidence ?? 0) * 100)}%`}
          sub={t('dashboard.acrossAll')}
          icon={BarChart2}
        />
        <StatCard
          label={t('dashboard.topSource')}
          value={loading || !topSource ? '—' : topSource.label}
          sub={topSource ? `${t('common.score')}: ${(topSource.score * 100).toFixed(0)}%` : undefined}
          icon={Star}
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* Confidence trend */}
        <div className="glass-panel p-5">
          <h2 className="text-sm font-semibold text-fin-text mb-4">{t('dashboard.confidenceTrend')}</h2>
          {loading || trendData.length === 0 ? (
            <div className="flex items-center justify-center h-36 text-fin-muted text-sm">
              {loading ? t('common.loading') : '—'}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={trendData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis
                  dataKey="date"
                  tick={{ fill: '#6b7280', fontSize: 10 }}
                  tickFormatter={(v) => {
                    try { return format(parseISO(v), 'MMM d') } catch { return v }
                  }}
                />
                <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} domain={[0, 100]} unit="%" />
                <Tooltip
                  contentStyle={{ background: '#1e2030', border: '1px solid #2d3148', borderRadius: 8, fontSize: 12 }}
                  labelFormatter={(v) => { try { return format(parseISO(v), 'MMM d, yyyy') } catch { return v } }}
                  formatter={(v) => [`${v}%`, t('dashboard.confidence')]}
                />
                <Line
                  type="monotone"
                  dataKey="confidence"
                  stroke="#6366f1"
                  strokeWidth={2}
                  dot={{ r: 3, fill: '#6366f1' }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Asset breakdown */}
        <div className="glass-panel p-5">
          <h2 className="text-sm font-semibold text-fin-text mb-4">{t('dashboard.assetBreakdown')}</h2>
          {loading || assetData.length === 0 ? (
            <div className="flex items-center justify-center h-36 text-fin-muted text-sm">
              {loading ? t('common.loading') : '—'}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={assetData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="asset" tick={{ fill: '#6b7280', fontSize: 10 }} />
                <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ background: '#1e2030', border: '1px solid #2d3148', borderRadius: 8, fontSize: 12 }}
                  formatter={(v) => [v, t('dashboard.analysesPerDay')]}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {assetData.map((_, i) => (
                    <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Recent events table */}
      <div className="glass-panel overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-fin-border">
          <h2 className="text-sm font-semibold text-fin-text">{t('dashboard.recentEvents')}</h2>
          <button onClick={() => navigate('/events')} className="text-xs text-fin-accent hover:underline">
            {t('dashboard.viewAll')}
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12 text-fin-muted text-sm">
            {t('common.loading')}
          </div>
        ) : events.length === 0 ? (
          <div className="p-8 flex flex-col items-center text-center gap-4">
            <div className="w-12 h-12 rounded-full bg-fin-accent/15 flex items-center justify-center">
              <TrendingUp size={22} className="text-fin-accent" />
            </div>
            <div>
              <p className="text-fin-text font-semibold mb-1">{t('dashboard.welcomeTitle')}</p>
              <p className="text-sm text-fin-muted max-w-sm leading-relaxed">{t('dashboard.welcomeDesc')}</p>
            </div>
            <div className="text-left w-full max-w-xs space-y-2 text-xs text-fin-muted">
              {[
                t('dashboard.welcomeStep1'),
                t('dashboard.welcomeStep2'),
                t('dashboard.welcomeStep3'),
              ].map((step, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="w-4 h-4 rounded-full bg-fin-accent/20 text-fin-accent text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  {step}
                </div>
              ))}
            </div>
            <button
              onClick={() => navigate('/new-event')}
              className="btn-primary flex items-center gap-2 text-sm mt-1"
            >
              <Sparkles size={15} />
              {t('dashboard.welcomeCta')}
            </button>
          </div>
        ) : (
          <>
            {/* ── Mobile cards (hidden on sm+) ─────────────────── */}
            <div className="sm:hidden divide-y divide-fin-border/30">
              {events.map((ev) => {
                const analyses = ev.analysis_results ?? []
                const latest   = analyses[analyses.length - 1] ?? null
                return (
                  <div
                    key={ev.id}
                    onClick={() => navigate(`/events/${ev.id}`)}
                    className="p-4 flex items-center justify-between gap-3 cursor-pointer active:bg-fin-border/10 transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-fin-text">{ev.asset_code}</span>
                          <DirectionBadge direction={ev.direction} />
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-fin-muted font-mono">
                            {format(new Date(ev.event_date), 'dd MMM yyyy')}
                          </span>
                          {ev.magnitude != null && (
                            <span className="text-xs text-fin-muted font-mono">
                              {ev.magnitude > 0 ? '+' : ''}{ev.magnitude}%
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {latest
                        ? <StatusBadge status={latest.status} />
                        : <span className="text-xs text-fin-muted/60 italic">{t('dashboard.noAnalysis')}</span>
                      }
                      <ChevronRight size={14} className="text-fin-muted/40" />
                    </div>
                  </div>
                )
              })}
            </div>

            {/* ── Desktop table (hidden on mobile) ─────────────── */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-fin-border/60">
                    {[
                      t('events.asset'), t('events.date'), t('events.direction'),
                      t('events.magnitude'), t('events.status'), t('events.confidence'), '',
                    ].map((h) => (
                      <th key={h} className="px-5 py-3 text-left text-xs text-fin-muted font-medium uppercase tracking-wide">
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
                        <td className="px-5 py-3 font-mono font-semibold text-fin-text">{ev.asset_code}</td>
                        <td className="px-5 py-3 text-fin-muted font-mono text-xs">
                          {format(new Date(ev.event_date), 'dd MMM yyyy')}
                        </td>
                        <td className="px-5 py-3"><DirectionBadge direction={ev.direction} /></td>
                        <td className="px-5 py-3 text-fin-muted font-mono text-xs">
                          {ev.magnitude != null ? `${ev.magnitude > 0 ? '+' : ''}${ev.magnitude}%` : '—'}
                        </td>
                        <td className="px-5 py-3">
                          {latest
                            ? <StatusBadge status={latest.status} />
                            : <span className="text-xs text-fin-muted/60 italic">{t('dashboard.noAnalysis')}</span>
                          }
                        </td>
                        <td className="px-5 py-3 w-36">
                          {latest ? <ConfidenceBar value={latest.confidence} /> : '—'}
                        </td>
                        <td className="px-5 py-3 text-right">
                          <span className="text-xs text-fin-accent">{t('common.view')}</span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
