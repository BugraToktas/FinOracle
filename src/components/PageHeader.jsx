export default function PageHeader({ title, subtitle, actions, icon: Icon, iconClassName = 'bg-fin-accent/15 text-fin-accent' }) {
  return (
    <div className="page-header">
      <div className="flex items-start gap-3 min-w-0 flex-1">
        {Icon && (
          <div className={`page-header-icon ${iconClassName}`}>
            <Icon size={20} />
          </div>
        )}
        <div className="min-w-0">
          <h1 className="page-title">{title}</h1>
          {subtitle && <p className="page-subtitle">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="page-header-actions">{actions}</div>}
    </div>
  )
}
