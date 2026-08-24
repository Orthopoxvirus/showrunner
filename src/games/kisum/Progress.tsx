import { TimedBar } from '../../components/TimedBar'
import { reversedTask, type KisumItem, type KisumPhase } from './types'

export { TimedBar }

/** Reversed-clip progress computed from the host-stamped phase fields. */
export function ClipProgress({
  item,
  phase,
  compact,
}: {
  item: KisumItem
  phase: KisumPhase & { t: 'playing' }
  compact?: boolean
}) {
  const region = reversedTask(item)
  const span = Math.max(0.01, region.end - region.start)
  let frac = 0
  let remaining: number | null = null
  if (phase.ended) {
    frac = 1
  } else if (phase.from != null && phase.startedAt != null) {
    const pos = phase.from + (Date.now() - phase.startedAt) / 1000
    frac = Math.min(1, Math.max(0, (pos - region.start) / span))
    remaining = Math.max(0, region.end - pos)
  }
  return <TimedBar frac={frac} remainingSec={remaining} compact={compact} />
}
