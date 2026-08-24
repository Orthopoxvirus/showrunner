import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { DifficultyDots } from '../components/Difficulty'
import { TagBadge } from '../components/TagBadge'
import { games } from '../games/registry'
import { useStore } from '../lib/store'
import type { BacklogItemBase } from '../lib/types'

function SortableRow({ id, children }: { id: string; children: ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  return (
    <div
      ref={setNodeRef}
      className={`row${isDragging ? ' dragging' : ''}`}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <span className="drag-grip" {...attributes} {...listeners}>
        ⋮⋮
      </span>
      {children}
    </div>
  )
}

export function EventGamePage() {
  const { t } = useTranslation()
  const { eventId, gameId } = useParams()
  const { events, backlogs, updateEvent, ensureBacklog } = useStore()
  const [search, setSearch] = useState('')
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

  const event = events.find((e) => e.id === eventId)
  const game = event?.games.find((g) => g.id === gameId)
  const mod = game ? games[game.gameType] : undefined

  useEffect(() => {
    if (game) void ensureBacklog(game.gameType)
  }, [game, ensureBacklog])

  if (!event || !game || !mod) return <div className="empty">404</div>

  const backlog = backlogs[game.gameType]
  const items: BacklogItemBase[] = backlog?.items ?? []
  const activeItems = items.filter((i) => !i.retired)
  const selectable = activeItems.filter((i) => !game.itemIds.includes(i.id))
  const query = search.trim().toLowerCase()
  const shown = query
    ? selectable.filter((i) => mod.itemLabel(i).toLowerCase().includes(query))
    : selectable

  const patchGame = (patch: Partial<typeof game>) => {
    updateEvent({
      ...event,
      games: event.games.map((g) => (g.id === game.id ? { ...g, ...patch } : g)),
    })
  }

  const moveItem = (idx: number, dir: -1 | 1) => {
    const next = [...game.itemIds]
    const target = idx + dir
    if (target < 0 || target >= next.length) return
    ;[next[idx], next[target]] = [next[target], next[idx]]
    patchGame({ itemIds: next })
  }

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    const from = game.itemIds.indexOf(String(active.id))
    const to = game.itemIds.indexOf(String(over.id))
    if (from < 0 || to < 0) return
    patchGame({ itemIds: arrayMove(game.itemIds, from, to) })
  }

  const SettingsEditor = mod.SettingsEditor

  return (
    <>
      <div className="crumbs">
        <Link to="/">{t('events.title')}</Link> / <Link to={`/events/${event.id}`}>{event.name}</Link> /{' '}
        {game.name || t(mod.nameKey)}
      </div>
      <div className="page-head">
        <h1>
          {t('eventGame.title')}: {game.name || t(mod.nameKey)}
        </h1>
      </div>

      <div className="card">
        <div className="field-row">
          <label className="field" style={{ minWidth: 280 }}>
            {t('eventGame.instanceName')}
            <input
              type="text"
              placeholder={t(mod.nameKey)}
              value={game.name}
              onChange={(e) => patchGame({ name: e.target.value })}
            />
          </label>
        </div>
        <p className="hint" style={{ marginBottom: 0 }}>
          {t('eventGame.instanceNameHint')}
        </p>
      </div>

      {SettingsEditor && (
        <div className="card">
          <h2>{t('eventGame.settings')}</h2>
          <SettingsEditor
            settings={{ ...mod.defaultSettings, ...game.settings }}
            onChange={(s) => patchGame({ settings: s })}
          />
        </div>
      )}

      <div className="card">
        <h2>{t('eventGame.selection')}</h2>
        <p className="hint">
          {t('eventGame.selectionHint')} · <Link to={`/backlog/${game.gameType}`}>{t('eventGame.toBacklog')}</Link>
        </p>
        {activeItems.length === 0 ? (
          <div className="empty">{t('eventGame.noItems')}</div>
        ) : (
          <div className="two-col">
            <div>
              <h3 style={{ fontSize: 13, color: 'var(--text-dim)' }}>
                {t('eventGame.available', { count: selectable.length })}
              </h3>
              <input
                type="search"
                placeholder={t('eventGame.search')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ width: '100%', marginBottom: 8 }}
              />
              <div className="row-list">
                {query && shown.length === 0 && <div className="empty">{t('backlog.filterEmpty')}</div>}
                {shown.map((item) => (
                  <div key={item.id} className="row">
                    <div className="grow">
                      <div className="title" style={{ fontSize: 14 }}>
                        {mod.itemLabel(item)}
                      </div>
                    </div>
                    {mod.itemTags?.(item).map((tag) => (
                      <TagBadge key={tag} tag={tag} />
                    ))}
                    <DifficultyDots level={item.difficulty} />
                    {!mod.itemReady(item) && <span className="badge warn">{t('backlog.incomplete')}</span>}
                    <button
                      className="btn small"
                      disabled={!mod.itemReady(item)}
                      onClick={() => {
                        patchGame({ itemIds: [...game.itemIds, item.id] })
                        setSearch('')
                      }}
                    >
                      → {t('eventGame.add')}
                    </button>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
                <button
                  className="btn small"
                  disabled={shown.filter((i) => mod.itemReady(i)).length === 0}
                  onClick={() => {
                    patchGame({
                      itemIds: [...game.itemIds, ...shown.filter((i) => mod.itemReady(i)).map((i) => i.id)],
                    })
                    setSearch('')
                  }}
                >
                  {t('eventGame.addAll')}
                </button>
              </div>
            </div>
            <div>
              <h3 style={{ fontSize: 13, color: 'var(--text-dim)' }}>
                {t('eventGame.selected', { count: game.itemIds.length })}
              </h3>
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={game.itemIds} strategy={verticalListSortingStrategy}>
                  <div className="row-list">
                    {game.itemIds.map((id, idx) => {
                      const item = items.find((i) => i.id === id)
                      return (
                        <SortableRow key={id} id={id}>
                          <span className="badge accent">{idx + 1}</span>
                          <div className="grow">
                            <div className="title" style={{ fontSize: 14 }}>
                              {item ? mod.itemLabel(item) : '?'}
                            </div>
                          </div>
                          {item &&
                            mod.itemTags?.(item).map((tag) => (
                              <TagBadge key={tag} tag={tag} />
                            ))}
                          <DifficultyDots level={item?.difficulty} />
                          <button className="btn icon small" onClick={() => moveItem(idx, -1)}>
                            ↑
                          </button>
                          <button className="btn icon small" onClick={() => moveItem(idx, 1)}>
                            ↓
                          </button>
                          <button
                            className="btn icon small danger"
                            onClick={() => patchGame({ itemIds: game.itemIds.filter((x) => x !== id) })}
                          >
                            ✕
                          </button>
                        </SortableRow>
                      )
                    })}
                  </div>
                </SortableContext>
              </DndContext>
              {game.itemIds.length > 0 && (
                <div style={{ marginTop: 10 }}>
                  <button className="btn small danger" onClick={() => patchGame({ itemIds: [] })}>
                    {t('eventGame.clear')}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  )
}
