import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

import {
  logTutorialStarted,
  logStepViewed,
  logTutorialSkipped,
  logTutorialCompleted,
  getTutorialEvents,
  getTutorialAnalyticsSummary,
  clearTutorialEvents,
} from '../tutorialAnalytics';

// Les fonctions de log sont "fire-and-forget" (non-async côté appelant),
// exactement comme dans le vrai code (TutorialScreen ne les attend pas
// non plus). On laisse les micro-tâches se vider avant de vérifier.
const flush = () => new Promise((resolve) => setImmediate(resolve));

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('getTutorialEvents', () => {
  it('renvoie un tableau vide au départ', async () => {
    expect(await getTutorialEvents()).toEqual([]);
  });

  it('renvoie [] (repli sûr) si AsyncStorage contient du JSON invalide', async () => {
    await AsyncStorage.setItem('@medflow_tutorial_events', 'pas du json valide {{{');
    expect(await getTutorialEvents()).toEqual([]);
  });
});

describe('logTutorialStarted', () => {
  it('journalise un événement tutorial_started et renvoie son timestamp', async () => {
    const before = Date.now();
    const startedAt = logTutorialStarted();
    await flush();

    expect(startedAt).toBeGreaterThanOrEqual(before);

    const events = await getTutorialEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ type: 'tutorial_started', timestamp: startedAt });
  });
});

describe('logStepViewed', () => {
  it('journalise l\'étape avec le délai depuis le début', async () => {
    const startedAt = 1000;
    logStepViewed(startedAt, 2, 'streak_tab', 'Onglet Progrès');
    await flush();

    const events = await getTutorialEvents();
    expect(events[0]).toMatchObject({
      type: 'step_viewed',
      stepIndex: 2,
      stepId: 'streak_tab',
      stepTitle: 'Onglet Progrès',
    });
    expect((events[0] as any).msSinceStart).toBeGreaterThanOrEqual(0);
  });
});

describe('logTutorialSkipped', () => {
  it('journalise l\'étape exacte où l\'utilisateur a quitté', async () => {
    logTutorialSkipped(1000, 3, 'aichat_tab', 'Assistant IA');
    await flush();

    const events = await getTutorialEvents();
    expect(events[0]).toMatchObject({
      type: 'tutorial_skipped',
      atStepIndex: 3,
      atStepId: 'aichat_tab',
      atStepTitle: 'Assistant IA',
    });
  });
});

describe('logTutorialCompleted', () => {
  it('journalise la complétion avec la durée totale', async () => {
    logTutorialCompleted(1000);
    await flush();

    const events = await getTutorialEvents();
    expect(events[0].type).toBe('tutorial_completed');
    expect((events[0] as any).msSinceStart).toBeGreaterThanOrEqual(0);
  });
});

describe('clearTutorialEvents', () => {
  it('efface tous les événements journalisés', async () => {
    logTutorialStarted();
    await flush();
    expect(await getTutorialEvents()).toHaveLength(1);

    await clearTutorialEvents();

    expect(await getTutorialEvents()).toEqual([]);
  });
});

describe('getTutorialAnalyticsSummary', () => {
  it('started=false et completed=false quand rien n\'a été journalisé', async () => {
    const summary = await getTutorialAnalyticsSummary();

    expect(summary.started).toBe(false);
    expect(summary.completed).toBe(false);
    expect(summary.droppedAtStep).toBeNull();
    expect(summary.timeToFirstActionMs).toBeNull();
  });

  it('calcule timeToFirstActionMs depuis le 2e step_viewed (le 1er "Suivant" pressé)', async () => {
    logTutorialStarted();
    logStepViewed(1000, 0, 'welcome', 'Bienvenue');
    await flush();
    logStepViewed(1000, 1, 'home_tab', 'Onglet Accueil');
    await flush();

    const summary = await getTutorialAnalyticsSummary();

    // Le tout premier step_viewed (étape 0) ne compte pas comme une
    // action — c'est juste l'affichage initial. Le 2e (étape 1) est le
    // premier "Suivant" réellement pressé.
    expect(summary.timeToFirstActionMs).not.toBeNull();
    expect(summary.stepsViewedCount).toBe(2);
  });

  it('timeToFirstActionMs reste null s\'il n\'y a eu qu\'une seule étape vue', async () => {
    logStepViewed(1000, 0, 'welcome', 'Bienvenue');
    await flush();

    const summary = await getTutorialAnalyticsSummary();

    expect(summary.timeToFirstActionMs).toBeNull();
  });

  it('remplit droppedAtStep quand le tutoriel a été passé', async () => {
    logTutorialStarted();
    await flush();
    logTutorialSkipped(1000, 3, 'aichat_tab', 'Assistant IA');
    await flush();

    const summary = await getTutorialAnalyticsSummary();

    expect(summary.completed).toBe(false);
    expect(summary.droppedAtStep).toEqual({ index: 3, title: 'Assistant IA' });
  });

  it('completed=true et droppedAtStep=null quand le tutoriel est allé au bout', async () => {
    logTutorialStarted();
    await flush();
    logTutorialCompleted(1000);
    await flush();

    const summary = await getTutorialAnalyticsSummary();

    expect(summary.completed).toBe(true);
    expect(summary.droppedAtStep).toBeNull();
  });
});