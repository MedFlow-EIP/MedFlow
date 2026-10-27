import { stripDiagrams } from './diagrams';

// « Créer des flashcards » n'a de sens que sous une vraie réponse de cours :
// pas sous une question de relance, un refus ou une réponse de deux lignes.

const MIN_LENGTH = 400;

export function worthFlashcards(answer: string): boolean {
  const text = stripDiagrams(answer ?? '').trim();
  if (text.length < MIN_LENGTH) return false;
  if (/^je suis spécialisé/i.test(text)) return false;
  // Réponse qui se termine par une question : l'assistant attend une précision.
  const lastLine = text.split('\n').filter((l) => l.trim()).pop() ?? '';
  return !lastLine.trim().endsWith('?');
}
