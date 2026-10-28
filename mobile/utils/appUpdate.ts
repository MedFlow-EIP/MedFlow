import AsyncStorage from '@react-native-async-storage/async-storage';

// Les testeurs installent l'APK publié sur GitHub (release « apk-latest »,
// remplacée à chaque build). L'app compare son numéro de build à celui de
// cette release et propose la nouvelle version : pour le cycle 2 du beta
// test, tout le monde doit tester la version corrigée.

const RELEASE_URL = 'https://api.github.com/repos/MedFlow-EIP/MedFlow/releases/tags/apk-latest';
const DISMISSED_KEY = '@update_dismissed_build';

/** Numéro de build injecté par la CI ; absent en développement (pas de vérification). */
export const CURRENT_BUILD = Number(process.env.EXPO_PUBLIC_BUILD_NUMBER) || 0;

export type AvailableUpdate = { build: number; url: string };

/** Le numéro de build écrit par la CI dans les notes de la release (« Build #42, … »). */
export function buildFromNotes(notes: string | null | undefined): number {
  const match = /Build #(\d+)/.exec(notes ?? '');
  return match ? Number(match[1]) : 0;
}

/** Une version plus récente que celle installée, pas encore écartée par « Plus tard ». */
export async function checkForUpdate(current: number = CURRENT_BUILD): Promise<AvailableUpdate | null> {
  if (!current) return null;
  try {
    const res = await fetch(RELEASE_URL, { headers: { Accept: 'application/vnd.github+json' } });
    if (!res.ok) return null;
    const release = await res.json();
    const build = buildFromNotes(release?.body);
    const apk = (release?.assets ?? []).find((a: any) => typeof a?.name === 'string' && a.name.endsWith('.apk'));
    if (!build || build <= current || !apk?.browser_download_url) return null;
    const dismissed = Number(await AsyncStorage.getItem(DISMISSED_KEY).catch(() => null)) || 0;
    if (dismissed >= build) return null;
    return { build, url: apk.browser_download_url };
  } catch {
    return null; // Hors ligne ou GitHub indisponible : on réessaiera au prochain lancement.
  }
}

export async function dismissUpdate(build: number): Promise<void> {
  await AsyncStorage.setItem(DISMISSED_KEY, String(build)).catch(() => {});
}
