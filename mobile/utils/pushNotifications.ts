import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import type { User } from 'firebase/auth';
import { API_URL } from '@/services/api';
import { getAuthHeaders } from './authHeaders';

// Notifications push (demandes d'ami, défis, cours prêt) via le service
// d'Expo. Nécessite FCM configuré dans le build Android (google-services.json) :
// sans lui, l'enregistrement échoue en silence et l'app garde ses
// notifications locales (vérification à l'ouverture).

let currentToken: string | null = null;

/** Vrai quand le serveur peut joindre ce téléphone : les notifications locales doublonneraient. */
export function isPushActive(): boolean {
  return currentToken !== null;
}

/** Demande la permission, récupère le jeton de l'appareil et l'envoie au serveur. */
export async function registerForPushNotifications(user: User): Promise<string | null> {
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'MedFlow',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') return null;

    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    if (!projectId) return null;
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });

    const res = await fetch(`${API_URL}/api/push-token`, {
      method: 'POST',
      headers: { ...(await getAuthHeaders(user)), 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    if (!res.ok) return null;
    currentToken = token;
    return token;
  } catch {
    // FCM non configuré, Expo Go, pas de réseau… : on reste sur les notifications locales.
    return null;
  }
}

/** À la déconnexion : ce téléphone ne doit plus recevoir les notifications de ce compte. */
export async function unregisterPushNotifications(user: User): Promise<void> {
  const token = currentToken;
  currentToken = null;
  if (!token) return;
  try {
    await fetch(`${API_URL}/api/push-token`, {
      method: 'DELETE',
      headers: { ...(await getAuthHeaders(user)), 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
  } catch {
    // Le serveur oubliera le jeton quand Expo le signalera comme invalide.
  }
}

/** Écran à ouvrir quand on touche une notification (données envoyées par le serveur). */
export function notificationTarget(data: any): { screen: string; params?: object } | null {
  if (!data || typeof data !== 'object') return null;
  if (typeof data.courseId === 'string') return { screen: 'CourseDetail', params: { courseId: data.courseId } };
  if (data.screen === 'Challenge' && typeof data.challengeId === 'number') {
    return { screen: 'Challenge', params: { challengeId: data.challengeId } };
  }
  if (data.screen === 'ClinicalCase' && typeof data.caseId === 'number') {
    return { screen: 'ClinicalCase', params: { caseId: data.caseId } };
  }
  if (data.screen === 'Friends') return { screen: 'Friends' };
  return null;
}
