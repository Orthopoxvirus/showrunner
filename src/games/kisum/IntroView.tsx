import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import type { GameIntroProps } from '../../lib/types'
import type { KisumSettings } from './types'

/**
 * The Kisum reveal gag: the title first reads "Musik", then (on the host's
 * click) spins ever faster around the vertical axis and comes to rest
 * reading "Kisum". Implemented as a two-faced 3D card; the back face is
 * pre-rotated 180° so it reads correctly when the spin lands on it.
 */
export function KisumFlipTitle({
  spinning,
  durationSec,
  gameName,
}: {
  spinning: boolean
  durationSec: number
  gameName: string
}) {
  const innerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = innerRef.current
    if (!el) return
    if (!spinning) {
      el.style.transform = 'rotateY(0deg)'
      return
    }
    // 4.5 turns; ease-in-out = accelerating, then braking into the back face.
    const anim = el.animate([{ transform: 'rotateY(0deg)' }, { transform: 'rotateY(1620deg)' }], {
      duration: Math.max(0.3, durationSec) * 1000,
      easing: 'cubic-bezier(0.6, 0, 0.3, 1)',
      fill: 'forwards',
    })
    return () => anim.cancel()
  }, [spinning, durationSec])

  return (
    <div className="flip-scene">
      <div ref={innerRef} className="flip-inner">
        <div className="flip-face stage-title">Musik</div>
        <div className="flip-face flip-back stage-title">{gameName}</div>
      </div>
    </div>
  )
}

export function IntroView({
  step,
  gameName,
  gameIdx,
  gameCount,
  hideGameCounter,
  settings,
}: GameIntroProps<KisumSettings>) {
  const { t } = useTranslation()
  const animated = settings.introAnimation

  return (
    <div className="stage-center">
      {!hideGameCounter && (
        <div className="stage-kicker">{t('show.gameOf', { n: gameIdx + 1, total: gameCount })}</div>
      )}
      {animated ? (
        <KisumFlipTitle spinning={step >= 1} durationSec={settings.introSpinSec} gameName={gameName} />
      ) : (
        <div className="stage-title">{gameName}</div>
      )}
      {settings.tagline && <div className="stage-sub">{settings.tagline}</div>}
    </div>
  )
}
