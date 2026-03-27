import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Activity, Clock, BarChart2, Star, RefreshCw } from 'lucide-react'
import { format } from 'date-fns'
import StatCard from '../components/StatCard'
import StatusBadge from '../components/StatusBadge'
import DirectionBadge from '../components/DirectionBadge'
import ConfidenceBar from '../components/ConfidenceBar'
import { getEventStats, getRecentEvents } from '../services/eventService'
import { getTopSourceLabel } from '../services/credibilityService'
import { callRunVerificationQueue } from '../services/analysisService'

export default function Dashboard() {
  const navigate = useNavigate()
  const [stats, setStats] = useState(null)
  const [events, setEvents] = useState([])
  const [topSource, setTopSource] = useState(null)
  const [loading, setLoading] = useState(true)
  const [queueRunning, setQueueRunning] = useState(false)
  const [queueResult, setQueueResult] = useState(null)

  async function load() {
    setLoading(true)
    try {
      const [s, ev, src] = await Promise.all([
        getEventStats(),
        getRecentEvents(10),
        getTopSourceLabel(),
      ])
      setStats(s)
      setEvents(ev)
      setTopSource(src)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function handleRunQueue() {
    setQueueRunning(true)
    setQueueResult(null)
    try {
      const res = await callRunVerificationQueue()
      setQueueResult({ ok: true, processed: res?.processed ?? 0 })
      load()
    } catch (err) {
      setQueueResult({ ok: false, error: err.message })
    } finally {
      setQueueRunning(false)
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-fin-text">Dashboard</h1>
          <p className="text-sm text-fin-muted mt-0.5">Market event analysis overview</p>
        </div>
        <div className="flex items-center gap-3">
          {queueResult && (
            <span className={`text-xs ${queueResult.ok ? 'text-fin-up' : 'text-fin-down'}`}>
              {queueResult.ok
                ? `Queue ran — ${queueResult.processed} processed`
                : `Queue error: ${queueResult.error}`}
            </span>
          )}
          <button
            onClick={handleRunQueue}
            disabled={queueRunning}
            className="btn-secondary flex items-center gap-2 text-sm"
          >
            <RefreshCw size={14} className={queueRunning ? 'animate-spin' : ''} />
            Run Verification Queue
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label="Total Events"
          value={loading ? '—' : (stats?.totalEvents ?? 0)}
          icon={Activity}
          accent
        />
        <StatCard
          label="Pending Verification"
          value={loading ? '—' : (stats?.pendingVerification ?? 0)}
          sub="awaiting recheck"
          icon={Clock}
        />
        <StatCard
          label="Avg Confidence"
          value={loading ? '—' : `${Math.round((stats?.avgConfidence ?? 0) * 100)}%`}
          sub="across all analyses"
          icon={BarChart2}
        />
        <StatCard
          label="Top Source"
          value={loading || !topSource ? '—' : topSource.label}
          sub={topSource ? `Score: ${(topSource.score * 100).toFixed(0)}%` : undefined}
          icon={Star}
        />
      </div>

      {/* Recent events table */}
      <div className="glass-panel overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-fin-border">
          <h2 className="text-sm font-semibold text-fin-text">Recent Events</h2>
          <button
            onClick={() => navigate('/events')}
            className="text-xs text-fin-accent hover:underline"
          >
            View all
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12 text-fin-muted text-sm">
            Loading…
          </div>
        ) : events.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <p className="text-fin-muted text-sm">No events yet.</p>
            <button onClick={() => navigate('/new-event')} className="btn-primary text-sm">
              Add first event
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-fin-border/60">
                  {['Asset', 'Date', 'Direction', 'Magnitude', 'Status', 'Confidence', ''].map((h) => (
                    <th key={h} className="px-5 py-3 text-left text-xs text-fin-muted font-medium uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {events.map((ev) => {
                  const analyses = ev.analysis_results ?? []
                  const latest = analyses[analyses.length - 1] ?? null
                  return (
                    <tr
                      key={ev.id}
                      onClick={() => navigate(`/events/${ev.id}`)}
                      className="border-b border-fin-border/30 hover:bg-fin-border/10 cursor-pointer transition-colors"
                    >
                      <td className="px-5 py-3 font-mono font-semibold text-fin-text">
                        {ev.asset_code}
                      </td>
                      <td className="px-5 py-3 text-fin-muted font-mono text-xs">
                        {format(new Date(ev.event_date), 'dd MMM yyyy')}
                      </td>
                      <td className="px-5 py-3">
                        <DirectionBadge direction={ev.direction} />
                      </td>
                      <td className="px-5 py-3 text-fin-muted font-mono text-xs">
                        {ev.magnitude != null ? `${ev.magnitude > 0 ? '+' : ''}${ev.magnitude}%` : '—'}
                      </td>
                      <td className="px-5 py-3">
                        {latest ? <StatusBadge status={latest.status} /> : (
                          <span className="text-xs text-fin-muted/60 italic">no analysis</span>
                        )}
                      </td>
                      <td className="px-5 py-3 w-36">
                        {latest ? <ConfidenceBar value={latest.confidence} /> : '—'}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <span className="text-xs text-fin-accent">View →</span>
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
