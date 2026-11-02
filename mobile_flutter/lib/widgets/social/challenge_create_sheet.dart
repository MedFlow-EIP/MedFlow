import 'package:flutter/material.dart';
import 'package:ionicons/ionicons.dart';

import '../../services/api.dart';
import '../../theme/theme_controller.dart';
import '../insets.dart';
import '../sheet.dart';
import '../ui.dart';

// Même minimum que le backend (routes/challenges.py).
const _minQuestions = 3;

/// Choix du cours et du nombre de questions pour défier un ami
/// (copie de components/challenge/ChallengeCreateSheet.tsx).
///
/// ``friend`` : {uid, displayName}. ``count`` est le nombre de questions
/// choisi la dernière fois (gardé par l'écran, comme l'état du Modal RN).
/// ``onCreated`` est appelé après la fermeture de la feuille.
Future<void> showChallengeCreateSheet(
  BuildContext context, {
  required Map<String, dynamic> friend,
  int count = 5,
  ValueChanged<int>? onCountChanged,
  required ValueChanged<int> onCreated,
}) {
  return showAppSheet<void>(
    context,
    showClose: false,
    scrollable: false,
    builder: (_) => _ChallengeCreateBody(
      friend: friend,
      initialCount: count,
      onCountChanged: onCountChanged,
      onCreated: onCreated,
    ),
  );
}

class _ChallengeCreateBody extends StatefulWidget {
  final Map<String, dynamic> friend;
  final int initialCount;
  final ValueChanged<int>? onCountChanged;
  final ValueChanged<int> onCreated;
  const _ChallengeCreateBody({
    required this.friend,
    required this.initialCount,
    required this.onCountChanged,
    required this.onCreated,
  });

  @override
  State<_ChallengeCreateBody> createState() => _ChallengeCreateBodyState();
}

