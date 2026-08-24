import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { newId } from '../../lib/ids'
import type { GameModule, GameSettingsProps } from '../../lib/types'
import { AudienceView } from './AudienceView'
import { Editor, nameFromFile } from './Editor'
import { HostView } from './HostView'
import { IntroView, PixelTitle } from './IntroView'
import { flow } from './flow'
import { defaultSettings, type PixelgesichtItem, type PixelgesichtPhase, type PixelgesichtSettings } from './types'

function SettingsEditor({ settings, onChange }: GameSettingsProps<PixelgesichtSettings>) {
  const { t } = useTranslation()
  const [previewRun, setPreviewRun] = useState(0)
  return (
    <>
      <div className="field-row">
        <label className="field">
          {t('pixelgesicht.settingsReveal')} ({t('common.seconds')})
          <input
            type="number"
            min={3}
            max={180}
            value={settings.revealSec}
            onChange={(e) => onChange({ ...settings, revealSec: Math.max(3, Number(e.target.value)) })}
          />
        </label>
        <label className="field">
          {t('pixelgesicht.settingsStartPx')}
          <input
            type="number"
            min={2}
            max={64}
            value={settings.startPx}
            onChange={(e) => onChange({ ...settings, startPx: Math.max(2, Number(e.target.value)) })}
          />
        </label>
        <label className="field">
          {t('pixelgesicht.settingsEndPx')}
          <input
            type="number"
            min={16}
            max={800}
            value={settings.endPx}
            onChange={(e) => onChange({ ...settings, endPx: Math.max(16, Number(e.target.value)) })}
          />
        </label>
        <label className="field">
          {t('pixelgesicht.settingsSteps')}
          <input
            type="number"
            min={2}
            max={60}
            value={settings.steps}
            onChange={(e) => onChange({ ...settings, steps: Math.max(2, Number(e.target.value)) })}
          />
        </label>
      </div>
      <p className="hint">{t('pixelgesicht.settingsLadderHint')}</p>
      <div className="field-row">
        <label className="field">
          {t('pixelgesicht.settingsTimer')} ({t('common.seconds')})
          <input
            type="number"
            min={1}
            max={60}
            value={settings.answerSec}
            onChange={(e) => onChange({ ...settings, answerSec: Math.max(1, Number(e.target.value)) })}
          />
        </label>
        <label className="field">
          {t('pixelgesicht.settingsRewind')} ({t('common.seconds')})
          <input
            type="number"
            min={0}
            max={30}
            value={settings.rewindSec}
            onChange={(e) => onChange({ ...settings, rewindSec: Math.max(0, Number(e.target.value)) })}
          />
        </label>
      </div>
      <div className="field-row">
        <label className="field" style={{ flex: 1, minWidth: 260 }}>
          {t('pixelgesicht.settingsTagline')}
          <input
            type="text"
            value={settings.tagline}
            onChange={(e) => onChange({ ...settings, tagline: e.target.value })}
          />
        </label>
        <label className="field" style={{ minWidth: 220 }}>
          {t('pixelgesicht.settingsItemLabel')}
          <input
            type="text"
            value={settings.itemLabel}
            onChange={(e) => onChange({ ...settings, itemLabel: e.target.value })}
          />
        </label>
      </div>
      <p className="hint">{t('pixelgesicht.settingsItemLabelHint', { x: '{{x}}', y: '{{y}}' })}</p>
      <div className="field-row" style={{ alignItems: 'center' }}>
        <label className={`check-pill${settings.introAnimation ? ' on' : ''}`}>
          <input
            type="checkbox"
            checked={settings.introAnimation}
            onChange={(e) => onChange({ ...settings, introAnimation: e.target.checked })}
          />
          {t('pixelgesicht.settingsIntroAnim')}
        </label>
        {settings.introAnimation && (
          <>
            <label className="field">
              {t('pixelgesicht.settingsIntroReveal')} ({t('common.seconds')})
              <input
                type="number"
                min={0.5}
                max={10}
                step={0.5}
                value={settings.introRevealSec}
                onChange={(e) => onChange({ ...settings, introRevealSec: Math.max(0.5, Number(e.target.value)) })}
              />
            </label>
            <button className="btn small" style={{ alignSelf: 'flex-end' }} onClick={() => setPreviewRun((n) => n + 1)}>
              ▶ {t('pixelgesicht.previewIntro')}
            </button>
          </>
        )}
      </div>
      {settings.introAnimation && previewRun > 0 && (
        <div className="intro-preview" key={previewRun}>
          <PixelTitle revealing durationSec={settings.introRevealSec} gameName={t('pixelgesicht.name')} />
        </div>
      )}
    </>
  )
}

export const pixelgesicht: GameModule<PixelgesichtItem, PixelgesichtPhase, PixelgesichtSettings> = {
  type: 'pixelgesicht',
  nameKey: 'pixelgesicht.name',
  taglineKey: 'pixelgesicht.tagline',
  minPlayers: 1,
  maxPlayers: 4,
  defaultSettings,

  introSteps: (settings) => (settings.introAnimation ? 1 : 0),
  IntroView,

  createItem(): PixelgesichtItem {
    return {
      id: newId('itm'),
      name: '',
      info: '',
      file: null,
    }
  },

  mediaKind: 'image',
  itemFromFile(path: string): PixelgesichtItem {
    return { ...this.createItem(), file: path, name: nameFromFile(path) }
  },

  itemLabel(item) {
    return item.name.trim() || '—'
  },

  itemTags(item) {
    const tags: string[] = []
    if (item.gender === 'm') tags.push('♂')
    if (item.gender === 'f') tags.push('♀')
    if (item.category?.trim()) tags.push(item.category.trim())
    return tags
  },

  itemReady(item) {
    return Boolean(item.file && item.name.trim())
  },

  Editor,
  SettingsEditor,
  flow,
  HostView,
  AudienceView,
}
