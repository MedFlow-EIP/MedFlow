import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { TodayCard } from '../TodayCard';

const mockNavigate = jest.fn();
jest.mock('../../theme/ThemeContext', () => ({
  useTheme: () => ({ colors: require('../../theme/colors').lightColors, isDark: false }),
}));
jest.mock('../../firebaseConfig', () => ({ auth: { currentUser: { uid: 'u1' } } }));
jest.mock('../../utils/authHeaders', () => ({
  getAuthHeaders: jest.fn().mockResolvedValue({ Authorization: 'Bearer t' }),
}));
jest.mock('../DemoCourseButton', () => ({ DemoCourseButton: () => null }));
jest.mock('../../utils/examReminders', () => ({ countdownLabel: (days: number) => `J-${days}` }));
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (cb: () => void) => require('react').useEffect(cb, []),
  useNavigation: () => ({ navigate: mockNavigate }),
}));

const json = (body: any) => ({ ok: true, status: 200, json: async () => body }) as any;

function serve(routes: Record<string, any>) {
  global.fetch = jest.fn().mockImplementation((url: string) => {
    const key = Object.keys(routes).find((r) => url.includes(r));
    return Promise.resolve(json(key ? routes[key] : {}));
  }) as any;
}

beforeEach(() => mockNavigate.mockClear());

describe('TodayCard', () => {
  it('met la révision du jour et les derniers cours en avant', async () => {
    serve({
      '/api/revision/due': { count: 16 },
      '/api/flashcards/due': { total_due: 4 },
      '/api/dashboard': {
        cours: [
          { id: 'a', nom: 'Ancien', created_at: '2026-09-01' },
          { id: 'b', nom: 'Cardiologie', created_at: '2026-10-20' },
          { id: 'c', nom: 'Neurologie', created_at: '2026-10-10' },
          { id: 'd', nom: 'Pneumologie', created_at: '2026-10-15' },
        ],
        stats: { cours: 4 },
      },
      '/api/exams': { exams: [{ title: 'Partiel S1', days_left: 12 }] },
    });
    render(<TodayCard />);

    await waitFor(() => expect(screen.getByText('Réviser · 16 questions')).toBeTruthy());
    expect(screen.getByText('Flashcards · 4')).toBeTruthy();
    expect(screen.getByText('Tout voir (4)')).toBeTruthy();
    expect(screen.queryByText('Ancien')).toBeNull();
    expect(screen.getAllByLabelText(/^Ouvrir le cours/).map((n) => n.props.accessibilityLabel)).toEqual([
      'Ouvrir le cours Cardiologie',
      'Ouvrir le cours Pneumologie',
      'Ouvrir le cours Neurologie',
    ]);

    fireEvent.press(screen.getByText('Réviser · 16 questions'));
    expect(mockNavigate).toHaveBeenCalledWith('Revision');
  });

  it('dit quand tout est révisé', async () => {
    serve({
      '/api/revision/due': { count: 0 },
      '/api/dashboard': { cours: [{ id: 'b', nom: 'Cardiologie' }], stats: { cours: 1 } },
    });
    render(<TodayCard />);
    await waitFor(() => expect(screen.getByText('Tout est révisé pour aujourd’hui')).toBeTruthy());
  });

  it('propose d’importer un premier cours quand il n’y en a aucun', async () => {
    serve({ '/api/dashboard': { cours: [], stats: { cours: 0 } } });
    render(<TodayCard />);
    await waitFor(() => expect(screen.getByText('Importer mon premier cours')).toBeTruthy());
    fireEvent.press(screen.getByText('Importer mon premier cours'));
    expect(mockNavigate).toHaveBeenCalledWith('UploadCourse');
  });
});
