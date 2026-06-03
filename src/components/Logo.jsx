/**
 * Brand logo — place your image at: public/logo.png
 * Recommended: square PNG, 512×512 or larger, transparent background.
 */
const SIZES = {
  xs: 'h-5 w-5',
  sm: 'h-7 w-7',
  md: 'h-9 w-9',
  lg: 'h-11 w-11',
}

export default function Logo({ size = 'md', className = '', alt = 'FinOracle' }) {
  return (
    <img
      src="/logo.png"
      alt={alt}
      className={`object-contain shrink-0 ${SIZES[size] ?? SIZES.md} ${className}`}
      width={size === 'lg' ? 44 : size === 'md' ? 36 : size === 'sm' ? 28 : 20}
      height={size === 'lg' ? 44 : size === 'md' ? 36 : size === 'sm' ? 28 : 20}
      decoding="async"
    />
  )
}
