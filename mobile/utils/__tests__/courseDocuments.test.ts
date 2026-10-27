import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Sharing from 'expo-sharing';
import { cacheFileName, formatBytes, openCourseDocument } from '../courseDocuments';

jest.mock('expo-file-system', () => ({
  cacheDirectory: 'file:///cache/',
  makeDirectoryAsync: jest.fn().mockResolvedValue(undefined),
  downloadAsync: jest.fn(),
  deleteAsync: jest.fn().mockResolvedValue(undefined),
  getContentUriAsync: jest.fn().mockResolvedValue('content://doc'),
}));
jest.mock('expo-intent-launcher', () => ({ startActivityAsync: jest.fn().mockResolvedValue({}) }));
jest.mock('expo-sharing', () => ({ shareAsync: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../authHeaders', () => ({ getAuthHeaders: jest.fn().mockResolvedValue({ Authorization: 'Bearer t' }) }));

const doc = { course_id: 'cardio-2', source_name: 'Cours cardio (S1).pdf', source_mime: 'application/pdf' };
const user = { uid: 'u1' } as any;

it('formate les tailles', () => {
  expect(formatBytes(512)).toBe('1 Ko');
  expect(formatBytes(2.5 * 1024 * 1024)).toBe('2,5 Mo');
  expect(formatBytes(null)).toBe('');
});

it('produit un nom de fichier sûr avec l’extension', () => {
  expect(cacheFileName('cardio-2', '../../Cours cardio (S1).pdf')).toBe('_Cours_cardio_S1_-cardio-2.pdf');
});

it('télécharge avec le token puis ouvre le document', async () => {
  (FileSystem.downloadAsync as jest.Mock).mockResolvedValue({ status: 200, uri: 'file:///cache/documents/x.pdf' });
  await openCourseDocument(user, doc);
  expect((FileSystem.downloadAsync as jest.Mock).mock.calls[0][2]).toEqual({ headers: { Authorization: 'Bearer t' } });
  if (Platform.OS === 'android') expect(IntentLauncher.startActivityAsync).toHaveBeenCalled();
  else expect(Sharing.shareAsync).toHaveBeenCalledWith('file:///cache/documents/x.pdf', expect.anything());
});

it('signale un document indisponible', async () => {
  (FileSystem.downloadAsync as jest.Mock).mockResolvedValue({ status: 404, uri: 'file:///cache/documents/x.pdf' });
  await expect(openCourseDocument(user, doc)).rejects.toThrow('Document d’origine indisponible.');
});
