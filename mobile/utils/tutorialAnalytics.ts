import AsyncStorage from '@react-native-async-storage/async-storage';

const EVENTS_KEY = '@medflow_tutorial_events';

export type TutorialEvent =
  | { type: 'tutorial_started'; timestamp: number }
  | {
      type: 'step_viewed';
      stepIndex: number;
      stepId: string;
      stepTitle: string;
      timestamp: number;
      msSinceStart: number;
    }
  | {
      type: 'tutorial_skipped';
      atStepIndex: number;
      atStepId: string;
      atStepTitle: string;
      timestamp: number;
      msSinceStart: number;
    }
  | { type: 'tutorial_completed'; timestamp: number; msSinceStart: number };

async function appendEvent(event: TutorialEvent): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(EVENTS_KEY);
    const events: TutorialEvent[] = raw ? JSON.parse(raw) : [];
    events.push(event);
    await AsyncStorage.setItem(EVENTS_KEY, JSON.stringify(events));
    console.log('[tutorial analytics]', event);
  } catch (error) {
    console.error('Erreur log analytics tutoriel:', error);
  }
}

export function logTutorialStarted(): number {
  const timestamp = Date.now();
  appendEvent({ type: 'tutorial_started', timestamp });
  return timestamp;
}

export function logStepViewed(
  startedAt: number,
  stepIndex: number,
  stepId: string,
  stepTitle: string
): void {
  const timestamp = Date.now();
  appendEvent({
    type: 'step_viewed',
    stepIndex,
    stepId,
    stepTitle,
    timestamp,
    msSinceStart: timestamp - startedAt,
  });
}

export function logTutorialSkipped(
  startedAt: number,
  atStepIndex: number,
  atStepId: string,
  atStepTitle: string
): void {
  const timestamp = Date.now();
  appendEvent({
    type: 'tutorial_skipped',
    atStepIndex,
    atStepId,
    atStepTitle,
    timestamp,
    msSinceStart: timestamp - startedAt,
  });
}

export function logTutorialCompleted(startedAt: number): void {
  const timestamp = Date.now();
  appendEvent({
    type: 'tutorial_completed',
    timestamp,
    msSinceStart: timestamp - startedAt,
  });
}

/** Récupère tous les événements bruts, dans l'ordre chronologique. */
export async function getTutorialEvents(): Promise<TutorialEvent[]> {
  try {
    const raw = await AsyncStorage.getItem(EVENTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (error) {
    console.error('Erreur lecture analytics tutoriel:', error);
    return [];
  }
}

/**
 * Résumé directement exploitable pour l'objectif usabilité du track EIP :
 * - timeToFirstActionMs : délai jusqu'au premier "Suivant" (première action
 *   délibérée qui fonctionne, cf. guide "time to first successful action")
 * - droppedAtStep : étape à laquelle l'utilisateur a quitté, si abandon
 * - completed : est allé jusqu'au bout
 */
export async function getTutorialAnalyticsSummary() {
  const events = await getTutorialEvents();

  const started = events.find((e) => e.type === 'tutorial_started');
  const steps = events.filter((e) => e.type === 'step_viewed') as Extract<
    TutorialEvent,
    { type: 'step_viewed' }
  >[];
  const skipped = events.find((e) => e.type === 'tutorial_skipped') as
    | Extract<TutorialEvent, { type: 'tutorial_skipped' }>
    | undefined;
  const completed = events.find((e) => e.type === 'tutorial_completed') as
    | Extract<TutorialEvent, { type: 'tutorial_completed' }>
    | undefined;

  // Le 2e step_viewed correspond au premier "Suivant" pressé (le 1er est
  // l'affichage de l'étape d'accueil, à msSinceStart ~0).
  const timeToFirstActionMs = steps.length > 1 ? steps[1].msSinceStart : null;

  return {
    started: !!started,
    completed: !!completed,
    droppedAtStep: skipped ? { index: skipped.atStepIndex, title: skipped.atStepTitle } : null,
    timeToFirstActionMs,
    totalDurationMs: completed?.msSinceStart ?? skipped?.msSinceStart ?? null,
    stepsViewedCount: steps.length,
  };
}

export async function clearTutorialEvents(): Promise<void> {
  try {
    await AsyncStorage.removeItem(EVENTS_KEY);
  } catch (error) {
    console.error('Erreur reset analytics tutoriel:', error);
  }
}