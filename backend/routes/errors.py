import logging

from flask import jsonify

logger = logging.getLogger(__name__)


def internal_error(context: str):
    """Réponse 500 générique : le détail de l'exception (chemins, SQL, erreurs
    du fournisseur IA…) reste dans les logs serveur et n'est jamais renvoyé au client.
    À appeler depuis un bloc ``except``."""
    logger.exception(context)
    return jsonify({"error": f"{context}. Réessaie dans un instant."}), 500
