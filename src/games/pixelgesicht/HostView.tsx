import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Countdown } from '../../components/Countdown'
import { audio } from '../../lib/audio'
import type { GameRuntimeProps } from '../../lib/types'
import { RevealProgress, useItemImage } from './PixelImage'
import { revealElapsed, type PixelgesichtItem, type PixelgesichtPhase, type PixelgesichtSettings } from './types'

type Props = GameRuntimeProps<PixelgesichtItem, PixelgesichtPhase, PixelgesichtSettings>

/** One-shot timer flipping to true the moment the reveal timeline completes. */
function useRevealEnded(phase: PixelgesichtPhase, settings: PixelgesichtSettings): boolean {
  const [ended, setEnded] = useState(false)
  useEffect(() => {
    if (phase.t !== 'revealing' || phase.startedAt == null) {
      setEnded(false)
      return
    }
    const remaining = settings.revealSec - revealElapsed(phase, settings, Date.now())
    if (remaining <= 0) {
      setEnded(true)
      return
    }
    setEnded(false)
    const to = setTimeout(() => setEnded(true), remaining * 1000 + 50)
    return () => clearTimeout(to)
  }, [phase, settings])
  return ended
}

export function HostView({ item, phase, patchPhase, settings }: Props) {
  const { t } = useTranslation()
  const { img, error } = useItemImage(item.file)
  const ended = useRevealEnded(phase, settings)

  const phaseRef = useRef(phase)
  phaseRef.current = phase
  // Where the running reveal currently stands — needed to freeze it when the
  // phase flips to 'answer' (the revealing stamps are gone by then).
  const lastRevealRef = useRef<{ from: number; startedAt: number } | null>(null)
  if (phase.t === 'revealing' && phase.startedAt != null) {
    lastRevealRef.current = { from: phase.from ?? 0, startedAt: phase.startedAt }
  }

  // Side effects on phase transitions. Depends on phase.t (not the whole
  // phase object) so patchPhase updates don't re-trigger the stamps.
  const phaseT = phase.t
  useEffect(() => {
    switch (phaseT) {
      case 'revealing': {
        const p = phaseRef.current
        if (p.t !== 'revealing') break
        const from = Math.max(0, Math.min(p.resumeAt ?? 0, settings.revealSec))
        patchPhase({ from, startedAt: Date.now() } as Partial<PixelgesichtPhase>)
        break
      }
      case 'answer': {
        const last = lastRevealRef.current
        const stoppedAt = last
          ? Math.min(settings.revealSec, last.from + (Date.now() - last.startedAt) / 1000)
          : settings.revealSec
        patchPhase({
          stoppedAt,
          deadline: Date.now() + settings.answerSec * 1000,
        } as Partial<PixelgesichtPhase>)
        break
      }
      case 'reveal':
        audio.cue('reveal')
        break
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phaseT, item.id])

  const replay = () =>
    patchPhase({ resumeAt: null, from: 0, startedAt: Date.now() } as Partial<PixelgesichtPhase>)

  const phaseText = () => {
    switch (phase.t) {
      case 'intro':
        return t('pixelgesicht.phase.intro')
      case 'revealing':
        return ended ? t('pixelgesicht.phase.revealingEnded') : t('pixelgesicht.phase.revealing')
      case 'answer':
        return t('pixelgesicht.phase.answer')
      case 'reveal':
        return t('pixelgesicht.phase.reveal')
    }
  }

  return (
    <div>
      <div className="answer-card">
        <div className="label">{t('pixelgesicht.solution')}</div>
        <div className="value">{item.name || '—'}</div>
        <div className="sub">{item.info}</div>
        {item.notes && <div className="sub" style={{ marginTop: 6, fontStyle: 'italic' }}>{item.notes}</div>}
        {img && <img src={img.src} alt="" className="pixel-host-thumb" />}
      </div>

      <div className="phase-line">
        <span className="dot" />
        <span>{phaseText()}</span>
      </div>

      {error && <p className="hint" style={{ color: 'var(--red)' }}>{t('pixelgesicht.loadFailed', { error })}</p>}

      {phase.t === 'revealing' && (
        <div>
          <RevealProgress phase={phase} settings={settings} compact />
          <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
            <button className="btn small" onClick={replay}>
              ↺ {t('pixelgesicht.replay')}
            </button>
          </div>
        </div>
      )}

      {phase.t === 'answer' && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0' }}>
          <Countdown deadline={phase.deadline} totalSec={settings.answerSec} withSound size={170} />
        </div>
      )}

      {phase.t === 'reveal' && <RevealProgress phase={phase} settings={settings} compact />}

      <p className="next-hint" style={{ marginTop: 18 }}>
        {phase.t === 'answer' && (
          <>
            <b>{t('show.prevAction')}:</b> −{settings.rewindSec}s
          </>
        )}
      </p>
    </div>
  )
}
