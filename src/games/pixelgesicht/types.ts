import type { BacklogItemBase } from '../../lib/types'

export interface PixelgesichtItem extends BacklogItemBase {
  /** The solution — the person on the picture. */
  name: string
  /** Optional context shown under the name on the reveal (role, band, …). */
  info: string
  /** data-relative path, e.g. `games/pixelgesicht/media/portrait.jpg` */
  file: string | null
  /** Optional man/woman flag; unset = not applicable (e.g. a logo). */
  gender?: 'm' | 'f' | null
  /** Optional free-text category (Sport, Schauspieler, Politiker, …). */
  category?: string
}

/** Category suggestions offered in the editor; free text is always allowed. */
export const categorySuggestions = ['Sport', 'Schauspieler', 'Politiker', 'Comicfiguren', 'Musik', 'TV']

export interface PixelgesichtSettings {
  /** Total de-pixelation time until the original image shows, in seconds. */
  revealSec: number
  /** Mosaic width (in blocks) the image starts at. */
  startPx: number
  /** Mosaic width of the LAST stage before the original shows. Beyond this
   *  resolution a face is recognizable anyway; jumping straight to the
   *  original keeps the endgame snappy. */
  endPx: number
  /** Number of mosaic stages from startPx to endPx (geometric ladder). */
  steps: number
  /** Answer time after a buzz, in seconds. */
  answerSec: number
  /** How far the de-pixelation jumps back when guessing continues. */
  rewindSec: number
  /** Subtitle under the game title; empty string hides it. */
  tagline: string
  /** Item counter template with {{x}} (current) and {{y}} (total) variables;
   *  empty string hides the counter entirely. */
  itemLabel: string
  /** Play the pixelated-title reveal animation on the game intro. */
  introAnimation: boolean
  /** Duration of the intro title de-pixelation, in seconds. */
  introRevealSec: number
}

export const defaultSettings: PixelgesichtSettings = {
  revealSec: 18,
  startPx: 8,
  endPx: 157,
  steps: 12,
  answerSec: 5,
  rewindSec: 2,
  tagline: 'Wer erkennt das Gesicht?',
  itemLabel: 'Bild {{x}}',
  introAnimation: true,
  introRevealSec: 2.5,
}

/**
 * Phase machine, all JSON-serializable. All positions are seconds on the
 * reveal timeline (0 = fully pixelated, revealSec = original image).
 * `from`/`startedAt` (epoch ms) are stamped by the host when the reveal
 * (re)starts, so the audience window can animate the mosaic locally.
 */
export type PixelgesichtPhase =
  | { t: 'intro' }
  | { t: 'revealing'; resumeAt: number | null; from?: number | null; startedAt?: number | null }
  | { t: 'answer'; stoppedAt: number | null; deadline: number | null }
  | { t: 'reveal' }

/** Render the item counter template; null when disabled. */
export function renderItemLabel(settings: PixelgesichtSettings, x: number, y: number): string | null {
  const out = (settings.itemLabel ?? '')
    .replaceAll('{{x}}', String(x))
    .replaceAll('{{y}}', String(y))
    .trim()
  return out || null
}

/** Seconds of reveal progress at wall time `nowMs`, clamped to the timeline. */
export function revealElapsed(
  phase: PixelgesichtPhase & { t: 'revealing' },
  settings: PixelgesichtSettings,
  nowMs: number,
): number {
  const from = phase.from ?? phase.resumeAt ?? 0
  const running = phase.startedAt != null ? (nowMs - phase.startedAt) / 1000 : 0
  return Math.min(settings.revealSec, Math.max(0, from + running))
}

/**
 * The stage ladder: `steps` mosaic widths from `startPx` to `endPx`, built in
 * three phases —
 *   1. fine: +1 block per stage for the first ~third of the stages,
 *   2. ramp: geometric steps up to roughly endPx/2,
 *   3. finale: the last ~17% of the stages run geometrically into endPx.
 * Values are forced strictly increasing so every stage is a visible change.
 * Defaults: 8, 9, 10, 11, 15, 21, 29, 41, 57, 79, 111, 157 — held 1.5 s
 * each at the default 18 s reveal.
 */
export function pixelLadder(settings: PixelgesichtSettings): number[] {
  const start = Math.max(2, Math.round(settings.startPx))
  const end = Math.max(start + 1, Math.round(settings.endPx))
  const n = Math.max(2, Math.round(settings.steps))
  const fine = Math.max(0, Math.min(n - 2, Math.round(n * 0.33)))
  const tail = Math.max(1, Math.min(n - fine - 1, Math.round(n * 0.17)))
  const mid = n - fine - tail
  const ladder: number[] = []
  const push = (raw: number) =>
    ladder.push(Math.max((ladder[ladder.length - 1] ?? start - 1) + 1, Math.round(raw)))
  for (let k = 0; k < fine; k++) ladder.push(start + k)
  const from = fine > 0 ? ladder[fine - 1] : start
  const knee = mid > 0 ? Math.max(from + mid, Math.round(end / 2)) : from
  for (let j = 1; j <= mid; j++) push(from * Math.pow(knee / from, j / mid))
  for (let j = 1; j <= tail; j++) push(knee * Math.pow(end / knee, j / tail))
  return ladder
}

/**
 * Mosaic width (in blocks) at `elapsed` seconds: each ladder stage is held
 * for an equal share of `revealSec`, then the original shows (null).
 */
export function pixelWidthAt(
  elapsed: number,
  settings: PixelgesichtSettings,
  fullWidth: number,
): number | null {
  if (fullWidth <= Math.max(2, Math.round(settings.startPx))) return null
  const total = Math.max(0.1, settings.revealSec)
  if (elapsed >= total) return null
  const ladder = pixelLadder(settings)
  const k = Math.min(ladder.length - 1, Math.floor(elapsed / (total / ladder.length)))
  const w = ladder[k]
  return w >= fullWidth ? null : w
}
