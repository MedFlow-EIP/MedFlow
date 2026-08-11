import React from 'react';
import { StyleSheet } from 'react-native';
import { render } from '@testing-library/react-native';
import { ProgressBar } from '../progress';
import { lightColors } from '../../../theme/colors';

jest.mock('../../../theme/ThemeContext', () => ({
  useTheme: () => ({ colors: require('../../../theme/colors').lightColors, isDark: false }),
}));

/** Récupère le style à plat de la View "fill" (2e View du composant). */
function getFillStyle(toJSON: () => any) {
  const tree = toJSON();
  const fillNode = tree.children[0];
  return StyleSheet.flatten(fillNode.props.style);
}

describe('ProgressBar', () => {
  it('affiche la largeur exacte pour une valeur normale', () => {
    const { toJSON } = render(<ProgressBar progress={42} />);
    expect(getFillStyle(toJSON).width).toBe('42%');
  });

  it('plafonne à 100% une valeur supérieure à 100', () => {
    const { toJSON } = render(<ProgressBar progress={150} />);
    expect(getFillStyle(toJSON).width).toBe('100%');
  });

  it('plancher à 0% une valeur négative', () => {
    const { toJSON } = render(<ProgressBar progress={-20} />);
    expect(getFillStyle(toJSON).width).toBe('0%');
  });

  it('affiche 0% pour une progression de 0', () => {
    const { toJSON } = render(<ProgressBar progress={0} />);
    expect(getFillStyle(toJSON).width).toBe('0%');
  });

  it('affiche 100% pour une progression de 100 pile', () => {
    const { toJSON } = render(<ProgressBar progress={100} />);
    expect(getFillStyle(toJSON).width).toBe('100%');
  });

  it('utilise la couleur primaire du thème par défaut', () => {
    const { toJSON } = render(<ProgressBar progress={50} />);
    expect(getFillStyle(toJSON).backgroundColor).toBe(lightColors.primary);
  });

  it('utilise la couleur personnalisée quand elle est fournie', () => {
    const { toJSON } = render(<ProgressBar progress={50} color="#ff0000" />);
    expect(getFillStyle(toJSON).backgroundColor).toBe('#ff0000');
  });

  it('utilise la hauteur par défaut (8) si non précisée', () => {
    const { toJSON } = render(<ProgressBar progress={50} />);
    const tree = toJSON();
    expect(StyleSheet.flatten(tree.props.style).height).toBe(8);
  });

  it('utilise la hauteur personnalisée quand elle est fournie', () => {
    const { toJSON } = render(<ProgressBar progress={50} height={16} />);
    const tree = toJSON();
    expect(StyleSheet.flatten(tree.props.style).height).toBe(16);
  });
});