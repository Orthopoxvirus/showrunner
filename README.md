# Showrunner

**A browser-based, fully offline framework for building and hosting game-show games.**

Showrunner replaces the tradition of "programming" quiz and party game shows as
PowerPoint decks. Instead, every show runs in a plain web browser, driven by a
small reusable framework plus one implementation per game. It needs **no server
and no internet connection** — you can run it on a laptop at a party, in a
classroom, or on a beamer in the living room.

You maintain a large **backlog** of questions/tasks per game, and for each
**event** you pick a subset of that backlog to actually play. All data lives in
portable JSON files that can be committed and pushed like any other source.

---

## Why

Building a game show in PowerPoint is slow, fragile, and hard to reuse:

- Every new round is copy-pasted slides with hand-wired animations.
- Scoring, timers, and buzzers are faked by hand during the show.
- Content (questions/tasks) is welded to presentation — you can't keep a growing
  backlog and just pick from it per occasion.
- Sound, reveals, and transitions are brittle.

Showrunner separates **content** (a reusable backlog of questions/tasks) from
**presentation** (a coded game with defined flows, on-screen displays, and
sound), so you author once and replay forever.

---

## Core concepts

The data model is a simple four-level hierarchy:

```
Event  ──has many──▶  Game (instance)  ──selects a subset of──▶  Backlog Items
                                                                   (questions /
                                                                    tasks)

Game (type)  ──owns──▶  Backlog  ──contains──▶  Backlog Items
```

| Concept | What it is |
|---|---|
| **Game (type)** | A coded game — e.g. a buzzer quiz, a "guess the price", a family-feud clone. Defines the flow, the screens, the sounds, and the shape of its content. |
| **Backlog** | The full pool of questions/tasks authored for a given game type. Grows over time; reused across events. |
| **Backlog item** | One question or task (with its answer(s), media, points, metadata). |
| **Event (Anlass)** | One occasion on which shows are played (a party, a company night, a birthday). |
| **Event game** | A game *played at a specific event*, configured with a **selected subset** of that game's backlog and any per-event settings (teams, order, points). |
| **Teams / players** | The contestants — they change per event, typically **2–4 players per game**. Each game defines which line-ups it supports and handles them. Points are **tracked manually by the host and shown as a simple overlay**, not an automatic scoring engine. |

So the same game type carries a big backlog, and each event cherry-picks the
items it wants to play.

---

## Features

- **Runs 100% locally, offline.** No backend, no cloud, no accounts. Open it in a
  browser and go.
- **Admin interface** to manage the whole hierarchy:
  - create and edit **events**,
  - add **games** to an event,
  - author and curate the **backlog** of questions/tasks per game,
  - select the **subset** of backlog items to play at each event.
- **Playable games**, each with a coded **flow**, on-screen **displays** (for the
  host and/or the beamer), scoring, timers, reveals, and **sound**.
- **Presenter-driven.** The whole show can be run from the keyboard or a standard
  presenter remote (clicker) — arrows, Page Up/Down, F5, blank — exactly like a
  PowerPoint presentation, no mouse required.
- **Host & audience views.** Like PowerPoint's presenter view: the audience/beamer
  sees only the show, while the host sees the extras — correct answers, notes,
  what's coming next, and the score controls. Answers never appear on the audience
  screen until you reveal them.
- **Teams & simple scoring.** Teams/players are set per event and change from event
  to event — typically **2–4 players per game**, with each game defining which
  line-ups it supports. Scoring stays deliberately simple: the host **tracks points
  manually** and they show as an **overlay** on top of the game (plain points,
  best-of-N rounds, etc.), rather than a fully automatic, integrated scoring engine.
  Each game decides how its overlay looks.
- **Portable JSON storage.** All user-generated content is plain JSON on disk —
  human-readable, diffable, `git commit`-able and `git push`-able. No SQLite, no
  database daemon. Because it's plain files, you can **bulk-edit content directly
  in the JSON** — no import tooling needed — as well as edit single items in the
  admin UI.
- **Bilingual UI (English / German).** The whole framework is internationalized;
  content can be authored per language.
- **Open-source friendly.** All user content lives in a single folder that is
  excluded from the public mirror, so the framework can be shared openly while
  your private questions and events stay private.

---

## Architecture

- **Single-page web app**: Vite + React + TypeScript, styled for
  large-screen/beamer legibility (dark stage theme).
- **Offline-first**: everything is bundled; the app never makes network calls at
  show time.
- **i18n** via `i18next` / `react-i18next`, full `en` and `de` locales.
- **Audio** via the Web Audio API. Songs are decoded once and cached; effect
  cues (buzzer, countdown ticks, reveal stinger, fanfare) are synthesized with
  oscillators, so the repo ships zero binary sound assets. Reversed playback
  (for Kisum) reverses the decoded sample buffers in memory — no reversed files
  on disk.
