export default function StatCard({ label, value, sub, icon: Icon, accent = false }) {
  return (
    <div className={`glass-panel glass-panel-hover stat-card p-5 flex items-start gap-4 ${accent ? 'stat-card-accent' : ''}`}>
      {Icon && (
        <div className={`stat-card-icon p-2.5 rounded-lg ${accent ? 'bg-fin-accent/15' : 'bg-fin-border/40'}`}>
          <Icon size={18} className={accent ? 'text-fin-accent' : 'text-fin-muted'} />
        </div>
      )}
      <div className="min-w-0">
        <p className="text-xs text-fin-muted font-semibold uppercase tracking-widest leading-snug mb-0.5">
          {label}
        </p>
        <p className={`text-3xl font-bold leading-tight tabular-nums stat-card-value`}>
          {value}
        </p>
        {sub && <p className="text-sm text-fin-muted mt-1 leading-relaxed">{sub}</p>}
      </div>
    </div>
  )
}
