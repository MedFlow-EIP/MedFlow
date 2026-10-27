import * as Sentry from '@sentry/react-native';

// Plantages de l'app vers Sentry (facultatif) : inactif tant que
// EXPO_PUBLIC_SENTRY_DSN n'est pas défini. Aucune donnée personnelle :
// pas d'identifiant, pas d'email, pas de contenu de requête.

const DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;

export const sentryEnabled = !!DSN && !__DEV__;

/** Retire tout ce qui pourrait identifier l'utilisateur ou décrire ses cours. */
export function scrubEvent<T extends { user?: unknown; request?: any; breadcrumbs?: any[] }>(event: T): T {
  delete event.user;
  if (event.request) {
    delete event.request.data;
    delete event.request.headers;
    delete event.request.cookies;
    delete event.request.query_string;
  }
  // Fil d'Ariane : on garde la navigation et les URL appelées, pas les données.
  event.breadcrumbs = (event.breadcrumbs ?? []).map((b: any) => ({ ...b, data: b?.data?.url ? { url: b.data.url } : undefined }));
  return event;
}

export function initSentry() {
  if (!sentryEnabled) return;
  Sentry.init({
    dsn: DSN,
    sendDefaultPii: false,
    // Erreurs seulement : pas de suivi de performance (plan gratuit).
    tracesSampleRate: 0,
    beforeSend: (event) => scrubEvent(event as any),
  });
}

/** Enveloppe le composant racine (capture des erreurs de rendu) si Sentry est actif. */
export function withSentry<P extends object>(App: React.ComponentType<P>): React.ComponentType<P> {
  return sentryEnabled ? (Sentry.wrap(App as any) as React.ComponentType<P>) : App;
}
