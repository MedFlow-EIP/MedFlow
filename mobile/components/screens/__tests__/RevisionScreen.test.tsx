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

// La bonne réponse n'est PAS incluse ici — elle vient de la réponse du
// serveur à /api/revision/answer ou /check, pas de l'item lui-même.
const twoItems = {
  items: [
    {
      course_id: 'anatomy',
      course_nom: 'Anatomie',
      item_index: 0,
      question: 'Combien y a-t-il d\'os dans le corps humain adulte ?',
      options: { A: '186', B: '206', C: '226', D: '246' },
    },
    {
      course_id: 'anatomy',
      course_nom: 'Anatomie',
      item_index: 1,
      question: 'Quel est le plus grand organe du corps humain ?',
      options: { A: 'Le foie', B: 'Le cœur', C: 'La peau', D: 'Le poumon' },
    },
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
  it('affiche un loader pendant la récupération des questions dues', () => {
    (global.fetch as jest.Mock).mockReturnValue(new Promise(() => {}));
    render(<RevisionScreen />);
    expect(screen.UNSAFE_getByType(ActivityIndicator)).toBeTruthy();
  });
});

describe('RevisionScreen — état vide', () => {
  it('affiche "Rien à réviser" quand aucune question n\'est due', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(mockJsonResponse({ items: [], count: 0 }));

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

    (global.fetch as jest.Mock).mockResolvedValue(mockJsonResponse({ items: [], count: 0 }));
    fireEvent.press(screen.getByText('Réessayer'));

    await waitFor(() => {
      expect(screen.getByText("Rien à réviser aujourd'hui")).toBeTruthy();
    });
  });
});

