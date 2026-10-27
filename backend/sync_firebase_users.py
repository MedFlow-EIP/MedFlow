"""Importe tous les comptes Firebase Auth dans user_stats.

Le backend ne connaît un compte qu'à partir de sa première requête : un
compte créé mais jamais utilisé avec CE backend (ou utilisé avant
l'inscription automatique) n'apparaît ni au classement ni dans la recherche
d'amis. Ce script rattrape ces comptes. Il est idempotent : le relancer ne
crée pas de doublon et n'écrase jamais un nom déjà connu par une valeur vide.

Usage (sur la VM) :
    docker compose exec backend python sync_firebase_users.py
En local :
    cd backend && python3 sync_firebase_users.py
"""
import logging
from typing import Iterable

from dotenv import load_dotenv

logger = logging.getLogger(__name__)


def sync_users(db, users: Iterable) -> int:
    """Inscrit chaque utilisateur Firebase (uid, display_name, email) ; renvoie le nombre traité."""
    count = 0
    for user in users:
        email = (user.email or "").lower() or None
        db.register_user(user.uid, user.display_name or None, email)
        count += 1
    return count


def main() -> None:
    load_dotenv()
    import firebase_admin
    from firebase_admin import auth

    from app import _init_firebase, create_app

    app = create_app()
    _init_firebase()
    if not firebase_admin._apps:
        raise SystemExit(
            "Firebase Admin n'a pas pu s'initialiser : ajoute les variables FIREBASE_* "
            "(clé du compte de service) dans backend/.env, comme sur la VM."
        )
    total = sync_users(app.db, auth.list_users().iterate_all())
    print(f"{total} compte(s) Firebase synchronisé(s) dans user_stats.")


if __name__ == "__main__":
    main()
