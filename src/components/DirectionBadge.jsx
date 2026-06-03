import { TrendingUp, TrendingDown } from 'lucide-react'

export default function DirectionBadge({ direction }) {
  const isUp = direction === 'up'
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-sm font-semibold border transition-colors duration-150 ${
        isUp
          ? 'bg-fin-up/10 text-fin-up border-fin-up/25'
          : 'bg-fin-down/10 text-fin-down border-fin-down/25'
      }`}
    >
      {isUp ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
      {isUp ? 'UP' : 'DOWN'}
    </span>
  )
}
