import { TrendingUp, TrendingDown } from 'lucide-react'

export default function DirectionBadge({ direction }) {
  const isUp = direction === 'up'
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border select-none ${
        isUp
          ? 'bg-fin-up/10 text-fin-up border-fin-up/20'
          : 'bg-fin-down/10 text-fin-down border-fin-down/20'
      }`}
      style={{ letterSpacing: '0.04em' }}
    >
      {isUp ? <TrendingUp size={11} strokeWidth={2.5} /> : <TrendingDown size={11} strokeWidth={2.5} />}
      {isUp ? 'UP' : 'DOWN'}
    </span>
  )
}
