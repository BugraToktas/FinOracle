const CONFIG = {
  pending:  { label: 'Pending',  cls: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30' },
  verified: { label: 'Verified', cls: 'bg-fin-up/15 text-fin-up border-fin-up/30' },
  failed:   { label: 'Failed',   cls: 'bg-fin-down/15 text-fin-down border-fin-down/30' },
}

export default function StatusBadge({ status }) {
  const cfg = CONFIG[status] ?? CONFIG.pending
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.cls}`}>
      {cfg.label}
    </span>
  )
}