- **Two windows, one state.** The host window owns all state and all audio; the
  audience/beamer window (`#/audience`) is a passive, silent mirror fed via
  `BroadcastChannel`. Autoplay policies and audio-device routing therefore never
  bite mid-show.
- **Game plugin shape**: each game implements the `GameModule` contract in
  `src/lib/types.ts` — metadata, item factory/validator, an admin `Editor`, an
  optional `SettingsEditor`, a pure serializable `flow` state machine, and a
  `HostView` + `AudienceView`. Register it in `src/games/registry.ts` and the
  framework picks up admin, selection, and show integration automatically.

### Data persistence — the local, no-server constraint

The hard requirement is *no server and JSON files that can be committed*. Both
planned patterns are implemented behind one backend interface
(`src/lib/backend.ts`); the app picks automatically at startup:

1. **Bridge mode** (running via the local Vite process, dev or preview): a
   Vite plugin (`plugins/data-bridge.ts`) maps a small REST API onto plain
   JSON files under `data/` and serves the media files.
2. **Standalone mode** (no process at all — a release build double-clicked
   from `file://` or any static host): the app is one self-contained
   `index.html` (browsers refuse external ES modules on `file://`, hence the
   single-file build). On first launch you pick the `data/` folder once via
   the **File System Access API** and the browser reads/writes the very same
   JSON/media files directly. Chromium-only (Chrome/Edge); the folder choice
   is remembered, re-authorizing is one click. The audience window is fed via
   `postMessage` as well as BroadcastChannel, so host/audience sync also works
   from `file://`.

"No server" means no *remote/cloud* backend — either a local Vite process or
no process at all. Both write ordinary files you can inspect, bulk-edit and
`git commit`. The source of truth is **plain JSON on disk**.

---

## Data storage & portability

All user-generated data lives under a single top-level **`data/`** folder as
JSON:

```
data/
  events/
    <event-id>.json          # event: players + its games (line-up, settings,
                             # ordered backlog-item selection)
  games/
    <game-type>/             # ONE self-contained folder per game — copy it to
      backlog.json           # move a game (backlog + media) between data dirs
      media/                 # audio/images referenced by its items
```

Because it's just files:

- **Version it.** Commit and push `data/` to your private repo to back up and
  share content across machines.
- **Portable.** Copy the folder to another machine and the shows come with it.
- **No database.** Nothing to install, migrate, or keep running.

### Keeping content out of the open-source mirror

`data/` holds private content and must **not** appear in the public/open-source
mirror. It is marked `export-ignore` in `.gitattributes` (so `git archive`-based
exports drop it) and any mirror pipeline must exclude the `data/` folder. The
framework code contains **no** personal data — only `data/` does.

---

## Admin interface

The admin UI is where all content is authored, without touching JSON by hand:

- **Events**: create/rename/delete an event; add games to it; configure teams,
  order, and points; pick the backlog subset each game will play.
- **Games**: manage the backlog of questions/tasks per game type — add, edit,
  tag, reorder, duplicate, retire items.
- **Selection**: for each event game, choose exactly which backlog items are in
  play (and in what order).
- **Teams**: set up the teams/players for an event (scoring itself is per-game).
- **Media**: attach media — images, audio, and video — to items.

For large edits you can also edit the JSON files under `data/` directly, since
that is the source of truth.

Everything the admin does is written straight back to the JSON files in `data/`.

---

## Presenter controls

A show is driven like a PowerPoint presentation, so any standard **presenter
remote (clicker)** or the keyboard works out of the box — no mouse required:

| Key(s) | Action |
|---|---|
| → · Page Down · Space | Next step (advance the flow / reveal / next question) |
| ← · Page Up | Previous step (go back) |
| F5 | Start / enter the show in full-screen |
| B (or `.`) | Blank the screen to black; press again to resume |
| W (or `,`) | Blank the screen to white; press again to resume |
| Esc | Exit full-screen |

Physical presenter remotes typically emit Page Up / Page Down (and often F5, Esc,
and a blank key), so they map onto these same actions automatically.

Two things that matter specifically because this runs in a browser:

- **F5 must not reload the page.** In a browser F5 normally reloads the page and
  would restart the show; Showrunner intercepts it to mean "start / enter the
  show" instead.
- **Live state survives a reload.** Scores, the current position in the flow, and
  the active selection are persisted continuously, so an accidental (or real)
  refresh resumes the running show exactly where it left off — nothing is lost.

## Games

Each game is coded once and then reused. A game defines:

- **Flow** — the sequence of states (intro → question → buzz/answer → reveal →
  score → next), including timers and transitions.
- **Displays** — the on-screen views: the **audience/beamer view** (what the room
  sees), a **host view** (answers, notes, next up, score controls), and the
  **scoreboard**. Answers stay hidden on the audience view until revealed.
- **Scoring** — a **manual points overlay** the host updates during play (plain
  points, best-of-N rounds won, etc.), for its 2–4 players. Scoring is not
  automatic or deeply integrated; the game only defines how the overlay looks.
