import { create } from 'zustand'
import { api } from './api'
import { newId } from './ids'
import type { Backlog, BacklogItemBase, EventGame, ShowEvent } from './types'
import { games } from '../games/registry'

/** Debounced write-through: state updates instantly, disk writes settle 400ms later. */
const pending = new Map<string, ReturnType<typeof setTimeout>>()
function debounced(key: string, fn: () => void) {
  const t = pending.get(key)
  if (t) clearTimeout(t)
  pending.set(
    key,
    setTimeout(() => {
      pending.delete(key)
      fn()
    }, 400),
  )
}

interface AdminState {
  loaded: boolean
  error: string | null
  events: ShowEvent[]
  backlogs: Record<string, Backlog>
  load(): Promise<void>
  ensureBacklog(gameType: string): Promise<void>

  createEvent(name: string): ShowEvent
  updateEvent(event: ShowEvent): void
  deleteEvent(id: string): void
  addGameToEvent(eventId: string, gameType: string): EventGame | null

  updateBacklog(backlog: Backlog): void
  createItem(gameType: string): BacklogItemBase | null
}

export const useStore = create<AdminState>((set, get) => ({
  loaded: false,
  error: null,
  events: [],
  backlogs: {},

  async load() {
    try {
      const events = await api.loadEvents()
      events.sort((a, b) => (a.date < b.date ? 1 : -1))
      set({ events, loaded: true, error: null })
    } catch (e) {
      set({ error: String(e), loaded: true })
    }
  },

  async ensureBacklog(gameType) {
    if (get().backlogs[gameType]) return
    const backlog = await api.loadBacklog(gameType)
    set((s) => ({ backlogs: { ...s.backlogs, [gameType]: backlog } }))
  },

  createEvent(name) {
    const event: ShowEvent = {
      id: newId('evt'),
      name,
      date: new Date().toISOString().slice(0, 10),
      players: [],
      games: [],
    }
    set((s) => ({ events: [event, ...s.events] }))
    void api.saveEvent(event)
    return event
  },

  updateEvent(event) {
    set((s) => ({ events: s.events.map((e) => (e.id === event.id ? event : e)) }))
    debounced(`event:${event.id}`, () => void api.saveEvent(event))
  },

  deleteEvent(id) {
    set((s) => ({ events: s.events.filter((e) => e.id !== id) }))
    void api.deleteEvent(id)
  },

  addGameToEvent(eventId, gameType) {
    const mod = games[gameType]
    const event = get().events.find((e) => e.id === eventId)
    if (!mod || !event) return null
    const game: EventGame = {
      id: newId('eg'),
      gameType,
      name: '',
      settings: { ...mod.defaultSettings },
      itemIds: [],
    }
    get().updateEvent({ ...event, games: [...event.games, game] })
    return game
  },

  updateBacklog(backlog) {
    set((s) => ({ backlogs: { ...s.backlogs, [backlog.gameType]: backlog } }))
    debounced(`backlog:${backlog.gameType}`, () => void api.saveBacklog(backlog))
  },

  createItem(gameType) {
    const mod = games[gameType]
    const backlog = get().backlogs[gameType]
    if (!mod || !backlog) return null
    const item = mod.createItem()
    // newest first — fresh entries belong at the top of the backlog list
    get().updateBacklog({ ...backlog, items: [item, ...backlog.items] })
    return item
  },
}))
