"""The PFL scraper's parsers, run against small pages that copy the structure of the real ones."""

from __future__ import annotations

import json
from datetime import date

import pytest

from scripts import scrape_pfl as pfl


def event_page(*, name="PFL Test", json_date="2026-04-12T21:00:00-04:00", header="SAT APR 11", fights=(), location="Test Arena, Chicago, IL"):
    """An event page: the JSON-LD block the scraper reads and the header text with the real local date."""
    sub_events = [
        {
            "@type": "SportsEvent",
            "@id": f"https://pflmma.com/event/pfl-test#fight-{index}",
            "name": f"{a} vs {b}",
            "description": description,
            "competitor": [
                {"@type": "Person", "name": a, "url": f"https://pflmma.com/{family}/{a.lower().replace(' ', '-')}"},
                {"@type": "Person", "name": b, "url": f"https://pflmma.com/{family}/{b.lower().replace(' ', '-')}"},
            ],
        }
        for index, (a, b, description, family) in enumerate(fights)
    ]
    data = {
        "@context": "https://schema.org",
        "@graph": [
            {"@type": "Organization", "name": "Professional Fighters League", "url": "https://pflmma.com/"},
            {
                "@type": "SportsEvent",
                "@id": "https://pflmma.com/event/pfl-test#event",
                "name": name,
                "startDate": json_date,
                "location": {"@type": "Place", "name": location},
                "url": "https://pflmma.com/event/pfl-test",
                "subEvent": sub_events,
            },
        ],
    }
    return f"""<html><head><script type="application/ld+json">{json.dumps(data)}</script></head>
    <body><nav>Events</nav><div>EVENT INFO</div><div>{header}</div><div>Main Card</div></body></html>"""


def test_event_uses_the_date_printed_on_the_page_not_the_json_ld_one():
    # The JSON-LD says the 8th (one day late, like the old events); the header says Thursday June 7, 2018.
    html = event_page(json_date="2018-06-08T00:00:00-04:00", header="Thursday Jun 7, 2018")
    event = pfl.parse_event_page(html, "https://pflmma.com/event/2018-pfl-1")
    assert event["date"] == date(2018, 6, 7)


def test_a_header_without_a_year_takes_the_year_nearest_the_json_ld_date():
    event = pfl.parse_event_page(event_page(json_date="2026-04-11T21:00:00-04:00", header="SAT APR 11"), "https://pflmma.com/event/x")
    assert event["date"] == date(2026, 4, 11)

    # A New Year's Eve card whose JSON-LD date slipped into January.
    event = pfl.parse_event_page(event_page(json_date="2019-01-01T00:00:00-05:00", header="Monday Dec 31, 2018"), "https://pflmma.com/event/x")
    assert event["date"] == date(2018, 12, 31)


def test_event_fights_carry_winner_method_and_pairing():
    fights = [
        ("Ana Silva", "Bia Costa", "Winner: Bia Costa by Decision", "wt-fighter"),
        ("Caio Dias", "Dora Reis", "Winner: Caio Dias by KO (Head Kick)", "wt-fighter"),
        ("Eva Lima", "Fia Souza", "Eva Lima vs Fia Souza - Women's Flyweight Semifinal", "wt-fighter"),
    ]
    event = pfl.parse_event_page(event_page(fights=fights), "https://pflmma.com/event/pfl-test")
    assert event["name"] == "PFL Test" and event["location"] == "Test Arena, Chicago, IL"
    first, second, upcoming = event["fights"]
    assert (first["fighter_1"], first["fighter_2"], first["winner"], first["outcome"], first["method"]) == ("Ana Silva", "Bia Costa", "Bia Costa", "win", "DEC")
    assert (second["winner"], second["method"], second["method_detail"]) == ("Caio Dias", "KO/TKO", "Head Kick")
    assert upcoming["winner"] == "" and upcoming["outcome"] == ""
    assert (upcoming["weight_class"], upcoming["stage"]) == ("Women's Flyweight", "Semifinal")
    assert first["fight_url"] == "https://pflmma.com/event/pfl-test#fight-0"


