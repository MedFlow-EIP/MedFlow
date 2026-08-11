import React from 'react';
import { ActivityIndicator } from 'react-native';
import { render, screen, waitFor, fireEvent } from '@testing-library/react-native';
import { ProgressScreen } from '../ProgressScreen';
import { auth } from '../../../firebaseConfig';

jest.mock('../../../theme/ThemeContext', () => ({
  useTheme: () => ({ colors: require('../../../theme/colors').lightColors, isDark: false }),
}));

jest.mock('../../../firebaseConfig', () => ({
  auth: { currentUser: null as any },
}));

jest.mock('../../../utils/authHeaders', () => ({
  getAuthHeaders: jest.fn().mockResolvedValue({ Authorization: 'Bearer fake-token' }),
}));

// useFocusEffect ne se déclenche que dans un vrai navigateur monté — on le
// simplifie en un effet classique au montage, suffisant pour tester le
// chargement des données sans avoir à mettre en place un vrai
// NavigationContainer avec des écrans réels.
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: jest.fn() }),
  useFocusEffect: (callback: () => void) => {
    require('react').useEffect(callback, []);
  },
}));

function mockJsonResponse(body: any, ok = true, status = 200) {
  return { ok, status, json: async () => body } as any;
}

const emptyAccount = { stats: { xp: 0, streak: 0, weeklyGoal: 0, weeklyProgress: 0 } };
const emptyPaths = { paths: [] };

beforeEach(() => {
  (auth as any).currentUser = { uid: 'test-uid' };
  global.fetch = jest.fn();
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('ProgressScreen — pas d\'utilisateur connecté', () => {
  it('arrête le chargement sans planter si auth.currentUser est null', async () => {
    (auth as any).currentUser = null;

    render(<ProgressScreen />);

    await waitFor(() => {
      expect(screen.queryByText('Votre progression')).toBeTruthy();
    });
    // Aucun appel réseau ne doit avoir été tenté sans utilisateur.
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

describe('ProgressScreen — chargement', () => {
  it('affiche un indicateur de chargement avant que les données arrivent', () => {
    (global.fetch as jest.Mock).mockReturnValue(new Promise(() => {})); // ne résout jamais

    render(<ProgressScreen />);

    expect(screen.UNSAFE_getByType(ActivityIndicator)).toBeTruthy();
  });
});

describe('ProgressScreen — succès avec des leçons', () => {
  it('affiche le tableau de bord une fois les données chargées', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(
        mockJsonResponse({ stats: { xp: 420, streak: 7, weeklyGoal: 5, weeklyProgress: 3 } })
      )
      .mockResolvedValueOnce(
        mockJsonResponse({ paths: [{ totalLessons: 10, completedLessons: 4 }] })
      );

    render(<ProgressScreen />);

    await waitFor(() => {
      expect(screen.getByText('Points XP')).toBeTruthy();
    });
    expect(screen.getByText('420')).toBeTruthy();
  });

  it('additionne totalLessons/completedLessons sur plusieurs parcours', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(mockJsonResponse(emptyAccount))
      .mockResolvedValueOnce(
        mockJsonResponse({
          paths: [
            { totalLessons: 10, completedLessons: 4 },
            { totalLessons: 5, completedLessons: 1 },
          ],
        })
      );

    render(<ProgressScreen />);

    await waitFor(() => {
      expect(screen.getByText('5 leçons complétées sur 15')).toBeTruthy();
    });
  });
});

describe('ProgressScreen — aucune leçon (état vide)', () => {
  it('affiche l\'état "Pas encore de progression" quand totalLessons=0', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(mockJsonResponse(emptyAccount))
      .mockResolvedValueOnce(mockJsonResponse(emptyPaths));

    render(<ProgressScreen />);

    await waitFor(() => {
      expect(screen.getByText('Pas encore de progression')).toBeTruthy();
    });
  });
});

describe('ProgressScreen — erreur réseau', () => {
  it('affiche l\'état d\'erreur si le fetch rejette', async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error('network down'));

    render(<ProgressScreen />);

    await waitFor(() => {
      expect(screen.getByText('Impossible de charger ta progression')).toBeTruthy();
    });
  });

  it('affiche l\'état d\'erreur si l\'API renvoie un statut non-ok', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(mockJsonResponse({ error: 'boom' }, false, 500))
      .mockResolvedValueOnce(mockJsonResponse(emptyPaths));

    render(<ProgressScreen />);

    await waitFor(() => {
      expect(screen.getByText('Impossible de charger ta progression')).toBeTruthy();
    });
  });

  it('le bouton "Réessayer" relance un nouvel appel réseau', async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error('network down'));

    render(<ProgressScreen />);
    await waitFor(() => {
      expect(screen.getByText('Réessayer')).toBeTruthy();
    });

    const callsBeforeRetry = (global.fetch as jest.Mock).mock.calls.length;
    fireEvent.press(screen.getByText('Réessayer'));

    await waitFor(() => {
      expect((global.fetch as jest.Mock).mock.calls.length).toBeGreaterThan(callsBeforeRetry);
    });
  });

  it('ne reste jamais bloqué en chargement infini après une erreur (régression connue)', async () => {
    // C'est exactement le bug qu'on a corrigé en session : un fetch qui
    // échoue sans jamais faire retomber `loading` à false laissait
    // l'utilisateur bloqué sur le spinner pour toujours.
    (global.fetch as jest.Mock).mockRejectedValue(new Error('network down'));

    render(<ProgressScreen />);

    await waitFor(() => {
      expect(screen.UNSAFE_queryByType(ActivityIndicator)).toBeFalsy();
    });
    expect(screen.getByText('Impossible de charger ta progression')).toBeTruthy();
  });
});