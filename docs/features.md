# Fonctionnalités principales de MedFlow

## Sommaire

1. [Navigation](#navigation)
2. [Import de cours](#import-de-cours)
3. [Contenu généré](#contenu-généré)
4. [Révision](#révision)
5. [Cas cliniques](#cas-cliniques)
6. [Assistant IA](#assistant-ia)
7. [Motivation et social](#motivation-et-social)
8. [Compte, confiance et retours](#compte-confiance-et-retours)
9. [IA et pédagogie](#ia-et-pédagogie)

---

## Navigation

| Onglet | Contenu |
|---|---|
| **Accueil** | Série, quêtes du jour et de la semaine, cas cliniques, parcours d'apprentissage, consommation de l'IA sur 24 h |
| **Stats** | Chiffres clés, « Réviser maintenant », flashcards, cartes difficiles et maîtrisées, examen blanc, prochain examen, semaine à réviser, mes cours et mes documents |
| **+** (centre) | Importer un cours, créer un cas clinique, lancer un examen blanc, ajouter un examen |
| **IA Chat** | Assistant, historique des conversations |
| **Compte** | Profil, classement, amis, badges, activité, avis, contact, confidentialité, paramètres |

Une refonte (révision du jour sur l'accueil, onglet « Stats » renommé « Cours ») est prête dans la PR #153, à livrer après la mesure de départ de la track.

---

## Import de cours

- PDF (20 Mo max), photo (appareil ou galerie), Word, PowerPoint ou scan ; plusieurs documents par cours.
- Les photos, scans et schémas des PDF sont lus par l'IA : les figures deviennent du texte dans le cours.
- La génération se fait en arrière-plan : on peut naviguer, un bandeau (app ouverte) ou une notification (app fermée) prévient quand le cours est prêt.
- Un document déjà importé est détecté : l'app propose d'ouvrir le cours existant.
- Les documents d'origine restent consultables (« Mes documents »).
- Cours d'exemple (cycle cardiaque) pour essayer sans rien importer.

---

## Contenu généré

- **Résumé** structuré.
- **Flashcards** (question / réponse).
- **Quiz QCM** avec explication de la bonne réponse, difficulté au choix (facile, normal, difficile).
- **Tags de spécialité** suggérés à l'import (cardiologie, pneumologie…), modifiables.
- **Fiche de révision en PDF** à partager ou imprimer.
- Le cours se modifie à la main (titre, flashcards, tags).

---

## Révision

- **Répétition espacée SM-2** pour les questions et pour les flashcards : chaque carte revient juste avant d'être oubliée.
- **Prévision de la semaine** : nombre de cartes par jour et par cours, entraînement libre sur un jour à venir.
- **Cartes difficiles** (ratées plusieurs fois de suite) et **cartes maîtrisées**.
- **Mode libre** : réviser autant qu'on veut sans toucher au planning.
- **Explique-moi cette carte** : l'assistant explique la bonne réponse avec le cours en contexte.
- **Révision hors ligne** : cours et cartes en cache, réponses envoyées au retour du réseau.
- **Calendrier d'examens** : compte à rebours, rappels, les cours de l'examen passent en priorité.
- **Examen blanc** chronométré, noté sur 20, sur plusieurs cours.
- Rappels de révision et de série à l'heure choisie.

---

## Cas cliniques

- Un patient généré à partir d'un cours ou d'un sujet, avec 4 décisions (hypothèse, examen, interprétation, traitement).
- Un retour sur chaque choix, puis un débriefing des points clés.
- Préparation en arrière-plan, avec une alerte quand le cas est prêt.

---

## Assistant IA

- Garde le fil de la conversation ; titres de conversation résumés par l'IA ; historique synchronisé entre appareils.
- Connaît les cours de l'étudiant (liste, résumé du dernier cours ou du cours cité, questions du cours).
- Accepte images et PDF en pièce jointe, et la dictée vocale.
- Dessine des schémas (SVG nettoyés avant affichage) et des tableaux.
- « Créer des flashcards » depuis une réponse de cours, à ranger dans un cours.
- Lecture vocale des réponses.
- Réservé à la médecine et à la santé ; tutoie l'étudiant.

---

## Motivation et social

- XP, badges, ligues et classement.
- Série de jours et gel de série (protection d'une journée manquée).
- Quêtes du jour et de la semaine.
- Amis, demandes d'ami et défis sur un cours (mêmes questions, scores comparés).
- Calendrier d'activité façon GitHub.
- Parcours d'apprentissage (leçons interactives : explications, cartes, quiz visuel, défi chronométré).

---

## Compte, confiance et retours

- Connexion par email ou Google (Android), vérification de l'email.
- Export des données et suppression du compte.
- Thème clair / sombre / système ; accessibilité (lecteur d'écran, contraste élevé, taille du texte système).
- « Signaler une erreur » sous les réponses du chat et les questions de révision.
- « Donner mon avis » (formulaire des testeurs).
- Page « Confidentialité et avertissement » : contenu généré par IA, pas d'avis médical, données gardées, traitement par Vertex AI.
- Consommation de l'IA sur 24 h (chat, imports, cas cliniques) affichée sur l'accueil.
- Alerte quand une nouvelle version de l'APK est disponible.

---

## IA et pédagogie

MedFlow repose sur des principes d'apprentissage connus :

- **Répétition espacée**
- **Active Recall**
- **Feedback immédiat**
- **Apprentissage par quiz, flashcards et cas cliniques**

L'IA transforme les cours de l'étudiant en contenus pédagogiques ; elle peut se tromper, d'où le signalement d'erreur et l'avertissement médical.
