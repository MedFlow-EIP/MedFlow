#!/usr/bin/env bash
# =============================================================================
# MedFlow — Setup GitHub Project "Tech 5 - Solution Track"
# =============================================================================
# Prérequis :
#   1. gh CLI installé (https://cli.github.com)
#   2. gh auth login   (authentifie-toi sur ton compte GitHub, org MedFlow-EIP)
#   3. Lance ce script depuis n'importe où : ./setup-medflow-tech5-project.sh
#
# Ce script crée :
#   - 5 milestones (calées sur le calendrier de mentorat)
#   - 2 labels (objectif-1-communaute / objectif-2-usabilite)
#   - 25 issues (14 pour l'objectif 1, 11 pour l'objectif 2), préremplies
#     avec le contexte MedFlow (persona Emma, concurrents, canaux existants)
#   - Un GitHub Project (v2) "MedFlow - Tech 5" avec toutes les issues ajoutées
# =============================================================================

set -e

REPO="MedFlow-EIP/MedFlow"
ORG="MedFlow-EIP"

# Équipe (4 personnes). Renseigne les usernames GitHub pour activer
# l'assignation automatique — sinon laisse vide et assigne à la main.
# Arslan  : mobile (Expo / React Native)
# Grégoire: mobile (nouvelle version Flutter, en parallèle, non prioritaire Sept-Déc)
# Armod   : backend
# Axel    : frontend web
GH_ARSLAN=""
GH_GREGOIRE=""
GH_ARMOD=""
GH_AXEL=""

echo "==> Vérification de gh CLI et de l'authentification..."
gh auth status || { echo "Lance d'abord: gh auth login"; exit 1; }

echo "==> Création des milestones (idempotent, ne recrée pas si déjà existant)..."
create_milestone() {
  local title="$1" due="$2" desc="$3"
  if gh api repos/$REPO/milestones --jq ".[] | select(.title==\"$title\")" | grep -q .; then
    echo "  - '$title' existe déjà, skip"
  else
    gh api repos/$REPO/milestones -f title="$title" -f due_on="$due" -f description="$desc" > /dev/null
    echo "  - '$title' créé"
  fi
}
create_milestone "M1 - Cadrage (14 sept 2026)"        "2026-09-13T23:00:00Z" "Séance 1 : cadrage des objectifs de track"
create_milestone "M2 - Suivi 1 (12 oct 2026)"         "2026-10-11T23:00:00Z" "Séance 2 : suivi d'avancement"
create_milestone "M3 - Suivi 2 (16 nov 2026)"         "2026-11-15T23:00:00Z" "Séance 3 : suivi d'avancement"
create_milestone "M4 - Bilan (14 déc 2026)"           "2026-12-13T23:00:00Z" "Séance 4 : bilan sur les objectifs"
create_milestone "M5 - Soutenance Inside Track (jan 2027)" "2027-01-20T23:00:00Z" "Soutenance dédiée aux objectifs de track"

echo "==> Création des labels..."
gh label create "objectif-1-communaute" --repo "$REPO" --color "0E8A16" --description "Grow your community & put your product in its hands" --force
gh label create "objectif-2-usabilite"  --repo "$REPO" --color "1D76DB" --description "Measure your usability" --force
gh label create "roadmap-phase0"        --repo "$REPO" --color "5319E7" --description "Stabilisation & fondations" --force
gh label create "roadmap-phase1"        --repo "$REPO" --color "0052CC" --description "Expérience complète" --force
gh label create "roadmap-stretch"       --repo "$REPO" --color "FBCA04" --description "Phase 2 - uniquement si temps disponible" --force
gh label create "role-back"             --repo "$REPO" --color "B60205" --description "Armod" --force
gh label create "role-front"            --repo "$REPO" --color "5319E7" --description "Axel" --force
gh label create "role-mobile"           --repo "$REPO" --color "0E8A16" --description "Arslan / Grégoire" --force
gh label create "roadmap-flutter-v2"    --repo "$REPO" --color "C5DEF5" --description "Nouvelle version mobile Flutter (Grégoire) - hors sprint principal" --force

