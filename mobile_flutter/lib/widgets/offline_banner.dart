import 'package:flutter/material.dart';
import 'package:ionicons/ionicons.dart';

import '../theme/theme_controller.dart';

/// Bandeau affiché quand l'écran montre la copie locale d'un cours, faute de réseau.
class OfflineBanner extends StatelessWidget {
  final String message;
  const OfflineBanner({super.key, this.message = 'Hors ligne : version enregistrée sur ton téléphone.'});

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Semantics(
      liveRegion: true,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(color: c.tintWarning, borderRadius: BorderRadius.circular(14)),
        child: Row(
          children: [
            Icon(Ionicons.cloud_offline_outline, size: 18, color: c.warningText),
            const SizedBox(width: 10),
            Expanded(
              child: Text(message, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w500, color: c.warningText)),
            ),
          ],
        ),
      ),
    );
  }
}
