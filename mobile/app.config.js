// Configuration dynamique : app.json + réglages qui dépendent de fichiers
// facultatifs (non commités) ou de l'environnement de build.
const fs = require('fs');
const path = require('path');

module.exports = ({ config }) => {
  const googleServices = path.join(__dirname, 'google-services.json');
  // HTTP en clair autorisé seulement pour une API locale en http:// (émulateur) ;
  // l'APK de production ne parle qu'en HTTPS.
  const cleartext = (process.env.EXPO_PUBLIC_API_URL || '').startsWith('http://');

  return {
    ...config,
    android: {
      ...config.android,
      // Pas de sauvegarde Android (Google Drive / adb) des données de l'app :
      // cours en cache et session resteraient lisibles hors du téléphone.
      allowBackup: false,
      // FCM (notifications push) : présent seulement si le fichier existe
      // (écrit par la CI depuis le secret GOOGLE_SERVICES_JSON, ou copié en local).
      ...(fs.existsSync(googleServices) ? { googleServicesFile: './google-services.json' } : {}),
    },
    plugins: (config.plugins || []).map((plugin) =>
      Array.isArray(plugin) && plugin[0] === 'expo-build-properties'
        ? [plugin[0], { ...plugin[1], android: { ...(plugin[1] || {}).android, usesCleartextTraffic: cleartext } }]
        : plugin
    ),
  };
};