describe('RevisionScreen — session de révision (quiz)', () => {
  it('affiche la question et les 4 options de la première question due', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(mockJsonResponse(twoItems));

    render(<RevisionScreen />);

    await waitFor(() => {
      expect(screen.getByText("Combien y a-t-il d'os dans le corps humain adulte ?")).toBeTruthy();
    });
    expect(screen.getByText('186')).toBeTruthy();
    expect(screen.getByText('206')).toBeTruthy();
    expect(screen.getByText('226')).toBeTruthy();
    expect(screen.getByText('246')).toBeTruthy();
    expect(screen.getByText('1 / 2')).toBeTruthy();
  });

  it('ne montre pas de bouton "Continuer" avant d\'avoir répondu', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(mockJsonResponse(twoItems));

    render(<RevisionScreen />);
    await waitFor(() => expect(screen.getByText('206')).toBeTruthy());

    expect(screen.queryByText('Continuer')).toBeNull();
  });

  it('envoie course_id, item_index et selected_option corrects à /api/revision/answer', async () => {
    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('/api/revision/due')) return Promise.resolve(mockJsonResponse(twoItems));
      return Promise.resolve(mockJsonResponse({ correct: true, correct_answer: 'B' }));
    });

    render(<RevisionScreen />);
    await waitFor(() => expect(screen.getByText('206')).toBeTruthy());

    fireEvent.press(screen.getByText('206'));

    await waitFor(() => {
      const answerCall = (global.fetch as jest.Mock).mock.calls.find((c) =>
        c[0].includes('/api/revision/answer')
      );
      expect(answerCall).toBeTruthy();
      const body = JSON.parse(answerCall[1].body);
      expect(body).toEqual({ course_id: 'anatomy', item_index: 0, selected_option: 'B' });
    });
  });

  it('affiche le bouton "Continuer" après avoir répondu', async () => {
    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('/api/revision/due')) return Promise.resolve(mockJsonResponse(twoItems));
      return Promise.resolve(mockJsonResponse({ correct: true, correct_answer: 'B' }));
    });

    render(<RevisionScreen />);
    await waitFor(() => expect(screen.getByText('206')).toBeTruthy());
    fireEvent.press(screen.getByText('206'));

    await waitFor(() => {
      expect(screen.getByText('Continuer')).toBeTruthy();
    });
  });

  it('empêche de changer de réponse une fois qu\'une option est choisie', async () => {
    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('/api/revision/due')) return Promise.resolve(mockJsonResponse(twoItems));
      return Promise.resolve(mockJsonResponse({ correct: true, correct_answer: 'B' }));
    });

    render(<RevisionScreen />);
    await waitFor(() => expect(screen.getByText('206')).toBeTruthy());
    fireEvent.press(screen.getByText('206'));
    await waitFor(() => expect(screen.getByText('Continuer')).toBeTruthy());

    const callsBefore = (global.fetch as jest.Mock).mock.calls.length;
    fireEvent.press(screen.getByText('186')); // tente de changer de réponse

    expect((global.fetch as jest.Mock).mock.calls.length).toBe(callsBefore);
  });

  it('passe à la question suivante au clic sur "Continuer"', async () => {
    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('/api/revision/due')) return Promise.resolve(mockJsonResponse(twoItems));
      return Promise.resolve(mockJsonResponse({ correct: true, correct_answer: 'B' }));
    });

    render(<RevisionScreen />);
    await waitFor(() => expect(screen.getByText('206')).toBeTruthy());
    fireEvent.press(screen.getByText('206'));
    await waitFor(() => expect(screen.getByText('Continuer')).toBeTruthy());

    fireEvent.press(screen.getByText('Continuer'));

    await waitFor(() => {
      expect(screen.getByText('Quel est le plus grand organe du corps humain ?')).toBeTruthy();
    });
    expect(screen.getByText('2 / 2')).toBeTruthy();
  });

  it('affiche l\'écran de fin avec le score après la dernière question', async () => {
    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('/api/revision/due')) return Promise.resolve(mockJsonResponse(twoItems));
      if (url.includes('/api/revision/answer')) {
        return Promise.resolve(mockJsonResponse({ correct: true, correct_answer: 'B' }));
      }
      return Promise.resolve(mockJsonResponse({ status: 'ok' }));
    });

    render(<RevisionScreen />);
    await waitFor(() => expect(screen.getByText('206')).toBeTruthy());
    fireEvent.press(screen.getByText('206'));
    await waitFor(() => expect(screen.getByText('Continuer')).toBeTruthy());
    fireEvent.press(screen.getByText('Continuer'));

    await waitFor(() => expect(screen.getByText('Le foie')).toBeTruthy());
    fireEvent.press(screen.getByText('Le foie'));
    await waitFor(() => expect(screen.getByText('Continuer')).toBeTruthy());
    fireEvent.press(screen.getByText('Continuer'));

    await waitFor(() => {
      expect(screen.getByText('Session terminée !')).toBeTruthy();
    });
    expect(screen.getByText('2 / 2 bonnes réponses (100%)')).toBeTruthy();
  });

  it('compte correctement un mélange de bonnes et mauvaises réponses', async () => {
    (global.fetch as jest.Mock).mockImplementation((url: string, opts: any) => {
      if (url.includes('/api/revision/due')) return Promise.resolve(mockJsonResponse(twoItems));
      if (url.includes('/api/revision/answer')) {
        const body = JSON.parse(opts.body);
        const correct = body.item_index === 0 ? body.selected_option === 'B' : body.selected_option === 'A';
        return Promise.resolve(mockJsonResponse({ correct, correct_answer: body.item_index === 0 ? 'B' : 'A' }));
      }
      return Promise.resolve(mockJsonResponse({ status: 'ok' }));
    });

    render(<RevisionScreen />);
    await waitFor(() => expect(screen.getByText('206')).toBeTruthy());
    fireEvent.press(screen.getByText('186')); // mauvaise réponse (correcte = B)
    await waitFor(() => expect(screen.getByText('Continuer')).toBeTruthy());
    fireEvent.press(screen.getByText('Continuer'));

    await waitFor(() => expect(screen.getByText('Le foie')).toBeTruthy());
    fireEvent.press(screen.getByText('Le foie')); // bonne réponse
    await waitFor(() => expect(screen.getByText('Continuer')).toBeTruthy());
    fireEvent.press(screen.getByText('Continuer'));

    await waitFor(() => {
      expect(screen.getByText('1 / 2 bonnes réponses (50%)')).toBeTruthy();
    });
  });

  it('envoie /api/session-done avec le bon score en fin de session', async () => {
    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('/api/revision/due')) return Promise.resolve(mockJsonResponse(twoItems));
      if (url.includes('/api/revision/answer')) {
        return Promise.resolve(mockJsonResponse({ correct: true, correct_answer: 'B' }));
      }
      return Promise.resolve(mockJsonResponse({ status: 'ok' }));
    });

    render(<RevisionScreen />);
    await waitFor(() => expect(screen.getByText('206')).toBeTruthy());
    fireEvent.press(screen.getByText('206'));
    await waitFor(() => expect(screen.getByText('Continuer')).toBeTruthy());
    fireEvent.press(screen.getByText('Continuer'));

    await waitFor(() => expect(screen.getByText('Le foie')).toBeTruthy());
    fireEvent.press(screen.getByText('Le foie'));
    await waitFor(() => expect(screen.getByText('Continuer')).toBeTruthy());
    fireEvent.press(screen.getByText('Continuer'));

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
        score: 100,
        total_questions: 2,
      });
    });
  });
});

