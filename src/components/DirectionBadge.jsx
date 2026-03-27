import { TrendingUp, TrendingDown } from 'lucide-react'

export default function DirectionBadge({ direction }) {
  const isUp = direction === 'up'
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${
        isUp
          ? 'bg-fin-up/10 text-fin-up border-fin-up/25'
          : 'bg-fin-down/10 text-fin-down border-fin-down/25'
      }`}
    >
      {isUp ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
      {isUp ? 'UP' : 'DOWN'}
    </span>
  )
}
