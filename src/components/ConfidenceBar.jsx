function getColor(pct) {
  if (pct >= 70) return 'bg-fin-up'
  if (pct >= 40) return 'bg-yellow-500'
  return 'bg-fin-down'
}

export default function ConfidenceBar({ value }) {
  const pct = Math.round((value ?? 0) * 100)
  const color = getColor(pct)

  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2 bg-fin-border rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-sm font-mono text-fin-muted w-9 text-right tabular-nums">{pct}%</span>
    </div>
  )
}
