# Fonctionnalités principales de MedFlow

## Sommaire

1. [Upload de cours](#upload-de-cours)
2. [Génération automatique](#génération-automatique)
3. [Révision](#révision)
4. [Mobile](#mobile)
5. [Statistiques](#statistiques)
6. [IA et pédagogie](#ia-et-pédagogie)

---

## Upload de cours

- Import de fichiers **PDF** depuis l’interface.
- Extraction automatique du texte via le backend Flask.
- Création d’un nouveau cours dans le dashboard.
- Les données sont stockées localement dans `backend/uploads` et `backend/data`.

---

## Génération automatique

- **Flashcards** générées automatiquement à partir du contenu du PDF.
- **Quiz QCM** avec correction immédiate.
- **Résumé HTML** structuré et lisible.
- Chaque PDF devient un cours identifié par un titre et une description.

---

## Révision

Deux modes de révision :

1. **Globale** – mélange de flashcards de tous les cours.
2. **Spécifique** – révision ciblée sur un seul cours.

Fonctionnalités :

- Flashcards interactives.
- Quiz avec feedback en temps réel.
- Score final de session.
- Navigation par cours et progression.

---

## Mobile

La version mobile inclut :

- écran **Home** et **Dashboard**
- écran **Course Detail**
- écran **Upload Course**
- écran **Account / Settings**
- écran **AI Chat**
- parcours de leçon modulaire

---

## Statistiques

- Nombre de cours ajoutés.
- Nombre total de flashcards.
- Nombre de sessions de révision terminées.
- Statistiques de performance cumulées par utilisateur.

---

## IA et pédagogie

MedFlow repose sur des principes d’apprentissage connus :

- **Répétition espacée**
- **Active Recall**
- **Feedback immédiat**
- **Apprentissage par quiz et flashcards**

L’IA est utilisée pour transformer des PDF médicaux en contenus pédagogiques exploitables.
