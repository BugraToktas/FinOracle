const CONFIG = {
  pending:  { label: 'Pending',  cls: 'bg-yellow-500/12 text-yellow-400 border-yellow-500/25', dot: 'badge-dot badge-dot-pending'  },
  verified: { label: 'Verified', cls: 'bg-fin-up/12 text-fin-up border-fin-up/25',             dot: 'badge-dot badge-dot-verified' },
  failed:   { label: 'Failed',   cls: 'bg-fin-down/12 text-fin-down border-fin-down/25',       dot: 'badge-dot badge-dot-failed'   },
}

export default function StatusBadge({ status }) {
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
