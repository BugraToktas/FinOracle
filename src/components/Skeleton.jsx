export default function Skeleton({ className = '', variant = 'text' }) {
  const baseClass = 'animate-pulse bg-fin-border/40'
  
  const variants = {
    text: 'h-4 rounded',
    circular: 'rounded-full',
    rectangular: 'rounded-lg',
  }

  return (
    <div className={`${baseClass} ${variants[variant]} ${className}`} />
  )
}
