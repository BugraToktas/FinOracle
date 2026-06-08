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

/** Returns up-to-2 uppercase initials from an email */
function getInitials(email = '') {
  const name = email.split('@')[0] ?? ''
  const parts = name.split(/[._\-]/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

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
    onClose()
  }

  function goHome() {
    navigate('/')
    onClose()
  }

  const initials = getInitials(user?.email)

  return (
    <aside
      className={`
        fixed inset-y-0 left-0 z-50
        w-64 md:w-56
        flex flex-col bg-fin-card/98 border-r border-fin-border backdrop-blur-md
        h-dvh min-h-screen shadow-xl md:shadow-none
        overflow-hidden
        transition-transform duration-300 ease-out
        ${open ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}
    >
      {/* ── Logo row — gradient accent underline via CSS ──────────── */}
      <div className="sidebar-logo-row flex items-center justify-between px-5 py-5">
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
          className="md:hidden p-1.5 text-fin-muted hover:text-fin-text transition-colors rounded-lg hover:bg-fin-border/30"
          aria-label="Close menu"
        >
          <X size={18} />
        </button>
      </div>

      {/* ── Nav + user section ───────────────────────────────────── */}
      <div className="flex-1 flex flex-col py-4 px-2 min-h-0 overflow-y-auto">
        <nav className="space-y-0.5">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={handleNavClick}
              className={({ isActive }) =>
                `sidebar-nav-item flex items-center gap-3 px-3 py-2.5 rounded-lg text-base font-medium ${
                  isActive ? 'sidebar-nav-active' : 'text-fin-muted'
                }`
              }
            >
              <Icon size={17} className="shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Language + user — pinned footer */}
        <div className="sidebar-footer mt-auto">
          <div className="flex items-center gap-1.5">
            <Globe size={16} className="text-fin-muted mr-0.5 shrink-0" />
            {LANGS.map((l) => (
              <button
                key={l.code}
                onClick={() => changeLang(l.code)}
                className={`text-sm px-3 py-1.5 rounded-md transition-all duration-150 min-w-[2.5rem] ${
                  i18n.language === l.code
                    ? 'bg-fin-accent/20 text-fin-accent font-semibold'
                    : 'text-fin-muted hover:text-fin-text hover:bg-fin-border/30'
                }`}
              >
                {l.label}
              </button>
            ))}
          </div>

          {user ? (
            <div className="flex items-center gap-3">
              <div className="sidebar-avatar" aria-hidden="true">
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-base text-fin-text font-semibold truncate leading-snug">
                  {user.email?.split('@')[0]}
                </p>
                <p className="text-sm text-fin-muted/60 truncate mt-0.5">{user.email}</p>
              </div>
              <button
                onClick={handleSignOut}
                title={t('nav.signOut')}
                className="text-fin-muted hover:text-fin-down transition-colors shrink-0 p-2 rounded-lg hover:bg-fin-down/10"
              >
                <LogOut size={18} />
              </button>
            </div>
          ) : (
            <p className="text-sm text-fin-muted/60">FinOracle v1.0</p>
          )}
        </div>
      </div>
    </aside>
  )
}
