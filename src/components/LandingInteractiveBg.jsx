import { useEffect, useRef } from 'react'

/**
 * Hero section background effects:
 *  1. Mouse-trail radial glow  (lerp-smoothed, transform-based)
 *  2. Concentric ripple rings  (CSS keyframes, velocity-driven opacity)
 *  3. Original parallax orbs + grid (unchanged)
 *
 * Disabled fully on:
 *  - pointer: coarse (mobile/touch)
 *  - prefers-reduced-motion: reduce
 */
export default function LandingInteractiveBg() {
  const parallaxRef   = useRef(null)
  const glowRef       = useRef(null)
  const ringsRef      = useRef(null)

  // Lerp state
  const targetPos  = useRef({ x: 0.5, y: 0.5 })
  const currentPos = useRef({ x: 0.5, y: 0.5 })

  // Velocity tracking
  const lastPos     = useRef({ x: 0, y: 0 })
  const velocity    = useRef(0)
  const rafId       = useRef(null)

  useEffect(() => {
    const glow     = glowRef.current
    const parallax = parallaxRef.current
    const rings    = ringsRef.current
    if (!glow || !parallax || !rings) return

    // ── Guard: reduced-motion ─────────────────────────────────────────────
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) {
      glow.style.opacity = '0'
      rings.style.opacity = '0'
      return
    }

    // ── Guard: touch / coarse pointer (mobile) ────────────────────────────
    const coarse = window.matchMedia('(pointer: coarse)').matches
    if (coarse) {
      glow.style.opacity = '0'
      rings.style.opacity = '0'
      return
    }

    // ── Mouse handler (throttled via rAF flag) ────────────────────────────
    let ticking = false
    function onMove(e) {
      if (ticking) return
      ticking = true
      requestAnimationFrame(() => {
        const nx = e.clientX / window.innerWidth
        const ny = e.clientY / window.innerHeight

        // velocity = distance moved (0-1 space)
        const dx = nx - lastPos.current.x
        const dy = ny - lastPos.current.y
        velocity.current = Math.sqrt(dx * dx + dy * dy)
        lastPos.current  = { x: nx, y: ny }

        targetPos.current = { x: nx, y: ny }
        ticking = false
      })
    }

    // ── Animation loop ────────────────────────────────────────────────────
    const LERP = 0.08
    const W    = window.innerWidth
    const H    = window.innerHeight

    function tick() {
      const t = targetPos.current
      const c = currentPos.current

      // Lerp positions
      c.x += (t.x - c.x) * LERP
      c.y += (t.y - c.y) * LERP

      const px = c.x * W
      const py = c.y * H

      // 1. Mouse glow — position via translate (GPU-composited)
      glow.style.transform = `translate(${px - 300}px, ${py - 300}px)`

      // 2. Parallax orbs
      parallax.style.transform = `translate(
        ${(c.x - 0.5) * 42}px,
        ${(c.y - 0.5) * 32}px
      )`

      // 3. Ripple ring intensity driven by velocity
      //    decay velocity so it fades when mouse stops
      velocity.current *= 0.88
      const boost  = Math.min(velocity.current * 18, 1)  // 0 → 1
      const baseOp = 0.045
      const maxOp  = 0.12
      const ringOp = baseOp + boost * (maxOp - baseOp)
      rings.style.setProperty('--ring-opacity', String(ringOp.toFixed(4)))

      rafId.current = requestAnimationFrame(tick)
    }

    window.addEventListener('mousemove', onMove, { passive: true })
    rafId.current = requestAnimationFrame(tick)

    return () => {
      window.removeEventListener('mousemove', onMove)
      if (rafId.current) cancelAnimationFrame(rafId.current)
    }
  }, [])

  return (
    <div className="landing-interactive-bg" aria-hidden="true">

      {/* ── Layer 1: static base + parallax orbs + grid ───────────────── */}
      <div ref={parallaxRef} className="landing-bg-parallax">
        <div className="landing-bg-orb landing-bg-orb-primary" />
        <div className="landing-bg-orb landing-bg-orb-indigo" />
        <div className="landing-bg-orb landing-bg-orb-violet" />
        <div className="landing-bg-orb landing-bg-orb-accent-bottom" />
        <div className="landing-bg-grid" />
      </div>

      {/* ── Layer 2: ripple / concentric rings ───────────────────────── */}
      <div ref={ringsRef} className="landing-ripple-layer" style={{ '--ring-opacity': '0.045' }}>
        <div className="landing-ring landing-ring-1" />
        <div className="landing-ring landing-ring-2" />
        <div className="landing-ring landing-ring-3" />
        <div className="landing-ring landing-ring-4" />
      </div>

      {/* ── Layer 3: mouse glow ──────────────────────────────────────── */}
      <div
        ref={glowRef}
        className="landing-mouse-glow"
        style={{ transform: 'translate(-9999px, -9999px)' }}
      />
    </div>
  )
}
