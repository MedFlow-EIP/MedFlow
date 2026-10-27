import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { PathCard } from '../../components/PathCard';

jest.mock('../../theme/ThemeContext', () => ({
  useTheme: () => ({ colors: require('../../theme/colors').lightColors, isDark: false }),
}));

const baseProps = {
  id: 'anatomy',
  title: 'Anatomie',
  description: 'Système squelettique',
  totalLessons: 10,
  completedLessons: 3,
  isLocked: false,
  color: '#3b82f6',
  emoji: '🦴',
  onPress: jest.fn(),
};

describe('PathCard — clamp de la progression', () => {
  it('affiche le pourcentage normal tel quel', () => {
    render(<PathCard {...baseProps} progress={42} />);
    expect(screen.getByText('42 %')).toBeTruthy();
  });

  it('plafonne à 100% une valeur supérieure à 100', () => {
    render(<PathCard {...baseProps} progress={150} />);
    expect(screen.getByText('100 %')).toBeTruthy();
  });

  it('plancher à 0% une valeur négative', () => {
    render(<PathCard {...baseProps} progress={-10} />);
    expect(screen.getByText('0 %')).toBeTruthy();
  });
});

describe('PathCard — carte héros (parcours en cours)', () => {
  it('affiche "Commencer le parcours" à 0% de progression', () => {
    render(<PathCard {...baseProps} progress={0} isHero />);
    expect(screen.getByText('Commencer le parcours')).toBeTruthy();
  });

  it('affiche "Continuer la leçon" pour une progression entamée', () => {
    render(<PathCard {...baseProps} progress={30} isHero />);
    expect(screen.getByText('Continuer la leçon')).toBeTruthy();
  });

  it('n\'affiche le bouton que sur la carte héros', () => {
    render(<PathCard {...baseProps} progress={30} />);
    expect(screen.queryByText('Continuer la leçon')).toBeNull();
  });

  it('affiche la prochaine leçon sur la carte héros', () => {
    render(<PathCard {...baseProps} progress={30} isHero nextLessonTitle="Os du crâne" />);
    expect(screen.getByText('Os du crâne')).toBeTruthy();
  });

  it('affiche "Terminé" à 100% au lieu de "Continuer"', () => {
    render(<PathCard {...baseProps} progress={100} isHero />);
    expect(screen.getByText('Terminé')).toBeTruthy();
    expect(screen.queryByText('Continuer la leçon')).toBeNull();
  });

  it('affiche le compte de leçons "X/Y leçons"', () => {
    render(<PathCard {...baseProps} progress={30} completedLessons={3} totalLessons={10} />);
    expect(screen.getByText('3/10 leçons')).toBeTruthy();
  });
});

describe('PathCard — interaction', () => {
  it('appelle onPress au clic quand non verrouillé', () => {
    const onPress = jest.fn();
    render(<PathCard {...baseProps} progress={30} onPress={onPress} isLocked={false} />);

    fireEvent.press(screen.getByText('Anatomie'));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('n\'appelle pas onPress quand verrouillé (disabled)', () => {
    const onPress = jest.fn();
    render(<PathCard {...baseProps} progress={0} onPress={onPress} isLocked={true} />);

    fireEvent.press(screen.getByText('Anatomie'));

    expect(onPress).not.toHaveBeenCalled();
  });

  it('n\'affiche pas de bouton "Commencer/Continuer" quand verrouillé', () => {
    render(<PathCard {...baseProps} progress={0} isLocked={true} isHero />);
    expect(screen.queryByText('Commencer le parcours')).toBeNull();
  });

  it('affiche la condition de déblocage quand verrouillé', () => {
    render(
      <PathCard
        {...baseProps}
        progress={0}
        completedLessons={0}
        isLocked={true}
        unlockHint="Termine Anatomie pour débloquer"
      />
    );
    expect(screen.getByText('Termine Anatomie pour débloquer · 0/10 leçons')).toBeTruthy();
  });
});