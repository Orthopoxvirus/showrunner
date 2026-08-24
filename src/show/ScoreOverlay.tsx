import type { Player, ScoreboardPos, ScorePulse } from '../lib/types'

/**
 * The docked score tiles. With `flash` (scoreboard toggled off, a point was
 * just awarded) the whole overlay runs the score-flash animation: fade in,
 * hold, fade out — timed to SCORE_FLASH_MS, after which the host clears the
 * pulse and the overlay unmounts. The awarded player's points pop and a
 * small +N chip rises from the tile. Callers key this component by
 * `pulse.at` so a rapid second award restarts the animations.
 */
export function ScoreOverlay({
  players,
  scores,
  pos = 'bottom',
  pulse,
  flash,
}: {
  players: Player[]
  scores: Record<string, number>
  pos?: ScoreboardPos
  pulse?: ScorePulse | null
  flash?: boolean
}) {
  if (players.length === 0) return null
  return (
    <div className={`score-overlay pos-${pos}${flash ? ' flash' : ''}`}>
      {players.map((p) => {
        const pulsed = pulse?.playerId === p.id
        return (
          <div
            key={p.id}
            className={`score-tile${pulsed ? ' bump' : ''}`}
            style={{ borderTopColor: p.color ?? 'var(--line)' }}
          >
            <div className="name" style={{ color: p.color }}>
              {p.name}
            </div>
            <div className="pts">{scores[p.id] ?? 0}</div>
            {pulsed && (
              <div className="delta-chip">{pulse.delta > 0 ? `+${pulse.delta}` : pulse.delta}</div>
            )}
          </div>
        )
      })}
    </div>
  )
}
