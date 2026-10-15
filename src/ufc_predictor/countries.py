"""Country names (English, Portuguese and the variants ESPN and ufc.com use) mapped to flag codes.

The codes follow ISO 3166-1 alpha-2, in lowercase, plus the three UK nations (gb-eng, gb-sct, gb-wls, gb-nir) that
flag CDNs and flag icon sets support. ufc.com serves its athlete pages in Portuguese, so the hometown text is
translated back to English with the same table.
"""

from __future__ import annotations

import re
import unicodedata

# code: (English name, Portuguese name, extra aliases)
_COUNTRIES: dict[str, tuple[str, str, tuple[str, ...]]] = {
    "us": ("United States", "Estados Unidos", ("USA", "United States of America", "EUA", "U.S.", "US")),
    "br": ("Brazil", "Brasil", ()),
    "ru": ("Russia", "Rússia", ("Russian Federation",)),
    "ca": ("Canada", "Canadá", ()),
    "gb-eng": ("England", "Inglaterra", ()),
    "gb-sct": ("Scotland", "Escócia", ()),
    "gb-wls": ("Wales", "País de Gales", ("Gales",)),
    "gb-nir": ("Northern Ireland", "Irlanda do Norte", ()),
    "gb": ("United Kingdom", "Reino Unido", ("UK", "Great Britain", "Grã-Bretanha")),
    "ie": ("Ireland", "Irlanda", ("Republic of Ireland",)),
    "au": ("Australia", "Austrália", ()),
    "nz": ("New Zealand", "Nova Zelândia", ()),
    "mx": ("Mexico", "México", ()),
    "pl": ("Poland", "Polônia", ()),
    "cn": ("China", "China", ("People's Republic of China", "PR China")),
    "jp": ("Japan", "Japão", ()),
    "kr": ("South Korea", "Coreia do Sul", ("Korea", "Republic of Korea")),
    "kp": ("North Korea", "Coreia do Norte", ()),
    "ge": ("Georgia", "Geórgia", ()),
    "kz": ("Kazakhstan", "Cazaquistão", ()),
    "kg": ("Kyrgyzstan", "Quirguistão", ()),
    "uz": ("Uzbekistan", "Uzbequistão", ()),
    "tj": ("Tajikistan", "Tajiquistão", ("Tadjiquistão",)),
    "tm": ("Turkmenistan", "Turcomenistão", ()),
    "am": ("Armenia", "Armênia", ()),
    "az": ("Azerbaijan", "Azerbaijão", ()),
    "ua": ("Ukraine", "Ucrânia", ()),
    "by": ("Belarus", "Bielorrússia", ()),
    "md": ("Moldova", "Moldávia", ()),
    "lt": ("Lithuania", "Lituânia", ()),
    "lv": ("Latvia", "Letônia", ()),
    "ee": ("Estonia", "Estônia", ()),
    "se": ("Sweden", "Suécia", ()),
    "no": ("Norway", "Noruega", ()),
    "dk": ("Denmark", "Dinamarca", ()),
    "fi": ("Finland", "Finlândia", ()),
    "is": ("Iceland", "Islândia", ()),
    "nl": ("Netherlands", "Países Baixos", ("Holland", "Holanda", "The Netherlands")),
    "be": ("Belgium", "Bélgica", ()),
    "fr": ("France", "França", ()),
    "de": ("Germany", "Alemanha", ()),
    "es": ("Spain", "Espanha", ("Canary Islands", "Ilhas Canárias")),
    "pt": ("Portugal", "Portugal", ()),
    "it": ("Italy", "Itália", ()),
    "ch": ("Switzerland", "Suíça", ()),
    "at": ("Austria", "Áustria", ()),
    "cz": ("Czech Republic", "República Tcheca", ("Czechia", "Tchéquia")),
    "sk": ("Slovakia", "Eslováquia", ()),
    "hu": ("Hungary", "Hungria", ()),
    "ro": ("Romania", "Romênia", ()),
    "bg": ("Bulgaria", "Bulgária", ()),
    "rs": ("Serbia", "Sérvia", ()),
    "hr": ("Croatia", "Croácia", ()),
    "ba": ("Bosnia and Herzegovina", "Bósnia e Herzegovina", ("Bosnia", "Bósnia", "Bosnia & Herzegovina")),
    "me": ("Montenegro", "Montenegro", ()),
    "al": ("Albania", "Albânia", ()),
    "mk": ("North Macedonia", "Macedônia do Norte", ("Macedonia", "Macedônia")),
    "xk": ("Kosovo", "Kosovo", ()),
    "si": ("Slovenia", "Eslovênia", ()),
    "gr": ("Greece", "Grécia", ()),
    "cy": ("Cyprus", "Chipre", ()),
    "tr": ("Turkey", "Turquia", ("Türkiye",)),
    "ir": ("Iran", "Irã", ()),
    "iq": ("Iraq", "Iraque", ()),
    "il": ("Israel", "Israel", ()),
    "lb": ("Lebanon", "Líbano", ()),
    "jo": ("Jordan", "Jordânia", ()),
    "sa": ("Saudi Arabia", "Arábia Saudita", ()),
    "ae": ("United Arab Emirates", "Emirados Árabes Unidos", ("UAE",)),
    "eg": ("Egypt", "Egito", ()),
    "ma": ("Morocco", "Marrocos", ()),
    "dz": ("Algeria", "Argélia", ()),
    "tn": ("Tunisia", "Tunísia", ()),
    "ng": ("Nigeria", "Nigéria", ()),
    "cm": ("Cameroon", "Camarões", ()),
    "gh": ("Ghana", "Gana", ()),
    "za": ("South Africa", "África do Sul", ()),
    "ao": ("Angola", "Angola", ()),
    "na": ("Namibia", "Namíbia", ()),
    "ke": ("Kenya", "Quênia", ()),
    "tz": ("Tanzania", "Tanzânia", ()),
    "ug": ("Uganda", "Uganda", ()),
    "zw": ("Zimbabwe", "Zimbábue", ()),
    "sn": ("Senegal", "Senegal", ()),
    "ci": ("Ivory Coast", "Costa do Marfim", ("Côte d'Ivoire", "Cote d'Ivoire")),
    "cd": ("DR Congo", "República Democrática do Congo", ("Congo", "Democratic Republic of the Congo", "Democratic Republic of Congo")),
    "ar": ("Argentina", "Argentina", ()),
    "cl": ("Chile", "Chile", ()),
    "co": ("Colombia", "Colômbia", ()),
    "pe": ("Peru", "Peru", ()),
    "ec": ("Ecuador", "Equador", ()),
    "ve": ("Venezuela", "Venezuela", ()),
    "bo": ("Bolivia", "Bolívia", ()),
    "py": ("Paraguay", "Paraguai", ()),
    "uy": ("Uruguay", "Uruguai", ()),
    "cu": ("Cuba", "Cuba", ()),
    "do": ("Dominican Republic", "República Dominicana", ()),
    "pr": ("Puerto Rico", "Porto Rico", ()),
    "jm": ("Jamaica", "Jamaica", ()),
    "tt": ("Trinidad and Tobago", "Trinidad e Tobago", ("Trinidad",)),
    "ht": ("Haiti", "Haiti", ()),
    "pa": ("Panama", "Panamá", ()),
    "cr": ("Costa Rica", "Costa Rica", ()),
    "gt": ("Guatemala", "Guatemala", ()),
    "hn": ("Honduras", "Honduras", ()),
    "sv": ("El Salvador", "El Salvador", ()),
    "ni": ("Nicaragua", "Nicarágua", ()),
    "ph": ("Philippines", "Filipinas", ()),
    "id": ("Indonesia", "Indonésia", ()),
    "th": ("Thailand", "Tailândia", ()),
    "vn": ("Vietnam", "Vietnã", ()),
    "my": ("Malaysia", "Malásia", ()),
    "sg": ("Singapore", "Singapura", ()),
    "mn": ("Mongolia", "Mongólia", ()),
    "in": ("India", "Índia", ()),
    "pk": ("Pakistan", "Paquistão", ()),
    "af": ("Afghanistan", "Afeganistão", ()),
    "tw": ("Taiwan", "Taiwan", ()),
    "hk": ("Hong Kong", "Hong Kong", ()),
    "fj": ("Fiji", "Fiji", ()),
    "ws": ("Samoa", "Samoa", ()),
    "as": ("American Samoa", "Samoa Americana", ()),
    "to": ("Tonga", "Tonga", ()),
    "gu": ("Guam", "Guam", ()),
    "bs": ("Bahamas", "Bahamas", ()),
    "bh": ("Bahrain", "Bahrein", ()),
    "bb": ("Barbados", "Barbados", ()),
    "kh": ("Cambodia", "Camboja", ()),
    "cv": ("Cape Verde", "Cabo Verde", ()),
    "gd": ("Grenada", "Granada", ()),
    "gw": ("Guinea-Bissau", "Guiné-Bissau", ()),
    "ms": ("Montserrat", "Montserrat", ()),
    "ps": ("Palestine", "Palestina", ()),
    "sy": ("Syria", "Síria", ()),
    "gn": ("Guinea", "Guiné", ()),
    "sb": ("Solomon Islands", "Ilhas Salomão", ()),
    "gy": ("Guyana", "Guiana", ()),
    "aw": ("Aruba", "Aruba", ()),
    "sr": ("Suriname", "Suriname", ()),
    "mm": ("Myanmar", "Mianmar", ("Burma",)),
    "vi": ("U.S. Virgin Islands", "Ilhas Virgens Americanas", ("Virgin Islands",)),
}

