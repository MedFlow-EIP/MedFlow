import { tableColumnWidth, worthFlashcards } from '../chatAnswers';

const table = (columns: number) => ({
  type: 'table',
  children: [{ type: 'thead', children: [{ type: 'tr', children: Array.from({ length: columns }, () => ({ type: 'th' })) }] }],
});

describe('largeur des colonnes de tableau', () => {
  it('partage la bulle entre peu de colonnes', () => {
    expect(tableColumnWidth([{ type: 'tr' }, table(2)], 300)).toBe(150);
  });

  it('garde 130 px minimum quand il y a beaucoup de colonnes (le tableau défile)', () => {
    expect(tableColumnWidth([table(5)], 300)).toBe(130);
  });

  it('ne plante pas sans tableau parent', () => {
    expect(tableColumnWidth([], 300)).toBe(300);
  });
});

const COURSE = 'La systole est la phase de contraction du cœur. '.repeat(12);

describe('bouton « Créer des flashcards »', () => {
  it('apparaît sous une vraie réponse de cours', () => {
    expect(worthFlashcards(COURSE)).toBe(true);
  });

  it('pas sous une réponse courte', () => {
    expect(worthFlashcards('Bonjour ! Comment puis-je t’aider aujourd’hui en médecine ?')).toBe(false);
  });

  it('pas quand l’assistant demande une précision', () => {
    expect(worthFlashcards(`${COURSE}\n\nDe quel cours parles-tu exactement ?`)).toBe(false);
  });

  it('pas sous un refus hors sujet', () => {
    expect(worthFlashcards(`Je suis spécialisé uniquement en médecine. ${COURSE}`)).toBe(false);
  });

  it('ignore les schémas dans la longueur', () => {
    const svg = '```svg\n<svg>' + 'x'.repeat(800) + '</svg>\n```';
    expect(worthFlashcards(`Voici le schéma :\n${svg}`)).toBe(false);
  });
});
