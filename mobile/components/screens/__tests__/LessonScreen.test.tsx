import React from 'react';
import { ActivityIndicator } from 'react-native';
import { render, screen, waitFor, fireEvent } from '@testing-library/react-native';
import { auth } from '../../../firebaseConfig';
import {
  hasSeenNotificationPrompt,
  markNotificationPromptSeen,
  enableStreakReminders,
  scheduleReminderIfNeeded,
} from '../../../utils/streakNotifications';
import { LessonScreen } from '../LessonScreen';

jest.mock('../../../theme/ThemeContext', () => ({
  useTheme: () => ({ colors: require('../../../theme/colors').lightColors, isDark: false }),
}));

jest.mock('../../../firebaseConfig', () => ({
  auth: { currentUser: null as any },
}));

jest.mock('../../../utils/authHeaders', () => ({
  getAuthHeaders: jest.fn().mockResolvedValue({ Authorization: 'Bearer fake-token' }),
}));

jest.mock('../../../utils/streakNotifications', () => ({
  scheduleReminderIfNeeded: jest.fn(),
  enableStreakReminders: jest.fn().mockResolvedValue(true),
  hasSeenNotificationPrompt: jest.fn().mockResolvedValue(true),
  markNotificationPromptSeen: jest.fn().mockResolvedValue(undefined),
}));

// Les 5 étapes de quiz ont chacune leur propre UI complexe (swipe, timer,
// zones tactiles sur image...) — hors scope ici. On les remplace par un
// simple bouton "Continuer <n>" pour se concentrer sur la vraie logique de
// LessonScreen : l'enchaînement des étapes, la complétion, et les modals.
jest.mock('../../../components/steps/ExplanationStep', () => {
  const { TouchableOpacity, Text } = require('react-native');
  return {
    ExplanationStep: ({ onContinue }: any) => (
      <TouchableOpacity onPress={onContinue}><Text>Continuer 1</Text></TouchableOpacity>
    ),
  };
});
jest.mock('../../../components/steps/SwipeCardsStep', () => {
  const { TouchableOpacity, Text } = require('react-native');
  return {
    SwipeCardsStep: ({ onComplete }: any) => (
      <TouchableOpacity onPress={() => onComplete()}><Text>Continuer 2</Text></TouchableOpacity>
    ),
  };
});
jest.mock('../../../components/steps/VisualDiscoveryStep', () => {
  const { TouchableOpacity, Text } = require('react-native');
  return {
    VisualDiscovery: ({ onComplete }: any) => (
      <TouchableOpacity onPress={() => onComplete(true)}><Text>Continuer 3</Text></TouchableOpacity>
    ),
  };
});
jest.mock('../../../components/steps/SpeedChallengeStep', () => {
  const { TouchableOpacity, Text } = require('react-native');
  return {
    SpeedChallengeStep: ({ onComplete }: any) => (
      <TouchableOpacity onPress={() => onComplete(true)}><Text>Continuer 4</Text></TouchableOpacity>
    ),
  };
});
jest.mock('../../../components/steps/QuickQuizzCardsStep', () => {
  const { TouchableOpacity, Text } = require('react-native');
  return {
    QuickQuizCardsStep: ({ onComplete }: any) => (
      <TouchableOpacity onPress={() => onComplete(true)}><Text>Continuer 5</Text></TouchableOpacity>
    ),
  };
});

function mockJsonResponse(body: any, ok = true, status = 200) {
  return { ok, status, json: async () => body } as any;
}

const fakePath = { id: 'anatomy', title: 'Anatomie', color: '#3b82f6' };
const fakeLesson = { id: '1', title: 'Introduction', xp: 15 };
const fakeNavigation = { goBack: jest.fn() };

function renderLessonScreen() {
  return render(
    <LessonScreen
      navigation={fakeNavigation}
      route={{ params: { path: fakePath, lesson: fakeLesson } }}
    />
  );
}

