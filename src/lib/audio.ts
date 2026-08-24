/**
 * Central audio engine (host window only — the audience window is purely
 * visual, so autoplay policies and device routing never bite mid-show).
 *
 * Songs are decoded once per URL and cached together with an in-memory
 * reversed copy — reversing a full song is a per-channel Float32Array reverse
 * and takes well under 100ms, so no reversed files ever touch the disk.
 */

export interface LoadedSong {
  url: string
  forward: AudioBuffer
  reversed: AudioBuffer
  duration: number
}

interface ActivePlayback {
  source: AudioBufferSourceNode
  gain: GainNode
  buffer: AudioBuffer
  segmentStart: number
  segmentEnd: number
  ctxStartTime: number
  stopped: boolean
}

export interface PlayOptions {
  /** Fade-in/out length in seconds, applied at both segment edges. */
  fade?: number
  /** Fires only when the segment runs out naturally, not on stop(). */
  onEnded?: () => void
}

function reverseBuffer(ctx: AudioContext, buf: AudioBuffer): AudioBuffer {
  const out = ctx.createBuffer(buf.numberOfChannels, buf.length, buf.sampleRate)
  for (let ch = 0; ch < buf.numberOfChannels; ch++) {
    const d = out.getChannelData(ch)
    d.set(buf.getChannelData(ch))
    d.reverse()
  }
  return out
}

const VOLUME_KEY = 'showrunner-volume'

/** Fired on window after a same-window setVolume (storage events only reach
 *  other windows), so volume UIs can follow keyboard changes. */
export const VOLUME_EVENT = 'showrunner-volume'

class AudioEngine {
  private _ctx: AudioContext | null = null
  private _master: GainNode | null = null
  private _volume = 1
  private cache = new Map<string, Promise<LoadedSong>>()
  private active: ActivePlayback | null = null

  constructor() {
    try {
      const raw = localStorage.getItem(VOLUME_KEY)
      const stored = raw === null || raw === '' ? NaN : Number(raw)
      if (Number.isFinite(stored)) this._volume = Math.min(1, Math.max(0, stored))
    } catch {
      /* storage unavailable */
    }
    // Another window (e.g. admin while a show host window is open) moved the
    // slider — follow along live.
    window.addEventListener('storage', (e) => {
      if (e.key === VOLUME_KEY && e.newValue !== null) {
        const v = Number(e.newValue)
        if (Number.isFinite(v)) this.applyVolume(Math.min(1, Math.max(0, v)))
      }
    })
  }

  get ctx(): AudioContext {
    if (!this._ctx) this._ctx = new AudioContext()
    if (this._ctx.state === 'suspended') void this._ctx.resume()
    return this._ctx
  }

  /** Master gain — every song and cue routes through it. */
  private get master(): GainNode {
    const ctx = this.ctx
    if (!this._master) {
      this._master = ctx.createGain()
      this._master.gain.value = this._volume * this._volume
      this._master.connect(ctx.destination)
    }
    return this._master
  }

  /** Global volume 0..1 (applied squared, for a natural-feeling slider). */
  get volume(): number {
    return this._volume
  }

  setVolume(v: number): void {
    const clamped = Math.min(1, Math.max(0, v))
    this.applyVolume(clamped)
    try {
      localStorage.setItem(VOLUME_KEY, String(clamped))
    } catch {
      /* storage unavailable */
    }
    window.dispatchEvent(new Event(VOLUME_EVENT))
  }

  private applyVolume(v: number): void {
    this._volume = v
    if (this._master && this._ctx) {
      this._master.gain.setTargetAtTime(v * v, this._ctx.currentTime, 0.02)
    }
  }

  loadSong(url: string): Promise<LoadedSong> {
    let p = this.cache.get(url)
    if (!p) {
      p = (async () => {
        const res = await fetch(url)
        if (!res.ok) throw new Error(`${res.status} loading ${url}`)
        const forward = await this.ctx.decodeAudioData(await res.arrayBuffer())
        return { url, forward, reversed: reverseBuffer(this.ctx, forward), duration: forward.duration }
      })()
      this.cache.set(url, p)
      p.catch(() => this.cache.delete(url))
    }
    return p
  }

