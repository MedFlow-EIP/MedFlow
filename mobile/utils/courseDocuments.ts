import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Sharing from 'expo-sharing';
import type { User } from 'firebase/auth';
import { API_URL } from '@/services/api';
import { getAuthHeaders } from './authHeaders';
import { UserFacingError } from './network';

// Documents d'origine des cours (PDF, Word, PowerPoint, photo) : téléchargés
// puis ouverts dans la visionneuse du téléphone.

export type CourseDocument = {
  course_id: string;
  nom: string;
  source_name: string;
  source_size: number;
  source_mime: string;
  created_at?: string;
};

export const formatBytes = (bytes?: number | null) => {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} Ko`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} Mo`;
};

/** Nom de fichier sûr pour le cache (le nom d'origine peut contenir n'importe quoi). */
export function cacheFileName(courseId: string, sourceName: string): string {
  const ext = (sourceName.match(/\.[A-Za-z0-9]{1,5}$/)?.[0] ?? '').toLowerCase();
  const base = sourceName.replace(/\.[A-Za-z0-9]{1,5}$/, '').replace(/[^A-Za-z0-9_-]+/g, '_').slice(0, 60) || 'document';
  return `${base}-${courseId.replace(/[^A-Za-z0-9_-]+/g, '').slice(0, 20)}${ext}`;
}

export async function openCourseDocument(user: User, doc: Pick<CourseDocument, 'course_id' | 'source_name' | 'source_mime'>) {
  const folder = `${FileSystem.cacheDirectory}documents/`;
  await FileSystem.makeDirectoryAsync(folder, { intermediates: true }).catch(() => {});
  const path = folder + cacheFileName(doc.course_id, doc.source_name);

  const result = await FileSystem.downloadAsync(
    `${API_URL}/api/course/${encodeURIComponent(doc.course_id)}/source`,
    path,
    { headers: await getAuthHeaders(user) }
  ).catch(() => {
    throw new UserFacingError('Pas de connexion internet. Vérifie ton réseau puis réessaie.');
  });
  if (result.status !== 200) {
    await FileSystem.deleteAsync(path, { idempotent: true }).catch(() => {});
    throw new UserFacingError('Document d’origine indisponible.');
  }

  if (Platform.OS === 'android') {
    try {
      const contentUri = await FileSystem.getContentUriAsync(result.uri);
      await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
        data: contentUri,
        flags: 1, // FLAG_GRANT_READ_URI_PERMISSION : la visionneuse peut lire le fichier
        type: doc.source_mime,
      });
      return;
    } catch {
      // Aucune application pour ce type de fichier : on passe par le partage.
    }
  }
  await Sharing.shareAsync(result.uri, { mimeType: doc.source_mime, dialogTitle: doc.source_name });
}
