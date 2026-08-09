import { User } from 'firebase/auth';

/**
 * Construit les headers d'authentification pour un appel API.
 *
 * Envoie À LA FOIS le token Firebase réel (Authorization: Bearer) ET
 * l'ancien header X-User-UID, le temps de la transition :
 * - Backend en FIREBASE_VERIFY=False (legacy, actuel) : lit X-User-UID,
 *   ignore Authorization.
 * - Backend en FIREBASE_VERIFY=True (une fois basculé) : lit uniquement
 *   Authorization, X-User-UID est alors ignoré et n'est plus qu'un
 *   vestige inoffensif.
 *
 * Une fois FIREBASE_VERIFY=True confirmé stable en prod, X-User-UID
 * pourra être retiré d'ici (et de _extract_uid_legacy côté backend).
 */
export async function getAuthHeaders(user: User): Promise<Record<string, string>> {
  const token = await user.getIdToken();
  return {
    Authorization: `Bearer ${token}`,
    'X-User-UID': user.uid,
    'X-User-Name': user.displayName ?? '',
    'X-User-Avatar': user.photoURL ?? '',
  };
}