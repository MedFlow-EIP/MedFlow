import 'dart:async';

import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/material.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import 'app.dart';
import 'config.dart';
import 'navigation/nav.dart';
import 'services/notifications.dart';
import 'theme/theme_controller.dart';
import 'utils/push_notifications.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  Intl.defaultLocale = 'fr_FR';
  await initializeDateFormatting('fr_FR');

  final theme = ThemeController();
  // Évite un flash clair→sombre au démarrage.
  await theme.load();

  try {
    await Firebase.initializeApp(options: firebaseOptions);
  } catch (e) {
    runApp(_ConfigError(error: '$e'));
    return;
  }

  // Toucher une notification (locale ou push) ouvre l'écran concerné (cours prêt, défi, amis).
  void openTarget(Map<String, dynamic> data) {
    final target = notificationTarget(data);
    if (target != null) Nav.navigate(target.screen, target.params);
  }

  Notifs.onTap = openTarget;
  unawaited(Notifs.init());
  unawaited(initPushHandlers(openTarget));

  runApp(ChangeNotifierProvider.value(value: theme, child: const MedFlowApp()));
}

/// Lancement sans configuration (env.json absent) : message clair plutôt qu'un écran noir.
class _ConfigError extends StatelessWidget {
  final String error;
  const _ConfigError({required this.error});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      home: Scaffold(
        body: Padding(
          padding: const EdgeInsets.all(24),
          child: Center(
            child: Text(
              'Configuration Firebase manquante.\n\n'
              'Lance l’app avec : flutter run --dart-define-from-file=env.json\n\n$error',
              textAlign: TextAlign.center,
            ),
          ),
        ),
      ),
    );
  }
}
