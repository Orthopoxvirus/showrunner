/**
 * Pluggable persistence. Two backends, same interface:
 *
 * - `bridge`: the app is served by the local Vite process (dev or preview);
 *   all I/O goes through the data-bridge REST API onto `data/` (see
 *   plugins/data-bridge.ts).
 * - `fsa`: standalone mode — the app runs from a static build (typically a
 *   double-clicked `index.html` from a release zip, `file://`). The user picks
 *   the `data/` folder once via the File System Access API (Chromium) and the
 *   browser reads/writes the very same JSON/media files directly.
 *
 * Either way, the source of truth stays plain files on disk.
 */
import type { Backlog, ShowEvent } from './types'

export interface MediaEntry {
  name: string
  path: string
}

export interface DataBackend {
  kind: 'bridge' | 'fsa'
  loadEvents(): Promise<ShowEvent[]>
  saveEvent(event: ShowEvent): Promise<void>
  deleteEvent(id: string): Promise<void>
  loadBacklog(gameType: string): Promise<Backlog>
  saveBacklog(backlog: Backlog): Promise<void>
  listMedia(gameType: string): Promise<MediaEntry[]>
  uploadMedia(gameType: string, file: File): Promise<MediaEntry>
  /** Resolve a data-relative media path (`media/<game>/<file>`) to a URL the
   *  browser can fetch/decode. Async because the FSA backend mints blob URLs. */
  mediaUrl(path: string): Promise<string>
}

// ---------------------------------------------------------------------------
// Active-backend registry (App subscribes; the folder gate swaps it in)
// ---------------------------------------------------------------------------

let active: DataBackend | null = null
const listeners = new Set<() => void>()

export function getBackend(): DataBackend | null {
  return active
}

export function setBackend(backend: DataBackend): void {
  active = backend
  for (const cb of listeners) cb()
}

export function subscribeBackend(cb: () => void): () => void {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

function must(): DataBackend {
  if (!active) throw new Error('no data backend initialized')
  return active
}

/** Stable facade used by the rest of the app. */
export const api = {
  loadEvents: () => must().loadEvents(),
  saveEvent: (e: ShowEvent) => must().saveEvent(e),
  deleteEvent: (id: string) => must().deleteEvent(id),
  loadBacklog: (g: string) => must().loadBacklog(g),
  saveBacklog: (b: Backlog) => must().saveBacklog(b),
  listMedia: (g: string) => must().listMedia(g),
  uploadMedia: (g: string, f: File) => must().uploadMedia(g, f),
  mediaUrl: (p: string) => must().mediaUrl(p),
}

// ---------------------------------------------------------------------------
// Bridge backend (Vite dev/preview process)
// ---------------------------------------------------------------------------

async function check(res: Response): Promise<Response> {
  if (!res.ok) {
    let detail = ''
    try {
      detail = (await res.json()).error ?? ''
    } catch {
      /* body not json */
    }
    throw new Error(`${res.status} ${res.statusText}${detail ? `: ${detail}` : ''}`)
  }
  return res
}

export const bridgeBackend: DataBackend = {
  kind: 'bridge',
  async loadEvents() {
    return (await check(await fetch('/api/events'))).json()
  },
  async saveEvent(event) {
    await check(
      await fetch(`/api/events/${event.id}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(event, null, 2) + '\n',
      }),
    )
  },
  async deleteEvent(id) {
    await check(await fetch(`/api/events/${id}`, { method: 'DELETE' }))
  },
  async loadBacklog(gameType) {
    return (await check(await fetch(`/api/backlog/${gameType}`))).json()
  },
  async saveBacklog(backlog) {
    await check(
      await fetch(`/api/backlog/${backlog.gameType}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(backlog, null, 2) + '\n',
      }),
    )
  },
  async listMedia(gameType) {
    return (await check(await fetch(`/api/media/${gameType}`))).json()
  },
  async uploadMedia(gameType, file) {
    return (
      await check(
        await fetch(`/api/media/${gameType}`, {
          method: 'POST',
          headers: { 'x-filename': encodeURIComponent(file.name) },
          body: file,
        }),
      )
    ).json()
  },
  async mediaUrl(path) {
    return `/data/${path.split('/').map(encodeURIComponent).join('/')}`
  },
}

// ---------------------------------------------------------------------------
// FSA backend (standalone: File System Access API on a picked data/ folder)
// ---------------------------------------------------------------------------

