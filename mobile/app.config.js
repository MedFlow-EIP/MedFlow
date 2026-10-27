// Configuration dynamique : app.json + réglages qui dépendent de fichiers
// facultatifs (non commités).
const fs = require('fs');
const path = require('path');

module.exports = ({ config }) => {
  const googleServices = path.join(__dirname, 'google-services.json');
  return {
    ...config,
    android: {
      ...config.android,
      // FCM (notifications push) : présent seulement si le fichier existe
      // (écrit par la CI depuis le secret GOOGLE_SERVICES_JSON, ou copié en local).
      ...(fs.existsSync(googleServices) ? { googleServicesFile: './google-services.json' } : {}),
    },
  };
};