# Republics inside Russia that ufc.com lists in place of the country ("Dagestan, Rússia" has the country already,
# but a bare "Chechnya" or "Dagestan" shows up too).
_RUSSIAN_REGIONS = {"dagestan", "chechnya", "ingushetia", "ossetia", "north ossetia", "tatarstan", "buryatia", "yakutia"}


def _key(value: str) -> str:
    text = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii")
    return re.sub(r"[^a-z0-9]+", " ", text.lower()).strip()


_BY_KEY: dict[str, str] = {}
for _code, (_en, _pt, _aliases) in _COUNTRIES.items():
    for _name in (_en, _pt, *_aliases):
        _BY_KEY.setdefault(_key(_name), _code)


def country_code(name: str | None) -> str | None:
    """Flag code for an English or Portuguese country name, or None when it is not recognised."""
    if not name:
        return None
    key = _key(name)
    if key in _BY_KEY:
        return _BY_KEY[key]
    if key in _RUSSIAN_REGIONS:
        return "ru"
    return None


def english_name(code: str | None) -> str | None:
    return _COUNTRIES[code][0] if code in _COUNTRIES else None


def translate_hometown(text: str | None) -> tuple[str | None, str | None]:
    """Translate the country at the end of a ufc.com hometown ("Dublin, Irlanda") into English.

    Returns (hometown text in English, country flag code). The code is None when no known country ends the text.
    """
    if not text or not text.strip():
        return None, None
    parts = [part.strip() for part in text.replace("&amp;", "&").split(",") if part.strip()]
    if not parts:
        return None, None
    code = country_code(parts[-1])
    if code is not None:
        parts[-1] = english_name(code) or parts[-1]
    return ", ".join(parts), code
