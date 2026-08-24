import type { GameFlow } from '../../lib/types'
import type { PixelgesichtItem, PixelgesichtPhase, PixelgesichtSettings } from './types'

/**
 * intro → revealing → answer → reveal → done
 *              ▲          │
 *              └── back ──┘   (resumes the de-pixelation, rewound a little,
 *                              so the remaining players can keep guessing)
 */
export const flow: GameFlow<PixelgesichtItem, PixelgesichtPhase, PixelgesichtSettings> = {
  initialPhase() {
    return { t: 'intro' }
  },

  advance(phase) {
    switch (phase.t) {
      case 'intro':
        return { t: 'revealing', resumeAt: null }
      case 'revealing':
        return { t: 'answer', stoppedAt: null, deadline: null }
      case 'answer':
        return { t: 'reveal' }
      case 'reveal':
        return 'done'
    }
  },

  back(phase, _item, settings) {
    switch (phase.t) {
      case 'intro':
        return phase
      case 'revealing':
        return { t: 'intro' }
      case 'answer': {
        const from = phase.stoppedAt ?? 0
        return { t: 'revealing', resumeAt: Math.max(0, from - settings.rewindSec) }
      }
      case 'reveal':
        return { t: 'answer', stoppedAt: null, deadline: null }
    }
  },
}
