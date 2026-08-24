import { games } from '../games/registry'
import type { AnyGameModule, Backlog, BacklogItemBase, EventGame, LiveShow, ShowEvent, ShowSnapshot } from '../lib/types'

export interface ShowContext {
  event: ShowEvent
  backlogs: Record<string, Backlog>
}

export function freshLive(eventId: string): LiveShow {
  return {
    eventId,
    screen: 'lobby',
    screenStep: 0,
    gameIdx: 0,
    itemIdx: 0,
    phase: null,
    scores: {},
    blank: 'none',
    scoreboard: false,
    scorePulse: null,
  }
}

export function currentGame(live: LiveShow, ctx: ShowContext): EventGame | null {
  return ctx.event.games[live.gameIdx] ?? null
}

export function gameModule(game: EventGame | null): AnyGameModule | null {
  return game ? (games[game.gameType] ?? null) : null
}

/** Stored settings merged over the module defaults, so games saved before a
 *  setting existed still get its default value. */
export function effectiveSettings(game: EventGame | null): Record<string, unknown> {
  const mod = gameModule(game)
  return { ...(mod?.defaultSettings ?? {}), ...(game?.settings ?? {}) }
}

/** How long a point award flashes the hidden scoreboard (host clears the
 *  pulse after this; the CSS score-flash animation matches it). */
export const SCORE_FLASH_MS = 4000

/** Whether the score overlay shows right now — toggled on, or briefly
 *  flashed in by a point award. Hidden on black slides and behind the big
 *  game-end score reveal (which shows the points itself). */
export function scoreboardVisible(live: LiveShow): boolean {
  if (!live.scoreboard && !live.scorePulse) return false
  if (live.screen === 'break' || live.screen === 'final-black') return false
  if (live.screen === 'game-end' && (live.screenStep ?? 0) >= 1) return false
  return true
}

/** Whether the stage should reserve space for the overlay. Only when it is
 *  toggled on permanently — a transient flash floats over the content, so
 *  the stage layout never jumps. */
export function scoreboardDocked(live: LiveShow): boolean {
  return live.scoreboard && scoreboardVisible(live)
}

/** The playable items of an event game, in selected order (deleted ones dropped). */
export function gameItems(game: EventGame | null, ctx: ShowContext): BacklogItemBase[] {
  if (!game) return []
  const pool = ctx.backlogs[game.gameType]?.items ?? []
  return game.itemIds.map((id) => pool.find((i) => i.id === id)).filter((i): i is BacklogItemBase => Boolean(i))
}

/**
 * Screen order per show:
 *   lobby → [game-intro (+N steps) → game → game-end (Ende → score reveal)
 *   → break (black)] per game → show-end → final-black
 */
export function advanceShow(live: LiveShow, ctx: ShowContext): LiveShow {
  const game = currentGame(live, ctx)
  const mod = gameModule(game)
  const items = gameItems(game, ctx)
  const step = live.screenStep ?? 0

  switch (live.screen) {
    case 'lobby':
      return ctx.event.games.length > 0
        ? { ...live, screen: 'game-intro', screenStep: 0, gameIdx: 0 }
        : { ...live, screen: 'show-end', screenStep: 0 }
    case 'game-intro': {
      if (!mod || !game || items.length === 0) return { ...live, screen: 'game-end', screenStep: 0 }
      const introSteps = mod.introSteps ? mod.introSteps(effectiveSettings(game)) : 0
      if (step < introSteps) return { ...live, screenStep: step + 1 }
      return {
        ...live,
        screen: 'game',
        screenStep: 0,
        itemIdx: 0,
        phase: mod.flow.initialPhase(items[0], effectiveSettings(game)),
      }
    }
    case 'game': {
      if (!mod || !game) return { ...live, screen: 'game-end', screenStep: 0 }
      const item = items[live.itemIdx]
      if (!item) return { ...live, screen: 'game-end', screenStep: 0 }
      const result = mod.flow.advance(live.phase, item, effectiveSettings(game))
      if (result !== 'done') return { ...live, phase: result }
      const nextIdx = live.itemIdx + 1
      if (nextIdx < items.length) {
        return { ...live, itemIdx: nextIdx, phase: mod.flow.initialPhase(items[nextIdx], effectiveSettings(game)) }
      }
      return { ...live, screen: 'game-end', screenStep: 0 }
    }
    case 'game-end':
      if (step < 1) return { ...live, screenStep: 1 } // reveal the score board
      return { ...live, screen: 'break', screenStep: 0 }
    case 'break':
      return live.gameIdx + 1 < ctx.event.games.length
        ? { ...live, screen: 'game-intro', screenStep: 0, gameIdx: live.gameIdx + 1, itemIdx: 0, phase: null }
        : { ...live, screen: 'show-end', screenStep: 0 }
    case 'show-end':
      return { ...live, screen: 'final-black', screenStep: 0 }
    case 'final-black':
      return live
  }
}

