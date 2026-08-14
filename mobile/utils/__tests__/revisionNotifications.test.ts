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
  isRevisionReminderEnabled,
  requestNotificationPermission,
  enableRevisionReminders,
  disableRevisionReminders,
  scheduleRevisionReminder,
  sendTestRevisionNotification,
  getRevisionReminderHour,
  setRevisionReminderHour,
} from '../revisionNotifications';

const mockedNotifications = Notifications as jest.Mocked<typeof Notifications>;

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
  mockedNotifications.cancelScheduledNotificationAsync.mockResolvedValue(undefined as any);
});

describe('isRevisionReminderEnabled', () => {
  it('est false par défaut', async () => {
    expect(await isRevisionReminderEnabled()).toBe(false);
  });

  it('devient true après activation', async () => {
    await AsyncStorage.setItem('@medflow_revision_reminders_enabled', 'true');
    expect(await isRevisionReminderEnabled()).toBe(true);
  });
});

describe('requestNotificationPermission', () => {
  it('renvoie true sans re-demander si déjà accordée', async () => {
    mockedNotifications.getPermissionsAsync.mockResolvedValue({ status: 'granted' } as any);

    expect(await requestNotificationPermission()).toBe(true);
    expect(mockedNotifications.requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it('renvoie false si la permission est refusée', async () => {
    mockedNotifications.getPermissionsAsync.mockResolvedValue({ status: 'undetermined' } as any);
    mockedNotifications.requestPermissionsAsync.mockResolvedValue({ status: 'denied' } as any);

    expect(await requestNotificationPermission()).toBe(false);
  });
});

describe('enableRevisionReminders', () => {
  it('ne persiste rien et renvoie false si la permission est refusée', async () => {
    mockedNotifications.getPermissionsAsync.mockResolvedValue({ status: 'denied' } as any);
    mockedNotifications.requestPermissionsAsync.mockResolvedValue({ status: 'denied' } as any);

    const result = await enableRevisionReminders(5);

    expect(result).toBe(false);
    expect(await isRevisionReminderEnabled()).toBe(false);
  });

  it('persiste "activé" et planifie si la permission est accordée', async () => {
    mockedNotifications.getPermissionsAsync.mockResolvedValue({ status: 'granted' } as any);
    mockedNotifications.scheduleNotificationAsync.mockResolvedValue('notif-id-1');

    const result = await enableRevisionReminders(5);

    expect(result).toBe(true);
    expect(await isRevisionReminderEnabled()).toBe(true);
    expect(mockedNotifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
  });
});

describe('disableRevisionReminders', () => {
  it('repasse le flag à false et annule un rappel en attente', async () => {
    await AsyncStorage.setItem('@medflow_revision_reminders_enabled', 'true');
    await AsyncStorage.setItem('@medflow_revision_reminder_notification_id', 'notif-id-1');

    await disableRevisionReminders();

    expect(await isRevisionReminderEnabled()).toBe(false);
    expect(mockedNotifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('notif-id-1');
  });
});

describe('scheduleRevisionReminder', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('ne fait rien si les rappels ne sont pas activés', async () => {
    await scheduleRevisionReminder(5);

    expect(mockedNotifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('annule le rappel existant si le nombre de cartes dues tombe à 0', async () => {
    await AsyncStorage.setItem('@medflow_revision_reminders_enabled', 'true');
    await AsyncStorage.setItem('@medflow_revision_reminder_notification_id', 'old-id');

    await scheduleRevisionReminder(0);

    expect(mockedNotifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('old-id');
    expect(mockedNotifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('programme un rappel avec le bon nombre de cartes au singulier', async () => {
    jest.setSystemTime(new Date('2026-08-11T07:00:00'));
    await AsyncStorage.setItem('@medflow_revision_reminders_enabled', 'true');
    mockedNotifications.scheduleNotificationAsync.mockResolvedValue('new-id');

    await scheduleRevisionReminder(1);

    const call = mockedNotifications.scheduleNotificationAsync.mock.calls[0][0];
    expect(call.content.body).toBe("Tu as 1 carte à réviser aujourd'hui — ça prend 2 minutes.");
  });

  it('programme un rappel avec le bon nombre de cartes au pluriel', async () => {
    jest.setSystemTime(new Date('2026-08-11T07:00:00'));
    await AsyncStorage.setItem('@medflow_revision_reminders_enabled', 'true');
    mockedNotifications.scheduleNotificationAsync.mockResolvedValue('new-id');

    await scheduleRevisionReminder(8);

    const call = mockedNotifications.scheduleNotificationAsync.mock.calls[0][0];
    expect(call.content.body).toBe("Tu as 8 cartes à réviser aujourd'hui — ça prend quelques minutes.");
  });

  it('planifie pour ce matin si avant 9h', async () => {
    jest.setSystemTime(new Date('2026-08-11T07:00:00'));
    await AsyncStorage.setItem('@medflow_revision_reminders_enabled', 'true');
    mockedNotifications.scheduleNotificationAsync.mockResolvedValue('new-id');

    await scheduleRevisionReminder(5);

    const call = mockedNotifications.scheduleNotificationAsync.mock.calls[0][0];
    // 7h -> 9h le même jour = 2h = 7200s
    expect(call.trigger).toEqual({ seconds: 7200 });
  });

  it('planifie pour demain si 9h est déjà passé', async () => {
    jest.setSystemTime(new Date('2026-08-11T14:00:00'));
    await AsyncStorage.setItem('@medflow_revision_reminders_enabled', 'true');
    mockedNotifications.scheduleNotificationAsync.mockResolvedValue('new-id');

    await scheduleRevisionReminder(5);

    const call = mockedNotifications.scheduleNotificationAsync.mock.calls[0][0];
    // 14h -> 9h le lendemain = 19h = 68400s
    expect(call.trigger).toEqual({ seconds: 68400 });
  });

  it('ne replanifie pas si le nombre de cartes dues est identique au dernier appel', async () => {
    jest.setSystemTime(new Date('2026-08-11T07:00:00'));
    await AsyncStorage.setItem('@medflow_revision_reminders_enabled', 'true');
    mockedNotifications.scheduleNotificationAsync.mockResolvedValue('new-id');

    await scheduleRevisionReminder(5);
    await scheduleRevisionReminder(5); // même valeur, ne doit rien refaire

    expect(mockedNotifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
  });

  it('replanifie si le nombre de cartes dues a changé', async () => {
    jest.setSystemTime(new Date('2026-08-11T07:00:00'));
    await AsyncStorage.setItem('@medflow_revision_reminders_enabled', 'true');
    mockedNotifications.scheduleNotificationAsync.mockResolvedValue('new-id');

    await scheduleRevisionReminder(5);
    await scheduleRevisionReminder(8); // valeur différente

    expect(mockedNotifications.scheduleNotificationAsync).toHaveBeenCalledTimes(2);
  });

  it('persiste l\'id du nouveau rappel programmé', async () => {
    jest.setSystemTime(new Date('2026-08-11T07:00:00'));
    await AsyncStorage.setItem('@medflow_revision_reminders_enabled', 'true');
    mockedNotifications.scheduleNotificationAsync.mockResolvedValue('fresh-id-42');

    await scheduleRevisionReminder(3);

    expect(await AsyncStorage.getItem('@medflow_revision_reminder_notification_id')).toBe('fresh-id-42');
  });
});

describe('sendTestRevisionNotification', () => {
  it('renvoie false et ne programme rien si la permission est refusee', async () => {
    mockedNotifications.getPermissionsAsync.mockResolvedValue({ status: 'denied' } as any);
    mockedNotifications.requestPermissionsAsync.mockResolvedValue({ status: 'denied' } as any);

    const result = await sendTestRevisionNotification();

    expect(result).toBe(false);
    expect(mockedNotifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('programme une notification a 5 secondes si la permission est accordee', async () => {
    mockedNotifications.getPermissionsAsync.mockResolvedValue({ status: 'granted' } as any);
    mockedNotifications.scheduleNotificationAsync.mockResolvedValue('test-notif-id');

    const result = await sendTestRevisionNotification();

    expect(result).toBe(true);
    const call = mockedNotifications.scheduleNotificationAsync.mock.calls[0][0];
    expect(call.trigger).toEqual({ seconds: 5 });
  });

  it('n\'utilise pas la cle de notification du vrai rappel (totalement independante)', async () => {
    mockedNotifications.getPermissionsAsync.mockResolvedValue({ status: 'granted' } as any);
    mockedNotifications.scheduleNotificationAsync.mockResolvedValue('test-notif-id');

    await sendTestRevisionNotification();

    // Ne doit jamais ecraser/annuler le vrai rappel programme separement.
    expect(await AsyncStorage.getItem('@medflow_revision_reminder_notification_id')).toBeNull();
  });
});

describe('getRevisionReminderHour / setRevisionReminderHour', () => {
  it('renvoie 9 par defaut si jamais configure', async () => {
    expect(await getRevisionReminderHour()).toBe(9);
  });

  it('renvoie l\'heure choisie apres configuration', async () => {
    await setRevisionReminderHour(18);
    expect(await getRevisionReminderHour()).toBe(18);
  });

  it('bloque les valeurs hors 0-23', async () => {
    await setRevisionReminderHour(30);
    expect(await getRevisionReminderHour()).toBe(23);

    await setRevisionReminderHour(-5);
    expect(await getRevisionReminderHour()).toBe(0);
  });

  it('arrondit une valeur non entiere', async () => {
    await setRevisionReminderHour(14.7);
    expect(await getRevisionReminderHour()).toBe(15);
  });
});

describe('scheduleRevisionReminder — respecte l\'heure personnalisee', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('planifie a l\'heure choisie par l\'utilisateur, pas 9h par defaut', async () => {
    jest.setSystemTime(new Date('2026-08-11T10:00:00'));
    await AsyncStorage.setItem('@medflow_revision_reminders_enabled', 'true');
    await setRevisionReminderHour(18);
    mockedNotifications.scheduleNotificationAsync.mockResolvedValue('new-id');

    await scheduleRevisionReminder(5);

    const call = mockedNotifications.scheduleNotificationAsync.mock.calls[0][0];
    // 10h -> 18h le meme jour = 8h = 28800s
    expect(call.trigger).toEqual({ seconds: 28800 });
  });

  it('change d\'heure force une replanification meme a nombre de cartes identique', async () => {
    jest.setSystemTime(new Date('2026-08-11T07:00:00'));
    await AsyncStorage.setItem('@medflow_revision_reminders_enabled', 'true');
    mockedNotifications.scheduleNotificationAsync.mockResolvedValue('new-id');

    await scheduleRevisionReminder(5);
    await setRevisionReminderHour(20); // change d'heure, meme nombre de cartes
    await scheduleRevisionReminder(5);

    expect(mockedNotifications.scheduleNotificationAsync).toHaveBeenCalledTimes(2);
  });
});