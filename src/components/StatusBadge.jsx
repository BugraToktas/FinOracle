import { useTranslation } from 'react-i18next'

export default function StatusBadge({ status }) {
  const { t } = useTranslation()

  const CONFIG = {
    pending:       { label: t('status.pending'),       cls: 'bg-yellow-500/12 text-yellow-400 border-yellow-500/25', dot: 'badge-dot badge-dot-pending'  },
    verified:      { label: t('status.verified'),      cls: 'bg-fin-up/12 text-fin-up border-fin-up/25',             dot: 'badge-dot badge-dot-verified' },
    failed:        { label: t('status.failed'),        cls: 'bg-fin-down/12 text-fin-down border-fin-down/25',       dot: 'badge-dot badge-dot-failed'   },
    unverifiable:  { label: t('status.unverifiable'),  cls: 'bg-fin-muted/12 text-fin-muted border-fin-muted/25',   dot: 'badge-dot badge-dot-failed'   },
  }

  const cfg = CONFIG[status] ?? CONFIG.pending
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-sm font-medium border ${cfg.cls}`}
      style={{ letterSpacing: '0.01em' }}
    >
      <span className={cfg.dot} aria-hidden="true" />
      {cfg.label}
    </span>
  )
}
