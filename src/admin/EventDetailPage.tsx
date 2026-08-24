import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { games } from '../games/registry'
import { newId } from '../lib/ids'
import { useStore } from '../lib/store'
import type { EventGame } from '../lib/types'

export function EventDetailPage() {
  const { t } = useTranslation()
  const { eventId } = useParams()
  const navigate = useNavigate()
  const { events, updateEvent, addGameToEvent } = useStore()
  const [playerName, setPlayerName] = useState('')
  const [gameType, setGameType] = useState(Object.keys(games)[0] ?? '')

  const event = events.find((e) => e.id === eventId)
  if (!event) return <div className="empty">404</div>

  // Classic buzzer colors, assigned round-robin to new players.
  const PALETTE = ['#f26d6d', '#5aa2f7', '#4fd28a', '#f5b83d']

  const addPlayer = () => {
    const name = playerName.trim()
    if (!name) return
    const color = PALETTE[event.players.length % PALETTE.length]
    updateEvent({ ...event, players: [...event.players, { id: newId('ply'), name, color }] })
    setPlayerName('')
  }

  const setPlayerColor = (id: string, color: string) => {
    updateEvent({ ...event, players: event.players.map((p) => (p.id === id ? { ...p, color } : p)) })
  }

  const removePlayer = (id: string) => {
    updateEvent({ ...event, players: event.players.filter((p) => p.id !== id) })
  }

  const moveGame = (idx: number, dir: -1 | 1) => {
    const next = [...event.games]
    const target = idx + dir
    if (target < 0 || target >= next.length) return
    ;[next[idx], next[target]] = [next[target], next[idx]]
    updateEvent({ ...event, games: next })
  }

  const gameStatus = (g: EventGame) => {
    const mod = games[g.gameType]
    if (!mod) return { ok: false, text: g.gameType }
    const lineupOk = event.players.length >= mod.minPlayers && event.players.length <= mod.maxPlayers
    const ok = lineupOk && g.itemIds.length > 0
    return { ok, text: t('events.itemsSelected', { count: g.itemIds.length }) }
  }

  const showReady = event.games.length > 0 && event.games.every((g) => gameStatus(g).ok)

  return (
    <>
      <div className="crumbs">
        <Link to="/">{t('events.title')}</Link> / {event.name}
      </div>
      <div className="page-head">
        <h1>{event.name}</h1>
        <div className="spacer" />
        <button
          className="btn primary"
          disabled={!showReady}
          onClick={() => navigate(`/show/${event.id}`)}
        >
          ▶ {t('events.startShow')}
        </button>
      </div>

      <div className="card">
        <div className="field-row">
          <label className="field" style={{ flex: 2, minWidth: 240 }}>
            {t('common.name')}
            <input
              type="text"
              value={event.name}
              onChange={(e) => updateEvent({ ...event, name: e.target.value })}
            />
          </label>
          <label className="field">
            {t('common.date')}
            <input
              type="date"
              value={event.date}
              onChange={(e) => updateEvent({ ...event, date: e.target.value })}
            />
          </label>
        </div>
        <div className="checks" style={{ alignItems: 'center' }}>
          <label className={`check-pill${event.hideBranding ? ' on' : ''}`}>
            <input
              type="checkbox"
              checked={event.hideBranding ?? false}
              onChange={(e) => updateEvent({ ...event, hideBranding: e.target.checked })}
            />
            {t('events.hideBranding')}
          </label>
          <label className={`check-pill${event.hideGameCounter ? ' on' : ''}`}>
            <input
              type="checkbox"
              checked={event.hideGameCounter ?? false}
              onChange={(e) => updateEvent({ ...event, hideGameCounter: e.target.checked })}
            />
            {t('events.hideGameCounter')}
          </label>
          <label className="field" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {t('events.scoreboardPos')}
            <select
              value={event.scoreboardPos ?? 'bottom'}
              onChange={(e) =>
                updateEvent({ ...event, scoreboardPos: e.target.value as typeof event.scoreboardPos })
              }
            >
              <option value="bottom">{t('events.pos.bottom')}</option>
              <option value="top">{t('events.pos.top')}</option>
              <option value="left">{t('events.pos.left')}</option>
              <option value="right">{t('events.pos.right')}</option>
            </select>
          </label>
        </div>
      </div>

      <div className="card">
        <h2>{t('events.players')}</h2>
        <p className="hint">{t('events.playersHint')}</p>
        <div className="checks" style={{ marginBottom: 12 }}>
          {event.players.map((p) => (
            <span key={p.id} className="check-pill on" style={{ borderColor: p.color, color: p.color }}>
              <input
                type="color"
                value={p.color ?? '#5aa2f7'}
                title={t('events.playerColor')}
                onChange={(e) => setPlayerColor(p.id, e.target.value)}
                style={{
                  display: 'inline-block',
                  width: 18,
                  height: 18,
                  padding: 0,
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                }}
              />
              {p.name}
              <button
                className="btn icon small"
                style={{ border: 'none', background: 'transparent', padding: '0 2px' }}
                title={t('common.remove')}
                onClick={() => removePlayer(p.id)}
              >
                ✕
              </button>
            </span>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="text"
            placeholder={t('events.addPlayer')}
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addPlayer()}
          />
          <button className="btn" onClick={addPlayer} disabled={!playerName.trim()}>
            +
          </button>
        </div>
      </div>

      <div className="card">
        <h2>{t('events.games')}</h2>
        <p className="hint">{t('events.gamesHint')}</p>
        <div className="row-list" style={{ marginBottom: 14 }}>
          {event.games.map((g, idx) => {
            const mod = games[g.gameType]
            const status = gameStatus(g)
            return (
              <div key={g.id} className="row">
                <span className="badge accent">{idx + 1}</span>
                <div className="grow">
                  <div className="title">{g.name || (mod ? t(mod.nameKey) : g.gameType)}</div>
                  <div className="sub">
                    {mod ? t(mod.taglineKey) : ''} · {status.text}
                  </div>
                </div>
                {!status.ok && <span className="badge warn">{t('events.notReady')}</span>}
                <button className="btn icon small" title={t('common.up')} onClick={() => moveGame(idx, -1)}>
                  ↑
                </button>
                <button className="btn icon small" title={t('common.down')} onClick={() => moveGame(idx, 1)}>
                  ↓
                </button>
                <button
                  className="btn small"
                  onClick={() => navigate(`/events/${event.id}/games/${g.id}`)}
                >
                  {t('events.configure')}
                </button>
                <button
                  className="btn small danger"
                  onClick={() => {
                    if (confirm(t('common.confirmDelete')))
                      updateEvent({ ...event, games: event.games.filter((x) => x.id !== g.id) })
                  }}
                >
                  ✕
                </button>
              </div>
            )
          })}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <select value={gameType} onChange={(e) => setGameType(e.target.value)}>
            {Object.values(games).map((g) => (
              <option key={g.type} value={g.type}>
                {t(g.nameKey)} — {t(g.taglineKey)}
              </option>
            ))}
          </select>
          <button
            className="btn"
            onClick={() => {
              const g = addGameToEvent(event.id, gameType)
              if (g) navigate(`/events/${event.id}/games/${g.id}`)
            }}
          >
            + {t('events.addGame')}
          </button>
        </div>
      </div>
    </>
  )
}
