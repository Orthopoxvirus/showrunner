import type { BacklogItemBase } from '../../lib/types'

export interface Region {
  start: number
  end: number
}

export interface KisumItem extends BacklogItemBase {
  title: string
  artist: string
  /** data-relative path, e.g. `media/kisum/song.mp3` */
  file: string | null
  /** Song duration in seconds, captured at edit time (needed to map the
   *  forward-marked task region into the reversed timeline). */
  duration: number | null
  /** Marked on the FORWARD waveform; played in reverse during the show. */
  task: Region
  /** Marked and played forward as the resolution. */
  reveal: Region
}

export interface KisumSettings {
  /** Answer time after a buzz, in seconds. */
  answerSec: number
  /** How far the reversed clip jumps back when guessing continues. */
  rewindSec: number
  /** Fade-in/out length for both the reversed task and the forward reveal. */
  fadeSec: number
  /** Subtitle under the game title; empty string hides it. */
  tagline: string
  /** Item counter template with {{x}} (current) and {{y}} (total) variables;
   *  empty string hides the counter entirely. */
  itemLabel: string
  /** Play the Musik→Kisum flip animation on the game intro. */
  introAnimation: boolean
  /** Duration of the intro flip animation, in seconds. */
  introSpinSec: number
}

/**
 * Phase machine, all JSON-serializable. `resumeAt`/`stoppedAt`/`from` are
 * positions in the REVERSED timeline (0 = end of the original song).
 * `from`/`startedAt` (epoch ms) are stamped by the host when playback starts,
 * so the audience window can animate the clip progress locally.
 */
export type KisumPhase =
  | { t: 'intro' }
  | { t: 'playing'; resumeAt: number | null; ended?: boolean; from?: number | null; startedAt?: number | null }
  | { t: 'answer'; stoppedAt: number | null; deadline: number | null }
  | { t: 'reveal' }

/** Render the item counter template; null when disabled. */
export function renderItemLabel(settings: KisumSettings, x: number, y: number): string | null {
  const out = (settings.itemLabel ?? '')
    .replaceAll('{{x}}', String(x))
    .replaceAll('{{y}}', String(y))
    .trim()
  return out || null
}

/** The task region [start,end] (forward seconds) mapped into the reversed timeline. */
export function reversedTask(item: KisumItem): Region {
  const d = item.duration ?? 0
  return { start: Math.max(0, d - item.task.end), end: Math.max(0, d - item.task.start) }
}