def test_event_circuit_comes_from_the_kind_of_profile_pages_its_fighters_have():
    mena = [("A One", "B Two", "Winner: A One by TKO", "mena-fighter")]
    assert pfl.parse_event_page(event_page(fights=mena), "https://pflmma.com/event/x")["circuit"] == "PFL MENA"
    main = [("A One", "B Two", "Winner: A One by TKO", "regular-fighter")]
    assert pfl.parse_event_page(event_page(fights=main), "https://pflmma.com/event/x")["circuit"] == "PFL"


def test_a_page_without_event_data_is_skipped():
    assert pfl.parse_event_page("<html><body>nothing</body></html>", "https://pflmma.com/event/x") is None


def test_event_links_come_from_pages_and_the_sitemap_without_repeats():
    html = '<a href="/event/pfl-a">A</a><a href="https://pflmma.com/event/pfl-b?x=1">B</a><loc>https://pflmma.com/event/pfl-a</loc>'
    assert pfl.parse_event_links(html) == ["pfl-a", "pfl-b"]


@pytest.mark.parametrize(
    ("text", "expected"),
    [
        ("Decision", ("DEC", "", None, "")),
        ("Unanimous Decision", ("U-DEC", "", None, "")),
        ("unanimous", ("U-DEC", "", None, "")),
        ("Split Decision", ("S-DEC", "", None, "")),
        ("Decision Round 3 - 5:00", ("DEC", "", 3, "5:00")),
        ("TKO Round 3 - 4:07", ("KO/TKO", "", 3, "4:07")),
        ("KO", ("KO/TKO", "", None, "")),
        ("Knockout", ("KO/TKO", "", None, "")),
        ("Submission", ("SUB", "", None, "")),
        ("Submission (Armbar)", ("SUB", "Armbar", None, "")),
        ("Submisson", ("SUB", "", None, "")),
        ("Rear-Naked Choke", ("SUB", "Rear-Naked Choke", None, "")),
        ("Walkover", ("Walkover", "", None, "")),
        ("DQ", ("DQ", "", None, "")),
        ("No Contest", ("NO CONTEST", "", None, "")),
        ("", ("", "", None, "")),
        # Things the site really has in the method box.
        ("De", ("DEC", "", None, "")),
        ("3", ("", "", 3, "")),
        ("Godogo", ("", "", None, "")),
        ("Technical Decision", ("DEC", "", None, "")),
        ("Corner Stoppage", ("KO/TKO", "", None, "")),
        ("Forfeit", ("Walkover", "", None, "")),
    ],
)
def test_methods_are_written_like_the_ufc_data(text, expected):
    assert pfl.normalize_method(text) == expected


@pytest.mark.parametrize(
    ("text", "expected"),
    [("R5, 5:00", (5, "5:00")), ("Rd 2", (2, "")), ("Rd 2 (4:07)", (2, "4:07")), ("RD 2", (2, "")), ("Round 3 (5:00)", (3, "5:00")), ("(5:00)", (None, "5:00")), ("", (None, ""))],
)
def test_round_and_time_come_in_many_spellings(text, expected):
    assert pfl.parse_round_time(text) == expected


@pytest.mark.parametrize(
    ("label", "expected"),
    [
        ("Bantamweight (135)", ("Bantamweight", "")),
        ("Light Heavyweight (205)", ("Light Heavyweight", "")),
        ("Heavyweight Quarterfinal (265)", ("Heavyweight", "Quarterfinal")),
        ("Women's Lightweight Semifinals (155)", ("Women's Lightweight", "Semifinals")),
        ("Featherweight Championship (145)", ("Featherweight", "Championship")),
        ("PFL Women's Featherweight World Title (145)", ("Women's Featherweight", "World Title")),
        ("Contract Weight (180.5)", ("Contract Weight", "")),
        ("Welterweight", ("Welterweight", "")),
        ("atomweight", ("Atomweight", "")),
        ("Amateur Women's Atomweight", ("Women's Atomweight", "Amateur")),
        ("AMATEUR Welterweight", ("Welterweight", "Amateur")),
        ("Welterweight 1st Round (170)", ("Welterweight", "1st Round")),
    ],
)
def test_weight_class_and_stage_are_split_apart(label, expected):
    assert pfl.split_division(label) == expected


def test_only_championship_stages_make_a_title_fight():
    assert pfl.is_title_stage("Championship")
    assert pfl.is_title_stage("World Title")
    assert pfl.is_title_stage("Finals")
    assert not pfl.is_title_stage("Semifinals")
    assert not pfl.is_title_stage("Quarterfinal")
    assert not pfl.is_title_stage("")


