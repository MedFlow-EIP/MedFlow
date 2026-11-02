import 'package:flutter/material.dart';
import 'package:ionicons/ionicons.dart';

import '../../navigation/nav.dart';
import '../../services/api.dart';
import '../../theme/theme_controller.dart';
import '../../utils/app_alert.dart';
import '../ui.dart';

/// Icônes Ionicons des quêtes, par nom (backend/routes/quests.py). Le package
/// Dart n'a pas de recherche par nom en constante : on liste celles envoyées.
const _questIcons = <String, IconData>{
  'help-circle': Ionicons.help_circle,
  'checkmark-circle': Ionicons.checkmark_circle,
  'school': Ionicons.school,
  'calendar': Ionicons.calendar,
  'trophy': Ionicons.trophy,
  'cloud-upload': Ionicons.cloud_upload,
  'flame': Ionicons.flame,
  'star': Ionicons.star,
  'flash': Ionicons.flash,
  'book': Ionicons.book,
  'albums': Ionicons.albums,
  'medkit': Ionicons.medkit,
};

/// Nombre affiché comme en JS (3 et non 3.0).
String _n(num v) => v == v.roundToDouble() ? '${v.round()}' : '$v';

/// Quêtes du jour et de la semaine (F58), avec récupération de l'XP.
/// Chaque quête : id, period ('daily' | 'weekly'), title, icon, progress,
/// target, xp, completed, claimed.
class QuestsCard extends StatefulWidget {
  /// Écart au-dessus de la carte, appliqué seulement quand elle s'affiche.
  final EdgeInsetsGeometry margin;
  const QuestsCard({super.key, this.margin = EdgeInsets.zero});

  @override
  State<QuestsCard> createState() => _QuestsCardState();
}

class _QuestsCardState extends State<QuestsCard> with FocusRefresh<QuestsCard> {
  List<Map<String, dynamic>> _quests = [];
  String _period = 'daily';
  String? _claiming;

  @override
  String? get tabName => 'Home';

  @override
  void onFocus() => _load();

  Future<void> _load() async {
    if (Api.currentUser == null) return;
    try {
      final data = await Api.getJson('/api/quests', fallback: '');
      final list = (data as Map)['quests'] as List;
      if (!mounted) return;
      setState(() => _quests = list.map((q) => (q as Map).cast<String, dynamic>()).toList());
    } catch (_) {
      // Carte secondaire : on garde la dernière liste connue.
    }
  }

  Future<void> _claim(Map<String, dynamic> quest) async {
    if (Api.currentUser == null || _claiming != null) return;
    final id = '${quest['id']}';
    setState(() => _claiming = id);
    try {
      final res = await Api.send('POST', '/api/quests/$id/claim');
      readJsonOrThrow(res, 'Récompense indisponible.');
      if (!mounted) return;
      setState(() {
        _quests = [
          for (final q in _quests)
            if ('${q['id']}' == id) {...q, 'claimed': true} else q,
        ];
      });
    } catch (err) {
      appAlert('Récompense indisponible', errorMessage(err, 'Réessaie dans un instant.'));
    } finally {
      if (mounted) setState(() => _claiming = null);
    }
  }

  int _toClaim(String period) =>
      _quests.where((q) => q['period'] == period && q['completed'] == true && q['claimed'] != true).length;

