import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { newId } from '../../lib/ids'
import type { GameModule, GameSettingsProps } from '../../lib/types'
import { AudienceView } from './AudienceView'
import { Editor, metaFromFile } from './Editor'
import { HostView } from './HostView'
import { IntroView, KisumFlipTitle } from './IntroView'
import { flow } from './flow'
import type { KisumItem, KisumPhase, KisumSettings } from './types'

function SettingsEditor({ settings, onChange }: GameSettingsProps<KisumSettings>) {
  const { t } = useTranslation()
  const [previewRun, setPreviewRun] = useState(0)
  return (
    <>
      <div className="field-row">
        <label className="field">
          {t('kisum.settingsTimer')} ({t('common.seconds')})
          <input
            type="number"
            min={1}
            max={60}
            value={settings.answerSec}
            onChange={(e) => onChange({ ...settings, answerSec: Math.max(1, Number(e.target.value)) })}
          />
        </label>
        <label className="field">
          {t('kisum.settingsRewind')} ({t('common.seconds')})
          <input
            type="number"
            min={0}
            max={30}
            value={settings.rewindSec}
            onChange={(e) => onChange({ ...settings, rewindSec: Math.max(0, Number(e.target.value)) })}
          />
        </label>
        <label className="field">
          {t('kisum.settingsFade')} ({t('common.seconds')})
          <input
            type="number"
            min={0}
            max={5}
            step={0.1}
            value={settings.fadeSec}
            onChange={(e) => onChange({ ...settings, fadeSec: Math.max(0, Number(e.target.value)) })}
          />
        </label>
      </div>
      <div className="field-row">
        <label className="field" style={{ flex: 1, minWidth: 260 }}>
          {t('kisum.settingsTagline')}
          <input
            type="text"
            value={settings.tagline}
            onChange={(e) => onChange({ ...settings, tagline: e.target.value })}
          />
        </label>
        <label className="field" style={{ minWidth: 220 }}>
          {t('kisum.settingsItemLabel')}
          <input
            type="text"
            value={settings.itemLabel}
            onChange={(e) => onChange({ ...settings, itemLabel: e.target.value })}
          />
        </label>
      </div>
      <p className="hint">{t('kisum.settingsItemLabelHint', { x: '{{x}}', y: '{{y}}' })}</p>
      <div className="field-row" style={{ alignItems: 'center' }}>
        <label className={`check-pill${settings.introAnimation ? ' on' : ''}`}>
          <input
            type="checkbox"
            checked={settings.introAnimation}
            onChange={(e) => onChange({ ...settings, introAnimation: e.target.checked })}
          />
          {t('kisum.settingsIntroAnim')}
        </label>
        {settings.introAnimation && (
          <>
            <label className="field">
              {t('kisum.settingsIntroSpin')} ({t('common.seconds')})
              <input
                type="number"
                min={0.5}
                max={10}
                step={0.5}
                value={settings.introSpinSec}
                onChange={(e) => onChange({ ...settings, introSpinSec: Math.max(0.5, Number(e.target.value)) })}
              />
            </label>
            <button className="btn small" style={{ alignSelf: 'flex-end' }} onClick={() => setPreviewRun((n) => n + 1)}>
              ▶ {t('kisum.previewIntro')}
            </button>
          </>
        )}
      </div>
      {settings.introAnimation && previewRun > 0 && (
        <div className="intro-preview" key={previewRun}>
          <KisumFlipTitle spinning durationSec={settings.introSpinSec} gameName={t('kisum.name')} />
        </div>
      )}
    </>
  )
}

export const kisum: GameModule<KisumItem, KisumPhase, KisumSettings> = {
  type: 'kisum',
  nameKey: 'kisum.name',
  taglineKey: 'kisum.tagline',
  minPlayers: 2,
  maxPlayers: 4,
  defaultSettings: {
    answerSec: 5,
    rewindSec: 2,
    fadeSec: 0.5,
    tagline: 'Musik rückwärts – wer erkennt den Song?',
    itemLabel: 'Song {{x}}',
    introAnimation: true,
    introSpinSec: 2,
  },

  introSteps: (settings) => (settings.introAnimation ? 1 : 0),
  IntroView,

  createItem(): KisumItem {
    return {
      id: newId('itm'),
      title: '',
      artist: '',
      file: null,
      duration: null,
      task: { start: 0, end: 0 },
      reveal: { start: 0, end: 0 },
    }
  },

  mediaKind: 'audio',
  itemFromFile(path: string): KisumItem {
    return { ...this.createItem(), file: path, ...metaFromFile(path) }
  },

  itemLabel(item) {
    if (!item.title && !item.artist) return '—'
    return item.artist ? `${item.artist} – ${item.title}` : item.title
  },

  itemReady(item) {
    return Boolean(
      item.file &&
        item.duration &&
        item.title.trim() &&
        item.task.end > item.task.start &&
        item.reveal.end > item.reveal.start,
    )
  },

  Editor,
  SettingsEditor,
  flow,
  HostView,
  AudienceView,
}
