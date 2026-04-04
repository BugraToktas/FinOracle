import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Menu, TrendingUp } from 'lucide-react'
import Sidebar from './Sidebar'

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex min-h-screen bg-fin-dark">
      {/* ── Mobile top bar ───────────────────────────────────────── */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-40 flex items-center gap-3 px-4 h-14 bg-fin-card border-b border-fin-border">
        <button
          onClick={() => setSidebarOpen(true)}
          className="p-2 -ml-1 text-fin-muted hover:text-fin-text transition-colors rounded-lg"
          aria-label="Open menu"
        >
          <Menu size={22} />
        </button>
        <div className="flex items-center gap-2">
          <TrendingUp size={18} className="text-fin-accent" />
          <span className="font-bold text-fin-text tracking-tight">FinOracle</span>
        </div>
      </header>

      {/* ── Backdrop (mobile only) ───────────────────────────────── */}
      {sidebarOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar ─────────────────────────────────────────────── */}
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* ── Main content ────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto pt-14 md:pt-0 min-w-0">
        <Outlet />
      </main>
    </div>
  )
}
