import type { AnyGameModule } from '../lib/types'
import { kisum } from './kisum'
import { pixelgesicht } from './pixelgesicht'

/**
 * All coded games. Adding a game = implement the GameModule contract and
 * register it here; the framework picks up admin editor, settings, and both
 * show views automatically.
 */
export const games: Record<string, AnyGameModule> = {
  [kisum.type]: kisum,
  [pixelgesicht.type]: pixelgesicht,
}
