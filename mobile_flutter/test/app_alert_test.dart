import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:medflow/navigation/nav.dart';
import 'package:medflow/theme/theme_controller.dart';
import 'package:medflow/utils/app_alert.dart';
import 'package:provider/provider.dart';

Widget _app() => ChangeNotifierProvider(
      create: (_) => ThemeController(),
      child: MaterialApp(navigatorKey: navigatorKey, home: const Scaffold()),
    );

void main() {
  testWidgets('affiche le dialogue et appelle l’action choisie', (tester) async {
    await tester.pumpWidget(_app());
    var quit = false;
    appAlert('Quitter la leçon ?', 'Ta progression ne sera pas enregistrée.', [
      const AlertButton('Continuer', style: AlertStyle.cancel),
      AlertButton('Quitter', style: AlertStyle.destructive, onPress: () => quit = true),
    ]);
    await tester.pumpAndSettle();

    expect(tester.takeException(), isNull);
    expect(find.text('Quitter la leçon ?'), findsOneWidget);
    expect(find.text('Ta progression ne sera pas enregistrée.'), findsOneWidget);

    await tester.tap(find.text('Quitter'));
    await tester.pumpAndSettle();
    expect(quit, isTrue);
    expect(find.text('Quitter la leçon ?'), findsNothing);
  });

  testWidgets('affiche les dialogues l’un après l’autre', (tester) async {
    await tester.pumpWidget(_app());
    appAlert('Premier');
    appAlert('Second');
    await tester.pumpAndSettle();
    expect(find.text('Premier'), findsOneWidget);
    expect(find.text('Second'), findsNothing);

    await tester.tap(find.text('OK'));
    await tester.pumpAndSettle();
    expect(find.text('Second'), findsOneWidget);
  });
}