def test_records_heights_and_reaches():
    assert pfl.parse_record("25-8-0") == (25, 8, 0, 0)
    assert pfl.parse_record("25-7-1 (1 NC)") == (25, 7, 1, 1)
    assert pfl.parse_record("n/a") is None
    assert pfl.parse_height_cm("5'6") == 167.6
    assert pfl.parse_height_cm('6\'1"') == 185.4
    assert pfl.parse_height_cm("-") is None
    assert pfl.parse_inches_cm('69"') == 175.3
    assert pfl.parse_number("135") == 135


def fighter_row(opponent_left, opponent_right, event, *, label="Bantamweight (135)", method="Decision", round_time="R5, 5:00", images=("self.png", "other.png"), season="PFL 2025"):
    return f"""
    <div class="row upcoming-fighter-row matchupRow">
      <div><h5>{season}</h5><h5>{label}</h5></div>
      <div><h3>Sat April 11</h3></div>
      <div>
        <h4 class="d-md-none">{opponent_left}</h4><h3 class="fighter-event-vs">VS</h3><h4 class="d-md-none">{opponent_right}</h4>
        <img alt="Fighter Headshot" src="https://img.test/{images[0]}"><img alt="Fighter Headshot" src="https://img.test/{images[1]}">
        <span class="winBy">{method}</span><span class="roundTime">{round_time}</span>
      </div>
      <a href="https://pflmma.com/event/{event}">Matchups</a>
    </div>"""


def fighter_page(rows="", *, not_fighting=False, nickname="Papa", flag="US", record="Career Record: 25-8-0", from_text="USA"):
    nick = f'<h4 class="mt-2">{nickname}</h4>' if nickname else ""
    return f"""<html><head><meta property="og:title" content="Sergio Pettis | Professional Fighters League"></head><body>
    <div class="fighter-dl"><div class="fighter-dl-inner">
      <h4 class="mb-2">PFL Record: 2-1-0</h4><h4 class="mb-2">{record}</h4>
      <h3>Sergio</h3>{nick}<h2>Pettis</h2>{"<span>NOT FIGHTING</span>" if not_fighting else ""}
    </div></div>
    <div id="details-mobile">
      <img src="https://img.test/flags/backdrops/{flag}_BACKDROP.jpg" alt="Fighter Flag">
      <h4>FROM <span class="d-block">{from_text}</span></h4>
      <h4>FIGHTING OUT OF <span class="d-block">Milwaukee, WI</span></h4>
      <h4>FIGHT CAMP<span class="d-block">Roufusport MMA Academy</span></h4>
      <div class="fighter-info-box"><h3>33</h3><h4>AGE</h4></div>
      <div class="fighter-info-box"><h3>5&#039;6</h3><h4>HEIGHT</h4></div>
      <div class="fighter-info-box"><h3>135</h3><h4>WEIGHT</h4></div>
      <div class="fighter-info-box"><h3>69&quot;</h3><h4>ARM REACH</h4></div>
      <div class="fighter-info-box"><h3>37.5&quot;</h3><h4>LEG REACH</h4></div>
    </div>
    <div id="filterResults-mobile">{rows}</div></body></html>"""


def test_fighter_profile_is_read_from_the_banner_and_the_info_boxes():
    html = fighter_page(fighter_row("Pettis", "McKee", "pfl-chicago-2026"))
    parsed = pfl.parse_fighter_page(html, "https://pflmma.com/wt-fighter/sergio-pettis")
    profile = parsed["profile"]
    assert profile["name"] == "Sergio Pettis" and profile["nickname"] == "Papa" and profile["slug"] == "sergio-pettis"
    assert profile["status"] == "active"
    assert (profile["career_record"], profile["org_record"]) == ("25-8-0", "2-1-0")
    assert (profile["wins"], profile["losses"], profile["draws"]) == (25, 8, 0)
    assert (profile["age"], profile["height_cm"], profile["weight_lbs"], profile["reach_cm"], profile["leg_reach_cm"]) == (33.0, 167.6, 135.0, 175.3, 95.2)
    assert profile["hometown"] == "USA" and profile["country"] == "United States" and profile["country_code"] == "us"
    assert profile["fighting_out_of"] == "Milwaukee, WI" and profile["camp"] == "Roufusport MMA Academy"
    assert profile["weight_class"] == "Bantamweight"
    assert profile["circuit"] == "PFL"
    assert parsed["last_name"] == "Pettis"


