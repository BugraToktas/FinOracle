import { useState } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { Menu } from 'lucide-react'
import Sidebar from './Sidebar'
import Logo from './Logo'

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const navigate = useNavigate()

  return (
    <div className="flex h-dvh min-h-screen overflow-hidden bg-fin-bg relative">
      {/* ── Ambient top-right glow — subtle accent breathe ───────── */}
      <div className="app-ambient-glow" aria-hidden="true" />

      {/* ── Mobile top bar ───────────────────────────────────────── */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-40 flex items-center gap-3 px-4 h-14 bg-fin-card/95 border-b border-fin-border backdrop-blur-md">
        <button
          onClick={() => setSidebarOpen(true)}
          className="p-2 -ml-1 text-fin-muted hover:text-fin-text transition-colors duration-150 rounded-lg hover:bg-fin-border/30"
          aria-label="Open menu"
        >
          <Menu size={22} />
        </button>
        <button
          type="button"
          onClick={() => navigate('/')}
          className="flex items-center gap-2 rounded-lg cursor-pointer hover:opacity-90 transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-fin-accent/50"
          aria-label="FinOracle home"
        >
          <Logo size="sm" />
          <span className="font-bold text-fin-text tracking-tight">FinOracle</span>
        </button>
      </header>

      {/* ── Backdrop (mobile only) ───────────────────────────────── */}
      {sidebarOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm animate-fade-in"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar ─────────────────────────────────────────────── */}
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* ── Main content ────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden pt-14 md:pt-0 md:ml-56 min-w-0 h-full bg-fin-bg relative z-10">
        <Outlet />
      </main>
    </div>
  )
}
