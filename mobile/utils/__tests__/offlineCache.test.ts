import AsyncStorage from '@react-native-async-storage/async-storage';
import { readOffline, saveOffline, removeOffline } from '../offlineCache';

jest.mock('@react-native-async-storage/async-storage', () => {
  const store: Record<string, string> = {};
  return {
    setItem: jest.fn(async (k: string, v: string) => { store[k] = v; }),
    getItem: jest.fn(async (k: string) => store[k] ?? null),
    removeItem: jest.fn(async (k: string) => { delete store[k]; }),
  };
});

describe('offlineCache', () => {
  it('relit ce qui a été sauvegardé', async () => {
    await saveOffline('u1', 'course:c1', { nom: 'Anatomie' });
    expect(await readOffline('u1', 'course:c1')).toEqual({ nom: 'Anatomie' });
  });

  it('isole les données de chaque utilisateur', async () => {
    await saveOffline('u1', 'dashboard', { cours: [1] });
    expect(await readOffline('u2', 'dashboard')).toBeNull();
  });

  it('renvoie null après suppression', async () => {
    await saveOffline('u1', 'course:c2', { nom: 'X' });
    await removeOffline('u1', 'course:c2');
    expect(await readOffline('u1', 'course:c2')).toBeNull();
  });

  it('renvoie null si le stockage échoue', async () => {
    (AsyncStorage.getItem as jest.Mock).mockRejectedValueOnce(new Error('disk'));
    expect(await readOffline('u1', 'course:c1')).toBeNull();
  });
});