/** Same rules as the bridge (plugins/data-bridge.ts): sanitize instead of
 *  reject — strip path parts, control and Windows-reserved characters,
 *  traversal, hidden files, trailing dots/spaces. */
function safeName(raw: string): string | null {
  const base = (raw ?? '').split(/[/\\]/).pop() ?? ''
  const cleaned = base
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x1f\x7f<>:"|?*]/g, '_')
    .replace(/\.{2,}/g, '.')
    .replace(/^[. ]+/, '')
    .replace(/[. ]+$/, '')
    .trim()
  return cleaned.length > 0 && cleaned.length <= 180 ? cleaned : null
}

/** `media/<type>/<file>` (pre-1.4 layout) → `games/<type>/media/<file>`. */
function migrateLegacyMediaPath(path: string): string | null {
  const m = path.match(/^media\/([\w-]+)\/(.+)$/)
  return m ? `games/${m[1]}/media/${m[2]}` : null
}

export class FsaBackend implements DataBackend {
  readonly kind = 'fsa'
  private urlCache = new Map<string, string>()

  constructor(private root: FileSystemDirectoryHandle) {}

  private async dir(segments: string[], create: boolean): Promise<FileSystemDirectoryHandle | null> {
    let h = this.root
    for (const seg of segments) {
      try {
        h = await h.getDirectoryHandle(seg, { create })
      } catch {
        return null
      }
    }
    return h
  }

  private async writeFile(segments: string[], name: string, content: Blob | string): Promise<void> {
    const d = await this.dir(segments, true)
    if (!d) throw new Error(`cannot open data/${segments.join('/')}`)
    const fh = await d.getFileHandle(name, { create: true })
    const w = await fh.createWritable()
    await w.write(content)
    await w.close()
  }

  async loadEvents(): Promise<ShowEvent[]> {
    const d = await this.dir(['events'], false)
    if (!d) return []
    const events: ShowEvent[] = []
    for await (const handle of d.values()) {
      if (handle.kind !== 'file' || !handle.name.endsWith('.json')) continue
      try {
        const file = await (handle as FileSystemFileHandle).getFile()
        events.push(JSON.parse(await file.text()))
      } catch {
        console.warn(`[fsa] skipping unparseable ${handle.name}`)
      }
    }
    return events
  }

  async saveEvent(event: ShowEvent): Promise<void> {
    await this.writeFile(['events'], `${event.id}.json`, JSON.stringify(event, null, 2) + '\n')
  }

  async deleteEvent(id: string): Promise<void> {
    const d = await this.dir(['events'], false)
    if (!d) return
    try {
      await d.removeEntry(`${id}.json`)
    } catch {
      /* already gone */
    }
  }

  async loadBacklog(gameType: string): Promise<Backlog> {
    const d = await this.dir(['games', gameType], false)
    if (d) {
      try {
        const fh = await d.getFileHandle('backlog.json')
        return JSON.parse(await (await fh.getFile()).text())
      } catch {
        /* fall through to empty default */
      }
    }
    return { gameType, items: [] }
  }

  async saveBacklog(backlog: Backlog): Promise<void> {
    await this.writeFile(['games', backlog.gameType], 'backlog.json', JSON.stringify(backlog, null, 2) + '\n')
  }

  async listMedia(gameType: string): Promise<MediaEntry[]> {
    const d = await this.dir(['games', gameType, 'media'], false)
    if (!d) return []
    const out: MediaEntry[] = []
    for await (const handle of d.values()) {
      if (handle.kind === 'file' && !handle.name.startsWith('.')) {
        out.push({ name: handle.name, path: `games/${gameType}/media/${handle.name}` })
      }
    }
    return out.sort((a, b) => a.name.localeCompare(b.name))
  }

  async uploadMedia(gameType: string, file: File): Promise<MediaEntry> {
    const name = safeName(file.name)
    if (!name) throw new Error(`invalid filename: ${file.name}`)
    await this.writeFile(['games', gameType, 'media'], name, file)
    return { name, path: `games/${gameType}/media/${name}` }
  }

  private async fileAt(path: string): Promise<File | null> {
    const segments = path.split('/').filter(Boolean)
    if (segments.some((s) => s === '..')) return null
    const name = segments.pop()
    const d = await this.dir(segments, false)
    if (!d || !name) return null
    try {
      return await (await d.getFileHandle(name)).getFile()
    } catch {
      return null
    }
  }

