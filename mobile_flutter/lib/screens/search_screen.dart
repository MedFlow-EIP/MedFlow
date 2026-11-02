import 'dart:async';

import 'package:flutter/material.dart';
import 'package:ionicons/ionicons.dart';

import '../navigation/nav.dart';
import '../services/api.dart';
import '../theme/theme_controller.dart';
import '../widgets/insets.dart';
import '../widgets/ui.dart';

// Recherche dans les cours, flashcards et quiz (copie de SearchScreen.tsx).

const _matchTypeLabel = {
  'course_name': 'Cours',
  'flashcard': 'Flashcard',
  'quiz': 'Quiz',
};

const _matchTypeIcon = {
  'course_name': Ionicons.documentTextOutline,
  'flashcard': Ionicons.layersOutline,
  'quiz': Ionicons.helpCircleOutline,
};

const _debounce = Duration(milliseconds: 350);

class _Group {
  final dynamic courseId;
  final String courseNom;
  final List<Map<String, dynamic>> items;
  _Group(this.courseId, this.courseNom, this.items);
}

class SearchScreen extends StatefulWidget {
  const SearchScreen({super.key});

  @override
  State<SearchScreen> createState() => _SearchScreenState();
}

class _SearchScreenState extends State<SearchScreen> {
  final _query = TextEditingController();
  List<Map<String, dynamic>> _results = [];
  bool _loading = false;
  bool _searched = false;
  Timer? _debounceTimer;

  @override
  void dispose() {
    _debounceTimer?.cancel();
    _query.dispose();
    super.dispose();
  }

  Future<void> _runSearch(String text) async {
    if (Api.currentUser == null || text.trim().isEmpty) {
      setState(() {
        _results = [];
        _searched = false;
      });
      return;
    }
    setState(() => _loading = true);
    var results = <Map<String, dynamic>>[];
    try {
      final data = decodeBody(await Api.get('/api/search', query: {'q': text}));
      if (data == null) throw const FormatException('Réponse illisible');
      results = data is Map && data['results'] is List
          ? (data['results'] as List).whereType<Map>().map((m) => m.cast<String, dynamic>()).toList()
          : [];
    } catch (err) {
      debugPrint('Erreur recherche: $err');
      results = [];
    } finally {
      if (mounted) {
        setState(() {
          _results = results;
          _loading = false;
          _searched = true;
        });
      }
    }
  }

  void _onChangeQuery(String text) {
    setState(() {});
    _debounceTimer?.cancel();
    _debounceTimer = Timer(_debounce, () {
      if (mounted) _runSearch(text);
    });
  }

  List<_Group> get _groupedResults {
    final byCourse = <dynamic, _Group>{};
    for (final r in _results) {
      byCourse.putIfAbsent(r['course_id'], () => _Group(r['course_id'], '${r['course_nom'] ?? ''}', [])).items.add(r);
    }
    return byCourse.values.toList();
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final insets = ScreenInsets.of(context);
    final groups = _groupedResults;

    return Scaffold(
      backgroundColor: c.background,
      body: Padding(
        padding: EdgeInsets.only(top: insets.top),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 12),
              child: Row(
                children: [
                  CircleIconButton.back(() => Nav.goBack()),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Semantics(
                      header: true,
                      child: Text('Recherche',
                          style: TextStyle(fontSize: 22, fontWeight: FontWeight.w700, color: c.textPrimary)),
                    ),
                  ),
                ],
              ),
            ),
            Container(
              margin: const EdgeInsets.symmetric(horizontal: 20),
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              decoration: BoxDecoration(
                color: c.surface,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: c.border),
              ),
              child: Row(
                children: [
                  Icon(Ionicons.search, size: 18, color: c.textSecondary),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Semantics(
                      label: 'Rechercher',
                      child: TextField(
                        controller: _query,
                        onChanged: _onChangeQuery,
                        autofocus: true,
                        style: TextStyle(fontSize: 15, color: c.textPrimary),
                        decoration: InputDecoration(
                          isDense: true,
                          border: InputBorder.none,
                          contentPadding: EdgeInsets.zero,
                          hintText: 'Rechercher dans tes cours, flashcards, quiz...',
                          hintStyle: TextStyle(color: c.textSecondary),
                        ),
                      ),
                    ),
                  ),
                  if (_loading) ...[
                    const SizedBox(width: 8),
                    SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: c.primary,
                        semanticsLabel: 'Recherche en cours',
                      ),
                    ),
                  ],
                ],
              ),
            ),
            if (_searched && !_loading && _results.isEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 60),
                child: Column(
                  children: [
                    Icon(Ionicons.searchOutline, size: 48, color: c.muted),
                    const SizedBox(height: 12),
                    Text('Aucun résultat pour "${_query.text}"',
                        textAlign: TextAlign.center, style: TextStyle(fontSize: 14, color: c.textSecondary)),
                  ],
                ),
              ),
            Expanded(
              child: ListView.separated(
                padding: EdgeInsets.fromLTRB(20, 20, 20, insets.bottom + 16),
                keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
                itemCount: groups.length,
                separatorBuilder: (_, __) => const SizedBox(height: 16),
                itemBuilder: (context, index) => _GroupView(group: groups[index]),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _GroupView extends StatelessWidget {
  final _Group group;
  const _GroupView({required this.group});

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(group.courseNom.toUpperCase(),
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: c.textSecondary)),
        for (final r in group.items) ...[
          const SizedBox(height: 8),
          _ResultRow(result: r),
        ],
      ],
    );
  }
}

class _ResultRow extends StatelessWidget {
  final Map<String, dynamic> result;
  const _ResultRow({required this.result});

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final type = '${result['match_type']}';
    final label = _matchTypeLabel[type] ?? '';
    final snippet = '${result['snippet'] ?? ''}';
    return Tappable(
      onTap: () => Nav.navigate('CourseDetail', {'courseId': result['course_id']}),
      semanticLabel: '$label : $snippet',
      child: ExcludeSemantics(
        child: Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(color: c.surface, borderRadius: BorderRadius.circular(12)),
          child: Row(
            children: [
              Icon(_matchTypeIcon[type] ?? Ionicons.documentTextOutline, size: 18, color: c.primary),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(label, style: TextStyle(fontSize: 11, color: c.primaryText, fontWeight: FontWeight.w600)),
                    const SizedBox(height: 2),
                    Text(snippet,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(fontSize: 14, color: c.textPrimary)),
                  ],
                ),
              ),
              const SizedBox(width: 12),
              Icon(Ionicons.chevronForward, size: 18, color: c.muted),
            ],
          ),
        ),
      ),
    );
  }
}
