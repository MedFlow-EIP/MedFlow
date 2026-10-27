import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { MockExamScreen, formatClock } from '../MockExamScreen';

jest.mock('../../../theme/ThemeContext', () => ({
  useTheme: () => ({ colors: require('../../../theme/colors').lightColors, isDark: false }),
}));
jest.mock('../../../firebaseConfig', () => ({ auth: { currentUser: { uid: 'u1' } } }));
jest.mock('../../../utils/authHeaders', () => ({
  getAuthHeaders: jest.fn().mockResolvedValue({ Authorization: 'Bearer t' }),
}));
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: jest.fn(), addListener: () => () => {}, dispatch: jest.fn() }),
  useFocusEffect: (cb: () => void) => require('react').useEffect(cb, []),
}));

const json = (body: any, status = 200) => ({ ok: status < 400, status, json: async () => body }) as any;

const questions = [
  { course_id: 'c', course_nom: 'Cardio', item_index: 0, question: 'Combien de cavités ?', options: { A: '4', B: '2' } },
  { course_id: 'c', course_nom: 'Cardio', item_index: 1, question: 'Valve mitrale ?', options: { A: 'Gauche', B: 'Droite' } },
];

beforeEach(() => {
  global.fetch = jest.fn().mockImplementation((url: string, init?: any) => {
    if (url.includes('/api/dashboard')) return Promise.resolve(json({ cours: [{ id: 'c', nom: 'Cardio', quiz: 2 }] }));
    if (url.endsWith('/start')) return Promise.resolve(json({ exam_id: 3, duration_seconds: 120, questions }, 201));
    if (url.endsWith('/submit')) {
      const { answers } = JSON.parse(init.body);
      return Promise.resolve(
        json({
          score: answers['c:0'] === 'A' ? 1 : 0,
          total: 2,
          grade: 10,
          xp_gained: 2,
          corrections: questions.map((q) => ({
            ...q,
            selected: answers[`${q.course_id}:${q.item_index}`] ?? null,
            correct_answer: 'A',
            explanation: null,
            is_correct: answers[`${q.course_id}:${q.item_index}`] === 'A',
          })),
        })
      );
    }
    return Promise.resolve(json({}, 404));
  });
});

it('formate le chrono', () => {
  expect(formatClock(545)).toBe('09:05');
  expect(formatClock(-3)).toBe('00:00');
});

it('déroule un examen et affiche la note', async () => {
  render(<MockExamScreen />);
  await waitFor(() => expect(screen.getByText('Commencer (2 questions)')).toBeTruthy());
  fireEvent.press(screen.getByText('Commencer (2 questions)'));

  await waitFor(() => expect(screen.getByText('Combien de cavités ?')).toBeTruthy());
  expect(screen.getByLabelText('Temps restant 02:00')).toBeTruthy();
  fireEvent.press(screen.getByText('4'));
  fireEvent.press(screen.getByText('Question suivante'));
  fireEvent.press(screen.getByText('Gauche'));
  fireEvent.press(screen.getByText('Rendre la copie'));

  await waitFor(() => expect(screen.getByText('10/20')).toBeTruthy());
  const submitCall = (global.fetch as jest.Mock).mock.calls.find((c) => String(c[0]).endsWith('/submit'));
  expect(JSON.parse(submitCall[1].body).answers).toEqual({ 'c:0': 'A', 'c:1': 'A' });
  expect(screen.getByText('Corrigé')).toBeTruthy();
});