  async mediaUrl(path: string): Promise<string> {
    const cached = this.urlCache.get(path)
    if (cached) return cached
    let file = await this.fileAt(path)
    if (!file) {
      // items saved before the per-game folder layout still resolve
      const migrated = migrateLegacyMediaPath(path)
      if (migrated) file = await this.fileAt(migrated)
    }
    if (!file) throw new Error(`not found: ${path}`)
    const url = URL.createObjectURL(file)
    this.urlCache.set(path, url)
    return url
  }
}

// ---------------------------------------------------------------------------
// Standalone bootstrapping: handle persistence + folder pick
// ---------------------------------------------------------------------------

const IDB_NAME = 'showrunner-fsa'
const IDB_STORE = 'kv'
const IDB_KEY = 'dataDir'

function openIdb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function idbGet<T>(key: string): Promise<T | null> {
  try {
    const db = await openIdb()
    return await new Promise((resolve) => {
      const req = db.transaction(IDB_STORE).objectStore(IDB_STORE).get(key)
      req.onsuccess = () => resolve((req.result as T) ?? null)
      req.onerror = () => resolve(null)
    })
  } catch {
    return null
  }
}

async function idbSet(key: string, value: unknown): Promise<void> {
  try {
    const db = await openIdb()
    await new Promise<void>((resolve) => {
      const tx = db.transaction(IDB_STORE, 'readwrite')
      tx.objectStore(IDB_STORE).put(value, key)
      tx.oncomplete = () => resolve()
      tx.onerror = () => resolve()
    })
  } catch {
    /* storage unavailable — folder just has to be re-picked next time */
  }
}

/** If the user picked the repo root (or any folder containing `data/`),
 *  descend into it; otherwise use the picked folder as the data root. */
async function normalizeRoot(h: FileSystemDirectoryHandle): Promise<FileSystemDirectoryHandle> {
  if (h.name === 'data') return h
  try {
    return await h.getDirectoryHandle('data')
  } catch {
    return h
  }
}

export function fsaSupported(): boolean {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window
}

async function adopt(handle: FileSystemDirectoryHandle, persist: boolean): Promise<void> {
  const root = await normalizeRoot(handle)
  if (persist) await idbSet(IDB_KEY, handle)
  setBackend(new FsaBackend(root))
}

/** User gesture: open the directory picker. Returns false when cancelled. */
export async function pickDataFolder(): Promise<boolean> {
  try {
    const handle = await window.showDirectoryPicker({ id: 'showrunner-data', mode: 'readwrite' })
    await adopt(handle, true)
    return true
  } catch {
    return false // cancelled or denied
  }
}

/** User gesture: re-authorize the folder remembered from a previous session. */
export async function restoreDataFolder(): Promise<boolean> {
  const handle = await idbGet<FileSystemDirectoryHandle>(IDB_KEY)
  if (!handle) return false
  try {
    if ((await handle.queryPermission({ mode: 'readwrite' })) !== 'granted') {
      if ((await handle.requestPermission({ mode: 'readwrite' })) !== 'granted') return false
    }
    await adopt(handle, false)
    return true
  } catch {
    return false
  }
}

export type InitialBackendState =
  | { state: 'ready' }
  | { state: 'gate'; restorable: boolean; supported: boolean }

/**
 * Decide how this session persists:
 * served by the Vite process -> bridge; otherwise (file:// or a plain static
 * host) -> standalone. If the remembered folder is still authorized we adopt
 * it silently, else the folder gate takes over.
 */
export async function detectInitialBackend(): Promise<InitialBackendState> {
  if (window.location.protocol !== 'file:') {
    try {
      const res = await fetch('/api/events', { cache: 'no-store' })
      if (res.ok) {
        setBackend(bridgeBackend)
        return { state: 'ready' }
      }
    } catch {
      /* no bridge — fall through to standalone */
    }
  }
  const stored = await idbGet<FileSystemDirectoryHandle>(IDB_KEY)
  if (stored) {
    try {
      if ((await stored.queryPermission({ mode: 'readwrite' })) === 'granted') {
        await adopt(stored, false)
        return { state: 'ready' }
      }
    } catch {
      /* handle stale (folder moved/deleted) — fall through to the gate */
    }
  }
  return { state: 'gate', restorable: stored !== null, supported: fsaSupported() }
}

// Test/power-user escape hatch: adopt any FileSystemDirectoryHandle (e.g. an
// OPFS directory in automated tests) as the data root without a picker.
declare global {
  interface Window {
    showrunnerAdoptDataDir?: (h: FileSystemDirectoryHandle) => Promise<void>
  }
}
window.showrunnerAdoptDataDir = (h) => adopt(h, false)
