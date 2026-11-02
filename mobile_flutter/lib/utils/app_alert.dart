import 'dart:async';

import 'package:flutter/material.dart';
import 'package:ionicons/ionicons.dart';

import '../navigation/nav.dart';
import '../theme/theme_controller.dart';

// Remplaçant de Alert.alert (copie de utils/appAlert.ts + AppDialogHost.tsx) :
// dialogue aux couleurs de l'app, un à la fois.

enum AlertStyle { normal, cancel, destructive }

class AlertButton {
  final String text;
  final AlertStyle style;
  final VoidCallback? onPress;
  const AlertButton(this.text, {this.style = AlertStyle.normal, this.onPress});
}

Future<void> _queue = Future.value();

/// Affiche un dialogue. Les dialogues demandés pendant qu'un autre est ouvert
/// s'affichent ensuite, dans l'ordre.
void appAlert(String title, [String? message, List<AlertButton>? buttons]) {
  final list = (buttons == null || buttons.isEmpty) ? const [AlertButton('OK')] : buttons;
  _queue = _queue.then((_) => _show(title, message, list)).catchError((_) {});
}

Future<void> _show(String title, String? message, List<AlertButton> buttons) async {
  final context = navigatorKey.currentContext;
  if (context == null) return;
  final cancel = buttons.where((b) => b.style == AlertStyle.cancel).firstOrNull;
  final pressed = await showGeneralDialog<AlertButton>(
    context: context,
    barrierDismissible: cancel != null,
    barrierLabel: 'Fermer',
    barrierColor: Colors.black54,
    transitionDuration: const Duration(milliseconds: 180),
    pageBuilder: (ctx, _, __) => _AppDialog(title: title, message: message, buttons: buttons),
    transitionBuilder: (ctx, anim, _, child) => FadeTransition(opacity: anim, child: child),
  );
  final chosen = pressed ?? cancel;
  // Après la fermeture, pour qu'un éventuel nouveau dialogue s'affiche proprement.
  if (chosen?.onPress != null) scheduleMicrotask(chosen!.onPress!);
}

/// Dialogue de confirmation : renvoie true si l'action est choisie.
Future<bool> appConfirm(String title, String? message,
    {required String confirm, String cancel = 'Annuler', bool destructive = false}) {
  final completer = Completer<bool>();
  appAlert(title, message, [
    AlertButton(cancel, style: AlertStyle.cancel, onPress: () => completer.complete(false)),
    AlertButton(confirm,
        style: destructive ? AlertStyle.destructive : AlertStyle.normal, onPress: () => completer.complete(true)),
  ]);
  return completer.future;
}

class _AppDialog extends StatelessWidget {
  final String title;
  final String? message;
  final List<AlertButton> buttons;
  const _AppDialog({required this.title, this.message, required this.buttons});

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final destructive = buttons.any((b) => b.style == AlertStyle.destructive);
    // Ordre : annuler à gauche, action principale à droite.
    final ordered = [...buttons]..sort((a, b) => a.style == AlertStyle.cancel
        ? -1
        : b.style == AlertStyle.cancel
            ? 1
            : 0);
    final stacked = ordered.length > 2;

    Widget buttonFor(AlertButton b) {
      final isCancel = b.style == AlertStyle.cancel;
      final isDestructive = b.style == AlertStyle.destructive;
      return SizedBox(
        height: 50,
        child: TextButton(
          style: TextButton.styleFrom(
            backgroundColor: isCancel ? colors.surfaceAlt : (isDestructive ? colors.danger : colors.action),
            foregroundColor: isCancel ? colors.textPrimary : (isDestructive ? Colors.white : colors.onAction),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
            padding: const EdgeInsets.symmetric(horizontal: 12),
          ),
          onPressed: () => Navigator.of(context).pop(b),
          child: Text(b.text,
              textAlign: TextAlign.center, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
        ),
      );
    }

    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 360),
          child: Material(
            color: colors.surface,
            borderRadius: BorderRadius.circular(24),
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Semantics(
                scopesRoute: true,
                namesRoute: true,
                label: title,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      width: 56,
                      height: 56,
                      margin: const EdgeInsets.only(bottom: 14),
                      decoration: BoxDecoration(
                        color: destructive ? colors.tintDanger : colors.tintPrimary,
                        shape: BoxShape.circle,
                      ),
                      child: Icon(
                        destructive ? Ionicons.alert_circle_outline : Ionicons.information_circle_outline,
                        size: 28,
                        color: destructive ? colors.dangerText : colors.primaryDark,
                      ),
                    ),
                    Text(title,
                        textAlign: TextAlign.center,
                        style: TextStyle(fontSize: 19, fontWeight: FontWeight.w700, color: colors.textPrimary)),
                    if (message != null && message!.isNotEmpty) ...[
                      const SizedBox(height: 10),
                      Text(message!,
                          textAlign: TextAlign.center,
                          style: TextStyle(fontSize: 15, height: 22 / 15, color: colors.textSecondary)),
                    ],
                    const SizedBox(height: 22),
                    if (stacked)
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          for (var i = 0; i < ordered.length; i++) ...[
                            if (i > 0) const SizedBox(height: 10),
                            buttonFor(ordered[i]),
                          ],
                        ],
                      )
                    else
                      Row(
                        children: [
                          for (var i = 0; i < ordered.length; i++) ...[
                            if (i > 0) const SizedBox(width: 10),
                            Expanded(child: buttonFor(ordered[i])),
                          ],
                        ],
                      ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
