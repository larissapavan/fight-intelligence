import io

from PIL import Image

from scripts import download_fighter_photos as photos

RANKINGS_HTML = """
<div class="view-grouping">
  <div class="view-grouping-header">Peso-mosca feminino</div>
  <div class="rankings--athlete--champion">
    <img src="https://ufc.com/images/styles/x/SILVA_NATALIA_BELT.png?itok=abc" width="208">
    <h5><a href="/athlete/natalia-silva">Natalia Silva</a></h5>
  </div>
</div>
<div class="view-grouping">
  <div class="view-grouping-header">Peso-pena feminino</div>
</div>
<div class="view-grouping">
  <div class="view-grouping-header">Women's Pound-for-PoundTop Rank</div>
  <div class="rankings--athlete--champion"><img src="https://ufc.com/p4p.png"><h5><a>Someone</a></h5></div>
</div>
"""


def png_bytes(size=(600, 436)):
    image = Image.new("RGBA", size, (255, 0, 0, 0))
    image.putpixel((10, 10), (255, 0, 0, 255))
    out = io.BytesIO()
    image.save(out, format="PNG")
    return out.getvalue()


def test_parse_champions_reads_division_champion_cards_and_skips_p4p_and_empty_divisions():
    assert photos.parse_champions(RANKINGS_HTML) == [
        ("Women's Flyweight", "Natalia Silva", "https://ufc.com/images/styles/x/SILVA_NATALIA_BELT.png?itok=abc")
    ]


def test_to_webp_shrinks_keeps_alpha_and_outputs_webp():
    encoded = photos.to_webp(png_bytes(), max_width=300)
    image = Image.open(io.BytesIO(encoded))
    assert image.format == "WEBP" and image.width == 300 and image.height == round(436 * 300 / 600)
    assert "A" in image.convert("RGBA").getbands()
    assert len(encoded) < len(png_bytes())


def test_to_webp_max_side_limits_the_longest_edge():
    image = Image.open(io.BytesIO(photos.to_webp(png_bytes((800, 1000)), max_side=420)))
    assert max(image.size) == 420


def test_slugify_is_ascii_and_stable():
    assert photos.slugify("Jiří Procházka") == "jiri-prochazka"
    assert photos.slugify("Sean King III") == "sean-king-iii"

