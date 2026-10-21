"""The FightHub gym scraper's parsers, run against small pages that copy the structure of the real ones."""

from __future__ import annotations

import pytest

from scripts import scrape_gyms as gyms

DIRECTORY = """
<div class="fhx-rows">
  <a class="fhx-row" href="https://fighthub-app.com/br/gyms/american-top-team/"><span class="fhx-row__name">American Top Team</span><span class="fhx-row__n" data-l="Lutadores">54</span></a>
  <a class="fhx-row" href="https://fighthub-app.com/br/gyms/kill-cliff-fc/?x=1"><span class="fhx-row__name">Kill  Cliff FC</span><span class="fhx-row__n">1.037</span></a>
  <a href="https://fighthub-app.com/br/gyms/?fh_page=2">2</a>
</div>"""


def card(name, slug, nick="", division="Lightweight", flag="🇧🇷", record="10-2-0"):
    return f"""<li class="fh-list__item"><a class="fh-card" href="https://fighthub-app.com/br/fighters/{slug}/">
      <span class="fh-card__shot"><img src="x.png"></span>
      <span class="fh-card__body"><span class="fh-card__name">{name}</span>{f'<span class="fh-card__nick">« {nick} »</span>' if nick else ''}
      <span class="fh-card__meta"><span class="fh-card__div">{division}</span>{f'<span class="fh-card__flag">{flag}</span>' if flag else ''}<span class="fh-card__record">{record}</span></span></span></a></li>"""


def test_the_directory_gives_slug_name_and_fighter_count():
    found = gyms.parse_directory(DIRECTORY)
    assert found == [
        {"slug": "american-top-team", "name": "American Top Team", "url": "https://fighthub-app.com/br/gyms/american-top-team/", "fighters_count": 54},
        {"slug": "kill-cliff-fc", "name": "Kill Cliff FC", "url": "https://fighthub-app.com/br/gyms/kill-cliff-fc/", "fighters_count": 1037},
    ]


def test_the_directory_knows_when_there_is_a_next_page():
    assert gyms.has_next_page(DIRECTORY, 1)
    assert not gyms.has_next_page(DIRECTORY, 2)


def test_a_gym_page_lists_its_fighters_with_nickname_division_flag_and_record():
    html = "<ul>" + card("Alexandre Pantoja", "alexandre-pantoja", nick="The Cannibal", division="Flyweight", record="30-7-0") + card("Dovlet Yagshimuradov", "dovlet", flag="", record="26-9-1") + "</ul>"
    found = gyms.parse_gym_fighters(html, "american-top-team")
    assert found[0] == {
        "gym_slug": "american-top-team", "fighter": "Alexandre Pantoja", "fighter_slug": "alexandre-pantoja",
        "nickname": "The Cannibal", "division": "Flyweight", "country_code": "br", "record": "30-7-0",
    }
    assert (found[1]["nickname"], found[1]["country_code"], found[1]["record"]) == ("", "", "26-9-1")


@pytest.mark.parametrize(
    ("emoji", "code"),
    [("🇧🇷", "br"), ("🇺🇸", "us"), ("🇬🇧", "gb"), ("🏴\U000e0067\U000e0062\U000e0065\U000e006e\U000e0067\U000e007f", "gb-eng"), ("", ""), ("x", "")],
)
def test_flag_emoji_become_flag_codes(emoji, code):
    assert gyms.flag_code(emoji) == code


def test_a_directory_that_lost_gyms_is_not_allowed_to_replace_the_stored_one():
    assert "no gyms" in gyms.gyms_problem([])
    assert gyms.gyms_problem([{"slug": "a"}] * 90, previous=100) is None
    assert "dropped" in gyms.gyms_problem([{"slug": "a"}] * 10, previous=100)


class FakeFetcher:
    def __init__(self, pages):
        self.pages, self.asked = pages, []

    def get(self, url):
        self.asked.append(url)
        return self.pages[url]


def test_a_big_gym_is_read_page_by_page_without_repeating_a_fighter():
    gym = {"slug": "big", "url": "https://fighthub-app.com/br/gyms/big/", "fighters_count": 51}
    fetcher = FakeFetcher(
        {
            gym["url"]: "".join(card(f"Fighter {n}", f"f{n}") for n in range(50)),
            gym["url"] + "?fh_page=2": card("Fighter 49", "f49") + card("Fighter 50", "f50"),
        }
    )
    found = gyms.fetch_gym_fighters(fetcher, gym)
    assert len(found) == 51
    assert len(fetcher.asked) == 2


def test_the_directory_is_followed_until_its_last_page():
    page1 = DIRECTORY
    page2 = '<a class="fhx-row" href="https://fighthub-app.com/br/gyms/nova-uniao/"><span class="fhx-row__name">Nova Uniao</span><span class="fhx-row__n">16</span></a>'
    fetcher = FakeFetcher({gyms.DIRECTORY_URL: page1, gyms.DIRECTORY_URL + "?fh_page=2": page2})
    assert [gym["slug"] for gym in gyms.fetch_directory(fetcher)] == ["american-top-team", "kill-cliff-fc", "nova-uniao"]