def test_a_fighter_without_a_nickname_or_in_retirement():
    html = fighter_page(not_fighting=True, nickname="", flag="BR", from_text="Xapuri, Acre")
    profile = pfl.parse_fighter_page(html, "https://pflmma.com/regular-fighter/sergio-pettis")["profile"]
    assert profile["nickname"] == "" and profile["status"] == "inactive"
    assert profile["hometown"] == "Xapuri, Acre" and profile["country_code"] == "br" and profile["country"] == "Brazil"


def test_a_page_that_is_not_a_profile_is_rejected():
    assert pfl.parse_fighter_page("<html><body><h1>Oops</h1></body></html>", "https://pflmma.com/wt-fighter/x") is None


def test_fight_rows_tie_each_bout_to_its_event_and_opponent():
    rows = fighter_row("Pettis", "McKee", "pfl-chicago-2026", method="Decision", round_time="R5, 5:00")
    rows += fighter_row("Magomedov", "Pettis", "road-to-dubai", method="KO", round_time="Rd 2", images=("magomedov.png", "self.png"))
    rows += fighter_row("Heavy", "Pettis", "2019-pfl-3", label="Heavyweight Quarterfinal (265)", method="", round_time="")
    parsed = pfl.parse_fighter_page(fighter_page(rows), "https://pflmma.com/wt-fighter/sergio-pettis")
    chicago, dubai, quarter = parsed["fights"]
    assert (chicago["event_slug"], chicago["opponent_surname"], chicago["method"], chicago["round"], chicago["time"]) == ("pfl-chicago-2026", "McKee", "DEC", 5, "5:00")
    assert (dubai["event_slug"], dubai["opponent_surname"], dubai["method"], dubai["round"]) == ("road-to-dubai", "Magomedov", "KO/TKO", 2)
    assert (quarter["weight_class"], quarter["stage"]) == ("Heavyweight", "Quarterfinal")


def test_the_fighters_own_photo_is_the_one_in_every_row_not_the_opponents():
    rows = fighter_row("Pettis", "McKee", "e1", images=("self.png", "mckee.png"))
    rows += fighter_row("Magomedov", "Pettis", "e2", images=("magomedov.png", "self.png"))
    profile = pfl.parse_fighter_page(fighter_page(rows), "https://pflmma.com/wt-fighter/sergio-pettis")["profile"]
    assert profile["headshot_url"] == "https://img.test/self.png"


def test_a_placeholder_photo_is_not_kept():
    rows = fighter_row("Pettis", "McKee", "e1", images=("default-male.png", "mckee.png"))
    profile = pfl.parse_fighter_page(fighter_page(rows), "https://pflmma.com/wt-fighter/sergio-pettis")["profile"]
    assert "default" not in profile["headshot_url"]


def test_details_from_the_fighter_pages_fill_what_the_event_page_lacks():
    event = pfl.parse_event_page(
        event_page(fights=[("Sergio Pettis", "Mitch McKee", "Winner: Mitch McKee by Decision", "wt-fighter")]),
        "https://pflmma.com/event/pfl-test",
    )
    fights = pfl.fight_rows_from_event(event)
    assert fights[0]["weight_class"] == "" and fights[0]["round"] == ""

    details = {
        "pfl-test": [
            {"_owner": pfl.name_key("Sergio Pettis"), "opponent_surname": "McKee", "weight_class": "Bantamweight", "stage": "Championship",
             "method": "DEC", "method_detail": "", "round": 5, "time": "5:00"},
        ]
    }
    assert pfl.merge_fighter_details(fights, details) == 1
    assert (fights[0]["weight_class"], fights[0]["round"], fights[0]["time"], fights[0]["title_fight"]) == ("Bantamweight", 5, "5:00", "true")
    assert fights[0]["card_order"] == 0


def test_an_unknown_bout_is_left_alone():
    event = pfl.parse_event_page(event_page(fights=[("A One", "B Two", "Winner: A One by KO", "wt-fighter")]), "https://pflmma.com/event/pfl-test")
    fights = pfl.fight_rows_from_event(event)
    assert pfl.merge_fighter_details(fights, {"other-event": []}) == 0
    assert fights[0]["weight_class"] == ""


