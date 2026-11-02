import 'package:flutter/material.dart';

import '../theme/theme_controller.dart';

// TODO(port): écran provisoire, à remplacer par le portage de Dashboard.
class DashboardScreen extends StatelessWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ColoredBox(
      color: context.colors.background,
      child: Center(child: Text('Dashboard', style: TextStyle(color: context.colors.textPrimary))),
    );
  }
}
