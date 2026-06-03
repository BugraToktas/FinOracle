export default function Skeleton({ className = '', variant = 'text' }) {
  const variants = {
    text: 'h-4 rounded',
    circular: 'rounded-full',
    rectangular: 'rounded-lg',
  }

  return (
    <div
      className={`skeleton-shimmer ${variants[variant]} ${className}`}
      aria-hidden="true"
    />
  )
}
