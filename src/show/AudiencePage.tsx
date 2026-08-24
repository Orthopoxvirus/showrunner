import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { createAudienceChannel } from '../lib/live'
import type { ShowSnapshot } from '../lib/types'
import { ScoreOverlay } from './ScoreOverlay'
import { StageScreen } from './StageScreen'
import { scoreboardDocked, scoreboardVisible } from './showMachine'

/**
 * The beamer window: a passive, silent mirror of the host's state. All audio
 * comes from the host window, so autoplay policies never block mid-show.
 */
export function AudiencePage() {
  const { t } = useTranslation()
  const [snapshot, setSnapshot] = useState<ShowSnapshot | null>(null)
  const [fsHint, setFsHint] = useState(false)

  useEffect(() => createAudienceChannel(setSnapshot, () => setFsHint(true)), [])

  // The hint disappears as soon as this window actually is full screen.
  useEffect(() => {
    const onChange = () => {
      if (document.fullscreenElement) setFsHint(false)
    }
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  useEffect(() => {
    document.title = `Showrunner — ${t('show.audienceTitle')}`
  }, [t])

  const docked = snapshot && scoreboardDocked(snapshot.live) ? ` score-docked-${snapshot.scoreboardPos}` : ''
  return (
    <div className={`audience-root${docked}`}>
      {snapshot ? (
        <>
          <StageScreen snapshot={snapshot} />
          {scoreboardVisible(snapshot.live) && (
            <ScoreOverlay
              key={snapshot.live.scorePulse?.at ?? 'on'}
              players={snapshot.players}
              scores={snapshot.live.scores}
              pos={snapshot.scoreboardPos}
              pulse={snapshot.live.scorePulse}
              flash={!snapshot.live.scoreboard}
            />
          )}
          {snapshot.live.blank !== 'none' && <div className={`blank-cover ${snapshot.live.blank}`} />}
        </>
      ) : (
        <div className="stage-center">
          <div className="stage-kicker">{t('app.title')}</div>
          <div className="stage-sub">{t('show.audienceWaiting')}</div>
        </div>
      )}
      {fsHint && !document.fullscreenElement && (
        <button
          className="fs-hint"
          onClick={() => {
            setFsHint(false)
            void document.documentElement.requestFullscreen().catch(() => undefined)
          }}
        >
          ⛶ {t('show.clickFullscreen')}
        </button>
      )}
    </div>
  )
}
