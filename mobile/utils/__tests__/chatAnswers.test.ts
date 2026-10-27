import { worthFlashcards } from '../chatAnswers';

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
