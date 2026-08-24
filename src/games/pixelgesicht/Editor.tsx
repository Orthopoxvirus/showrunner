import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { DropZone } from '../../components/DropZone'
import { api } from '../../lib/api'
import { useStore } from '../../lib/store'
import type { GameEditorProps } from '../../lib/types'
import { PixelCanvas, canvasWidth, useItemImage } from './PixelImage'
import { categorySuggestions, defaultSettings, pixelWidthAt, type PixelgesichtItem } from './types'

/** "media/roger_federer.jpg" → "roger federer" — prefill for the name field. */
export function nameFromFile(path: string): string {
  const base = path.split('/').pop() ?? ''
  return base
    .replace(/\.[^.]+$/, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function Editor({ item, onChange }: GameEditorProps<PixelgesichtItem>) {
  const { t } = useTranslation()
  const [media, setMedia] = useState<{ name: string; path: string }[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { img, error } = useItemImage(item.file)

  // Category suggestions: the predefined list plus everything already used
  // in the backlog, so once-typed categories are offered everywhere.
  const backlog = useStore((s) => s.backlogs['pixelgesicht'])
  const categories = useMemo(() => {
    const set = new Set(categorySuggestions)
    for (const i of (backlog?.items ?? []) as PixelgesichtItem[]) {
      const c = i.category?.trim()
      if (c) set.add(c)
    }
    return [...set].sort((a, b) => a.localeCompare(b))
  }, [backlog])

  // Preview scrubber over the reveal timeline (uses the game's default
  // timing; the actual show timing comes from the per-event settings).
  const [previewT, setPreviewT] = useState(0)
  const [playing, setPlaying] = useState(false)

  useEffect(() => {
    void api.listMedia('pixelgesicht').then(setMedia)
  }, [])

  useEffect(() => {
    setPreviewT(0)
    setPlaying(false)
  }, [item.file])

  useEffect(() => {
    if (!playing) return
    const startWall = Date.now()
    const base = previewT >= defaultSettings.revealSec ? 0 : previewT
    if (base === 0) setPreviewT(0)
    const iv = setInterval(() => {
      const tSec = base + (Date.now() - startWall) / 1000
      if (tSec >= defaultSettings.revealSec) {
        setPreviewT(defaultSettings.revealSec)
        setPlaying(false)
      } else {
        setPreviewT(tSec)
      }
    }, 100)
    return () => clearInterval(iv)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing])

  /** Set a new image; an empty name field is prefilled from the filename. */
  const setFile = (path: string | null) => {
    const name = path && !item.name.trim() ? nameFromFile(path) : item.name
    onChange({ ...item, file: path, name })
  }

  /** Upload one or more files (picker or drop); the first one is selected. */
  const uploadFiles = async (files: File[]) => {
    const entries: { name: string; path: string }[] = []
    for (const f of files) entries.push(await api.uploadMedia('pixelgesicht', f))
    setMedia((m) => [...m, ...entries.filter((e) => !m.some((x) => x.path === e.path))])
    if (entries[0]) setFile(entries[0].path)
  }

  const previewWidth = img ? pixelWidthAt(previewT, defaultSettings, canvasWidth(img)) : null

  return (
    <DropZone kind="image" hint={t('pixelgesicht.dropHint')} onFiles={(files) => void uploadFiles(files)}>
      <div className="field-row">
        <label className="field" style={{ flex: 2, minWidth: 220 }}>
          {t('pixelgesicht.personName')}
          <input type="text" value={item.name} onChange={(e) => onChange({ ...item, name: e.target.value })} />
        </label>
        <label className="field" style={{ flex: 2, minWidth: 220 }}>
          {t('pixelgesicht.personInfo')}
          <input type="text" value={item.info} onChange={(e) => onChange({ ...item, info: e.target.value })} />
        </label>
      </div>

      <div className="field-row">
        <div className="field" style={{ minWidth: 200 }}>
          {t('pixelgesicht.gender')}
          <div style={{ display: 'flex', gap: 8 }}>
            {(['m', 'f'] as const).map((g) => (
              <button
                key={g}
                type="button"
                className={`check-pill ${g === 'm' ? 'tag-m' : 'tag-f'}${item.gender === g ? ' on' : ''}`}
                onClick={() => onChange({ ...item, gender: item.gender === g ? null : g })}
              >
                {g === 'm' ? `♂ ${t('pixelgesicht.genderM')}` : `♀ ${t('pixelgesicht.genderF')}`}
              </button>
            ))}
          </div>
        </div>
        <label className="field" style={{ flex: 1, minWidth: 220 }}>
          {t('pixelgesicht.category')}
          <input
            type="text"
            list="pixelgesicht-categories"
            value={item.category ?? ''}
            placeholder={categorySuggestions.slice(0, 3).join(', ') + ', …'}
            onChange={(e) => onChange({ ...item, category: e.target.value })}
          />
        </label>
        <datalist id="pixelgesicht-categories">
          {categories.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </div>

      <div className="field-row" style={{ alignItems: 'flex-end' }}>
        <label className="field" style={{ minWidth: 280 }}>
          {t('pixelgesicht.imageFile')}
          <select value={item.file ?? ''} onChange={(e) => setFile(e.target.value || null)}>
            <option value="">{t('pixelgesicht.chooseExisting')}</option>
            {media.map((m) => (
              <option key={m.path} value={m.path}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
        <button className="btn" onClick={() => fileInputRef.current?.click()}>
          ⤴ {t('pixelgesicht.upload')}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          style={{ display: 'none' }}
          onChange={(e) => {
            const files = Array.from(e.target.files ?? [])
            if (files.length > 0) void uploadFiles(files)
            e.target.value = ''
          }}
        />
      </div>

      {error && <p className="hint" style={{ color: 'var(--red)' }}>{t('pixelgesicht.loadFailed', { error })}</p>}
      {!item.file && <p className="hint">{t('pixelgesicht.noFile')}</p>}

      {img && (
        <div className="pixel-editor-preview">
          <PixelCanvas img={img} pxWidth={previewWidth} className="pixel-editor-canvas" />
          <div className="field-row" style={{ alignItems: 'center', marginTop: 10 }}>
            <button className="btn small" onClick={() => setPlaying((p) => !p)}>
              {playing ? `⏹ ${t('pixelgesicht.stop')}` : `▶ ${t('pixelgesicht.playPreview')}`}
            </button>
            <input
              type="range"
              min={0}
              max={defaultSettings.revealSec}
              step={0.1}
              value={previewT}
              style={{ flex: 1, minWidth: 200 }}
              onChange={(e) => {
                setPlaying(false)
                setPreviewT(Number(e.target.value))
              }}
            />
            <span className="hint" style={{ minWidth: 90, textAlign: 'right' }}>
              {previewWidth === null ? t('pixelgesicht.original') : `${previewWidth} px`}
            </span>
          </div>
          <p className="hint">{t('pixelgesicht.previewHint')}</p>
        </div>
      )}

      <div className="field-row" style={{ marginTop: 14 }}>
        <label className="field" style={{ flex: 1, minWidth: 300 }}>
          {t('common.notes')}
          <textarea
            rows={2}
            value={item.notes ?? ''}
            onChange={(e) => onChange({ ...item, notes: e.target.value })}
          />
        </label>
      </div>
    </DropZone>
  )
}
