import 'package:flutter/material.dart';
import 'package:ionicons/ionicons.dart';

import '../theme/theme_controller.dart';
import 'insets.dart';
import 'ui.dart';

/// Feuille du bas aux couleurs de l'app (Modal transparent + poignée de
/// l'app RN) : se ferme en glissant vers le bas ou en touchant le fond.
///
/// ```dart
/// final result = await showAppSheet<String>(context, title: 'Ajouter', builder: (ctx) => ...);
/// ```
Future<T?> showAppSheet<T>(
  BuildContext context, {
  String? title,
  required WidgetBuilder builder,
  bool scrollable = true,
  bool showClose = true,
  bool isDismissible = true,
}) {
  final colors = context.readColors;
  return showModalBottomSheet<T>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    isDismissible: isDismissible,
    enableDrag: isDismissible,
    backgroundColor: colors.surface,
    barrierColor: Colors.black54,
    shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(28))),
    builder: (ctx) => AppSheetBody(title: title, showClose: showClose, scrollable: scrollable, child: builder(ctx)),
  );
}

/// Contenu d'une feuille : poignée, titre + bouton fermer, puis le contenu.
class AppSheetBody extends StatelessWidget {
  final String? title;
  final bool showClose;
  final bool scrollable;
  final Widget child;
  const AppSheetBody({super.key, this.title, this.showClose = true, this.scrollable = true, required this.child});

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final insets = ScreenInsets.of(context);
    final keyboard = MediaQuery.viewInsetsOf(context).bottom;
    final body = Padding(
      padding: EdgeInsets.fromLTRB(20, 0, 20, insets.bottom + 22),
      child: child,
    );
    return Padding(
      padding: EdgeInsets.only(bottom: keyboard),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const SizedBox(height: 10),
          Center(
            child: Container(
              width: 40,
              height: 5,
              decoration: BoxDecoration(color: c.border, borderRadius: BorderRadius.circular(3)),
            ),
          ),
          if (title != null || showClose)
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 18, 20, 18),
              child: Row(
                children: [
                  Expanded(
                    child: Semantics(
                      header: true,
                      child: Text(title ?? '',
                          style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700, color: c.textPrimary)),
                    ),
                  ),
                  if (showClose)
                    CircleIconButton(
                      icon: Ionicons.close,
                      label: 'Fermer',
                      size: 40,
                      bordered: false,
                      background: c.surfaceAlt,
                      iconColor: c.textSecondary,
                      onPressed: () => Navigator.of(context).maybePop(),
                    ),
                ],
              ),
            )
          else
            const SizedBox(height: 18),
          if (scrollable) Flexible(child: SingleChildScrollView(child: body)) else body,
        ],
      ),
    );
  }
}
