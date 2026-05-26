import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { format } from 'date-fns'
import { enUS, tr } from 'date-fns/locale'
import {
  ShieldCheck, Play, RefreshCw, Users, Clock,
  CheckCircle, XCircle, Crown, AlertCircle,
} from 'lucide-react'
import StatCard from '../components/StatCard'
import { useAuth } from '../context/AuthContext'
import { adminGetUsers, adminGetQueueStats, adminRunQueue } from '../services/adminService'

export default function Admin() {
  const { t, i18n } = useTranslation()
  const locale = i18n.language === 'tr' ? tr : enUS
  const { isAdmin, loading: authLoading } = useAuth()
  const navigate = useNavigate()

  const [users, setUsers]           = useState([])
  const [queueStats, setQueueStats] = useState(null)
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState(null)

  const [queueRunning, setQueueRunning]   = useState(false)
  const [queueResult, setQueueResult]     = useState(null)
  const [queueError, setQueueError]       = useState(null)

  // Guard: non-admins are redirected (wait for auth to finish loading first)
  useEffect(() => {
    if (!authLoading && !isAdmin) navigate('/dashboard', { replace: true })
  }, [authLoading, isAdmin, navigate])

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const [u, q] = await Promise.all([adminGetUsers(), adminGetQueueStats()])
      setUsers(u)
      setQueueStats(q)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function handleRunQueue() {
    setQueueRunning(true)
    setQueueResult(null)
    setQueueError(null)
    try {
      const result = await adminRunQueue()
      setQueueResult(result)
      await load() // refresh stats
    } catch (err) {
      setQueueError(err.message)
    } finally {
      setQueueRunning(false)
    }
  }

  if (authLoading) return null
  if (!isAdmin) return null

  return (
    <div className="p-4 md:p-6 space-y-5 md:space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-fin-accent/15">
          <ShieldCheck size={20} className="text-fin-accent" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-fin-text">{t('admin.title')}</h1>
          <p className="text-sm text-fin-muted mt-0.5">{t('admin.subtitle')}</p>
        </div>
      </div>

      {/* Global error */}
      {error && (
        <div className="flex items-center gap-2 p-4 rounded-lg bg-fin-down/10 border border-fin-down/30 text-fin-down text-sm">
          <AlertCircle size={16} className="shrink-0" />
          {error}
        </div>
      )}

      {/* Queue Stats */}
      <div className="grid grid-cols-3 gap-3 md:gap-4">
        <StatCard
          label={t('admin.pending')}
          value={loading ? '—' : (queueStats?.pending_count ?? 0)}
          icon={Clock}
        />
        <StatCard
          label={t('admin.verifiedToday')}
          value={loading ? '—' : (queueStats?.verified_today ?? 0)}
          icon={CheckCircle}
          accent
        />
        <StatCard
          label={t('admin.failedTotal')}
          value={loading ? '—' : (queueStats?.failed_total ?? 0)}
          icon={XCircle}
        />
      </div>

      {/* Verification Queue Card */}
      <div className="glass-panel p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-semibold text-fin-text mb-1">
              {t('admin.verificationQueue')}
            </h2>
            <p className="text-xs text-fin-muted leading-relaxed">{t('admin.queueDesc')}</p>
          </div>
          <button
            onClick={handleRunQueue}
            disabled={queueRunning}
            className="btn-primary flex items-center gap-2 text-sm shrink-0 disabled:opacity-60"
          >
            {queueRunning
              ? <RefreshCw size={15} className="animate-spin" />
              : <Play size={15} />
            }
            {queueRunning ? t('admin.running') : t('admin.runQueue')}
          </button>
        </div>

        {/* Queue result / error */}
        {queueResult && (
          <div className="mt-4 flex items-center gap-2 p-3 rounded-lg bg-fin-up/10 border border-fin-up/30 text-fin-up text-sm">
            <CheckCircle size={14} className="shrink-0" />
            {t('admin.queueSuccess', { count: queueResult.processed ?? queueResult.count ?? '—' })}
          </div>
        )}
        {queueError && (
          <div className="mt-4 flex items-center gap-2 p-3 rounded-lg bg-fin-down/10 border border-fin-down/30 text-fin-down text-sm">
            <AlertCircle size={14} className="shrink-0" />
            {t('admin.queueError', { error: queueError })}
          </div>
        )}
      </div>

      {/* Users Table */}
      <div className="glass-panel overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-fin-border">
          <div className="flex items-center gap-2">
            <Users size={15} className="text-fin-muted" />
            <h2 className="text-sm font-semibold text-fin-text">
              {t('admin.users')}
            </h2>
            {!loading && (
              <span className="text-xs text-fin-muted/60">
                — {t('admin.userCount', { count: users.length })}
              </span>
            )}
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="text-fin-muted hover:text-fin-text transition-colors"
            title="Refresh"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-14 text-fin-muted text-sm">
            {t('common.loading')}
          </div>
        ) : users.length === 0 ? (
          <div className="flex items-center justify-center py-14 text-fin-muted text-sm">
            {t('admin.noUsers')}
          </div>
        ) : (
          <>
            {/* Mobile cards */}
            <div className="sm:hidden divide-y divide-fin-border/30">
              {users.map((u) => (
                <div key={u.id} className="p-4 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-fin-text font-medium truncate">{u.email}</span>
                    {u.is_admin && (
                      <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-fin-accent/15 text-fin-accent border border-fin-accent/25">
                        <Crown size={9} />
                        {t('admin.adminBadge')}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-fin-muted">
                    <span>{format(new Date(u.created_at), 'dd MMM yyyy', { locale })}</span>
                    <span>·</span>
                    <span>{u.analysis_count} {t('admin.analyses')}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-fin-border/60">
                    {[t('admin.email'), t('admin.joined'), t('admin.analyses'), ''].map((h) => (
                      <th key={h} className="px-5 py-3 text-left text-xs text-fin-muted font-medium uppercase tracking-wide whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-b border-fin-border/30 hover:bg-fin-border/10 transition-colors">
                      <td className="px-5 py-3 text-fin-text">
                        <div className="flex items-center gap-2">
                          {u.email}
                          {u.is_admin && (
                            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-fin-accent/15 text-fin-accent border border-fin-accent/25">
                              <Crown size={9} />
                              {t('admin.adminBadge')}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3 text-fin-muted font-mono text-xs whitespace-nowrap">
                        {format(new Date(u.created_at), 'dd MMM yyyy', { locale })}
                      </td>
                      <td className="px-5 py-3 text-fin-muted font-mono text-xs">
                        {u.analysis_count}
                      </td>
                      <td className="px-5 py-3" />
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
