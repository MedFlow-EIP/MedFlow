import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:ionicons/ionicons.dart';

import '../navigation/nav.dart';
import '../services/api.dart';
import '../theme/theme_controller.dart';
import '../utils/app_alert.dart';
import '../utils/course_documents.dart';
import '../utils/offline.dart';
import '../utils/revision_sheet.dart';
import '../widgets/course/course_content.dart';
import '../widgets/course/edit_course_sheet.dart';
import '../widgets/course/layout.dart';
import '../widgets/insets.dart';
import '../widgets/offline_banner.dart';
import '../widgets/report_error_sheet.dart';
import '../widgets/ui.dart';

// Copie de components/screens/CourseDetail.tsx.

String _formatDate(Object? iso) {
  if (iso is! String || iso.isEmpty) return '';
  final date = DateTime.tryParse(iso);
  return date == null ? '' : DateFormat('d MMM', 'fr_FR').format(date);
}

class CourseDetailScreen extends StatefulWidget {
  const CourseDetailScreen({super.key});

  @override
  State<CourseDetailScreen> createState() => _CourseDetailScreenState();
}

class _CourseDetailScreenState extends State<CourseDetailScreen> with FocusRefresh<CourseDetailScreen> {
  Map<String, dynamic>? _course;
  bool _loading = true;
  CourseTab _tab = CourseTab.resume;
  bool _offline = false;
  bool _notFound = false;
  bool _exporting = false;
  bool _openingSource = false;

  // La fenêtre de modification est une page : à sa fermeture, le cours n'est
  // pas rechargé (en RN, une Modal ne déclenche pas useFocusEffect). Les
  // feuilles et dialogues ne déclenchent pas onFocus.
  bool _skipNextFocus = false;

  final _exportKey = GlobalKey();
  final _sourceKey = GlobalKey();

  // Lu au premier affichage (onFocus), puis gardé : utilisable après un await.
  late final String _courseId = '${routeParams(context)['courseId'] ?? ''}';

  @override
  void onFocus() {
    if (_skipNextFocus) {
      _skipNextFocus = false;
      return;
    }
    _loadCourse();
  }

  void _alert(String title, String message) {
    appAlert(title, message);
  }

  Future<void> _openSource() async {
    final course = _course;
    if (Api.currentUser == null || course == null || !_truthy(course['source_name']) || _openingSource) return;
    final origin = shareOrigin(_sourceKey.currentContext);
    setState(() => _openingSource = true);
    try {
      await openCourseDocument(
        courseId: _courseId,
        sourceName: '${course['source_name']}',
        sourceMime: course['source_mime'] as String?,
        origin: origin,
      );
    } catch (_) {
      _alert('Ouverture impossible', 'Vérifie ta connexion puis réessaie.');
    } finally {
      if (mounted) setState(() => _openingSource = false);
    }
  }

  // Fiche PDF (F51) : marche aussi hors ligne, depuis la copie du cours.
  Future<void> _exportSheet() async {
    final course = _course;
    if (course == null || _exporting) return;
    setState(() => _exporting = true);
    try {
      await shareRevisionSheet(course, context: _exportKey.currentContext);
    } catch (_) {
      _alert('Fiche indisponible', 'Impossible de créer le PDF. Réessaie dans un instant.');
    } finally {
      if (mounted) setState(() => _exporting = false);
    }
  }

