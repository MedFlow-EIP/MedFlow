import AsyncStorage from '@react-native-async-storage/async-storage';

// Cache local des cours pour la consultation hors ligne. Toujours rangé par
// utilisateur : deux comptes sur le même téléphone ne partagent rien.

const key = (uid: string, name: string) => `@offline:${uid}:${name}`;

export async function saveOffline<T>(uid: string, name: string, value: T): Promise<void> {
  try {
    await AsyncStorage.setItem(key(uid, name), JSON.stringify({ savedAt: Date.now(), value }));
  } catch {
    // Best-effort : un cache plein ne doit jamais casser l'écran.
  }
}

export async function readOffline<T>(uid: string, name: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key(uid, name));
    return raw ? (JSON.parse(raw).value as T) : null;
  } catch {
    return null;
  }
}

export async function removeOffline(uid: string, name: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key(uid, name));
  } catch {
    // ignoré
  }
}

export const courseCacheName = (courseId: string) => `course:${courseId}`;
export const DASHBOARD_CACHE_NAME = 'dashboard';
