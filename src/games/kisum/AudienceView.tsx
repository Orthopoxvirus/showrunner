import { useTranslation } from 'react-i18next'
import { Countdown } from '../../components/Countdown'
import type { GameRuntimeProps } from '../../lib/types'
import { ClipProgress } from './Progress'
import { renderItemLabel, type KisumItem, type KisumPhase, type KisumSettings } from './types'

type Props = GameRuntimeProps<KisumItem, KisumPhase, KisumSettings>

function Eq({ reverse, paused }: { reverse?: boolean; paused?: boolean }) {
  return (
    <div className={`eq${reverse ? ' reverse' : ''}${paused ? ' paused' : ''}`}>
      {Array.from({ length: 7 }, (_, i) => (
        <i key={i} />
      ))}
    </div>
  )
}

export function AudienceView({ item, itemIndex, itemCount, phase, settings }: Props) {
  const { t } = useTranslation()
  const label = renderItemLabel(settings, itemIndex + 1, itemCount)

  switch (phase.t) {
    case 'intro':
      return (
        <div className="stage-center">
          <div className="stage-kicker">{t('kisum.name')}</div>
          {label && <div className="stage-title">{label}</div>}
          {settings.tagline && <div className="stage-sub">{settings.tagline}</div>}
        </div>
      )
    case 'playing':
      return (
        <div className="stage-center">
          {label && <div className="stage-kicker">{label}</div>}
          <Eq reverse paused={phase.ended} />
          <ClipProgress item={item} phase={phase} />
        </div>
      )
    case 'answer':
      return (
        <div className="stage-center">
          <div className="stage-kicker">{t('kisum.audienceAnswer')}</div>
          <Countdown deadline={phase.deadline} totalSec={settings.answerSec} />
        </div>
      )
    case 'reveal':
      return (
        <div className="stage-center">
          <div className="stage-kicker">{t('kisum.solution')}</div>
          <div className="stage-title reveal-rise reveal-rise-late">{item.title}</div>
          <div className="stage-sub reveal-rise reveal-rise-late-2">{item.artist}</div>
          <Eq />
        </div>
      )
  }
}
