from scripts import scrape_roster_watch as rw

PAGE = """
<table>
<tr data-fighter="Cris Cyborg" data-dob="1985-07-09" data-debut="2016-05-14" data-prev="2019-07-27" data-bouts="7"
    data-wins="6" data-losses="1" data-gender="female" data-country="🇧🇷 " data-weightclass='["featherweight"]'>
  <td><a href="/fighters/criscyborg.html">Cris Cyborg</a></td></tr>
<tr data-fighter="Josh Burkman" data-dob="1980-10-04" data-debut="2005-11-05" data-prev="2018-02-18" data-bouts="19"
    data-wins="11" data-losses="8" data-gender="male" data-country="🇺🇸" data-weightclass='["welterweight"]'>
  <td><a href="/fighters/joshburkman.html">Josh Burkman</a></td></tr>
<tr data-fighter="Josh Burkman" data-dob="1980-10-04" data-debut="2005-11-05" data-prev="2018-02-18" data-bouts="19"
    data-wins="11" data-losses="8" data-gender="male" data-country="🇺🇸" data-weightclass='["welterweight"]'><td></td></tr>
<tr class="header"><th>fighter</th></tr>
</table>
"""

FIGHTERS = [
    {"name": "Cristiane Justino", "fighter_url": "u1", "dob": "1985-07-09", "key": "cristiane justino", "last_fight": "2019-07-27"},
    {"name": "Joshua Burkman", "fighter_url": "u2", "dob": "1980-04-10", "key": "joshua burkman", "last_fight": "2018-02-18"},
    {"name": "Another Fighter", "fighter_url": "u3", "dob": "1990-01-01", "key": "another fighter", "last_fight": "2020-01-01"},
]


def test_parse_reads_one_row_per_fighter_row():
    rows = rw.parse(PAGE, "former")
    assert [row["name"] for row in rows] == ["Cris Cyborg", "Josh Burkman", "Josh Burkman"]
    assert rows[0]["debut"] == "2016-05-14" and rows[0]["last_fight"] == "2019-07-27"
    assert rows[0]["weight_classes"] == "featherweight"
    assert rows[0]["profile"] == "https://www.roster.watch/fighters/criscyborg.html"


def test_rows_are_linked_by_date_of_birth_and_last_fight_when_the_name_differs():
    rows = rw.parse(PAGE, "former")[:1]
    rw.link_rows(rows, FIGHTERS)
    assert (rows[0]["fighter_url"], rows[0]["link"]) == ("u1", "dob+last fight")


def test_a_birth_date_disagreement_does_not_block_a_match_on_name_and_last_fight():
    rows = rw.parse(PAGE, "former")[1:2]
    rw.link_rows(rows, FIGHTERS)
    assert rows[0]["fighter_url"] == "u2"


def test_unknown_fighters_stay_unlinked():
    rows = [{"name": "Nobody Known", "dob": "1970-01-01", "last_fight": "2001-01-01", "fighter_url": "", "link": ""}]
    rw.link_rows(rows, FIGHTERS)
    assert rows[0]["fighter_url"] == ""


BADGE_PAGE = """
<table>
<tr data-fighter="Ilia Topuria" data-dob="1997-01-21" data-debut="2020-10-10" data-prev="2026-06-14" data-bmf="" data-dwcs="true"
    data-tuf="" data-hof="" data-gender="male" data-weightclass='["lightweight"]'>
  <td class="td-fighter"><a href="/fighters/iliatopuria.html">Ilia Topuria</a>
    <span class="extras"><span title="Greatest of all Time">G</span></span></td>
  <td class="td-country"><div class="emoji" title="Georgia">x</div><div class="emoji" title="Spain">x</div></td></tr>
<tr data-fighter="Justin Gaethje" data-dob="1988-11-14" data-debut="2012-01-01" data-prev="2026-06-14" data-bmf="true" data-dwcs="" data-gender="male"
    data-weightclass='["lightweight"]'><td class="td-fighter"><a href="/fighters/justingaethje.html">Justin Gaethje</a></td>
  <td class="td-country"><div class="emoji" title="United States">x</div></td></tr>
</table>
"""


def test_nationalities_keep_their_order_and_get_flag_codes():
    topuria = rw.parse(BADGE_PAGE, "active")[0]
    assert topuria["countries"] == "Georgia|Spain"
    assert topuria["country_codes"] == "ge|es"
    assert topuria["status"] == "active"


def test_badges_come_from_the_row_attributes_and_the_goat_marker():
    topuria, gaethje = rw.parse(BADGE_PAGE, "active")
    assert topuria["badges"] == "goat|dwcs"
    assert gaethje["badges"] == "bmf"
