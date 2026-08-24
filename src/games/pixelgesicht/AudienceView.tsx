import { useTranslation } from 'react-i18next'
import { Countdown } from '../../components/Countdown'
import type { GameRuntimeProps } from '../../lib/types'
import { PhasePixelImage, RevealProgress, useItemImage } from './PixelImage'
import { renderItemLabel, type PixelgesichtItem, type PixelgesichtPhase, type PixelgesichtSettings } from './types'

type Props = GameRuntimeProps<PixelgesichtItem, PixelgesichtPhase, PixelgesichtSettings>

export function AudienceView({ item, itemIndex, itemCount, phase, settings }: Props) {
  const { t } = useTranslation()
  const label = renderItemLabel(settings, itemIndex + 1, itemCount)
  const { img } = useItemImage(item.file)

  switch (phase.t) {
    case 'intro':
      return (
        <div className="stage-center">
          <div className="stage-kicker">{t('pixelgesicht.name')}</div>
          {label && <div className="stage-title">{label}</div>}
          {settings.tagline && <div className="stage-sub">{settings.tagline}</div>}
        </div>
      )
    case 'revealing':
      return (
        <div className="stage-center">
          {label && <div className="stage-kicker">{label}</div>}
          {img && <PhasePixelImage img={img} phase={phase} settings={settings} className="pixel-img" />}
          <RevealProgress phase={phase} settings={settings} />
        </div>
      )
    case 'answer':
      return (
        <div className="stage-center">
          <div className="stage-kicker">{t('pixelgesicht.audienceAnswer')}</div>
          <Countdown deadline={phase.deadline} totalSec={settings.answerSec} />
        </div>
      )
    case 'reveal':
      return (
        <div className="stage-center">
          <div className="stage-kicker">{t('pixelgesicht.solution')}</div>
          {img && <PhasePixelImage img={img} phase={phase} settings={settings} className="pixel-img small" />}
          <div>
            <div className="stage-title reveal-rise">{item.name}</div>
            {item.info && <div className="stage-sub reveal-rise reveal-rise-2">{item.info}</div>}
          </div>
        </div>
      )
  }
}