# Titres des milestones (gh issue create --milestone attend le TITRE, pas le numéro)
M1="M1 - Cadrage (14 sept 2026)"
M2="M2 - Suivi 1 (12 oct 2026)"
M3="M3 - Suivi 2 (16 nov 2026)"
M4="M4 - Bilan (14 déc 2026)"
M5="M5 - Soutenance Inside Track (jan 2027)"

create_issue() {
  local title="$1" body="$2" label="$3" milestone="$4" assignees="$5"
  local args=(--repo "$REPO" --title "$title" --body "$body" --label "$label" --milestone "$milestone")
  # Nettoie les virgules si un ou plusieurs GH_* sont restés vides
  local clean_assignees
  clean_assignees=$(echo "$assignees" | sed 's/,,*/,/g; s/^,//; s/,$//')
  if [ -n "$clean_assignees" ]; then
    args+=(--assignee "$clean_assignees")
  fi
  gh issue create "${args[@]}"
}

# =============================================================================
# OBJECTIF 1 — Grow your community and put your product in its hands
# =============================================================================

create_issue "Positioning: proposition de valeur en 1 phrase" \
"Rédiger la proposition de valeur MedFlow (ce que ça fait, pour qui, en quoi c'est différent).

Base de départ (issue du pitch deck) :
> MedFlow aide les étudiants en médecine à mémoriser plus efficacement leurs cours grâce à des flashcards générées par IA, des cas cliniques interactifs et une planification de révision basée sur les neurosciences (répétition espacée, rappel actif, consolidation par le sommeil).

