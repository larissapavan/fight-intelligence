"""Render the Fight Intelligence brand mark to frontend/public/favicon.png and og-image.jpg.

Geometry mirrors frontend/src/shared/components/BrandMark.tsx and public/favicon.svg (40x40 viewBox). Needs Pillow only.
Usage: python scripts/generate_brand_assets.py
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

PUBLIC = Path(__file__).resolve().parents[1] / "frontend" / "public"
RED, INK, CREAM, BG = "#C8102E", "#0E0E0E", "#F6F1E4", "#050506"
SS = 8  # supersampling factor

# 40x40 viewBox, mirrored in frontend/src/shared/components/BrandMark.tsx: an ink octagon with a red hard shadow and an italic FI monogram.
OCTAGON = [(11.54, 1), (26.46, 1), (37, 11.54), (37, 26.46), (26.46, 37), (11.54, 37), (1, 26.46), (1, 11.54)]
LETTER_F = [(8.5, 29), (12.1, 11), (25.1, 11), (24.26, 15.2), (15.86, 15.2), (15.28, 18.1), (22.08, 18.1), (21.28, 22.1), (14.48, 22.1), (13.1, 29)]
LETTER_I = [(26.9, 11), (31.5, 11), (27.9, 29), (23.3, 29)]


def draw_mark(size: int, tile: bool = False) -> Image.Image:
    big = size * SS
    k = big / 40
    img = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    def poly(points, fill, dx=0.0, dy=0.0):
        d.polygon([((x + dx) * k, (y + dy) * k) for x, y in points], fill=fill)

    if tile:
        d.rectangle([0, 0, big - 1, big - 1], fill=CREAM)
    poly(OCTAGON, RED, 2, 2)  # hard offset shadow
    poly(OCTAGON, INK)
    poly(LETTER_F, CREAM)
    poly(LETTER_I, RED)
    return img.resize((size, size), Image.LANCZOS)


def font(name: str, size: int) -> ImageFont.FreeTypeFont:
    for candidate in (name, "arialbd.ttf", "DejaVuSans-Bold.ttf"):
        try:
            return ImageFont.truetype(candidate, size)
        except OSError:
            continue
    return ImageFont.load_default()


def slanted_text(img: Image.Image, xy: tuple[int, int], text: str, fnt: ImageFont.FreeTypeFont, fill: str, slant: float = 0.2) -> None:
    """Draw bold text with a black outline and drop shadow, sheared to look italic."""
    pad = 40
    bbox = fnt.getbbox(text)
    w, h = bbox[2] + pad * 2, bbox[3] + pad * 2
    layer = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    ld = ImageDraw.Draw(layer)
    for dx, dy in ((6, 6), (5, 5), (4, 4)):
        ld.text((pad + dx, pad + dy), text, font=fnt, fill="#000000", stroke_width=3, stroke_fill="#000000")
    ld.text((pad, pad), text, font=fnt, fill=fill, stroke_width=3, stroke_fill="#000000")
    layer = layer.transform((w + int(h * slant), h), Image.AFFINE, (1, slant, -h * slant, 0, 1, 0), Image.BICUBIC)
    img.paste(layer, (xy[0] - pad, xy[1] - pad), layer)


def make_og(width: int = 1200, height: int = 630) -> Image.Image:
    # Bright red-to-black diagonal gradient so the card does not read as a black block in chat previews.
    img = Image.new("RGB", (width, height), BG)
    px = img.load()
    for y in range(height):
        for x in range(width):
            t = min(1.0, max(0.0, (x * 0.8 + y * 0.6) / (width * 0.8 + height * 0.6)))
            px[x, y] = (int(200 - 175 * t), int(25 - 20 * t), int(32 - 26 * t))
    d = ImageDraw.Draw(img)
    d.rectangle([0, height - 14, width, height], fill="#0B0B0D")

    mark = draw_mark(260)
    img.paste(mark, (70, (height - 260) // 2 - 10), mark)

    x = 380
    slanted_text(img, (x, 130), "FIGHT", font("impact.ttf", 150), "#FFFFFF")
    slanted_text(img, (x, 275), "INTELLIGENCE", font("impact.ttf", 120), "#FFFFFF")
    d = ImageDraw.Draw(img)
    d.text((x + 6, 450), "UFC FIGHT PREDICTIONS, EXPLAINED", font=font("impact.ttf", 40), fill="#FFFFFF")
    return img


def make_cover(width: int = 1200, height: int = 627) -> Image.Image:
    """LinkedIn project cover (1200x627): the FI mark alone, centred on white."""
    img = Image.new("RGB", (width, height), "#FFFFFF")
    size = 440
    mark = draw_mark(size)
    # The mark's drawing spans 1..39 of its 40-unit box (shadow included), so centre on that, not on the box.
    offset = size / 40
    img.paste(mark, (round((width - size) / 2 - 0 * offset), round((height - size) / 2)), mark)
    return img


def main() -> None:
    draw_mark(256).save(PUBLIC / "favicon.png")
    make_og().save(PUBLIC / "og-image.jpg", quality=92)
    brand_dir = PUBLIC.parents[1] / "docs" / "brand"
    brand_dir.mkdir(parents=True, exist_ok=True)
    make_cover().save(brand_dir / "linkedin-cover.png")
    print("wrote favicon.png (256x256), og-image.jpg (1200x630) and docs/brand/linkedin-cover.png (1200x627)")


if __name__ == "__main__":
    main()
