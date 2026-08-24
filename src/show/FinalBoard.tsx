import type { Player } from '../lib/types'

/**
 * Big animated score reveal (game-end step 1): tiles pop in staggered,
 * sorted by points, winner(s) highlighted.
 */
export function FinalBoard({
  players,
  scores,
  title,
}: {
  players: Player[]
  scores: Record<string, number>
  title: string
}) {
  const ranked = [...players].sort((a, b) => (scores[b.id] ?? 0) - (scores[a.id] ?? 0))
  const top = ranked.length ? (scores[ranked[0].id] ?? 0) : 0

  return (
    <div className="stage-center">
      <div className="stage-kicker">{title}</div>
      <div className="final-board">
        {ranked.map((p, idx) => {
          const pts = scores[p.id] ?? 0
          const winner = pts === top && top > 0
          return (
            <div
              key={p.id}
              className={`final-tile${winner ? ' winner' : ''}`}
              style={{ animationDelay: `${idx * 0.28 + 0.1}s`, borderTopColor: p.color ?? 'var(--line)' }}
            >
              {winner && <div className="crown">👑</div>}
              <div className="name" style={{ color: p.color }}>
                {p.name}
              </div>
              <div className="pts">{pts}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
