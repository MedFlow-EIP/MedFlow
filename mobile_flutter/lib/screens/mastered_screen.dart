import 'package:flutter/material.dart';
import 'package:ionicons/ionicons.dart';

import '../navigation/nav.dart';
import '../services/api.dart';
import '../theme/theme_controller.dart';
import '../widgets/insets.dart';
import '../widgets/revision/common.dart';
import '../widgets/ui.dart';

// Carte maîtrisée : {course_id, course_nom, item_index, question, interval_days, repetitions}.

class MasteredScreen extends StatefulWidget {
  const MasteredScreen({super.key});

  @override
  State<MasteredScreen> createState() => _MasteredScreenState();
}

class _MasteredScreenState extends State<MasteredScreen> with FocusRefresh<MasteredScreen> {
  bool _loading = true;
  bool _error = false;
  List<Map<String, dynamic>> _items = [];

  @override
  void onFocus() => _load();

  Future<void> _load() async {
    final user = Api.currentUser;
    if (user == null) {
      setState(() => _loading = false);
      return;
    }
    setState(() {
      _loading = true;
      _error = false;
    });
    try {
      final res = await Api.get('/api/revision/mastered');
      if (res.statusCode < 200 || res.statusCode >= 300) throw Exception('Erreur serveur');
      final data = decodeBody(res);
      if (data == null) throw const FormatException('Réponse illisible');
      final items = data is Map && data['items'] is List
          ? (data['items'] as List).whereType<Map>().map((m) => Map<String, dynamic>.from(m)).toList()
          : <Map<String, dynamic>>[];
      if (mounted) setState(() => _items = items);
    } catch (err) {
      debugPrint('Erreur chargement cartes maîtrisées: $err');
      if (mounted) setState(() => _error = true);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  /// Cartes regroupées par cours, dans l'ordre d'arrivée.
  List<({String courseId, String courseNom, List<Map<String, dynamic>> items})> get _groupedItems {
    final byCourse = <String, ({String courseNom, List<Map<String, dynamic>> items})>{};
    for (final item in _items) {
      final id = '${item['course_id']}';
      final existing = byCourse[id];
      if (existing != null) {
        existing.items.add(item);
      } else {
        byCourse[id] = (courseNom: '${item['course_nom'] ?? ''}', items: [item]);
      }
    }
    return [for (final e in byCourse.entries) (courseId: e.key, courseNom: e.value.courseNom, items: e.value.items)];
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: context.colors.background,
      body: _body(context),
    );
  }

  Widget _body(BuildContext context) {
    final c = context.colors;
    final insets = ScreenInsets.of(context);

    if (_loading) {
      return Padding(
        padding: EdgeInsets.only(top: insets.top),
        child: Center(
          child: Spinner(large: true, color: c.primaryDark, label: 'Chargement des cartes maîtrisées'),
        ),
      );
    }

    if (_error) {
      return StateView(
        icon: Ionicons.cloudOfflineOutline,
        tone: Tone.neutral,
        title: 'Impossible de charger les cartes maîtrisées',
        subtitle: 'Vérifie ta connexion puis réessaie.',
        primary: StateAction('Réessayer', _load),
        onClose: () => Nav.goBack(),
      );
    }

    if (_items.isEmpty) {
      return StateView(
        icon: Ionicons.trophyOutline,
        tone: Tone.warning,
        title: 'Pas encore de carte maîtrisée',
        subtitle:
            'Une carte apparaît ici une fois bien sue plusieurs fois de suite. Continue à réviser régulièrement !',
        primary: StateAction('Réviser maintenant', () => Nav.navigate('Revision')),
        onClose: () => Nav.goBack(),
      );
    }

    final groups = _groupedItems;
    final plural = _items.length > 1 ? 's' : '';

    final header = Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            CircleIconButton.back(() => Nav.goBack()),
            const SizedBox(width: 12),
            Expanded(
              child: Semantics(
                header: true,
                child: Text('Cartes maîtrisées',
                    style: TextStyle(fontSize: 22, fontWeight: FontWeight.w700, color: c.textPrimary)),
              ),
            ),
          ],
        ),
        const SizedBox(height: 20),
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: c.surface,
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: c.border),
          ),
          child: Row(
            children: [
              Container(
                width: 52,
                height: 52,
                decoration: BoxDecoration(color: c.tintWarning, borderRadius: BorderRadius.circular(14)),
                child: Icon(Ionicons.trophy, size: 26, color: c.warning),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('${_items.length} carte$plural maîtrisée$plural',
                        style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: c.textPrimary)),
                    const SizedBox(height: 2),
                    Text('Elles reviendront de moins en moins souvent.',
                        style: TextStyle(fontSize: 13, color: c.textSecondary)),
                  ],
                ),
              ),
            ],
          ),
        ),
      ],
    );

    return Padding(
      padding: EdgeInsets.only(top: insets.top),
      child: ListView.separated(
        padding: EdgeInsets.fromLTRB(20, 0, 20, insets.bottom + 24),
        itemCount: groups.length + 1,
        separatorBuilder: (_, __) => const SizedBox(height: 20),
        itemBuilder: (context, i) {
          if (i == 0) return header;
          final group = groups[i - 1];
          return Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  Flexible(
                    child: Text(group.courseNom,
                        style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700, color: c.textPrimary)),
                  ),
                  const SizedBox(width: 8),
                  Container(
                    constraints: const BoxConstraints(minWidth: 24),
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                    alignment: Alignment.center,
                    decoration: BoxDecoration(color: c.surfaceAlt, borderRadius: BorderRadius.circular(999)),
                    child: Text('${group.items.length}',
                        style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: c.textSecondary)),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                decoration: BoxDecoration(
                  color: c.surface,
                  borderRadius: BorderRadius.circular(18),
                  border: Border.all(color: c.border),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    for (var j = 0; j < group.items.length; j++) _row(context, group.items[j], j > 0),
                  ],
                ),
              ),
            ],
          );
        },
      ),
    );
  }

  Widget _row(BuildContext context, Map<String, dynamic> m, bool divider) {
    final c = context.colors;
    final interval = jsNum(m['interval_days']);

    Widget chip(IconData icon, String text, Color bg, Color fg) => Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
          decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(999)),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, size: 13, color: fg),
              const SizedBox(width: 4),
              Text(text, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: fg)),
            ],
          ),
        );

    return Tappable(
      onTap: () => Nav.navigate('CourseDetail', {'courseId': m['course_id']}),
      semanticLabel: '${m['question']}, prochaine révision dans $interval jours',
      child: ExcludeSemantics(
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 14),
          decoration: divider ? BoxDecoration(border: Border(top: BorderSide(color: c.border))) : null,
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('${m['question'] ?? ''}',
                        maxLines: 3,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                            fontSize: 15, height: 21 / 15, fontWeight: FontWeight.w600, color: c.textPrimary)),
                    const SizedBox(height: 8),
                    Wrap(
                      spacing: 6,
                      runSpacing: 6,
                      children: [
                        chip(Ionicons.calendarOutline, 'Dans $interval j', c.tintPrimary, c.primaryText),
                        chip(Ionicons.checkmarkDone, '${jsNum(m['repetitions'])}× de suite', c.tintSuccess,
                            c.successText),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 12),
              Icon(Ionicons.chevronForward, size: 18, color: c.textSecondary),
            ],
          ),
        ),
      ),
    );
  }
}
