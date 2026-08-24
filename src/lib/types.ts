import type { FC } from 'react'

// ---------------------------------------------------------------------------
// Data model: Event -> EventGame -> selected backlog items
// ---------------------------------------------------------------------------

export interface Player {
  id: string
  name: string
  /** Buzzer color of this player (hex), shown in score displays. */
  color?: string
}

export interface EventGame {
  id: string
  gameType: string
  name: string
  settings: Record<string, unknown>
  itemIds: string[]
}

export type ScoreboardPos = 'top' | 'bottom' | 'left' | 'right'

export interface ShowEvent {
  id: string
  name: string
  date: string
  /** Hide the "Showrunner" branding on the audience screens of this event. */
  hideBranding?: boolean
  /** Hide the "Game x of y" counter on game intro screens. */
  hideGameCounter?: boolean
  /** Where the score overlay docks on the stage (default: bottom). */
  scoreboardPos?: ScoreboardPos
  players: Player[]
  games: EventGame[]
}

/** 1 = easy, 2 = medium, 3 = hard. */
export type Difficulty = 1 | 2 | 3

export interface BacklogItemBase {
  id: string
  retired?: boolean
  notes?: string
  /** Optional difficulty rating; unset = unrated. */
  difficulty?: Difficulty
}

export interface Backlog<TItem extends BacklogItemBase = BacklogItemBase> {
  gameType: string
  items: TItem[]
}

// ---------------------------------------------------------------------------
// Live show state (serializable: persisted to localStorage + broadcast to the
// audience window on every change)
// ---------------------------------------------------------------------------

/** A just-awarded point: briefly flashes the score overlay on the audience
 *  screen even while the scoreboard is toggled off. */
export interface ScorePulse {
  playerId: string
  delta: number
  /** Epoch ms of the award; keys the flash animation. */
  at: number
}

export type ShowScreen =
  | 'lobby'
  | 'game-intro'
  | 'game'
  | 'game-end'
  | 'break' // black slide between games (for transitions, stage changes, …)
  | 'show-end'
  | 'final-black' // black slide after the closing screen
export type BlankMode = 'none' | 'black' | 'white'

export interface LiveShow {
  eventId: string
  screen: ShowScreen
  /** Sub-step within multi-step screens (game intro animation, game-end
   *  score reveal). Reset to 0 whenever the screen changes. */
  screenStep: number
  gameIdx: number
  itemIdx: number
  /** Game-specific phase state; must stay JSON-serializable. */
  phase: unknown
  scores: Record<string, number>
  blank: BlankMode
  scoreboard: boolean
  /** Set on every point award, cleared by the host a few seconds later. */
  scorePulse?: ScorePulse | null
}

/** Everything the audience window needs to render, resolved by the host. */
export interface ShowSnapshot {
  live: LiveShow
  eventName: string
  hideBranding: boolean
  hideGameCounter: boolean
  scoreboardPos: ScoreboardPos
  players: Player[]
  gameType: string | null
  gameName: string | null
  gameSettings: Record<string, unknown>
  gameCount: number
  item: unknown
  itemCount: number
}

// ---------------------------------------------------------------------------
// Game plugin contract
// ---------------------------------------------------------------------------

/**
 * Pure, serializable flow machine. Side effects (audio, timers) live in the
 * game's HostView, reacting to phase changes; `patchPhase` lets it write
 * runtime data (e.g. where playback stopped) back into the phase.
 */
export interface GameFlow<TItem, TPhase, TSettings> {
  initialPhase(item: TItem, settings: TSettings): TPhase
  /** Return 'done' to advance to the next item (or end the game). */
  advance(phase: TPhase, item: TItem, settings: TSettings): TPhase | 'done'
  back(phase: TPhase, item: TItem, settings: TSettings): TPhase
}

export interface GameRuntimeProps<TItem, TPhase, TSettings> {
  item: TItem
  itemIndex: number
  itemCount: number
  phase: TPhase
  patchPhase(patch: Partial<TPhase>): void
  settings: TSettings
  players: Player[]
  scores: Record<string, number>
}

export interface GameEditorProps<TItem> {
  item: TItem
  onChange(item: TItem): void
}

export interface GameSettingsProps<TSettings> {
  settings: TSettings
  onChange(settings: TSettings): void
}

export interface GameIntroProps<TSettings> {
  /** Current sub-step of the intro screen (0 = initial; advanced by "next"). */
  step: number
  gameName: string
  gameIdx: number
  gameCount: number
  hideGameCounter: boolean
  settings: TSettings
}

export interface GameModule<
  TItem extends BacklogItemBase = BacklogItemBase,
  TPhase = unknown,
  TSettings = Record<string, unknown>,
> {
  type: string
  /** i18n keys — the framework renders all game chrome through i18n. */
  nameKey: string
  taglineKey: string
  minPlayers: number
  maxPlayers: number
  defaultSettings: TSettings
  createItem(): TItem
  /** MIME prefix of this game's media uploads. Together with `itemFromFile`
   *  it lets the backlog page accept dropped files, creating one item each. */
  mediaKind?: 'audio' | 'image'
  /** Build a new backlog item prefilled from an uploaded media file. */
  itemFromFile?(path: string): TItem
  itemLabel(item: TItem): string
  /** Short display tags for backlog/selection lists (category, ♂/♀, …).
   *  Also drives the backlog filter chips. */
  itemTags?(item: TItem): string[]
  /** Is the item complete enough to be playable in a show? */
  itemReady(item: TItem): boolean
  Editor: FC<GameEditorProps<TItem>>
  SettingsEditor?: FC<GameSettingsProps<TSettings>>
  /** Number of extra "next"-steps on the game intro screen (e.g. to trigger
   *  an intro animation). Default 0. */
  introSteps?(settings: TSettings): number
  /** Custom game intro screen; falls back to the framework default. */
  IntroView?: FC<GameIntroProps<TSettings>>
  flow: GameFlow<TItem, TPhase, TSettings>
  HostView: FC<GameRuntimeProps<TItem, TPhase, TSettings>>
  AudienceView: FC<GameRuntimeProps<TItem, TPhase, TSettings>>
}

// Loosely-typed alias for registry/framework code that must not care about
// the concrete item/phase/settings types of each game.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyGameModule = GameModule<any, any, any>
