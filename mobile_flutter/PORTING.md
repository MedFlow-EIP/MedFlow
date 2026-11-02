# Portage React Native → Flutter

L'app Flutter (`mobile_flutter/`) est une copie fidèle de l'app Expo (`mobile/`, branche `main`), pour la publier sur iOS. Le backend est le même : mêmes routes, mêmes corps de requête, mêmes réponses.

## Règle d'or

Copier, pas réinventer. Pour chaque écran :

- **mêmes textes**, au caractère près (français, apostrophes typographiques `’`, guillemets `« »`) ;
- **mêmes appels API** (chemin, méthode, corps, paramètres de requête, délai) et même gestion des statuts (`409`, `202`, `404`…) ;
- **mêmes états** : chargement, erreur, vide, hors ligne, désactivé ;
- **même mise en page** : couleurs (mêmes noms de jetons), tailles de police, marges, rayons, icônes ;
- **même accessibilité** : `accessibilityLabel` → `Semantics(label:)` ou `Tappable(semanticLabel:)`, `accessibilityRole="header"` → `Semantics(header: true)` ;
- les commentaires utiles du code RN (le « pourquoi ») sont gardés, en français.

## Équivalences

| React Native | Flutter |
|---|---|
| `useTheme().colors` | `final c = context.colors;` (mêmes noms : `c.primaryText`, `c.tintDanger`…) |
| `<Ionicons name="book-outline">` | `Icon(Ionicons.book_outline)` (`package:ionicons/ionicons.dart`) |
| `fetchWithTimeout` + `readJsonOrThrow` | `Api.getJson / postJson / putJson / patchJson / deleteJson` (lèvent `UserFacingError`) |
| `fetch` dont on lit le statut | `Api.get / post / put / patch / delete / send` puis `res.statusCode` et `decodeBody(res)` |
| `getAuthHeaders(user)` | automatique dans `Api.*` ; `Api.authHeaders()` si besoin |
| délai `60_000` | `timeout: Duration(seconds: 60)` |
| `errorMessage(err, '…')` | `errorMessage(err, '…')` (`services/api.dart`) |
| `navigation.navigate('X', params)` | `Nav.navigate('X', {'courseId': id})` |
| `navigation.goBack()` / `replace` | `Nav.goBack()` / `Nav.replace('X', params)` |
| `route.params.courseId` | `routeParams(context)['courseId']` |
| onglet avec paramètres (`AIChat {prompt}`) | `Nav.navigate('AIChat', {'prompt': '…'})` ; l'écran écoute `currentTab` |
| `useFocusEffect` | `with FocusRefresh<X>` + `void onFocus()` (+ `tabName` pour un onglet) |
| `appAlert(title, msg, buttons)` | `appAlert(title, msg, [AlertButton('OK', style: AlertStyle.cancel, onPress: …)])` ; `appConfirm(...)` |
| `<Modal>` feuille du bas | `showAppSheet(context, title: …, builder: …)` (`widgets/sheet.dart`) |
| `useScreenInsets()` | `ScreenInsets.of(context)` → `.top`, `.bottom`, `.tabBar` |
| `AsyncStorage` | `Storage.getString / setString / getJson / setJson / remove` |
| `auth.currentUser` | `FirebaseAuth.instance.currentUser` ou `Api.currentUser` |
| `maxFontSizeMultiplier={1.3}` | `textScaler: MediaQuery.textScalerOf(context).clamp(maxScaleFactor: 1.3)` |
| reanimated `FadeIn` / `FadeInDown` | `TweenAnimationBuilder`, `AnimatedOpacity`, `AnimatedSwitcher` |
| `react-native-markdown-display` | `flutter_markdown` (`MarkdownBody`) |
| `react-native-svg` / SVG en chaîne | `flutter_svg` (`SvgPicture.string`) ou `CustomPainter` |
| `expo-print` + `expo-sharing` | `printing` (`Printing.convertHtml`) + `share_plus` |
| `expo-document-picker` / `expo-image-picker` | `file_picker` / `image_picker` |
| `expo-av` (enregistrement) | `record` |
| `expo-speech` | `flutter_tts` |
| `Linking.openURL` | `url_launcher` |

Les données JSON restent des `Map<String, dynamic>` / `List`, comme dans le code RN (pas de classes de modèle sauf si l'écran RN en définit une).

## Déjà porté (à réutiliser, ne pas modifier)

- `lib/widgets/ui.dart` : `StateView`, `PrimaryButton`, `SecondaryButton`, `AppButton`, `AppCard`, `ProgressBar`, `CircleIconButton`, `ScreenHeader`, `Tappable`, `Pill`, `LoadingView`, `toneColors`.
- `lib/widgets/sheet.dart`, `insets.dart`, `job_done_banner.dart`.
- `lib/widgets/report_error_sheet.dart` (`showReportErrorSheet(context, ReportTarget(...))`), `offline_banner.dart`, `demo_course_button.dart`, `quiz.dart` (`QuizRunner`, `QuizCorrection`, `questionKey`), `date_picker_sheet.dart` (`showDatePickerSheet`, `toIsoDate`, `fromIsoDate`, `formatLongDate`).
- `lib/utils/` : `analytics.dart`, `app_alert.dart`, `background_jobs.dart` (imports et cas cliniques en arrière-plan), `offline.dart` (cache hors ligne et file de révision), `reminders.dart` (rappels révision / série / examens, `countdownLabel`, `daysUntil`), `social_notifications.dart`, `push_notifications.dart`, `first_time.dart`, `tutorial.dart`.
- `lib/services/` : `api.dart`, `storage.dart`, `notifications.dart`.
- Authentification : `lib/screens/auth/`.
- Navigation : `lib/navigation/` (onglets, bouton +, routes).

## Organisation des fichiers

- Un écran = le fichier provisoire déjà présent dans `lib/screens/` : garder le nom de classe et le constructeur `const XScreen({super.key})`.
- Composants propres à un lot : `lib/widgets/<lot>/…` ou classes privées dans le fichier de l'écran.
- Fichiers partagés (navigation, `widgets/ui.dart`, `sheet.dart`, `insets.dart`, `services/*`, `utils/*` existants, thème, `app.dart`, `main.dart`, `routes.dart`, `pubspec.yaml`) : ne pas les modifier. Un besoin de changement se signale dans le compte rendu.
- Les écrans d'onglet (Home, AIChat, Dashboard, Account) passent sous la barre du bas : réserver `ScreenInsets.of(context).tabBar` en bas du contenu.

## Vérification

```bash
cd mobile_flutter
dart analyze lib/<fichiers du lot>   # aucune erreur, aucun avertissement, aucune info
```
