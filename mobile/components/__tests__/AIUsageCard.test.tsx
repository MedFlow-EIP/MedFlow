import React from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';
import { AIUsageCard, availableAt } from '../AIUsageCard';

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

const json = (body: any) => ({ ok: true, status: 200, json: async () => body }) as any;

describe('AIUsageCard', () => {
  it('affiche ce qui a été utilisé pour chaque type', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      json({
        usage: [
          { kind: 'chat', used: 12, limit: 60, blocked_until: null },
          { kind: 'process', used: 1, limit: 10, blocked_until: null },
          { kind: 'case', used: 0, limit: 15, blocked_until: null },
        ],
      })
    );
    render(<AIUsageCard />);
    await waitFor(() => expect(screen.getByText('12 / 60')).toBeTruthy());
    expect(screen.getByText('1 / 10')).toBeTruthy();
    expect(screen.getByLabelText('Messages à l’assistant : 48 restants sur 60')).toBeTruthy();
  });

  it('dit quand une limite atteinte se libère', async () => {
    const soon = new Date();
    soon.setMinutes(soon.getMinutes() + 1);
    global.fetch = jest.fn().mockResolvedValue(
      json({ usage: [{ kind: 'chat', used: 60, limit: 60, blocked_until: soon.toISOString() }] })
    );
    render(<AIUsageCard />);
    await waitFor(() =>
      expect(screen.getByText(`Limite atteinte · de nouveau disponible à ${availableAt(soon.toISOString())}`)).toBeTruthy()
    );
  });

  it('ne s’affiche pas sans réseau', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('offline'));
    render(<AIUsageCard />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    expect(screen.queryByText('Ton IA sur 24 h')).toBeNull();
  });
});

describe('availableAt', () => {
  it('donne l’heure, ou « demain » si ce n’est pas aujourd’hui', () => {
    const now = new Date(2026, 9, 28, 10, 0);
    expect(availableAt(new Date(2026, 9, 28, 14, 5).toISOString(), now)).toBe('14 h 05');
    expect(availableAt(new Date(2026, 9, 29, 9, 30).toISOString(), now)).toBe('demain 9 h 30');
  });
});
