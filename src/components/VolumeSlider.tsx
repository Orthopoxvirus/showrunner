import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { VOLUME_EVENT, audio } from '../lib/audio'

/** Global volume control; drives the audio engine's master gain, persisted
 *  and picked up by every window. */
export function VolumeSlider() {
  const { t } = useTranslation()
  const [vol, setVol] = useState(() => Math.round(audio.volume * 100))

  // Follow changes made in another window (engine syncs via storage events)
  // or in this window via the volume keys.
  useEffect(() => {
    const sync = () => setVol(Math.round(audio.volume * 100))
    window.addEventListener('storage', sync)
    window.addEventListener(VOLUME_EVENT, sync)
    return () => {
      window.removeEventListener('storage', sync)
      window.removeEventListener(VOLUME_EVENT, sync)
    }
  }, [])

  return (
    <label className="volume-slider" title={t('app.volume')}>
      <span aria-hidden>{vol === 0 ? '🔇' : vol < 50 ? '🔉' : '🔊'}</span>
      <input
        type="range"
        min={0}
        max={100}
        value={vol}
        aria-label={t('app.volume')}
        onChange={(e) => {
          const v = Number(e.target.value)
          setVol(v)
          audio.setVolume(v / 100)
        }}
      />
    </label>
  )
}
