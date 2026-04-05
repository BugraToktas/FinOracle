import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  TrendingUp, Sparkles, ShieldCheck, RefreshCw, Globe,
  BarChart2, ChevronRight, ArrowRight, Check,
  BookOpen, Zap, Target,
} from 'lucide-react'
import { getLandingStats } from '../services/landingService'

// ── Animated counter ──────────────────────────────────────────────────────────
function Counter({ target, suffix = '' }) {
  const [value, setValue] = useState(0)
  const ref = useRef(null)

  useEffect(() => {
    if (!target) return
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return
      observer.disconnect()
      const duration = 1600
      const start = Date.now()
      const tick = () => {
        const progress = Math.min((Date.now() - start) / duration, 1)
        const ease = 1 - Math.pow(1 - progress, 3) // ease-out cubic
        setValue(Math.round(target * ease))
        if (progress < 1) requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    }, { threshold: 0.3 })
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [target])

  return (
    <span ref={ref}>
      {value.toLocaleString()}{suffix}
    </span>
  )
}

// ── Market chips ──────────────────────────────────────────────────────────────
const MARKETS = [
  { label: 'BIST 100',    sub: 'Turkish equities' },
  { label: 'S&P 500',     sub: 'US equities' },
  { label: 'BTC / ETH',   sub: 'Crypto' },
  { label: 'USD/TRY',     sub: 'Forex' },
  { label: 'XAU/USD',     sub: 'Gold & commodities' },
  { label: 'DAX / FTSE',  sub: 'European' },
  { label: 'NASDAQ',      sub: 'Tech' },
  { label: 'Nikkei 225',  sub: 'Asian' },
]

const LANGS = [
  { code: 'en', label: 'EN' },
  { code: 'tr', label: 'TR' },
]

