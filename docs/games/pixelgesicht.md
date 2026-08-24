# Pixelgesicht — pixelated faces

A portrait starts as an unreadable mosaic and gains resolution stage by stage
until it flips to the original. Players buzz in (off-computer) as soon as they
recognize the face; naming the person scores the point.

1–4 players. Media type: images (JPEG, PNG, WebP — anything the browser
renders).

---

## How a round works

One key forward (`→` / Page Down / Space), one key back (`←` / Page Up):

1. **Ready** — *next* starts the reveal.
2. **Image sharpens** — the mosaic climbs a ladder of stages (default: 8
   blocks wide up to 157 in 12 stages over 18 s), then flips to the original.
   A player buzzes → the host presses *next*: the image **freezes** at its
   current resolution (buzzer sound) and the **answer timer** starts.
3. **Answer timer** —
   - *next* = correct → the **reveal**: original image + name (+ optional info
     line) on the beamer;
   - *back* = wrong or no answer → the de-pixelation **resumes, rewound 2 s**
     (configurable — the image gets a bit blockier again), and the remaining
     players keep guessing.
4. **Reveal** — *next* moves on to the next image.

Points are awarded manually via the score panel or keys `1`–`4` (with `Shift`
to subtract). If the reveal runs to the end without a buzz, the original is
showing — press *next* to open the answer window for a free-for-all, or move
on.

The host screen always shows the solution (name, info, notes, and a thumbnail
of the original), the current phase, and a *Restart reveal* button. The
audience screen never shows the answer until the reveal.

The mosaic is computed live on a canvas with hard nearest-neighbor edges —
real fat pixels, no blur — from the single original image; no pre-pixelated
files are stored.

## Authoring items

In the backlog editor you upload or pick an image, enter the **person's name**
(the answer) and an optional **info line** for the reveal (role, band, "known
from …"). A play button and a slider preview the entire de-pixelation
timeline, so you can check at which stage a face becomes guessable.

Optional per item: gender tag (♂/♀), a free-text **category** (suggestions:
Sport, Schauspieler, Politiker, Comicfiguren, Musik, TV — plus anything you
have used before), host-only notes, difficulty, retired flag. Gender and
category become filter tags in the backlog list, which makes assembling a
balanced selection much faster.

Filenames pre-fill the name field (`roger_federer.jpg` → "roger federer"), so
name your files after the person and just fix the capitalization.

An item is playable once it has an image and a non-empty name.

## Settings (per event game)

| Setting | Default | Range | What it does |
|---|---|---|---|
| Reveal duration | **18 s** | 3–180 | Total time from first mosaic to original |
| Start resolution | **8 blocks** | 2–64 | Mosaic width at the start |
| End resolution | **157 blocks** | 16–800 | Last stage before the flip to the original |
| Stages | **12** | 2–60 | Number of mosaic steps between start and end |
| Answer time | **5 s** | 1–60 | Countdown after a buzz |
| Rewind | **2 s** | 0–30 | How far the reveal jumps back when guessing continues |
| Tagline | "Wer erkennt das Gesicht?" | — | Subtitle on the audience screen; empty hides it |
| Item label | `Bild {{x}}` | — | Item counter (`{{x}}` = current, `{{y}}` = total); empty hides it |
| Intro animation | **on** | — | De-pixelates the game title on the intro screen |
| Intro duration | **2.5 s** | 0.5–10 | Duration of that title animation |

The stage ladder is not linear: it starts with fine +1 steps (8 → 9 → 10 → 11)
where every block counts, then ramps geometrically (15, 21, 29, 41, 57, 79)
and finishes fast (111 → 157). Early stages are where the guessing happens;
the finale just confirms.

## Tips & tricks

**Picking images**

- **Tight head shots work best.** The mosaic averages colors per block — on a
  wide shot the face is only a few blocks at stage one and stays anonymous too
  long, then snaps to obvious. Crop before uploading.
- Distinctive silhouettes, hair, glasses or trademark colors get recognized
  at very low resolutions — treat those as your easy items and save clean,
  generic portraits for the hard end.
- Prefer well-lit, front-facing photos with a calm background. A busy
  background steals blocks from the face.
- The preview slider is your difficulty meter: scrub to ~1/3 of the timeline —
  if you can already tell who it is, it's an easy item.
- Non-person images (logos, buildings, album covers) work too — leave the
  gender tag unset and give them their own category.

**Tuning settings**

- The defaults (18 s, 12 stages) fit a chatty living-room round. For a faster
  pub-quiz pace drop to ~12 s; for very large groups raise the answer time
  rather than the reveal time.
- Raise the start resolution to 10–12 for a *harder* game? Other way around:
  a higher start resolution makes it **easier** (more detail from the start).
  For a harder game, lower the start resolution and add stages.
- Keep the rewind at 2 s — it un-sharpens just enough to punish a wild guess
  without resetting the round.

**Running the show**

- Freeze early, freeze often: press *next* the instant someone buzzes — the
  frozen mosaic is the whole tension of the game. Late freezes give the rest
  of the room free viewing time.
- On a wrong answer, press *back* straight away so the reveal keeps rolling;
  the other players' clock is the de-pixelation itself.
- Use categories to structure the round ("next block: Sport") — the audience
  guesses along and the selection stays balanced.
- The info line makes reveals land for the half of the room that *doesn't*
  know the person — always fill it for niche picks.
