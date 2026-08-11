import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react-native';
import { auth } from '../../../firebaseConfig';
import { LeaderboardScreen } from '../LeaderboardScreen';

jest.mock('../../../theme/ThemeContext', () => ({
  useTheme: () => ({ colors: require('../../../theme/colors').lightColors, isDark: false }),
}));

jest.mock('../../../firebaseConfig', () => ({
  auth: { currentUser: null as any },
}));

jest.mock('../../../utils/authHeaders', () => ({
  getAuthHeaders: jest.fn().mockResolvedValue({ Authorization: 'Bearer fake-token' }),
}));

const mockGoBack = jest.fn();
const mockNavigate = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: mockGoBack, navigate: mockNavigate }),
  useFocusEffect: (callback: () => void) => {
    // Le vrai useFocusEffect de react-navigation redéclenche l'effet à
    // chaque fois que la callback change de référence (ex: le mode
    // Global/Amis change), pas seulement au montage. [callback] en
    // dépendance reproduit ça sans boucler à l'infini (contrairement à
    // aucune dépendance du tout, qui re-déclenche à CHAQUE rendu).
    require('react').useEffect(callback, [callback]);
  },
}));

function mockJsonResponse(body: any, ok = true, status = 200) {
  return { ok, status, json: async () => body } as any;
}

beforeEach(() => {
  (auth as any).currentUser = { uid: 'my-uid' };
  global.fetch = jest.fn();
  jest.spyOn(console, 'error').mockImplementation(() => {});
  mockGoBack.mockClear();
  mockNavigate.mockClear();
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('LeaderboardScreen — mode global', () => {
  it('affiche les entrées reçues avec leur XP', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
      mockJsonResponse({
        entries: [
          { uid: 'a', displayName: 'Alice', avatarUrl: null, xp: 500, streak: 3 },
          { uid: 'my-uid', displayName: 'Moi', avatarUrl: null, xp: 200, streak: 1 },
        ],
        yourUid: 'my-uid',
        yourRank: 2,
      })
    );

    render(<LeaderboardScreen />);

    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeTruthy();
    });
    expect(screen.getByText('500 XP')).toBeTruthy();
    expect(screen.getByText('Moi (toi)')).toBeTruthy();
  });

  it('affiche l\'état vide quand personne n\'est classé', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
      mockJsonResponse({ entries: [], yourUid: 'my-uid', yourRank: null })
    );

    render(<LeaderboardScreen />);

    await waitFor(() => {
      expect(screen.getByText("Personne au classement pour l'instant")).toBeTruthy();
    });
  });

  it('affiche "Ta position" en bas si l\'utilisateur n\'est pas dans le top affiché', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
      mockJsonResponse({
        entries: [{ uid: 'a', displayName: 'Alice', avatarUrl: null, xp: 999, streak: 0 }],
        yourUid: 'my-uid',
        yourRank: 42,
      })
    );

    render(<LeaderboardScreen />);

    await waitFor(() => {
      expect(screen.getByText('Ta position : #42')).toBeTruthy();
    });
  });

  it('n\'affiche pas "Ta position" si l\'utilisateur est déjà dans la liste', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
      mockJsonResponse({
        entries: [{ uid: 'my-uid', displayName: 'Moi', avatarUrl: null, xp: 10, streak: 0 }],
        yourUid: 'my-uid',
        yourRank: 1,
      })
    );

    render(<LeaderboardScreen />);

    await waitFor(() => {
      expect(screen.getByText('Moi (toi)')).toBeTruthy();
    });
    expect(screen.queryByText(/Ta position/)).toBeNull();
  });
});

