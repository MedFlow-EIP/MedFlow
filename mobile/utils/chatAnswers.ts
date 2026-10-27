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

const MIN_COLUMN_WIDTH = 130;

/**
 * Largeur d'une colonne de tableau Markdown dans une bulle du chat : la bulle
 * partagée entre les colonnes, sans descendre sous 130 px (au-delà, le
 * tableau défile). `parents` = les nœuds au-dessus de la cellule.
 */
export function tableColumnWidth(parents: { type: string; children?: any[] }[], bubbleWidth: number): number {
  const table = parents.find((p) => p.type === 'table');
  const firstRow = table?.children?.[0]?.children?.[0];
  const columns = Math.max(1, firstRow?.children?.length ?? 1);
  return Math.max(MIN_COLUMN_WIDTH, Math.floor(bubbleWidth / columns));
}
