"""openapi.yaml décrit toutes les routes de l'API, et seulement elles."""
import yaml

from generate_openapi import SPEC_PATH, api_routes


def test_every_route_is_documented(app):
    with open(SPEC_PATH, encoding="utf-8") as f:
        documented = {(path, method) for path, ops in yaml.safe_load(f)["paths"].items() for method in ops}
    actual = {(path, method) for path, method, *_ in api_routes(app)}

    missing = sorted(actual - documented)
    stale = sorted(documented - actual)
    assert not missing, f"Routes non documentées (lancer python generate_openapi.py) : {missing}"
    assert not stale, f"Routes documentées qui n'existent plus : {stale}"
