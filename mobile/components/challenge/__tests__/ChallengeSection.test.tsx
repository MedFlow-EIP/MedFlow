import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react-native';
import { ChallengeSection, challengeStatusText, type Challenge } from '../ChallengeSection';

jest.mock('../../../theme/ThemeContext', () => ({
  useTheme: () => ({ colors: require('../../../theme/colors').lightColors, isDark: false }),
}));
jest.mock('../../../firebaseConfig', () => ({ auth: { currentUser: { uid: 'u1' } } }));
jest.mock('../../../utils/authHeaders', () => ({
  getAuthHeaders: jest.fn().mockResolvedValue({ Authorization: 'Bearer t' }),
}));
const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
  useFocusEffect: (cb: () => void) => require('react').useEffect(cb, []),
}));

const base: Challenge = {
  id: 1,
  role: 'opponent',
  friend_uid: 'bob',
  friend_name: 'Bob',
  course_nom: 'Cardio',
  total: 5,
  status: 'pending',
  my_score: null,
  their_score: null,
  outcome: null,
  can_play: true,
};

describe('challengeStatusText', () => {
  it.each([
    [base, 'À toi de jouer'],
    [{ ...base, role: 'challenger', can_play: false, my_score: 3 }, 'En attente de Bob'],
    [{ ...base, status: 'done', can_play: false, my_score: 4, their_score: 2, outcome: 'win' }, 'Gagné 4 à 2'],
    [{ ...base, status: 'done', can_play: false, my_score: 1, their_score: 2, outcome: 'loss' }, 'Perdu 1 à 2'],
    [{ ...base, status: 'expired', can_play: false }, 'Expiré'],
  ] as [Challenge, string][])('%#', (challenge, text) => {
    expect(challengeStatusText(challenge)).toBe(text);
  });
});

describe('ChallengeSection', () => {
  it('liste les défis et ouvre celui à jouer', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ challenges: [base] }) });
    render(<ChallengeSection refreshKey={0} />);
    await waitFor(() => expect(screen.getByText('Bob te défie')).toBeTruthy());
    fireEvent.press(screen.getByLabelText('Jouer le défi contre Bob'));
    expect(mockNavigate).toHaveBeenCalledWith('Challenge', { challengeId: 1 });
  });

  it('ne rend rien sans défi', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ challenges: [] }) });
    render(<ChallengeSection refreshKey={0} />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    expect(screen.queryByText('Défis')).toBeNull();
  });
});
