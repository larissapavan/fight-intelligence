from backend.app.services import catalog_service
from backend.app.services.champions_service import get_champions_data


def test_current_undisputed_champions_carry_the_belt_flag():
    catalog = catalog_service._build_catalog()
    belted = set(catalog.loc[catalog["belt"], "name"])
    current = {
        reign["champion"]
        for reign in get_champions_data()["current_champions"]
        if reign["title_type"] == "undisputed"
    }

    assert current, "title_reigns.csv should list current champions"
    assert current <= belted
    assert belted <= current
