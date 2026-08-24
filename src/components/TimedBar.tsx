import { useLayoutEffect, useRef } from 'react'

/**
 * Progress bar driven by a single CSS width transition instead of a rAF loop:
 * the compositor keeps animating even when the window is occluded or the tab
 * throttles JS timers (Windows/macOS Chrome pause rAF in covered windows —
 * a live show regularly has the host window buried under the beamer window).
 */
export function TimedBar({
  frac,
  remainingSec,
  compact,
}: {
  /** Current fill fraction 0..1. */
  frac: number
  /** Seconds until the bar should reach 100%; null = hold still. */
  remainingSec: number | null
  compact?: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.transition = 'none'
    el.style.width = `${Math.min(100, Math.max(0, frac * 100))}%`
    if (remainingSec === null || remainingSec <= 0.01) return
    void el.offsetWidth // flush, so the transition starts from the set width
    el.style.transition = `width ${remainingSec}s linear`
    el.style.width = '100%'
  }, [frac, remainingSec])

  return (
    <div className={`stage-progress${compact ? ' compact' : ''}`}>
      <div ref={ref} />
    </div>
  )
}
