import 'package:flutter/material.dart';
import 'package:ionicons/ionicons.dart';

import '../../theme/theme_controller.dart';
import '../ui.dart';
import 'modal_overlay.dart';

// Copie de components/NotificationOptInModal.tsx.
//
// Le <Modal transparent> RN devient un calque plein écran : l'écran qui
// l'affiche le place dans un `Stack` (Positioned.fill).

class NotificationOptInModal extends StatelessWidget {
  final bool visible;
  final VoidCallback onAccept;
  final VoidCallback onDecline;
  const NotificationOptInModal({super.key, required this.visible, required this.onAccept, required this.onDecline});

  @override
  Widget build(BuildContext context) {
    if (!visible) return const SizedBox.shrink();
    final c = context.colors;

    return LessonModalOverlay(
      label: 'Garde ta série vivante !',
      child: Container(
        width: double.infinity,
        constraints: const BoxConstraints(maxWidth: 340),
        padding: const EdgeInsets.all(28),
        decoration: BoxDecoration(
          color: c.surface,
          borderRadius: BorderRadius.circular(24),
          boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.3), blurRadius: 20, offset: const Offset(0, 8))],
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 88,
              height: 88,
              decoration: BoxDecoration(color: c.tintWarning, shape: BoxShape.circle),
              child: Icon(Ionicons.flame, size: 44, color: c.warning),
            ),
            const SizedBox(height: 20),
            Text('Garde ta série vivante !',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700, color: c.textPrimary)),
            const SizedBox(height: 10),
            Text(
              "Active un petit rappel le soir, uniquement si tu n'as pas encore révisé ce jour-là. "
              'Fini de perdre ton streak par oubli.',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 14, height: 20 / 14, color: c.textSecondary),
            ),
            const SizedBox(height: 24),
            Tappable(
              onTap: onAccept,
              semanticLabel: 'Activer les rappels',
              child: ExcludeSemantics(
                child: Container(
                  width: double.infinity,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  decoration: BoxDecoration(color: c.action, borderRadius: BorderRadius.circular(14)),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Ionicons.notifications, size: 18, color: c.onAction),
                      const SizedBox(width: 8),
                      Flexible(
                        child: Text('Activer les rappels',
                            style: TextStyle(color: c.onAction, fontSize: 16, fontWeight: FontWeight.w700)),
                      ),
                    ],
                  ),
                ),
              ),
            ),
            const SizedBox(height: 12),
            Tappable(
              onTap: onDecline,
              semanticLabel: 'Plus tard',
              child: ExcludeSemantics(
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  child: Text('Plus tard',
                      style: TextStyle(color: c.textSecondary, fontSize: 14, fontWeight: FontWeight.w600)),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
