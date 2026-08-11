import React from 'react';
import { Text } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
  CardContent,
  CardFooter,
} from '../card';

jest.mock('../../../theme/ThemeContext', () => ({
  useTheme: () => ({ colors: require('../../../theme/colors').lightColors, isDark: false }),
}));

describe('Card', () => {
  it('affiche ses enfants', () => {
    render(
      <Card>
        <Text>Contenu</Text>
      </Card>
    );
    expect(screen.getByText('Contenu')).toBeTruthy();
  });

  it('fusionne un style personnalisé avec le style de base (ne le remplace pas)', () => {
    const { toJSON } = render(<Card style={{ marginTop: 20 }} testID="card" />);
    const tree = toJSON();
    // Le style est un tableau [styles.card, style] — le style personnalisé
    // doit être présent EN PLUS du style de base, pas à sa place.
    expect(Array.isArray(tree.props.style)).toBe(true);
    expect(tree.props.style).toContainEqual({ marginTop: 20 });
  });
});

describe('Sous-composants Card', () => {
  // Tests de fumée groupés : chacun de ces sous-composants est presque
  // identique (thème + style + enfants) — le vrai risque est une faute
  // de frappe qui casse l'un d'eux silencieusement, pas une logique
  // complexe à couvrir en détail individuellement.
  it('CardHeader affiche ses enfants', () => {
    render(<CardHeader><Text>En-tête</Text></CardHeader>);
    expect(screen.getByText('En-tête')).toBeTruthy();
  });

  it('CardTitle affiche son texte', () => {
    render(<CardTitle>Titre</CardTitle>);
    expect(screen.getByText('Titre')).toBeTruthy();
  });

  it('CardDescription affiche son texte', () => {
    render(<CardDescription>Description</CardDescription>);
    expect(screen.getByText('Description')).toBeTruthy();
  });

  it('CardAction affiche ses enfants', () => {
    render(<CardAction><Text>Action</Text></CardAction>);
    expect(screen.getByText('Action')).toBeTruthy();
  });

  it('CardContent affiche ses enfants', () => {
    render(<CardContent><Text>Contenu principal</Text></CardContent>);
    expect(screen.getByText('Contenu principal')).toBeTruthy();
  });

  it('CardFooter affiche ses enfants', () => {
    render(<CardFooter><Text>Pied de carte</Text></CardFooter>);
    expect(screen.getByText('Pied de carte')).toBeTruthy();
  });
});