RANKINGS_HTML = """
<div class="rankings-box rankings-box-mens_p4p">
  <div class="ranking-title"><h5>MEN'S P4P TOP RANK</h5></div>
  <div class="position-relative"><h4 class="mb-2">Usman<br>Nurmagomedov</h4><div class="top-img-box"></div></div>
  <div class="rankings-list">
    <div class="ranking-line"><div class="black-box"><span>1</span></div><div class="name-box"><h6>Usman Nurmagomedov</h6></div><div class="movement-col"></div></div>
    <div class="ranking-line"><div class="black-box"><span>2</span></div><div class="name-box"><h6>Vadim Nemkov</h6></div><div class="movement-col"></div></div>
  </div>
</div>
<div class="rankings-box rankings-box-bantamweight">
  <div class="ranking-title"><h5>BANTAMWEIGHT</h5></div>
  <div class="position-relative"><h4 class="mb-2">VACANT<br></h4><div class="top-img-box is-vacant"></div></div>
  <div class="rankings-list">
    <div class="ranking-line"><div class="black-box"><span>1</span></div><div class="name-box"><h6>Mitch McKee</h6></div><div class="movement-col"></div></div>
    <div class="ranking-line"><div class="black-box"><span>3</span></div><div class="name-box"><h6>Taylor Lapilus</h6></div>
      <div class="movement-col"><span class="ranking-movement-wrap"><i class="fa-solid fa-chevron-up movement-arrow positive"></i><span class="movement-num">1</span></span></div></div>
    <div class="ranking-line"><div class="black-box"><span>4</span></div><div class="name-box"><h6>Sergio Pettis</h6></div>
      <div class="movement-col"><span class="ranking-movement-wrap"><i class="fa-solid fa-chevron-down movement-arrow negative"></i><span class="movement-num">2</span></span></div></div>
    <div class="ranking-line"><div class="black-box"><span>9</span></div><div class="name-box"><h6>Daniel Marcos</h6></div><div class="movement-col">NR</div></div>
  </div>
</div>
<div class="rankings-box rankings-box-middleweight">
  <div class="ranking-title"><h5>MIDDLEWEIGHT</h5></div>
  <div class="position-relative"><h4 class="mb-2">Costello<br>van Steenis</h4><div class="top-img-box"></div></div>
  <div class="rankings-list">
    <div class="ranking-line"><div class="black-box"><span>IC</span></div><div class="name-box"><h6>Johnny Eblen</h6></div><div class="movement-col"></div></div>
    <div class="ranking-line"><div class="black-box"><span>2</span></div><div class="name-box"><h6>Fabian Edwards</h6></div><div class="movement-col"></div></div>
  </div>
</div>
"""


def test_rankings_have_champions_vacancies_interims_and_movement():
    rows = pfl.parse_rankings(RANKINGS_HTML)
    by_category: dict[str, list[dict]] = {}
    for row in rows:
        by_category.setdefault(row["category"], []).append(row)

    p4p = by_category["Pound-for-Pound (Men's)"]
    assert [(row["rank"], row["fighter"], row["is_p4p"]) for row in p4p] == [(1, "Usman Nurmagomedov", True), (2, "Vadim Nemkov", True)]

    bantam = by_category["Bantamweight"]
    assert bantam[0] == {"category": "Bantamweight", "is_p4p": False, "rank": 0, "fighter": "", "rank_change": "", "status": "vacant", "athlete_url": ""}
    assert [(row["rank"], row["fighter"], row["rank_change"]) for row in bantam[1:]] == [
        (1, "Mitch McKee", ""), (3, "Taylor Lapilus", "up 1"), (4, "Sergio Pettis", "down 2"), (9, "Daniel Marcos", "new"),
    ]

    middle = by_category["Middleweight"]
    assert (middle[0]["rank"], middle[0]["fighter"], middle[0]["status"]) == (0, "Costello van Steenis", "champion")
    assert (middle[1]["rank"], middle[1]["fighter"], middle[1]["status"]) == (0, "Johnny Eblen", "interim")


