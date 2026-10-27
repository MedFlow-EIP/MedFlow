import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { checkSocialNotifications, newItems } from '../socialNotifications';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  scheduleNotificationAsync: jest.fn().mockResolvedValue('id'),
}));
jest.mock('../authHeaders', () => ({
  getAuthHeaders: jest.fn().mockResolvedValue({ Authorization: 'Bearer t' }),
}));

const user = { uid: 'u1' } as any;
const summary = (requests: string[], challenges: number[] = []) => ({
  friend_requests: requests.map((name) => ({ uid: name.toLowerCase(), displayName: name })),
  challenges: challenges.map((id) => ({ id, friend_name: 'Bob', course_nom: 'Cardio' })),
});
const respond = (body: any) => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => body }) as any;
};

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
});

it('newItems ignore ce qui a déjà été vu', () => {
  const items = newItems(summary(['Alice'], [3]), new Set(['fr:alice']));
  expect(items.map((i) => i.id)).toEqual(['ch:3']);
  expect(items[0].body).toBe('Bob te défie sur « Cardio ».');
});

it('ne notifie pas l’historique à la première vérification', async () => {
  respond(summary(['Alice']));
  await checkSocialNotifications(user);
  expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
});

it('notifie chaque nouveauté une seule fois', async () => {
  respond(summary(['Alice']));
  await checkSocialNotifications(user);

  respond(summary(['Alice', 'Carol'], [7]));
  await checkSocialNotifications(user);
  const bodies = (Notifications.scheduleNotificationAsync as jest.Mock).mock.calls.map((c) => c[0].content.body);
  expect(bodies).toEqual(['Carol veut t’ajouter en ami.', 'Bob te défie sur « Cardio ».']);

  (Notifications.scheduleNotificationAsync as jest.Mock).mockClear();
  await checkSocialNotifications(user);
  expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
});
