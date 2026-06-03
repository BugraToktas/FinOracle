import { NavLink, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  LayoutDashboard, Activity, PlusCircle, ShieldCheck,
  LogOut, Globe, X, Settings2,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import Logo from './Logo'

const LANGS = [
  { code: 'en', label: 'EN' },
  { code: 'tr', label: 'TR' },
]

export default function Sidebar({ open = false, onClose = () => {} }) {
  const { t, i18n } = useTranslation()
  const { user, isAdmin, signOut } = useAuth()
  const navigate = useNavigate()

  const navItems = [
    { to: '/dashboard',   label: t('nav.dashboard'),   icon: LayoutDashboard },
    { to: '/events',      label: t('nav.events'),       icon: Activity },
    { to: '/new-event',   label: t('nav.newEvent'),     icon: PlusCircle },
    { to: '/credibility', label: t('nav.credibility'),  icon: ShieldCheck },
    ...(isAdmin ? [{ to: '/admin', label: t('nav.admin'), icon: Settings2 }] : []),
  ]

  function changeLang(code) {
    i18n.changeLanguage(code)
    localStorage.setItem('finoracle_lang', code)
  }

  async function handleSignOut() {
    await signOut()
    navigate('/login', { replace: true })
  }

  function handleNavClick() {
    // Close drawer on mobile after navigation
    onClose()
  }

  function goHome() {
    navigate('/')
    onClose()
  }

  return (
    <aside
      className={`
        fixed md:static inset-y-0 left-0 z-50
        w-64 md:w-56 shrink-0
        flex flex-col bg-fin-card/98 border-r border-fin-border backdrop-blur-md
        min-h-screen shadow-xl md:shadow-none
        transition-transform duration-300 ease-out
        ${open ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}
    >
      {/* ── Logo row ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-5 py-5 border-b border-fin-border">
        <button
          type="button"
          onClick={goHome}
          className="flex items-center gap-2 rounded-lg text-left cursor-pointer hover:opacity-90 transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-fin-accent/50"
          aria-label="FinOracle home"
        >
          <Logo size="sm" />
          <span className="text-fin-text font-bold text-lg tracking-tight">
            FinOracle
          </span>
        </button>
        {/* Close button — mobile only */}
        <button
          onClick={onClose}
          className="md:hidden p-1.5 text-fin-muted hover:text-fin-text transition-colors rounded-lg"
          aria-label="Close menu"
        >
          <X size={18} />
        </button>
      </div>

      {/* ── Nav + user section ───────────────────────────────────── */}
      <div className="flex-1 flex flex-col py-4 px-2">
        <nav className="space-y-1">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={handleNavClick}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-3 md:py-2.5 rounded-lg text-base font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-fin-accent/15 text-fin-accent shadow-sm shadow-fin-accent/5'
                    : 'text-fin-muted hover:text-fin-text hover:bg-fin-border/30 hover:translate-x-0.5'
                }`
              }
            >
              <Icon size={18} className="shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Language + user — right below nav */}
        <div className="mt-4 pt-4 border-t border-fin-border space-y-3 px-2">
          {/* Language switcher */}
          <div className="flex items-center gap-1">
            <Globe size={13} className="text-fin-muted mr-1 shrink-0" />
            {LANGS.map((l) => (
              <button
                key={l.code}
                onClick={() => changeLang(l.code)}
                className={`text-sm px-2.5 py-1 rounded transition-all duration-150 ${
                  i18n.language === l.code
                    ? 'bg-fin-accent/20 text-fin-accent font-semibold'
                    : 'text-fin-muted hover:text-fin-text hover:bg-fin-border/30'
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
                <p className="text-sm text-fin-text font-medium truncate">
                  {user.email?.split('@')[0]}
                </p>
                <p className="text-sm text-fin-muted/60 truncate">{user.email}</p>
              </div>
              <button
                onClick={handleSignOut}
                title={t('nav.signOut')}
                className="text-fin-muted hover:text-fin-down transition-colors ml-2 shrink-0 p-1.5 rounded-lg hover:bg-fin-down/10"
              >
                <LogOut size={16} />
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
