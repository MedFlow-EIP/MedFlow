import 'package:flutter/material.dart';

import '../theme/theme_controller.dart';
import '../widgets/insets.dart';
import '../widgets/ui.dart';

// TODO(port): écran provisoire, à remplacer par le portage de Lesson.
class LessonScreen extends StatelessWidget {
  const LessonScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final insets = ScreenInsets.of(context);
    return Scaffold(
      backgroundColor: context.colors.background,
      body: Padding(
        padding: EdgeInsets.fromLTRB(20, insets.top, 20, insets.bottom),
        child: const ScreenHeader(title: 'Lesson'),
      ),
    );
  }
}
