/**
 * Brand logo — place your image at: public/logo.png
 * Recommended: square PNG, 512×512 or larger, transparent background.
 */
const SIZES = {
  xs: 'h-6 w-6',
  sm: 'h-8 w-8',
  md: 'h-11 w-11',
  lg: 'h-14 w-14',
}

export default function Logo({ size = 'md', className = '', alt = 'FinOracle' }) {
  return (
    <img
      src="/logo.png"
      alt={alt}
      className={`object-contain shrink-0 ${SIZES[size] ?? SIZES.md} ${className}`}
      width={size === 'lg' ? 56 : size === 'md' ? 44 : size === 'sm' ? 32 : 24}
      height={size === 'lg' ? 56 : size === 'md' ? 44 : size === 'sm' ? 32 : 24}
      decoding="async"
    />
  )
}
