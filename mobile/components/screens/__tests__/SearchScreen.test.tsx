import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react-native';
import { auth } from '../../../firebaseConfig';
import { SearchScreen } from '../SearchScreen';

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

describe('SearchScreen — affichage initial', () => {
  it('affiche le champ de recherche vide, sans appel réseau', () => {
    render(<SearchScreen />);
    expect(screen.getByLabelText('Rechercher')).toBeTruthy();
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

describe('SearchScreen — recherche', () => {
  it('appelle /api/search avec la requête après le délai de debounce', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(mockJsonResponse({ results: [], count: 0 }));

    render(<SearchScreen />);
    fireEvent.changeText(screen.getByLabelText('Rechercher'), 'tachycardie');

    await waitFor(
      () => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/search?q=tachycardie'),
          expect.anything()
        );
      },
      { timeout: 1000 }
    );
  });

  it("n'appelle pas l'API pour une requête vide", async () => {
    render(<SearchScreen />);
    fireEvent.changeText(screen.getByLabelText('Rechercher'), '');

    await new Promise((r) => setTimeout(r, 400));
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('affiche "Aucun résultat" quand la recherche ne trouve rien', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(mockJsonResponse({ results: [], count: 0 }));

    render(<SearchScreen />);
    fireEvent.changeText(screen.getByLabelText('Rechercher'), 'xyzintrouvable');

    await waitFor(
      () => {
        expect(screen.getByText('Aucun résultat pour "xyzintrouvable"')).toBeTruthy();
      },
      { timeout: 1000 }
    );
  });

  it('continue de fonctionner si la requête réseau échoue', async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error('network down'));

    render(<SearchScreen />);
    fireEvent.changeText(screen.getByLabelText('Rechercher'), 'coeur');

    await waitFor(
      () => {
        expect(screen.getByText('Aucun résultat pour "coeur"')).toBeTruthy();
      },
      { timeout: 1000 }
    );
  });
});

describe('SearchScreen — résultats groupés par cours', () => {
  const twoResultsSameCourse = {
    results: [
      { course_id: 'c1', course_nom: 'Cardiologie', match_type: 'course_name', snippet: 'Cardiologie' },
      { course_id: 'c1', course_nom: 'Cardiologie', match_type: 'flashcard', item_index: 0, snippet: 'Qu\'est-ce que la tachycardie ?' },
    ],
    count: 2,
  };

  it('affiche le nom du cours comme en-tête de groupe', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(mockJsonResponse(twoResultsSameCourse));

    render(<SearchScreen />);
    fireEvent.changeText(screen.getByLabelText('Rechercher'), 'tachycardie');

    await waitFor(
      () => {
        // "Cardiologie" apparaît deux fois : une fois comme titre de
        // groupe, une fois comme ligne de résultat (la correspondance
        // "nom du cours" a justement pour extrait le nom du cours lui-même).
        expect(screen.getAllByText('Cardiologie').length).toBe(2);
      },
      { timeout: 1000 }
    );
  });

  it('affiche les bons libellés de type de résultat', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(mockJsonResponse(twoResultsSameCourse));

    render(<SearchScreen />);
    fireEvent.changeText(screen.getByLabelText('Rechercher'), 'tachycardie');

    await waitFor(
      () => {
        expect(screen.getByText('Cours')).toBeTruthy();
        expect(screen.getByText('Flashcard')).toBeTruthy();
      },
      { timeout: 1000 }
    );
    expect(screen.getByText('Qu\'est-ce que la tachycardie ?')).toBeTruthy();
  });

  it('regroupe correctement les résultats de deux cours différents', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
      mockJsonResponse({
        results: [
          { course_id: 'c1', course_nom: 'Cardiologie', match_type: 'course_name', snippet: 'Cardiologie' },
          { course_id: 'c2', course_nom: 'Pneumologie', match_type: 'quiz', item_index: 0, snippet: 'Question pneumo' },
        ],
        count: 2,
      })
    );

    render(<SearchScreen />);
    fireEvent.changeText(screen.getByLabelText('Rechercher'), 'card');

    await waitFor(
      () => {
        expect(screen.getAllByText('Cardiologie').length).toBe(2); // titre + ligne
        expect(screen.getByText('Pneumologie')).toBeTruthy(); // titre seul (pas de doublon ici)
      },
      { timeout: 1000 }
    );
  });
});

describe('SearchScreen — navigation', () => {
  it('navigue vers CourseDetail avec le bon courseId au clic sur un résultat', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
      mockJsonResponse({
        results: [
          { course_id: 'course-42', course_nom: 'Neurologie', match_type: 'quiz', item_index: 0, snippet: 'Question neuro' },
        ],
        count: 1,
      })
    );

    render(<SearchScreen />);
    fireEvent.changeText(screen.getByLabelText('Rechercher'), 'neuro');

    await waitFor(
      () => {
        expect(screen.getByText('Question neuro')).toBeTruthy();
      },
      { timeout: 1000 }
    );

    fireEvent.press(screen.getByText('Question neuro'));

    expect(mockNavigate).toHaveBeenCalledWith('CourseDetail', { courseId: 'course-42' });
  });

  it('revient en arrière au clic sur le bouton retour', () => {
    render(<SearchScreen />);
    fireEvent.press(screen.getByLabelText('Retour'));
    expect(mockGoBack).toHaveBeenCalled();
  });
});