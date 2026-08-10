import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ENABLED_KEY = '@medflow_streak_reminders_enabled';
const PROMPT_SEEN_KEY = '@medflow_notif_prompt_seen';
const NOTIFICATION_ID_KEY = '@medflow_streak_reminder_notification_id';

// Heure à laquelle le rappel se déclenche s'il est nécessaire (pas encore
// actif aujourd'hui à ce moment-là).
const REMINDER_HOUR = 19;
const REMINDER_MINUTE = 0;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function isStreakReminderEnabled(): Promise<boolean> {
  const value = await AsyncStorage.getItem(ENABLED_KEY);
  return value === 'true';
}

/** Le modal maison ne doit apparaître qu'une seule fois dans la vie de
 * l'utilisateur — accepté ou refusé, on ne le reproposera jamais après
 * (il reste toujours activable manuellement via Réglages). */
export async function hasSeenNotificationPrompt(): Promise<boolean> {
  const value = await AsyncStorage.getItem(PROMPT_SEEN_KEY);
  return value === 'true';
}

export async function markNotificationPromptSeen(): Promise<void> {
  await AsyncStorage.setItem(PROMPT_SEEN_KEY, 'true');
}

export async function requestNotificationPermission(): Promise<boolean> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;

  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

async function cancelScheduledReminder(): Promise<void> {
  const id = await AsyncStorage.getItem(NOTIFICATION_ID_KEY);
  if (id) {
    await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
    await AsyncStorage.removeItem(NOTIFICATION_ID_KEY);
  }
}

/**
 * Active les rappels : demande la permission, puis planifie immédiatement
 * en fonction de la dernière activité connue.
 */
export async function enableStreakReminders(lastActivityIso: string | null): Promise<boolean> {
  const granted = await requestNotificationPermission();
  if (!granted) return false;

  await AsyncStorage.setItem(ENABLED_KEY, 'true');
  await scheduleReminderIfNeeded(lastActivityIso);
  return true;
}

export async function disableStreakReminders(): Promise<void> {
  await AsyncStorage.setItem(ENABLED_KEY, 'false');
  await cancelScheduledReminder();
}

/**
 * À appeler après chaque récupération des stats du compte (login, retour
 * sur Accueil, fin de leçon...). Si l'utilisateur a déjà été actif
 * aujourd'hui, annule tout rappel en attente — inutile de le déranger.
 * Sinon, programme un rappel unique pour ce soir (ou demain si l'heure du
 * rappel est déjà passée).
 */
export async function scheduleReminderIfNeeded(lastActivityIso: string | null): Promise<void> {
  const enabled = await isStreakReminderEnabled();
  if (!enabled) return;

  const todayIso = new Date().toISOString().split('T')[0];
  const alreadyActiveToday = lastActivityIso === todayIso;

  await cancelScheduledReminder();

  if (alreadyActiveToday) return;

  const now = new Date();
  const target = new Date();
  target.setHours(REMINDER_HOUR, REMINDER_MINUTE, 0, 0);
  if (target.getTime() <= now.getTime()) {
    target.setDate(target.getDate() + 1);
  }

  const secondsUntilTarget = Math.max(60, Math.round((target.getTime() - now.getTime()) / 1000));

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: '🔥 Ne perds pas ta série !',
      body: "Tu n'as pas encore révisé aujourd'hui — quelques minutes suffisent pour garder ton streak.",
    },
    trigger: { seconds: secondsUntilTarget },
  });

  await AsyncStorage.setItem(NOTIFICATION_ID_KEY, id);
}

/**
 * Notification de test pour valider que tout le pipeline fonctionne
 * (permission -> planification -> livraison) sans attendre l'heure du
 * vrai rappel. N'utilise pas NOTIFICATION_ID_KEY : totalement séparée du
 * système de rappel réel, ne l'annule/n'interfère pas avec lui.
 */
export async function sendTestNotification(): Promise<boolean> {
  const granted = await requestNotificationPermission();
  if (!granted) return false;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: '✅ Test MedFlow',
      body: 'Si tu vois ça, les notifications fonctionnent !',
    },
    trigger: { seconds: 5 },
  });

  return true;
}