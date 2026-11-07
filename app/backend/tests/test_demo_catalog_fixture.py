import json
from collections import Counter
from pathlib import Path


def test_historical_demo_catalog_is_test_only_and_complete():
    fixture_path = Path(__file__).parent / "fixtures" / "historical_demo_catalog.json"
    catalog = json.loads(fixture_path.read_text(encoding="utf-8"))

    assert "only" in catalog["purpose"].lower()
    assert "production" in catalog["purpose"].lower()
    assert len(catalog["categories"]) == 3
    assert len(catalog["points"]) == 15

    counts = Counter(point[2] for point in catalog["points"])
    assert counts == {
        "looking-for-you": 5,
        "mdps": 5,
        "where-is-fuel": 5,
    }

    category_slugs = {category["slug"] for category in catalog["categories"]}
    for title, description, slug, longitude, latitude, event_at, author_name in catalog["points"]:
        assert title
        assert description
        assert slug in category_slugs
        assert 47.0 <= longitude <= 48.0
        assert 51.0 <= latitude <= 53.0
        assert event_at.endswith("+04:00")
        assert author_name
