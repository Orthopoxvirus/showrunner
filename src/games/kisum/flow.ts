import type { GameFlow } from '../../lib/types'
import { reversedTask, type KisumItem, type KisumPhase, type KisumSettings } from './types'

/**
 * intro → playing → answer → reveal → done
 *            ▲         │
 *            └─ back ──┘   (resumes the reversed clip, rewound a little,
 *                           so the remaining players can keep guessing)
 */
export const flow: GameFlow<KisumItem, KisumPhase, KisumSettings> = {
  initialPhase() {
    return { t: 'intro' }
  },

  advance(phase) {
    switch (phase.t) {
      case 'intro':
        return { t: 'playing', resumeAt: null }
      case 'playing':
        return { t: 'answer', stoppedAt: null, deadline: null }
      case 'answer':
        return { t: 'reveal' }
      case 'reveal':
        return 'done'
    }
  },

  back(phase, item, settings) {
    switch (phase.t) {
      case 'intro':
        return phase
      case 'playing':
        return { t: 'intro' }
      case 'answer': {
        const region = reversedTask(item)
        const from = phase.stoppedAt ?? region.start
        return { t: 'playing', resumeAt: Math.max(region.start, from - settings.rewindSec) }
      }
      case 'reveal':
        return { t: 'answer', stoppedAt: null, deadline: null }
    }
  },
}
