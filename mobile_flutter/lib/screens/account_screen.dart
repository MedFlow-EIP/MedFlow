import 'package:flutter/material.dart';

import '../theme/theme_controller.dart';

// TODO(port): écran provisoire, à remplacer par le portage de Account.
class AccountScreen extends StatelessWidget {
  const AccountScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ColoredBox(
      color: context.colors.background,
      child: Center(child: Text('Account', style: TextStyle(color: context.colors.textPrimary))),
    );
  }
}
