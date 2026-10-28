"""Nettoyage des noms de cours avec un tiret entre deux idées."""
from clean_course_titles import clean_course_titles, clean_title


def test_dash_between_words_becomes_colon():
    assert clean_title("Médicaments - Introduction générale") == "Médicaments : Introduction générale"
    assert clean_title("Pharmacologie — Molécules") == "Pharmacologie : Molécules"
    assert clean_title("Analyse Physico-Chimique du Médicament") == "Analyse Physico-Chimique du Médicament"


def test_dry_run_then_apply(app, db):
    db.save_course("u1", "a", {"nom": "Cardio - Bases", "flashcards": [], "quiz": []})
    db.save_course("u1", "b", {"nom": "Physico-Chimie", "flashcards": [], "quiz": []})
    path = app.config["DATABASE_PATH"]

    assert clean_course_titles(path) == [("Cardio - Bases", "Cardio : Bases")]
    assert db.fetch_course("u1", "a").nom == "Cardio - Bases"  # rien de modifié sans --apply

    clean_course_titles(path, apply=True)
    assert db.fetch_course("u1", "a").nom == "Cardio : Bases"
    assert db.fetch_course("u1", "b").nom == "Physico-Chimie"
