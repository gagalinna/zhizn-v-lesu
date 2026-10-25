"""Генерация графики для деплоя: favicon.svg / favicon.ico / apple-touch-icon / og-обложка.

Запуск (нужен Pillow):
    python tools/make-assets.py

Скрипт пересобирает:
    favicon.svg              — иконка вкладки (векторная, пиксельная сетка 16×16)
    favicon.ico              — та же иконка для старых браузеров (16/32/48)
    assets/icon-180.png      — иконка для «на главный экран» на iOS/Android
    assets/og-cover.jpg      — обложка 1200×630 для превью ссылки в соцсетях
"""

from __future__ import annotations

import io
import struct
import sys
from pathlib import Path

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "assets"
COVER_SRC = ROOT / "docs" / "обложка.png"

# ----- пиксельная иконка 16×16 ------------------------------------------------
# . прозрачный, d фон, g ёлка, G блик, t ствол, y алмазик

PALETTE = {
    "d": (16, 29, 22, 255),
    "g": (95, 191, 107, 255),
    "G": (143, 224, 154, 255),
    "t": (107, 74, 47, 255),
    "y": (255, 215, 94, 255),
}

ART = [
    "................",  # noqa: E501  y=0
    "............y...",  # noqa: E501  y=1
    ".......gg..yyy..",  # noqa: E501  y=2
    "......gggg.y.y..",  # noqa: E501  y=3
    ".....gggggg.....",  # noqa: E501  y=4
    "......gggg......",  # noqa: E501  y=5
    "....gggggggg....",  # noqa: E501  y=6
    "...gggggggggg...",  # noqa: E501  y=7
    ".....gggggg.....",  # noqa: E501  y=8
    "...gggggggggg...",  # noqa: E501  y=9
    "..gggggggggggg..",  # noqa: E501  y=10
    ".......tt.......",  # noqa: E501  y=11
    ".......tt.......",  # noqa: E501  y=12
    ".......tt.......",  # noqa: E501  y=13
    "................",  # noqa: E501  y=14
    "................",  # noqa: E501  y=15
]


def rounded_background() -> list[list[str]]:
    """Тёмный скруглённый квадрат под ёлкой."""
    grid = [["d"] * 16 for _ in range(16)]
    corners = [(0, 0), (1, 0), (0, 1), (15, 0), (14, 0), (15, 1), (0, 15), (1, 15), (0, 14), (15, 15), (14, 15), (15, 14)]
    for x, y in corners:
        grid[y][x] = "."
    return grid


def build_grid() -> list[list[str]]:
    grid = rounded_background()
    for y, row in enumerate(ART):
        for x, ch in enumerate(row):
            if ch != ".":
                grid[y][x] = ch
    return grid


GRID = build_grid()


def render_png(size: int, scale: int, pad: int) -> Image.Image:
    img = Image.new("RGBA", (size, size), (16, 29, 22, 255))
    for y in range(16):
        for x in range(16):
            ch = GRID[y][x]
            if ch == ".":
                continue
            color = PALETTE[ch]
            box = (
                pad + x * scale,
                pad + y * scale,
                pad + (x + 1) * scale,
                pad + (y + 1) * scale,
            )
            img.paste(color, box)
    return img


def save_ico(path: Path) -> None:
    """ICO с PNG-кадрами 16/32/48 — без сглаживания, пиксель в пиксель."""
    sizes = [(16, 1), (32, 2), (48, 3)]
    frames = []
    for size, scale in sizes:
        img = Image.new("RGBA", (16 * scale, 16 * scale), (0, 0, 0, 0))
        for y in range(16):
            for x in range(16):
                ch = GRID[y][x]
                if ch != ".":
                    img.paste(PALETTE[ch], (x * scale, y * scale, (x + 1) * scale, (y + 1) * scale))
        buf = io.BytesIO()
        img.save(buf, format="PNG", optimize=True)
        frames.append((size, buf.getvalue()))

    count = len(frames)
    header = struct.pack("<HHH", 0, 1, count)
    offset = 6 + 16 * count
    entries = b""
    for size, data in frames:
        entries += struct.pack(
            "<BBBBHHII",
            size if size < 256 else 0,
            size if size < 256 else 0,
            0,
            0,
            1,
            32,
            len(data),
            offset,
        )
        offset += len(data)
    path.write_bytes(header + entries + b"".join(data for _, data in frames))


def svg_runs() -> str:
    rects = []
    for y in range(16):
        x = 0
        while x < 16:
            ch = GRID[y][x]
            if ch == ".":
                x += 1
                continue
            start = x
            while x < 16 and GRID[y][x] == ch:
                x += 1
            r, g, b, _ = PALETTE[ch]
            color = "#%02x%02x%02x" % (r, g, b)
            rects.append(
                f'<rect x="{start}" y="{y}" width="{x - start}" height="1" fill="{color}"/>'
            )
    return "".join(rects)


def main() -> int:
    ASSETS.mkdir(exist_ok=True)

    if not COVER_SRC.exists():
        print(f"нет обложки: {COVER_SRC}", file=sys.stderr)
        return 1

    # favicon.svg
    svg = (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16" '
        'shape-rendering="crispEdges">'
        f"{svg_runs()}</svg>\n"
    )
    (ROOT / "favicon.svg").write_text(svg, encoding="utf-8")

    # favicon.ico
    save_ico(ROOT / "favicon.ico")

    # apple-touch-icon 180×180: 16 пикселей × 11 = 176 + поля по 2
    render_png(180, 11, 2).save(ASSETS / "icon-180.png", optimize=True)

    # обложка для og:image 1200×630 (срез по центру, важное не режется)
    cover = Image.open(COVER_SRC).convert("RGB")
    og = ImageOps.fit(cover, (1200, 630), method=Image.LANCZOS, centering=(0.5, 0.45))
    og.save(ASSETS / "og-cover.jpg", quality=88, optimize=True, progressive=True)

    for f in ["favicon.svg", "favicon.ico", "assets/icon-180.png", "assets/og-cover.jpg"]:
        p = ROOT / f
        print(f"{f:26} {p.stat().st_size / 1024:7.1f} КБ")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
