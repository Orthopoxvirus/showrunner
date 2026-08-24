import { useEffect, useMemo, useRef } from 'react'
import type { Region } from './types'

interface Props {
  buffer: AudioBuffer
  task: Region
  reveal: Region
  active: 'task' | 'reveal'
  onChange(kind: 'task' | 'reveal', region: Region): void
  /** Free-listening cursor (forward seconds); set by a plain click. */
  cursor: number | null
  onCursor(sec: number): void
  /** Current playback position in FORWARD seconds, or null. Polled per frame. */
  getPlayhead(): number | null
}

const COLS = 1200
const TASK_COLOR = 'rgba(90, 162, 247, 0.28)'
const TASK_EDGE = '#5aa2f7'
const REVEAL_COLOR = 'rgba(79, 210, 138, 0.26)'
const REVEAL_EDGE = '#4fd28a'

function computePeaks(buffer: AudioBuffer): Float32Array {
  const data = buffer.getChannelData(0)
  const peaks = new Float32Array(COLS)
  const step = Math.max(1, Math.floor(data.length / COLS))
  for (let c = 0; c < COLS; c++) {
    let max = 0
    const from = c * step
    const to = Math.min(from + step, data.length)
    // sample within the window; stride keeps this fast for long songs
    const stride = Math.max(1, Math.floor((to - from) / 200))
    for (let i = from; i < to; i += stride) {
      const v = Math.abs(data[i])
      if (v > max) max = v
    }
    peaks[c] = max
  }
  return peaks
}

export function Waveform({ buffer, task, reveal, active, onChange, cursor, onCursor, getPlayhead }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const peaks = useMemo(() => computePeaks(buffer), [buffer])
  const duration = buffer.duration
  // click = set the cursor; only after moving a few pixels it becomes a
  // region drag, so setting the cursor never nudges a region
  const dragRef = useRef<{ sec: number; x: number; moved: boolean } | null>(null)
  const stateRef = useRef({ task, reveal, active, cursor, playhead: null as number | null })
  stateRef.current.task = task
  stateRef.current.reveal = reveal
  stateRef.current.active = active
  stateRef.current.cursor = cursor

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let raf = 0
    let lastKey = ''

    const draw = () => {
      const dpr = window.devicePixelRatio || 1
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
        canvas.width = w * dpr
        canvas.height = h * dpr
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)

      const { task: tk, reveal: rv } = stateRef.current
      const toX = (sec: number) => (sec / duration) * w

      // regions behind the waveform
      for (const [region, fill, edge] of [
        [tk, TASK_COLOR, TASK_EDGE],
        [rv, REVEAL_COLOR, REVEAL_EDGE],
      ] as const) {
        if (region.end > region.start) {
          const x1 = toX(region.start)
          const x2 = toX(region.end)
          ctx.fillStyle = fill
          ctx.fillRect(x1, 0, x2 - x1, h)
          ctx.fillStyle = edge
          ctx.fillRect(x1, 0, 1.5, h)
          ctx.fillRect(x2 - 1.5, 0, 1.5, h)
        }
      }

      // waveform
      ctx.fillStyle = '#8fa3c4'
      const mid = h / 2
      const colW = w / COLS
      for (let c = 0; c < COLS; c++) {
        const amp = Math.max(peaks[c] * (h * 0.46), 0.6)
        ctx.fillRect(c * colW, mid - amp, Math.max(colW - 0.4, 0.6), amp * 2)
      }

      // free-listening cursor
      const cur = stateRef.current.cursor
      if (cur !== null && cur >= 0 && cur <= duration) {
        ctx.fillStyle = 'rgba(233, 237, 243, 0.85)'
        ctx.fillRect(toX(cur) - 1, 0, 2, h)
        ctx.beginPath()
        ctx.moveTo(toX(cur) - 5, 0)
        ctx.lineTo(toX(cur) + 5, 0)
        ctx.lineTo(toX(cur), 7)
        ctx.closePath()
        ctx.fill()
      }

      // playhead
      const ph = stateRef.current.playhead
      if (ph !== null && ph >= 0 && ph <= duration) {
        ctx.fillStyle = '#f5b83d'
        ctx.fillRect(toX(ph) - 1, 0, 2, h)
      }
    }

    const loop = () => {
      const ph = getPlayhead()
      stateRef.current.playhead = ph
      const { task: tk, reveal: rv, cursor: cur } = stateRef.current
      const key = `${tk.start},${tk.end},${rv.start},${rv.end},${ph?.toFixed(2) ?? 'x'},${cur ?? 'x'},${canvas.clientWidth}`
      if (key !== lastKey) {
        lastKey = key
        draw()
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [peaks, duration, getPlayhead])

  const secAt = (clientX: number): number => {
    const canvas = canvasRef.current
    if (!canvas) return 0
    const rect = canvas.getBoundingClientRect()
    const frac = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
    return frac * duration
  }

  const round = (s: number) => Math.round(s * 10) / 10

  return (
    <canvas
      ref={canvasRef}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId)
        dragRef.current = { sec: secAt(e.clientX), x: e.clientX, moved: false }
      }}
      onPointerMove={(e) => {
        const drag = dragRef.current
        if (!drag) return
        if (!drag.moved && Math.abs(e.clientX - drag.x) < 4) return
        drag.moved = true
        const a = drag.sec
        const b = secAt(e.clientX)
        onChange(stateRef.current.active, {
          start: round(Math.min(a, b)),
          end: round(Math.max(a, b, Math.min(a, b) + 0.2)),
        })
      }}
      onPointerUp={() => {
        const drag = dragRef.current
        dragRef.current = null
        if (drag && !drag.moved) onCursor(round(drag.sec))
      }}
    />
  )
}
