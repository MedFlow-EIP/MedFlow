import { useEffect, useState } from 'react';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { User } from 'firebase/auth';
import { API_URL } from '@/services/api';
import { getAuthHeaders } from './authHeaders';

// Demandes d'ami et défis reçus : pastille sur l'onglet Compte et notification
// sur le téléphone pour chaque nouveauté. Vérifié à l'ouverture de l'app et
// régulièrement pendant qu'elle est ouverte (pas de serveur de notifications push).

export type SocialSummary = {
  friend_requests: { uid: string; displayName: string }[];
  challenges: { id: number; friend_name: string; course_nom: string }[];
};

const seenKey = (uid: string) => `@social_seen:${uid}`;

let count = 0;
const listeners = new Set<(n: number) => void>();

function setCount(n: number) {
  count = n;
  listeners.forEach((l) => l(n));
}

/** Nombre de demandes d'ami + défis à jouer (pastille de l'onglet Compte). */
export function useSocialBadge(): number {
  const [n, setN] = useState(count);
  useEffect(() => {
    listeners.add(setN);
    return () => {
      listeners.delete(setN);
    };
  }, []);
  return n;
}

/** Identifiants des nouveautés pas encore notifiées, avec leur message. */
export function newItems(summary: SocialSummary, seen: Set<string>): { id: string; title: string; body: string }[] {
  const items = [
    ...summary.friend_requests.map((r) => ({
      id: `fr:${r.uid}`,
      title: '👋 Nouvelle demande d’ami',
      body: `${r.displayName} veut t’ajouter en ami.`,
    })),
    ...summary.challenges.map((c) => ({
      id: `ch:${c.id}`,
      title: '⚡ Nouveau défi',
      body: `${c.friend_name} te défie sur « ${c.course_nom} ».`,
    })),
  ];
  return items.filter((i) => !seen.has(i.id));
}

/**
 * Met à jour la pastille et affiche une notification pour chaque nouvelle
 * demande d'ami ou nouveau défi. Silencieux hors ligne.
 */
export async function checkSocialNotifications(user: User): Promise<void> {
  try {
    const res = await fetch(`${API_URL}/api/notifications/summary`, { headers: await getAuthHeaders(user) });
    if (!res.ok) return;
    const summary: SocialSummary = await res.json();
    setCount(summary.friend_requests.length + summary.challenges.length);

    const stored = await AsyncStorage.getItem(seenKey(user.uid));
    const firstCheck = stored === null;
    const seen = new Set<string>(stored ? JSON.parse(stored) : []);
    const fresh = newItems(summary, seen);
    if (fresh.length === 0) return;

    // Première vérification sur ce téléphone : on ne notifie pas tout l'historique.
    if (!firstCheck) {
      const { status } = await Notifications.getPermissionsAsync();
      if (status === 'granted') {
        for (const item of fresh.slice(0, 3)) {
          await Notifications.scheduleNotificationAsync({
            content: { title: item.title, body: item.body },
            trigger: null,
          });
        }
      }
    }
    // On ne garde que les nouveautés encore en attente, pour que la liste reste courte.
    const pending = newItems(summary, new Set()).map((i) => i.id);
    await AsyncStorage.setItem(seenKey(user.uid), JSON.stringify(pending));
  } catch {
    // Hors ligne : on réessaiera à la prochaine vérification.
  }
}

/** Remet la pastille à zéro (déconnexion). */
export function resetSocialBadge() {
  setCount(0);
}
