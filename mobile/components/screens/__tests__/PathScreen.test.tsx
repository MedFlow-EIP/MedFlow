import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react-native';
import { getAuth } from 'firebase/auth';
import { PathScreen } from '../PathScreen';

jest.mock('../../../theme/ThemeContext', () => ({
  useTheme: () => ({ colors: require('../../../theme/colors').lightColors, isDark: false }),
}));

jest.mock('firebase/auth', () => ({
  getAuth: jest.fn(),
}));

jest.mock('../../../utils/authHeaders', () => ({
  getAuthHeaders: jest.fn().mockResolvedValue({ Authorization: 'Bearer fake-token' }),
}));

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (callback: () => void) => {
    require('react').useEffect(callback, []);
  },
}));

function mockJsonResponse(body: any) {
  return { ok: true, status: 200, json: async () => body } as any;
}

const fakePath = {
  id: 'anatomy',
  title: 'Anatomie',
  description: 'Système squelettique',
  totalLessons: 10,
  completedLessons: 3, // volontairement une valeur FIGEE/perimee dans route.params
  isLocked: false,
  color: '#3b82f6',
  emoji: '🦴',
};

const fakeNavigation = {
  goBack: jest.fn(),
  navigate: jest.fn(),
  getParent: jest.fn(() => ({ setParams: jest.fn() })),
};

function renderPathScreen() {
  return render(
    <PathScreen navigation={fakeNavigation} route={{ params: { path: fakePath } }} />
  );
}

function makeLessons(count: number, completed: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: String(i + 1),
    title: `Leçon ${i + 1}`,
    type: 'lesson' as const,
    status: i < completed ? 'completed' : i === completed ? 'available' : 'locked',
    stars: 0,
    position: 'center' as const,
    xp: 10,
  }));
}

function mockAllEndpoints({ lessons = [] as any[], accountStats = { xp: 0, streak: 0 } } = {}) {
  (global.fetch as jest.Mock).mockImplementation((url: string) => {
    if (url.includes('/api/account')) {
      return Promise.resolve(mockJsonResponse({ stats: accountStats }));
    }
    if (url.includes('/api/lessons/')) {
      return Promise.resolve(mockJsonResponse({ lessons }));
    }
    if (url.includes('/api/paths')) {
      return Promise.resolve(mockJsonResponse({ paths: [] }));
    }
    return Promise.reject(new Error(`URL inattendue dans le test: ${url}`));
  });
}

beforeEach(() => {
  (getAuth as jest.Mock).mockReturnValue({ currentUser: { uid: 'test-uid' } });
  global.fetch = jest.fn();
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('PathScreen — niveau affiché (régression connue)', () => {
  // Bug réel corrigé en session : le niveau utilisait path.completedLessons
  // (une valeur figée reçue une seule fois via route.params, au moment où
  // on est entré sur l'écran) au lieu d'être dérivé des vraies leçons
  // fraîchement chargées. Résultat : après avoir terminé une leçon, le
  // niveau affiché ne bougeait jamais, même en revenant sur l'écran.
  it('calcule le niveau depuis les vraies leçons chargées, pas depuis route.params', async () => {
    // route.params dit "3 complétées" (fakePath.completedLessons = 3),
    // mais les VRAIES leçons fraîchement chargées en disent 6.
    mockAllEndpoints({ lessons: makeLessons(10, 6) });

    renderPathScreen();

    await waitFor(() => {
      expect(screen.getByText('Niveau 7')).toBeTruthy(); // 6 complétées + 1
    });
    expect(screen.queryByText('Niveau 4')).toBeNull(); // ce qu'aurait donné route.params
  });

  it('affiche "Niveau 1" quand aucune leçon n\'est encore complétée', async () => {
    mockAllEndpoints({ lessons: makeLessons(10, 0) });

    renderPathScreen();

    await waitFor(() => {
      expect(screen.getByText('Niveau 1')).toBeTruthy();
    });
  });
});

describe('PathScreen — affichage des leçons et stats', () => {
  it('affiche chaque leçon reçue par son titre', async () => {
    mockAllEndpoints({ lessons: makeLessons(3, 1) });

    renderPathScreen();

    await waitFor(() => {
      expect(screen.getByText('Leçon 1')).toBeTruthy();
    });
    expect(screen.getByText('Leçon 2')).toBeTruthy();
    expect(screen.getByText('Leçon 3')).toBeTruthy();
  });

  it('affiche le titre du parcours', async () => {
    mockAllEndpoints({ lessons: [] });

    renderPathScreen();

    await waitFor(() => {
      expect(screen.getByText('Anatomie')).toBeTruthy();
    });
  });

  it('affiche XP et streak une fois les stats chargées', async () => {
    mockAllEndpoints({ lessons: [], accountStats: { xp: 250, streak: 4 } });

    renderPathScreen();

    await waitFor(() => {
      expect(screen.getByText('250 XP')).toBeTruthy();
    });
    expect(screen.getByText('4j')).toBeTruthy();
  });

  it('n\'affiche pas les badges de stats avant qu\'elles soient chargées', () => {
    (global.fetch as jest.Mock).mockReturnValue(new Promise(() => {})); // ne résout jamais

    renderPathScreen();

    expect(screen.queryByText(/XP$/)).toBeNull();
  });
});

describe('PathScreen — navigation', () => {
  it('navigue vers Lesson au tap sur une leçon disponible', async () => {
    mockAllEndpoints({ lessons: makeLessons(3, 1) }); // leçon 1 complétée, 2 disponible

    renderPathScreen();

    await waitFor(() => {
      expect(screen.getByText('Leçon 2')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('Leçon 2'));

    expect(fakeNavigation.navigate).toHaveBeenCalledWith(
      'Lesson',
      expect.objectContaining({ path: fakePath })
    );
  });
});