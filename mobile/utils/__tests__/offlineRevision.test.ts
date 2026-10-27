import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  flushRevisionQueue,
  gradeOffline,
  pendingCount,
  queueAnswer,
  queueSessionDone,
  readOfflineItems,
  saveDueItems,
} from '../offlineRevision';
import { courseCacheName, saveOffline } from '../offlineCache';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
jest.mock('../authHeaders', () => ({
  getAuthHeaders: jest.fn().mockResolvedValue({ Authorization: 'Bearer t' }),
}));

const UID = 'u1';
const user = { uid: UID } as any;
const course = {
  nom: 'Cardio',
  quiz: [
    { question: 'Q0', options: { A: 'a', B: 'b' }, correct: 'B', explanation: 'Parce que B.' },
    { question: 'Q1', options: { A: 'a', B: 'b' }, correct: 'A' },
  ],
};

beforeEach(async () => {
  await AsyncStorage.clear();
  global.fetch = jest.fn().mockResolvedValue({ status: 200 }) as any;
});

describe('readOfflineItems', () => {
  it('reprend la dernière liste de cartes dues', async () => {
    const items = [{ course_id: 'c', course_nom: 'C', item_index: 0, question: 'Q', options: {} }];
    await saveDueItems(UID, undefined, items);
    expect(await readOfflineItems(UID)).toEqual(items);
  });

  it('sinon, toutes les questions du cours gardé sur le téléphone', async () => {
    await saveOffline(UID, courseCacheName('cardio'), course);
    const items = await readOfflineItems(UID, 'cardio');
    expect(items.map((i) => i.item_index)).toEqual([0, 1]);
    expect(items[0].course_nom).toBe('Cardio');
  });

  it('liste vide sans rien en cache', async () => {
    expect(await readOfflineItems(UID)).toEqual([]);
  });
});

describe('gradeOffline', () => {
  it('corrige avec la copie locale du cours', async () => {
    await saveOffline(UID, courseCacheName('cardio'), course);
    expect(await gradeOffline(UID, 'cardio', 0, 'A')).toEqual({
      correct: false,
      correct_answer: 'B',
      explanation: 'Parce que B.',
    });
    expect((await gradeOffline(UID, 'cardio', 1, 'A'))?.correct).toBe(true);
  });

  it('null si le cours n’est pas sur le téléphone', async () => {
    expect(await gradeOffline(UID, 'absent', 0, 'A')).toBeNull();
  });
});

describe('flushRevisionQueue', () => {
  it('envoie les réponses dans l’ordre puis vide la file', async () => {
    await queueAnswer(UID, { course_id: 'cardio', item_index: 0, selected_option: 'A' });
    await queueSessionDone(UID, { session_type: 'revision' });
    expect(await flushRevisionQueue(user)).toBe(2);
    const paths = (global.fetch as jest.Mock).mock.calls.map((c) => c[0]);
    expect(paths[0]).toMatch(/\/api\/revision\/answer$/);
    expect(paths[1]).toMatch(/\/api\/session-done$/);
    expect(await pendingCount(UID)).toBe(0);
  });

  it('garde la file intacte si le réseau est toujours coupé', async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new TypeError('Network request failed'));
    await queueAnswer(UID, { course_id: 'cardio', item_index: 0, selected_option: 'A' });
    expect(await flushRevisionQueue(user)).toBe(0);
    expect(await pendingCount(UID)).toBe(1);
  });

  it('s’arrête sur une erreur serveur et garde le reste', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({ status: 200 })
      .mockResolvedValueOnce({ status: 503 });
    await queueAnswer(UID, { course_id: 'c', item_index: 0, selected_option: 'A' });
    await queueAnswer(UID, { course_id: 'c', item_index: 1, selected_option: 'A' });
    await queueAnswer(UID, { course_id: 'c', item_index: 2, selected_option: 'A' });
    expect(await flushRevisionQueue(user)).toBe(1);
    expect(await pendingCount(UID)).toBe(2);
  });

  it('abandonne une réponse refusée par le serveur (cours supprimé)', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ status: 404 });
    await queueAnswer(UID, { course_id: 'supprime', item_index: 0, selected_option: 'A' });
    expect(await flushRevisionQueue(user)).toBe(1);
    expect(await pendingCount(UID)).toBe(0);
  });
});
