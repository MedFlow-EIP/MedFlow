"""Spécialités médicales proposées comme tags de cours (F54).

La suggestion à l'import se fait par mots-clés : gratuit (aucun appel IA)
et suffisant pour pré-remplir, l'utilisateur corrige si besoin.
"""
import re
import unicodedata

# Spécialité -> mots-clés (sans accents, en minuscules).
SPECIALTIES = {
    "Anatomie": ["anatomie", "os ", "muscle", "articulation", "squelette", "ligament", "vertebre", "crane"],
    "Physiologie": ["physiologie", "homeostasie", "potentiel d'action", "regulation"],
    "Cardiologie": ["coeur", "cardiaque", "cardio", "ventricule", "oreillette", "infarctus", "arythmie", "valve", "aorte"],
    "Pneumologie": ["poumon", "pulmonaire", "respiratoire", "bronch", "alveole", "asthme", "bpco"],
    "Neurologie": ["neuro", "cerveau", "cerebral", "neurone", "moelle epiniere", "avc", "epilepsie", "nerf"],
    "Gastro-entérologie": ["digestif", "estomac", "intestin", "foie", "hepat", "colon", "pancrea", "oesophage"],
    "Néphrologie": ["rein", "renal", "nephro", "nephron", "glomerul", "urinaire", "dialyse"],
    "Endocrinologie": ["hormone", "endocrin", "thyroide", "diabete", "insuline", "hypophyse", "surrenale"],
    "Hématologie": ["sang", "hemato", "globule", "plaquette", "anemie", "coagulation", "leucemie"],
    "Immunologie": ["immun", "anticorps", "lymphocyte", "antigene", "vaccin", "allergie"],
    "Infectiologie": ["infection", "bacterie", "virus", "antibiotique", "septic", "parasite"],
    "Pharmacologie": ["pharmaco", "medicament", "posologie", "molecule", "effet indesirable", "pharmacocinetique"],
    "Biochimie": ["biochimie", "enzyme", "proteine", "metabolisme", "glucide", "lipide", "acide amine"],
    "Dermatologie": ["peau", "dermato", "cutane", "epiderme", "derme"],
    "Pédiatrie": ["enfant", "pediatr", "nourrisson", "nouveau-ne"],
    "Gynécologie-obstétrique": ["grossesse", "obstetri", "gyneco", "uterus", "ovaire", "accouchement"],
    "Psychiatrie": ["psychiatr", "depression", "anxiete", "schizophren", "psychose", "trouble bipolaire"],
    "Urgences": ["urgence", "reanimation", "choc", "arret cardiaque", "traumatisme"],
    "Santé publique": ["epidemiolog", "sante publique", "prevention", "incidence", "prevalence", "depistage"],
}

MAX_TAGS = 5
MAX_TAG_CHARS = 30


def _normalize(text: str) -> str:
    text = unicodedata.normalize("NFKD", text.lower())
    return "".join(c for c in text if not unicodedata.combining(c))


def suggest_tags(text: str, limit: int = 2) -> list[str]:
    """Jusqu'à ``limit`` spécialités dont les mots-clés reviennent le plus dans le texte."""
    sample = _normalize(text[:20000])
    scores = []
    for name, keywords in SPECIALTIES.items():
        score = sum(len(re.findall(re.escape(k), sample)) for k in keywords)
        if score >= 3:
            scores.append((score, name))
    scores.sort(key=lambda s: -s[0])
    return [name for _, name in scores[:limit]]


def clean_tags(raw) -> tuple[list[str] | None, str | None]:
    """Tags envoyés par l'app (spécialités de la liste ou libres). Renvoie (tags, erreur)."""
    if not isinstance(raw, list):
        return None, "Tags invalides"
    tags: list[str] = []
    for item in raw:
        tag = " ".join(str(item or "").split())
        if not tag:
            continue
        if len(tag) > MAX_TAG_CHARS:
            return None, f"Tag trop long ({MAX_TAG_CHARS} caractères maximum)"
        if tag.lower() not in (t.lower() for t in tags):
            tags.append(tag)
    if len(tags) > MAX_TAGS:
        return None, f"{MAX_TAGS} tags maximum par cours"
    return tags, None
