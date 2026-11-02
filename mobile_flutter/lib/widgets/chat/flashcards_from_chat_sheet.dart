import 'package:flutter/material.dart';
import 'package:ionicons/ionicons.dart';

import '../../services/api.dart';
import '../../theme/theme_controller.dart';
import '../insets.dart';
import '../sheet.dart';
import '../ui.dart';

// Copie de components/chat/FlashcardsFromChatSheet.tsx.

// Même identifiant que le backend (routes/courses.py : NOTES_COURSE_ID).
const String _notesCourseId = 'notes-assistant';

/// « Créer des flashcards » sous une réponse du chat : l'IA en tire 3 cartes,
/// ajoutées au cours choisi (ou à « Notes de l'assistant »).
///
/// ``text`` : réponse de l'assistant à transformer. ``onAdded`` est appelé
/// après l'ajout (la feuille est alors fermée).
Future<void> showFlashcardsFromChatSheet(
  BuildContext context, {
  required String text,
  required void Function(int count, String courseName) onAdded,
}) {
  return showAppSheet<void>(
    context,
    title: 'Créer des flashcards',
    showClose: false,
    scrollable: false,
    builder: (_) => _FlashcardsFromChatBody(text: text, onAdded: onAdded),
  );
}

class _FlashcardsFromChatBody extends StatefulWidget {
  final String text;
  final void Function(int count, String courseName) onAdded;
  const _FlashcardsFromChatBody({required this.text, required this.onAdded});

  @override
  State<_FlashcardsFromChatBody> createState() => _FlashcardsFromChatBodyState();
}

class _FlashcardsFromChatBodyState extends State<_FlashcardsFromChatBody> {
  List<Map<String, dynamic>>? _courses;
  String? _busyId;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadCourses();
  }

  Future<void> _loadCourses() async {
    if (Api.currentUser == null) return;
    try {
      final data = await Api.getJson('/api/dashboard',
          query: {'per_page': 100}, fallback: 'Impossible de charger tes cours.');
      final cours = (data is Map && data['cours'] is List) ? data['cours'] as List : const [];
      if (!mounted) return;
      setState(() => _courses = [
            for (final c in cours)
              if (c is Map && c['id'] != _notesCourseId) c.cast<String, dynamic>(),
          ]);
    } catch (err) {
      if (!mounted) return;
      setState(() {
        _courses = [];
        _error = errorMessage(err, 'Impossible de charger tes cours.');
      });
    }
  }

  Future<void> _addTo(Object? courseId) async {
    if (Api.currentUser == null || _busyId != null) return;
    setState(() {
      _busyId = courseId?.toString() ?? _notesCourseId;
      _error = null;
    });
    try {
      final data = await Api.postJson(
        '/api/flashcards/from-text',
        courseId != null ? {'text': widget.text, 'course_id': courseId} : {'text': widget.text},
        fallback: 'Impossible de créer les flashcards.',
        timeout: const Duration(seconds: 60),
      );
      final added = data is Map && data['added'] is List ? (data['added'] as List).length : 0;
      final courseName = data is Map ? '${data['course_nom'] ?? ''}' : '';
      if (mounted) Navigator.of(context).pop();
      widget.onAdded(added, courseName);
    } catch (err) {
      if (mounted) setState(() => _error = errorMessage(err, 'Impossible de créer les flashcards.'));
    } finally {
      if (mounted) setState(() => _busyId = null);
    }
  }

  void _close() {
    if (_busyId == null) Navigator.of(context).pop();
  }

  Widget _choice(Object? id, String title, String subtitle, IconData icon) {
    final c = context.colors;
    final key = id?.toString() ?? _notesCourseId;
    return Tappable(
      key: ValueKey(key),
      onTap: _busyId != null ? null : () => _addTo(id),
      semanticLabel: 'Ajouter à $title',
      child: Container(
        constraints: const BoxConstraints(minHeight: 60),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(
          color: c.background,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: c.border),
        ),
        child: Row(
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(color: c.tintPrimary, borderRadius: BorderRadius.circular(12)),
              child: Icon(icon, size: 20, color: c.primaryDark),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: c.textPrimary)),
                  const SizedBox(height: 2),
                  Text(subtitle,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(fontSize: 13, color: c.textSecondary)),
                ],
              ),
            ),
            const SizedBox(width: 12),
            if (_busyId == key)
              SizedBox(
                width: 20,
                height: 20,
                child: CircularProgressIndicator(
                    strokeWidth: 2.5, color: c.primaryDark, semanticsLabel: 'Création en cours'),
              )
            else
              Icon(Ionicons.addCircleOutline, size: 22, color: c.textSecondary),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final insets = ScreenInsets.of(context);
    // La feuille fait au plus 80 % de l'écran (poignée et titre compris).
    final maxHeight = MediaQuery.sizeOf(context).height * 0.8 - 77 - insets.bottom - 22;
    return PopScope(
      canPop: _busyId == null,
      child: ConstrainedBox(
        constraints: BoxConstraints(maxHeight: maxHeight > 200 ? maxHeight : 200),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('L’IA tire 3 cartes de cette réponse. Où les ranger ?',
                style: TextStyle(fontSize: 14, height: 20 / 14, color: c.textSecondary)),
            if (_error != null) ...[
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
            Flexible(
              child: SingleChildScrollView(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    _choice(null, 'Notes de l’assistant', 'Un cours rassemblant tes cartes du chat',
                        Ionicons.sparklesOutline),
                    if (_courses == null)
                      Padding(
                        padding: const EdgeInsets.only(top: 8 + 16, bottom: 16),
                        child: Center(
                          child: SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(
                                strokeWidth: 2.5, color: c.primaryDark, semanticsLabel: 'Chargement de tes cours'),
                          ),
                        ),
                      )
                    else
                      for (final course in _courses!) ...[
                        const SizedBox(height: 8),
                        _choice(course['id'], '${course['nom'] ?? ''}', 'Ajouter à ce cours',
                            Ionicons.bookOutline),
                      ],
                  ],
                ),
              ),
            ),
            const SizedBox(height: 12),
            Semantics(
              button: true,
              enabled: _busyId == null,
              label: 'Annuler',
              excludeSemantics: true,
              child: GestureDetector(
                behavior: HitTestBehavior.opaque,
                onTap: _busyId == null ? _close : null,
                child: SizedBox(
                  height: 48,
                  child: Center(
                    child: Text('Annuler',
                        style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: c.textSecondary)),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
