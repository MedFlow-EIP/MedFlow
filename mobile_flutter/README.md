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
