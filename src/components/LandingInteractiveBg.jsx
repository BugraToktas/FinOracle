import { useEffect, useRef } from 'react'

/**
 * Subtle full-page ambient background for Landing.
 * Mouse parallax + slow drift; disabled when prefers-reduced-motion.
 */
export default function LandingInteractiveBg() {
  const layerRef = useRef(null)
  const target = useRef({ x: 0.5, y: 0.5 })
  const current = useRef({ x: 0.5, y: 0.5 })
  const raf = useRef(null)

  useEffect(() => {
    const layer = layerRef.current
    if (!layer) return

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) {
      layer.style.setProperty('--mouse-x', '0.5')
      layer.style.setProperty('--mouse-y', '0.5')
      return
    }

    function onMove(e) {
      target.current = {
        x: e.clientX / window.innerWidth,
        y: e.clientY / window.innerHeight,
      }
    }

    function tick() {
      const t = target.current
      const c = current.current
      c.x += (t.x - c.x) * 0.06
      c.y += (t.y - c.y) * 0.06
      layer.style.setProperty('--mouse-x', String(c.x))
      layer.style.setProperty('--mouse-y', String(c.y))
      raf.current = requestAnimationFrame(tick)
    }

    window.addEventListener('mousemove', onMove, { passive: true })
    raf.current = requestAnimationFrame(tick)

    return () => {
      window.removeEventListener('mousemove', onMove)
      if (raf.current) cancelAnimationFrame(raf.current)
    }
  }, [])

  return (
    <div ref={layerRef} className="landing-interactive-bg" aria-hidden="true">
      <div className="landing-bg-parallax">
        <div className="landing-bg-orb landing-bg-orb-primary" />
        <div className="landing-bg-orb landing-bg-orb-indigo" />
        <div className="landing-bg-orb landing-bg-orb-violet" />
        <div className="landing-bg-orb landing-bg-orb-accent-bottom" />
        <div className="landing-bg-grid" />
      </div>
    </div>
  )
}
