import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { TutorialScreen, TUTORIAL_SLIDES } from '../TutorialScreen';
import { markTutorialCompleted } from '../../../utils/firstTime';
import { logTutorialSkipped, logTutorialCompleted } from '../../../utils/tutorialAnalytics';

jest.mock('../../../theme/ThemeContext', () => ({
  useTheme: () => ({ colors: require('../../../theme/colors').lightColors, isDark: false }),
}));

jest.mock('../../../utils/firstTime', () => ({
  markTutorialCompleted: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../../utils/tutorialAnalytics', () => ({
  logTutorialStarted: jest.fn(() => 1),
  logStepViewed: jest.fn(),
  logTutorialSkipped: jest.fn(),
  logTutorialCompleted: jest.fn(),
}));

function setup() {
  const onComplete = jest.fn();
  const navigation = { isReady: () => true, navigate: jest.fn() };
  render(<TutorialScreen visible onComplete={onComplete} navigation={navigation} />);
  return { onComplete, navigation };
}

function goToLastSlide() {
  fireEvent.press(screen.getByText('C’est parti'));
  for (let i = 1; i < TUTORIAL_SLIDES.length - 1; i++) {
    fireEvent.press(screen.getByText('Suivant'));
  }
}

beforeEach(() => jest.clearAllMocks());

describe('TutorialScreen', () => {
  it('ne rend rien quand il est masqué', () => {
    render(<TutorialScreen visible={false} onComplete={jest.fn()} navigation={{}} />);
    expect(screen.queryByText('Bienvenue sur MedFlow')).toBeNull();
  });

  it('commence par la carte de bienvenue', () => {
    setup();
    expect(screen.getByText('Bienvenue sur MedFlow')).toBeTruthy();
    expect(screen.getByText(`1/${TUTORIAL_SLIDES.length}`)).toBeTruthy();
  });

  it('tutoie et garde les accents dans tous les textes', () => {
    for (const slide of TUTORIAL_SLIDES) {
      expect(slide.text).not.toMatch(/\bvous\b|\bvotre\b/i);
    }
    expect(TUTORIAL_SLIDES.some((s) => /é|è|à/.test(s.text))).toBe(true);
  });

  it('« Passer » ferme le tutoriel et le marque comme vu', async () => {
    const { onComplete } = setup();
    fireEvent.press(screen.getByLabelText('Passer le tutoriel'));
    await waitFor(() => expect(onComplete).toHaveBeenCalled());
    expect(markTutorialCompleted).toHaveBeenCalled();
    expect(logTutorialSkipped).toHaveBeenCalled();
  });

  it('avance carte par carte jusqu’à la dernière', () => {
    setup();
    goToLastSlide();
    expect(screen.getByText(`${TUTORIAL_SLIDES.length}/${TUTORIAL_SLIDES.length}`)).toBeTruthy();
    expect(screen.getByText('Importer mon premier cours')).toBeTruthy();
    expect(screen.queryByLabelText('Passer le tutoriel')).toBeNull();
  });

  it('le bouton retour revient à la carte précédente', () => {
    setup();
    fireEvent.press(screen.getByText('C’est parti'));
    fireEvent.press(screen.getByLabelText('Étape précédente'));
    expect(screen.getByText(`1/${TUTORIAL_SLIDES.length}`)).toBeTruthy();
  });

  it('« Importer mon premier cours » termine et ouvre l’import', async () => {
    const { onComplete, navigation } = setup();
    goToLastSlide();
    fireEvent.press(screen.getByText('Importer mon premier cours'));
    await waitFor(() => expect(navigation.navigate).toHaveBeenCalledWith('UploadCourse'));
    expect(onComplete).toHaveBeenCalled();
    expect(logTutorialCompleted).toHaveBeenCalled();
  });

  it('« Découvrir l’app d’abord » ramène à l’accueil', async () => {
    const { navigation } = setup();
    goToLastSlide();
    fireEvent.press(screen.getByText('Découvrir l’app d’abord'));
    await waitFor(() =>
      expect(navigation.navigate).toHaveBeenCalledWith('MainTabs', { screen: 'Home' })
    );
  });
});
