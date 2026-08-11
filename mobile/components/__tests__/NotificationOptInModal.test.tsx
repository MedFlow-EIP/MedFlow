import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { NotificationOptInModal } from '../../components/NotificationOptInModal';

jest.mock('../../theme/ThemeContext', () => ({
  useTheme: () => ({ colors: require('../../theme/colors').lightColors, isDark: false }),
}));

describe('NotificationOptInModal', () => {
  it('ne rend rien quand visible=false', () => {
    const { toJSON } = render(
      <NotificationOptInModal visible={false} onAccept={jest.fn()} onDecline={jest.fn()} />
    );
    expect(toJSON()).toBeNull();
  });

  it('affiche le titre quand visible=true', () => {
    render(<NotificationOptInModal visible={true} onAccept={jest.fn()} onDecline={jest.fn()} />);
    expect(screen.getByText('Garde ta série vivante !')).toBeTruthy();
  });

  it('appelle onAccept au clic sur "Activer les rappels"', () => {
    const onAccept = jest.fn();
    render(<NotificationOptInModal visible={true} onAccept={onAccept} onDecline={jest.fn()} />);

    fireEvent.press(screen.getByText('Activer les rappels'));

    expect(onAccept).toHaveBeenCalledTimes(1);
  });

  it('appelle onDecline au clic sur "Plus tard"', () => {
    const onDecline = jest.fn();
    render(<NotificationOptInModal visible={true} onAccept={jest.fn()} onDecline={onDecline} />);

    fireEvent.press(screen.getByText('Plus tard'));

    expect(onDecline).toHaveBeenCalledTimes(1);
  });

  it('n\'appelle jamais onAccept quand on clique sur "Plus tard"', () => {
    const onAccept = jest.fn();
    render(<NotificationOptInModal visible={true} onAccept={onAccept} onDecline={jest.fn()} />);

    fireEvent.press(screen.getByText('Plus tard'));

    expect(onAccept).not.toHaveBeenCalled();
  });
});