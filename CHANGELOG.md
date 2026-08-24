# Changelog

All notable changes to Showrunner are documented here. Release zips on the
releases page are standalone bundles — unzip, open `index.html` in Chrome or
Edge, pick a `data/` folder once.

## v1.5.1 — 2026-08-24

- First public release on GitHub ([Orthopoxvirus/showrunner](https://github.com/Orthopoxvirus/showrunner)).
- Per-game guides with tips & tricks ([docs/games/](docs/games/)), README rework.
- Release pipeline: public GitHub mirror publish + standalone release build.
  Public release zips ship without a `data/` folder — create an empty one and
  pick it on first launch.

## v1.5.0 — 2026-08-15

- **Pixelgesicht** — second game: pixelated-face reveal with a tuned,
  non-linear de-pixelation stage ladder, freeze-on-buzz, rewind-on-wrong-answer
  and an intro title animation. See [docs/games/pixelgesicht.md](docs/games/pixelgesicht.md).
- Sortable item selection: drag-and-drop ordering of the per-event backlog
  selection.
- Score reset per game and volume keys (`+`/`−`) in the show.
- Global volume slider (persisted, synced across windows) and a score-award
  flash on the audience overlay.
- Drag-and-drop media uploads in the backlog editors; Pixelgesicht pre-fills
  the name from the image filename.
- Quieter answer phase and stage-ladder tuning for Pixelgesicht.

## v1.4.0 — 2026-08-10

- Self-contained per-game data folders: `data/games/<type>/` now holds the
  backlog *and* its media — copy one folder to move a game between data
  directories.
- Audience-window fullscreen via F5; progress bars are now
  background-throttle-proof.

## v1.3.0 — 2026-08-10

- Intro flip animation for Kisum ("Musik" → "Kisum").
- Stage visual polish; configurable score-overlay positions.
- Audience-window controls (blank to black/white, fullscreen).

## v1.2.0 — 2026-08-10

- Kisum editor: space-bar preview on the waveform.
- Configurable audio fade at clip edges.
- Per-event branding toggle.

## v1.1.0 — 2026-08-10

- Framework v1: events, per-event games, backlogs with item selection, teams,
  manual score overlay, host + audience windows over `BroadcastChannel`,
  bilingual UI (en/de), presenter-remote/keyboard driving.
- **Kisum** — first game: music played in reverse, with waveform region
  editor, on-the-fly reversal, answer timer and rewind mechanic. See
  [docs/games/kisum.md](docs/games/kisum.md).
- Standalone mode: single-file build (`vite-plugin-singlefile`) + File System
  Access API — run the show from `file://` with no local process at all.
- Release script: tagged standalone zip published to a Gitea instance.
