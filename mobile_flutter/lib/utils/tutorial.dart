import 'package:flutter/foundation.dart';

/// Tutoriel de bienvenue affiché par-dessus l'app (équivalent de TutorialContext).
final ValueNotifier<bool> tutorialVisible = ValueNotifier(false);

void showTutorial() => tutorialVisible.value = true;

void hideTutorial() => tutorialVisible.value = false;
