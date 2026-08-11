import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

import { isFirstTimeUser, markTutorialCompleted, resetTutorial } from '../firstTime';

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
});

describe('isFirstTimeUser', () => {
  it('renvoie true quand rien n\'est stocké (jamais vu le tutoriel)', async () => {
    expect(await isFirstTimeUser()).toBe(true);
  });

  it('renvoie false une fois le tutoriel marqué comme terminé', async () => {
    await markTutorialCompleted();
    expect(await isFirstTimeUser()).toBe(false);
  });

  it('renvoie true (repli sûr) si AsyncStorage lève une erreur', async () => {
    jest.spyOn(AsyncStorage, 'getItem').mockRejectedValueOnce(new Error('disque plein'));
    expect(await isFirstTimeUser()).toBe(true);
  });
});

describe('markTutorialCompleted', () => {
  it('persiste l\'état "completed"', async () => {
    await markTutorialCompleted();
    expect(await AsyncStorage.getItem('@medflow_first_time')).toBe('completed');
  });

  it('ne lève pas d\'exception si AsyncStorage échoue', async () => {
    jest.spyOn(AsyncStorage, 'setItem').mockRejectedValueOnce(new Error('disque plein'));
    await expect(markTutorialCompleted()).resolves.not.toThrow();
  });
});

describe('resetTutorial', () => {
  it('efface l\'état stocké — le tutoriel redevient "jamais vu"', async () => {
    await markTutorialCompleted();
    expect(await isFirstTimeUser()).toBe(false);

    await resetTutorial();

    expect(await isFirstTimeUser()).toBe(true);
  });

  it('ne lève pas d\'exception si AsyncStorage échoue', async () => {
    jest.spyOn(AsyncStorage, 'removeItem').mockRejectedValueOnce(new Error('disque plein'));
    await expect(resetTutorial()).resolves.not.toThrow();
  });
});