  @override
  Widget build(BuildContext context) {
    if (_quests.isEmpty) return const SizedBox.shrink();
    final c = context.colors;
    final shown = _quests.where((q) => q['period'] == _period).toList();

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
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Semantics(
                  header: true,
                  child:
                      Text('Quêtes', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: c.textPrimary)),
                ),
                Container(
                  padding: const EdgeInsets.all(3),
                  decoration: BoxDecoration(color: c.surfaceAlt, borderRadius: BorderRadius.circular(12)),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      for (final p in const ['daily', 'weekly']) _tab(context, p)
                    ],
                  ),
                ),
              ],
            ),
            for (final q in shown) ...[const SizedBox(height: 12), _row(context, q)],
          ],
        ),
      ),
    );
  }

  Widget _tab(BuildContext context, String p) {
    final c = context.colors;
    final active = p == _period;
    final pending = _toClaim(p);
    return Tappable(
      onTap: () => setState(() => _period = p),
      selected: active,
      semanticLabel:
          '${p == 'daily' ? 'Du jour' : 'De la semaine'}${pending > 0 ? ', $pending récompense à récupérer' : ''}',
      child: ExcludeSemantics(
        child: Container(
          constraints: const BoxConstraints(minHeight: 36),
          padding: const EdgeInsets.symmetric(horizontal: 12),
          decoration: BoxDecoration(
            color: active ? c.surface : null,
            borderRadius: BorderRadius.circular(9),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                p == 'daily' ? 'Jour' : 'Semaine',
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: active ? FontWeight.w600 : FontWeight.w500,
                  color: active ? c.primaryText : c.textSecondary,
                ),
              ),
              if (pending > 0) ...[
                const SizedBox(width: 4),
                Container(
                  width: 7,
                  height: 7,
                  decoration: BoxDecoration(color: c.warning, borderRadius: BorderRadius.circular(4)),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _row(BuildContext context, Map<String, dynamic> q) {
    final c = context.colors;
    final id = '${q['id']}';
    final title = '${q['title'] ?? ''}';
    final claimed = q['claimed'] == true;
    final completed = q['completed'] == true;
    final progress = q['progress'] is num ? q['progress'] as num : 0;
    final target = q['target'] is num ? q['target'] as num : 0;
    final xp = q['xp'] is num ? (q['xp'] as num).toInt() : 0;
    final claimable = completed && !claimed;

    final row = Row(
      children: [
        Container(
          width: 36,
          height: 36,
          decoration: BoxDecoration(color: claimed ? c.success : c.tintPrimary, shape: BoxShape.circle),
          child: Icon(
            claimed ? Ionicons.checkmark : (_questIcons[q['icon']] ?? Ionicons.help),
            size: 18,
            color: claimed ? c.onAction : c.primaryDark,
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(title,
                  style: TextStyle(
                      fontSize: 14, fontWeight: FontWeight.w600, color: claimed ? c.textSecondary : c.textPrimary)),
              const SizedBox(height: 6),
              Row(
                children: [
                  Expanded(
                    child:
                        ProgressBar(progress: target > 0 ? (progress / target) * 100 : 0, height: 6, color: c.success),
                  ),
                  const SizedBox(width: 8),
                  ConstrainedBox(
                    constraints: const BoxConstraints(minWidth: 36),
                    child: Text('${_n(progress)}/${_n(target)}',
                        textAlign: TextAlign.right,
                        style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: c.textSecondary)),
                  ),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(width: 12),
        if (claimable)
          Tappable(
            onTap: _claiming == id ? null : () => _claim(q),
            semanticLabel: 'Récupérer $xp XP pour $title',
            child: ExcludeSemantics(
              child: Container(
                constraints: const BoxConstraints(minWidth: 72, minHeight: 40),
                padding: const EdgeInsets.symmetric(horizontal: 10),
                alignment: Alignment.center,
                decoration: BoxDecoration(color: c.action, borderRadius: BorderRadius.circular(12)),
                child: _claiming == id
                    ? SizedBox(
                        width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: c.onAction))
                    : Text('+$xp XP', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: c.onAction)),
              ),
            ),
          )
        else
          ConstrainedBox(
            constraints: const BoxConstraints(minWidth: 72),
            child: Text(claimed ? 'Récupéré' : '$xp XP',
                textAlign: TextAlign.right,
                style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: c.textSecondary)),
          ),
      ],
    );

    // Quête à récupérer : le bouton reste un élément d'accessibilité séparé.
    if (claimable) return row;
    return Semantics(
      container: true,
      label: '$title, ${_n(progress)} sur ${_n(target)}, $xp XP${claimed ? ', récupéré' : ''}',
      excludeSemantics: true,
      child: row,
    );
  }
}
