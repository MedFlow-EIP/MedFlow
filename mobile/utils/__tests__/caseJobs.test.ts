import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { resumeCaseJobs, startBackgroundCase } from '../caseJobs';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  requestPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  scheduleNotificationAsync: jest.fn().mockResolvedValue('id'),
}));
jest.mock('../authHeaders', () => ({ getAuthHeaders: jest.fn().mockResolvedValue({ Authorization: 'Bearer t' }) }));
jest.mock('../pushNotifications', () => ({ isPushActive: () => false }));

const user = { uid: 'u1' } as any;
const json = (status: number, body: any) => ({ ok: status < 400, status, json: async () => body });

async function flushPoll() {
  jest.advanceTimersByTime(4000);
  for (let i = 0; i < 10; i++) await Promise.resolve();
}

beforeEach(async () => {
  jest.useFakeTimers();
  await AsyncStorage.clear();
  jest.clearAllMocks();
});
afterEach(() => jest.useRealTimers());

it('lance la préparation puis notifie quand le cas est prêt', async () => {
  global.fetch = jest
    .fn()
    .mockResolvedValueOnce(json(202, { id: 9, status: 'generating' }))
    .mockResolvedValueOnce(json(200, { status: 'ready', title: 'Dyspnée aiguë', source_label: 'Pneumo' })) as any;

  const id = await startBackgroundCase(user, { course_id: 'pneumo', difficulty: 'normal' }, 'Pneumo');
  expect(id).toBe(9);
  const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
  expect(body).toEqual({ course_id: 'pneumo', difficulty: 'normal', background: true });

  await flushPoll();
  await Promise.resolve();
  expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
    expect.objectContaining({
      content: expect.objectContaining({ body: 'Dyspnée aiguë', data: { screen: 'ClinicalCase', caseId: 9 } }),
    })
  );
});

it('remonte une erreur de quota', async () => {
  global.fetch = jest.fn().mockResolvedValue(json(429, { error: 'Tu as atteint la limite de cas cliniques.' })) as any;
  await expect(startBackgroundCase(user, { topic: 'Asthme', difficulty: 'normal' }, 'Asthme')).rejects.toThrow(
    'Tu as atteint la limite de cas cliniques.'
  );
});

it('reprend le suivi au redémarrage', async () => {
  await AsyncStorage.setItem('@case_jobs:u1', JSON.stringify([{ caseId: 4, label: 'Asthme' }]));
  global.fetch = jest.fn().mockResolvedValue(json(200, { status: 'error' })) as any;
  await resumeCaseJobs(user);
  await flushPoll();
  await Promise.resolve();
  expect((global.fetch as jest.Mock).mock.calls[0][0]).toMatch(/\/api\/cases\/4$/);
  expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
    expect.objectContaining({ content: expect.objectContaining({ title: 'Cas clinique non créé' }) })
  );
});
