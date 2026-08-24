import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { DropZone } from '../../components/DropZone'
import { api } from '../../lib/api'
import { audio, type LoadedSong } from '../../lib/audio'
import type { GameEditorProps } from '../../lib/types'
import { Waveform } from './Waveform'
import { reversedTask, type KisumItem, type Region } from './types'

type PreviewKind = 'task' | 'reveal' | 'free' | null

/** "media/Queen - Bohemian Rhapsody.mp3" → artist/title prefill. Without a
 *  " - " separator the whole basename becomes the title. */
export function metaFromFile(path: string): { artist: string; title: string } {
  const base = (path.split('/').pop() ?? '')
    .replace(/\.[^.]+$/, '')
    .replace(/_+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const parts = base.split(/\s-\s/)
  if (parts.length >= 2) return { artist: parts[0].trim(), title: parts.slice(1).join(' - ').trim() }
  return { artist: '', title: base }
}

export function Editor({ item, onChange }: GameEditorProps<KisumItem>) {
  const { t } = useTranslation()
  const [media, setMedia] = useState<{ name: string; path: string }[]>([])
  const [song, setSong] = useState<LoadedSong | null>(null)
  const [decoding, setDecoding] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [active, setActive] = useState<'task' | 'reveal'>('task')
  /** Free-listening cursor on the waveform, set by a plain click. */
  const [cursor, setCursor] = useState<number | null>(null)
  /** What space plays: the cursor (forward) or the selected region. */
  const [focus, setFocus] = useState<'task' | 'reveal' | 'cursor'>('task')
  const previewRef = useRef<PreviewKind>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    void api.listMedia('kisum').then(setMedia)
  }, [])

  // Decode the selected file; capture its duration into the item (the show
  // needs it to map the task region into the reversed timeline).
  useEffect(() => {
    setSong(null)
    setLoadError(null)
    setCursor(null)
    setFocus('task')
    previewRef.current = null
    if (!item.file) return
    let cancelled = false
    setDecoding(true)
    api
      .mediaUrl(item.file)
      .then((url) => audio.loadSong(url))
      .then((s) => {
        if (cancelled) return
        setSong(s)
        if (item.duration === null || Math.abs(item.duration - s.duration) > 0.05) {
          onChange({ ...item, duration: Math.round(s.duration * 100) / 100 })
        }
      })
      .catch((e) => !cancelled && setLoadError(String(e)))
      .finally(() => !cancelled && setDecoding(false))
    return () => {
      cancelled = true
      audio.stop()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.file])

  const getPlayhead = useCallback((): number | null => {
    const pos = audio.position()
    if (pos === null || !song) {
      previewRef.current = null
      return null
    }
    // reversed preview: map the reversed position back onto the forward waveform
    return previewRef.current === 'task' ? song.duration - pos : pos
  }, [song])

  const playTask = () => {
    if (!song) return
    const r = reversedTask(item)
    previewRef.current = 'task'
    audio.playSegment(song.reversed, r.start, r.end)
  }
  const playReveal = () => {
    if (!song) return
    previewRef.current = 'reveal'
    audio.playSegment(song.forward, item.reveal.start, item.reveal.end)
  }
  /** Free listening: play forward from the cursor to the end of the song. */
  const playFromCursor = (from: number) => {
    if (!song) return
    previewRef.current = 'free'
    audio.playSegment(song.forward, from, song.duration)
  }

  // Space toggles playback: the cursor (forward) or the selected region,
  // whichever was touched last (unless typing in a field).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== ' ' || e.repeat || !song) return
      const el = e.target as HTMLElement | null
      const tag = el?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el?.isContentEditable) return
      e.preventDefault()
      if (audio.playing) {
        audio.stop()
        previewRef.current = null
      } else if (focus === 'cursor' && cursor !== null) {
        playFromCursor(cursor)
      } else if (focus === 'reveal') {
        playReveal()
      } else {
        playTask()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [song, focus, cursor, item.task.start, item.task.end, item.reveal.start, item.reveal.end, item.duration])

  /** Set a new file; empty title/artist fields are prefilled from its name. */
  const setFile = (path: string | null) => {
    const meta = path && !item.title.trim() && !item.artist.trim() ? metaFromFile(path) : null
    onChange({ ...item, file: path, duration: null, ...(meta ?? {}) })
  }

  /** Upload one or more files (picker or drop); the first one is selected. */
  const uploadFiles = async (files: File[]) => {
    const entries: { name: string; path: string }[] = []
    for (const f of files) entries.push(await api.uploadMedia('kisum', f))
    setMedia((m) => [...m, ...entries.filter((e) => !m.some((x) => x.path === e.path))])
    if (entries[0]) setFile(entries[0].path)
  }

  const setRegion = (kind: 'task' | 'reveal', region: Region) => {
    onChange({ ...item, [kind]: region })
    setFocus(kind)
  }

  const regionBox = (kind: 'task' | 'reveal', label: string, color: string) => {
    const region = item[kind]
    return (
      <div
        className={`region-box${active === kind ? ' active' : ''}`}
        onClick={() => {
          setActive(kind)
          setFocus(kind)
        }}
      >
        <h4>
          <span className="dot" style={{ background: color, display: 'inline-block', width: 10, height: 10, borderRadius: 3, marginRight: 7 }} />
          {label}
        </h4>
        <div className="times">
          <label className="field">
            {t('kisum.start')}
            <input
              type="number"
              min={0}
              step={0.1}
              value={region.start}
              onChange={(e) => setRegion(kind, { ...region, start: Number(e.target.value) })}
            />
          </label>
          <label className="field">
            {t('kisum.end')}
            <input
              type="number"
              min={0}
              step={0.1}
              value={region.end}
              onChange={(e) => setRegion(kind, { ...region, end: Number(e.target.value) })}
            />
          </label>
          <button
            className="btn small"
            style={{ alignSelf: 'flex-end' }}
            onClick={(e) => {
              e.stopPropagation()
              setActive(kind)
              setFocus(kind)
              kind === 'task' ? playTask() : playReveal()
            }}
            disabled={!song || region.end <= region.start}
          >
            ▶ {kind === 'task' ? t('kisum.playTask') : t('kisum.playReveal')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <DropZone kind="audio" hint={t('kisum.dropHint')} onFiles={(files) => void uploadFiles(files)}>
      <div className="field-row">
        <label className="field" style={{ flex: 2, minWidth: 220 }}>
          {t('kisum.title')}
          <input type="text" value={item.title} onChange={(e) => onChange({ ...item, title: e.target.value })} />
        </label>
        <label className="field" style={{ flex: 2, minWidth: 220 }}>
          {t('kisum.artist')}
          <input type="text" value={item.artist} onChange={(e) => onChange({ ...item, artist: e.target.value })} />
        </label>
      </div>

      <div className="field-row" style={{ alignItems: 'flex-end' }}>
        <label className="field" style={{ minWidth: 280 }}>
          {t('kisum.songFile')}
          <select value={item.file ?? ''} onChange={(e) => setFile(e.target.value || null)}>
            <option value="">{t('kisum.chooseExisting')}</option>
            {media.map((m) => (
              <option key={m.path} value={m.path}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
        <button className="btn" onClick={() => fileInputRef.current?.click()}>
          ⤴ {t('kisum.upload')}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*"
          multiple
          style={{ display: 'none' }}
          onChange={(e) => {
            const files = Array.from(e.target.files ?? [])
            if (files.length > 0) void uploadFiles(files)
            e.target.value = ''
          }}
        />
        {song && (
          <button className="btn" onClick={() => audio.stop()}>
            ⏹ {t('kisum.stop')}
          </button>
        )}
      </div>

      {decoding && <p className="hint">{t('kisum.decoding')}</p>}
      {loadError && <p className="hint" style={{ color: 'var(--red)' }}>{t('kisum.loadFailed', { error: loadError })}</p>}
      {!item.file && <p className="hint">{t('kisum.noFile')}</p>}

      {song && (
        <>
          <div className="waveform-wrap">
            <Waveform
              buffer={song.forward}
              task={item.task}
              reveal={item.reveal}
              active={active}
              onChange={setRegion}
              cursor={cursor}
              onCursor={(sec) => {
                if (audio.playing) {
                  audio.stop()
                  previewRef.current = null
                }
                setCursor(sec)
                setFocus('cursor')
              }}
              getPlayhead={getPlayhead}
            />
          </div>
          <div className="wave-legend">
            <span>
              <span className="dot" style={{ background: '#4fd28a' }} />
              {t('kisum.revealRegion')}
            </span>
            <span>
              <span className="dot" style={{ background: '#5aa2f7' }} />
              {t('kisum.taskRegion')}
            </span>
            <span style={{ color: 'var(--text-faint)' }}>{t('kisum.regionHint')}</span>
          </div>
          <div className="region-controls">
            {regionBox('reveal', t('kisum.revealRegion'), '#4fd28a')}
            {regionBox('task', t('kisum.taskRegion'), '#5aa2f7')}
          </div>
        </>
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