/** Clique sur les 5 boutons "Continuer" mockés pour atteindre l'écran de résultats. */
async function goThroughAllSteps() {
  for (let i = 1; i <= 5; i++) {
    const button = await screen.findByText(`Continuer ${i}`);
    fireEvent.press(button);
  }
}

beforeEach(() => {
  (auth as any).currentUser = { uid: 'test-uid' };
  global.fetch = jest.fn().mockImplementation((url: string) => {
    if (url.includes('/complete')) {
      return Promise.resolve(mockJsonResponse({ success: true, newBadges: [] }));
    }
    if (url.includes('/api/account')) {
      return Promise.resolve(
        mockJsonResponse({ stats: { streak: 3, lastActivity: '2026-08-11' } })
      );
    }
    return Promise.reject(new Error(`URL inattendue: ${url}`));
  });
  jest.spyOn(console, 'error').mockImplementation(() => {});
  (hasSeenNotificationPrompt as jest.Mock).mockResolvedValue(true);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('LessonScreen — parcours des étapes', () => {
  it('affiche la première étape au départ', () => {
    renderLessonScreen();
    expect(screen.getByText('Continuer 1')).toBeTruthy();
  });

  it('passe à l\'écran de résultats après la dernière étape', async () => {
    renderLessonScreen();

    await goThroughAllSteps();

    await waitFor(() => {
      expect(screen.getByText('Leçon terminée !')).toBeTruthy();
    });
  });
});

describe('LessonScreen — complétion (régression connue : timing)', () => {
  // Bug réel corrigé en session : /complete était auparavant appelé au TAP
  // sur le node dans PathScreen, avant même d'avoir fait la leçon. La
  // complétion doit se déclencher UNIQUEMENT en atteignant l'écran de
  // résultats, jamais avant.
  it('n\'appelle PAS /complete tant que toutes les étapes ne sont pas terminées', () => {
    renderLessonScreen();

    expect(
      (global.fetch as jest.Mock).mock.calls.some((c) => c[0].includes('/complete'))
    ).toBe(false);
  });

  it('appelle /complete avec le bon path.id et lesson.id une fois les résultats affichés', async () => {
    renderLessonScreen();
    await goThroughAllSteps();

    await waitFor(() => {
      const completeCall = (global.fetch as jest.Mock).mock.calls.find((c) =>
        c[0].includes('/complete')
      );
      expect(completeCall).toBeTruthy();
      expect(completeCall[0]).toContain('/api/lessons/anatomy/1/complete');
    });
  });

  it('affiche l\'XP de la leçon (+15 XP)', async () => {
    renderLessonScreen();
    await goThroughAllSteps();

    await waitFor(() => {
      expect(screen.getByText('+15 XP')).toBeTruthy();
    });
  });
});

describe('LessonScreen — affichage du streak (régression connue : loader infini)', () => {
  it('affiche un loader pendant la récupération du streak, puis la vraie valeur', async () => {
    renderLessonScreen();
    await goThroughAllSteps();

    await waitFor(() => {
      expect(screen.getByText('Série : 3j')).toBeTruthy();
    });
  });

  it('affiche "—" (pas un loader bloqué) si la récupération du streak échoue', async () => {
    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('/complete')) {
        return Promise.resolve(mockJsonResponse({ success: true, newBadges: [] }));
      }
      return Promise.reject(new Error('network down'));
    });

    renderLessonScreen();
    await goThroughAllSteps();

    await waitFor(() => {
      expect(screen.getByText('Série : —')).toBeTruthy();
    });
    expect(screen.UNSAFE_queryByType(ActivityIndicator)).toBeFalsy();
  });
});

