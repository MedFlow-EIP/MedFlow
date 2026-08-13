import React from 'react';
import { ActivityIndicator } from 'react-native';
import { render, screen, waitFor, fireEvent } from '@testing-library/react-native';
import { auth } from '../../../firebaseConfig';
import { RevisionScreen } from '../RevisionScreen';

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

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: mockGoBack, navigate: jest.fn() }),
  useRoute: () => ({ params: (global as any).__mockRouteParams }),
  useFocusEffect: (callback: () => void) => {
    require('react').useEffect(callback, [callback]);
  },
}));

function mockJsonResponse(body: any, ok = true, status = 200) {
  return { ok, status, json: async () => body } as any;
}

const twoCards = {
  cards: [
    { course_id: 'anatomy', course_nom: 'Anatomie', card_index: 0, question: 'Q1', answer: 'R1' },
    { course_id: 'anatomy', course_nom: 'Anatomie', card_index: 1, question: 'Q2', answer: 'R2' },
  ],
  count: 2,
};

beforeEach(() => {
  (auth as any).currentUser = { uid: 'test-uid' };
  (global as any).__mockRouteParams = undefined;
  global.fetch = jest.fn();
  jest.spyOn(console, 'error').mockImplementation(() => {});
  mockGoBack.mockClear();
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('RevisionScreen — chargement', () => {
  it('affiche un loader pendant la récupération des cartes dues', () => {
    (global.fetch as jest.Mock).mockReturnValue(new Promise(() => {}));
    render(<RevisionScreen />);
    expect(screen.UNSAFE_getByType(ActivityIndicator)).toBeTruthy();
  });
});

describe('RevisionScreen — état vide', () => {
  it('affiche "Rien à réviser" quand aucune carte n\'est due', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(mockJsonResponse({ cards: [], count: 0 }));

    render(<RevisionScreen />);

    await waitFor(() => {
      expect(screen.getByText("Rien à réviser aujourd'hui")).toBeTruthy();
    });
  });
});

describe('RevisionScreen — erreur réseau', () => {
  it('affiche l\'état d\'erreur et permet de réessayer', async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error('network down'));

    render(<RevisionScreen />);

    await waitFor(() => {
      expect(screen.getByText('Impossible de charger la révision')).toBeTruthy();
    });

    (global.fetch as jest.Mock).mockResolvedValue(mockJsonResponse({ cards: [], count: 0 }));
    fireEvent.press(screen.getByText('Réessayer'));

    await waitFor(() => {
      expect(screen.getByText("Rien à réviser aujourd'hui")).toBeTruthy();
    });
  });
});