describe('LeaderboardScreen — bascule vers le mode Amis', () => {
  it('appelle /api/friends/leaderboard après avoir cliqué sur "Amis"', async () => {
    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('/api/friends/leaderboard')) {
        return Promise.resolve(
          mockJsonResponse({
            entries: [
              { uid: 'my-uid', displayName: 'Moi', avatarUrl: null, xp: 10, streak: 0 },
              { uid: 'ami1', displayName: 'Bob', avatarUrl: null, xp: 5, streak: 0 },
            ],
            yourUid: 'my-uid',
          })
        );
      }
      return Promise.resolve(mockJsonResponse({ entries: [], yourUid: 'my-uid', yourRank: null }));
    });

    render(<LeaderboardScreen />);
    await waitFor(() => {
      expect(screen.getByText('Global')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('Amis'));

    await waitFor(() => {
      expect(screen.getByText('Bob')).toBeTruthy();
    });
    expect(
      (global.fetch as jest.Mock).mock.calls.some((c) => c[0].includes('/api/friends/leaderboard'))
    ).toBe(true);
  });

  it('affiche le CTA "Ajouter des amis" quand la liste d\'amis est vide (soi seul)', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
      mockJsonResponse({
        entries: [{ uid: 'my-uid', displayName: 'Moi', avatarUrl: null, xp: 10, streak: 0 }],
        yourUid: 'my-uid',
      })
    );

    render(<LeaderboardScreen />);
    await waitFor(() => expect(screen.getByText('Global')).toBeTruthy());

    fireEvent.press(screen.getByText('Amis'));

    await waitFor(() => {
      expect(screen.getByText("Pas encore d'amis ajoutés")).toBeTruthy();
    });
  });

  it('le CTA "Ajouter des amis" navigue vers l\'écran Friends', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
      mockJsonResponse({
        entries: [{ uid: 'my-uid', displayName: 'Moi', avatarUrl: null, xp: 10, streak: 0 }],
        yourUid: 'my-uid',
      })
    );

    render(<LeaderboardScreen />);
    await waitFor(() => expect(screen.getByText('Global')).toBeTruthy());
    fireEvent.press(screen.getByText('Amis'));
    await waitFor(() => expect(screen.getByText('Ajouter des amis')).toBeTruthy());

    fireEvent.press(screen.getByText('Ajouter des amis'));

    expect(mockNavigate).toHaveBeenCalledWith('Friends');
  });
});

describe('LeaderboardScreen — erreur réseau', () => {
  it('affiche l\'état d\'erreur si le fetch échoue', async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error('network down'));

    render(<LeaderboardScreen />);

    await waitFor(() => {
      expect(screen.getByText('Impossible de charger le classement')).toBeTruthy();
    });
  });

  it('affiche l\'état d\'erreur si l\'API renvoie un statut non-ok', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(mockJsonResponse({}, false, 500));

    render(<LeaderboardScreen />);

    await waitFor(() => {
      expect(screen.getByText('Impossible de charger le classement')).toBeTruthy();
    });
  });

  it('le bouton "Réessayer" relance un appel réseau', async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error('network down'));

    render(<LeaderboardScreen />);
    await waitFor(() => expect(screen.getByText('Réessayer')).toBeTruthy());

    const callsBefore = (global.fetch as jest.Mock).mock.calls.length;
    fireEvent.press(screen.getByText('Réessayer'));

    await waitFor(() => {
      expect((global.fetch as jest.Mock).mock.calls.length).toBeGreaterThan(callsBefore);
    });
  });
});

describe('LeaderboardScreen — navigation', () => {
  it('appelle goBack au clic sur la flèche retour', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
      mockJsonResponse({ entries: [], yourUid: 'my-uid', yourRank: null })
    );

    render(<LeaderboardScreen />);
    await waitFor(() => expect(screen.getByText('Classement')).toBeTruthy());

    fireEvent.press(screen.UNSAFE_getAllByProps({ name: 'chevron-back' })[0]);

    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });

  it('l\'icône "people" dans le header navigue vers Friends', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
      mockJsonResponse({ entries: [], yourUid: 'my-uid', yourRank: null })
    );

    render(<LeaderboardScreen />);
    await waitFor(() => expect(screen.getByText('Classement')).toBeTruthy());

    fireEvent.press(screen.UNSAFE_getAllByProps({ name: 'people-outline' })[0]);

    expect(mockNavigate).toHaveBeenCalledWith('Friends');
  });
});