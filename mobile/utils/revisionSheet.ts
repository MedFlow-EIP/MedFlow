import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

// Fiche de révision PDF (F51) : résumé, flashcards et corrigé du quiz d'un
// cours, mis en page pour être imprimée ou partagée.

export type SheetCourse = {
  nom: string;
  summary?: string;
  flashcards?: { question: string; answer: string }[];
  quiz?: { question: string; options?: Record<string, string>; correct?: string; explanation?: string }[];
  tags?: string[];
};

export function escapeHtml(text: unknown): string {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Le résumé est du HTML produit par l'IA : on retire tout ce qui pourrait
 * s'exécuter ou charger une ressource avant de l'insérer dans la fiche.
 */
export function sanitizeSummary(html: string): string {
  let clean = html || '';
  let previous: string;
  // Répété jusqu'à stabilité : un seul passage laisserait « <scr<script>ipt> » redevenir « <script> ».
  do {
    previous = clean;
    clean = clean
      // Blocs entiers (balise + contenu), puis balises isolées restantes.
      .replace(/<(script|style|iframe|object)\b[\s\S]*?<\/\1\s*>/gi, '')
      .replace(/<\/?(script|style|iframe|object|embed|link|meta)\b[^>]*>/gi, '')
      .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
      .replace(/(href|src)\s*=\s*("|')\s*javascript:[^"']*\2/gi, '');
  } while (clean !== previous);
  return clean;
}

export function buildRevisionSheetHtml(course: SheetCourse, date = new Date()): string {
  const flashcards = course.flashcards ?? [];
  const quiz = course.quiz ?? [];
  const tags = (course.tags ?? []).map((t) => `<span class="tag">${escapeHtml(t)}</span>`).join('');

  const cards = flashcards
    .map(
      (c, i) => `
      <tr>
        <td class="num">${i + 1}</td>
        <td class="q">${escapeHtml(c.question)}</td>
        <td>${escapeHtml(c.answer)}</td>
      </tr>`
    )
    .join('');

  const questions = quiz
    .map((q, i) => {
      const options = Object.entries(q.options ?? {})
        .map(
          ([key, value]) =>
            `<li class="${key === q.correct ? 'correct' : ''}">${escapeHtml(value)}${key === q.correct ? ' ✓' : ''}</li>`
        )
        .join('');
      return `
      <div class="question">
        <p class="q">${i + 1}. ${escapeHtml(q.question)}</p>
        <ul>${options}</ul>
        ${q.explanation ? `<p class="expl">${escapeHtml(q.explanation)}</p>` : ''}
      </div>`;
    })
    .join('');

  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<style>
  @page { margin: 18mm 16mm; }
  body { font-family: -apple-system, Roboto, "Segoe UI", Arial, sans-serif; color: #111827; font-size: 12pt; line-height: 1.5; }
  header { border-bottom: 3px solid #2563eb; padding-bottom: 10px; margin-bottom: 18px; }
  h1 { font-size: 22pt; margin: 0 0 6px; }
  .meta { color: #4b5563; font-size: 10pt; }
  .tag { display: inline-block; background: #eff6ff; color: #1d4ed8; border-radius: 999px; padding: 2px 10px; margin-right: 6px; font-size: 9pt; font-weight: 600; }
  h2 { font-size: 15pt; color: #1d4ed8; border-left: 4px solid #2563eb; padding-left: 8px; margin: 26px 0 10px; page-break-after: avoid; }
  .summary h2, .summary h3 { color: #111827; border: none; padding: 0; font-size: 13pt; margin: 14px 0 6px; }
  table { width: 100%; border-collapse: collapse; font-size: 11pt; }
  th, td { border: 1px solid #d1d5db; padding: 7px 9px; vertical-align: top; text-align: left; }
  th { background: #f3f4f6; }
  tr { page-break-inside: avoid; }
  td.num { width: 24px; color: #6b7280; text-align: center; }
  .q { font-weight: 600; }
  .question { page-break-inside: avoid; margin-bottom: 14px; }
  .question ul { margin: 4px 0; padding-left: 20px; }
  .question li.correct { color: #15803d; font-weight: 700; }
  .expl { color: #4b5563; font-size: 10pt; margin: 2px 0 0; }
  footer { margin-top: 28px; color: #9ca3af; font-size: 9pt; text-align: center; }
</style>
</head>
<body>
  <header>
    <h1>${escapeHtml(course.nom)}</h1>
    <div class="meta">Fiche de révision MedFlow · ${escapeHtml(date.toLocaleDateString('fr-FR'))}</div>
    ${tags ? `<div style="margin-top:8px">${tags}</div>` : ''}
  </header>

  ${course.summary ? `<h2>Résumé</h2><div class="summary">${sanitizeSummary(course.summary)}</div>` : ''}

  ${
    flashcards.length
      ? `<h2>Flashcards (${flashcards.length})</h2>
  <table><thead><tr><th></th><th>Question</th><th>Réponse</th></tr></thead><tbody>${cards}</tbody></table>`
      : ''
  }

  ${quiz.length ? `<h2>Quiz corrigé (${quiz.length})</h2>${questions}` : ''}

  <footer>Généré avec MedFlow</footer>
</body>
</html>`;
}

/** Crée le PDF et ouvre la feuille de partage (enregistrer, imprimer, envoyer). */
export async function shareRevisionSheet(course: SheetCourse): Promise<void> {
  const { uri } = await Print.printToFileAsync({ html: buildRevisionSheetHtml(course) });
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Partage indisponible sur cet appareil');
  }
  await Sharing.shareAsync(uri, {
    mimeType: 'application/pdf',
    UTI: 'com.adobe.pdf',
    dialogTitle: `Fiche « ${course.nom} »`,
  });
}