describe('RevisionScreen — session de révision', () => {
  it('affiche la question de la première carte', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(mockJsonResponse(twoCards));

    render(<RevisionScreen />);

    await waitFor(() => {
      expect(screen.getByText('Q1')).toBeTruthy();
    });
    expect(screen.getByText('1 / 2')).toBeTruthy();
  });

  it('ne montre pas la réponse avant d\'avoir cliqué sur "Voir la réponse"', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(mockJsonResponse(twoCards));

    render(<RevisionScreen />);
    await waitFor(() => expect(screen.getByText('Q1')).toBeTruthy());

    expect(screen.queryByText('R1')).toBeNull();
  });

  it('révèle la réponse et affiche les 4 boutons de qualité', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(mockJsonResponse(twoCards));

    render(<RevisionScreen />);
    await waitFor(() => expect(screen.getByText('Q1')).toBeTruthy());

    fireEvent.press(screen.getByText('Voir la réponse'));

    expect(screen.getByText('R1')).toBeTruthy();
    expect(screen.getByText('Encore')).toBeTruthy();
    expect(screen.getByText('Difficile')).toBeTruthy();
    expect(screen.getByText('Bien')).toBeTruthy();
    expect(screen.getByText('Facile')).toBeTruthy();
  });

  it('passe à la carte suivante après avoir noté la réponse', async () => {
    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('/api/revision/due')) return Promise.resolve(mockJsonResponse(twoCards));
      if (url.includes('/api/revision/answer')) {
        return Promise.resolve(mockJsonResponse({ interval_days: 1, repetitions: 1, ease_factor: 2.5, next_review_date: '2026-01-01' }));
      }
      return Promise.resolve(mockJsonResponse({ status: 'ok' }));
    });

    render(<RevisionScreen />);
    await waitFor(() => expect(screen.getByText('Q1')).toBeTruthy());

    fireEvent.press(screen.getByText('Voir la réponse'));
    fireEvent.press(screen.getByText('Bien'));

    await waitFor(() => {
      expect(screen.getByText('Q2')).toBeTruthy();
    });
    expect(screen.getByText('2 / 2')).toBeTruthy();
  });

  it('envoie course_id et card_index corrects à /api/revision/answer', async () => {
    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('/api/revision/due')) return Promise.resolve(mockJsonResponse(twoCards));
      return Promise.resolve(mockJsonResponse({ interval_days: 1, repetitions: 1 }));
    });

    render(<RevisionScreen />);
    await waitFor(() => expect(screen.getByText('Q1')).toBeTruthy());

    fireEvent.press(screen.getByText('Voir la réponse'));
    fireEvent.press(screen.getByText('Facile'));

    await waitFor(() => {
      const answerCall = (global.fetch as jest.Mock).mock.calls.find((c) =>
        c[0].includes('/api/revision/answer')
      );
      expect(answerCall).toBeTruthy();
      const body = JSON.parse(answerCall[1].body);
      expect(body).toEqual({ course_id: 'anatomy', card_index: 0, quality: 5 });
    });
  });

  it('affiche l\'écran de fin après la dernière carte, avec le score', async () => {
    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('/api/revision/due')) return Promise.resolve(mockJsonResponse(twoCards));
      return Promise.resolve(mockJsonResponse({ interval_days: 1, repetitions: 1, status: 'ok' }));
    });

    render(<RevisionScreen />);
    await waitFor(() => expect(screen.getByText('Q1')).toBeTruthy());
    fireEvent.press(screen.getByText('Voir la réponse'));
    fireEvent.press(screen.getByText('Facile'));

    await waitFor(() => expect(screen.getByText('Q2')).toBeTruthy());
    fireEvent.press(screen.getByText('Voir la réponse'));
    fireEvent.press(screen.getByText('Facile'));

    await waitFor(() => {
      expect(screen.getByText('Session terminée !')).toBeTruthy();
    });
    expect(screen.getByText('2 / 2 cartes bien sues (100%)')).toBeTruthy();
  });

  it('envoie /api/session-done avec le bon score en fin de session', async () => {
    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('/api/revision/due')) return Promise.resolve(mockJsonResponse(twoCards));
      return Promise.resolve(mockJsonResponse({ interval_days: 1, repetitions: 1, status: 'ok' }));
    });

    render(<RevisionScreen />);
    await waitFor(() => expect(screen.getByText('Q1')).toBeTruthy());
    fireEvent.press(screen.getByText('Voir la réponse'));
    fireEvent.press(screen.getByText('Encore')); // mauvaise réponse

    await waitFor(() => expect(screen.getByText('Q2')).toBeTruthy());
    fireEvent.press(screen.getByText('Voir la réponse'));
    fireEvent.press(screen.getByText('Facile')); // bonne réponse

    await waitFor(() => {
      const doneCall = (global.fetch as jest.Mock).mock.calls.find((c) =>
        c[0].includes('/api/session-done')
      );
      expect(doneCall).toBeTruthy();
      const body = JSON.parse(doneCall[1].body);
      expect(body).toEqual({
        mode: 'all',
        course_id: undefined,
        session_type: 'revision',
        score: 50, // 1 bonne sur 2
        total_questions: 2,
      });
    });
  });
});

describe('RevisionScreen — révision ciblée sur un cours', () => {
  it('inclut course_id dans l\'appel à /api/revision/due', async () => {
    (global as any).__mockRouteParams = { courseId: 'cardiology' };
    (global.fetch as jest.Mock).mockResolvedValue(mockJsonResponse({ cards: [], count: 0 }));

    render(<RevisionScreen />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('course_id=cardiology'),
        expect.anything()
      );
    });
  });
});