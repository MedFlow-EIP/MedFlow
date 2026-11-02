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
