"""Régénère openapi.yaml à partir des routes réelles de l'application.

    python generate_openapi.py

Chaque route Flask y figure, avec ses méthodes, ses paramètres de chemin et
la première ligne de sa docstring comme résumé. Les descriptions écrites à la
main (corps de requête, réponses détaillées) sont conservées tant que la
route existe. tests/unit/test_openapi.py vérifie qu'aucune route n'est oubliée :
relancer ce script après avoir ajouté une route.
"""
import inspect
import os
import re

import yaml

SPEC_PATH = os.path.join(os.path.dirname(__file__), "openapi.yaml")
# Routes techniques, pas de l'API : fichiers statiques et Swagger lui-même.
IGNORED_PREFIXES = ("/static", "/flasgger_static", "/api/docs")
TAGS = {
    "health": "Santé",
    "courses": "Cours et import",
    "sessions": "Révision",
    "paths": "Parcours et leçons",
    "account": "Compte, analytique et signalements",
    "chat": "Assistant IA",
    "friends": "Amis et classement",
    "exams": "Examens",
    "quests": "Quêtes",
    "mock_exam": "Examen blanc",
    "challenges": "Défis",
    "flashcards": "Flashcards",
    "cases": "Cas cliniques",
}
PARAM = re.compile(r"<(?:(\w+):)?(\w+)>")


def api_routes(app):
    """[(chemin OpenAPI, méthode, fonction, paramètres)] pour chaque route de l'API."""
    routes = []
    for rule in app.url_map.iter_rules():
        if rule.rule.startswith(IGNORED_PREFIXES):
            continue
        params = [(name, converter or "string") for converter, name in PARAM.findall(rule.rule)]
        path = PARAM.sub(lambda m: "{" + m.group(2) + "}", rule.rule)
        for method in sorted(rule.methods - {"HEAD", "OPTIONS"}):
            routes.append((path, method.lower(), app.view_functions[rule.endpoint], rule.endpoint, params))
    return routes


def _operation(func, endpoint, params):
    doc = inspect.getdoc(func) or ""
    summary, _, details = doc.partition("\n")
    operation = {
        "tags": [TAGS.get(endpoint.split(".")[0], endpoint.split(".")[0])],
        "summary": summary.strip() or endpoint.split(".")[-1].replace("_", " "),
    }
    if details.strip():
        operation["description"] = details.strip()
    if params:
        operation["parameters"] = [
            {"name": name, "in": "path", "required": True, "schema": {"type": "integer" if conv == "int" else "string"}}
            for name, conv in params
        ]
    responses = {"200": {"description": "Succès"}}
    # @require_auth enveloppe la vue (functools.wraps) : la route demande un compte.
    if hasattr(func, "__wrapped__"):
        operation["security"] = [{"BearerAuth": []}]
        responses["401"] = {"description": "Token manquant ou invalide"}
    operation["responses"] = responses
    return operation


def build_spec(app, previous: dict) -> dict:
    old_paths = previous.get("paths", {})
    paths: dict = {}
    for path, method, func, endpoint, params in sorted(api_routes(app), key=lambda r: (r[0], r[1])):
        kept = old_paths.get(path, {}).get(method)
        paths.setdefault(path, {})[method] = kept or _operation(func, endpoint, params)
    spec = {k: v for k, v in previous.items() if k != "paths"}
    spec["paths"] = paths
    return spec


if __name__ == "__main__":
    from app import create_app
    from config import TestingConfig

    with open(SPEC_PATH, encoding="utf-8") as f:
        previous = yaml.safe_load(f)
    spec = build_spec(create_app(TestingConfig), previous)
    with open(SPEC_PATH, "w", encoding="utf-8") as f:
        yaml.safe_dump(spec, f, allow_unicode=True, sort_keys=False, width=110)
    print(f"{sum(len(v) for v in spec['paths'].values())} opérations sur {len(spec['paths'])} chemins")
