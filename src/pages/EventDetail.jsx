import { useEffect, useState } from 'react'
import { useParams, useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { format } from 'date-fns'
import { enUS, tr } from 'date-fns/locale'
import {
  ArrowLeft, ShieldCheck, ShieldX, Minus, RefreshCw,
  ChevronDown, ChevronUp, FileText, AlertCircle, Zap,
  Sparkles, Trash2, MessageSquare,
} from 'lucide-react'
import StatusBadge from '../components/StatusBadge'
import DirectionBadge from '../components/DirectionBadge'
import ConfidenceBar from '../components/ConfidenceBar'
import SourceList from '../components/SourceList'
import { getAnalysesByEventId, callVerifyAnalysis, deleteAnalysis } from '../services/analysisService'
import { getEventById, deleteEvent } from '../services/eventService'
import Skeleton from '../components/Skeleton'

function useLocale() {
  const { i18n } = useTranslation()
  return i18n.language === 'tr' ? tr : enUS
}

function VerdictBadge({ verdict }) {
  const { t } = useTranslation()
  const config = {
    correct: { label: t('eventDetail.verdictCorrect'), icon: ShieldCheck, cls: 'text-fin-up bg-fin-up/10 border-fin-up/25' },
    partial: { label: t('eventDetail.verdictPartial'), icon: Minus,       cls: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/25' },
    wrong:   { label: t('eventDetail.verdictWrong'),   icon: ShieldX,     cls: 'text-fin-down bg-fin-down/10 border-fin-down/25' },
  }
  const cfg = config[verdict]
  if (!cfg) return null
  const Icon = cfg.icon
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold border ${cfg.cls}`}>
      <Icon size={14} />
      {cfg.label}
    </span>
  )
}

function AnalysisCard({ analysis, highlighted, onVerify, verifying, onDelete }) {
  const { t } = useTranslation()
  const locale = useLocale()
  const [expanded, setExpanded] = useState(false)
  const revalidation = analysis.revalidations?.[0] ?? null

  const sourceDocs = (analysis.analysis_document_links ?? [])
    .map((l) => l.source_documents)
    .filter(Boolean)

  const canVerify = analysis.status === 'pending' || analysis.status === 'failed'

  return (
    <div className={`glass-panel overflow-hidden ${highlighted ? 'ring-2 ring-fin-accent/50' : ''}`}>
      {highlighted && (
        <div className="bg-fin-accent/10 border-b border-fin-accent/20 px-5 py-2 text-xs text-fin-accent font-medium flex items-center gap-1.5">
          <Sparkles size={12} />
          {t('eventDetail.newAnalysis')}
        </div>
      )}

      <div className="p-4 md:p-5">
        {/* Status row */}
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-center gap-3 flex-wrap">
            <StatusBadge status={analysis.status} />
            {revalidation && <VerdictBadge verdict={revalidation.verdict} />}
            <span className="text-xs text-fin-muted font-mono">
              {format(new Date(analysis.created_at), 'dd MMM yyyy HH:mm', { locale })}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {canVerify && (
              <button
                onClick={() => onVerify(analysis.id)}
                disabled={verifying}
                title={t('eventDetail.recheckTooltip')}
                className="btn-secondary flex items-center gap-1.5 text-xs"
              >
                <RefreshCw size={12} className={verifying ? 'animate-spin' : ''} />
                {verifying ? t('eventDetail.rechecking') : t('eventDetail.recheck')}
              </button>
            )}
            <button
              onClick={() => onDelete(analysis.id)}
              title={t('eventDetail.deleteAnalysis')}
              className="p-1.5 rounded-lg text-fin-muted hover:text-fin-down hover:bg-fin-down/10 transition-colors"
            >
              <Trash2 size={13} />
            </button>
          </div>
        </div>

        {/* User's question */}
        {analysis.question && (
          <div className="mb-4 p-3 rounded-lg bg-fin-dark/60 border border-fin-border/40">
            <div className="flex items-center gap-1.5 text-xs text-fin-muted mb-1.5">
              <MessageSquare size={11} />
              {t('eventDetail.yourQuestion')}
            </div>
            <p className="text-sm text-fin-text/90 leading-relaxed italic">"{analysis.question}"</p>
          </div>
        )}

        {/* Confidence */}
        <div className="mb-4">
          <p className="text-xs text-fin-muted mb-1.5">{t('eventDetail.confidence')}</p>
          <ConfidenceBar value={analysis.confidence} />
        </div>

        {/* AI Summary */}
        <div className="mb-4">
          <p className="text-xs text-fin-muted mb-1.5">{t('eventDetail.aiSummary')}</p>
          <p className="text-sm text-fin-text leading-relaxed">{analysis.summary}</p>
        </div>

        {/* Revalidation result */}
        {revalidation && (
          <div className="mb-4 p-3 rounded-lg bg-fin-dark/60 border border-fin-border/50">
            <p className="text-xs text-fin-muted mb-2 font-medium uppercase tracking-wide">
              {t('eventDetail.recheckResult')}
            </p>
            <div className="flex items-center gap-2 mb-1">
              <VerdictBadge verdict={revalidation.verdict} />
              <span className="text-xs text-fin-muted">
                {t('eventDetail.confidence')}: {Math.round((revalidation.confidence ?? 0) * 100)}%
              </span>
            </div>
            {revalidation.notes && (
              <p className="text-xs text-fin-muted mt-1.5">{revalidation.notes}</p>
            )}
          </div>
        )}

        {/* Source documents toggle */}
        {sourceDocs.length > 0 && (
          <div>
            <button
              onClick={() => setExpanded((x) => !x)}
              className="flex items-center gap-1.5 text-xs text-fin-muted hover:text-fin-text transition-colors mb-2"
            >
              <FileText size={12} />
              {t('eventDetail.sourceDocs_other', { count: sourceDocs.length })}
              {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
            {expanded && <SourceList sources={sourceDocs} />}
          </div>
        )}

        {analysis.verify_after && analysis.status === 'pending' && (
          <p className="text-xs text-fin-muted/60 mt-3">
            {t('eventDetail.scheduledRecheck')}{' '}
            {format(new Date(analysis.verify_after), 'dd MMM yyyy HH:mm', { locale })}
          </p>
        )}
      </div>
    </div>
  )
}

// ── Delete confirmation modal ──────────────────────────────────────────────────
function DeleteModal({ onConfirm, onCancel, deleting }) {
  const { t } = useTranslation()
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="glass-panel p-6 max-w-sm w-full space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-fin-down/15 shrink-0">
            <Trash2 size={18} className="text-fin-down" />
          </div>
          <h2 className="text-base font-semibold text-fin-text">{t('eventDetail.deleteEvent')}</h2>
        </div>
        <p className="text-sm text-fin-muted leading-relaxed">{t('eventDetail.deleteConfirm')}</p>
        <div className="flex gap-3 justify-end">
          <button onClick={onCancel} className="btn-secondary text-sm px-4">
            {t('eventDetail.deleteConfirmNo')}
          </button>
          <button
            onClick={onConfirm}
            disabled={deleting}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-fin-down text-white text-sm font-medium hover:bg-red-600 transition-colors disabled:opacity-60"
          >
            {deleting
              ? <><RefreshCw size={13} className="animate-spin" />{t('eventDetail.deleting')}</>
              : <><Trash2 size={13} />{t('eventDetail.deleteConfirmYes')}</>
            }
          </button>
        </div>
      </div>
    </div>
  )
}

export default function EventDetail() {
  const { t } = useTranslation()
  const locale = useLocale()
  const { id } = useParams()
  const location  = useLocation()
  const navigate  = useNavigate()

  const freshAnalysisId = location.state?.freshAnalysisId ?? null
  const inferredAsset   = location.state?.inferredAsset   ?? null

  const [event, setEvent]       = useState(null)
  const [analyses, setAnalyses] = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)
  const [verifyingId, setVerifyingId] = useState(null)
  const [verifyError, setVerifyError] = useState(null)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deletingAnalysisId, setDeletingAnalysisId] = useState(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const [ev, an] = await Promise.all([
        getEventById(id),
        getAnalysesByEventId(id),
      ])
      setEvent(ev)
      setAnalyses(an)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [id])

  async function handleVerify(analysisId) {
    setVerifyingId(analysisId)
    setVerifyError(null)
    try {
      await callVerifyAnalysis(analysisId)
      await load()
    } catch (err) {
      setVerifyError(err.message)
    } finally {
      setVerifyingId(null)
    }
  }

  async function handleDeleteAnalysis(analysisId) {
    setDeletingAnalysisId(analysisId)
    try {
      await deleteAnalysis(analysisId)
      setAnalyses((prev) => prev.filter((a) => a.id !== analysisId))
    } catch (err) {
      setVerifyError(err.message)
    } finally {
      setDeletingAnalysisId(null)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      await deleteEvent(id)
      navigate('/events', { replace: true })
    } catch (err) {
      setDeleting(false)
      setShowDeleteModal(false)
      setError(err.message)
    }
  }

  // Pre-fill NewEvent with this event's details
  function handleReAnalyse() {
    const latestQuestion = analyses?.[0]?.question ?? ''
    navigate('/new-event', {
      state: {
        prefill: {
          asset_code: event?.asset_code ?? '',
          event_date: event?.event_date ?? '',
          direction:  event?.direction  ?? 'down',
          question:   latestQuestion,
        }
      }
    })
  }

  if (loading) {
    return (
      <div className="p-4 md:p-6 space-y-4 md:space-y-6 max-w-3xl">
        <div className="flex justify-between">
          <Skeleton className="w-20" />
          <Skeleton className="w-24" />
        </div>
        <div className="glass-panel p-4 md:p-5">
          <Skeleton className="w-32 h-8 mb-2" />
          <Skeleton className="w-48" />
        </div>
        <div className="space-y-4 mt-6">
          <Skeleton variant="rectangular" className="w-full h-40" />
          <Skeleton variant="rectangular" className="w-full h-40" />
        </div>
      </div>
    )
  }

  if (error || !event) {
    return (
      <div className="p-4 md:p-6">
        <div className="flex items-center gap-2 p-4 rounded-lg bg-fin-down/10 border border-fin-down/30 text-fin-down text-sm">
          <AlertCircle size={16} />
          {error ?? t('eventDetail.eventNotFound')}
        </div>
      </div>
    )
  }

  return (
    <>
      {showDeleteModal && (
        <DeleteModal
          onConfirm={handleDelete}
          onCancel={() => setShowDeleteModal(false)}
          deleting={deleting}
        />
      )}

      <div className="p-4 md:p-6 space-y-4 md:space-y-6 max-w-3xl">
        {/* Back + delete */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-sm text-fin-muted hover:text-fin-text transition-colors"
          >
            <ArrowLeft size={15} />
            {t('eventDetail.back')}
          </button>
          <button
            onClick={() => setShowDeleteModal(true)}
            className="flex items-center gap-1.5 text-xs text-fin-muted hover:text-fin-down transition-colors px-3 py-2 rounded-lg hover:bg-fin-down/10"
          >
            <Trash2 size={14} />
            {t('eventDetail.deleteEvent')}
          </button>
        </div>

        {/* Inferred asset notice */}
        {inferredAsset && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-fin-accent/10 border border-fin-accent/30 text-sm">
            <Zap size={13} className="text-fin-accent shrink-0" />
            <span className="text-fin-muted">{t('eventDetail.inferredAsset')}</span>
            <span className="font-mono font-semibold text-fin-accent">{inferredAsset}</span>
          </div>
        )}

        {/* Event header */}
        <div className="glass-panel p-4 md:p-5">
          <div className="flex items-start gap-4 flex-wrap">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-1 flex-wrap">
                <h1 className="text-2xl font-bold font-mono text-fin-text">{event.asset_code}</h1>
                <DirectionBadge direction={event.direction} />
              </div>
              <p className="text-sm text-fin-muted">
                {format(new Date(event.event_date), 'EEEE, dd MMMM yyyy', { locale })}
              </p>
            </div>

            {event.magnitude != null && (
              <div className="text-right">
                <p className="text-xs text-fin-muted uppercase tracking-wide mb-0.5">
                  {t('eventDetail.magnitude')}
                </p>
                <p className={`text-xl font-bold font-mono ${event.direction === 'up' ? 'text-fin-up' : 'text-fin-down'}`}>
                  {event.magnitude > 0 ? '+' : ''}{event.magnitude}%
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Analyses section */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-fin-text">
              {t('eventDetail.aiAnalyses', { count: analyses.length })}
            </h2>
            <button
              onClick={handleReAnalyse}
              className="flex items-center gap-1.5 text-xs text-fin-accent hover:underline"
            >
              <Sparkles size={12} />
              {t('eventDetail.reAnalyse')}
            </button>
          </div>

          {verifyError && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-fin-down/10 border border-fin-down/30 text-fin-down text-sm mb-3">
              <AlertCircle size={14} />
              {verifyError}
            </div>
          )}

          {analyses.length === 0 ? (
            <div className="glass-panel p-8 flex flex-col items-center gap-3 text-center">
              <p className="text-fin-muted text-sm">{t('eventDetail.noAnalysis')}</p>
              <button onClick={handleReAnalyse} className="btn-primary text-sm flex items-center gap-2">
                <Sparkles size={15} />
                {t('eventDetail.generateAnalysis')}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {analyses.map((an) => (
                <AnalysisCard
                  key={an.id}
                  analysis={an}
                  highlighted={an.id === freshAnalysisId}
                  onVerify={handleVerify}
                  verifying={verifyingId === an.id}
                  onDelete={handleDeleteAnalysis}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
