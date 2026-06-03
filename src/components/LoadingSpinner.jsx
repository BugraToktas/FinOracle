export default function LoadingSpinner({ size = 'default', className = '' }) {
  const sizeClass = size === 'lg' ? 'fin-spinner fin-spinner-lg' : 'fin-spinner'
  return (
    <div className={`min-h-screen flex items-center justify-center bg-fin-bg ${className}`}>
      <div className={sizeClass} role="status" aria-label="Loading" />
    </div>
  )
}