def test_a_broken_rankings_page_is_not_allowed_to_replace_the_stored_one():
    assert "zero" in pfl.rankings_problem([])
    assert "categories" in pfl.rankings_problem([{"category": "Bantamweight"}])
    full = [{"category": f"Division {index}"} for index in range(8)]
    assert pfl.rankings_problem(full) is None
    assert "dropped" in pfl.rankings_problem(full, previous_rows=100)


def test_an_announced_bout_stays_until_the_event_page_lists_that_pairing():
    scraped = [{"fighter_1": "Taylor Lapilus", "fighter_2": "Mitch McKee"}]
    announced = [
        {"fighter_1": "Mitch McKee", "fighter_2": "Taylor Lapilus"},
        {"fighter_1": "Jan Cieplowski", "fighter_2": "Mauricio Partida", "weight_class": "Bantamweight"},
    ]
    kept = pfl.include_announced(scraped, announced)
    assert [row["fighter_1"] for row in kept] == ["Jan Cieplowski", "Taylor Lapilus"]
    assert kept[0]["weight_class"] == "Bantamweight"
    assert kept[0]["winner"] == ""


def test_a_settled_event_has_a_result_for_every_bout():
    assert pfl.is_settled([{"outcome": "win"}, {"outcome": "draw"}])
    assert not pfl.is_settled([{"outcome": "win"}, {"outcome": ""}])
    assert not pfl.is_settled([])


def test_a_bout_on_no_fighter_page_takes_the_division_both_profiles_agree_on():
    fighters = {
        "a": {"name": "Ana Silva", "weight_class": "Heavyweight"},
        "b": {"name": "Bia Costa", "weight_class": "Heavyweight"},
        "c": {"name": "Caio Dias", "weight_class": "Lightweight"},
        "d": {"name": "Dora Reis", "weight_class": ""},
    }
    fights = [
        {"fighter_1": "Ana Silva", "fighter_2": "Bia Costa", "weight_class": ""},
        {"fighter_1": "Ana Silva", "fighter_2": "Caio Dias", "weight_class": ""},  # they disagree: left blank
        {"fighter_1": "Bia Costa", "fighter_2": "Dora Reis", "weight_class": ""},  # one profile has none: left blank
        {"fighter_1": "Ana Silva", "fighter_2": "Bia Costa", "weight_class": "Light Heavyweight"},  # already known
    ]
    assert pfl.fill_missing_weight_classes(fights, fighters) == 1
    assert [fight["weight_class"] for fight in fights] == ["Heavyweight", "", "", "Light Heavyweight"]


@pytest.mark.parametrize(
    ("raw", "expected"),
    [('"MAGIC"', "Magic"), ('"WHITE GORILLA"', "White Gorilla"), ("The Don", "The Don"), ("Nickname", ""), ("N/A", ""), ("  ", ""), (None, ""), ("“Pitbull”", "Pitbull"), ("MMA", "MMA")],
)
def test_nicknames_lose_their_quotes_and_placeholders(raw, expected):
    assert pfl.clean_nickname(raw) == expected


def test_first_and_last_fight_dates_skip_bouts_still_to_come():
    fighters = [{"name": "Ana Silva"}, {"name": "Bia Costa"}]
    fights = [
        {"fighter_1": "Ana Silva", "fighter_2": "Bia Costa", "event_date": "2026-12-19"},
        {"fighter_1": "Ana Silva", "fighter_2": "Dora Reis", "event_date": "2026-04-11"},
        {"fighter_1": "Caio Dias", "fighter_2": "Ana Silva", "event_date": "2024-01-02"},
    ]
    pfl._fill_fight_dates(fighters, fights, "2026-10-21")
    assert (fighters[0]["first_fight_date"], fighters[0]["last_fight_date"]) == ("2024-01-02", "2026-04-11")
    assert (fighters[1]["first_fight_date"], fighters[1]["last_fight_date"]) == ("", "")


def test_fighters_are_linked_to_the_photos_that_are_on_disk(tmp_path, monkeypatch):
    monkeypatch.setattr(pfl, "PHOTOS_DIR", tmp_path)
    (tmp_path / "ana-silva.webp").write_bytes(b"x")
    fighters = [{"slug": "ana-silva", "image_url": ""}, {"slug": "bia-costa", "image_url": "/stale.webp"}]
    pfl.attach_local_photos(fighters)
    assert [fighter["image_url"] for fighter in fighters] == ["/fighter-photos/pfl/ana-silva.webp", ""]
