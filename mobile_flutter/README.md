# MedFlow — app Flutter (iOS)

Portage Flutter de l'app Expo (`../mobile`), pour la version iOS. Même backend Flask.

## Lancer

```bash
cp env.example.json env.json   # renseigner les clés Firebase de l'app iOS
flutter pub get
flutter run --dart-define-from-file=env.json
```

`env.json` remplace `mobile/.env` : `API_URL`, clés Firebase (application **iOS** déclarée dans la console Firebase, bundle id `com.wavitooo.medflowlearning`).

## Build iOS (Mac ou CI macOS)

```bash
flutter build ipa --dart-define-from-file=env.json
```

Puis envoi sur TestFlight (Xcode Organizer ou Transporter). iOS 15 minimum.

Le détail des équivalences RN → Flutter est dans [PORTING.md](PORTING.md).

## Notifications push (FCM)

Le backend envoie aux jetons FCM de l'app Flutter et garde l'envoi Expo pour l'app Android Expo (`backend/services/push.py`). À configurer une fois :

1. Console Apple Developer : créer une clé **APNs** (Certificates, IDs & Profiles → Keys), activer **Push Notifications** sur l'identifiant `com.wavitooo.medflowlearning`.
2. Console Firebase → Paramètres du projet → Cloud Messaging → app iOS : téléverser la clé APNs (`.p8`, Key ID, Team ID).
3. Côté serveur, rien à ajouter : en production (`FIREBASE_VERIFY=true`), Firebase Admin est déjà initialisé avec le compte de service `FIREBASE_*`.

Sans clé APNs, l'app reste sur ses notifications locales (vérification à l'ouverture), comme l'app Expo sans FCM.

## Tester sur un simulateur iPhone sans Mac (Appetize)

Le workflow « iOS Simulator (Appetize) » compile l'app pour le simulateur iOS sur un Mac GitHub et l'envoie sur [Appetize.io](https://appetize.io), qui la fait tourner dans un vrai simulateur iPhone, dans le navigateur. Pas besoin de compte Apple : un build simulateur n'est pas signé.

1. Firebase : ajouter une app **iOS** (bundle `com.wavitooo.medflowlearning`) et reprendre les valeurs de son `GoogleService-Info.plist` dans `env.json` : `API_KEY` → `FIREBASE_API_KEY`, `GOOGLE_APP_ID` → `FIREBASE_APP_ID`, `GCM_SENDER_ID` → `FIREBASE_MESSAGING_SENDER_ID`, `PROJECT_ID`, `STORAGE_BUCKET`, et `<projet>.firebaseapp.com` pour `FIREBASE_AUTH_DOMAIN`.
2. Appetize : créer un compte (offre gratuite limitée en minutes par mois) et copier le jeton API.
3. GitHub → Settings → Secrets and variables → Actions : secrets `FLUTTER_ENV_JSON` (contenu de `env.json`) et `APPETIZE_API_TOKEN`.
4. Lancer un build : `git tag ios-preview-1 && git push origin ios-preview-1`.
5. Le lien s'affiche dans le résumé du job. Pour le garder aux builds suivants, créer la variable `APPETIZE_PUBLIC_KEY` avec la clé indiquée.

Limites du simulateur : pas de notifications push, pas d'appareil photo ni de micro ; pour essayer sans importer de fichier, utiliser « Essayer avec un cours d'exemple ».

## Tester sur l'émulateur Android (depuis WSL)

Le code Flutter est le même sur iOS et Android : ce qui marche sur l'émulateur Android marche sur iPhone, sauf les parties natives (notifications, partage, sélecteurs de fichiers, permissions) à revérifier sur iOS.

```bash
mobile_flutter/scripts/android.sh                # émulateur + app, au comportement iOS (défilement, retour par glissement)
mobile_flutter/scripts/android.sh --android-look # comportement Android natif
mobile_flutter/scripts/android.sh --local-api    # backend local au lieu de la prod
mobile_flutter/scripts/android.sh --build-only   # compile seulement l'APK de debug
mobile_flutter/scripts/android.sh --keep-emulator # laisse l'émulateur ouvert en quittant
```

Quitter : Ctrl+C (ou `q` puis Entrée). Le script ferme alors l'émulateur proprement, comme après un échec du build.

Le script démarre l'émulateur Windows (Android Studio), recopie le projet dans `%LOCALAPPDATA%\MedFlow\mobile_flutter` (Gradle gère mal les chemins `\\wsl`) et lance `flutter run` avec le Flutter Windows.

Firebase : déposer le `google-services.json` de l'app Android (`com.wavitooo.medflowlearning`, console Firebase → Paramètres du projet) dans `mobile_flutter/android/app/` ; le script en tire la configuration. Il n'est pas versionné.
