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