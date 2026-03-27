import { NavLink } from 'react-router-dom'
import { LayoutDashboard, Activity, PlusCircle, ShieldCheck, TrendingUp } from 'lucide-react'

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/events', label: 'Events', icon: Activity },
  { to: '/new-event', label: 'New Event', icon: PlusCircle },
  { to: '/credibility', label: 'Credibility', icon: ShieldCheck },
]

export default function Sidebar() {
  return (
    <aside className="w-56 shrink-0 flex flex-col bg-fin-card border-r border-fin-border min-h-screen">
      <div className="flex items-center gap-2 px-5 py-5 border-b border-fin-border">
        <TrendingUp className="text-fin-accent" size={22} />
        <span className="text-fin-text font-bold text-lg tracking-tight animate-glow">
          FinOracle
        </span>
      </div>

      <nav className="flex-1 py-4 px-2 space-y-1">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-150 ${
                isActive
                  ? 'bg-fin-accent/15 text-fin-accent'
                  : 'text-fin-muted hover:text-fin-text hover:bg-fin-border/30'
              }`
            }
          >
            <Icon size={16} />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="px-4 py-4 border-t border-fin-border">
        <p className="text-xs text-fin-muted">FinOracle v1.0</p>
        <p className="text-xs text-fin-muted/60 mt-0.5">AI Market Analysis</p>
      </div>
    </aside>
  )
}
