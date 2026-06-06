import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { format } from 'date-fns'
import { enUS, tr } from 'date-fns/locale'
import {
  ShieldCheck, Play, RefreshCw, Users, Clock,
  CheckCircle, XCircle, Crown, AlertCircle,
  Search, Trash2, Edit3, X, ChevronRight, Check
} from 'lucide-react'
import PageShell from '../components/PageShell'
import PageHeader from '../components/PageHeader'
import StatCard from '../components/StatCard'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import {
  adminGetUsers,
  adminGetQueueStats,
  adminRunQueue,
  adminUpdateUser,
  adminDeleteUser,
  adminGetUserAnalyses
} from '../services/adminService'

export default function Admin() {
  const { t, i18n } = useTranslation()
  const locale = i18n.language === 'tr' ? tr : enUS
  const { isAdmin, loading: authLoading, user } = useAuth()
  const { addToast } = useToast()
  const navigate = useNavigate()

  const [users, setUsers]           = useState([])
  const [queueStats, setQueueStats] = useState(null)
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState(null)

  const [queueRunning, setQueueRunning]   = useState(false)
  const [queueResult, setQueueResult]     = useState(null)
  const [queueError, setQueueError]       = useState(null)

  // UX State
  const [searchQuery, setSearchQuery]               = useState('')
  const [editingUserId, setEditingUserId]           = useState(null)
  const [editingLimit, setEditingLimit]             = useState(10)
  const [confirmDeleteUserId, setConfirmDeleteUserId] = useState(null)
  const [confirmDeleteEmail, setConfirmDeleteEmail]   = useState('')
  // custom confirm modal for toggle-admin (replaces window.confirm)
  const [confirmToggle, setConfirmToggle]             = useState(null) // { user, nextAdminState }
  const [selectedUserForAnalyses, setSelectedUserForAnalyses] = useState(null)
  const [selectedUserAnalyses, setSelectedUserAnalyses]       = useState([])
  const [loadingAnalyses, setLoadingAnalyses]                 = useState(false)
  const [savingUserId, setSavingUserId]                       = useState(null)

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

  async function handleUpdateLimit(userId, isUserAdmin) {
    setSavingUserId(userId)
    try {
      await adminUpdateUser(userId, isUserAdmin, editingLimit)
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, daily_limit: editingLimit } : u))
      )
      setEditingUserId(null)
      addToast(t('admin.limitUpdated'))
    } catch (err) {
      setError(err.message)
    } finally {
      setSavingUserId(null)
    }
  }

  // window.confirm yerine custom modal kullanılıyor
  function handleToggleAdminRequest(user) {
    setConfirmToggle({ user, nextAdminState: !user.is_admin })
  }

  async function handleToggleAdminConfirm() {
    if (!confirmToggle) return
    const { user, nextAdminState } = confirmToggle
    setConfirmToggle(null)
    setSavingUserId(user.id)
    try {
      await adminUpdateUser(user.id, nextAdminState, user.daily_limit)
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, is_admin: nextAdminState } : u))
      )
      addToast(t('admin.userUpdated'))
    } catch (err) {
      setError(err.message)
    } finally {
      setSavingUserId(null) // bug fix: önceki kodda setSavingUserId(user.id) gereksiz yere çağrılıyordu
    }
  }

  async function handleDeleteUser(userId) {
    setSavingUserId(userId)
    setError(null)
    try {
      await adminDeleteUser(userId)
      setUsers((prev) => prev.filter((u) => u.id !== userId))
      setConfirmDeleteUserId(null)
      setConfirmDeleteEmail('')
      addToast(t('admin.userDeleted'))
    } catch (err) {
      setError(err.message)
      setConfirmDeleteUserId(null)
    } finally {
      setSavingUserId(null)
    }
  }

  async function handleShowAnalyses(user) {
    setSelectedUserForAnalyses(user)
    setLoadingAnalyses(true)
    setSelectedUserAnalyses([])
    try {
      const data = await adminGetUserAnalyses(user.id)
      setSelectedUserAnalyses(data)
    } catch (err) {
      setError(err.message)
      setSelectedUserForAnalyses(null)
    } finally {
      setLoadingAnalyses(false)
    }
  }

  // triggerNotification artık sadece inline banner için (toast global context'e taşındı)
  function triggerNotification(msg) {
    setSuccessMessage(msg)
    setTimeout(() => { setSuccessMessage(null) }, 4000)
  }

  // Filter users list based on search query
  const filteredUsers = users.filter((u) => {
    const q = searchQuery.toLowerCase()
    return (
      (u.email ?? '').toLowerCase().includes(q) ||
      (u.display_name ?? '').toLowerCase().includes(q)
    )
  })

  if (authLoading) return null
  if (!isAdmin) return null

  return (
    <PageShell>
      <PageHeader
        title={t('admin.title')}
        subtitle={t('admin.subtitle')}
        icon={ShieldCheck}
      />

      {error && (
        <div className="alert-banner alert-error" role="alert">
          <AlertCircle size={16} className="shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)} className="ml-auto p-1 opacity-70 hover:opacity-100 transition-opacity">
            <X size={14} />
          </button>
        </div>
      )}

      <div className="grid grid-cols-3 gap-3 md:gap-4 stagger-list">
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
      <div className="glass-panel glass-panel-hover p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex-1 min-w-0">
            <h2 className="section-heading mb-1">
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

      {/* Users Management Panel */}
      <div className="glass-panel glass-panel-hover overflow-hidden">
        {/* Panel Header & Search */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-5 py-4 border-b border-fin-border">
          <div className="flex items-center gap-2">
            <Users size={15} className="text-fin-muted" />
            <h2 className="text-sm font-semibold text-fin-text">
              {t('admin.users')}
            </h2>
            {!loading && (
              <span className="text-xs text-fin-muted/60">
                — {t('admin.userCount', { count: filteredUsers.length })}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {/* Search Input */}
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-fin-muted" />
              <input
                type="text"
                placeholder={t('admin.searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input-field text-xs pl-8 pr-3 py-1.5 w-full sm:w-56"
              />
            </div>
            {/* Reload button */}
            <button
              onClick={load}
              disabled={loading}
              className="text-fin-muted hover:text-fin-text transition-colors p-1.5 rounded-lg border border-fin-border/60 hover:bg-fin-border/20"
              title="Refresh"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-14 text-fin-muted text-sm">
            {t('common.loading')}
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="flex items-center justify-center py-14 text-fin-muted text-sm">
            {t('admin.noUsers')}
          </div>
        ) : (
          <>
            {/* Mobile Cards (only visible on mobile screens) */}
            <div className="sm:hidden divide-y divide-fin-border/30">
              {filteredUsers.map((u) => (
                <div key={u.id} className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm text-fin-text font-medium truncate">{u.email}</p>
                      <p className="text-xs text-fin-muted mt-0.5">
                        {format(new Date(u.created_at), 'dd MMM yyyy', { locale })}
                      </p>
                    </div>
                    {u.is_admin ? (
                      <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-fin-accent/15 text-fin-accent border border-fin-accent/25 shrink-0">
                        <Crown size={9} />
                        {t('admin.adminBadge')}
                      </span>
                    ) : null}
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1 border-t border-fin-border/20">
                    <button
                      onClick={() => handleShowAnalyses(u)}
                      className="text-fin-accent hover:underline"
                    >
                      {u.analysis_count} {t('admin.analyses')}
                    </button>

                    <div className="flex items-center gap-2">
                      <span className="text-fin-muted">{t('admin.dailyLimit')}:</span>
                      {editingUserId === u.id ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min="0"
                            value={editingLimit}
                            onChange={(e) => setEditingLimit(Math.max(0, parseInt(e.target.value) || 0))}
                            className="input-field w-12 px-1 py-0.5 text-center font-mono text-xs"
                          />
                          <button
                            onClick={() => handleUpdateLimit(u.id, u.is_admin)}
                            className="p-1 rounded bg-fin-up/20 text-fin-up"
                            disabled={savingUserId === u.id}
                          >
                            <Check size={12} />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setEditingUserId(u.id)
                            setEditingLimit(u.daily_limit ?? 10)
                          }}
                          className="flex items-center gap-1 font-mono text-fin-text hover:text-fin-accent"
                        >
                          {u.daily_limit ?? 10}
                          <Edit3 size={11} className="text-fin-muted" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2 border-t border-fin-border/20">
                    <button
                      onClick={() => handleToggleAdminRequest(u)}
                      className="text-xs px-2 py-1 rounded bg-fin-border/60 hover:bg-fin-border text-fin-text transition-colors"
                      disabled={savingUserId !== null}
                    >
                      {u.is_admin ? t('admin.demoteAdmin') : t('admin.promoteAdmin')}
                    </button>
                    {u.id !== user?.id && (
                      <button
                        onClick={() => {
                          setConfirmDeleteUserId(u.id)
                          setConfirmDeleteEmail(u.email)
                        }}
                        className="text-xs px-2 py-1 rounded bg-fin-down/10 text-fin-down hover:bg-fin-down/20 transition-colors flex items-center gap-1"
                        disabled={savingUserId !== null}
                      >
                        <Trash2 size={11} />
                        {t('admin.deleteUser')}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table (hidden on mobile) */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-fin-border/60">
                    <th className="px-5 py-3 text-left text-xs text-fin-muted font-medium uppercase tracking-wide">{t('admin.email')}</th>
                    <th className="px-5 py-3 text-left text-xs text-fin-muted font-medium uppercase tracking-wide">{t('admin.joined')}</th>
                    <th className="px-5 py-3 text-left text-xs text-fin-muted font-medium uppercase tracking-wide">{t('admin.analyses')}</th>
                    <th className="px-5 py-3 text-left text-xs text-fin-muted font-medium uppercase tracking-wide">{t('admin.dailyLimit')}</th>
                    <th className="px-5 py-3 text-right text-xs text-fin-muted font-medium uppercase tracking-wide">{t('admin.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((u) => (
                    <tr key={u.id} className="border-b border-fin-border/30 table-row-hover">
                      {/* Email & Role Badge */}
                      <td className="px-5 py-3 text-fin-text">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate max-w-[200px]" title={u.email}>{u.email}</span>
                          {u.is_admin && (
                            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-fin-accent/15 text-fin-accent border border-fin-accent/25 shrink-0">
                              <Crown size={9} />
                              {t('admin.adminBadge')}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Joined Date */}
                      <td className="px-5 py-3 text-fin-muted font-mono text-xs whitespace-nowrap">
                        {format(new Date(u.created_at), 'dd MMM yyyy', { locale })}
                      </td>

                      {/* Analysis Count */}
                      <td className="px-5 py-3 text-fin-muted font-mono text-xs">
                        <button
                          onClick={() => handleShowAnalyses(u)}
                          className="hover:text-fin-accent hover:underline font-semibold"
                        >
                          {u.analysis_count}
                        </button>
                      </td>

                      {/* Daily Limit (Editable) */}
                      <td className="px-5 py-3 text-fin-muted text-xs">
                        {editingUserId === u.id ? (
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              min="0"
                              value={editingLimit}
                              onChange={(e) => setEditingLimit(Math.max(0, parseInt(e.target.value) || 0))}
                              className="input-field w-16 px-1.5 py-1 text-center font-mono text-xs"
                              disabled={savingUserId === u.id}
                            />
                            <button
                              onClick={() => handleUpdateLimit(u.id, u.is_admin)}
                              className="p-1 rounded bg-fin-up/20 text-fin-up hover:bg-fin-up/30 transition-colors"
                              title={t('common.save')}
                              disabled={savingUserId === u.id}
                            >
                              <Check size={14} />
                            </button>
                            <button
                              onClick={() => setEditingUserId(null)}
                              className="p-1 rounded bg-fin-border/60 text-fin-muted hover:bg-fin-border transition-colors"
                              title={t('common.cancel')}
                              disabled={savingUserId === u.id}
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 group/limit">
                            <span className="font-mono text-fin-text">{u.daily_limit ?? 10}</span>
                            <button
                              onClick={() => {
                                setEditingUserId(u.id)
                                setEditingLimit(u.daily_limit ?? 10)
                              }}
                              className="opacity-0 group-hover/limit:opacity-100 text-fin-muted hover:text-fin-text transition-all p-1"
                              title={t('admin.editLimit')}
                            >
                              <Edit3 size={12} />
                            </button>
                          </div>
                        )}
                      </td>

                      {/* Action buttons */}
                      <td className="px-5 py-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleToggleAdminRequest(u)}
                            className="text-xs px-2.5 py-1.5 rounded-lg border border-fin-border/60 hover:bg-fin-border/20 text-fin-text transition-all"
                            disabled={savingUserId !== null}
                          >
                            {u.is_admin ? t('admin.demoteAdmin') : t('admin.promoteAdmin')}
                          </button>
                          {u.id !== user?.id && (
                            <button
                              onClick={() => {
                                setConfirmDeleteUserId(u.id)
                                setConfirmDeleteEmail(u.email)
                              }}
                              className="text-xs px-2.5 py-1.5 rounded-lg bg-fin-down/10 text-fin-down hover:bg-fin-down/20 transition-all flex items-center gap-1"
                              title={t('admin.deleteUser')}
                              disabled={savingUserId !== null}
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* ─── MODALS ────────────────────────────────────────────────────────── */}

      {/* Recent Analyses Modal */}
      {selectedUserForAnalyses && (
        <div className="modal-overlay">
          <div className="glass-panel modal-panel w-full max-w-lg overflow-hidden flex flex-col max-h-[80vh]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-fin-border">
              <h3 className="font-semibold text-fin-text truncate">
                {t('admin.recentAnalyses')} — {selectedUserForAnalyses.email}
              </h3>
              <button
                onClick={() => setSelectedUserForAnalyses(null)}
                className="text-fin-muted hover:text-fin-text transition-colors p-1"
              >
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              {loadingAnalyses ? (
                <div className="flex justify-center py-10">
                  <RefreshCw size={20} className="animate-spin text-fin-muted" />
                </div>
              ) : selectedUserAnalyses.length === 0 ? (
                <p className="text-sm text-fin-muted text-center py-10">{t('admin.noAnalyses')}</p>
              ) : (
                <div className="space-y-2">
                  {selectedUserAnalyses.map((a) => (
                    <div
                      key={a.id}
                      onClick={() => {
                        setSelectedUserForAnalyses(null)
                        navigate(`/events/${a.event_id}`)
                      }}
                      className="p-3 rounded-lg border border-fin-border/30 hover:border-fin-accent/40 bg-fin-border/10 hover:bg-fin-accent/5 transition-all cursor-pointer flex items-center justify-between gap-3 group"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-fin-text font-medium truncate group-hover:text-fin-accent transition-colors">
                          {a.question}
                        </p>
                        <div className="flex items-center gap-2 mt-1 text-xs text-fin-muted">
                          <span>{format(new Date(a.created_at), 'dd MMM yyyy HH:mm', { locale })}</span>
                          <span>·</span>
                          <span className="font-mono">{Math.round((a.confidence ?? 0) * 100)}%</span>
                        </div>
                      </div>
                      <div className="shrink-0 flex items-center gap-1.5">
                        <span className={`text-xs px-2 py-0.5 rounded font-semibold uppercase ${
                          a.status === 'verified'
                            ? 'bg-fin-up/10 text-fin-up border border-fin-up/25'
                            : a.status === 'failed'
                            ? 'bg-fin-down/10 text-fin-down border border-fin-down/25'
                            : 'bg-fin-border/60 text-fin-muted border border-fin-border'
                        }`}>
                          {t(`events.status${a.status.charAt(0).toUpperCase() + a.status.slice(1)}`)}
                        </span>
                        <ChevronRight size={14} className="text-fin-muted group-hover:text-fin-accent transition-colors" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="px-5 py-3 border-t border-fin-border flex justify-end">
              <button
                onClick={() => setSelectedUserForAnalyses(null)}
                className="btn-secondary text-xs px-4 py-2"
              >
                {t('admin.close')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Toggle Admin Modal */}
      {confirmToggle && (
        <div className="modal-overlay">
          <div className="glass-panel modal-panel w-full max-w-md p-5 space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-fin-accent/10 text-fin-accent shrink-0">
                <Crown size={20} />
              </div>
              <div>
                <h3 className="font-semibold text-fin-text">
                  {confirmToggle.nextAdminState ? t('admin.promoteAdmin') : t('admin.demoteAdmin')}
                </h3>
                <p className="text-sm text-fin-muted mt-1 leading-relaxed">
                  {confirmToggle.nextAdminState
                    ? t('admin.promoteConfirm', { email: confirmToggle.user.email })
                    : t('admin.demoteConfirm',  { email: confirmToggle.user.email })
                  }
                </p>
                <p className="text-xs text-fin-muted/70 font-mono mt-2 bg-fin-border/20 p-2 rounded truncate">
                  {confirmToggle.user.email}
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setConfirmToggle(null)}
                className="btn-secondary text-xs px-4 py-2"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleToggleAdminConfirm}
                className="btn-primary text-xs px-4 py-2"
              >
                {t('common.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete User Confirmation Modal */}
      {confirmDeleteUserId && (
        <div className="modal-overlay">
          <div className="glass-panel modal-panel w-full max-w-md p-5 space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-fin-down/10 text-fin-down shrink-0 animate-pulse">
                <AlertCircle size={20} />
              </div>
              <div>
                <h3 className="font-semibold text-fin-text">{t('admin.deleteUser')}</h3>
                <p className="text-sm text-fin-muted mt-1 leading-relaxed">
                  {t('admin.deleteConfirm')}
                </p>
                <p className="text-xs text-fin-down font-mono mt-2 bg-fin-down/5 p-2 rounded border border-fin-down/20 truncate">
                  {confirmDeleteEmail}
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => {
                  setConfirmDeleteUserId(null)
                  setConfirmDeleteEmail('')
                }}
                className="btn-secondary text-xs px-4 py-2"
                disabled={savingUserId !== null}
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={() => handleDeleteUser(confirmDeleteUserId)}
                className="bg-fin-down hover:bg-red-600 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors duration-200 flex items-center gap-2"
                disabled={savingUserId !== null}
              >
                {savingUserId === confirmDeleteUserId && <RefreshCw size={12} className="animate-spin" />}
                {t('admin.deleteUser')}
              </button>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  )
}