describe('RevisionScreen — révision ciblée sur un cours', () => {
  it('inclut course_id dans l\'appel à /api/revision/due', async () => {
    (global as any).__mockRouteParams = { courseId: 'cardiology' };
    (global.fetch as jest.Mock).mockResolvedValue(mockJsonResponse({ items: [], count: 0 }));

    render(<RevisionScreen />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('course_id=cardiology'),
        expect.anything()
      );
    });
  });
});

describe('RevisionScreen — mode pratique (reviser autant de fois que voulu)', () => {
  it('propose "Réviser quand même" quand rien n\'est dû (mode programmé)', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(mockJsonResponse({ items: [], count: 0 }));

    render(<RevisionScreen />);

    await waitFor(() => {
      expect(screen.getByText('Réviser quand même (mode libre)')).toBeTruthy();
    });
  });

  it('bascule sur /api/revision/practice au clic sur "Réviser quand même"', async () => {
    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('/api/revision/practice')) return Promise.resolve(mockJsonResponse(twoItems));
      return Promise.resolve(mockJsonResponse({ items: [], count: 0 }));
    });

    render(<RevisionScreen />);
    await waitFor(() => expect(screen.getByText('Réviser quand même (mode libre)')).toBeTruthy());

    fireEvent.press(screen.getByText('Réviser quand même (mode libre)'));

    await waitFor(() => {
      expect(screen.getByText("Combien y a-t-il d'os dans le corps humain adulte ?")).toBeTruthy();
    });
  });

  it('utilise /api/revision/check (pas /answer) pour répondre en mode pratique', async () => {
    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('/api/revision/practice')) return Promise.resolve(mockJsonResponse(twoItems));
      if (url.includes('/api/revision/check')) {
        return Promise.resolve(mockJsonResponse({ correct: true, correct_answer: 'B' }));
      }
      return Promise.resolve(mockJsonResponse({ items: [], count: 0 }));
    });

    render(<RevisionScreen />);
    await waitFor(() => expect(screen.getByText('Réviser quand même (mode libre)')).toBeTruthy());
    fireEvent.press(screen.getByText('Réviser quand même (mode libre)'));
    await waitFor(() => expect(screen.getByText('206')).toBeTruthy());

    fireEvent.press(screen.getByText('206'));

    await waitFor(() => {
      const checkCall = (global.fetch as jest.Mock).mock.calls.find((c) =>
        c[0].includes('/api/revision/check')
      );
      expect(checkCall).toBeTruthy();
      const answerCall = (global.fetch as jest.Mock).mock.calls.find((c) =>
        c[0].includes('/api/revision/answer')
      );
      expect(answerCall).toBeUndefined();
    });
  });

  it('affiche un rappel que le mode libre n\'affecte pas le planning, sur l\'écran de fin', async () => {
    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('/api/revision/practice')) return Promise.resolve(mockJsonResponse(twoItems));
      return Promise.resolve(mockJsonResponse({ items: [], count: 0, status: 'ok' }));
    });

    render(<RevisionScreen />);
    await waitFor(() => expect(screen.getByText('Réviser quand même (mode libre)')).toBeTruthy());
    fireEvent.press(screen.getByText('Réviser quand même (mode libre)'));

    await waitFor(() => expect(screen.getByText('206')).toBeTruthy());
    fireEvent.press(screen.getByText('206'));
    await waitFor(() => expect(screen.getByText('Continuer')).toBeTruthy());
    fireEvent.press(screen.getByText('Continuer'));

    await waitFor(() => expect(screen.getByText('Le foie')).toBeTruthy());
    fireEvent.press(screen.getByText('Le foie'));
    await waitFor(() => expect(screen.getByText('Continuer')).toBeTruthy());
    fireEvent.press(screen.getByText('Continuer'));

    await waitFor(() => {
      expect(screen.getByText("Mode libre — ce résultat n'affecte pas ton planning de révision.")).toBeTruthy();
    });
  });

  it('"Recommencer" relance une session en mode pratique', async () => {
    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('/api/revision/due')) return Promise.resolve(mockJsonResponse({ items: [], count: 0 }));
      if (url.includes('/api/revision/practice')) return Promise.resolve(mockJsonResponse(twoItems));
      if (url.includes('/api/revision/check') || url.includes('/api/revision/answer')) {
        return Promise.resolve(mockJsonResponse({ correct: true, correct_answer: 'B' }));
      }
      return Promise.resolve(mockJsonResponse({ status: 'ok' }));
    });

    render(<RevisionScreen />);
    await waitFor(() => expect(screen.getByText('Réviser quand même (mode libre)')).toBeTruthy());
    fireEvent.press(screen.getByText('Réviser quand même (mode libre)'));

    await waitFor(() => expect(screen.getByText('206')).toBeTruthy());
    fireEvent.press(screen.getByText('206'));
    await waitFor(() => expect(screen.getByText('Continuer')).toBeTruthy());
    fireEvent.press(screen.getByText('Continuer'));
    await waitFor(() => expect(screen.getByText('Le foie')).toBeTruthy());
    fireEvent.press(screen.getByText('Le foie'));
    await waitFor(() => expect(screen.getByText('Continuer')).toBeTruthy());
    fireEvent.press(screen.getByText('Continuer'));

    await waitFor(() => expect(screen.getByText('Session terminée !')).toBeTruthy());
    fireEvent.press(screen.getByText('Recommencer'));

    await waitFor(() => {
      expect(screen.getByText("Combien y a-t-il d'os dans le corps humain adulte ?")).toBeTruthy();
    });
  });

  it('n\'affiche pas de bouton "Recommencer/Reviser quand meme" en boucle sur un cours sans quiz', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(mockJsonResponse({ items: [], count: 0 }));

    render(<RevisionScreen />);
    await waitFor(() => expect(screen.getByText('Réviser quand même (mode libre)')).toBeTruthy());
    fireEvent.press(screen.getByText('Réviser quand même (mode libre)'));

    await waitFor(() => {
      expect(screen.getByText('Aucune question dans ce cours')).toBeTruthy();
    });
    expect(screen.queryByText('Réviser quand même (mode libre)')).toBeNull();
  });
});

