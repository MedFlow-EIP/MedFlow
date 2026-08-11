import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { FlashCard } from '../../components/FlashCard';

jest.mock('../../theme/ThemeContext', () => ({
  useTheme: () => ({ colors: require('../../theme/colors').lightColors, isDark: false }),
}));

// Note : question ET réponse sont TOUJOURS toutes les deux présentes dans
// l'arbre React simultanément (le "flip" n'est qu'une transformation
// visuelle rotateY/backfaceVisibility, pas un rendu conditionnel). On ne
// peut donc pas tester "la réponse n'apparaît qu'après le clic" via une
// requête de texte — seuls le contenu affiché et la robustesse du clic
// sont testables à ce niveau.

describe('FlashCard — contenu affiché', () => {
  it('affiche le texte de la question', () => {
    render(<FlashCard question="Combien d'os dans le corps humain ?" answer="206" color="#3b82f6" />);
    expect(screen.getByText("Combien d'os dans le corps humain ?")).toBeTruthy();
  });

  it('affiche le texte de la réponse (présent dans l\'arbre dès le rendu initial)', () => {
    render(<FlashCard question="Q" answer="206 os" color="#3b82f6" />);
    expect(screen.getByText('206 os')).toBeTruthy();
  });

  it('affiche les deux badges "Question" et "Réponse"', () => {
    render(<FlashCard question="Q" answer="A" color="#3b82f6" />);
    expect(screen.getByText('Question')).toBeTruthy();
    expect(screen.getByText('Réponse')).toBeTruthy();
  });
});

describe('FlashCard — interaction', () => {
  it('ne plante pas au premier clic (retourne la carte)', () => {
    render(<FlashCard question="Q" answer="A" color="#3b82f6" />);
    expect(() => fireEvent.press(screen.getByText('Q'))).not.toThrow();
  });

  it('ne plante pas sur plusieurs clics successifs (aller-retour du flip)', () => {
    render(<FlashCard question="Q" answer="A" color="#3b82f6" />);
    const card = screen.getByText('Q');

    expect(() => {
      fireEvent.press(card);
      fireEvent.press(card);
      fireEvent.press(card);
    }).not.toThrow();
  });
});