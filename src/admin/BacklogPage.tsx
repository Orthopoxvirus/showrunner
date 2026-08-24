import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { DifficultyDots, DifficultyPicker } from '../components/Difficulty'
import { DropZone } from '../components/DropZone'
import { TagBadge, genderClass, tagBorder, tagStyle } from '../components/TagBadge'
import { games } from '../games/registry'
import { api } from '../lib/api'
import { newId } from '../lib/ids'
import { useStore } from '../lib/store'
import type { BacklogItemBase } from '../lib/types'

export function BacklogPage() {
  const { t } = useTranslation()
  const { gameType = '' } = useParams()
  const { backlogs, ensureBacklog, updateBacklog, createItem } = useStore()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [tagFilter, setTagFilter] = useState<string[]>([])

  const mod = games[gameType]

  useEffect(() => {
    if (mod) void ensureBacklog(gameType)
  }, [gameType, mod, ensureBacklog])

  useEffect(() => setTagFilter([]), [gameType])

  if (!mod) return <div className="empty">404</div>
  const backlog = backlogs[gameType]
  if (!backlog) return <div className="empty">{t('app.loading')}</div>

  const patchItem = (item: BacklogItemBase) => {
    updateBacklog({ ...backlog, items: backlog.items.map((i) => (i.id === item.id ? item : i)) })
  }

  /** Dropped media files: upload each and create one prefilled item per
   *  file. Incremental — every entry pops in as soon as its (possibly
   *  large) upload lands, at the top of the list in drop order. A failed
   *  file is skipped, the rest of the batch continues. */
  const createFromFiles = async (files: File[]) => {
    if (!mod.itemFromFile) return
    let inserted = 0
    for (const f of files) {
      try {
        const entry = await api.uploadMedia(gameType, f)
        const fresh = useStore.getState().backlogs[gameType]
        if (!fresh) continue
        const items = [...fresh.items]
        items.splice(inserted, 0, mod.itemFromFile(entry.path))
        inserted++
        updateBacklog({ ...fresh, items })
      } catch (err) {
        console.error(`[backlog] upload failed for ${f.name}`, err)
      }
    }
  }

  const Editor = mod.Editor

  // Tag filter: chips from all tags in use; selected chips must ALL match.
  const allTags = mod.itemTags
    ? [...new Set(backlog.items.flatMap((i) => mod.itemTags?.(i) ?? []))].sort((a, b) => {
        const sym = (s: string) => /^[♂♀]/.test(s)
        if (sym(a) !== sym(b)) return sym(a) ? -1 : 1
        return a.localeCompare(b)
      })
    : []
  const visibleItems =
    tagFilter.length > 0 && mod.itemTags
      ? backlog.items.filter((i) => tagFilter.every((tag) => (mod.itemTags?.(i) ?? []).includes(tag)))
      : backlog.items
  const toggleTag = (tag: string) =>
    setTagFilter((f) => (f.includes(tag) ? f.filter((x) => x !== tag) : [...f, tag]))

  const page = (
    <>
      <div className="crumbs">
        <Link to="/">{t('events.title')}</Link> / {t('backlog.title')}
      </div>
      <div className="page-head">
        <h1>
          {t(mod.nameKey)} — {t('backlog.title')}
        </h1>
        <span className="badge dim">{t('backlog.itemCount', { count: backlog.items.length })}</span>
        <div className="spacer" />
        <button
          className="btn primary"
          onClick={() => {
            const item = createItem(gameType)
            if (item) setEditingId(item.id)
          }}
        >
          + {t('backlog.newItem')}
        </button>
      </div>
      <p className="hint" style={{ marginTop: -10 }}>
        {t(mod.taglineKey)}
      </p>

      {allTags.length > 0 && (
        <div className="filter-chips">
          {allTags.map((tag) => (
            <button
              key={tag}
              className={`filter-chip${genderClass(tag)}${tagFilter.includes(tag) ? ' on' : ''}`}
              style={
                tagStyle(tag)
                  ? tagFilter.includes(tag)
                    ? { ...tagStyle(tag), borderColor: tagBorder(tag) }
                    : { color: tagStyle(tag)?.color }
                  : undefined
              }
              onClick={() => toggleTag(tag)}
            >
              {tag}
            </button>
          ))}
          {tagFilter.length > 0 && (
            <button className="filter-chip" onClick={() => setTagFilter([])}>
              ✕ {t('backlog.filterClear')}
            </button>
          )}
        </div>
      )}

      {backlog.items.length === 0 && <div className="empty">{t('backlog.empty')}</div>}
      {backlog.items.length > 0 && visibleItems.length === 0 && (
        <div className="empty">{t('backlog.filterEmpty')}</div>
      )}

      <div className="row-list">
        {visibleItems.map((item) => (
          <div key={item.id}>
            <div className="row clickable" onClick={() => setEditingId(editingId === item.id ? null : item.id)}>
              <div className="grow">
                <div className="title">{mod.itemLabel(item)}</div>
              </div>
              {mod.itemTags?.(item).map((tag) => (
                <TagBadge key={tag} tag={tag} />
              ))}
              <DifficultyDots level={item.difficulty} />
              {item.retired ? (
                <span className="badge dim">{t('backlog.retired')}</span>
              ) : mod.itemReady(item) ? (
                <span className="badge ok">{t('backlog.ready')}</span>
              ) : (
                <span className="badge warn">{t('backlog.incomplete')}</span>
              )}
              <button
                className="btn small"
                onClick={(e) => {
                  e.stopPropagation()
                  const copy = { ...structuredClone(item), id: newId('itm') }
                  const items = [...backlog.items]
                  items.splice(items.findIndex((i) => i.id === item.id) + 1, 0, copy)
                  updateBacklog({ ...backlog, items })
                  setEditingId(copy.id)
                }}
              >
                {t('common.duplicate')}
              </button>
              <button
                className="btn small"
                onClick={(e) => {
                  e.stopPropagation()
                  patchItem({ ...item, retired: !item.retired })
                }}
              >
                {item.retired ? t('backlog.unretire') : t('backlog.retire')}
              </button>
              <button
                className="btn small danger"
                onClick={(e) => {
                  e.stopPropagation()
                  if (confirm(`${t('common.confirmDelete')} (${mod.itemLabel(item)})`))
                    updateBacklog({ ...backlog, items: backlog.items.filter((i) => i.id !== item.id) })
                }}
              >
                ✕
              </button>
            </div>
            {editingId === item.id && (
              <div className="card" style={{ marginTop: 8 }}>
                <Editor item={item} onChange={patchItem} />
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginTop: 10,
                    gap: 10,
                    flexWrap: 'wrap',
                  }}
                >
                  <DifficultyPicker
                    value={item.difficulty}
                    onChange={(difficulty) => patchItem({ ...item, difficulty })}
                  />
                  <button className="btn small" onClick={() => setEditingId(null)}>
                    {t('common.close')}
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  )

  if (!mod.mediaKind || !mod.itemFromFile) return page
  return (
    <DropZone kind={mod.mediaKind} hint={t('backlog.dropHint')} onFiles={(files) => void createFromFiles(files)}>
      {page}
    </DropZone>
  )
}
