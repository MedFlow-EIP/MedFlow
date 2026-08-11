import React from 'react';
import { Image } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { AvatarBubble } from '../../components/AvatarBubble';


jest.mock('../../theme/ThemeContext', () => ({
  useTheme: () => ({ colors: require('../../theme/colors').lightColors, isDark: false }),
}));

describe('AvatarBubble', () => {
  it('affiche une image quand une URI est fournie', () => {
    render(<AvatarBubble uri="https://example.com/avatar.jpg" displayName="Camille" />);

    const image = screen.UNSAFE_getByType(Image);
    expect(image.props.source).toEqual({ uri: 'https://example.com/avatar.jpg' });
  });

  it('affiche l\'initiale en majuscule quand aucune URI n\'est fournie', () => {
    render(<AvatarBubble uri={null} displayName="camille" />);

    expect(screen.getByText('C')).toBeTruthy();
  });

  it('affiche l\'initiale quand uri est undefined (pas seulement null)', () => {
    render(<AvatarBubble displayName="Bob" />);

    expect(screen.getByText('B')).toBeTruthy();
  });

  it('affiche l\'initiale quand uri est une chaîne vide', () => {
    render(<AvatarBubble uri="" displayName="Alice" />);

    expect(screen.getByText('A')).toBeTruthy();
  });

  it('ne montre pas de texte de repli quand une image est affichée', () => {
    render(<AvatarBubble uri="https://example.com/avatar.jpg" displayName="Camille" />);

    expect(screen.queryByText('C')).toBeNull();
  });
});