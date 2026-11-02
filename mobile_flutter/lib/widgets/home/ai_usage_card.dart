import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:ionicons/ionicons.dart';

import '../../navigation/nav.dart';
import '../../services/api.dart';
import '../../theme/theme_controller.dart';
import '../ui.dart';

// Chaque élément de /api/ai/usage : kind ('chat' | 'process' | 'case'), used,
// limit, et blocked_until = date (ISO) à laquelle un appel redevient possible,
// si une limite est atteinte.

const _labels = <String, ({String label, IconData icon})>{
  'chat': (label: 'Messages à l’assistant', icon: Ionicons.chatbubbles_outline),
  'process': (label: 'Imports de cours', icon: Ionicons.cloud_upload_outline),
  'case': (label: 'Cas cliniques', icon: Ionicons.medkit_outline),
};

/// « 14 h 32 », ou « demain 9 h 05 » quand ce n'est pas aujourd'hui.
String availableAt(String iso, [DateTime? now]) {
  final parsed = DateTime.tryParse(iso);
  if (parsed == null) return iso;
  final date = parsed.toLocal();
  final today = now ?? DateTime.now();
  final time = '${date.hour} h ${date.minute.toString().padLeft(2, '0')}';
  final sameDay = date.year == today.year && date.month == today.month && date.day == today.day;
  return sameDay ? time : 'demain $time';
}

/// Ce qu'il reste d'IA sur 24 h glissantes : chat, imports, cas cliniques.
class AIUsageCard extends StatefulWidget {
  /// Écart au-dessus de la carte, appliqué seulement quand elle s'affiche.
  final EdgeInsetsGeometry margin;
  const AIUsageCard({super.key, this.margin = EdgeInsets.zero});

  @override
  State<AIUsageCard> createState() => _AIUsageCardState();
}

class _AIUsageCardState extends State<AIUsageCard> with FocusRefresh<AIUsageCard> {
  List<Map<String, dynamic>>? _usage;

  @override
  String? get tabName => 'Home';

  @override
  void onFocus() => _load();

  Future<void> _load() async {
    if (Api.currentUser == null) return;
    try {
      final data = decodeBody(await Api.get('/api/ai/usage'));
      if (mounted && data is Map && data['usage'] is List) {
        setState(() => _usage = (data['usage'] as List).map((u) => (u as Map).cast<String, dynamic>()).toList());
      }
    } catch (_) {
      // Hors ligne : la carte reste cachée, rien de bloquant.
    }
  }

  @override
  Widget build(BuildContext context) {
    final usage = _usage;
    if (usage == null) return const SizedBox.shrink();
    final c = context.colors;

    return Padding(
      padding: widget.margin,
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: c.surface,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: c.border),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                Icon(Ionicons.sparkles_outline, size: 20, color: c.primaryDark),
                const SizedBox(width: 8),
                Expanded(
                  child: Semantics(
                    header: true,
                    child: Text('Ton IA sur 24 h',
                        style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: c.textPrimary)),
                  ),
                ),
              ],
            ),
            for (final u in usage) ...[const SizedBox(height: 12), _row(context, u)],
            const SizedBox(height: 12),
            Text('Chaque utilisation se libère 24 h plus tard.',
                style: TextStyle(fontSize: 12, color: c.textSecondary)),
          ],
        ),
      ),
    );
  }

  Widget _row(BuildContext context, Map<String, dynamic> u) {
    final c = context.colors;
    final kind = '${u['kind']}';
    final meta = _labels[kind] ?? (label: kind, icon: Ionicons.sparkles_outline);
    final used = u['used'] is num ? (u['used'] as num).toInt() : 0;
    final limit = u['limit'] is num ? (u['limit'] as num).toInt() : 0;
    final blockedUntil =
        u['blocked_until'] is String && (u['blocked_until'] as String).isNotEmpty ? u['blocked_until'] as String : null;
    final left = math.max(0, limit - used);
    final ratio = limit > 0 ? (used / limit) * 100 : 0.0;
    final low = blockedUntil != null || left <= (limit * 0.1).ceil();

    return Semantics(
      container: true,
      label: blockedUntil != null
          ? '${meta.label} : limite atteinte, de nouveau disponible à ${availableAt(blockedUntil)}'
          : '${meta.label} : $left restant${left > 1 ? 's' : ''} sur $limit',
      excludeSemantics: true,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Icon(meta.icon, size: 16, color: c.textSecondary),
              const SizedBox(width: 8),
              Expanded(child: Text(meta.label, style: TextStyle(fontSize: 14, color: c.textPrimary))),
              const SizedBox(width: 8),
              Text(
                '$used / $limit',
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                  color: low ? c.warningText : c.textSecondary,
                  fontFeatures: const [FontFeature.tabularFigures()],
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          ProgressBar(progress: ratio, height: 6, color: low ? c.warning : c.primary),
          if (blockedUntil != null) ...[
            const SizedBox(height: 6),
            Text('Limite atteinte · de nouveau disponible à ${availableAt(blockedUntil)}',
                style: TextStyle(fontSize: 13, color: c.warningText)),
          ],
        ],
      ),
    );
  }
}
