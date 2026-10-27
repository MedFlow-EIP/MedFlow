/** Message envoyé à l'assistant par « Explique-moi cette carte » (révision). */
export function explainPrompt({
  question,
  correctAnswer,
  chosenAnswer,
  courseName,
}: {
  question: string;
  correctAnswer?: string;
  chosenAnswer?: string;
  courseName?: string;
}): string {
  const lines = [
    'Explique-moi simplement cette question de révision.',
    courseName ? `Cours : ${courseName}` : null,
    `Question : ${question}`,
    correctAnswer ? `Bonne réponse : ${correctAnswer}` : null,
    chosenAnswer && chosenAnswer !== correctAnswer ? `J'avais répondu : ${chosenAnswer}` : null,
    chosenAnswer && chosenAnswer !== correctAnswer
      ? 'Pourquoi la bonne réponse est-elle celle-ci, et pourquoi la mienne est fausse ?'
      : 'Pourquoi est-ce la bonne réponse ? Donne-moi un moyen de la retenir.',
  ];
  // Même limite que la saisie du chat (CHAT_MAX_MESSAGE_CHARS côté serveur).
  return lines.filter(Boolean).join('\n').slice(0, 2000);
}
