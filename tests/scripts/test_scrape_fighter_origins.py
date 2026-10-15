from scripts import scrape_fighter_origins as origins
from src.ufc_predictor.countries import country_code, translate_hometown

PAGE = """
<html><body><h1>Israel Adesanya</h1>
<div class="c-bio__field"><div class="c-bio__label">Cidade natal</div><div class="c-bio__text">Lagos, Nigéria</div></div>
</body></html>
"""


def test_country_code_understands_english_portuguese_and_espn_names():
    assert country_code("Brazil") == "br"
    assert country_code("Brasil") == "br"
    assert country_code("USA") == "us"
    assert country_code("Estados Unidos") == "us"
    assert country_code("Nigéria") == "ng"
    assert country_code("England") == "gb-eng"
    assert country_code("Atlantis") is None
    assert country_code(None) is None


def test_translate_hometown_puts_the_country_in_english():
    assert translate_hometown("Dublin, Irlanda") == ("Dublin, Ireland", "ie")
    assert translate_hometown("La Roche-sur-Yon, Vendée, França") == ("La Roche-sur-Yon, Vendée, France", "fr")
    assert translate_hometown("Brasil") == ("Brazil", "br")
    assert translate_hometown("Somewhere, Nowhere") == ("Somewhere, Nowhere", None)
    assert translate_hometown("") == (None, None)


def test_parse_ufc_page_reads_the_hometown():
    assert origins.parse_ufc_page(PAGE, "Israel Adesanya") == {"hometown": "Lagos, Nigéria"}


def test_parse_ufc_page_rejects_a_page_for_someone_else():
    assert origins.parse_ufc_page(PAGE, "Sean Strickland") is None


def test_merge_flags_the_country_the_fighter_represents_not_the_birthplace():
    # Tsarukyan: born in Georgia, fights for Armenia.
    tsarukyan = origins.merge("Arman Tsarukyan", "u1", {"citizenship": "Armenia"}, {"hometown": "Geórgia"})
    assert (tsarukyan["hometown"], tsarukyan["country"], tsarukyan["country_code"]) == ("Georgia", "Armenia", "am")
    # Topuria: born in Germany, fights for Georgia.
    topuria = origins.merge("Ilia Topuria", "u2", {"citizenship": "Georgia"}, {"hometown": "Alemanha"})
    assert (topuria["hometown"], topuria["country_code"]) == ("Germany", "ge")


def test_merge_falls_back_to_the_hometown_country_without_citizenship():
    result = origins.merge("Someone", "u3", {}, {"hometown": "Dublin, Irlanda"})
    assert (result["country"], result["country_code"], result["hometown"]) == ("Ireland", "ie", "Dublin, Ireland")
    assert "gym" not in result


def test_decode_page_falls_back_to_latin1():
    assert origins.decode_page("Nigéria".encode("latin-1")) == "Nigéria"
    assert origins.decode_page("Nigéria".encode("utf-8")) == "Nigéria"
