import AsyncStorage from '@react-native-async-storage/async-storage';
import { buildFromNotes, checkForUpdate, dismissUpdate } from '../appUpdate';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

const release = (build: number) => ({
  ok: true,
  json: async () => ({
    body: `Build #${build}, commit abc. Installe medflow.apk sur Android.`,
    assets: [{ name: 'medflow.apk', browser_download_url: 'https://github.com/x/medflow.apk' }],
  }),
});

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('mise à jour de l’APK', () => {
  it('lit le numéro de build des notes de la release', () => {
    expect(buildFromNotes('Build #42, commit abc')).toBe(42);
    expect(buildFromNotes('rien')).toBe(0);
  });

  it('propose une version plus récente', async () => {
    global.fetch = jest.fn().mockResolvedValue(release(12)) as any;
    expect(await checkForUpdate(10)).toEqual({ build: 12, url: 'https://github.com/x/medflow.apk' });
  });

  it('ne propose rien quand on est à jour', async () => {
    global.fetch = jest.fn().mockResolvedValue(release(10)) as any;
    expect(await checkForUpdate(10)).toBeNull();
  });

  it('ne repropose pas une version écartée avec « Plus tard »', async () => {
    global.fetch = jest.fn().mockResolvedValue(release(12)) as any;
    await dismissUpdate(12);
    expect(await checkForUpdate(10)).toBeNull();
  });

  it('ne vérifie rien en développement (pas de numéro de build)', async () => {
    global.fetch = jest.fn() as any;
    expect(await checkForUpdate(0)).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('ignore une erreur réseau', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('offline')) as any;
    expect(await checkForUpdate(10)).toBeNull();
  });
});