/** Jump straight to a game's intro screen, keeping the scores. The running
 *  game's phase is discarded — coming back re-enters it fresh. */
export function jumpToGame(live: LiveShow, ctx: ShowContext, gameIdx: number): LiveShow {
  if (gameIdx < 0 || gameIdx >= ctx.event.games.length) return live
  return { ...live, screen: 'game-intro', screenStep: 0, gameIdx, itemIdx: 0, phase: null }
}

export function backShow(live: LiveShow, ctx: ShowContext): LiveShow {
  const game = currentGame(live, ctx)
  const mod = gameModule(game)
  const items = gameItems(game, ctx)
  const step = live.screenStep ?? 0

  switch (live.screen) {
    case 'lobby':
      return live
    case 'game-intro':
      if (step > 0) return { ...live, screenStep: step - 1 }
      return live.gameIdx > 0
        ? { ...live, screen: 'break', screenStep: 0, gameIdx: live.gameIdx - 1 }
        : { ...live, screen: 'lobby', screenStep: 0 }
    case 'game': {
      if (!mod || !game) return { ...live, screen: 'game-intro', screenStep: 0 }
      const item = items[live.itemIdx]
      if (!item) return { ...live, screen: 'game-intro', screenStep: 0 }
      return { ...live, phase: mod.flow.back(live.phase, item, effectiveSettings(game)) }
    }
    case 'game-end': {
      if (step > 0) return { ...live, screenStep: 0 }
      if (!mod || !game || items.length === 0) return { ...live, screen: 'game-intro', screenStep: 0 }
      const last = items.length - 1
      return {
        ...live,
        screen: 'game',
        screenStep: 0,
        itemIdx: last,
        phase: mod.flow.initialPhase(items[last], effectiveSettings(game)),
      }
    }
    case 'break':
      return { ...live, screen: 'game-end', screenStep: 1 }
    case 'show-end':
      return { ...live, screen: 'break', screenStep: 0, gameIdx: Math.max(0, ctx.event.games.length - 1) }
    case 'final-black':
      return { ...live, screen: 'show-end', screenStep: 0 }
  }
}

export function buildSnapshot(live: LiveShow, ctx: ShowContext): ShowSnapshot {
  const game = currentGame(live, ctx)
  const items = gameItems(game, ctx)
  return {
    live,
    eventName: ctx.event.name,
    hideBranding: ctx.event.hideBranding ?? false,
    hideGameCounter: ctx.event.hideGameCounter ?? false,
    scoreboardPos: ctx.event.scoreboardPos ?? 'bottom',
    players: ctx.event.players,
    gameType: game?.gameType ?? null,
    gameName: game ? game.name || null : null,
    gameSettings: effectiveSettings(game),
    gameCount: ctx.event.games.length,
    item: items[live.itemIdx] ?? null,
    itemCount: items.length,
  }
}
