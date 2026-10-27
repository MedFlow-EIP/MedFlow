import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { FlashcardReviewScreen } from '../FlashcardReviewScreen';

jest.mock('../../../theme/ThemeContext', () => ({
  useTheme: () => ({ colors: require('../../../theme/colors').lightColors, isDark: false }),
}));
jest.mock('../../../firebaseConfig', () => ({ auth: { currentUser: { uid: 'u1' } } }));
jest.mock('../../../utils/authHeaders', () => ({
  getAuthHeaders: jest.fn().mockResolvedValue({ Authorization: 'Bearer t' }),
}));
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: jest.fn() }),
  useRoute: () => ({ params: undefined }),
  useFocusEffect: (cb: () => void) => require('react').useEffect(cb, []),
}));

const json = (body: any) => ({ ok: true, status: 200, json: async () => body }) as any;
const cards = [
  { course_id: 'c', course_nom: 'Cardio', card_key: 'k1', question: 'Combien de cavités ?', answer: 'Quatre' },
  { course_id: 'c', course_nom: 'Cardio', card_key: 'k2', question: 'Valve mitrale ?', answer: 'À gauche' },
];

beforeEach(() => {
  global.fetch = jest.fn().mockImplementation((url: string) =>
    Promise.resolve(url.includes('/due') ? json({ items: cards, count: 2, total_due: 2 }) : json({ interval_days: 1 }))
  );
});

it('montre la réponse puis enregistre la note', async () => {
  render(<FlashcardReviewScreen />);
  await waitFor(() => expect(screen.getByText('Combien de cavités ?')).toBeTruthy());
  expect(screen.queryByText('Quatre')).toBeNull();

  fireEvent.press(screen.getByText('Voir la réponse'));
  expect(screen.getByText('Quatre')).toBeTruthy();
  fireEvent.press(screen.getByText('Bien'));

  await waitFor(() => expect(screen.getByText('Valve mitrale ?')).toBeTruthy());
  const review = (global.fetch as jest.Mock).mock.calls.find((c) => String(c[0]).endsWith('/review'));
  expect(JSON.parse(review[1].body)).toEqual({ course_id: 'c', card_key: 'k1', grade: 'good' });
});

it('affiche la fin de session', async () => {
  render(<FlashcardReviewScreen />);
  for (const q of ['Combien de cavités ?', 'Valve mitrale ?']) {
    await waitFor(() => expect(screen.getByText(q)).toBeTruthy());
    fireEvent.press(screen.getByText('Voir la réponse'));
    fireEvent.press(screen.getByText('Facile'));
  }
  await waitFor(() => expect(screen.getByText('Session terminée')).toBeTruthy());
  expect(screen.getByText(/2 cartes revues/)).toBeTruthy();
});
