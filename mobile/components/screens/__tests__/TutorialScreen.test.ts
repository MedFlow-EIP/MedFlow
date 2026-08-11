import { Dimensions } from 'react-native';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

jest.mock('../../../theme/ThemeContext', () => ({
  useTheme: () => ({ colors: require('../../../theme/colors').lightColors, isDark: false }),
}));

import {
  getTabPosition,
  getElementPosition,
  getHighlightRect,
  TAB_BAR_HEIGHT,
  TAB_ORDER,
} from '../TutorialScreen';

const { width, height } = Dimensions.get('window');

describe('getTabPosition — géométrie de la tab bar (5 onglets réels)', () => {
  it('positionne le premier onglet (home-tab) tout à gauche', () => {
    const rect = getTabPosition('home-tab');
    expect(rect.x).toBe(0);
  });

  it('positionne le dernier onglet (account-tab) au bon index (4e sur 5)', () => {
    const rect = getTabPosition('account-tab');
    const expectedTabWidth = width / TAB_ORDER.length;
    expect(rect.x).toBeCloseTo(expectedTabWidth * 4);
  });

  it('chaque onglet fait 1/5 de la largeur de l\'écran, pas 1/2', () => {
    // Régression du bug corrigé en session : le calcul se basait avant
    // sur un ancien design à 2 onglets (50% de largeur chacun), alors
    // que la vraie tab bar en a 5.
    const rect = getTabPosition('home-tab');
    expect(rect.width).toBeCloseTo(width / 5);
  });

  it('utilise la hauteur réelle de la tab bar (70px, pas 60)', () => {
    // Autre régression corrigée en session : le calcul utilisait 60px
    // en dur, alors que AppNavigator.tsx définit bottomNav à 70px.
    const rect = getTabPosition('home-tab');
    expect(rect.height).toBe(70);
    expect(TAB_BAR_HEIGHT).toBe(70);
  });

  it('positionne la tab bar collée en bas de l\'écran', () => {
    const rect = getTabPosition('home-tab');
    expect(rect.y).toBe(height - TAB_BAR_HEIGHT);
  });

  it('les 5 onglets sont dans l\'ordre exact du vrai CustomTabBar', () => {
    expect(TAB_ORDER).toEqual([
      'home-tab',
      'aichat-tab',
      'add-tab',
      'dashboard-tab',
      'account-tab',
    ]);
  });

  it('deux onglets adjacents ne se chevauchent jamais', () => {
    const home = getTabPosition('home-tab');
    const aichat = getTabPosition('aichat-tab');
    expect(home.x + home.width).toBeCloseTo(aichat.x);
  });
});

describe('getElementPosition', () => {
  it('renvoie une position connue pour "paths-section"', () => {
    const rect = getElementPosition('paths-section');
    expect(rect).toEqual({ x: 20, y: 170, width: width - 40, height: 400 });
  });

  it('renvoie un rectangle vide (repli sûr) pour un élément inconnu', () => {
    const rect = getElementPosition('element-qui-n-existe-pas');
    expect(rect).toEqual({ x: 0, y: 0, width: 0, height: 0 });
  });
});

describe('getHighlightRect', () => {
  it('renvoie la position de la tab bar si l\'étape cible un onglet', () => {
    const rect = getHighlightRect({
      id: '1',
      title: 'x',
      description: 'x',
      highlightTab: 'aichat-tab',
    } as any);

    expect(rect).toEqual(getTabPosition('aichat-tab'));
  });

  it('renvoie la position d\'un élément si l\'étape cible un élément', () => {
    const rect = getHighlightRect({
      id: '1',
      title: 'x',
      description: 'x',
      highlightElement: 'paths-section',
    } as any);

    expect(rect).toEqual(getElementPosition('paths-section'));
  });

  it('renvoie null pour une étape sans cible (intro/outro)', () => {
    const rect = getHighlightRect({ id: '1', title: 'x', description: 'x' } as any);
    expect(rect).toBeNull();
  });

  it('priorise highlightTab si les deux sont fournis par erreur', () => {
    const rect = getHighlightRect({
      id: '1',
      title: 'x',
      description: 'x',
      highlightTab: 'home-tab',
      highlightElement: 'paths-section',
    } as any);

    expect(rect).toEqual(getTabPosition('home-tab'));
  });
});