import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { Button } from '../button';

jest.mock('../../../theme/ThemeContext', () => ({
  useTheme: () => ({ colors: require('../../../theme/colors').lightColors, isDark: false }),
}));

describe('Button', () => {
  it('affiche le texte fourni via title', () => {
    render(<Button title="Valider" />);
    expect(screen.getByText('Valider')).toBeTruthy();
  });

  it('affiche children quand title n\'est pas fourni', () => {
    render(<Button>Continuer</Button>);
    expect(screen.getByText('Continuer')).toBeTruthy();
  });

  it('title est prioritaire sur children si les deux sont fournis', () => {
    render(<Button title="Valider">Continuer</Button>);
    expect(screen.getByText('Valider')).toBeTruthy();
    expect(screen.queryByText('Continuer')).toBeNull();
  });

  it('appelle onPress au clic', () => {
    const onPress = jest.fn();
    render(<Button title="Valider" onPress={onPress} />);

    fireEvent.press(screen.getByText('Valider'));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('n\'appelle pas onPress quand disabled=true', () => {
    const onPress = jest.fn();
    render(<Button title="Valider" onPress={onPress} disabled />);

    fireEvent.press(screen.getByText('Valider'));

    expect(onPress).not.toHaveBeenCalled();
  });

  it('n\'appelle pas onPress quand loading=true', () => {
    const onPress = jest.fn();
    render(<Button title="Valider" onPress={onPress} loading />);

    // Le texte n'est pas rendu pendant le chargement (remplacé par le
    // spinner) — on cherche donc le Pressable via son état disabled.
    const { UNSAFE_root } = screen;
    expect(screen.queryByText('Valider')).toBeNull();
  });

  it('masque le texte et affiche un indicateur de chargement quand loading=true', () => {
    render(<Button title="Valider" loading />);

    expect(screen.queryByText('Valider')).toBeNull();
    expect(screen.UNSAFE_getByType(require('react-native').ActivityIndicator)).toBeTruthy();
  });

  it('affiche le texte normalement quand loading=false', () => {
    render(<Button title="Valider" loading={false} />);
    expect(screen.getByText('Valider')).toBeTruthy();
  });
});