class _ChallengeCreateBodyState extends State<_ChallengeCreateBody> {
  List<Map<String, dynamic>>? _courses;
  Object? _courseId;
  late int _count = widget.initialCount;
  bool _busy = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadCourses();
  }

  Future<void> _loadCourses() async {
    if (Api.currentUser == null) return;
    try {
      final data = await Api.getJson('/api/dashboard?per_page=100', fallback: 'Impossible de charger tes cours.');
      final playable = [
        for (final c in (data['cours'] as List? ?? const []))
          if (((c as Map)['quiz'] as num? ?? 0) >= _minQuestions) c.cast<String, dynamic>(),
      ];
      if (!mounted) return;
      setState(() {
        _courses = playable;
        _courseId = playable.isNotEmpty ? playable.first['id'] : null;
      });
    } catch (err) {
      if (!mounted) return;
      setState(() {
        _courses = [];
        _error = errorMessage(err, 'Impossible de charger tes cours.');
      });
    }
  }

  Future<void> _create() async {
    if (Api.currentUser == null || _courseId == null) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final data = await Api.postJson(
        '/api/challenges',
        {'friend_uid': widget.friend['uid'], 'course_id': _courseId, 'count': _count},
        fallback: 'Impossible de créer le défi.',
      );
      final id = (data['id'] as num).toInt();
      if (mounted) Navigator.of(context).pop();
      widget.onCreated(id);
    } catch (err) {
      if (!mounted) return;
      setState(() => _error = errorMessage(err, 'Impossible de créer le défi.'));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  void _setCount(int n) {
    setState(() => _count = n);
    widget.onCountChanged?.call(n);
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final insets = ScreenInsets.of(context);
    final disabled = _courseId == null || _busy;
    // Feuille limitée à 85 % de l'écran (poignée et marge du bas déduites) :
    // seule la liste des cours défile, le bouton reste visible.
    final maxHeight = MediaQuery.sizeOf(context).height * 0.85 - 33 - (insets.bottom + 22);

    return PopScope(
      // Fond touché ou retour pendant la création : la feuille reste ouverte.
      canPop: !_busy,
      child: ConstrainedBox(
        constraints: BoxConstraints(maxHeight: maxHeight),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Semantics(
              header: true,
              child: Text('Défier ${widget.friend['displayName']}',
                  style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700, color: c.textPrimary)),
            ),
            const SizedBox(height: 12),
            Text(
              'Vous répondez aux mêmes questions, chacun de votre côté. Le meilleur score gagne 20 XP.',
              style: TextStyle(fontSize: 14, height: 20 / 14, color: c.textSecondary),
            ),
            if (_error != null && _error!.isNotEmpty) ...[
              const SizedBox(height: 12),
              Semantics(
                liveRegion: true,
                child: Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(color: c.tintDanger, borderRadius: BorderRadius.circular(12)),
                  child: Row(
                    children: [
                      Icon(Ionicons.alertCircle, size: 18, color: c.dangerText),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(_error!,
                            style: TextStyle(fontSize: 14, fontWeight: FontWeight.w500, color: c.dangerText)),
                      ),
                    ],
                  ),
                ),
              ),
            ],
            const SizedBox(height: 12),
            Row(
              children: [
                for (final n in const [5, 10]) ...[
                  if (n != 5) const SizedBox(width: 10),
                  Expanded(child: _countOption(n)),
                ],
              ],
            ),
            const SizedBox(height: 12),
            Flexible(
              child: SingleChildScrollView(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: _courseList(),
                ),
              ),
            ),
            const SizedBox(height: 12),
            Opacity(
              opacity: disabled ? 0.5 : 1,
              child: Semantics(
                button: true,
                enabled: !disabled,
                label: 'Lancer le défi',
                excludeSemantics: true,
                child: GestureDetector(
                  behavior: HitTestBehavior.opaque,
                  onTap: disabled ? null : _create,
                  child: Container(
                    height: 54,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(color: c.action, borderRadius: BorderRadius.circular(14)),
                    child: _busy
                        ? SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(strokeWidth: 2.5, color: c.onAction),
                          )
                        : Text('Lancer le défi',
                            style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: c.onAction)),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  /// Option d'un choix exclusif (accessibilityRole="radio" + checked).
  Widget _radio({required bool checked, required VoidCallback onTap, String? semanticLabel, required Widget child}) {
    return Semantics(
      inMutuallyExclusiveGroup: true,
      checked: checked,
      child: Tappable(onTap: onTap, button: false, semanticLabel: semanticLabel, child: child),
    );
  }

  Widget _countOption(int n) {
    final c = context.colors;
    final active = n == _count;
    return _radio(
      checked: active,
      onTap: () => _setCount(n),
      semanticLabel: '$n questions',
      child: ExcludeSemantics(
        child: Container(
          constraints: const BoxConstraints(minHeight: 44),
          decoration: BoxDecoration(
            color: active ? c.tintPrimary : null,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: active ? c.primaryDark : c.border, width: 1.5),
          ),
          child: Center(
            heightFactor: 1,
            child: Text('$n questions',
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: active ? FontWeight.w700 : FontWeight.w500,
                  color: active ? c.primaryText : c.textSecondary,
                )),
          ),
        ),
      ),
    );
  }

  List<Widget> _courseList() {
    final c = context.colors;
    final courses = _courses;
    if (courses == null) {
      return [
        Center(
          child: SizedBox(
            width: 20,
            height: 20,
            child:
                CircularProgressIndicator(strokeWidth: 2, color: c.primaryDark, semanticsLabel: 'Chargement des cours'),
          ),
        ),
      ];
    }
    if (courses.isEmpty) {
      return [
        Text('Il te faut un cours avec au moins $_minQuestions questions de quiz.',
            style: TextStyle(fontSize: 14, color: c.textSecondary)),
      ];
    }
    return [
      for (var i = 0; i < courses.length; i++) ...[
        if (i > 0) const SizedBox(height: 8),
        _courseOption(courses[i]),
      ],
    ];
  }

  Widget _courseOption(Map<String, dynamic> course) {
    final c = context.colors;
    final active = course['id'] == _courseId;
    return _radio(
      checked: active,
      onTap: () => setState(() => _courseId = course['id']),
      child: Container(
        constraints: const BoxConstraints(minHeight: 52),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(
          color: active ? c.tintPrimary : null,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: active ? c.primaryDark : c.border),
        ),
        child: Row(
          children: [
            Icon(active ? Ionicons.radioButtonOn : Ionicons.radioButtonOff,
                size: 20, color: active ? c.primaryDark : c.textSecondary),
            const SizedBox(width: 10),
            Expanded(
              child: Text('${course['nom']}',
                  maxLines: 2, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 15, color: c.textPrimary)),
            ),
          ],
        ),
      ),
    );
  }
}
