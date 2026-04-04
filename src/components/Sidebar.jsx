import { NavLink, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { LayoutDashboard, Activity, PlusCircle, ShieldCheck, TrendingUp, LogOut, Globe } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const LANGS = [
  { code: 'en', label: 'EN' },
  { code: 'tr', label: 'TR' },
]

export default function Sidebar() {
  const { t, i18n } = useTranslation()
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  const navItems = [
    { to: '/dashboard',   label: t('nav.dashboard'),   icon: LayoutDashboard },
    { to: '/events',      label: t('nav.events'),       icon: Activity },
    { to: '/new-event',   label: t('nav.newEvent'),     icon: PlusCircle },
    { to: '/credibility', label: t('nav.credibility'),  icon: ShieldCheck },
  ]

  function changeLang(code) {
    i18n.changeLanguage(code)
    localStorage.setItem('finoracle_lang', code)
  }

  async function handleSignOut() {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <aside className="w-56 shrink-0 flex flex-col bg-fin-card border-r border-fin-border min-h-screen">
      {/* Logo */}
      <div className="flex items-center gap-2 px-5 py-5 border-b border-fin-border">
        <TrendingUp className="text-fin-accent" size={22} />
        <span className="text-fin-text font-bold text-lg tracking-tight animate-glow">
          FinOracle
        </span>
      </div>

      {/* Nav + user info stacked together, no flex-1 stretch */}
      <div className="flex-1 flex flex-col py-4 px-2">
        <nav className="space-y-1">
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

        {/* Language + user: right below nav items */}
        <div className="mt-4 pt-4 border-t border-fin-border space-y-3 px-2">
        {/* Language switcher */}
        <div className="flex items-center gap-1">
          <Globe size={13} className="text-fin-muted mr-1" />
          {LANGS.map((l) => (
            <button
              key={l.code}
              onClick={() => changeLang(l.code)}
              className={`text-xs px-2 py-0.5 rounded transition-colors ${
                i18n.language === l.code
                  ? 'bg-fin-accent/20 text-fin-accent font-semibold'
                  : 'text-fin-muted hover:text-fin-text'
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>

        {/* User info */}
        {user ? (
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <p className="text-xs text-fin-text font-medium truncate">
                {user.email?.split('@')[0]}
              </p>
              <p className="text-xs text-fin-muted/60 truncate">{user.email}</p>
            </div>
            <button
              onClick={handleSignOut}
              title={t('nav.signOut')}
              className="text-fin-muted hover:text-fin-down transition-colors ml-2 shrink-0"
            >
              <LogOut size={15} />
            </button>
          </div>
        ) : (
          <p className="text-xs text-fin-muted/60">FinOracle v1.0</p>
        )}
        </div>
      </div>
    </aside>
  )
}
