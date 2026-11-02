/// Message envoyé à l'assistant par « Explique-moi cette carte » (révision).
String explainPrompt({
  required String question,
  String? correctAnswer,
  String? chosenAnswer,
  String? courseName,
}) {
  final chosenDiffers = chosenAnswer != null && chosenAnswer.isNotEmpty && chosenAnswer != correctAnswer;
  final lines = [
    'Explique-moi simplement cette question de révision.',
    if (courseName != null && courseName.isNotEmpty) 'Cours : $courseName',
    'Question : $question',
    if (correctAnswer != null && correctAnswer.isNotEmpty) 'Bonne réponse : $correctAnswer',
    if (chosenDiffers) "J'avais répondu : $chosenAnswer",
    chosenDiffers
        ? 'Pourquoi la bonne réponse est-elle celle-ci, et pourquoi la mienne est fausse ?'
        : 'Pourquoi est-ce la bonne réponse ? Donne-moi un moyen de la retenir.',
  ];
  // Même limite que la saisie du chat (CHAT_MAX_MESSAGE_CHARS côté serveur).
  final text = lines.join('\n');
  return text.length > 2000 ? text.substring(0, 2000) : text;
}
