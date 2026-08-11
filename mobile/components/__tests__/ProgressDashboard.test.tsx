import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { ProgressDashboard } from '../../components/ProgressDashboard';

jest.mock('../../theme/ThemeContext', () => ({
  useTheme: () => ({ colors: require('../../theme/colors').lightColors, isDark: false }),
}));

describe('ProgressDashboard — pourcentage de complétion', () => {
  it('calcule et arrondit correctement le pourcentage', () => {
    render(<ProgressDashboard totalLessons={3} completedLessons={1} totalXP={0} />);
    // 1/3 = 33.33...% arrondi à 33%
    expect(screen.getByText('33%')).toBeTruthy();
  });

  it('affiche 0% quand totalLessons est 0 (évite une division par zéro)', () => {
    render(<ProgressDashboard totalLessons={0} completedLessons={0} totalXP={0} />);
    expect(screen.getByText('0%')).toBeTruthy();
  });

  it('affiche 100% quand tout est complété', () => {
    render(<ProgressDashboard totalLessons={10} completedLessons={10} totalXP={0} />);
    expect(screen.getByText('100%')).toBeTruthy();
  });

  it('affiche le détail "X leçons complétées sur Y"', () => {
    render(<ProgressDashboard totalLessons={40} completedLessons={12} totalXP={0} />);
    expect(screen.getByText('12 leçons complétées sur 40')).toBeTruthy();
  });
});

describe('ProgressDashboard — carte streak (optionnelle)', () => {
  it('n\'affiche pas la carte streak si currentStreak n\'est pas fourni', () => {
    render(<ProgressDashboard totalLessons={10} completedLessons={5} totalXP={0} />);
    expect(screen.queryByText('Jours de série')).toBeNull();
  });

  it('affiche la carte streak, y compris pour une valeur de 0', () => {
    render(
      <ProgressDashboard totalLessons={10} completedLessons={5} totalXP={0} currentStreak={0} />
    );
    // 0 est un vrai streak (démarré), pas "pas de donnée" — doit s'afficher.
    expect(screen.getByText('Jours de série')).toBeTruthy();
  });

  it('affiche la bonne valeur de streak', () => {
    render(
      <ProgressDashboard totalLessons={10} completedLessons={5} totalXP={0} currentStreak={7} />
    );
    expect(screen.getByText('7')).toBeTruthy();
  });
});

describe('ProgressDashboard — objectif hebdomadaire (optionnel)', () => {
  it('n\'affiche pas la carte objectif hebdo si non fourni', () => {
    render(<ProgressDashboard totalLessons={10} completedLessons={5} totalXP={0} />);
    expect(screen.queryByText('Objectif hebdomadaire')).toBeNull();
  });

  it('n\'affiche pas la carte si weeklyGoal vaut 0', () => {
    render(
      <ProgressDashboard
        totalLessons={10}
        completedLessons={5}
        totalXP={0}
        weeklyGoal={0}
        weeklyProgress={3}
      />
    );
    expect(screen.queryByText('Objectif hebdomadaire')).toBeNull();
  });

  it('affiche la carte et calcule le bon pourcentage quand goal et progress sont fournis', () => {
    render(
      <ProgressDashboard
        totalLessons={10}
        completedLessons={5}
        totalXP={0}
        weeklyGoal={5}
        weeklyProgress={3}
      />
    );

    expect(screen.getByText('Objectif hebdomadaire')).toBeTruthy();
    expect(screen.getByText('60%')).toBeTruthy(); // 3/5 = 60%
    expect(screen.getByText('3 / 5 leçons cette semaine')).toBeTruthy();
  });

  it('accepte que weeklyProgress dépasse weeklyGoal sans planter', () => {
    render(
      <ProgressDashboard
        totalLessons={10}
        completedLessons={5}
        totalXP={0}
        weeklyGoal={5}
        weeklyProgress={8}
      />
    );
    // La barre elle-même (testée séparément dans progress.test.tsx)
    // plafonne visuellement à 100% — ici on vérifie juste que le calcul
    // texte brut ne plante pas et affiche la vraie valeur.
    expect(screen.getByText('160%')).toBeTruthy();
  });
});

describe('ProgressDashboard — XP total', () => {
  it('affiche la valeur totalXP fournie', () => {
    render(<ProgressDashboard totalLessons={10} completedLessons={5} totalXP={420} />);
    expect(screen.getByText('420')).toBeTruthy();
  });
});