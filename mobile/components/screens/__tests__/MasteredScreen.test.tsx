import React from 'react';
import { ActivityIndicator } from 'react-native';
import { render, screen, waitFor, fireEvent } from '@testing-library/react-native';
import { auth } from '../../../firebaseConfig';
import { MasteredScreen } from '../MasteredScreen';

jest.mock('../../../theme/ThemeContext', () => ({
  useTheme: () => ({ colors: require('../../../theme/colors').lightColors, isDark: false }),
}));

jest.mock('../../../firebaseConfig', () => ({
  auth: { currentUser: null as any },
}));

jest.mock('../../../utils/authHeaders', () => ({
  getAuthHeaders: jest.fn().mockResolvedValue({ Authorization: 'Bearer fake-token' }),
}));

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, goBack: mockGoBack }),
  useFocusEffect: (callback: () => void) => {
    require('react').useEffect(callback, [callback]);
  },
}));

function mockJsonResponse(body: any, ok = true) {
  return { ok, json: async () => body } as any;
}

beforeEach(() => {
  (auth as any).currentUser = { uid: 'test-uid' };
  global.fetch = jest.fn();
  jest.spyOn(console, 'error').mockImplementation(() => {});
  mockNavigate.mockClear();
  mockGoBack.mockClear();
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('MasteredScreen — chargement', () => {
  it('affiche un loader pendant la récupération', () => {
    (global.fetch as jest.Mock).mockReturnValue(new Promise(() => {}));
    render(<MasteredScreen />);
    expect(screen.UNSAFE_getByType(ActivityIndicator)).toBeTruthy();
  });
});

describe('MasteredScreen — état vide', () => {
  it('affiche un message encourageant quand rien n\'est encore maîtrisé', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(mockJsonResponse({ items: [], count: 0 }));

    render(<MasteredScreen />);

    await waitFor(() => {
      expect(screen.getByText('Pas encore de carte maîtrisée')).toBeTruthy();
    });
  });
});

describe('MasteredScreen — erreur réseau', () => {
  it('affiche l\'état d\'erreur et permet de réessayer', async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error('network down'));

    render(<MasteredScreen />);

    await waitFor(() => {
      expect(screen.getByText('Impossible de charger les cartes maîtrisées')).toBeTruthy();
    });

    (global.fetch as jest.Mock).mockResolvedValue(mockJsonResponse({ items: [], count: 0 }));
    fireEvent.press(screen.getByText('Réessayer'));

    await waitFor(() => {
      expect(screen.getByText('Pas encore de carte maîtrisée')).toBeTruthy();
    });
  });
});

describe('MasteredScreen — affichage des cartes maîtrisées', () => {
  const twoItems = {
    items: [
      {
        course_id: 'anatomy',
        course_nom: 'Anatomie',
        item_index: 0,
        question: 'Combien y a-t-il d\'os dans le corps humain adulte ?',
        interval_days: 30,
        repetitions: 6,
      },
      {
        course_id: 'anatomy',
        course_nom: 'Anatomie',
        item_index: 1,
        question: 'Quel est le plus grand organe du corps humain ?',
        interval_days: 21,
        repetitions: 4,
      },
    ],
    count: 2,
  };

  it('affiche le nombre total de cartes maîtrisées', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(mockJsonResponse(twoItems));

    render(<MasteredScreen />);

    await waitFor(() => {
      expect(screen.getByText('2 cartes maîtrisées')).toBeTruthy();
    });
  });

  it('affiche le nom du cours et les questions', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(mockJsonResponse(twoItems));

    render(<MasteredScreen />);

    await waitFor(() => {
      expect(screen.getByText('Anatomie')).toBeTruthy();
    });
    expect(screen.getByText("Combien y a-t-il d'os dans le corps humain adulte ?")).toBeTruthy();
    expect(screen.getByText('Quel est le plus grand organe du corps humain ?')).toBeTruthy();
  });

  it('affiche l\'intervalle et le nombre de répétitions', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(mockJsonResponse(twoItems));

    render(<MasteredScreen />);

    await waitFor(() => {
      expect(screen.getByText('Revient dans 30 jours · 6 bonnes réponses de suite')).toBeTruthy();
    });
  });

  it('navigue vers CourseDetail au clic sur une carte', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(mockJsonResponse(twoItems));

    render(<MasteredScreen />);
    await waitFor(() => {
      expect(screen.getByText("Combien y a-t-il d'os dans le corps humain adulte ?")).toBeTruthy();
    });

    fireEvent.press(screen.getByText("Combien y a-t-il d'os dans le corps humain adulte ?"));

    expect(mockNavigate).toHaveBeenCalledWith('CourseDetail', { courseId: 'anatomy' });
  });

  it('revient en arrière au clic sur le bouton retour', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(mockJsonResponse({ items: [], count: 0 }));
    render(<MasteredScreen />);
    await waitFor(() => expect(screen.getByText('Pas encore de carte maîtrisée')).toBeTruthy());
    fireEvent.press(screen.getByLabelText('Retour'));
    expect(mockGoBack).toHaveBeenCalled();
  });

  it('regroupe correctement les cartes de deux cours différents', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
      mockJsonResponse({
        items: [
          { course_id: 'c1', course_nom: 'Cardiologie', item_index: 0, question: 'Q1', interval_days: 25, repetitions: 5 },
          { course_id: 'c2', course_nom: 'Pneumologie', item_index: 0, question: 'Q2', interval_days: 40, repetitions: 8 },
        ],
        count: 2,
      })
    );

    render(<MasteredScreen />);

    await waitFor(() => {
      expect(screen.getByText('Cardiologie')).toBeTruthy();
      expect(screen.getByText('Pneumologie')).toBeTruthy();
    });
  });
});