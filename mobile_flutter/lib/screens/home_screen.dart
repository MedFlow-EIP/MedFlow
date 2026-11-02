import 'package:flutter/material.dart';

import '../theme/theme_controller.dart';

// TODO(port): écran provisoire, à remplacer par le portage de Home.
class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ColoredBox(
      color: context.colors.background,
      child: Center(child: Text('Home', style: TextStyle(color: context.colors.textPrimary))),
    );
  }
}
