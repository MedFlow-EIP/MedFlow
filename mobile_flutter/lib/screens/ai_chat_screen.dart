import 'package:flutter/material.dart';

import '../theme/theme_controller.dart';

// TODO(port): écran provisoire, à remplacer par le portage de AIChat.
class AIChatScreen extends StatelessWidget {
  const AIChatScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ColoredBox(
      color: context.colors.background,
      child: Center(child: Text('AIChat', style: TextStyle(color: context.colors.textPrimary))),
    );
  }
}
