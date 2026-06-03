import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  Sparkles, ShieldCheck, Globe,
  BarChart2, ChevronRight, ArrowRight, Check,
  BookOpen, Zap, Target,
} from 'lucide-react'
import { getLandingStats } from '../services/landingService'
import LandingInteractiveBg from '../components/LandingInteractiveBg'
import Logo from '../components/Logo'

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
        const ease = 1 - Math.pow(1 - progress, 3)
        setValue(Math.round(target * ease))
        if (progress < 1) requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    }, { threshold: 0.3 })
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [target])

  return (
    <span ref={ref} className="tabular-nums">
      {value.toLocaleString()}{suffix}
    </span>
  )
}

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
    <div className="min-h-screen bg-fin-bg text-fin-text overflow-x-hidden page-enter relative">
      <LandingInteractiveBg />

      {/* NAV */}
      <nav className="landing-nav relative z-10">
        <div className="landing-container h-16 flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="landing-logo-btn shrink-0"
            aria-label="FinOracle home"
          >
            <Logo size="md" />
            <span className="font-bold text-lg text-fin-text tracking-tight">FinOracle</span>
          </button>

          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden sm:flex items-center gap-1">
              {LANGS.map((l) => (
                <button
                  key={l.code}
                  onClick={() => changeLang(l.code)}
                  className={`text-sm px-3 py-1.5 rounded-lg transition-all duration-150 ${
                    i18n.language === l.code
                      ? 'bg-fin-accent/20 text-fin-accent font-semibold'
                      : 'text-fin-muted hover:text-fin-text hover:bg-fin-border/30'
                  }`}
                >
                  {l.label}
                </button>
              ))}
            </div>
            <button
              onClick={() => navigate('/login')}
              className="text-sm text-fin-muted hover:text-fin-text transition-colors hidden sm:block px-3 py-2 rounded-lg hover:bg-fin-border/20 cursor-pointer"
            >
              {t('landing.nav.signIn')}
            </button>
            <button
              onClick={() => navigate('/login')}
              className="btn-primary text-sm px-5 py-2.5"
            >
              {t('landing.nav.getStarted')}
            </button>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section className="relative z-10 pt-28 pb-20 sm:pt-36 sm:pb-28 overflow-hidden">
        <div className="landing-container relative landing-container-narrow text-center">
          <div className="landing-hero-badge mb-7 animate-fade-in-up">
            <Sparkles size={14} />
            {t('landing.hero.badge')}
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-[3.25rem] font-bold text-fin-text leading-[1.12] mb-6 tracking-tight animate-fade-in-up hero-delay-1">
            {t('landing.hero.title')}
          </h1>

          <p className="text-lg sm:text-xl text-fin-muted leading-relaxed max-w-2xl mx-auto mb-10 animate-fade-in-up hero-delay-2">
            {t('landing.hero.subtitle')}
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 animate-fade-in-up hero-delay-3">
            <button
              onClick={() => navigate('/login')}
              className="btn-primary flex items-center gap-2 text-base px-7 py-3.5 w-full sm:w-auto justify-center"
            >
              <Sparkles size={18} />
              {t('landing.hero.cta')}
              <ArrowRight size={17} />
            </button>
            <a
              href="#how-it-works"
              className="btn-secondary flex items-center gap-2 text-sm px-5 py-3 w-full sm:w-auto justify-center"
            >
              {t('landing.hero.demo')}
              <ChevronRight size={15} />
            </a>
          </div>
          <p className="text-sm text-fin-muted/70 mt-4 animate-fade-in-up hero-delay-3">
            {t('landing.hero.ctaSub')}
          </p>

          {/* Demo preview */}
          <div className="mt-16 glass-panel glass-panel-hover landing-demo-card max-w-xl mx-auto animate-fade-in-up hero-delay-4">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-fin-up animate-pulse" />
                <span className="text-sm text-fin-muted font-mono">Live analysis · THYAO</span>
              </div>
              <span className="text-xs px-2 py-0.5 rounded-full bg-fin-up/15 text-fin-up font-semibold border border-fin-up/25">
                Verified
              </span>
            </div>
            <p className="text-base text-fin-text/90 italic mb-4 leading-relaxed">
              "Why did Turkish Airlines surge +8% on March 15, 2026?"
            </p>
            <p className="text-sm text-fin-muted leading-relaxed line-clamp-3 mb-4">
              Strong Q4 2025 earnings beat analyst estimates by 23%, driven by record international passenger growth and lower fuel costs. Bullish guidance for H1 2026 triggered institutional buying across the session…
            </p>
            <div className="flex items-center justify-between pt-3 border-t border-fin-border/40">
              <div className="flex items-center gap-2 text-sm text-fin-muted">
                <BookOpen size={14} />
                5 sources cited
              </div>
              <div className="flex items-center gap-2">
                <div className="w-24 h-2 bg-fin-border rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-fin-up transition-all duration-700" style={{ width: '82%' }} />
                </div>
                <span className="text-sm text-fin-up font-mono font-semibold tabular-nums">82%</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* STATS */}
      <section className="relative z-10 border-y border-fin-border/40 bg-fin-card/30 py-10 sm:py-12 backdrop-blur-[2px]">
        <div className="landing-container">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 stagger-list">
            {[
              { key: 'analyses', value: stats?.totalAnalyses, suffix: '+' },
              { key: 'sources',  value: stats?.totalSources,  suffix: '+' },
              { key: 'assets',   value: stats?.totalAssets,   suffix: '' },
              { key: 'verified', value: stats?.verifiedCount, suffix: '+' },
            ].map(({ key, value, suffix }) => (
              <div key={key} className="landing-stat-cell text-center">
                <p className="text-3xl sm:text-4xl font-bold text-fin-text mb-1.5">
                  {value != null
                    ? <Counter target={value} suffix={suffix} />
                    : <span className="text-fin-muted">—</span>
                  }
                </p>
                <p className="text-sm text-fin-muted leading-snug">{t(`landing.stats.${key}`)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="relative z-10 py-20 sm:py-28">
        <div className="landing-container">
          <div className="text-center mb-14 max-w-2xl mx-auto">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-fin-text mb-4 tracking-tight">
              {t('landing.features.title')}
            </h2>
            <p className="text-base sm:text-lg text-fin-muted leading-relaxed">
              {t('landing.features.subtitle')}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 lg:gap-6 stagger-list">
            {[
              { icon: Sparkles,    key: 'f1', accent: 'text-fin-accent',  bg: 'bg-fin-accent/12' },
              { icon: ShieldCheck, key: 'f2', accent: 'text-fin-up',      bg: 'bg-fin-up/12'     },
              { icon: Target,      key: 'f3', accent: 'text-yellow-400',  bg: 'bg-yellow-400/12' },
              { icon: Globe,       key: 'f4', accent: 'text-violet-400',  bg: 'bg-violet-400/12' },
            ].map(({ icon: Icon, key, accent, bg }) => (
              <div key={key} className="glass-panel glass-panel-hover landing-feature-card group">
                <div className={`w-12 h-12 rounded-xl ${bg} flex items-center justify-center mb-5 group-hover:scale-105 transition-transform duration-200`}>
                  <Icon size={22} className={accent} />
                </div>
                <h3 className="text-lg font-semibold text-fin-text mb-2.5">
                  {t(`landing.features.${key}Title`)}
                </h3>
                <p className="text-base text-fin-muted leading-relaxed">
                  {t(`landing.features.${key}Desc`)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how-it-works" className="relative z-10 py-20 sm:py-28 border-t border-fin-border/30 bg-fin-dark/40 backdrop-blur-[2px]">
        <div className="landing-container landing-container-narrow">
          <div className="text-center mb-14">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-fin-text tracking-tight">
              {t('landing.how.title')}
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 stagger-list">
            {[
              { num: '1', icon: Zap,       key: 's1', color: 'text-fin-accent bg-fin-accent/15' },
              { num: '2', icon: BarChart2, key: 's2', color: 'text-fin-up bg-fin-up/15'         },
              { num: '3', icon: Check,     key: 's3', color: 'text-yellow-400 bg-yellow-400/15' },
            ].map(({ num, icon: Icon, key, color }) => (
              <div key={key} className="landing-step-card flex flex-col items-center text-center">
                <div className={`w-14 h-14 rounded-full flex items-center justify-center mb-4 ${color}`}>
                  <Icon size={24} />
                </div>
                <p className="text-sm text-fin-muted font-mono mb-2">Step {num}</p>
                <h3 className="text-lg font-semibold text-fin-text mb-2">
                  {t(`landing.how.${key}`)}
                </h3>
                <p className="text-base text-fin-muted leading-relaxed">
                  {t(`landing.how.${key}Desc`)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* MARKETS */}
      <section className="relative z-10 py-16 sm:py-20 border-t border-fin-border/30">
        <div className="landing-container landing-container-narrow">
          <h2 className="text-center text-sm font-semibold text-fin-muted uppercase tracking-widest mb-10">
            {t('landing.markets.title')}
          </h2>
          <div className="flex flex-wrap justify-center gap-3 sm:gap-4">
            {MARKETS.map((m) => (
              <div key={m.label} className="landing-market-chip">
                <span className="text-base font-mono font-semibold text-fin-text">{m.label}</span>
                <span className="text-xs text-fin-muted/80 mt-1">{m.sub}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="relative z-10 py-20 sm:py-28 px-4 sm:px-6 border-t border-fin-border/30 overflow-hidden">
        <div className="landing-container relative max-w-3xl">
          <div className="landing-cta-panel text-center">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-fin-text mb-4 tracking-tight">
              {t('landing.cta.title')}
            </h2>
            <p className="text-fin-muted mb-8 text-lg leading-relaxed max-w-lg mx-auto">
              {t('landing.cta.subtitle')}
            </p>
            <button
              onClick={() => navigate('/login')}
              className="btn-primary flex items-center gap-2 text-base px-8 py-3.5 mx-auto justify-center"
            >
              <Sparkles size={18} />
              {t('landing.cta.button')}
              <ArrowRight size={17} />
            </button>
            <button
              onClick={() => navigate('/login')}
              className="mt-5 block text-sm text-fin-muted hover:text-fin-accent transition-colors mx-auto cursor-pointer link-subtle"
            >
              {t('landing.cta.login')}
            </button>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="relative z-10 border-t border-fin-border/30 py-10 bg-fin-dark/60 backdrop-blur-[2px]">
        <div className="landing-container flex flex-col sm:flex-row items-center justify-between gap-5 text-sm text-fin-muted/70">
          <div className="flex items-center gap-2 flex-wrap justify-center sm:justify-start">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="flex items-center gap-2 cursor-pointer hover:opacity-90 transition-opacity"
            >
              <Logo size="xs" />
              <span className="font-semibold text-fin-muted">FinOracle</span>
            </button>
            <span className="hidden sm:inline">·</span>
            <span className="text-center sm:text-left">{t('landing.footer.tagline')}</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1 sm:hidden">
              {LANGS.map((l) => (
                <button
                  key={l.code}
                  onClick={() => changeLang(l.code)}
                  className={`text-sm px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                    i18n.language === l.code
                      ? 'text-fin-accent bg-fin-accent/15'
                      : 'text-fin-muted/70 hover:text-fin-muted'
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