- **Sound** — cues for buzz-in, correct/incorrect, countdown, reveal, and
  round/end stingers.
- **Input** — the host drives everything from the keyboard/clicker. The buzzer is
  **analog and off-computer**: the host registers a buzz-in with a key (for now the
  same "next" key) and awards points to teams manually.

The framework provides shared building blocks (linear navigation, teams, a manual
score overlay, timers, audio, i18n) so a new game only implements what's unique to
it — including how its score overlay looks.

Navigation is deliberately **simple and linear**: advance with a single key (and
optionally one more to go back). Mapping the game's flow cleanly onto that one
(or two) key(s) is the game's own responsibility.

### Available games

Each game has its own document with the full flow, authoring guide, all
settings and hosting **tips & tricks**:

- **[Kisum](./docs/games/kisum.md)** (music in reverse) — players hear a song
  **played backwards** and buzz in when they recognize it. Authored with a
  waveform region editor; reversal happens on the fly in memory.
- **[Pixelgesicht](./docs/games/pixelgesicht.md)** (pixelated faces) — a
  portrait sharpens from an unreadable mosaic in a tuned ladder of stages;
  buzz in as soon as you recognize the face. Real fat pixels, computed live on
  a canvas — no pre-pixelated files.

Both share the same round mechanic: the host freezes the game on a buzz, an
**answer timer** runs, and a wrong answer **rewinds a little and resumes** so
the remaining players keep guessing. Points are awarded manually via the score
panel or keys `1`–`4`.

---

## Internationalization

The entire framework UI is available in **English and German**. Content
(questions/tasks) can be authored per language so a show can be run in either.
All display strings go through the i18n layer — no hard-coded language in the
framework.

---

## Repository layout

```
showrunner/
  README.md
  CHANGELOG.md               # release history (also used as release notes)
  LICENSE                    # MIT
  .gitignore
  .gitattributes             # excludes data/ from archive/mirror exports
  index.html
  vite.config.ts
  docs/
    games/
      kisum.md               # per-game guide: flow, authoring, settings, tips
      pixelgesicht.md
  plugins/
    data-bridge.ts           # local file bridge: REST API <-> data/ JSON + media
  src/
    lib/                     # types (GameModule contract), store, api, audio, live sync
    i18n/                    # i18next setup + en/de locales
    admin/                   # events, event-game config, backlog pages
    show/                    # show machine, host page, audience page, overlays
    games/
      registry.ts            # all coded games
      kisum/                 # first game: types, flow, editor (waveform), views
      pixelgesicht/          # pixelated-faces game: types, flow, editor, views
    components/              # shared UI (countdown ring, …)
  scripts/
    make-demo-songs.py       # generates synthesized, license-free demo WAVs
    make-demo-faces.py       # generates cartoon demo portraits (no real persons)
  .github/workflows/
    release.yml              # public release build: standalone zip + notes
  data/                      # ALL user-generated content (private; mirror-excluded)
```

---

## Getting started

**Standalone (no Node.js needed):** download the `showrunner-*-standalone.zip`
from the releases page, unzip, open `index.html` in **Chrome or Edge**
(double-click is fine) and pick your `data/` folder once — the bundled empty
`data/` skeleton is a good start; it fills up with your events, backlogs and
media as you author.

**From source:**

```bash
npm install
npm run dev        # http://localhost:5199 — author content and run shows
```

Or as an optimized production build:

```bash
npm run build      # emits a single self-contained dist/index.html
npm run show       # serve it via the local file bridge
```

**Demo media:** `scripts/make-demo-songs.py` and `scripts/make-demo-faces.py`
generate license-free demo assets (synthesized folk tunes, cartoon portraits —
no real persons) into `data/`, so you can try the authoring editors without
hunting for media first.

To reset a running show, use *Start over* in the host panel; live state lives in
the browser's localStorage, all content lives in `data/`.

See [CHANGELOG.md](./CHANGELOG.md) for what's new in each release.

---

## Contributing & open-source mirror

The framework is intended to be shared openly (MIT). The public repo **must**
exclude the `data/` folder so no private questions or events are published:
`data/` is `export-ignore`d in `.gitattributes`, and each release is published
as a **filtered snapshot** (one fresh commit per `v*` tag, produced via
`git archive`) rather than a raw history mirror. Keep all user content in
`data/`; keep the framework code free of personal data.

Releases carry a standalone zip with an **empty `data/` skeleton** plus release
notes from [CHANGELOG.md](./CHANGELOG.md)
(built by `.github/workflows/release.yml`).

Cutting a release (maintainers): add a `CHANGELOG.md` section, bump the version
in `package.json`, then run `scripts/release.sh` — it builds, tags `v<version>`
and publishes the (private, data-bundled) upstream release; pushing the tag
triggers the public snapshot and the GitHub release build.

## License

[MIT](./LICENSE) © 2026 Orthopoxvirus. Contact: m.haechler@exprimo.ch
