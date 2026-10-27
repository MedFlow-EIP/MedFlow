import { getAuth } from 'firebase/auth';
import { API_URL } from '@/services/api';
import { getAuthHeaders } from './authHeaders';

/**
 * Journalise qu'un écran a été vu — signal purement analytique, jamais
 * affiché à l'utilisateur. Sert au diagnostic de frictions (objectif 2
 * du track EIP) : repérer les écrans où les gens arrivent sans jamais
 * agir derrière.
 *
 * Fire-and-forget volontaire : un échec ici ne doit jamais impacter
 * l'expérience utilisateur. Appeler dans un useEffect au montage de
 * l'écran à suivre.
 */
/**
 * Journalise une étape d'un parcours clé (import, révision, chat…), pour
 * voir où les gens s'arrêtent. Même principe : jamais bloquant. Le nom doit
 * figurer dans la liste du serveur (ANALYTICS_EVENTS), sinon il est refusé.
 */
export async function logEvent(event: string, detail?: string): Promise<void> {
  const user = getAuth().currentUser;
  if (!user) return;
  try {
    const headers = await getAuthHeaders(user);
    await fetch(`${API_URL}/api/analytics/event`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(detail === undefined ? { event } : { event, detail }),
    });
  } catch {
    // Silencieux : l'analytique ne doit jamais gêner l'utilisateur.
  }
}

export async function logScreenView(screenName: string): Promise<void> {
  const user = getAuth().currentUser;
  if (!user) return;

  try {
    const headers = await getAuthHeaders(user);
    await fetch(`${API_URL}/api/analytics/screen-view`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ screen: screenName }),
    });
  } catch (err) {
    console.error(`Erreur tracking screen_view (${screenName}):`, err);
  }
}