#!/usr/bin/env python3
"""Generate two public-domain demo "songs" (German folk tunes) as WAV files
under data/media/kisum/, so the Kisum demo content works out of the box
without shipping any copyrighted audio."""
import math
import struct
import wave
from pathlib import Path

RATE = 22050

NOTES = {
    'C4': 261.63, 'D4': 293.66, 'E4': 329.63, 'F4': 349.23, 'G4': 392.0,
    'A4': 440.0, 'B4': 493.88, 'C5': 523.25, 'R': 0.0,
    'C3': 130.81, 'F3': 174.61, 'G3': 196.0,
}

def synth(melody, bpm, out_path):
    beat = 60.0 / bpm
    samples = []
    for note, beats in melody:
        freq = NOTES[note]
        dur = beats * beat
        n = int(dur * RATE)
        for i in range(n):
            t = i / RATE
            if freq == 0.0:
                samples.append(0.0)
                continue
            # soft pluck: fundamental + light harmonics, exponential decay
            env = math.exp(-2.2 * t / dur) * min(1.0, i / (RATE * 0.008))
            v = (math.sin(2 * math.pi * freq * t)
                 + 0.35 * math.sin(2 * math.pi * 2 * freq * t)
                 + 0.12 * math.sin(2 * math.pi * 3 * freq * t))
            # simple bass an octave below on the beat
            bass_env = math.exp(-3.0 * (t % beat) / beat)
            v += 0.25 * bass_env * math.sin(2 * math.pi * (freq / 2) * t)
            samples.append(0.24 * env * v)
    # gentle fade-out
    fade = int(0.3 * RATE)
    for i in range(fade):
        samples[-fade + i] *= 1 - i / fade
    data = b''.join(struct.pack('<h', max(-32767, min(32767, int(s * 32767)))) for s in samples)
    with wave.open(str(out_path), 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(RATE)
        w.writeframes(data)
    return len(samples) / RATE

Q, H = 1.0, 2.0

entchen = [
    ('C4', Q), ('D4', Q), ('E4', Q), ('F4', Q), ('G4', H), ('G4', H),
    ('A4', Q), ('A4', Q), ('A4', Q), ('A4', Q), ('G4', H), ('R', Q),
    ('A4', Q), ('A4', Q), ('A4', Q), ('A4', Q), ('G4', H), ('R', Q),
    ('F4', Q), ('F4', Q), ('F4', Q), ('F4', Q), ('E4', H), ('E4', H),
    ('G4', Q), ('G4', Q), ('G4', Q), ('G4', Q), ('C4', H), ('R', H),
]

haenschen = [
    ('G4', Q), ('E4', Q), ('E4', H),
    ('F4', Q), ('D4', Q), ('D4', H),
    ('C4', Q), ('D4', Q), ('E4', Q), ('F4', Q), ('G4', Q), ('G4', Q), ('G4', H),
    ('G4', Q), ('E4', Q), ('E4', H),
    ('F4', Q), ('D4', Q), ('D4', H),
    ('C4', Q), ('E4', Q), ('G4', Q), ('G4', Q), ('C4', H), ('R', H),
]

out_dir = Path(__file__).resolve().parent.parent / 'data' / 'games' / 'kisum' / 'media'
out_dir.mkdir(parents=True, exist_ok=True)
for name, melody, bpm in [('alle-meine-entchen.wav', entchen, 108), ('haenschen-klein.wav', haenschen, 116)]:
    dur = synth(melody, bpm, out_dir / name)
    print(f'{name}: {dur:.2f}s')
