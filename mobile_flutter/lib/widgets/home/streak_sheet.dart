import 'package:flutter/material.dart';
import 'package:ionicons/ionicons.dart';

import '../../theme/theme_controller.dart';
import '../sheet.dart';
import '../ui.dart';

/// Explication de la série et des protections de série (copie de StreakSheet.tsx).
Future<void> showStreakSheet(
  BuildContext context, {
  required int streak,
  required int freezes,
  required int maxFreezes,
}) {
  return showAppSheet<void>(
    context,
    showClose: false,
    builder: (ctx) => _StreakSheetBody(streak: streak, freezes: freezes, maxFreezes: maxFreezes),
  );
}

class _StreakSheetBody extends StatelessWidget {
  final int streak;
  final int freezes;
  final int maxFreezes;
  const _StreakSheetBody({required this.streak, required this.freezes, required this.maxFreezes});

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final daysToNext = 7 - (streak % 7);
    final textStyle = TextStyle(fontSize: 15, height: 22 / 15, color: c.textSecondary);

    // La feuille partagée met 18 px sous la poignée et 20 px sur les côtés :
    // on complète pour retrouver les 20 px (gap 12 + marginTop 8) et 24 px de l'original.
    return Padding(
      padding: const EdgeInsets.only(top: 2, left: 4, right: 4),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Column(
            children: [
              Icon(Ionicons.flame, size: 40, color: c.warning),
              const SizedBox(height: 6),
              Semantics(
                header: true,
                child: Text('$streak jour${streak > 1 ? 's' : ''} de série',
                    textAlign: TextAlign.center,
                    style: TextStyle(fontSize: 24, fontWeight: FontWeight.w700, color: c.textPrimary)),
              ),
            ],
          ),
          // gap 12 + marginVertical 6.
          const SizedBox(height: 18),
          Semantics(
            container: true,
            label: '$freezes protection${freezes > 1 ? 's' : ''} sur $maxFreezes',
            excludeSemantics: true,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                for (var i = 0; i < maxFreezes; i++) ...[
                  if (i > 0) const SizedBox(width: 12),
                  Container(
                    width: 56,
                    height: 56,
                    decoration: BoxDecoration(
                      color: i < freezes ? c.primaryDark : c.surfaceAlt,
                      borderRadius: BorderRadius.circular(18),
                    ),
                    child: Icon(Ionicons.shield_checkmark, size: 26, color: i < freezes ? c.onAction : c.muted),
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(height: 18),
          Text('Protections de série',
              style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700, color: c.textPrimary)),
          const SizedBox(height: 12),
          Text('Si tu manques un jour, une protection est utilisée automatiquement et ta série continue.',
              style: textStyle),
          const SizedBox(height: 12),
          Text(
            freezes >= maxFreezes
                ? 'Tu as le maximum ($maxFreezes). Garde ta série pour les conserver.'
                : 'Tu en gagnes une tous les 7 jours de série : la prochaine dans $daysToNext jour${daysToNext > 1 ? 's' : ''}.',
            style: textStyle,
          ),
          // gap 12 + marginTop 8.
          const SizedBox(height: 20),
          Tappable(
            onTap: () => Navigator.of(context).maybePop(),
            child: Container(
              height: 52,
              alignment: Alignment.center,
              decoration: BoxDecoration(color: c.action, borderRadius: BorderRadius.circular(14)),
              child: Text('Compris', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: c.onAction)),
            ),
          ),
        ],
      ),
    );
  }
}
