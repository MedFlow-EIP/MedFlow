import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { BadgeUnlockModal, UnlockedBadge } from '../../components/BadgeUnlockModal';

jest.mock('../../theme/ThemeContext', () => ({
  useTheme: () => ({ colors: require('../../theme/colors').lightColors, isDark: false }),
}));

const badgeA: UnlockedBadge = {
  id: 'first_lesson',
  title: 'Premiers pas',
  description: 'Terminer une leçon',
  icon: 'school',
  color: '#3b82f6',
};

const badgeB: UnlockedBadge = {
  id: 'streak_7',
  title: 'Semaine parfaite',
  description: '7 jours de suite',
  icon: 'flame',
  color: '#f97316',
};

describe('BadgeUnlockModal', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('ne rend rien si la liste de badges est vide', () => {
    const { toJSON } = render(<BadgeUnlockModal badges={[]} onDismiss={jest.fn()} />);
    expect(toJSON()).toBeNull();
  });

  it('affiche le titre et la description du badge', () => {
    render(<BadgeUnlockModal badges={[badgeA]} onDismiss={jest.fn()} />);

    expect(screen.getByText('Premiers pas')).toBeTruthy();
    expect(screen.getByText('Terminer une leçon')).toBeTruthy();
  });

  it('n\'affiche pas de compteur pour un seul badge', () => {
    render(<BadgeUnlockModal badges={[badgeA]} onDismiss={jest.fn()} />);
    expect(screen.queryByText('1 / 1')).toBeNull();
  });

  it('affiche un compteur "1 / 2" pour plusieurs badges', () => {
    render(<BadgeUnlockModal badges={[badgeA, badgeB]} onDismiss={jest.fn()} />);
    expect(screen.getByText('1 / 2')).toBeTruthy();
  });

  it('le bouton dit "Super !" quand il n\'y a qu\'un seul badge', () => {
    render(<BadgeUnlockModal badges={[badgeA]} onDismiss={jest.fn()} />);
    expect(screen.getByText('Super !')).toBeTruthy();
  });

  it('le bouton dit "Suivant" quand il reste des badges à voir', () => {
    render(<BadgeUnlockModal badges={[badgeA, badgeB]} onDismiss={jest.fn()} />);
    expect(screen.getByText('Suivant')).toBeTruthy();
  });

  it('appelle onDismiss directement au clic sur "Super !" pour un seul badge', () => {
    const onDismiss = jest.fn();
    render(<BadgeUnlockModal badges={[badgeA]} onDismiss={onDismiss} />);

    fireEvent.press(screen.getByText('Super !'));

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('passe au badge suivant au clic sur "Suivant", sans appeler onDismiss', () => {
    const onDismiss = jest.fn();
    render(<BadgeUnlockModal badges={[badgeA, badgeB]} onDismiss={onDismiss} />);

    fireEvent.press(screen.getByText('Suivant'));

    expect(screen.getByText('Semaine parfaite')).toBeTruthy();
    expect(screen.getByText('2 / 2')).toBeTruthy();
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('appelle onDismiss seulement après avoir vu tous les badges un par un', () => {
    const onDismiss = jest.fn();
    render(<BadgeUnlockModal badges={[badgeA, badgeB]} onDismiss={onDismiss} />);

    fireEvent.press(screen.getByText('Suivant')); // affiche le badge B
    fireEvent.press(screen.getByText('Super !')); // dernier badge, ferme

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('le bouton devient "Super !" une fois sur le dernier badge d\'une série', () => {
    render(<BadgeUnlockModal badges={[badgeA, badgeB]} onDismiss={jest.fn()} />);

    fireEvent.press(screen.getByText('Suivant'));

    expect(screen.getByText('Super !')).toBeTruthy();
    expect(screen.queryByText('Suivant')).toBeNull();
  });
});