  /** Play [start, end) seconds of a buffer, replacing any current playback. */
  playSegment(buffer: AudioBuffer, start: number, end: number, opts: PlayOptions = {}): void {
    this.stop()
    const ctx = this.ctx
    const s = Math.max(0, Math.min(start, buffer.duration))
    const e = Math.max(s, Math.min(end, buffer.duration))
    if (e - s < 0.01) return
    const source = ctx.createBufferSource()
    source.buffer = buffer
    const gain = ctx.createGain()
    source.connect(gain).connect(this.master)

    const t0 = ctx.currentTime
    const dur = e - s
    const fade = Math.min(Math.max(opts.fade ?? 0, 0), dur / 2)
    if (fade > 0.01) {
      gain.gain.setValueAtTime(0.0001, t0)
      gain.gain.linearRampToValueAtTime(1, t0 + fade)
      gain.gain.setValueAtTime(1, t0 + dur - fade)
      gain.gain.linearRampToValueAtTime(0.0001, t0 + dur)
    }

    const playback: ActivePlayback = {
      source,
      gain,
      buffer,
      segmentStart: s,
      segmentEnd: e,
      ctxStartTime: t0,
      stopped: false,
    }
    source.onended = () => {
      if (this.active === playback) this.active = null
      if (!playback.stopped) opts.onEnded?.()
    }
    source.start(0, s, e - s)
    this.active = playback
  }

  /** Stop playback; returns the buffer position (seconds) where it stopped.
   *  Cuts with a ~30ms declick ramp — intentionally abrupt (buzz!). */
  stop(): number | null {
    const a = this.active
    if (!a || !this._ctx) return null
    a.stopped = true
    this.active = null
    const now = this._ctx.currentTime
    try {
      a.gain.gain.cancelScheduledValues(now)
      a.gain.gain.setValueAtTime(a.gain.gain.value, now)
      a.gain.gain.linearRampToValueAtTime(0.0001, now + 0.03)
      a.source.stop(now + 0.035)
    } catch {
      /* already ended */
    }
    const pos = a.segmentStart + (now - a.ctxStartTime)
    return Math.min(pos, a.segmentEnd)
  }

  /** Current buffer position while playing, else null. Never resumes the
   *  context — this is polled per animation frame. */
  position(): number | null {
    const a = this.active
    if (!a || !this._ctx) return null
    return Math.min(a.segmentStart + (this._ctx.currentTime - a.ctxStartTime), a.segmentEnd)
  }

  get playing(): boolean {
    return this.active !== null
  }

  // -------------------------------------------------------------------------
  // Synthesized cues — no sample files, keeps the repo free of binaries.
  // -------------------------------------------------------------------------

  private tone(
    freq: number,
    at: number,
    dur: number,
    opts: { type?: OscillatorType; gain?: number; glideTo?: number } = {},
  ) {
    const ctx = this.ctx
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = opts.type ?? 'sine'
    osc.frequency.setValueAtTime(freq, at)
    if (opts.glideTo) osc.frequency.exponentialRampToValueAtTime(opts.glideTo, at + dur)
    const peak = opts.gain ?? 0.25
    g.gain.setValueAtTime(0, at)
    g.gain.linearRampToValueAtTime(peak, at + 0.01)
    g.gain.exponentialRampToValueAtTime(0.001, at + dur)
    osc.connect(g).connect(this.master)
    osc.start(at)
    osc.stop(at + dur + 0.05)
  }

  cue(name: 'buzz' | 'tick' | 'timeup' | 'reveal' | 'fanfare'): void {
    const t = this.ctx.currentTime
    switch (name) {
      case 'buzz':
        this.tone(233, t, 0.45, { type: 'square', gain: 0.18, glideTo: 116 })
        this.tone(237, t, 0.45, { type: 'sawtooth', gain: 0.12, glideTo: 118 })
        break
      case 'tick':
        this.tone(1320, t, 0.06, { type: 'triangle', gain: 0.15 })
        break
      case 'timeup':
        this.tone(880, t, 0.25, { type: 'triangle', gain: 0.22 })
        this.tone(587, t + 0.22, 0.5, { type: 'triangle', gain: 0.22 })
        break
      case 'reveal':
        this.tone(523, t, 0.12, { type: 'triangle', gain: 0.2 })
        this.tone(659, t + 0.1, 0.12, { type: 'triangle', gain: 0.2 })
        this.tone(784, t + 0.2, 0.12, { type: 'triangle', gain: 0.2 })
        this.tone(1047, t + 0.3, 0.35, { type: 'triangle', gain: 0.22 })
        break
      case 'fanfare':
        this.tone(392, t, 0.15, { type: 'triangle', gain: 0.2 })
        this.tone(523, t + 0.13, 0.15, { type: 'triangle', gain: 0.2 })
        this.tone(659, t + 0.26, 0.15, { type: 'triangle', gain: 0.2 })
        this.tone(784, t + 0.39, 0.5, { type: 'triangle', gain: 0.24 })
        this.tone(392, t + 0.39, 0.5, { type: 'triangle', gain: 0.12 })
        break
    }
  }
}

export const audio = new AudioEngine()
