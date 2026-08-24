import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import type { GameIntroProps } from '../../lib/types'
import { mosaicOf } from './PixelImage'
import type { PixelgesichtSettings } from './types'

/** Blocks across at the start — the word is an unreadable mosaic. */
const TITLE_START_BLOCKS = 14
/** Discrete sharpening steps of the intro animation. */
const TITLE_STEPS = 14

/**
 * The Pixelgesicht intro gag: the game title first shows as a coarse mosaic;
 * on the host's click it sharpens step by step — same mechanic the audience
 * is about to play — and lands on the crisp word. Rendered via canvas with
 * the wrapper's computed .stage-title font, so it matches the framework
 * typography exactly.
 */
export function PixelTitle({
  revealing,
  durationSec,
  gameName,
}: {
  revealing: boolean
  durationSec: number
  gameName: string
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const wrap = wrapRef.current
    const canvas = canvasRef.current
    if (!wrap || !canvas) return

    // Crisp master rendering of the title (2x for hi-dpi displays).
    const cs = getComputedStyle(wrap)
    const fontPx = Math.max(16, Math.round(parseFloat(cs.fontSize) * 2))
    const font = `${cs.fontWeight} ${fontPx}px ${cs.fontFamily}`
    const master = document.createElement('canvas')
    const mctx = master.getContext('2d')
    if (!mctx) return
    mctx.font = font
    const pad = Math.round(fontPx * 0.12)
    const W = Math.ceil(mctx.measureText(gameName).width) + pad * 2
    const H = Math.ceil(fontPx * 1.25)
    master.width = W
    master.height = H
    mctx.font = font
    mctx.fillStyle = cs.color
    mctx.textBaseline = 'middle'
    mctx.fillText(gameName, pad, H / 2 + fontPx * 0.04)

    canvas.width = W
    canvas.height = H
    canvas.style.width = `${W / 2}px`
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const draw = (blocks: number | null) => {
      ctx.clearRect(0, 0, W, H)
      if (blocks === null || blocks >= W) {
        ctx.imageSmoothingEnabled = true
        ctx.drawImage(master, 0, 0)
        return
      }
      const w = Math.max(2, Math.round(blocks))
      const h = Math.max(1, Math.round((w * H) / W))
      const small = mosaicOf(master, W, H, w, h)
      ctx.imageSmoothingEnabled = false
      ctx.drawImage(small, 0, 0, w, h, 0, 0, W, H)
    }

    if (!revealing) {
      draw(TITLE_START_BLOCKS)
      return
    }
    const startedAt = performance.now()
    const duration = Math.max(0.3, durationSec) * 1000
    let raf = 0
    let lastStep = -1
    const loop = (now: number) => {
      const p = Math.min(1, (now - startedAt) / duration)
      const step = Math.floor(p * TITLE_STEPS)
      if (step !== lastStep) {
        lastStep = step
        if (p >= 1) {
          draw(null)
          return
        }
        draw(TITLE_START_BLOCKS * Math.pow(W / TITLE_START_BLOCKS, step / TITLE_STEPS))
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [revealing, durationSec, gameName])

  return (
    <div ref={wrapRef} className="stage-title pixel-title">
      <canvas ref={canvasRef} />
    </div>
  )
}

export function IntroView({
  step,
  gameName,
  gameIdx,
  gameCount,
  hideGameCounter,
  settings,
}: GameIntroProps<PixelgesichtSettings>) {
  const { t } = useTranslation()

  return (
    <div className="stage-center">
      {!hideGameCounter && (
        <div className="stage-kicker">{t('show.gameOf', { n: gameIdx + 1, total: gameCount })}</div>
      )}
      {settings.introAnimation ? (
        <PixelTitle revealing={step >= 1} durationSec={settings.introRevealSec} gameName={gameName} />
      ) : (
        <div className="stage-title">{gameName}</div>
      )}
      {settings.tagline && <div className="stage-sub">{settings.tagline}</div>}
    </div>
  )
}
