import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Countdown } from '../../components/Countdown'
import { api } from '../../lib/api'
import { audio, type LoadedSong } from '../../lib/audio'
import type { GameRuntimeProps } from '../../lib/types'
import { ClipProgress, TimedBar } from './Progress'
import { reversedTask, type KisumItem, type KisumPhase, type KisumSettings } from './types'

type Props = GameRuntimeProps<KisumItem, KisumPhase, KisumSettings>

export function HostView({ item, phase, patchPhase, settings }: Props) {
  const { t } = useTranslation()
  const [song, setSong] = useState<LoadedSong | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Load & decode the song (cached across phases; reversal happens in-memory).
  useEffect(() => {
    setSong(null)
    setError(null)
    if (!item.file) return
    let cancelled = false
    api
      .mediaUrl(item.file)
      .then((url) => audio.loadSong(url))
      .then((s) => !cancelled && setSong(s))
      .catch((e) => !cancelled && setError(String(e)))
    return () => {
      cancelled = true
    }
  }, [item.id, item.file])

  // Side effects on phase transitions. Depends on phase.t (not the whole
  // phase object) so patchPhase updates don't re-trigger playback.
  const phaseT = phase.t
  const songReady = song !== null
  const rev = song ? reversedTask({ ...item, duration: song.duration }) : null
  const revRef = useRef(rev)
  revRef.current = rev
  const phaseRef = useRef(phase)
  phaseRef.current = phase

  useEffect(() => {
    const s = song
    switch (phaseT) {
      case 'intro':
        audio.stop()
        break
      case 'playing': {
        if (!s || !revRef.current) break
        const r = revRef.current
        const p = phaseRef.current
        const from = p.t === 'playing' && p.resumeAt !== null ? Math.max(r.start, Math.min(p.resumeAt, r.end)) : r.start
        audio.playSegment(s.reversed, from, r.end, {
          fade: settings.fadeSec,
          onEnded: () => patchPhase({ ended: true } as Partial<KisumPhase>),
        })
        // stamp start position + wall time so the audience window can
        // animate the clip progress locally
        patchPhase({ from, startedAt: Date.now(), ended: false } as Partial<KisumPhase>)
        break
      }
      case 'answer': {
        const stoppedAt = audio.stop()
        patchPhase({
          stoppedAt: stoppedAt ?? revRef.current?.end ?? null,
          deadline: Date.now() + settings.answerSec * 1000,
        } as Partial<KisumPhase>)
        break
      }
      case 'reveal': {
        if (!s) break
        audio.cue('reveal')
        audio.playSegment(s.forward, item.reveal.start, item.reveal.end, { fade: settings.fadeSec })
        break
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phaseT, songReady, item.id])

  // Stop audio when the item unmounts (next item / game end).
  useEffect(() => () => void audio.stop(), [item.id])

  const replay = () => {
    if (!song || !rev) return
    patchPhase({ resumeAt: null, ended: false, from: rev.start, startedAt: Date.now() } as Partial<KisumPhase>)
    audio.playSegment(song.reversed, rev.start, rev.end, {
      fade: settings.fadeSec,
      onEnded: () => patchPhase({ ended: true } as Partial<KisumPhase>),
    })
  }

  const phaseText = () => {
    switch (phase.t) {
      case 'intro':
        return t('kisum.phase.intro')
      case 'playing':
        return phase.ended ? t('kisum.phase.playingEnded') : t('kisum.phase.playing')
      case 'answer':
        return t('kisum.phase.answer')
      case 'reveal':
        return t('kisum.phase.reveal')
    }
  }

  return (
    <div>
      <div className="answer-card">
        <div className="label">{t('kisum.solution')}</div>
        <div className="value">{item.title || '—'}</div>
        <div className="sub">{item.artist}</div>
        {item.notes && <div className="sub" style={{ marginTop: 6, fontStyle: 'italic' }}>{item.notes}</div>}
      </div>

      <div className="phase-line">
        <span className="dot" />
        <span>{phaseText()}</span>
      </div>

      {error && <p className="hint" style={{ color: 'var(--red)' }}>{t('kisum.loadFailed', { error })}</p>}

      {phase.t === 'playing' && rev && (
        <div>
          <ClipProgress item={item} phase={phase} compact />
          <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
            <button className="btn small" onClick={replay}>
              ↺ {t('kisum.replay')}
            </button>
          </div>
        </div>
      )}

      {phase.t === 'answer' && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0' }}>
          <Countdown deadline={phase.deadline} totalSec={settings.answerSec} withSound size={170} />
        </div>
      )}

      {phase.t === 'reveal' && (
        <TimedBar frac={0} remainingSec={Math.max(0.1, item.reveal.end - item.reveal.start)} compact />
      )}

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
