# V2 Mobile — Synthèse produit & UX

## 1. Contexte général

La V2 (`main`) réintroduit une architecture **full-stack complète (backend + web + mobile)**.

## 2. Ce que la V2 (`main`) ajoute par rapport à la V1

### 2.1 Backend complet réintégré

La V2 remet en place une infrastructure backend structurée :

- `app.py`, `config.py`, `database.py`
- Middleware auth : `backend/middleware/auth.py`
- Routes API :
  - `account.py`
  - `courses.py`
  - `health.py`
  - `paths.py`
  - `sessions.py`
- Migrations : `backend/migrations/...`
- Services IA :
  - `ollama_provider.py`
  - `vertexai_provider.py`
- Suite de tests :
  - tests unitaires
  - tests d’intégration
  - mocks API

Objectif : rendre le produit **exploitable en production réelle avec backend stable**

### 2.2 Frontend web réintégré

- `App.jsx`
- `Navbar.jsx`
- `Dashboard.jsx`
- `CoursePath.jsx`
- `ExamenBlanc.jsx`
- utils :
  - `examQuestions.js`
  - `medicalSubjects.js`
- styles globaux web

Objectif : retour d’un écosystème **multi-plateforme (web + mobile)**

### 2.3 Mobile (V2 vs V1)

V2 conserve les écrans principaux :

- `AppNavigator.tsx`
- `LessonScreen.tsx`
- `PathScreen.tsx`
- `DashboardScreen.tsx`
- `HomeScreen.tsx`
- `AccountScreen.tsx`
- `AIChatScreen.tsx`

Mais reste plus conservateur sur les modules pédagogiques.

### 2.4 Configuration et infrastructure

- mise à jour `package.json` / `package-lock.json`
- modifications `.gitignore`
- ajustements API (`services/api.ts`)
- ajout Docker / CI / workflows
- configuration réseau backend/mobile

## 3. Ce qui a été retiré ou simplifié dans V2

### 3.1 Simplification du parcours d’apprentissage

- Moins de micro-interactions pédagogiques
- Moins de gamification dans les leçons
- Parcours plus “classique” (flashcards / quiz standards)

## 4. Améliorations apportées en V2

### 4.1 Stabilité système

- Backend complet + tests
- API structurée et maintenue
- Architecture scalable

### 4.2 Cohérence full-stack

- Web + mobile + backend réunis
- meilleure séparation des responsabilités
- CI/CD et Docker intégrés

### 4.3 Maintenabilité

- codebase plus standardisée
- meilleure testabilité backend
- structure projet plus claire pour production

## 5. Synthèse UX (User tests & iterations)

### 5.1 Tests utilisateurs (prototype V1 - enhanced-lessons)

**Test 1 : compréhension des steps interactifs**
- Résultat : forte compréhension des “SwipeCards”
- Problème : confusion sur les “SpeedChallenge” (temps trop court)

**Test 2 : engagement sur VisualDiscovery**
- Résultat : engagement élevé
- Feedback : “plus intuitif que les quiz classiques”

**Test 3 : navigation entre steps**
- Problème : manque de repères de progression
- Suggestion : ajouter timeline ou step indicator

**Test 4 : charge cognitive**
- Problème : trop de types de steps différents au début
- UX friction sur onboarding

**Test 5 : rétention après session**
- Résultat : bonne rétention sur sessions courtes
- Limite : manque de progression visible long terme

### 5.2 Feedback utilisateurs collectés

- “Les leçons sont plus fun mais un peu confuses au début”
- “J’aime les interactions swipe et quiz rapides”
- “Je ne sais pas toujours où j’en suis dans la leçon”
- “Le format est plus motivant que des flashcards classiques”

### 5.3 Itérations majeures (V1)

#### Itération 1 : introduction des steps interactifs
- ajout Swipe / Speed / Visual / QuickQuiz
- objectif : remplacer flashcards passives

#### Itération 2 : optimisation du flow de leçon
- ajout progression bar
- meilleure gestion de completion
- simplification de certains quiz

## 6. Synthèse UX globale

### Problèmes identifiés

- complexité cognitive élevée au début
- manque de guidance utilisateur
- fragmentation des formats de leçon
- difficulté à standardiser les analytics UX

### Priorités UX

1. rendre les steps plus cohérents entre eux
2. améliorer onboarding des leçons
3. renforcer feedback utilisateur en temps réel
4. ajouter progression claire multi-leçons
5. stabiliser UX avant ajout de nouveaux modules

### Trade-offs V1 vs V2

| Aspect | V1 (enhanced-lessons) | V2 (main) |
|------|------|------|
| UX innovation | Très élevée | Moyenne |
| Stabilité backend | Faible | Élevée |
| Scalabilité | Moyenne | Élevée |
| Engagement utilisateur | Élevé | Moyen |
| Complexité code | Élevée côté mobile | Répartie full-stack |

## 7. Backlog UX (prochaines améliorations)

### Priorité haute

- unifier les steps en un système standardisé
- ajouter indicator de progression global
- améliorer onboarding leçon
- simplifier le nombre de formats de quiz

### Priorité moyenne

- analytics UX (temps par step, drop-off)
- adaptation difficulté dynamique
- mode “révision intelligente”

### Priorité basse

- personnalisation UI par utilisateur
- animations avancées entre steps
- gamification avancée (streaks, badges)

## 8. Conclusion

- `enhanced-lessons` = V1 UX expérimentale et très interactive
- `main` = V2 full-stack stable et industrialisable

La direction actuelle oppose :
- **innovation UX mobile**
vs
- **architecture produit scalable et maintenable**