  Future<void> _loadCourse() async {
    final user = Api.currentUser;
    final courseId = _courseId;
    try {
      setState(() => _loading = true);
      if (user == null) return;

      final res = await Api.get('/api/course/$courseId');
      if (res.statusCode == 404) {
        if (mounted) setState(() => _notFound = true);
        return;
      }
      if (res.statusCode < 200 || res.statusCode >= 300) throw Exception('HTTP ${res.statusCode}');

      final data = decodeBody(res);
      if (data is! Map) throw Exception('Réponse illisible');
      if (mounted) {
        setState(() {
          _course = data.cast<String, dynamic>();
          _offline = false;
        });
      }
      saveOffline(user.uid, courseCacheName(courseId), data);
    } catch (e) {
      // Pas de réseau (ou serveur indisponible) : on relit la copie locale.
      final cached = user != null ? await readOffline(user.uid, courseCacheName(courseId)) : null;
      if (cached is Map) {
        if (mounted) {
          setState(() {
            _course = cached.cast<String, dynamic>();
            _offline = true;
          });
        }
      } else {
        debugPrint('$e');
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _edit(List flashcards) {
    final course = _course!;
    _skipNextFocus = true;
    showEditCourseSheet(
      context,
      courseId: _courseId,
      title: '${course['nom'] ?? ''}',
      flashcards: flashcards,
      tags: course['tags'] is List ? [for (final t in course['tags'] as List) '$t'] : const [],
      onSaved: (updated) {
        if (updated is! Map) return;
        if (mounted) setState(() => _course = updated.cast<String, dynamic>());
        final uid = Api.currentUser?.uid;
        if (uid != null) saveOffline(uid, courseCacheName(_courseId), updated);
      },
    );
  }

  void _report() {
    final course = _course!;
    showReportErrorSheet(
      context,
      ReportTarget(
        kind: _tab == CourseTab.resume
            ? 'summary'
            : _tab == CourseTab.flashcards
                ? 'flashcard'
                : 'quiz',
        courseId: _courseId,
        excerpt:
            '${course['nom']} · ${_tab == CourseTab.resume ? 'Résumé' : _tab == CourseTab.flashcards ? 'Flashcards' : 'Quiz'}',
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final insets = ScreenInsets.of(context);
    final course = _course;

    if (_loading) {
      return Scaffold(
        backgroundColor: c.background,
        body: Center(
          child: CircularProgressIndicator(color: c.primaryDark, semanticsLabel: 'Chargement du cours'),
        ),
      );
    }

    if (course == null) {
      // Supprimé (404) ou pas de réseau sans copie hors ligne : jamais d'écran vide.
      return Scaffold(
        backgroundColor: c.background,
        body: _notFound
            ? StateView(
                icon: Ionicons.document_outline,
                tone: Tone.neutral,
                title: 'Cours introuvable',
                subtitle: 'Il a peut-être été supprimé.',
                primary: StateAction('Retour', () => Nav.goBack()),
                onClose: () => Nav.goBack(),
              )
            : StateView(
                icon: Ionicons.cloud_offline_outline,
                tone: Tone.neutral,
                title: 'Impossible de charger le cours',
                subtitle: 'Vérifie ta connexion puis réessaie.',
                primary: StateAction('Réessayer', _loadCourse),
                onClose: () => Nav.goBack(),
              ),
      );
    }

    final flashcards = course['flashcards'] is List ? course['flashcards'] as List : const [];
    final quiz = course['quiz'] is List ? course['quiz'] as List : const [];
    final tags = course['tags'] is List ? course['tags'] as List : const [];
    final meta = [
      _formatDate(course['created_at']),
      '${flashcards.length} flashcards',
      quiz.isNotEmpty ? '1 quiz' : '',
    ].where((s) => s.isNotEmpty).join(' · ');

    return Scaffold(
      backgroundColor: c.background,
      body: SingleChildScrollView(
        padding: EdgeInsets.fromLTRB(20, insets.top, 20, insets.bottom + 24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: gapped([
            // HEADER
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: gapped([
                _HeaderButton(
                  label: 'Retour',
                  onTap: () => Nav.goBack(),
                  child: Icon(Ionicons.arrow_back, size: 22, color: c.textPrimary),
                ),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: gapped([
                      Semantics(
                        header: true,
                        child: Text(
                          '${course['nom'] ?? ''}',
                          style: TextStyle(
                            fontSize: 21,
                            height: 27 / 21,
                            fontWeight: FontWeight.w700,
                            color: c.textPrimary,
                          ),
                        ),
                      ),
                      Row(
                        children: [
                          Icon(Ionicons.document_text, size: 14, color: c.textSecondary),
                          const SizedBox(width: 6),
                          Expanded(
                            child: Text(meta,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: TextStyle(fontSize: 13, color: c.textSecondary)),
                          ),
                        ],
                      ),
                      if (tags.isNotEmpty)
                        Padding(
                          padding: const EdgeInsets.only(top: 4),
                          child: Wrap(
                            spacing: 6,
                            runSpacing: 6,
                            children: [
                              for (final tag in tags)
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                  decoration: BoxDecoration(
                                    color: c.tintPrimary,
                                    borderRadius: BorderRadius.circular(999),
                                  ),
                                  child: Text('$tag',
                                      style:
                                          TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: c.primaryText)),
                                ),
                            ],
                          ),
                        ),
                    ], 4),
                  ),
                ),
                _HeaderButton(
                  key: _exportKey,
                  label: 'Exporter la fiche de révision en PDF',
                  onTap: _exporting ? null : _exportSheet,
                  child: _exporting
                      ? _SmallSpinner(color: c.primaryDark)
                      : Icon(Ionicons.document_attach_outline, size: 21, color: c.textPrimary),
                ),
                // Hors ligne : modification impossible, le bouton est masqué.
                if (!_offline)
                  _HeaderButton(
                    label: 'Modifier le cours',
                    onTap: () => _edit(flashcards),
                    child: Icon(Ionicons.create_outline, size: 21, color: c.textPrimary),
                  ),
              ], 12, axis: Axis.horizontal),
            ),

            if (_offline) const OfflineBanner(),

            if (_truthy(course['source_name']))
              Tappable(
                key: _sourceKey,
                onTap: _openingSource ? null : _openSource,
                semanticLabel: 'Ouvrir le document d\'origine ${course['source_name']}',
                child: Container(
                  constraints: const BoxConstraints(minHeight: 52),
                  padding: const EdgeInsets.symmetric(horizontal: 14),
                  decoration: BoxDecoration(
                    color: c.surface,
                    border: Border.all(color: c.border),
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: ExcludeSemantics(
                    child: Row(
                      children: gapped([
                        _openingSource
                            ? _SmallSpinner(color: c.primaryDark)
                            : Icon(Ionicons.document_text_outline, size: 20, color: c.primaryDark),
                        Expanded(
                          child: Text('${course['source_name']}',
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: c.textPrimary)),
                        ),
                        Text(formatBytes(course['source_size'] as num?),
                            style: TextStyle(fontSize: 13, color: c.textSecondary)),
                        Icon(Ionicons.open_outline, size: 18, color: c.textSecondary),
                      ], 10, axis: Axis.horizontal),
                    ),
                  ),
                ),
              ),

            CourseTabs(value: _tab, onChange: (t) => setState(() => _tab = t)),

            // « Réviser ce cours » toujours visible sous les onglets
            Tappable(
              onTap: () => Nav.navigate('Revision', {'courseId': _courseId}),
              semanticLabel: 'Réviser ce cours',
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 15),
                decoration: BoxDecoration(color: c.action, borderRadius: BorderRadius.circular(14)),
                child: ExcludeSemantics(
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Ionicons.flash_outline, size: 20, color: c.onAction),
                      const SizedBox(width: 10),
                      Flexible(
                        child: Text('Réviser ce cours',
                            style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: c.onAction)),
                      ),
                    ],
                  ),
                ),
              ),
            ),

