import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { StreakSheet } from '../StreakSheet';

jest.mock('../../theme/ThemeContext', () => ({
  useTheme: () => ({ colors: require('../../theme/colors').lightColors, isDark: false }),
}));

describe('StreakSheet', () => {
  it('indique dans combien de jours arrive la prochaine protection', () => {
    render(<StreakSheet visible streak={5} freezes={1} maxFreezes={2} onClose={jest.fn()} />);
    expect(screen.getByText('5 jours de série')).toBeTruthy();
    expect(screen.getByLabelText('1 protection sur 2')).toBeTruthy();
    expect(screen.getByText(/la prochaine dans 2 jours/)).toBeTruthy();
  });

  it('signale quand le maximum est atteint', () => {
    render(<StreakSheet visible streak={14} freezes={2} maxFreezes={2} onClose={jest.fn()} />);
    expect(screen.getByText(/Tu as le maximum \(2\)/)).toBeTruthy();
  });
});
