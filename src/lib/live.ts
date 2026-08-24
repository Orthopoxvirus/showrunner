import type { LiveShow, ShowSnapshot } from './types'

/**
 * Live-show plumbing: the host window owns the state; the audience window is
 * a passive mirror. The host also persists every change to localStorage so an
 * accidental F5/reload resumes exactly where the show was.
 *
 * Transport is doubled: BroadcastChannel (any same-origin window) AND direct
 * window.postMessage to windows we opened ourselves — the latter is what
 * keeps standalone mode working, because file:// pages have opaque origins
 * where BroadcastChannel delivery isn't guaranteed.
 */

const STORAGE_KEY = 'showrunner.live'
const CHANNEL = 'showrunner.live'

export function saveLive(live: LiveShow): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(live))
}

export function loadLive(eventId: string): LiveShow | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const live = JSON.parse(raw) as LiveShow
    return live.eventId === eventId ? live : null
  } catch {
    return null
  }
}

export function clearLive(): void {
  localStorage.removeItem(STORAGE_KEY)
}

type HostMessage =
  | { kind: 'snapshot'; snapshot: ShowSnapshot }
  | { kind: 'fullscreen-toggle' }
interface AudienceMessage {
  kind: 'hello'
}

const audienceWindows = new Set<Window>()

function pruneAudienceWindows(): void {
  for (const win of audienceWindows) if (win.closed) audienceWindows.delete(win)
}

export function openAudienceWindow(): void {
  const win = window.open('#/audience', 'showrunner-audience', 'popup=yes,width=1280,height=720')
  if (win) audienceWindows.add(win)
}

export function hasAudienceWindow(): boolean {
  pruneAudienceWindows()
  return audienceWindows.size > 0
}

export function closeAudienceWindows(): void {
  for (const win of audienceWindows) {
    try {
      win.close()
    } catch {
      /* already gone */
    }
  }
  audienceWindows.clear()
}

/**
 * Ask the audience window(s) to toggle full screen. Must be called during a
 * user gesture in the host window: Chromium's capability delegation hands the
 * activation over so requestFullscreen is allowed over there. Delegation
 * requires a concrete targetOrigin (never '*'); where it is unsupported the
 * audience window falls back to a click-to-fullscreen hint.
 */
export function toggleAudienceFullscreen(): boolean {
  pruneAudienceWindows()
  if (audienceWindows.size === 0) return false
  const msg: HostMessage = { kind: 'fullscreen-toggle' }
  const origin = window.location.origin
  for (const win of audienceWindows) {
    try {
      win.postMessage(msg, {
        targetOrigin: origin && origin !== 'null' ? origin : '*',
        delegate: 'fullscreen',
      } as WindowPostMessageOptions)
    } catch {
      win.postMessage(msg, '*')
    }
  }
  return true
}

function tryChannel(): BroadcastChannel | null {
  try {
    return new BroadcastChannel(CHANNEL)
  } catch {
    return null
  }
}

export function createHostChannel(getSnapshot: () => ShowSnapshot | null) {
  const ch = tryChannel()
  const reply = (target?: Window | null) => {
    const snapshot = getSnapshot()
    if (!snapshot) return
    const msg: HostMessage = { kind: 'snapshot', snapshot }
    if (target) target.postMessage(msg, '*')
    else ch?.postMessage(msg)
  }
  if (ch) {
    ch.onmessage = (ev: MessageEvent<AudienceMessage>) => {
      if (ev.data?.kind === 'hello') reply()
    }
  }
  const onWindowMessage = (ev: MessageEvent<AudienceMessage>) => {
    if (ev.data?.kind === 'hello' && ev.source) reply(ev.source as Window)
  }
  window.addEventListener('message', onWindowMessage)

  return {
    publish(snapshot: ShowSnapshot) {
      const msg: HostMessage = { kind: 'snapshot', snapshot }
      try {
        ch?.postMessage(msg)
      } catch {
        /* channel closed */
      }
      for (const win of audienceWindows) {
        if (win.closed) {
          audienceWindows.delete(win)
        } else {
          win.postMessage(msg, '*')
        }
      }
    },
    close() {
      ch?.close()
      window.removeEventListener('message', onWindowMessage)
    },
  }
}

function toggleOwnFullscreen(onDenied?: () => void): void {
  if (document.fullscreenElement) {
    void document.exitFullscreen()
  } else {
    document.documentElement.requestFullscreen().catch(() => {
      // No delegated user activation (capability delegation is Chromium-only
      // and origin-dependent) — surface a click target instead.
      onDenied?.()
    })
  }
}

export function createAudienceChannel(
  onSnapshot: (s: ShowSnapshot) => void,
  onFullscreenDenied?: () => void,
): () => void {
  const handle = (msg: HostMessage) => {
    if (msg?.kind === 'snapshot') onSnapshot(msg.snapshot)
    else if (msg?.kind === 'fullscreen-toggle') toggleOwnFullscreen(onFullscreenDenied)
  }
  const ch = tryChannel()
  if (ch) {
    ch.onmessage = (ev: MessageEvent<HostMessage>) => {
      if (ev.data?.kind === 'snapshot') handle(ev.data) // fullscreen only via postMessage (needs delegated activation)
    }
  }
  const onWindowMessage = (ev: MessageEvent<HostMessage>) => handle(ev.data)
  window.addEventListener('message', onWindowMessage)

  // Local fallbacks with real user activation in this window.
  const onKey = (ev: KeyboardEvent) => {
    if (ev.key === 'F5') {
      ev.preventDefault()
      toggleOwnFullscreen()
    }
  }
  const onDblClick = () => toggleOwnFullscreen()
  window.addEventListener('keydown', onKey)
  window.addEventListener('dblclick', onDblClick)

  const hello: AudienceMessage = { kind: 'hello' }
  try {
    ch?.postMessage(hello)
  } catch {
    /* no channel */
  }
  window.opener?.postMessage(hello, '*')

  return () => {
    ch?.close()
    window.removeEventListener('message', onWindowMessage)
    window.removeEventListener('keydown', onKey)
    window.removeEventListener('dblclick', onDblClick)
  }
}
