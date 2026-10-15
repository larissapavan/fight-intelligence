import pandas as pd

from backend.app.services import catalog_service


def write(path, header, rows):
    path.write_text("\n".join([header, *rows]) + "\n", encoding="utf-8")


def test_manifest_priority_champion_over_espn_over_historical_and_blank_paths_ignored(tmp_path, monkeypatch):
    historical = tmp_path / "lutadores_historicos.csv"
    write(
        historical,
        "name,approx_roster_start,approx_roster_end,source,source_url,image_url,local_path",
        [
            "Alpha One,,,Wikipedia,u,https://upload.wikimedia.org/a.jpg,downloaded_photos/old_fighters/alpha-one.jpg",
            "Gamma Three,,,Wikipedia,u,https://upload.wikimedia.org/g.jpg,downloaded_photos/old_fighters/gamma-three.jpg",
        ],
    )
    manifest = tmp_path / "fighter_photos.csv"
    write(
        manifest,
        "name,kind,source,source_url,image_url,local_path,checked",
        [
            "Alpha One,champion,ufc.com,u,/fighter-photos/alpha-one-champion.webp?v=abc,frontend/public/fighter-photos/alpha-one-champion.webp,2026-10-14",
            "Alpha One,espn,ESPN,u,/fighter-photos/alpha-one.webp,frontend/public/fighter-photos/alpha-one.webp,2026-10-14",
            "Beta Two,espn,ESPN,u,/fighter-photos/beta-two.webp,frontend/public/fighter-photos/beta-two.webp,2026-10-14",
            "No Photo,espn,ESPN,u,,,2026-10-14",
        ],
    )
    monkeypatch.setattr(catalog_service, "HISTORICAL_PHOTOS_SOURCE_PATH", historical)
    monkeypatch.setattr(catalog_service, "PHOTOS_MANIFEST_PATH", manifest)

    result = catalog_service._load_historical_photos()
    urls = dict(zip(result["profile_key"], result["historical_image_url"]))

    assert urls["alpha one"] == "/fighter-photos/alpha-one-champion.webp?v=abc"
    assert urls["beta two"] == "/fighter-photos/beta-two.webp"
    assert urls["gamma three"] == "/fighter-photos/gamma-three.jpg"  # derived from the file name, not the wikimedia URL
    assert "no photo" not in urls


def test_missing_manifests_return_empty_frame(tmp_path, monkeypatch):
    monkeypatch.setattr(catalog_service, "HISTORICAL_PHOTOS_SOURCE_PATH", tmp_path / "nope.csv")
    monkeypatch.setattr(catalog_service, "PHOTOS_MANIFEST_PATH", tmp_path / "nope2.csv")
    result = catalog_service._load_historical_photos()
    assert isinstance(result, pd.DataFrame) and result.empty