            _OutlineButton(
              icon: Ionicons.medkit_outline,
              label: 'Cas clinique sur ce cours',
              onTap: () => Nav.navigate('ClinicalCases', {'courseId': _courseId}),
            ),

            if (_tab == CourseTab.resume) SummaryCard(html: '${course['summary'] ?? ''}'),

            if (_tab == CourseTab.flashcards && flashcards.isNotEmpty)
              _OutlineButton(
                icon: Ionicons.albums_outline,
                label: 'Réviser ces flashcards',
                onTap: () => Nav.navigate('FlashcardReview', {'courseId': _courseId}),
              ),
            if (_tab == CourseTab.flashcards) FlashcardList(cards: flashcards),

            if (_tab == CourseTab.quiz)
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                decoration: BoxDecoration(color: c.tintPrimary, borderRadius: BorderRadius.circular(14)),
                child: Row(
                  children: [
                    Icon(Ionicons.flash_outline, size: 18, color: c.primaryText),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        'Corrigé du quiz. Pour t’entraîner, appuie sur « Réviser ce cours ».',
                        style:
                            TextStyle(fontSize: 13, height: 18 / 13, fontWeight: FontWeight.w500, color: c.primaryText),
                      ),
                    ),
                  ],
                ),
              ),
            if (_tab == CourseTab.quiz) QuizList(questions: quiz, mode: QuizListMode.key),

            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Tappable(
                onTap: _report,
                semanticLabel: 'Signaler une erreur dans ce cours',
                child: ConstrainedBox(
                  constraints: const BoxConstraints(minHeight: 44),
                  child: ExcludeSemantics(
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Ionicons.flag_outline, size: 16, color: c.textSecondary),
                        const SizedBox(width: 6),
                        Flexible(
                          child: Text(
                            'Signaler une erreur dans ce cours',
                            style: TextStyle(
                              fontSize: 14,
                              color: c.textSecondary,
                              decoration: TextDecoration.underline,
                              decorationColor: c.textSecondary,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ], 16),
        ),
      ),
    );
  }
}

/// Valeur « vraie » au sens JavaScript (`!!value`).
bool _truthy(Object? v) => v != null && v != false && v != '' && v != 0;

/// Bouton rond de l'en-tête (44 px, bordure) : retour, fiche PDF, modifier.
class _HeaderButton extends StatelessWidget {
  final String label;
  final VoidCallback? onTap;
  final Widget child;
  const _HeaderButton({super.key, required this.label, required this.onTap, required this.child});

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Tappable(
      onTap: onTap,
      semanticLabel: label,
      child: Container(
        width: 44,
        height: 44,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: c.surface,
          shape: BoxShape.circle,
          border: Border.all(color: c.border),
        ),
        child: child,
      ),
    );
  }
}

/// Bouton à bordure (« Cas clinique sur ce cours », « Réviser ces flashcards »).
class _OutlineButton extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  const _OutlineButton({required this.icon, required this.label, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Tappable(
      onTap: onTap,
      child: Container(
        constraints: const BoxConstraints(minHeight: 50),
        decoration: BoxDecoration(
          color: c.surface,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: c.primaryDark, width: 1.5),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, size: 20, color: c.primaryText),
            const SizedBox(width: 8),
            Flexible(
              child: Text(label, style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: c.primaryText)),
            ),
          ],
        ),
      ),
    );
  }
}

/// ActivityIndicator size="small".
class _SmallSpinner extends StatelessWidget {
  final Color color;
  const _SmallSpinner({required this.color});

  @override
  Widget build(BuildContext context) =>
      SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2.5, color: color));
}