export default function Landing() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()

  const [stats, setStats] = useState(null)

  useEffect(() => {
    getLandingStats().then(setStats).catch(() => {})
  }, [])

  function changeLang(code) {
    i18n.changeLanguage(code)
    localStorage.setItem('finoracle_lang', code)
  }

  return (
    <div className="min-h-screen bg-fin-dark text-fin-text overflow-x-hidden">

      {/* ── NAV ───────────────────────────────────────────────────────────── */}
      <nav className="fixed top-0 left-0 right-0 z-40 border-b border-fin-border/40 backdrop-blur-md bg-fin-dark/80">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          {/* Logo */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-7 h-7 rounded-md bg-fin-accent flex items-center justify-center">
              <TrendingUp size={15} className="text-white" />
            </div>
            <span className="font-bold text-fin-text tracking-tight">FinOracle</span>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-2">
            {/* Lang switcher */}
            <div className="hidden sm:flex items-center gap-0.5">
              {LANGS.map((l) => (
                <button
                  key={l.code}
                  onClick={() => changeLang(l.code)}
                  className={`text-xs px-2.5 py-1 rounded transition-colors ${
                    i18n.language === l.code
                      ? 'bg-fin-accent/20 text-fin-accent font-semibold'
                      : 'text-fin-muted hover:text-fin-text'
                  }`}
                >
                  {l.label}
                </button>
              ))}
            </div>
            <button
              onClick={() => navigate('/login')}
              className="text-sm text-fin-muted hover:text-fin-text transition-colors hidden sm:block px-3 py-1.5"
            >
              {t('landing.nav.signIn')}
            </button>
            <button
              onClick={() => navigate('/login')}
              className="btn-primary text-sm px-4 py-2"
            >
              {t('landing.nav.getStarted')}
            </button>
          </div>
        </div>
      </nav>

      {/* ── HERO ──────────────────────────────────────────────────────────── */}
      <section className="relative pt-32 pb-20 sm:pt-40 sm:pb-28 px-4 sm:px-6 overflow-hidden">
        {/* Background glow */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] rounded-full bg-fin-accent/8 blur-[120px]" />
          <div className="absolute top-24 left-1/4 w-[300px] h-[300px] rounded-full bg-indigo-600/5 blur-[80px]" />
          <div className="absolute top-10 right-1/4 w-[250px] h-[250px] rounded-full bg-violet-600/5 blur-[80px]" />
        </div>

        <div className="relative max-w-4xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-fin-accent/30 bg-fin-accent/10 text-fin-accent text-xs font-medium mb-6">
            <Sparkles size={12} />
            {t('landing.hero.badge')}
          </div>

          {/* Headline */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-fin-text leading-tight mb-6 tracking-tight">
            {t('landing.hero.title')}
          </h1>

          {/* Subtitle */}
          <p className="text-lg sm:text-xl text-fin-muted leading-relaxed max-w-2xl mx-auto mb-8">
            {t('landing.hero.subtitle')}
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={() => navigate('/login')}
              className="btn-primary flex items-center gap-2 text-base px-6 py-3 w-full sm:w-auto justify-center"
            >
              <Sparkles size={17} />
              {t('landing.hero.cta')}
              <ArrowRight size={16} />
            </button>
            <a
              href="#how-it-works"
              className="flex items-center gap-2 text-sm text-fin-muted hover:text-fin-text transition-colors px-4 py-3"
            >
              {t('landing.hero.demo')}
              <ChevronRight size={14} />
            </a>
          </div>
          <p className="text-xs text-fin-muted/60 mt-3">{t('landing.hero.ctaSub')}</p>

          {/* Demo card preview */}
          <div className="mt-14 glass-panel p-5 max-w-lg mx-auto text-left shadow-2xl shadow-black/40">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 rounded-full bg-fin-up" />
              <span className="text-xs text-fin-muted font-mono">Live analysis · THYAO</span>
            </div>
            <p className="text-sm text-fin-text/80 italic mb-3">
              "Why did Turkish Airlines surge +8% on March 15, 2026?"
            </p>
            <div className="text-xs text-fin-muted leading-relaxed line-clamp-3 mb-3">
              Strong Q4 2025 earnings beat analyst estimates by 23%, driven by record international passenger growth and lower fuel costs. Bullish guidance for H1 2026 triggered institutional buying across the session…
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs text-fin-muted">
                <BookOpen size={11} />
                5 sources cited
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-20 h-1.5 bg-fin-border rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-fin-up" style={{ width: '82%' }} />
                </div>
                <span className="text-xs text-fin-up font-mono font-semibold">82%</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── STATS BAR ─────────────────────────────────────────────────────── */}
      <section className="border-y border-fin-border/40 bg-fin-card/40">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
          {[
            { key: 'analyses', value: stats?.totalAnalyses,  suffix: '+' },
            { key: 'sources',  value: stats?.totalSources,   suffix: '+' },
            { key: 'assets',   value: stats?.totalAssets,    suffix: '' },
            { key: 'verified', value: stats?.verifiedCount,  suffix: '+' },
          ].map(({ key, value, suffix }) => (
            <div key={key}>
              <p className="text-2xl sm:text-3xl font-bold text-fin-text mb-1">
                {value != null
                  ? <Counter target={value} suffix={suffix} />
                  : <span className="text-fin-muted">—</span>
                }
              </p>
              <p className="text-xs text-fin-muted">{t(`landing.stats.${key}`)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── FEATURES ──────────────────────────────────────────────────────── */}
      <section className="py-20 sm:py-28 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-2xl sm:text-3xl font-bold text-fin-text mb-3">
              {t('landing.features.title')}
            </h2>
            <p className="text-fin-muted">{t('landing.features.subtitle')}</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {[
              { icon: Sparkles,   key: 'f1', accent: 'text-fin-accent', bg: 'bg-fin-accent/10' },
              { icon: ShieldCheck,key: 'f2', accent: 'text-fin-up',     bg: 'bg-fin-up/10'     },
              { icon: Target,     key: 'f3', accent: 'text-yellow-400', bg: 'bg-yellow-400/10' },
              { icon: Globe,      key: 'f4', accent: 'text-violet-400', bg: 'bg-violet-400/10' },
            ].map(({ icon: Icon, key, accent, bg }) => (
              <div key={key} className="glass-panel p-6 hover:border-fin-border transition-colors group">
                <div className={`w-10 h-10 rounded-lg ${bg} flex items-center justify-center mb-4 group-hover:scale-105 transition-transform`}>
                  <Icon size={20} className={accent} />
                </div>
                <h3 className="text-base font-semibold text-fin-text mb-2">
                  {t(`landing.features.${key}Title`)}
                </h3>
                <p className="text-sm text-fin-muted leading-relaxed">
                  {t(`landing.features.${key}Desc`)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ──────────────────────────────────────────────────── */}
      <section id="how-it-works" className="py-20 sm:py-28 px-4 sm:px-6 border-t border-fin-border/30">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-2xl sm:text-3xl font-bold text-fin-text">
              {t('landing.how.title')}
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            {[
              { num: '1', icon: Zap,      key: 's1', color: 'text-fin-accent bg-fin-accent/15' },
              { num: '2', icon: BarChart2, key: 's2', color: 'text-fin-up bg-fin-up/15'         },
              { num: '3', icon: Check,     key: 's3', color: 'text-yellow-400 bg-yellow-400/15' },
            ].map(({ num, icon: Icon, key, color }, i) => (
              <div key={key} className="relative flex flex-col items-center text-center">
                {/* Connector line */}
                {i < 2 && (
                  <div className="hidden sm:block absolute top-6 left-[calc(50%+2rem)] right-0 h-px bg-fin-border/50" />
                )}
                <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 ${color}`}>
                  <Icon size={22} />
                </div>
                <p className="text-xs text-fin-muted font-mono mb-1">Step {num}</p>
                <h3 className="text-base font-semibold text-fin-text mb-2">
                  {t(`landing.how.${key}`)}
                </h3>
                <p className="text-sm text-fin-muted leading-relaxed">
                  {t(`landing.how.${key}Desc`)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── MARKETS ───────────────────────────────────────────────────────── */}
      <section className="py-16 px-4 sm:px-6 border-t border-fin-border/30">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-center text-sm font-medium text-fin-muted uppercase tracking-widest mb-8">
            {t('landing.markets.title')}
          </h2>
          <div className="flex flex-wrap justify-center gap-3">
            {MARKETS.map((m) => (
              <div
                key={m.label}
                className="flex flex-col items-center px-4 py-2.5 rounded-xl border border-fin-border/50 bg-fin-card/50 hover:border-fin-accent/40 transition-colors"
              >
                <span className="text-sm font-mono font-semibold text-fin-text">{m.label}</span>
                <span className="text-[10px] text-fin-muted/70 mt-0.5">{m.sub}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ─────────────────────────────────────────────────────── */}
      <section className="py-24 px-4 sm:px-6 border-t border-fin-border/30 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] rounded-full bg-fin-accent/10 blur-[100px]" />
        </div>
        <div className="relative max-w-2xl mx-auto text-center">
          <h2 className="text-2xl sm:text-4xl font-bold text-fin-text mb-4">
            {t('landing.cta.title')}
          </h2>
          <p className="text-fin-muted mb-8 text-lg">{t('landing.cta.subtitle')}</p>
          <button
            onClick={() => navigate('/login')}
            className="btn-primary flex items-center gap-2 text-base px-8 py-3.5 mx-auto justify-center"
          >
            <Sparkles size={17} />
            {t('landing.cta.button')}
            <ArrowRight size={16} />
          </button>
          <button
            onClick={() => navigate('/login')}
            className="mt-4 block text-sm text-fin-muted hover:text-fin-accent transition-colors mx-auto"
          >
            {t('landing.cta.login')}
          </button>
        </div>
      </section>

      {/* ── FOOTER ────────────────────────────────────────────────────────── */}
      <footer className="border-t border-fin-border/30 py-8 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-fin-muted/60">
          <div className="flex items-center gap-2">
            <TrendingUp size={13} className="text-fin-accent" />
            <span className="font-semibold text-fin-muted">FinOracle</span>
            <span>·</span>
            <span>{t('landing.footer.tagline')}</span>
          </div>
          <div className="flex items-center gap-4">
            {/* Mobile lang switcher in footer */}
            <div className="flex items-center gap-1 sm:hidden">
              {LANGS.map((l) => (
                <button
                  key={l.code}
                  onClick={() => changeLang(l.code)}
                  className={`text-xs px-2 py-0.5 rounded transition-colors ${
                    i18n.language === l.code ? 'text-fin-accent' : 'text-fin-muted/60 hover:text-fin-muted'
                  }`}
                >
                  {l.label}
                </button>
              ))}
            </div>
            <span>{t('landing.footer.rights')}</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
