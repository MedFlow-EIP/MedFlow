import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { resumeImportJobs, startBackgroundImport } from '../importJobs';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  requestPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  scheduleNotificationAsync: jest.fn().mockResolvedValue('id'),
}));
jest.mock('../authHeaders', () => ({
  getAuthHeaders: jest.fn().mockResolvedValue({ Authorization: 'Bearer t' }),
}));

const user = { uid: 'u1' } as any;
const json = (status: number, body: any) => ({ ok: status < 400, status, json: async () => body });

beforeEach(async () => {
  jest.useFakeTimers();
  await AsyncStorage.clear();
  jest.clearAllMocks();
  Object.defineProperty(AppState, 'currentState', { value: 'background', configurable: true, writable: true });
});
afterEach(() => jest.useRealTimers());

async function flushPoll() {
  jest.advanceTimersByTime(4000);
  // Laisse s'exécuter les promesses du tour de suivi.
  for (let i = 0; i < 10; i++) await Promise.resolve();
}

it('lance l’import puis notifie quand le cours est prêt', async () => {
  global.fetch = jest
    .fn()
    .mockResolvedValueOnce(json(202, { job_id: 'j1', status: 'processing' }))
    .mockResolvedValueOnce(json(200, { status: 'processing' }))
    .mockResolvedValueOnce(json(200, { status: 'done', course_id: 'c1', course_nom: 'Cardio', file_name: 'cardio.pdf' })) as any;

  const started = await startBackgroundImport(user, new FormData(), 'cardio.pdf');
  expect('job' in started && started.job.status).toBe('processing');
  expect(JSON.parse((await AsyncStorage.getItem('@import_jobs:u1'))!)).toEqual([{ jobId: 'j1', fileName: 'cardio.pdf' }]);

  await flushPoll();
  expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  await flushPoll();
  await Promise.resolve();
  expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
    expect.objectContaining({
      content: expect.objectContaining({ body: '« Cardio » est prêt à réviser.', data: { courseId: 'c1' } }),
    })
  );
  expect(JSON.parse((await AsyncStorage.getItem('@import_jobs:u1'))!)).toEqual([]);
});

it('signale un document déjà importé sans lancer d’import', async () => {
  global.fetch = jest.fn().mockResolvedValue(json(409, { code: 'duplicate', course_id: 'c9', nom: 'Neuro' })) as any;
  const res = await startBackgroundImport(user, new FormData(), 'neuro.pdf');
  expect(res).toEqual({ duplicate: { courseId: 'c9', courseName: 'Neuro' } });
});

it('remonte l’erreur du serveur', async () => {
  global.fetch = jest.fn().mockResolvedValue(json(429, { error: 'Trop d’imports aujourd’hui' })) as any;
  await expect(startBackgroundImport(user, new FormData(), 'a.pdf')).rejects.toThrow('Trop d’imports aujourd’hui');
});

it('reprend le suivi au redémarrage de l’app', async () => {
  await AsyncStorage.setItem('@import_jobs:u1', JSON.stringify([{ jobId: 'j7', fileName: 'x.pdf' }]));
  global.fetch = jest.fn().mockResolvedValue(json(200, { status: 'error', error: 'Interrompu', file_name: 'x.pdf' })) as any;
  await resumeImportJobs(user);
  await flushPoll();
  await Promise.resolve();
  expect((global.fetch as jest.Mock).mock.calls[0][0]).toMatch(/\/api\/process\/jobs\/j7$/);
  expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
    expect.objectContaining({ content: expect.objectContaining({ title: 'Import échoué' }) })
  );
});
