import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  scheduleNotificationAsync: jest.fn(),
  cancelScheduledNotificationAsync: jest.fn(),
}));

import {
  isStreakReminderEnabled,
  hasSeenNotificationPrompt,
  markNotificationPromptSeen,
  requestNotificationPermission,
  enableStreakReminders,
  disableStreakReminders,
  scheduleReminderIfNeeded,
  sendTestNotification,
} from '../streakNotifications';

const mockedNotifications = Notifications as jest.Mocked<typeof Notifications>;

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
  // Valeur par défaut sensée pour tous les tests — évite un
  // "Cannot read properties of undefined (reading 'catch')" sur le
  // .catch(() => {}) du code source, sauf override explicite par test.
  mockedNotifications.cancelScheduledNotificationAsync.mockResolvedValue(undefined as any);
});

describe('isStreakReminderEnabled', () => {
  it('est false par défaut', async () => {
    expect(await isStreakReminderEnabled()).toBe(false);
  });

  it('devient true après activation', async () => {
    await AsyncStorage.setItem('@medflow_streak_reminders_enabled', 'true');
    expect(await isStreakReminderEnabled()).toBe(true);
  });
});

describe('hasSeenNotificationPrompt / markNotificationPromptSeen', () => {
  it('le modal maison n\'a jamais été vu par défaut', async () => {
    expect(await hasSeenNotificationPrompt()).toBe(false);
  });

  it('reste marqué "vu" après markNotificationPromptSeen, accepté ou refusé', async () => {
    await markNotificationPromptSeen();
    expect(await hasSeenNotificationPrompt()).toBe(true);
  });
});

