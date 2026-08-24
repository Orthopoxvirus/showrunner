import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { VolumeSlider } from '../components/VolumeSlider'
import { audio } from '../lib/audio'
import {
  clearLive,
  closeAudienceWindows,
  createHostChannel,
  hasAudienceWindow,
  loadLive,
  openAudienceWindow,
  saveLive,
  toggleAudienceFullscreen,
} from '../lib/live'
import { useStore } from '../lib/store'
import type { LiveShow } from '../lib/types'
import { ScoreOverlay } from './ScoreOverlay'
import { StageScreen } from './StageScreen'
import {
  SCORE_FLASH_MS,
  advanceShow,
  backShow,
  buildSnapshot,
  currentGame,
  effectiveSettings,
  freshLive,
  gameItems,
  gameModule,
  jumpToGame,
  scoreboardDocked,
  scoreboardVisible,
  type ShowContext,
} from './showMachine'

export function ShowHostPage() {
  const { t } = useTranslation()
  const { eventId = '' } = useParams()
  const navigate = useNavigate()
  const { events, backlogs, loaded, ensureBacklog } = useStore()
  const event = events.find((e) => e.id === eventId)

  // Live state survives reload: resume automatically if a saved state exists.
  const [live, setLive] = useState<LiveShow | null>(null)

  // Track whether an audience window is open (also catches user-closed ones).
  const [audienceOpen, setAudienceOpen] = useState(false)
  useEffect(() => {
    const iv = setInterval(() => setAudienceOpen(hasAudienceWindow()), 1500)
    return () => clearInterval(iv)
  }, [])
  useEffect(() => {
    if (!event || live) return
    setLive(loadLive(event.id) ?? freshLive(event.id))
  }, [event, live])

  // All backlogs referenced by this event must be present.
  useEffect(() => {
    if (event) for (const g of event.games) void ensureBacklog(g.gameType)
  }, [event, ensureBacklog])

  const backlogsReady = event ? event.games.every((g) => backlogs[g.gameType]) : false
  const ctx: ShowContext | null = useMemo(
    () => (event && backlogsReady ? { event, backlogs } : null),
    [event, backlogsReady, backlogs],
  )

  const snapshot = useMemo(() => (live && ctx ? buildSnapshot(live, ctx) : null), [live, ctx])

  // Persist + broadcast on every change.
  const snapshotRef = useRef(snapshot)
  snapshotRef.current = snapshot
  const channelRef = useRef<ReturnType<typeof createHostChannel> | null>(null)
  useEffect(() => {
    const ch = createHostChannel(() => snapshotRef.current)
    channelRef.current = ch
    return () => {
      channelRef.current = null
      ch.close()
    }
  }, [])
  useEffect(() => {
    if (live) saveLive(live)
    if (snapshot) channelRef.current?.publish(snapshot)
  }, [live, snapshot])

  const game = live && ctx ? currentGame(live, ctx) : null
  const mod = gameModule(game)
  const items = live && ctx ? gameItems(game, ctx) : []
  const gamePlayers = event ? event.players : []

  const addScore = useCallback(
    (playerId: string, delta: number) => {
      setLive((l) =>
        l
          ? {
              ...l,
              scores: { ...l.scores, [playerId]: (l.scores[playerId] ?? 0) + delta },
              scorePulse: { playerId, delta, at: Date.now() },
            }
          : l,
      )
    },
    [],
  )

  // A point award flashes the (hidden) scoreboard on the audience screen;
  // clearing the pulse after the flash window hides it again.
  const pulseAt = live?.scorePulse?.at
  useEffect(() => {
    if (!pulseAt) return
    const to = setTimeout(
      () => setLive((l) => (l && l.scorePulse?.at === pulseAt ? { ...l, scorePulse: null } : l)),
      SCORE_FLASH_MS,
    )
    return () => clearTimeout(to)
  }, [pulseAt])

  const next = useCallback(() => {
    if (!ctx) return
    setLive((l) => {
      if (!l) return l
      const n = advanceShow(l, ctx)
      if (n.screen === 'game-intro' && l.screen !== 'game-intro') audio.cue('fanfare')
      return n
    })
  }, [ctx])

  const back = useCallback(() => {
    if (!ctx) return
    setLive((l) => (l ? backShow(l, ctx) : l))
  }, [ctx])

  const jumpTo = useCallback(
    (gameIdx: number) => {
      if (!ctx) return
      audio.stop()
      setLive((l) => (l ? jumpToGame(l, ctx, gameIdx) : l))
    },
    [ctx],
  )

  const patchPhase = useCallback((patch: object) => {
    setLive((l) =>
      l && l.phase && typeof l.phase === 'object' ? { ...l, phase: { ...l.phase, ...patch } } : l,
    )
  }, [])

  // ---------------------------------------------------------------------------
  // Presenter keys — PowerPoint-style, clicker-compatible.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

      // Volume keys allow key repeat (press and hold to keep adjusting).
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault()
        audio.setVolume(audio.volume + (e.key === 'ArrowUp' ? 0.05 : -0.05))
        return
      }
      if (e.repeat) return

      switch (e.key) {
        case 'ArrowRight':
        case 'PageDown':
        case ' ':
          e.preventDefault()
          next()
          return
        case 'ArrowLeft':
        case 'PageUp':
          e.preventDefault()
          back()
          return
        case 'F5':
          // full-screen the audience window (delegated activation); if none
          // is open, full-screen the host window instead
          e.preventDefault()
          if (!toggleAudienceFullscreen()) {
            if (document.fullscreenElement) void document.exitFullscreen()
            else void document.documentElement.requestFullscreen()
          }
          return
        case 'b':
        case '.':
          e.preventDefault()
          setLive((l) => (l ? { ...l, blank: l.blank === 'black' ? 'none' : 'black' } : l))
          return
        case 'w':
        case ',':
          e.preventDefault()
          setLive((l) => (l ? { ...l, blank: l.blank === 'white' ? 'none' : 'white' } : l))
          return
        case 's':
          e.preventDefault()
          setLive((l) => (l ? { ...l, scoreboard: !l.scoreboard } : l))
          return
      }
      const m = e.code.match(/^Digit([1-4])$/)
      if (m) {
        const idx = Number(m[1]) - 1
        const player = gamePlayers[idx]
        if (player) {
          e.preventDefault()
          addScore(player.id, e.shiftKey ? -1 : 1)
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [next, back, addScore, gamePlayers])

  if (!loaded) return <div className="empty">{t('app.loading')}</div>
  if (!event) return <div className="empty">404</div>
  if (!live || !ctx || !snapshot) return <div className="empty">{t('app.loading')}</div>

  const HostGameView = mod?.HostView
  const item = items[live.itemIdx]
  const gameName = game ? game.name || (mod ? t(mod.nameKey) : game.gameType) : null

  const endShow = () => {
    if (!confirm(t('show.endShowConfirm'))) return
    clearLive()
    navigate(`/events/${event.id}`)
  }

  const restart = () => {
    if (!confirm(t('show.endShowConfirm'))) return
    audio.stop()
    setLive(freshLive(event.id))
  }

  const resetScores = () => {
    if (!confirm(t('show.resetScoresConfirm'))) return
    setLive((l) => (l ? { ...l, scores: {}, scorePulse: null } : l))
  }

  return (
    <div className="show-root">
      <div className="host-top">
        <b>{event.name}</b>
        {gameName && (
          <span>
            {t('show.gameOf', { n: live.gameIdx + 1, total: event.games.length })} · <b>{gameName}</b>
          </span>
        )}
        {live.screen === 'game' && item && (
          <span>{t('show.itemOf', { n: live.itemIdx + 1, total: items.length })}</span>
        )}
        {live.blank !== 'none' && (
          <span className="badge warn">
            {live.blank === 'black' ? t('show.blankBlack') : t('show.blankWhite')}
          </span>
        )}
        <div className="spacer" />
        <span className="badge dim">{t('show.hostView')}</span>
        <button
          className="btn small"
          title={t('show.keyBlank')}
          onClick={() => setLive((l) => (l ? { ...l, blank: l.blank === 'black' ? 'none' : 'black' } : l))}
        >
          {live.blank === 'black' ? `🔆 ${t('show.audienceShow')}` : `⏻ ${t('show.audienceBlank')}`}
        </button>
        {audienceOpen ? (
          <button
            className="btn small"
            onClick={() => {
              closeAudienceWindows()
              setAudienceOpen(false)
            }}
          >
            ⊗ {t('show.closeAudience')}
          </button>
        ) : (
          <button
            className="btn small"
            onClick={() => {
              openAudienceWindow()
              setAudienceOpen(true)
            }}
          >
            ⧉ {t('show.openAudience')}
          </button>
        )}
        <Link to={`/events/${event.id}`} className="btn small" style={{ textDecoration: 'none' }}>
          ✕
        </Link>
      </div>

      <div className="host-body">
        <div className="host-stage">
          <div
            className={`host-stage-preview${scoreboardDocked(live) ? ` score-docked-${snapshot.scoreboardPos}` : ''}`}
          >
            <StageScreen snapshot={snapshot} />
            {scoreboardVisible(live) && (
              <ScoreOverlay
                key={live.scorePulse?.at ?? 'on'}
                players={snapshot.players}
                scores={live.scores}
                pos={snapshot.scoreboardPos}
                pulse={live.scorePulse}
                flash={!live.scoreboard}
              />
            )}
          </div>

          {live.screen === 'lobby' && (
            <div className="phase-line">
              <span className="dot" />
              <span>
                {t('show.lobby')} — {t('show.lobbyHint')}
              </span>
            </div>
          )}
          {live.screen === 'game-end' && (
            <div className="phase-line">
              <span className="dot" />
              <span>{(live.screenStep ?? 0) === 0 ? t('show.gameEndHint') : t('show.gameEndBoardHint')}</span>
            </div>
          )}
          {(live.screen === 'break' || live.screen === 'final-black') && (
            <div className="phase-line">
              <span className="dot" />
              <span>{t('show.blackSlide')}</span>
            </div>
          )}

          {live.screen === 'game' && HostGameView && item && game && (
            <HostGameView
              item={item}
              itemIndex={live.itemIdx}
              itemCount={items.length}
              phase={live.phase}
              patchPhase={patchPhase}
              settings={effectiveSettings(game)}
              players={gamePlayers}
              scores={live.scores}
            />
          )}
        </div>

        <div className="host-panel">
          <div>
            <h3>{t('show.scores')}</h3>
            {gamePlayers.map((p, idx) => (
              <div key={p.id} className="score-row">
                <span className="keycap">{idx + 1}</span>
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 99,
                    background: p.color ?? 'var(--line)',
                    flex: 'none',
                  }}
                />
                <span className="name">{p.name}</span>
                <button className="btn icon small" onClick={() => addScore(p.id, -1)}>
                  −
                </button>
                <span className="pts">{live.scores[p.id] ?? 0}</span>
                <button className="btn icon small" onClick={() => addScore(p.id, 1)}>
                  +
                </button>
              </div>
            ))}
            <button className="btn small" style={{ marginTop: 8 }} onClick={resetScores}>
              ↺ {t('show.resetScores')}
            </button>
          </div>

          <div>
            <h3>{t('show.gamesTitle')}</h3>
            <div className="game-jump">
              {event.games.map((g, idx) => {
                const m = gameModule(g)
                const inGames = live.screen !== 'lobby' && live.screen !== 'show-end' && live.screen !== 'final-black'
                return (
                  <button
                    key={g.id}
                    className={`game-jump-btn${inGames && idx === live.gameIdx ? ' active' : ''}`}
                    title={t('show.jumpToGame')}
                    onClick={() => jumpTo(idx)}
                  >
                    <span className="num">{idx + 1}</span>
                    <span className="name">{g.name || (m ? t(m.nameKey) : g.gameType)}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <h3>{t('show.keysTitle')}</h3>
            <table className="keys-table">
              <tbody>
                <tr>
                  <td>
                    <span className="keycap">→</span>
                    <span className="keycap">⇟</span>
                    <span className="keycap">␣</span>
                  </td>
                  <td>{t('show.keyNext')}</td>
                </tr>
                <tr>
                  <td>
                    <span className="keycap">←</span>
                    <span className="keycap">⇞</span>
                  </td>
                  <td>{t('show.keyBack')}</td>
                </tr>
                <tr>
                  <td>
                    <span className="keycap">F5</span>
                  </td>
                  <td>{t('show.keyFullscreen')}</td>
                </tr>
                <tr>
                  <td>
                    <span className="keycap">B</span>
                    <span className="keycap">W</span>
                  </td>
                  <td>{t('show.keyBlank')}</td>
                </tr>
                <tr>
                  <td>
                    <span className="keycap">S</span>
                  </td>
                  <td>{t('show.keyScoreboard')}</td>
                </tr>
                <tr>
                  <td>
                    <span className="keycap">1</span>–<span className="keycap">4</span>
                  </td>
                  <td>{t('show.keyScore')}</td>
                </tr>
                <tr>
                  <td>
                    <span className="keycap">↑</span>
                    <span className="keycap">↓</span>
                  </td>
                  <td>{t('show.keyVolume')}</td>
                </tr>
              </tbody>
            </table>
            <div style={{ marginTop: 8 }}>
              <VolumeSlider />
            </div>
          </div>

          <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button className="btn small" onClick={restart}>
              ↺ {t('show.resumeNo')}
            </button>
            <button className="btn small danger" onClick={endShow}>
              ■ {t('show.endShow')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
