"""Render the Fight Intelligence brand mark to frontend/public/favicon.png and og-image.jpg.

Geometry mirrors frontend/src/shared/components/BrandMark.tsx (40x40 viewBox). Needs Pillow only.
Usage: python scripts/generate_brand_assets.py
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

PUBLIC = Path(__file__).resolve().parents[1] / "frontend" / "public"
RED, GRAPHITE, INNER, TILE, BG = "#E50914", "#4A4A52", "#2E2E34", "#0B0B0D", "#050506"
SS = 8  # supersampling factor

OUTER = [(14.26, 6.14), (25.74, 6.14), (33.86, 14.26), (33.86, 25.74), (25.74, 33.86), (14.26, 33.86), (6.14, 25.74), (6.14, 14.26)]
INNER_OCT = [(16.1, 10.58), (23.9, 10.58), (29.42, 16.1), (29.42, 23.9), (23.9, 29.42), (16.1, 29.42), (10.58, 23.9), (10.58, 16.1)]
CROSS = [((11.5, 20), (16.4, 20)), ((23.6, 20), (28.5, 20)), ((20, 11.5), (20, 16.4)), ((20, 23.6), (20, 28.5))]
CORNERS = [((6.14, 14.26), (14.26, 6.14)), ((33.86, 25.74), (25.74, 33.86))]


def draw_mark(size: int, tile: bool = True) -> Image.Image:
    big = size * SS
    k = big / 40
    img = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    def p(pt):
        return (pt[0] * k, pt[1] * k)

    def line(a, b, color, w):
        d.line([p(a), p(b)], fill=color, width=max(1, round(w * k)))
        r = w * k / 2
        for x, y in (p(a), p(b)):
            d.ellipse([x - r, y - r, x + r, y + r], fill=color)

    def loop(points, color, w):
        for a, b in zip(points, points[1:] + points[:1]):
            line(a, b, color, w)

    if tile:
        d.rounded_rectangle([0, 0, big - 1, big - 1], radius=9.5 * k, fill=TILE)
    loop(OUTER, GRAPHITE, 1.2)
    for a, b in CORNERS:
        line(a, b, RED, 1.5)
    loop(INNER_OCT, INNER, 0.9)
    for a, b in CROSS:
        line(a, b, RED, 1.1)
    cx, cy = p((20, 20))
    for r, w in ((2.7, 1.1),):
        d.ellipse([cx - r * k, cy - r * k, cx + r * k, cy + r * k], outline=RED, width=round(w * k))
    r = 0.9 * k
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=RED)
    return img.resize((size, size), Image.LANCZOS)


def font(name: str, size: int) -> ImageFont.FreeTypeFont:
    for candidate in (name, "arialbd.ttf", "DejaVuSans-Bold.ttf"):
        try:
            return ImageFont.truetype(candidate, size)
        except OSError:
            continue
    return ImageFont.load_default()


def make_og(width: int = 1200, height: int = 630) -> Image.Image:
    img = Image.new("RGB", (width, height), BG)
    d = ImageDraw.Draw(img)
    # faint HUD grid + red edge accent
    for x in range(0, width, 60):
        d.line([(x, 0), (x, height)], fill="#0E0E11")
    for y in range(0, height, 60):
        d.line([(0, y), (width, y)], fill="#0E0E11")
    d.rectangle([0, 0, 10, height], fill=RED)

    mark = draw_mark(300)
    img.paste(mark, (110, (height - 300) // 2), mark)

    x = 470
    d.text((x, 205), "MATCHUP ANALYTICS", font=font("bahnschrift.ttf", 30), fill=RED)
    d.text((x, 262), "FIGHT", font=font("bahnschrift.ttf", 100), fill="#FFFFFF")
    d.text((x, 365), "INTELLIGENCE", font=font("bahnschrift.ttf", 100), fill=RED)
    d.text((x, 520), "ML fight predictions - independent fan project", font=font("bahnschrift.ttf", 30), fill="#9A9AA2")
    return img


def main() -> None:
    draw_mark(256).save(PUBLIC / "favicon.png")
    make_og().save(PUBLIC / "og-image.jpg", quality=90)
    print("wrote favicon.png (256x256) and og-image.jpg (1200x630)")


if __name__ == "__main__":
    main()
