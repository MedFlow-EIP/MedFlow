import { Platform, Share } from 'react-native';
import * as FileSystem from 'expo-file-system';
import type { User } from 'firebase/auth';
import { API_URL } from '@/services/api';
import { getAuthHeaders } from './authHeaders';
import { fetchWithTimeout, readJsonOrThrow } from './network';

export type ExportResult = 'saved' | 'shared' | 'cancelled';

/**
 * Export RGPD : récupère toutes les données du compte et les enregistre dans
 * un fichier JSON. Android : l'utilisateur choisit le dossier. iOS : feuille
 * de partage.
 */
export async function exportUserData(user: User): Promise<ExportResult> {
  const res = await fetchWithTimeout(
    `${API_URL}/api/account/export`,
    { headers: await getAuthHeaders(user) },
    60_000
  );
  const data = await readJsonOrThrow(res, 'Export impossible. Réessaie.');
  const json = JSON.stringify(data, null, 2);
  const baseName = `medflow-donnees-${new Date().toISOString().slice(0, 10)}`;

  if (Platform.OS === 'android') {
    const saf = FileSystem.StorageAccessFramework;
    const permission = await saf.requestDirectoryPermissionsAsync();
    if (!permission.granted) return 'cancelled';
    // Sans extension : Android l'ajoute d'après le type MIME.
    const uri = await saf.createFileAsync(permission.directoryUri, baseName, 'application/json');
    await FileSystem.writeAsStringAsync(uri, json, { encoding: FileSystem.EncodingType.UTF8 });
    return 'saved';
  }

  const path = `${FileSystem.cacheDirectory}${baseName}.json`;
  await FileSystem.writeAsStringAsync(path, json, { encoding: FileSystem.EncodingType.UTF8 });
  const result = await Share.share({ url: path, title: 'Mes données MedFlow' });
  return result.action === Share.dismissedAction ? 'cancelled' : 'shared';
}
