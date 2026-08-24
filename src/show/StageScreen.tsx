import { useTranslation } from 'react-i18next'
import { games } from '../games/registry'
import type { ShowSnapshot } from '../lib/types'
import { FinalBoard } from './FinalBoard'

/**
 * Renders the audience-facing content for any show screen. Used 1:1 by the
 * audience window and, scaled down, as the host's stage preview — so the host
 * always sees exactly what the room sees.
 */
export function StageScreen({ snapshot }: { snapshot: ShowSnapshot }) {
  const { t } = useTranslation()
  const { live, eventName, gameType, gameName, item, itemCount, players } = snapshot
  const mod = gameType ? games[gameType] : null
  const displayName = gameName ?? (mod ? t(mod.nameKey) : '')

  switch (live.screen) {
    case 'lobby':
      return (
        <div className="stage-center">
          {!snapshot.hideBranding && <div className="stage-kicker">{t('app.title')}</div>}
          <div className="stage-title">{eventName}</div>
          <div className="stage-sub">{t('show.audienceWaiting')}</div>
        </div>
      )
    case 'game-intro': {
      if (mod?.IntroView) {
        const IntroView = mod.IntroView
        return (
          <IntroView
            step={live.screenStep ?? 0}
            gameName={displayName}
            gameIdx={live.gameIdx}
            gameCount={snapshot.gameCount}
            hideGameCounter={snapshot.hideGameCounter}
            settings={snapshot.gameSettings}
          />
        )
      }
      return (
        <div className="stage-center">
          {!snapshot.hideGameCounter && (
            <div className="stage-kicker">{t('show.gameOf', { n: live.gameIdx + 1, total: snapshot.gameCount })}</div>
          )}
          <div className="stage-title">{displayName}</div>
          {mod && <div className="stage-sub">{t(mod.taglineKey)}</div>}
        </div>
      )
    }
    case 'game': {
      if (!mod || !item) return null
      const AudienceView = mod.AudienceView
      return (
        <AudienceView
          item={item}
          itemIndex={live.itemIdx}
          itemCount={itemCount}
          phase={live.phase}
          patchPhase={() => undefined}
          settings={snapshot.gameSettings}
          players={players}
          scores={live.scores}
        />
      )
    }
    case 'game-end':
      if ((live.screenStep ?? 0) >= 1) {
        return <FinalBoard players={players} scores={live.scores} title={displayName} />
      }
      return (
        <div className="stage-center">
          <div className="stage-kicker">{displayName}</div>
          <div className="stage-title">{t('show.gameEnd')}</div>
        </div>
      )
    case 'break':
    case 'final-black':
      return <div className="stage-blackout" />
    case 'show-end':
      return (
        <div className="stage-center">
          <div className="stage-kicker">{eventName}</div>
          <div className="stage-title">{t('show.showEnd')}</div>
          <div className="stage-sub">{t('show.showEndHint')}</div>
        </div>
      )
  }
}
