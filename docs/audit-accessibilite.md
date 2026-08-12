# MedFlow Audit d'accessibilité (mobile)

## Constat de départ
Recherche exhaustive sur tout `mobile/components/` : **0 occurrence** de `accessibilityLabel`, `accessibilityRole` ou `accessibilityHint` dans tout le code avant cet audit. Aucun travail d'accessibilité n'avait été fait.

## Méthode
1. Recherche systématique des `TouchableOpacity`/`Pressable` ne contenant qu'une icône (`Ionicons`) sans texte associé ce sont les cas les plus graves : un lecteur d'écran (VoiceOver/TalkBack) ne peut absolument pas annoncer ce que fait le bouton.
2. Recherche ciblée sur le motif "bouton retour" (`arrow-back`/`chevron-back`), répété sur presque tous les écrans de l'app.
3. Vérification manuelle de chaque candidat trouvé (plusieurs faux positifs écartés : code commenté, icônes purement décoratives à côté d'un texte déjà accessible).

## Non-conformités trouvées, par sévérité

### Sévérité haute bouton icône-seule, zéro nom accessible
Ces boutons étaient annoncés comme juste "bouton" par un lecteur d'écran, sans aucune indication de leur fonction.

| Écran | Bouton | Statut |
|---|---|---|
| UploadCourseScreen | Retour | ✅ Corrigé |
| LeaderboardScreen | Retour | ✅ Corrigé |
| FriendsScreen | Retour | ✅ Corrigé |
| SettingsScreen | Retour | ✅ Corrigé |
| ForgotPasswordScreen | Retour | ✅ Corrigé |
| ProgressScreen | Retour | ✅ Corrigé |
| PathScreen | Retour | ✅ Corrigé |
| CourseDetail | Retour | ✅ Corrigé |
| TutorialScreen | Étape précédente | ✅ Corrigé |
| AppNavigator (modal "Ajouter") | Fermer (X) | ✅ Corrigé |

### Sévérité moyenne rôle/état sémantique manquant
Les 5 onglets de la barre de navigation principale ont un texte visible (donc lisibles), mais sans `accessibilityRole="tab"` ni `accessibilityState`, un lecteur d'écran ne les annonce pas comme des onglets et n'indique pas lequel est actuellement sélectionné.

| Élément | Statut |
|---|---|
| Onglet Accueil | ✅ Corrigé |
| Onglet Assistant IA | ✅ Corrigé |
| Bouton central Ajouter | ✅ Corrigé |
| Onglet Dashboard | ✅ Corrigé |
| Onglet Compte | ✅ Corrigé |

**Total corrigé cette passe : 15**.

## Ce qui reste à faire (liste priorisée)

Cette passe couvrait spécifiquement les boutons icône-seule et la navigation principale la plus haute sévérité et le plus haut trafic. Reste à auditer :

1. **Contraste des couleurs** (WCAG AA = ratio 4.5:1 minimum pour le texte normal) pas vérifié dans cette passe, nécessite l'Accessibility Inspector d'Expo ou un outil de contraste sur les couleurs réelles du thème (`theme/colors.ts`), en particulier en mode sombre.
2. **Labels de formulaires** champs de saisie (email/mot de passe sur les écrans d'auth, recherche d'amis) à vérifier un par un pour `accessibilityLabel` sur les `TextInput`.
3. **Textes alternatifs sur les images** avatars, captures dans les explications de leçons (`ExplanationStep`, `VisualDiscoveryStep`) à vérifier.
4. **Navigation clavier** non applicable de la même façon sur mobile qu'sur web, mais à tester quand même avec un lecteur d'écran activé (VoiceOver/TalkBack) en navigation gestuelle.
5. **Information portée par la couleur seule** à vérifier notamment sur les médailles du classement (or/argent/bronze) et les badges de ligue, qui utilisent principalement la couleur pour se distinguer.

## Test sous contrainte (à faire)

Reste à faire, nécessite un vrai appareil : parcourir la tâche "terminer une leçon" avec VoiceOver (iOS, Réglages → Accessibilité → VoiceOver) ou TalkBack (Android, Réglages → Accessibilité → TalkBack) activé, sans regarder l'écran. Noter chaque endroit où on ne sait pas ce qu'on touche ou où le focus se perd.

Alternative rapide : un filtre daltonisme (Réglages → Accessibilité → Filtres d'affichage, natif iOS/Android) pendant la même tâche, pour vérifier le point 5 ci-dessus.