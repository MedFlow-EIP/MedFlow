import React from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';
import { SpecialtyStats } from '../SpecialtyStats';

jest.mock('../../theme/ThemeContext', () => ({
  useTheme: () => ({ colors: require('../../theme/colors').lightColors, isDark: false }),
}));
jest.mock('../../firebaseConfig', () => ({ auth: { currentUser: { uid: 'u1' } } }));
jest.mock('../../utils/authHeaders', () => ({
  getAuthHeaders: jest.fn().mockResolvedValue({ Authorization: 'Bearer t' }),
}));
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (cb: () => void) => require('react').useEffect(cb, []),
}));

const json = (body: any, ok = true) => ({ ok, json: async () => body }) as any;

describe('SpecialtyStats', () => {
  it('affiche maîtrise, cartes dues et réussite par spécialité', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      json({
        specialties: [
          { tag: 'Cardiologie', courses: 2, questions: 10, mastered: 3, mastery: 30, due_today: 4, answers: 8, accuracy: 75 },
          { tag: 'Sans spécialité', courses: 1, questions: 2, mastered: 0, mastery: 0, due_today: 2, answers: 0, accuracy: null },
        ],
      })
    );
    render(<SpecialtyStats />);
    await waitFor(() => expect(screen.getByText('Cardiologie')).toBeTruthy());
    expect(screen.getByText('3/10 maîtrisées · 4 à revoir · 75 % de réussite')).toBeTruthy();
    expect(screen.getByText('0/2 maîtrisées · 2 à revoir')).toBeTruthy();
  });

  it('ne rend rien en cas d’erreur', async () => {
    global.fetch = jest.fn().mockResolvedValue(json({}, false));
    render(<SpecialtyStats />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    expect(screen.queryByText('Par spécialité')).toBeNull();
  });
});