describe('requestNotificationPermission', () => {
  it('renvoie true sans re-demander si déjà accordée', async () => {
    mockedNotifications.getPermissionsAsync.mockResolvedValue({ status: 'granted' } as any);

    const result = await requestNotificationPermission();

    expect(result).toBe(true);
    expect(mockedNotifications.requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it('demande la permission si pas encore accordée, et renvoie le résultat', async () => {
    mockedNotifications.getPermissionsAsync.mockResolvedValue({ status: 'undetermined' } as any);
    mockedNotifications.requestPermissionsAsync.mockResolvedValue({ status: 'granted' } as any);

    const result = await requestNotificationPermission();

    expect(result).toBe(true);
    expect(mockedNotifications.requestPermissionsAsync).toHaveBeenCalledTimes(1);
  });

  it('renvoie false si la permission est refusée', async () => {
    mockedNotifications.getPermissionsAsync.mockResolvedValue({ status: 'undetermined' } as any);
    mockedNotifications.requestPermissionsAsync.mockResolvedValue({ status: 'denied' } as any);

    expect(await requestNotificationPermission()).toBe(false);
  });
});

describe('enableStreakReminders', () => {
  it('ne persiste rien et renvoie false si la permission est refusée', async () => {
    mockedNotifications.getPermissionsAsync.mockResolvedValue({ status: 'denied' } as any);
    mockedNotifications.requestPermissionsAsync.mockResolvedValue({ status: 'denied' } as any);

    const result = await enableStreakReminders(null);

    expect(result).toBe(false);
    expect(await isStreakReminderEnabled()).toBe(false);
  });

  it('persiste "activé" et planifie si la permission est accordée', async () => {
    mockedNotifications.getPermissionsAsync.mockResolvedValue({ status: 'granted' } as any);
    mockedNotifications.scheduleNotificationAsync.mockResolvedValue('notif-id-1');

    const result = await enableStreakReminders(null);

    expect(result).toBe(true);
    expect(await isStreakReminderEnabled()).toBe(true);
    expect(mockedNotifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
  });
});

describe('disableStreakReminders', () => {
  it('repasse le flag à false et annule un rappel en attente', async () => {
    await AsyncStorage.setItem('@medflow_streak_reminders_enabled', 'true');
    await AsyncStorage.setItem('@medflow_streak_reminder_notification_id', 'notif-id-1');

    await disableStreakReminders();

    expect(await isStreakReminderEnabled()).toBe(false);
    expect(mockedNotifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('notif-id-1');
  });

  it('ne plante pas s\'il n\'y avait aucun rappel programmé', async () => {
    await expect(disableStreakReminders()).resolves.not.toThrow();
    expect(mockedNotifications.cancelScheduledNotificationAsync).not.toHaveBeenCalled();
  });
});

describe('scheduleReminderIfNeeded', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('ne fait rien si les rappels ne sont pas activés', async () => {
    // reminders désactivés par défaut (rien dans AsyncStorage)
    await scheduleReminderIfNeeded(null);

    expect(mockedNotifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    expect(mockedNotifications.cancelScheduledNotificationAsync).not.toHaveBeenCalled();
  });

  it('annule le rappel et n\'en programme pas de nouveau si déjà actif aujourd\'hui', async () => {
    jest.setSystemTime(new Date('2026-08-11T10:00:00'));
    await AsyncStorage.setItem('@medflow_streak_reminders_enabled', 'true');
    await AsyncStorage.setItem('@medflow_streak_reminder_notification_id', 'old-notif-id');

    await scheduleReminderIfNeeded('2026-08-11');

    expect(mockedNotifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('old-notif-id');
    expect(mockedNotifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('programme un rappel pour ce soir si pas encore actif aujourd\'hui et avant 19h', async () => {
    jest.setSystemTime(new Date('2026-08-11T10:00:00'));
    await AsyncStorage.setItem('@medflow_streak_reminders_enabled', 'true');
    mockedNotifications.scheduleNotificationAsync.mockResolvedValue('new-notif-id');

    await scheduleReminderIfNeeded('2026-08-10'); // actif hier, pas aujourd'hui

    expect(mockedNotifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
    const call = mockedNotifications.scheduleNotificationAsync.mock.calls[0][0];
    // 10h -> 19h le même jour = 9h = 32400s
    expect(call.trigger).toEqual({ seconds: 32400 });
  });

  it('programme un rappel pour demain si l\'heure du rappel (19h) est déjà passée', async () => {
    jest.setSystemTime(new Date('2026-08-11T20:00:00'));
    await AsyncStorage.setItem('@medflow_streak_reminders_enabled', 'true');
    mockedNotifications.scheduleNotificationAsync.mockResolvedValue('new-notif-id');

    await scheduleReminderIfNeeded(null);

    expect(mockedNotifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
    const call = mockedNotifications.scheduleNotificationAsync.mock.calls[0][0];
    // 20h -> 19h le lendemain = 23h = 82800s
    expect(call.trigger).toEqual({ seconds: 82800 });
  });

  it('persiste l\'id du nouveau rappel programmé', async () => {
    jest.setSystemTime(new Date('2026-08-11T10:00:00'));
    await AsyncStorage.setItem('@medflow_streak_reminders_enabled', 'true');
    mockedNotifications.scheduleNotificationAsync.mockResolvedValue('fresh-id-42');

    await scheduleReminderIfNeeded(null);

    expect(await AsyncStorage.getItem('@medflow_streak_reminder_notification_id')).toBe('fresh-id-42');
  });
});

describe('sendTestNotification', () => {
  it('renvoie false sans programmer si la permission est refusée', async () => {
    mockedNotifications.getPermissionsAsync.mockResolvedValue({ status: 'denied' } as any);
    mockedNotifications.requestPermissionsAsync.mockResolvedValue({ status: 'denied' } as any);

    const result = await sendTestNotification();

    expect(result).toBe(false);
    expect(mockedNotifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('programme une notification à 5 secondes si la permission est accordée', async () => {
    mockedNotifications.getPermissionsAsync.mockResolvedValue({ status: 'granted' } as any);

    const result = await sendTestNotification();

    expect(result).toBe(true);
    expect(mockedNotifications.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({ trigger: { seconds: 5 } })
    );
  });

  it('n\'interfère jamais avec le rappel réel (clé AsyncStorage distincte)', async () => {
    mockedNotifications.getPermissionsAsync.mockResolvedValue({ status: 'granted' } as any);

    await sendTestNotification();

    expect(await AsyncStorage.getItem('@medflow_streak_reminder_notification_id')).toBeNull();
  });
});