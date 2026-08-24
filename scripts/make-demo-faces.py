#!/usr/bin/env python3
"""Generate two cartoon demo faces as PNG files under
data/games/pixelgesicht/media/, so the Pixelgesicht demo content works out of
the box without shipping any photos of real people. Pure stdlib (zlib PNG
writer), no external dependencies."""
import struct
import zlib
from pathlib import Path

W = H = 512


def write_png(path: Path, w: int, h: int, pixel):
    """pixel(x, y) -> (r, g, b)"""
    raw = bytearray()
    for y in range(h):
        raw.append(0)  # filter: none
        for x in range(w):
            raw.extend(pixel(x, y))

    def chunk(tag: bytes, data: bytes) -> bytes:
        return (
            struct.pack('>I', len(data))
            + tag
            + data
            + struct.pack('>I', zlib.crc32(tag + data) & 0xFFFFFFFF)
        )

    png = (
        b'\x89PNG\r\n\x1a\n'
        + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 2, 0, 0, 0))
        + chunk(b'IDAT', zlib.compress(bytes(raw), 9))
        + chunk(b'IEND', b'')
    )
    path.write_bytes(png)
    print(f'wrote {path} ({len(png)} bytes)')


def in_ellipse(x, y, cx, cy, rx, ry):
    dx, dy = (x - cx) / rx, (y - cy) / ry
    return dx * dx + dy * dy <= 1.0


def pete(x, y):
    """Round face, short dark hair, glasses, cheerful grin."""
    # smile: lower band of an ellipse around the mouth
    if in_ellipse(x, y, 256, 330, 70, 42) and y > 338:
        if in_ellipse(x, y, 256, 322, 58, 30) and y > 338:
            return (168, 48, 52)  # open mouth
        return (245, 245, 245)  # teeth rim
    # glasses: two rings + bridge
    for ex in (196, 316):
        d = ((x - ex) ** 2 + (y - 228) ** 2) ** 0.5
        if 34 <= d <= 42:
            return (40, 44, 52)
        if d < 34:
            if ((x - ex + 10) ** 2 + (y - 220) ** 2) ** 0.5 < 9:
                return (30, 32, 38)  # pupil
            return (235, 240, 244)  # lens
    if 224 <= y <= 232 and 236 <= x <= 276:
        return (40, 44, 52)  # bridge
    # nose
    if in_ellipse(x, y, 256, 280, 14, 20):
        return (222, 158, 116)
    # hair: cap above the forehead
    if in_ellipse(x, y, 256, 262, 152, 182) and y < 178:
        return (58, 42, 32)
    # head
    if in_ellipse(x, y, 256, 262, 152, 182):
        return (238, 180, 138)
    # shoulders
    if y > 452 and in_ellipse(x, y, 256, 560, 210, 130):
        return (52, 96, 146)
    return (94, 156, 216)  # background


def mona(x, y):
    """Oval face, long auburn hair, lipstick smile."""
    face = in_ellipse(x, y, 256, 268, 132, 172)
    # hair: big oval behind the face plus strands down the sides
    hair = (
        in_ellipse(x, y, 256, 240, 170, 200)
        or (150 <= y <= 470 and (in_ellipse(x, y, 116, 350, 54, 160) or in_ellipse(x, y, 396, 350, 54, 160)))
    )
    if hair and not (face and y > 168):
        return (108, 62, 40)
    if face:
        # eyes
        for ex in (204, 308):
            if in_ellipse(x, y, ex, 240, 26, 16):
                if ((x - ex + 6) ** 2 + (y - 238) ** 2) ** 0.5 < 8:
                    return (46, 60, 44)  # green pupil
                return (240, 244, 246)
            if in_ellipse(x, y, ex, 218, 30, 5):
                return (84, 50, 34)  # brow
        # nose
        if in_ellipse(x, y, 256, 288, 10, 18):
            return (218, 156, 122)
        # lipstick smile
        if in_ellipse(x, y, 256, 344, 52, 26) and y > 344:
            return (178, 44, 74)
        # blush
        for bx in (176, 336):
            if in_ellipse(x, y, bx, 300, 24, 14):
                return (240, 168, 142)
        return (240, 190, 152)
    # shoulders / dress
    if y > 452 and in_ellipse(x, y, 256, 566, 200, 130):
        return (120, 56, 96)
    return (206, 178, 128)  # background


def main():
    out = Path(__file__).resolve().parent.parent / 'data' / 'games' / 'pixelgesicht' / 'media'
    out.mkdir(parents=True, exist_ok=True)
    write_png(out / 'pixel-pete.png', W, H, pete)
    write_png(out / 'mona-mosaik.png', W, H, mona)


if __name__ == '__main__':
    main()
