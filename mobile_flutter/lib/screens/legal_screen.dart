import 'package:flutter/material.dart';
import 'package:ionicons/ionicons.dart';

import '../navigation/nav.dart';
import '../theme/theme_controller.dart';
import '../widgets/insets.dart';
import '../widgets/ui.dart';

// Copie de components/screens/LegalScreen.tsx.

class _Section {
  final String title;
  final IconData icon;
  final List<String> lines;
  const _Section(this.title, this.icon, this.lines);
}

// Ce que l'IA fait (et ne fait pas), et ce que MedFlow garde de l'étudiant.
// Accessible avant l'inscription et depuis le compte.
const _sections = [
  _Section('Avertissement médical', Ionicons.medkit_outline, [
    'MedFlow est un outil de révision. Les résumés, cartes, questions, cas cliniques et réponses du chat sont générés par une intelligence artificielle à partir de tes cours : ils peuvent contenir des erreurs.',
    'Vérifie toujours avec ton cours et tes enseignants. MedFlow ne donne pas d’avis médical et ne doit pas servir à soigner ou conseiller un patient.',
    'Tu repères une erreur ? Utilise « Signaler une erreur » : on s’en sert pour améliorer le contenu.',
  ]),
  _Section('Ce que MedFlow garde', Ionicons.folder_open_outline, [
    'Ton compte : email, nom affiché et photo de profil (connexion gérée par Firebase, de Google).',
    'Tes cours : les documents importés et les révisions générées.',
    'Ta progression : réponses, série, XP, examens, amis et défis.',
    'Tes conversations avec l’assistant.',
    'Des données d’usage (écrans ouverts, étapes comme un import ou une révision), analysées sans ton nom pour améliorer l’app.',
    'Ton jeton de notification, si tu acceptes les notifications.',
  ]),
  _Section('Traitement par l’IA', Ionicons.sparkles_outline, [
    'Le texte de tes cours, tes questions et tes pièces jointes sont envoyés à Google Vertex AI (Gemini) pour générer tes révisions et les réponses du chat.',
  ]),
  _Section('Tes droits', Ionicons.shield_checkmark_outline, [
    'Paramètres > Exporter mes données : tu récupères toutes tes données.',
    'Paramètres > Supprimer mon compte : ton compte et toutes tes données sont effacés.',
    'Une question ? Écris-nous à medflow.app.contact@gmail.com.',
  ]),
];

class LegalScreen extends StatelessWidget {
  const LegalScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final insets = ScreenInsets.of(context);
    final children = <Widget>[
      Row(
        children: [
          CircleIconButton.back(Nav.goBack),
          const SizedBox(width: 12),
          Expanded(
            child: Semantics(
              header: true,
              child: Text('Confidentialité et avertissement',
                  style: TextStyle(fontSize: 22, fontWeight: FontWeight.w700, color: c.textPrimary)),
            ),
          ),
        ],
      ),
      for (final section in _sections)
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: c.surface,
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: c.border),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  Icon(section.icon, size: 20, color: c.primaryDark),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Semantics(
                      header: true,
                      child: Text(section.title,
                          style: TextStyle(fontSize: 17, fontWeight: FontWeight.w600, color: c.textPrimary)),
                    ),
                  ),
                ],
              ),
              for (final line in section.lines) ...[
                const SizedBox(height: 10),
                Text(line, style: TextStyle(fontSize: 15, height: 22 / 15, color: c.textPrimary)),
              ],
            ],
          ),
        ),
      Text('MedFlow est un projet étudiant de l’EIP Epitech.',
          textAlign: TextAlign.center, style: TextStyle(fontSize: 13, color: c.textSecondary)),
    ];

    return Scaffold(
      backgroundColor: c.background,
      body: SingleChildScrollView(
        padding: EdgeInsets.fromLTRB(20, insets.top, 20, insets.bottom + 24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            for (var i = 0; i < children.length; i++) ...[
              if (i > 0) const SizedBox(height: 16),
              children[i],
            ],
          ],
        ),
      ),
    );
  }
}
