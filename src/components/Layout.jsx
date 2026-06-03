import { useState } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { Menu, TrendingUp } from 'lucide-react'
import Sidebar from './Sidebar'

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const navigate = useNavigate()

  return (
    <div className="flex min-h-screen bg-fin-dark">
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
          <TrendingUp size={18} className="text-fin-accent" />
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
      <main className="flex-1 overflow-y-auto pt-14 md:pt-0 min-w-0 bg-fin-bg">
        <Outlet />
      </main>
    </div>
  )
}
