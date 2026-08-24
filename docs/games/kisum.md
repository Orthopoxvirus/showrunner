# Kisum — music in reverse

Players hear a clip of a song **played backwards** and buzz in (off-computer)
when they recognize it; naming the title scores the point. "Kisum" is "Musik"
in reverse — just like the game.

2–4 players. Media type: audio (anything your browser can decode — MP3, FLAC,
M4A, WAV, OGG).

---

## How a round works

One key forward (`→` / Page Down / Space), one key back (`←` / Page Up):

1. **Ready** — *next* starts the reversed clip.
2. **Reversed clip plays** — the audience sees an animated equalizer and a
   progress bar; no title, no artist. A player buzzes (analog, off-computer) →
   the host presses *next*: the music stops with a buzzer sound and the
   **answer timer** starts (default 5 s).
3. **Answer timer** —
   - *next* = correct → the **reveal**: title + artist appear on the beamer
     while the forward reveal clip plays;
   - *back* = wrong or no answer → the reversed clip **resumes where it
     stopped, rewound 2 s** (configurable), and the remaining players keep
     guessing.
4. **Reveal** — *next* moves on to the next song.

Points are awarded manually via the score panel or keys `1`–`4` (with `Shift`
to subtract). If the clip runs out without a buzz, nothing advances
automatically — the host decides: *Replay* it, or press *next* to open the
answer window anyway.

The host screen always shows the solution (title, artist, optional notes),
the current phase, the clip progress, and a *Replay* button. The audience
screen never shows the answer until the reveal.

## Authoring items

In the backlog editor you upload or pick an audio file, then mark two regions
on the **forward** waveform:

- **Task region** — played *in reverse* during the show. This is the mystery
  clip.
- **Reveal region** — a distinctive *forward* part used as the resolution
  (usually the chorus or the hook).

Both regions can be previewed exactly as they will sound in the show,
including the reversed task (`▶ Preview task (reversed)`). Click anywhere on
the waveform to set a listening cursor; `Space` plays/stops the last-touched
region or cursor. Regions snap to 0.1 s and must be at least 0.2 s long.

Reversal happens on the fly in memory — no reversed files are ever stored.

Handy: name your files `Artist - Title.mp3` and the editor pre-fills both
metadata fields on upload.

An item is playable once it has a file, a non-empty title, and valid task and
reveal regions. Optional per item: artist, host-only notes, difficulty
(easy/medium/hard), retired flag.

## Settings (per event game)

| Setting | Default | Range | What it does |
|---|---|---|---|
| Answer time | **5 s** | 1–60 | Countdown after a buzz |
| Rewind | **2 s** | 0–30 | How far the clip jumps back when guessing continues |
| Fade | **0.5 s** | 0–5 | Fade in/out at the edges of task and reveal clips |
| Tagline | "Musik rückwärts – wer erkennt den Song?" | — | Subtitle on the audience screen; empty hides it |
| Item label | `Song {{x}}` | — | Item counter (`{{x}}` = current, `{{y}}` = total); empty hides it |
| Intro animation | **on** | — | "Musik" → "Kisum" 3D flip on the game intro |
| Intro spin | **2 s** | 0.5–10 | Duration of that flip |

## Tips & tricks

**Picking songs**

- Pick songs **everyone in the room has a chance to know** — reversed audio is
  much harder than you think. Test the reversed preview yourself: if *you*
  can't get it after authoring it, nobody will.
- **Strong melodic hooks survive reversal best** (choruses, signature riffs,
  distinctive intros). Dense rap verses and spoken word become mush.
- Mix difficulties: open with one or two easy crowd-pleasers so players learn
  the mechanic, then ramp up. Use the difficulty field to plan the order.
- Songs with an **iconic single instrument** (piano intro, guitar riff) are
  great mid-difficulty picks — the timbre stays recognizable in reverse.

**Marking regions**

- Task region: 15–25 s of the most recognizable part is plenty. Longer clips
  don't make it easier, they just slow the show down — the rewind mechanic
  already gives extra listening time.
- Don't start the task region exactly at the hook — put the hook a few seconds
  *in*, so the first buzz usually lands just before it and the rewind replays
  the best part.
- Reveal region: use the chorus with the title in the lyrics if possible —
  the "aha" lands hardest when the room can sing along. 10–15 s is enough.
- Keep the default 0.5 s fade; it removes clicks at region edges without
  feeling like a fade-out.

**Running the show**

- Decide the buzz rule out loud before the first song: hands up, table slap,
  or a physical buzzer — the host presses *next* the moment someone buzzes.
- Wrong answer? Press *back* immediately — the clip resumes rewound and the
  tension stays up. The answer timer is short on purpose; don't let players
  negotiate.
- The *Replay* button restarts the clip from the beginning — good when a buzz
  turns out to be accidental or the room wants a second full listen.
- Keep the host window on your laptop and the audience window (`#/audience`)
  on the beamer; only the host window plays audio, so plug the beamer's HDMI
  audio out of the equation and use your own speakers.
