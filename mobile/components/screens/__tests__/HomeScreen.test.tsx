import React from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';
import { getAuth } from 'firebase/auth';
import { getAuthHeaders } from '@/utils/authHeaders';
import { HomeScreen } from '../HomeScreen';

jest.mock('../../../theme/ThemeContext', () => ({
  useTheme: () => ({ colors: require('../../../theme/colors').lightColors, isDark: false }),
}));

jest.mock('firebase/auth', () => ({
  getAuth: jest.fn(),
}));

jest.mock('@/utils/authHeaders', () => ({
  getAuthHeaders: jest.fn().mockResolvedValue({ Authorization: 'Bearer fake-token' }),
}));

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (callback: () => void) => {
    require('react').useEffect(callback, []);
  },
}));

function mockJsonResponse(body: any, ok = true, status = 200) {
  return { ok, status, json: async () => body } as any;
}

const fakeNavigation = { navigate: jest.fn() };

function renderHomeScreen(routeParams: any = {}) {
  return render(
    <HomeScreen navigation={fakeNavigation} route={{ params: routeParams }} />
  );
}

beforeEach(() => {
  (getAuth as jest.Mock).mockReturnValue({
    currentUser: { uid: 'test-uid', displayName: 'Camille Dupont', photoURL: null },
  });
  global.fetch = jest.fn();
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('HomeScreen — envoi des headers d\'authentification (régression connue)', () => {
  // Bug réel corrigé en session : cet appel utilisait encore l'ancien
  // header X-User-UID seul au lieu de getAuthHeaders(user), et se faisait
  // rejeter silencieusement une fois le backend passé en vérification
  // stricte des tokens Firebase.
  it('utilise getAuthHeaders() pour l\'appel à /api/paths, pas un header brut', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(mockJsonResponse({ paths: [] }));

    renderHomeScreen();

    await waitFor(() => {
      expect(getAuthHeaders).toHaveBeenCalled();
    });

    const [, options] = (global.fetch as jest.Mock).mock.calls[0];
    expect(options.headers).toEqual({ Authorization: 'Bearer fake-token' });
  });

  it('n\'appelle pas fetch du tout si aucun utilisateur n\'est connecté', async () => {
    (getAuth as jest.Mock).mockReturnValue({ currentUser: null });

    renderHomeScreen();

    await waitFor(() => {
      expect(screen.getByText('Aucun parcours')).toBeTruthy();
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

describe('HomeScreen — réponse API malformée (régression connue)', () => {
  // Bug réel corrigé en session : un crash "Cannot read property 'reduce'
  // of undefined" survenait quand data.paths n'était pas un tableau
  // (réponse d'erreur du backend, ex: {"error": "..."} au lieu de
  // {"paths": [...]}).  Sans garde-fou, setPaths(data.paths) stockait
  // `undefined`, et le .reduce() plus bas plantait au re-render suivant.
  //
  // Important : ce crash est ASYNCHRONE (survient après la résolution du
  // fetch mocké, pas pendant l'appel synchrone à render()) — un simple
  // expect(() => render(...)).not.toThrow() ne le détecte PAS. On vérifie
  // à la place qu'aucune erreur de rendu React n'a été loguée.

  const getRenderErrors = (spy: jest.SpyInstance) =>
    spy.mock.calls.filter((args) =>
      String(args[0]).includes('The above error occurred')
    );

  it('ne plante pas si /api/paths renvoie une erreur au lieu d\'un tableau', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
      mockJsonResponse({ error: 'UID Firebase requis' })
    );
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    render(<HomeScreen navigation={fakeNavigation} route={{ params: {} }} />);
    await new Promise((r) => setTimeout(r, 100));

    expect(getRenderErrors(errorSpy)).toHaveLength(0);
  });

  it('ne plante pas si data.paths est carrément absent de la réponse', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(mockJsonResponse({}));
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    render(<HomeScreen navigation={fakeNavigation} route={{ params: {} }} />);
    await new Promise((r) => setTimeout(r, 100));

    expect(getRenderErrors(errorSpy)).toHaveLength(0);
  });

  it('ne plante pas si route.params.updatedPaths n\'est pas un tableau', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(mockJsonResponse({ paths: [] }));
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    // Deuxième point d'entrée touché par le même bug : les données
    // repassées depuis PathScreen après complétion d'une leçon.
    render(<HomeScreen navigation={fakeNavigation} route={{ params: { updatedPaths: null } }} />);
    await new Promise((r) => setTimeout(r, 100));

    expect(getRenderErrors(errorSpy)).toHaveLength(0);
  });
});

describe('HomeScreen — affichage normal', () => {
  it('affiche l\'état vide quand la liste de parcours est vide', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(mockJsonResponse({ paths: [] }));

    renderHomeScreen();

    await waitFor(() => {
      expect(screen.getByText('Aucun parcours')).toBeTruthy();
    });
  });

  it('affiche un PathCard par parcours reçu', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
      mockJsonResponse({
        paths: [
          {
            id: 'anatomy',
            title: 'Anatomie',
            description: 'Système squelettique',
            totalLessons: 10,
            completedLessons: 3,
            isLocked: false,
            color: '#3b82f6',
            emoji: '🦴',
            progress: 30,
          },
        ],
      })
    );

    renderHomeScreen();

    await waitFor(() => {
      expect(screen.getByText('Anatomie')).toBeTruthy();
    });
    expect(screen.queryByText('Aucun parcours')).toBeNull();
  });

  it('affiche le prénom de l\'utilisateur dans l\'en-tête', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(mockJsonResponse({ paths: [] }));

    renderHomeScreen();

    await waitFor(() => {
      expect(screen.getByText('Camille')).toBeTruthy();
    });
  });

  it('affiche "Médecin" par défaut si displayName est absent', async () => {
    (getAuth as jest.Mock).mockReturnValue({
      currentUser: { uid: 'u1', displayName: null, photoURL: null },
    });
    (global.fetch as jest.Mock).mockResolvedValue(mockJsonResponse({ paths: [] }));

    renderHomeScreen();

    await waitFor(() => {
      expect(screen.getByText('Médecin')).toBeTruthy();
    });
  });
});

describe('HomeScreen — route.params.updatedPaths', () => {
  it('affiche les parcours passés via route.params sans attendre le fetch', async () => {
    (global.fetch as jest.Mock).mockReturnValue(new Promise(() => {})); // ne résout jamais

    renderHomeScreen({
      updatedPaths: [
        {
          id: 'cardiology',
          title: 'Cardiologie',
          description: 'Système cardiovasculaire',
          totalLessons: 8,
          completedLessons: 2,
          isLocked: false,
          color: '#ef4444',
          emoji: '❤️',
          progress: 25,
        },
      ],
    });

    await waitFor(() => {
      expect(screen.getByText('Cardiologie')).toBeTruthy();
    });
  });
});