À faire :
- [ ] Positionner face aux alternatives (ce que fait Emma aujourd'hui sans MedFlow)
- [ ] Analyser 3 concurrents comparables : Anki, Quizlet, Osmosis (déjà identifiés dans le pitch deck)
- [ ] Dire explicitement ce que MedFlow ne fait PAS" \
"objectif-1-communaute" "$M1"

create_issue "Test de compréhension - round 1 (10 personnes)" \
"Montrer la proposition de valeur brute (sans commentaire) à au moins 10 personnes de la cible (étudiants en médecine) et noter les reformulations correctes / incorrectes.

À faire :
- [ ] Recruter 10 personnes hors équipe
- [ ] Consigner les reformulations et incompréhensions
- [ ] Servira de base pour la reformulation du round 2" \
"objectif-1-communaute" "$M1"

create_issue "Canaux et ligne éditoriale" \
"Choisir et justifier 2 canaux principaux, définir la ligne éditoriale et le calendrier.

Canaux déjà créés (à documenter/justifier) :
- LinkedIn: https://www.linkedin.com/company/medflow-app/posts/?feedView=all
- Instagram: https://www.instagram.com/med_flowapp/
- ProductHunt (lancement): https://www.producthunt.com/products/medflow-3?launch=medflow-2

À faire :
- [ ] Justifier pourquoi LinkedIn + Instagram (là où est la cible : étudiants en médecine, écoles)
- [ ] Définir la ligne éditoriale (ton, fréquence, types de contenus)
- [ ] Assigner les rôles dans l'équipe
- [ ] Construire le calendrier éditorial Sept-Déc" \
"objectif-1-communaute" "$M1"

create_issue "Identité et landing page" \
"Mettre en ligne la landing page (offre, cible, ce que MedFlow permet de faire, CTA sign-up/contact) + identité visuelle cohérente sur tous les supports.

À faire :
- [ ] Landing page en ligne
- [ ] Vérifier la cohérence landing page / posts / discours oral
- [ ] Mettre en place le tracking de conversion (visiteurs -> sign-up/contact)" \
"objectif-1-communaute" "$M2"

create_issue "Test de compréhension - round 2 (10 nouvelles personnes)" \
"Reformuler le message à partir des incompréhensions du round 1, puis retester avec 10 nouvelles personnes. L'écart entre les deux rounds = preuve du travail.

À faire :
- [ ] Reformuler le message
- [ ] Retest avec 10 personnes différentes
- [ ] Comparer les 2 wordings tête-à-tête si possible" \
"objectif-1-communaute" "$M2"

create_issue "Recrutement des beta testeurs - stratégie" \
"Écrire la stratégie de recrutement : qui, sur quels canaux, avec quel message, en échange de quoi.

Contexte utile : persona principal = Emma, 22 ans, 4e année de médecine, Lyon (voir pitch deck pour les détails de comportement/objectifs).

À faire :
- [ ] Définir le message de recrutement par canal
- [ ] Définir l'incentive (accès premium gratuit, early access...)" \
"objectif-1-communaute" "$M2"

create_issue "Publications réseaux (10 posts minimum, Sept-Déc)" \
"Publier au moins 10 posts originaux entre septembre et décembre sur LinkedIn/Instagram, et suivre les indicateurs (reach, interactions, croissance, provenance des nouveaux abonnés).

À faire :
- [ ] Archive des posts avec dates
- [ ] Suivi des statistiques par canal (mensuel)" \
"objectif-1-communaute" "$M4"

create_issue "Panel de 20 beta testeurs qualifiés" \
"Recruter, onboarder et qualifier au moins 20 beta testeurs actifs hors équipe (profil, critères cible, canal de recrutement, date d'arrivée). Un testeur hors cible ne compte pas.

À faire :
- [ ] Liste nominative avec qualification
- [ ] Compter combien viennent de la communauté propre (mesure directe de l'efficacité de la communication)" \
"objectif-1-communaute" "$M3"

create_issue "Protocole de beta test écrit" \
"Rédiger le protocole de test (objectifs, scénarios, cible, support, ce qu'on cherche à observer) et les hypothèses critiques (utilité, valeur perçue, usage répété) avec leurs seuils de validation, écrites AVANT le test." \
"objectif-1-communaute" "$M3"

create_issue "Cycle de beta test 1 (novembre)" \
"Mettre le produit entre les mains des 20 testeurs sur des scénarios représentatifs. Collecter via plusieurs méthodes (observation, interviews, questionnaires, données d'usage).

À faire :
- [ ] Suivi individuel (qui a testé, quand, feedback donné)
- [ ] Recontacter au moins 5 personnes qui ont décroché
- [ ] Organiser le feedback par thème, prioriser par sévérité/fréquence" \
"objectif-1-communaute" "$M3"

create_issue "Cycle de beta test 2 (décembre) - version modifiée" \
"Reproduire le protocole exact avec une version modifiée du produit (suite aux changements du cycle 1) et des testeurs comparables. Comparer v1/v2." \
"objectif-1-communaute" "$M4"

create_issue "Conversion landing page - suivi et itération" \
"Suivre en continu le taux de conversion de la landing page et faire au moins 1 changement basé sur ces données, avec le chiffre avant/après." \
"objectif-1-communaute" "$M4"

create_issue "Promesse vs expérience réelle" \
"Comparer ce que promet la landing page à ce que les testeurs disent avoir vécu.

À faire :
- [ ] Demander à au moins 10 testeurs : 'comment décrirais-tu MedFlow à quelqu'un d'autre ?'
- [ ] Décider : corriger le produit pour tenir la promesse, ou corriger la promesse
- [ ] Garder une preuve du changement effectué" \
"objectif-1-communaute" "$M4"

create_issue "Décision produit et roadmap (bilan objectif 1)" \
"Synthétiser : ce qui est validé / invalidé / encore incertain, ce qui a été appris, et l'intégrer à la roadmap produit." \
"objectif-1-communaute" "$M4"

# =============================================================================
# OBJECTIF 2 — Measure your usability
# =============================================================================

create_issue "Définir 3-5 tâches critiques + protocole de mesure" \
"Identifier 3 à 5 tâches critiques (ex: importer un cours PDF et obtenir des flashcards, lancer un cas clinique, consulter le dashboard de progression). Rédiger un protocole réutilisable à l'identique en décembre." \
"objectif-2-usabilite" "$M1"

create_issue "Mesure de départ (baseline) - AVANT toute modification produit" \
"⚠️ Ne peut pas être fait en retard. Sessions d'observation individuelles avec au moins 5 personnes de la cible, hors équipe, n'ayant jamais utilisé MedFlow.

À faire :
- [ ] Pour chaque tâche/participant : réussite seul(e) ?, temps, erreurs, interventions nécessaires
- [ ] Questionnaire de satisfaction standard après la session" \
"objectif-2-usabilite" "$M2"

create_issue "Mesure du premier contact (first-use)" \
"Mesurer le temps jusqu'à la première action réussie, ce qu'un utilisateur doit comprendre seul dans les premières minutes, et où les gens abandonnent au premier usage.

À faire :
- [ ] Au moins 1 correctif sur le parcours d'entrée, avec le temps mesuré avant/après" \
"objectif-2-usabilite" "$M2"

create_issue "Croiser les 3 sources de friction" \
"Croiser observation (sessions), données d'usage produit (drop-off, écrans à rebond) et verbatims du beta test (objectif 1). Une friction confirmée par au moins 2 sources est prioritaire." \
"objectif-2-usabilite" "$M3"

create_issue "Carte des frictions et priorisation" \
"Construire la carte des frictions (effet en chiffres : temps perdu, taux d'échec, abandon) et prioriser en 2 catégories : quick wins (fort effet, faible coût) vs redesigns profonds. Sélectionner au moins 2 problèmes difficiles pour redesign, avec l'objectif chiffré visé pour chacun." \
"objectif-2-usabilite" "$M3"

create_issue "Audit d'accessibilité (WCAG AA)" \
"Auditer les écrans principaux contre les critères WCAG niveau AA (contraste, taille de texte, navigation clavier, texte alternatif, labels de formulaire, info jamais portée uniquement par la couleur).

À faire :
- [ ] Lister les non-conformités par sévérité
- [ ] Test sous contrainte (clavier seul ou filtre daltonisme)" \
"objectif-2-usabilite" "$M3"

create_issue "Ship 8 quick wins" \
"Identifier et livrer au moins 8 correctifs rapides, chacun rattaché à une friction observée. Tenir un journal (problème, changement, temps passé, observation source)." \
"objectif-2-usabilite" "$M3"

create_issue "Redesign des 2 problèmes difficiles" \
"Retravailler en profondeur les écrans/flows sélectionnés (wireframes, maquettes interactives). Un changement isolé par problème difficile. Tester la maquette avec 3 personnes avant de développer, puis livrer réellement en version live." \
"objectif-2-usabilite" "$M4"

create_issue "Correctifs d'accessibilité livrés" \
"Livrer au moins 2 correctifs d'accessibilité réels (avec ce qu'ils changent et pour qui), et lister ce qui reste inaccessible avec l'effort estimé pour corriger." \
"objectif-2-usabilite" "$M4"

create_issue "Mesure finale (identique à la baseline)" \
"Reproduire exactement le même protocole qu'en octobre : mêmes tâches, mêmes instructions, avec 5 personnes de profil comparable n'ayant jamais vu le produit.

À faire :
- [ ] Tableau avant/après par tâche (taux de réussite, temps moyen, erreurs, interventions, satisfaction)
- [ ] Présenter au moins 1 changement qui n'a PAS produit l'effet attendu, avec analyse
- [ ] Documenter les limites (5 personnes/round, 2 mois d'écart, panels différents)" \
"objectif-2-usabilite" "$M4"

create_issue "Documentation d'interface et liste priorisée du reste à améliorer" \
"Mettre à jour la documentation d'interface (composants, règles de nommage, logique d'interaction) et produire la liste priorisée de ce qui reste à améliorer." \
"objectif-2-usabilite" "$M4"

# =============================================================================
# ROADMAP TECHNIQUE — uniquement ce qui est réaliste sur Sept-Déc 2026
# (solo/petite équipe, VM d2-2 : 1 vCPU / 2 Go RAM, en parallèle des objectifs
# de track ci-dessus. Phases 2 (partiel), 3, 4-5 de la roadmap complète sont
# volontairement exclues : trop lourdes en temps/compute pour cette fenêtre.)
# =============================================================================

create_issue "Corrections BTP critiques" \
"Corriger les bugs bloquants remontés (BTP = bugs très prioritaires), tous périmètres confondus. Prérequis avant de mettre le produit dans les mains des beta testeurs (objectif 1)." \
"roadmap-phase0" "$M1" "$GH_ARMOD,$GH_AXEL,$GH_ARSLAN"

create_issue "Upload mobile (caméra)" \
"Permettre l'upload de cours en photographiant directement les pages depuis l'app mobile (Expo), plutôt qu'un simple import de fichier." \
"roadmap-phase0,role-mobile" "$M1" "$GH_ARSLAN"

create_issue "AI Chat fonctionnel de bout en bout" \
"Stabiliser l'écran AI Chat (mobile + web) pour un usage fiable en beta test : gestion des erreurs, latence acceptable, réponses cohérentes. Nécessite back (endpoint) + mobile/front (UI)." \
"roadmap-phase0,role-back" "$M1" "$GH_ARMOD,$GH_ARSLAN"

create_issue "Tutoriel interactif (onboarding)" \
"Ajouter un tutoriel guidé au premier lancement, mobile et web. Sert directement l'objectif usabilité : réduit le 'time to first successful action' mesuré en octobre." \
"roadmap-phase0,role-front,role-mobile" "$M1" "$GH_AXEL,$GH_ARSLAN"

create_issue "Spaced repetition réelle (algorithme SM-2)" \
"Implémenter un vrai algorithme de répétition espacée (SM-2) côté backend pour la planification des révisions, au lieu d'un système statique. Différenciateur produit annoncé dans le pitch deck face à Anki/Quizlet." \
"roadmap-phase1,role-back" "$M2" "$GH_ARMOD"

create_issue "Révision mobile optimisée" \
"Optimiser l'écran de révision (flashcards/quiz) sur mobile : fluidité, gestes, temps de chargement, consommation de l'API SM-2 une fois prête côté back." \
"roadmap-phase1,role-mobile" "$M2" "$GH_ARSLAN"

create_issue "Suppression / archivage de cours" \
"Permettre à l'utilisateur de supprimer ou archiver un cours importé. Route backend + UI web." \
"roadmap-phase1,role-back,role-front" "$M2" "$GH_ARMOD,$GH_AXEL"

create_issue "UX polish & animations" \
"Polish visuel et micro-animations sur les parcours principaux (web + mobile). À traiter après la carte des frictions (objectif usabilité) pour cibler les bons écrans plutôt que polir au hasard." \
"roadmap-phase1,role-front,role-mobile" "$M3" "$GH_AXEL,$GH_ARSLAN"

create_issue "[Stretch] Système XP & badges" \
"Optionnel — à ne traiter que si les objectifs de track et la Phase 0/1 sont terminés en avance. Système de points d'expérience et badges de progression (back + front + mobile)." \
"roadmap-stretch" "$M4" "$GH_ARMOD,$GH_AXEL,$GH_ARSLAN"

create_issue "[Stretch] Streaks réels (persistence)" \
"Optionnel — à ne traiter que si le temps le permet. Suivi de séries de jours consécutifs de révision, avec persistence réelle côté backend (pas juste un compteur front)." \
"roadmap-stretch,role-back" "$M4" "$GH_ARMOD"

create_issue "[Exploration] Version mobile Flutter (Grégoire)" \
"Piste distincte, en parallèle du reste : étude de faisabilité / prototype d'une nouvelle version mobile en Flutter, portée par Grégoire. Ne doit pas mordre sur le temps de Sept-Déc consacré aux objectifs de track ni à la stabilisation Expo existante — à traiter en tâche de fond, sans dépendance avec les autres issues." \
"roadmap-flutter-v2,role-mobile" "$M4" "$GH_GREGOIRE"

# =============================================================================
# GitHub Project (v2)
# =============================================================================

echo "==> Création du GitHub Project..."
PROJECT_URL=$(gh project create --owner "$ORG" --title "MedFlow - Tech 5 Solution Track" --format json --jq '.url')
echo "Project créé : $PROJECT_URL"

echo "==> Ajout de toutes les issues au Project..."
for issue_url in $(gh issue list --repo "$REPO" --state open --json url --jq '.[].url'); do
  gh project item-add "$(echo $PROJECT_URL | grep -oP '(?<=projects/)\d+')" --owner "$ORG" --url "$issue_url" 2>/dev/null || true
done

echo ""
echo "✅ Terminé. Project : $PROJECT_URL"
echo "   25 issues de track (14 objectif 1 + 11 objectif 2) + 11 issues roadmap technique (dont l'exploration Flutter), 5 milestones, 7 labels."
echo "   Pense à renseigner GH_ARSLAN / GH_GREGOIRE / GH_ARMOD / GH_AXEL en haut du script si tu veux relancer avec l'assignation auto."