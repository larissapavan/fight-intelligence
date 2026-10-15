from scripts import scrape_stat_leaders as leaders

PAGE = """
<p id="results-nav--last-updated">Last Update: 10/15/2026 07:45 GMT</p>
<article class="results-group Fights-group" id="TotalFights-group">
  <header><h3>Total Fights</h3><p>&nbsp;</p></header>
  <div class="results-table">
    <div class="results-table--tr results-table--th"><span>Rnk</span><span>Fighter</span><span>Total</span></div>
    <div class="results-table--tr results-table--row-1"><span>1</span><span><a href="http://www.ufc.com/athlete/Jim-Miller">Jim Miller</a></span><span>47</span>
      <img alt="x" src="https://example.com/a.png" /></div>
    <div class="results-table--tr"><span>2</span><span><a href="http://www.ufc.com/athlete/Andrei-Arlovski">Andrei Arlovski</a></span><span>42</span></div>
  </div>
</article>
<article class="results-group Striking-group" id="SigStrikesAccuracy-group">
  <header><h3>Sig Strike Accuracy</h3><p>Minimum 5 UFC Fights and 500 Significant Strike Attempts</p></header>
  <div class="results-table">
    <div class="results-table--tr results-table--th"><span>Rnk</span><span>Fighter</span><span>Percent</span></div>
    <div class="results-table--tr"><span>1</span><span><a href="http://www.ufc.com/athlete/Alistair-Overeem">Alistair Overeem</a></span><span>74.3%</span></div>
  </div>
</article>
"""


def test_parse_reads_stats_leaders_and_notes():
    rows = leaders.parse(PAGE)
    assert len(rows) == 3

    first = rows[0]
    assert (first["category"], first["stat_key"], first["stat"]) == ("Fights", "TotalFights", "Total Fights")
    assert (first["rank"], first["fighter"], first["value"], first["unit"]) == ("1", "Jim Miller", "47", "Total")
    assert first["ufc_url"] == "http://www.ufc.com/athlete/Jim-Miller"
    assert first["updated"] == "2026-10-15"

    accuracy = rows[2]
    assert accuracy["category"] == "Striking"
    assert accuracy["note"] == "Minimum 5 UFC Fights and 500 Significant Strike Attempts"
    assert accuracy["unit"] == "Percent"


def test_headshots_are_not_copied():
    assert all("png" not in " ".join(row.values()) for row in leaders.parse(PAGE))


def test_updated_date_is_parsed_from_the_page_stamp():
    assert leaders.parse_updated("Last Update: 1/5/2027 07:45 GMT") == "2027-01-05"
    assert leaders.parse_updated("nothing here") == ""
