import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { api } from '../../lib/api'
import { getBackend, subscribeBackend } from '../../lib/backend'
import { TimedBar } from '../../components/TimedBar'
import { pixelWidthAt, revealElapsed, type PixelgesichtPhase, type PixelgesichtSettings } from './types'

/** Resolve + decode the item image; re-runs when the path changes. Waits for
 *  the data backend — the audience window adopts it asynchronously. */
export function useItemImage(file: string | null): { img: HTMLImageElement | null; error: string | null } {
  const backend = useSyncExternalStore(subscribeBackend, getBackend)
  const [img, setImg] = useState<HTMLImageElement | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setImg(null)
    setError(null)
    if (!file || !backend) return
    let cancelled = false
    api
      .mediaUrl(file)
      .then(
        (url) =>
          new Promise<HTMLImageElement>((resolve, reject) => {
            const el = new Image()
            el.onload = () => resolve(el)
            el.onerror = () => reject(new Error(file))
            el.src = url
          }),
      )
      .then((el) => !cancelled && setImg(el))
      .catch((e) => !cancelled && setError(String(e)))
    return () => {
      cancelled = true
    }
  }, [file])

  return { img, error }
}

/** Upscale target cap — plenty for a beamer, keeps canvas memory small. */
const MAX_DIM = 1600

/** Width the image is actually rendered at (natural size, capped). */
export function canvasWidth(img: HTMLImageElement): number {
  const scale = Math.min(1, MAX_DIM / Math.max(img.naturalWidth, img.naturalHeight))
  return Math.max(1, Math.round(img.naturalWidth * scale))
}

/**
 * Downscale `source` to w×h by successive halving. A single drawImage call
 * silently clips the source at extreme ratios in Chrome (observed at ~80:1
 * with canvas sources), so never scale by more than 2× per step.
 */
export function mosaicOf(source: CanvasImageSource, sw: number, sh: number, w: number, h: number): HTMLCanvasElement {
  let cur: HTMLCanvasElement | null = null
  let cw = sw
  let ch = sh
  for (;;) {
    const nw = Math.max(w, Math.ceil(cw / 2))
    const nh = Math.max(h, Math.ceil(ch / 2))
    const next = document.createElement('canvas')
    next.width = nw
    next.height = nh
    const nctx = next.getContext('2d')
    if (!nctx) return next
    nctx.imageSmoothingEnabled = true
    nctx.imageSmoothingQuality = 'high'
    nctx.drawImage(cur ?? source, 0, 0, cw, ch, 0, 0, nw, nh)
    cur = next
    cw = nw
    ch = nh
    if (nw <= w && nh <= h) return cur
  }
}

/**
 * Draws `img` as a hard-edged mosaic of `pxWidth` blocks across (null =
 * original). Two-pass: downscale WITH smoothing (each block becomes the
 * average of its area, like a true mosaic), then upscale WITHOUT smoothing
 * (nearest neighbor), so the blocks stay razor-sharp — no blur.
 */
export function PixelCanvas({
  img,
  pxWidth,
  className,
}: {
  img: HTMLImageElement
  pxWidth: number | null
  className?: string
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const scale = Math.min(1, MAX_DIM / Math.max(img.naturalWidth, img.naturalHeight))
    const W = Math.max(1, Math.round(img.naturalWidth * scale))
    const H = Math.max(1, Math.round(img.naturalHeight * scale))
    if (canvas.width !== W || canvas.height !== H) {
      canvas.width = W
      canvas.height = H
    }
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    if (pxWidth === null || pxWidth >= W) {
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(img, 0, 0, W, H)
      return
    }

    const w = Math.max(1, Math.round(pxWidth))
    const h = Math.max(1, Math.round((w * img.naturalHeight) / img.naturalWidth))
    const mosaic = mosaicOf(img, img.naturalWidth, img.naturalHeight, w, h)

    ctx.imageSmoothingEnabled = false
    ctx.drawImage(mosaic, 0, 0, w, h, 0, 0, W, H)
  }, [img, pxWidth])

  return <canvas ref={canvasRef} className={className} />
}

/**
 * Seconds of reveal progress for the current phase, self-ticking while the
 * reveal runs. Derived from the host-stamped wall-clock fields, so host and
 * audience windows stay in sync without extra messages. The 10 Hz tick only
 * re-renders; the canvas repaints just when the quantized step changes.
 */
export function useRevealElapsed(phase: PixelgesichtPhase, settings: PixelgesichtSettings): number {
  const [, bump] = useState(0)

  const running =
    phase.t === 'revealing' &&
    phase.startedAt != null &&
    revealElapsed(phase, settings, Date.now()) < settings.revealSec
  useEffect(() => {
    if (!running) return
    const iv = setInterval(() => bump((n) => n + 1), 100)
    return () => clearInterval(iv)
  }, [running])

  switch (phase.t) {
    case 'intro':
      return 0
    case 'revealing':
      return revealElapsed(phase, settings, Date.now())
    case 'answer':
      return Math.min(settings.revealSec, phase.stoppedAt ?? settings.revealSec)
    case 'reveal':
      return settings.revealSec
  }
}

/** The item image at the pixelation the current phase dictates (self-ticking
 *  while the reveal runs, frozen in every other phase). */
export function PhasePixelImage({
  img,
  phase,
  settings,
  className,
}: {
  img: HTMLImageElement
  phase: PixelgesichtPhase
  settings: PixelgesichtSettings
  className?: string
}) {
  const elapsed = useRevealElapsed(phase, settings)
  const pxWidth = phase.t === 'reveal' ? null : pixelWidthAt(elapsed, settings, canvasWidth(img))
  const cls = phase.t === 'reveal' ? [className, 'unblur'].filter(Boolean).join(' ') : className
  return <PixelCanvas img={img} pxWidth={pxWidth} className={cls} />
}

/**
 * Reveal-timeline progress. Computed straight from the host-stamped phase
 * (no ticker): re-renders only on phase changes, so the underlying CSS
 * transition of TimedBar runs uninterrupted.
 */
export function RevealProgress({
  phase,
  settings,
  compact,
}: {
  phase: PixelgesichtPhase
  settings: PixelgesichtSettings
  compact?: boolean
}) {
  const total = Math.max(0.1, settings.revealSec)
  let frac = 0
  let remaining: number | null = null
  if (phase.t === 'revealing') {
    const pos = revealElapsed(phase, settings, Date.now())
    frac = Math.min(1, pos / total)
    if (phase.startedAt != null && pos < total) remaining = total - pos
  } else if (phase.t === 'answer') {
    frac = Math.min(1, (phase.stoppedAt ?? total) / total)
  } else if (phase.t === 'reveal') {
    frac = 1
  }
  return <TimedBar frac={frac} remainingSec={remaining} compact={compact} />
}
