// Appels réseau avec délai maximum et messages d'erreur compréhensibles :
// plus de chargement infini quand le réseau coupe en plein import ou en plein chat.

export const NETWORK_ERROR_MESSAGE = 'Pas de connexion internet. Vérifie ton réseau puis réessaie.';
export const TIMEOUT_ERROR_MESSAGE = 'Le serveur met trop de temps à répondre. Réessaie dans un instant.';
export const SERVER_ERROR_MESSAGE = 'Le serveur rencontre un problème. Réessaie dans un instant.';

/** Erreur déjà formulée pour l'utilisateur : son message peut être affiché tel quel. */
export class UserFacingError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
    this.name = 'UserFacingError';
  }
}

/** fetch qui abandonne au bout de ``timeoutMs`` (30 s par défaut). */
export async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = 30_000
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (err: any) {
    if (err?.name === 'AbortError') throw new UserFacingError(TIMEOUT_ERROR_MESSAGE);
    throw new UserFacingError(NETWORK_ERROR_MESSAGE);
  } finally {
    clearTimeout(timer);
  }
}

/** Message à montrer pour une réponse HTTP en erreur. */
export function httpErrorMessage(status: number, body: any, fallback: string): string {
  if (body && typeof body.error === 'string' && body.error) return body.error;
  if (status >= 500) return SERVER_ERROR_MESSAGE;
  return fallback;
}

/**
 * Lit la réponse JSON et lève une UserFacingError si le statut est en erreur
 * (message du serveur quand il y en a un).
 */
export async function readJsonOrThrow<T = any>(res: Response, fallback: string): Promise<T> {
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new UserFacingError(httpErrorMessage(res.status, body, fallback), res.status);
  if (body === null) throw new UserFacingError(fallback, res.status);
  return body as T;
}

/** Message d'erreur à afficher, quelle que soit l'erreur attrapée. */
export function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof UserFacingError) return err.message;
  return fallback;
}
