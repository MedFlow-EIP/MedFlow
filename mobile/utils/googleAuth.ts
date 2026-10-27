import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';

// Ferme l'onglet de connexion Google quand il revient vers l'app.
WebBrowser.maybeCompleteAuthSession();

const ANDROID_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID;
const WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

/**
 * Connexion Google : Android uniquement, et seulement dans un build de l'app
 * (APK / dev build). Dans Expo Go, Google refuse la redirection vers exp://,
 * le bouton est donc masqué.
 */
export const googleSignInAvailable =
  Platform.OS === 'android' &&
  !!ANDROID_CLIENT_ID &&
  !!WEB_CLIENT_ID &&
  Constants.appOwnership !== 'expo';

export type GoogleResult = { idToken: string } | { error: string } | { cancelled: true };

/** Ouvre la fenêtre Google et renvoie l'id_token à donner à Firebase. */
export function useGoogleIdToken(onResult: (result: GoogleResult) => void) {
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    // Valeur factice quand non configuré : le hook exige un identifiant sur Android.
    androidClientId: ANDROID_CLIENT_ID || 'non-configure',
    webClientId: WEB_CLIENT_ID,
  });

  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

  useEffect(() => {
    if (!response) return;
    if (response.type === 'success') {
      const idToken = response.params?.id_token;
      onResultRef.current(idToken ? { idToken } : { error: 'Connexion Google impossible.' });
    } else if (response.type === 'error') {
      onResultRef.current({ error: 'Connexion Google impossible.' });
    } else {
      onResultRef.current({ cancelled: true });
    }
  }, [response]);

  return {
    ready: googleSignInAvailable && !!request,
    start: () => promptAsync(),
  };
}
