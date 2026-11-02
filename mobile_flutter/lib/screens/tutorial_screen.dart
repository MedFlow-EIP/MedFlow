import 'package:flutter/material.dart';

// TODO(port): tutoriel de bienvenue (TutorialScreen.tsx), affiché par-dessus l'app
// quand `tutorialVisible` (utils/tutorial.dart) est vrai.
class TutorialOverlay extends StatelessWidget {
  const TutorialOverlay({super.key});

  @override
  Widget build(BuildContext context) => const SizedBox.shrink();
}
