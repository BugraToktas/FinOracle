import { useRef } from 'react'

function getFillClass(pct) {
  if (pct >= 70) return 'confidence-fill-high'
  if (pct >= 40) return 'confidence-fill-mid'
  return 'confidence-fill-low'
}

function getLabelClass(pct) {
  if (pct >= 70) return 'confidence-label-high'
  if (pct >= 40) return 'confidence-label-mid'
  return 'confidence-label-low'
}

export default function ConfidenceBar({ value }) {
  const pct = Math.round((value ?? 0) * 100)
  const fillClass  = getFillClass(pct)
  const labelClass = getLabelClass(pct)

  return (
    <div className="flex items-center gap-2.5">
      <div className="flex-1 confidence-track">
        <div
          className={`confidence-fill ${fillClass}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={`confidence-label ${labelClass}`}>{pct}%</span>
    </div>
  )
}