describe('LessonScreen — badges débloqués', () => {
  it('affiche la popup de badge quand /complete en renvoie un nouveau', async () => {
    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('/complete')) {
        return Promise.resolve(
          mockJsonResponse({
            success: true,
            newBadges: [
              {
                id: 'first_lesson',
                title: 'Premiers pas',
                description: 'Terminer votre première leçon',
                icon: 'school',
                color: '#3b82f6',
              },
            ],
          })
        );
      }
      return Promise.resolve(mockJsonResponse({ stats: { streak: 1, lastActivity: '2026-08-11' } }));
    });

    renderLessonScreen();
    await goThroughAllSteps();

    await waitFor(() => {
      expect(screen.getByText('Premiers pas')).toBeTruthy();
    });
  });

  it('propose d\'activer les notifs après avoir fermé le badge "Premiers pas", si jamais proposé avant', async () => {
    (hasSeenNotificationPrompt as jest.Mock).mockResolvedValue(false);
    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('/complete')) {
        return Promise.resolve(
          mockJsonResponse({
            success: true,
            newBadges: [
              {
                id: 'first_lesson',
                title: 'Premiers pas',
                description: 'x',
                icon: 'school',
                color: '#3b82f6',
              },
            ],
          })
        );
      }
      return Promise.resolve(mockJsonResponse({ stats: { streak: 1, lastActivity: '2026-08-11' } }));
    });

    renderLessonScreen();
    await goThroughAllSteps();
    await waitFor(() => expect(screen.getByText('Premiers pas')).toBeTruthy());

    fireEvent.press(screen.getByText('Super !'));

    await waitFor(() => {
      expect(screen.getByText('Garde ta série vivante !')).toBeTruthy();
    });
  });

  it('ne propose PAS les notifs si déjà proposées avant (hasSeenNotificationPrompt=true)', async () => {
    (hasSeenNotificationPrompt as jest.Mock).mockResolvedValue(true);
    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('/complete')) {
        return Promise.resolve(
          mockJsonResponse({
            success: true,
            newBadges: [
              { id: 'first_lesson', title: 'Premiers pas', description: 'x', icon: 'school', color: '#3b82f6' },
            ],
          })
        );
      }
      return Promise.resolve(mockJsonResponse({ stats: { streak: 1, lastActivity: '2026-08-11' } }));
    });

    renderLessonScreen();
    await goThroughAllSteps();
    await waitFor(() => expect(screen.getByText('Premiers pas')).toBeTruthy());

    fireEvent.press(screen.getByText('Super !'));

    await waitFor(() => {
      expect(screen.getByText('Série : 1j')).toBeTruthy();
    });
    expect(screen.queryByText('Garde ta série vivante !')).toBeNull();
  });

  it('ne propose PAS les notifs pour un badge autre que "first_lesson"', async () => {
    (hasSeenNotificationPrompt as jest.Mock).mockResolvedValue(false);
    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('/complete')) {
        return Promise.resolve(
          mockJsonResponse({
            success: true,
            newBadges: [
              { id: 'streak_7', title: 'Semaine parfaite', description: 'x', icon: 'flame', color: '#f97316' },
            ],
          })
        );
      }
      return Promise.resolve(mockJsonResponse({ stats: { streak: 7, lastActivity: '2026-08-11' } }));
    });

    renderLessonScreen();
    await goThroughAllSteps();
    await waitFor(() => expect(screen.getByText('Semaine parfaite')).toBeTruthy());

    fireEvent.press(screen.getByText('Super !'));

    await waitFor(() => {
      expect(screen.getByText('Série : 7j')).toBeTruthy();
    });
    expect(screen.queryByText('Garde ta série vivante !')).toBeNull();
  });
});

describe('LessonScreen — navigation finale', () => {
  it('appelle navigation.goBack() au clic sur "Continuer" de l\'écran de résultats', async () => {
    renderLessonScreen();
    await goThroughAllSteps();
    await waitFor(() => expect(screen.getByText('Leçon terminée !')).toBeTruthy());

    fireEvent.press(screen.getByText('Continuer'));

    expect(fakeNavigation.goBack).toHaveBeenCalledTimes(1);
  });
});