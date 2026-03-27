import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell
} from 'recharts'
import { ShieldCheck, RefreshCw } from 'lucide-react'
import { getAllSources } from '../services/credibilityService'

function scoreColor(score) {
  if (score >= 0.7) return '#10b981'   // fin-up green
  if (score >= 0.4) return '#f59e0b'   // amber
  return '#ef4444'                     // fin-down red
}

function ScoreBar({ score }) {
  const pct = Math.round((score ?? 0) * 100)
  return (
    <div className="flex items-center gap-2">
      <div className="w-20 h-1.5 bg-fin-border rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: scoreColor(score) }}
        />
      </div>
      <span className="text-xs font-mono" style={{ color: scoreColor(score) }}>
        {pct}%
      </span>
    </div>
  )
}

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="glass-panel p-3 text-xs">
      <p className="text-fin-text font-semibold">{d.name}</p>
      <p className="text-fin-muted mt-0.5">Score: {Math.round(d.score * 100)}%</p>
      <p className="text-fin-muted">Predictions: {d.total} (correct: {d.correct})</p>
    </div>
  )
}

export default function CredibilityBoard() {
  const [sources, setSources] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const data = await getAllSources()
      setSources(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const chartData = sources.slice(0, 10).map((s) => ({
    name: [s.organization, s.author_name].filter(Boolean).join(' / ').slice(0, 28),
    score: s.reputation_score ?? 0,
    total: s.total_predictions ?? 0,
    correct: s.correct_predictions ?? 0,
  }))

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-fin-text">Credibility Board</h1>
          <p className="text-sm text-fin-muted mt-0.5">
            Source reputation scored via Laplace-smoothed prediction accuracy
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="btn-secondary flex items-center gap-2 text-sm"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Bar chart — top 10 */}
      {!loading && chartData.length > 0 && (
        <div className="glass-panel p-5">
          <h2 className="text-sm font-semibold text-fin-text mb-4">Top 10 Sources by Reputation</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} layout="vertical" margin={{ left: 0, right: 16 }}>
              <XAxis
                type="number"
                domain={[0, 1]}
                tickFormatter={(v) => `${Math.round(v * 100)}%`}
                tick={{ fill: '#94a3b8', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                type="category"
                dataKey="name"
                width={180}
                tick={{ fill: '#94a3b8', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(51,65,85,0.3)' }} />
              <Bar dataKey="score" radius={[0, 4, 4, 0]} maxBarSize={16}>
                {chartData.map((entry) => (
                  <Cell key={entry.name} fill={scoreColor(entry.score)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Full table */}
      <div className="glass-panel overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-fin-border">
          <ShieldCheck size={15} className="text-fin-muted" />
          <h2 className="text-sm font-semibold text-fin-text">
            All Sources ({sources.length})
          </h2>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-fin-muted text-sm">Loading…</div>
        ) : error ? (
          <div className="p-6 text-fin-down text-sm">{error}</div>
        ) : sources.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <p className="text-fin-muted text-sm">No sources tracked yet.</p>
            <p className="text-xs text-fin-muted/60">Sources appear after running AI analyses.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-fin-border/60">
                  {['Rank', 'Organization', 'Author', 'Reputation', 'Predictions', 'Correct', 'Accuracy', 'Last Updated'].map((h) => (
                    <th key={h} className="px-5 py-3 text-left text-xs text-fin-muted font-medium uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sources.map((src, i) => {
                  const total = src.total_predictions ?? 0
                  const correct = src.correct_predictions ?? 0
                  const accuracy = total > 0 ? correct / total : null

                  return (
                    <tr key={src.id} className="border-b border-fin-border/30 hover:bg-fin-border/10 transition-colors">
                      <td className="px-5 py-3 text-fin-muted font-mono text-xs">
                        #{i + 1}
                      </td>
                      <td className="px-5 py-3 font-medium text-fin-text">
                        {src.organization || '—'}
                      </td>
                      <td className="px-5 py-3 text-fin-muted">
                        {src.author_name || '—'}
                      </td>
                      <td className="px-5 py-3">
                        <ScoreBar score={src.reputation_score} />
                      </td>
                      <td className="px-5 py-3 font-mono text-xs text-fin-muted">
                        {total}
                      </td>
                      <td className="px-5 py-3 font-mono text-xs text-fin-muted">
                        {correct}
                      </td>
                      <td className="px-5 py-3 font-mono text-xs text-fin-muted">
                        {accuracy != null ? `${Math.round(accuracy * 100)}%` : '—'}
                      </td>
                      <td className="px-5 py-3 text-fin-muted/60 text-xs whitespace-nowrap">
                        {src.last_updated
                          ? format(new Date(src.last_updated), 'dd MMM yyyy')
                          : '—'}
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
