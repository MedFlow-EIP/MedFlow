# MedFlow : audit d'accessibilité outillé (WCAG 2.1 AA)

Généré le 2026-10-28 par `mobile/scripts/a11y-audit.js` (à relancer à l'identique pour la mesure de décembre).

## Résumé

| Contrôle | Critère WCAG | Non-conformités | Sévérité |
| --- | --- | --- | --- |
| Bouton sans nom pour le lecteur d'écran | 4.1.2 Nom, rôle, valeur | 1 | Haute |
| Contraste insuffisant | 1.4.3 / 1.4.11 Contraste | 4 sur 64 paires | Haute si texte, moyenne si icône |
| Interrupteur sans libellé | 4.1.2 Nom, rôle, valeur | 0 | Haute |
| Élément tactile sans rôle annoncé | 4.1.2 Nom, rôle, valeur | 18 | Moyenne |
| Champ de saisie sans libellé | 3.3.2 Étiquettes | 0 | Moyenne |
| Image sans description ni marquée décorative | 1.1.1 Contenu non textuel | 0 | Moyenne |
| Texte de moins de 12 px | 1.4.4 Redimensionnement (lisibilité) | 10 | Basse |

## 1. Contrastes des couleurs

Seuils : 4,5:1 pour du texte, 3:1 pour une icône ou un élément graphique.

| Thème | Usage | Couleurs | Rapport | Seuil | Résultat |
| --- | --- | --- | --- | --- | --- |
| Clair | Texte principal | `textPrimary` sur `background` | 16.98:1 | 4.5:1 | Conforme |
| Clair | Texte principal sur carte | `textPrimary` sur `surface` | 17.74:1 | 4.5:1 | Conforme |
| Clair | Texte secondaire | `textSecondary` sur `background` | 4.63:1 | 4.5:1 | Conforme |
| Clair | Texte secondaire sur carte | `textSecondary` sur `surface` | 4.83:1 | 4.5:1 | Conforme |
| Clair | Texte secondaire sur fond gris | `textSecondary` sur `surfaceAlt` | 4.39:1 | 4.5:1 | **Non conforme** |
| Clair | Lien, bouton secondaire | `primaryText` sur `surface` | 6.70:1 | 4.5:1 | Conforme |
| Clair | Puce bleue (flashcards, examen) | `primaryText` sur `tintPrimary` | 6.16:1 | 4.5:1 | Conforme |
| Clair | Texte des boutons principaux | `onAction` sur `action` | 5.17:1 | 4.5:1 | Conforme |
| Clair | Message de réussite | `successText` sur `tintSuccess` | 4.79:1 | 4.5:1 | Conforme |
| Clair | Avertissement, cartes difficiles | `warningText` sur `tintWarning` | 4.65:1 | 4.5:1 | Conforme |
| Clair | Compteur IA presque épuisé | `warningText` sur `surface` | 5.18:1 | 4.5:1 | Conforme |
| Clair | Message d'erreur | `dangerText` sur `tintDanger` | 5.30:1 | 4.5:1 | Conforme |
| Clair | Icône discrète | `muted` sur `surface` | 3.05:1 | 3:1 | Conforme |
| Clair | Icône de suppression | `danger` sur `surface` | 3.76:1 | 3:1 | Conforme |
| Clair | Barre de progression sur sa piste | `primary` sur `border` | 2.97:1 | 3:1 | **Non conforme** |
| Clair | Icône des onglets inactifs | `textSecondary` sur `surface` | 4.83:1 | 3:1 | Conforme |
| Sombre | Texte principal | `textPrimary` sur `background` | 16.25:1 | 4.5:1 | Conforme |
| Sombre | Texte principal sur carte | `textPrimary` sur `surface` | 14.94:1 | 4.5:1 | Conforme |
| Sombre | Texte secondaire | `textSecondary` sur `background` | 7.04:1 | 4.5:1 | Conforme |
| Sombre | Texte secondaire sur carte | `textSecondary` sur `surface` | 6.48:1 | 4.5:1 | Conforme |
| Sombre | Texte secondaire sur fond gris | `textSecondary` sur `surfaceAlt` | 5.63:1 | 4.5:1 | Conforme |
| Sombre | Lien, bouton secondaire | `primaryText` sur `surface` | 9.12:1 | 4.5:1 | Conforme |
| Sombre | Puce bleue (flashcards, examen) | `primaryText` sur `tintPrimary` | 8.11:1 | 4.5:1 | Conforme |
| Sombre | Texte des boutons principaux | `onAction` sur `action` | 7.03:1 | 4.5:1 | Conforme |
| Sombre | Message de réussite | `successText` sur `tintSuccess` | 10.08:1 | 4.5:1 | Conforme |
| Sombre | Avertissement, cartes difficiles | `warningText` sur `tintWarning` | 10.58:1 | 4.5:1 | Conforme |
| Sombre | Compteur IA presque épuisé | `warningText` sur `surface` | 11.40:1 | 4.5:1 | Conforme |
| Sombre | Message d'erreur | `dangerText` sur `tintDanger` | 8.71:1 | 4.5:1 | Conforme |
| Sombre | Icône discrète | `muted` sur `surface` | 3.04:1 | 3:1 | Conforme |
| Sombre | Icône de suppression | `danger` sur `surface` | 5.94:1 | 3:1 | Conforme |
| Sombre | Barre de progression sur sa piste | `primary` sur `border` | 4.71:1 | 3:1 | Conforme |
| Sombre | Icône des onglets inactifs | `textSecondary` sur `surface` | 6.48:1 | 3:1 | Conforme |
| Clair, contraste élevé | Texte principal | `textPrimary` sur `background` | 21.00:1 | 4.5:1 | Conforme |
| Clair, contraste élevé | Texte principal sur carte | `textPrimary` sur `surface` | 21.00:1 | 4.5:1 | Conforme |
| Clair, contraste élevé | Texte secondaire | `textSecondary` sur `background` | 14.68:1 | 4.5:1 | Conforme |
| Clair, contraste élevé | Texte secondaire sur carte | `textSecondary` sur `surface` | 14.68:1 | 4.5:1 | Conforme |
| Clair, contraste élevé | Texte secondaire sur fond gris | `textSecondary` sur `surfaceAlt` | 13.34:1 | 4.5:1 | Conforme |
| Clair, contraste élevé | Lien, bouton secondaire | `primaryText` sur `surface` | 10.36:1 | 4.5:1 | Conforme |
| Clair, contraste élevé | Puce bleue (flashcards, examen) | `primaryText` sur `tintPrimary` | 9.52:1 | 4.5:1 | Conforme |
| Clair, contraste élevé | Texte des boutons principaux | `onAction` sur `action` | 6.70:1 | 4.5:1 | Conforme |
| Clair, contraste élevé | Message de réussite | `successText` sur `tintSuccess` | 8.70:1 | 4.5:1 | Conforme |
| Clair, contraste élevé | Avertissement, cartes difficiles | `warningText` sur `tintWarning` | 8.42:1 | 4.5:1 | Conforme |
| Clair, contraste élevé | Compteur IA presque épuisé | `warningText` sur `surface` | 9.37:1 | 4.5:1 | Conforme |
| Clair, contraste élevé | Message d'erreur | `dangerText` sur `tintDanger` | 8.20:1 | 4.5:1 | Conforme |
| Clair, contraste élevé | Icône discrète | `muted` sur `surface` | 10.31:1 | 3:1 | Conforme |
| Clair, contraste élevé | Icône de suppression | `danger` sur `surface` | 3.76:1 | 3:1 | Conforme |
| Clair, contraste élevé | Barre de progression sur sa piste | `primary` sur `border` | 1.31:1 | 3:1 | **Non conforme** |
| Clair, contraste élevé | Icône des onglets inactifs | `textSecondary` sur `surface` | 14.68:1 | 3:1 | Conforme |
| Sombre, contraste élevé | Texte principal | `textPrimary` sur `background` | 19.55:1 | 4.5:1 | Conforme |
| Sombre, contraste élevé | Texte principal sur carte | `textPrimary` sur `surface` | 17.88:1 | 4.5:1 | Conforme |
| Sombre, contraste élevé | Texte secondaire | `textSecondary` sur `background` | 15.79:1 | 4.5:1 | Conforme |
| Sombre, contraste élevé | Texte secondaire sur carte | `textSecondary` sur `surface` | 14.44:1 | 4.5:1 | Conforme |
| Sombre, contraste élevé | Texte secondaire sur fond gris | `textSecondary` sur `surfaceAlt` | 11.55:1 | 4.5:1 | Conforme |
| Sombre, contraste élevé | Lien, bouton secondaire | `primaryText` sur `surface` | 12.59:1 | 4.5:1 | Conforme |
| Sombre, contraste élevé | Puce bleue (flashcards, examen) | `primaryText` sur `tintPrimary` | 10.30:1 | 4.5:1 | Conforme |
| Sombre, contraste élevé | Texte des boutons principaux | `onAction` sur `action` | 7.03:1 | 4.5:1 | Conforme |
| Sombre, contraste élevé | Message de réussite | `successText` sur `tintSuccess` | 11.98:1 | 4.5:1 | Conforme |
| Sombre, contraste élevé | Avertissement, cartes difficiles | `warningText` sur `tintWarning` | 12.25:1 | 4.5:1 | Conforme |
| Sombre, contraste élevé | Compteur IA presque épuisé | `warningText` sur `surface` | 14.36:1 | 4.5:1 | Conforme |
| Sombre, contraste élevé | Message d'erreur | `dangerText` sur `tintDanger` | 11.43:1 | 4.5:1 | Conforme |
| Sombre, contraste élevé | Icône discrète | `muted` sur `surface` | 12.05:1 | 3:1 | Conforme |
| Sombre, contraste élevé | Icône de suppression | `danger` sur `surface` | 6.47:1 | 3:1 | Conforme |
| Sombre, contraste élevé | Barre de progression sur sa piste | `primary` sur `border` | 1.00:1 | 3:1 | **Non conforme** |
| Sombre, contraste élevé | Icône des onglets inactifs | `textSecondary` sur `surface` | 14.44:1 | 3:1 | Conforme |

## 2. Boutons sans nom pour le lecteur d'écran (sévérité haute)

Bouton tactile sans `accessibilityLabel` ni texte visible : TalkBack annonce seulement « bouton ».

- `components/screens/TutorialScreen.tsx:228`

À vérifier à la main (le contenu du bouton vient d'une variable, l'outil ne voit pas s'il contient un texte) :

- `components/chat/ChatDiagram.tsx:77`
- `components/screens/SettingsScreen.tsx:432`

### Interrupteurs sans libellé (sévérité haute)

- Aucune.

### Éléments tactiles sans rôle (sévérité moyenne)

Sans `accessibilityRole` (« button », « link », « tab »…), TalkBack lit le texte sans dire qu'on peut appuyer dessus.

- `components/ReportErrorSheet.tsx:90`
- `components/ReportErrorSheet.tsx:91`
- `components/StreakSheet.tsx:30`
- `components/challenge/ChallengeCreateSheet.tsx:77`
- `components/challenge/ChallengeCreateSheet.tsx:78`
- `components/chat/ChatDiagram.tsx:77`
- `components/chat/FlashcardsFromChatSheet.tsx:129`
- `components/chat/FlashcardsFromChatSheet.tsx:130`
- `components/screens/ClinicalCasesScreen.tsx:294`
- `components/screens/ClinicalCasesScreen.tsx:295`
- `components/screens/LeaderboardScreen.tsx:206`
- `components/screens/LeaderboardScreen.tsx:229`
- `components/screens/ProgressScreen.tsx:130`
- `components/screens/TutorialScreen.tsx:228`
- `components/ui/DatePickerSheet.tsx:85`
- `components/ui/DeleteAccountSheet.tsx:135`
- `components/ui/DeleteAccountSheet.tsx:136`
- `components/ui/TimePickerSheet.tsx:104`

## 3. Champs de saisie sans libellé (sévérité moyenne)

Un texte d'exemple (`placeholder`) disparaît à la saisie et ne remplace pas un libellé.

- Aucune.

## 4. Images sans description (sévérité moyenne)

À décrire (`accessibilityLabel`) ou à marquer décorative (`accessible={false}`).

- Aucune.

## 5. Textes de moins de 12 px (sévérité basse)

- `components/ActivityCalendar.tsx:177 (11)`
- `components/course/CourseContent.tsx:283 (11)`
- `components/course/EditCourseSheet.tsx:422 (11)`
- `components/navigation/AppNavigator.tsx:606 (10)`
- `components/navigation/AppNavigator.tsx:637 (11)`
- `components/screens/AIChatScreen.tsx:1455 (11)`
- `components/screens/ClinicalCaseScreen.tsx:307 (11)`
- `components/screens/FlashcardReviewScreen.tsx:277 (11)`
- `components/screens/FlashcardReviewScreen.tsx:357 (11)`
- `components/screens/SearchScreen.tsx:242 (11)`

## Ce que l'outil ne vérifie pas (test manuel)

- **Parcours complet au lecteur d'écran** : la tâche 2 du protocole (révision du jour) faite avec TalkBack activé, sans regarder l'écran. C'est le « test sous contrainte » demandé par la track.
- **Daltonisme** : la même tâche avec un filtre de daltonisme (Paramètres Android > Accessibilité > Correction des couleurs). Vérifier qu'aucune information n'est donnée par la couleur seule (bonne / mauvaise réponse, barres de la semaine, compteur IA).
- **Zones tactiles** : au moins 44 × 44 points pour chaque bouton, en particulier les icônes seules (retour, supprimer, fermer).
- **Taille du texte système au maximum** : aucun texte coupé ni superposé.