describe('RevisionScreen — pas de flash "faux" avant la vraie reponse (regression)', () => {
  it('n\'affiche aucune icone rouge tant que le serveur n\'a pas confirme', async () => {
    let resolveAnswer: (value: any) => void = () => {};
    const pendingAnswer = new Promise((resolve) => { resolveAnswer = resolve; });

    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('/api/revision/due')) return Promise.resolve(mockJsonResponse(twoItems));
      if (url.includes('/api/revision/answer')) return pendingAnswer;
      return Promise.resolve(mockJsonResponse({ status: 'ok' }));
    });

    render(<RevisionScreen />);
    await waitFor(() => expect(screen.getByText('206')).toBeTruthy());

    fireEvent.press(screen.getByText('206')); // bonne réponse, mais le serveur n'a pas encore répondu

    await waitFor(() => {
      expect(screen.UNSAFE_queryAllByProps({ name: 'close-circle' })).toHaveLength(0);
    });
    expect(screen.UNSAFE_queryAllByProps({ name: 'checkmark-circle' })).toHaveLength(0);

    resolveAnswer(mockJsonResponse({ correct: true, correct_answer: 'B' }));

    await waitFor(() => {
      expect(screen.UNSAFE_getByProps({ name: 'checkmark-circle' })).toBeTruthy();
    });
    expect(screen.UNSAFE_queryAllByProps({ name: 'close-circle' })).toHaveLength(0);
  });

  it('n\'affiche jamais l\'icone "faux" si la reponse choisie etait la bonne', async () => {
    let resolveAnswer: (value: any) => void = () => {};
    const pendingAnswer = new Promise((resolve) => { resolveAnswer = resolve; });

    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('/api/revision/due')) return Promise.resolve(mockJsonResponse(twoItems));
      if (url.includes('/api/revision/answer')) return pendingAnswer;
      return Promise.resolve(mockJsonResponse({ status: 'ok' }));
    });

    render(<RevisionScreen />);
    await waitFor(() => expect(screen.getByText('206')).toBeTruthy());
    fireEvent.press(screen.getByText('206'));

    resolveAnswer(mockJsonResponse({ correct: true, correct_answer: 'B' }));

    await waitFor(() => {
      expect(screen.UNSAFE_getByProps({ name: 'checkmark-circle' })).toBeTruthy();
    });
    expect(screen.UNSAFE_queryAllByProps({ name: 'close-circle' })).toHaveLength(0);
  });
});