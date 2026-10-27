import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { ClinicalCaseScreen, type CaseState } from '../ClinicalCaseScreen';

jest.mock('../../../theme/ThemeContext', () => ({
  useTheme: () => ({ colors: require('../../../theme/colors').lightColors, isDark: false }),
}));
jest.mock('../../../firebaseConfig', () => ({ auth: { currentUser: { uid: 'u1' } } }));
jest.mock('../../../utils/authHeaders', () => ({
  getAuthHeaders: jest.fn().mockResolvedValue({ Authorization: 'Bearer t' }),
}));
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: jest.fn() }),
  useRoute: () => ({ params: { caseId: 7 } }),
  useFocusEffect: (cb: () => void) => require('react').useEffect(cb, []),
}));

const json = (body: any) => ({ ok: true, status: 200, json: async () => body }) as any;
const options = { A: 'Repos', B: 'ECG immédiat', C: 'Antalgique', D: 'Retour à domicile' };
const step = (i: number) => ({ index: i, situation: `Situation ${i}`, question: `Question ${i} ?`, options });

const initial: CaseState = {
  id: 7,
  title: 'Douleur thoracique',
  source_label: 'Cardiologie',
  context: 'Homme de 58 ans, fumeur.',
  total_steps: 2,
  played: [],
  current: step(0),
  finished: false,
  score: 0,
  debrief: [],
};

const played = (i: number, choice: string) => ({
  ...step(i),
  choice,
  correct: 'B',
  is_correct: choice === 'B',
  feedback: choice === 'B' ? 'Indispensable devant une douleur thoracique.' : 'Retarde le diagnostic.',
  explanation: 'L’ECG se fait dans les 10 minutes.',
});

beforeEach(() => {
  global.fetch = jest.fn().mockImplementation((url: string, init?: any) => {
    if (!url.endsWith('/answer')) return Promise.resolve(json(initial));
    const { step: s, option } = JSON.parse(init.body);
    const done = s === 1;
    return Promise.resolve(
      json({
        xp_gained: option === 'B' ? (done ? 15 : 5) : done ? 10 : 0,
        case: {
          ...initial,
          played: s === 0 ? [played(0, option)] : [played(0, 'A'), played(1, option)],
          current: done ? null : step(1),
          finished: done,
          score: option === 'B' ? 1 : 0,
          debrief: done ? ['Toujours un ECG en premier.'] : [],
        },
      })
    );
  });
});

it('affiche le dossier puis le retour sur un mauvais choix', async () => {
  render(<ClinicalCaseScreen />);
  await waitFor(() => expect(screen.getByText('Homme de 58 ans, fumeur.')).toBeTruthy());
  fireEvent.press(screen.getByText('Repos'));
  fireEvent.press(screen.getByText('Valider ma décision'));

  await waitFor(() => expect(screen.getByText('Ce n’était pas le meilleur choix')).toBeTruthy());
  expect(screen.getByText('Retarde le diagnostic.')).toBeTruthy();
  expect(screen.getByText('Meilleur choix : ECG immédiat')).toBeTruthy();
});

it('va jusqu’au débriefing', async () => {
  render(<ClinicalCaseScreen />);
  await waitFor(() => expect(screen.getByText('Question 0 ?')).toBeTruthy());
  fireEvent.press(screen.getByText('Repos'));
  fireEvent.press(screen.getByText('Valider ma décision'));
  await waitFor(() => expect(screen.getByText('Étape suivante')).toBeTruthy());
  fireEvent.press(screen.getByText('Étape suivante'));

  await waitFor(() => expect(screen.getByText('Question 1 ?')).toBeTruthy());
  fireEvent.press(screen.getByText('ECG immédiat'));
  fireEvent.press(screen.getByText('Valider ma décision'));
  await waitFor(() => expect(screen.getByText('Bonne décision')).toBeTruthy());
  fireEvent.press(screen.getByText('Voir le débriefing'));

  await waitFor(() => expect(screen.getByText('Toujours un ECG en premier.')).toBeTruthy());
  expect(screen.getByText('1/2 bonnes décisions')).toBeTruthy();
  expect(screen.getByText('+15 XP')).toBeTruthy();
});
