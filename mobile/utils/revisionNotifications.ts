import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ENABLED_KEY = '@medflow_revision_reminders_enabled';
const NOTIFICATION_ID_KEY = '@medflow_revision_reminder_notification_id';
const LAST_SCHEDULED_COUNT_KEY = '@medflow_revision_reminder_last_count';

// Le matin plutôt que le soir (contrairement au rappel de streak) —
// la littérature sur la répétition espacée recommande de réviser tôt,
// et ça évite d'empiler deux notifications à la même heure.
const REMINDER_HOUR = 9;
const REMINDER_MINUTE = 0;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function isRevisionReminderEnabled(): Promise<boolean> {
  const value = await AsyncStorage.getItem(ENABLED_KEY);
  return value === 'true';
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
 * Active les rappels de révision : demande la permission, puis planifie
 * immédiatement en fonction du nombre de cartes actuellement dues.
 */
export async function enableRevisionReminders(dueCount: number): Promise<boolean> {
  const granted = await requestNotificationPermission();
  if (!granted) return false;

  await AsyncStorage.setItem(ENABLED_KEY, 'true');
  await scheduleRevisionReminder(dueCount);
  return true;
}

export async function disableRevisionReminders(): Promise<void> {
  await AsyncStorage.setItem(ENABLED_KEY, 'false');
  await cancelScheduledReminder();
}

/**
 * À appeler après chaque récupération de la prévision de révision
 * (chargement du Dashboard, de l'écran Révision...). Le contenu de la
 * notification reflète le nombre de cartes dues connu au moment de la
 * planification — pas de mise à jour dynamique à l'heure du rappel
 * (limite technique des notifications locales), donc on replanifie à
 * chaque nouvelle donnée pour rester aussi juste que possible.
 *
 * Si `dueCount` est à 0, annule tout rappel en attente : pas la peine de
 * déranger l'utilisateur s'il n'y a rien à réviser.
 */
export async function scheduleRevisionReminder(dueCount: number): Promise<void> {
  const enabled = await isRevisionReminderEnabled();
  if (!enabled) return;

  if (dueCount <= 0) {
    await cancelScheduledReminder();
    return;
  }

  // Évite de replanifier inutilement (annuler+recréer) si le nombre de
  // cartes dues n'a pas changé depuis la dernière planification.
  const lastCount = await AsyncStorage.getItem(LAST_SCHEDULED_COUNT_KEY);
  if (lastCount === String(dueCount)) return;

  await cancelScheduledReminder();

  const now = new Date();
  const target = new Date();
  target.setHours(REMINDER_HOUR, REMINDER_MINUTE, 0, 0);
  if (target.getTime() <= now.getTime()) {
    target.setDate(target.getDate() + 1);
  }

  const secondsUntilTarget = Math.max(60, Math.round((target.getTime() - now.getTime()) / 1000));

  const body =
    dueCount === 1
      ? 'Tu as 1 carte à réviser aujourd\'hui — ça prend 2 minutes.'
      : `Tu as ${dueCount} cartes à réviser aujourd'hui — ça prend quelques minutes.`;

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: '🧠 C\'est l\'heure de réviser',
      body,
    },
    trigger: { seconds: secondsUntilTarget },
  });

  await AsyncStorage.setItem(NOTIFICATION_ID_KEY, id);
  await AsyncStorage.setItem(LAST_SCHEDULED_COUNT_KEY, String(dueCount));
}