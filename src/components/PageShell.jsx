export default function PageShell({ children, className = '', maxWidth = 'page-shell-wide', centered = true }) {
  const classes = [
    'page-shell',
    'page-enter',
    'w-full',
    centered && 'mx-auto',
    maxWidth,
    className,
  ].filter(Boolean).join(' ')
  return <div className={classes}>{children}</div>
}
