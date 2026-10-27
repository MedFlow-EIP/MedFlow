import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react-native';
import { QuestsCard } from '../QuestsCard';

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

const json = (body: any, ok = true, status = 200) => ({ ok, status, json: async () => body }) as any;

const quests = [
  { id: 'daily_answers', period: 'daily', title: 'Réponds à 15 questions', icon: 'help-circle', progress: 15, target: 15, xp: 15, completed: true, claimed: false },
  { id: 'daily_lesson', period: 'daily', title: 'Termine une leçon', icon: 'school', progress: 0, target: 1, xp: 20, completed: false, claimed: false },
  { id: 'weekly_import', period: 'weekly', title: 'Importe un nouveau cours', icon: 'cloud-upload', progress: 1, target: 1, xp: 30, completed: true, claimed: true },
];

describe('QuestsCard', () => {
  beforeEach(() => {
    global.fetch = jest.fn().mockImplementation((url: string) =>
      Promise.resolve(url.endsWith('/claim') ? json({ xp_gained: 15 }) : json({ quests }))
    );
  });

  it('affiche les quêtes du jour avec leur progression', async () => {
    render(<QuestsCard />);
    await waitFor(() => expect(screen.getByText('Réponds à 15 questions')).toBeTruthy());
    expect(screen.getByText('0/1')).toBeTruthy();
    expect(screen.queryByText('Importe un nouveau cours')).toBeNull();
  });

  it('récupère l’XP d’une quête terminée', async () => {
    render(<QuestsCard />);
    await waitFor(() => expect(screen.getByText('+15 XP')).toBeTruthy());
    fireEvent.press(screen.getByText('+15 XP'));
    await waitFor(() => expect(screen.getAllByText('Récupéré').length).toBe(1));
    expect((global.fetch as jest.Mock).mock.calls.some((c) => String(c[0]).endsWith('/api/quests/daily_answers/claim'))).toBe(true);
  });

  it('montre les quêtes de la semaine', async () => {
    render(<QuestsCard />);
    await waitFor(() => expect(screen.getByText('Semaine')).toBeTruthy());
    fireEvent.press(screen.getByText('Semaine'));
    expect(screen.getByText('Importe un nouveau cours')).toBeTruthy();
    expect(screen.getByText('Récupéré')).toBeTruthy();
  });
});
