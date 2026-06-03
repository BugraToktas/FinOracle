export default function StatCard({ label, value, sub, icon: Icon, accent = false }) {
  return (
    <div className="glass-panel glass-panel-hover p-5 flex items-start gap-4">
      {Icon && (
        <div className={`p-2.5 rounded-lg transition-transform duration-200 ${accent ? 'bg-fin-accent/15' : 'bg-fin-border/40'}`}>
          <Icon size={18} className={accent ? 'text-fin-accent' : 'text-fin-muted'} />
        </div>
      )}
      <div className="min-w-0">
        <p className="text-sm text-fin-muted font-medium uppercase tracking-wide leading-snug">{label}</p>
        <p className="text-3xl font-bold text-fin-text mt-0.5 leading-tight tabular-nums">{value}</p>
        {sub && <p className="text-sm text-fin-muted mt-1 leading-relaxed">{sub}</p>}
      </div>
    </div>
  )
}
