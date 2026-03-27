import { useEffect, useState } from 'react'
import { useParams, useLocation, useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import {
  ArrowLeft, ShieldCheck, ShieldX, Minus, RefreshCw,
  ChevronDown, ChevronUp, FileText, AlertCircle
} from 'lucide-react'
import StatusBadge from '../components/StatusBadge'
import DirectionBadge from '../components/DirectionBadge'
import ConfidenceBar from '../components/ConfidenceBar'
import SourceList from '../components/SourceList'
import { getEventById } from '../services/eventService'
import { getAnalysesByEventId, callVerifyAnalysis } from '../services/analysisService'

const VERDICT_CONFIG = {
  correct: { label: 'Correct', icon: ShieldCheck, cls: 'text-fin-up bg-fin-up/10 border-fin-up/25' },
  partial: { label: 'Partial', icon: Minus, cls: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/25' },
  wrong:   { label: 'Wrong',   icon: ShieldX, cls: 'text-fin-down bg-fin-down/10 border-fin-down/25' },
}

function VerdictBadge({ verdict }) {
  const cfg = VERDICT_CONFIG[verdict]
  if (!cfg) return null
  const Icon = cfg.icon
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold border ${cfg.cls}`}>
      <Icon size={14} />
      {cfg.label}
    </span>
  )
}

function AnalysisCard({ analysis, highlighted, onVerify, verifying }) {
  const [expanded, setExpanded] = useState(false)
  const revalidation = analysis.revalidations?.[0] ?? null

  const sourceDocs = (analysis.analysis_document_links ?? [])
    .map((l) => l.source_documents)
    .filter(Boolean)

  const canVerify = analysis.status === 'pending' || analysis.status === 'failed'

  return (
    <div className={`glass-panel overflow-hidden ${highlighted ? 'ring-2 ring-fin-accent/50' : ''}`}>
      {highlighted && (
        <div className="bg-fin-accent/10 border-b border-fin-accent/20 px-5 py-2 text-xs text-fin-accent font-medium">
          New analysis
        </div>
      )}

      <div className="p-5">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-center gap-3 flex-wrap">
            <StatusBadge status={analysis.status} />
            {revalidation && <VerdictBadge verdict={revalidation.verdict} />}
            <span className="text-xs text-fin-muted font-mono">
              {format(new Date(analysis.created_at), 'dd MMM yyyy HH:mm')}
            </span>
          </div>

          {canVerify && (
            <button
              onClick={() => onVerify(analysis.id)}
              disabled={verifying}
              className="btn-secondary flex items-center gap-1.5 text-xs shrink-0"
            >
              <RefreshCw size={12} className={verifying ? 'animate-spin' : ''} />
              {verifying ? 'Verifying…' : 'Verify now'}
            </button>
          )}
        </div>

        {/* Confidence */}
        <div className="mb-4">
          <p className="text-xs text-fin-muted mb-1.5">Confidence</p>
          <ConfidenceBar value={analysis.confidence} />
        </div>

        {/* Summary */}
        <div className="mb-4">
          <p className="text-xs text-fin-muted mb-1.5">AI Summary</p>
          <p className="text-sm text-fin-text leading-relaxed">{analysis.summary}</p>
        </div>

        {/* Revalidation */}
        {revalidation && (
          <div className="mb-4 p-3 rounded-lg bg-fin-dark/60 border border-fin-border/50">
            <p className="text-xs text-fin-muted mb-1.5 font-medium uppercase tracking-wide">Recheck Result</p>
            <div className="flex items-center gap-2 mb-1">
              <VerdictBadge verdict={revalidation.verdict} />
              <span className="text-xs text-fin-muted">
                confidence: {Math.round((revalidation.confidence ?? 0) * 100)}%
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
              {sourceDocs.length} source document{sourceDocs.length !== 1 ? 's' : ''}
              {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>

            {expanded && <SourceList sources={sourceDocs} />}
          </div>
        )}

        {analysis.verify_after && analysis.status === 'pending' && (
          <p className="text-xs text-fin-muted/60 mt-3">
            Scheduled recheck: {format(new Date(analysis.verify_after), 'dd MMM yyyy HH:mm')}
          </p>
        )}
      </div>
    </div>
  )
}

export default function EventDetail() {
  const { id } = useParams()
  const location = useLocation()
  const navigate = useNavigate()

  const freshAnalysisId = location.state?.freshAnalysisId ?? null

  const [event, setEvent] = useState(null)
  const [analyses, setAnalyses] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [verifyingId, setVerifyingId] = useState(null)
  const [verifyError, setVerifyError] = useState(null)

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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64 text-fin-muted text-sm p-6">
        Loading event…
      </div>
    )
  }

  if (error || !event) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-2 p-4 rounded-lg bg-fin-down/10 border border-fin-down/30 text-fin-down text-sm">
          <AlertCircle size={16} />
          {error ?? 'Event not found.'}
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      {/* Back */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 text-sm text-fin-muted hover:text-fin-text transition-colors"
      >
        <ArrowLeft size={15} />
        Back
      </button>

      {/* Event header */}
      <div className="glass-panel p-5">
        <div className="flex items-start gap-4 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-1 flex-wrap">
              <h1 className="text-2xl font-bold font-mono text-fin-text">{event.asset_code}</h1>
              <DirectionBadge direction={event.direction} />
            </div>
            <p className="text-sm text-fin-muted">
              {format(new Date(event.event_date), 'EEEE, dd MMMM yyyy')}
            </p>
          </div>

          {event.magnitude != null && (
            <div className="text-right">
              <p className="text-xs text-fin-muted uppercase tracking-wide mb-0.5">Magnitude</p>
              <p className={`text-xl font-bold font-mono ${event.direction === 'up' ? 'text-fin-up' : 'text-fin-down'}`}>
                {event.magnitude > 0 ? '+' : ''}{event.magnitude}%
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Analyses */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-fin-text">
            AI Analyses ({analyses.length})
          </h2>
          <button
            onClick={() => navigate('/new-event')}
            className="text-xs text-fin-accent hover:underline"
          >
            + New analysis
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
            <p className="text-fin-muted text-sm">No analyses yet for this event.</p>
            <button onClick={() => navigate('/new-event')} className="btn-primary text-sm">
              Generate Analysis
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
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
