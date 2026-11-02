import 'package:flutter/material.dart';
import 'package:ionicons/ionicons.dart';

import '../../navigation/nav.dart';
import '../../services/api.dart';
import '../../theme/theme_controller.dart';
import '../../utils/reminders.dart';
import '../demo_course_button.dart';
import '../ui.dart';

typedef _Today = ({
  int questions,
  int flashcards,
  List<Map<String, dynamic>> courses,
  int totalCourses,
  Map<String, dynamic>? exam,
});

String _plural(int n, String word) => '$n $word${n > 1 ? 's' : ''}';

Future<dynamic> _getJson(String path) async {
  try {
    final res = await Api.get(path);
    return res.statusCode >= 200 && res.statusCode < 300 ? decodeBody(res) : null;
  } catch (_) {
    return null;
  }
}

/// Ce que l'étudiant vient faire chaque jour, en tête de l'accueil : réviser
/// les cartes du jour, voir son prochain examen et retrouver ses cours.
class TodayCard extends StatefulWidget {
  /// Écart au-dessus de la carte, appliqué seulement quand elle s'affiche
  /// (le `gap` de la ScrollView RN ignore les composants qui ne rendent rien).
  final EdgeInsetsGeometry margin;
  const TodayCard({super.key, this.margin = EdgeInsets.zero});

  @override
  State<TodayCard> createState() => _TodayCardState();
}

class _TodayCardState extends State<TodayCard> with FocusRefresh<TodayCard> {
  _Today? _today;
  int _load = 0;

  @override
  String? get tabName => 'Home';

  @override
  void onFocus() => _refresh();

  Future<void> _refresh() async {
    final token = ++_load;
    if (Api.currentUser == null) return;
    final results = await Future.wait([
      _getJson('/api/revision/due'),
      _getJson('/api/flashcards/due'),
      _getJson('/api/dashboard?per_page=100'),
      _getJson('/api/exams'),
    ]);
    final [due, cards, dashboard, exams] = results;
    if (!mounted || token != _load || dashboard is! Map) return;
    final courses = dashboard['cours'] is List
        ? (dashboard['cours'] as List).whereType<Map>().map((m) => m.cast<String, dynamic>()).toList()
        : <Map<String, dynamic>>[];
    final sorted = [...courses]..sort((a, b) => '${b['created_at'] ?? ''}'.compareTo('${a['created_at'] ?? ''}'));
    final examList = exams is Map && exams['exams'] is List ? (exams['exams'] as List).whereType<Map>() : null;
    final total = dashboard['stats'] is Map ? (dashboard['stats'] as Map)['cours'] : null;
    setState(() {
      _today = (
        questions: due is Map && due['count'] is num ? (due['count'] as num).toInt() : 0,
        flashcards: cards is Map && cards['total_due'] is num ? (cards['total_due'] as num).toInt() : 0,
        courses: sorted.take(3).toList(),
        totalCourses: total is num ? total.toInt() : courses.length,
        exam: examList
            ?.where((e) => e['days_left'] is num && (e['days_left'] as num) >= 0)
            .map((e) => e.cast<String, dynamic>())
            .firstOrNull,
      );
    });
  }

  BoxDecoration _cardDecoration(BuildContext context) {
    final c = context.colors;
    return BoxDecoration(
      color: c.surface,
      borderRadius: BorderRadius.circular(20),
      border: Border.all(color: c.border),
    );
  }

  Widget _title(BuildContext context, String text) => Semantics(
        header: true,
        child:
            Text(text, style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: context.colors.textPrimary)),
      );

  @override
  Widget build(BuildContext context) {
    final today = _today;
    if (today == null) return const SizedBox.shrink();
    return Padding(
      padding: widget.margin,
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: _cardDecoration(context),
        child: today.totalCourses == 0 ? _empty(context) : _content(context, today),
      ),
    );
  }

  // Pas encore de cours : un seul chemin, importer (ou essayer l'exemple).
  Widget _empty(BuildContext context) {
    final c = context.colors;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _title(context, 'Commence ici'),
        const SizedBox(height: 12),
        Text(
          'Importe un cours (PDF, photo, Word) : l’IA en tire un résumé, des flashcards et des questions.',
          style: TextStyle(fontSize: 14, height: 20 / 14, color: c.textSecondary),
        ),
        const SizedBox(height: 12),
        Tappable(
          onTap: () => Nav.navigate('UploadCourse'),
          child: Container(
            constraints: const BoxConstraints(minHeight: 52),
            decoration: BoxDecoration(color: c.action, borderRadius: BorderRadius.circular(16)),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Ionicons.cloudUploadOutline, size: 20, color: c.onAction),
                const SizedBox(width: 8),
                Flexible(
                  child: Text('Importer mon premier cours',
                      style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: c.onAction)),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 12),
        const DemoCourseButton(),
      ],
    );
  }

  Widget _content(BuildContext context, _Today today) {
    final c = context.colors;
    final hasQuestions = today.questions > 0;
    final exam = today.exam;
    final examLabel = exam != null ? countdownLabel((exam['days_left'] as num).toInt()) : '';
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _title(context, 'Aujourd’hui'),
        const SizedBox(height: 12),
        Tappable(
          onTap: () => Nav.navigate('Revision'),
          semanticLabel: hasQuestions
              ? 'Réviser, ${_plural(today.questions, 'question')} aujourd’hui'
              : 'Tout est révisé, s’entraîner quand même',
          child: ExcludeSemantics(
            child: Container(
              constraints: const BoxConstraints(minHeight: 52),
              decoration: BoxDecoration(
                color: hasQuestions ? c.action : c.tintSuccess,
                borderRadius: BorderRadius.circular(16),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(hasQuestions ? Ionicons.flash : Ionicons.checkmarkCircle,
                      size: 20, color: hasQuestions ? c.onAction : c.successText),
                  const SizedBox(width: 8),
                  Flexible(
                    child: Text(
                      hasQuestions
                          ? 'Réviser · ${_plural(today.questions, 'question')}'
                          : 'Tout est révisé pour aujourd’hui',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w700,
                        color: hasQuestions ? c.onAction : c.successText,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
        const SizedBox(height: 12),
        // Les deux pastilles prennent la hauteur de la plus haute (alignItems: stretch).
        IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Expanded(
                child: _chip(
                  context,
                  icon: Ionicons.albumsOutline,
                  text: 'Flashcards · ${today.flashcards}',
                  label: 'Flashcards, ${_plural(today.flashcards, 'carte')} à revoir',
                  onTap: () => Nav.navigate('FlashcardReview'),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: _chip(
                  context,
                  icon: Ionicons.calendarOutline,
                  text: exam != null ? '${exam['title'] ?? ''} · $examLabel' : 'Mes examens',
                  label: exam != null ? 'Prochain examen : ${exam['title'] ?? ''}, $examLabel' : 'Ajouter mes examens',
                  onTap: () => Nav.navigate('Exams'),
                  singleLine: true,
                ),
              ),
            ],
          ),
        ),
        // marginTop 4 + gap 12, moins les 8 px de zone tactile élargie du lien (hitSlop).
        const SizedBox(height: 8),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Flexible(
              child: Text('Mes derniers cours',
                  style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: c.textSecondary)),
            ),
            Tappable(
              onTap: () => Nav.navigate('MainTabs', {'screen': 'Dashboard'}),
              semanticLabel: 'Voir mes ${today.totalCourses} cours',
              child: ExcludeSemantics(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(8, 8, 0, 8),
                  child: Text('Tout voir (${today.totalCourses})',
                      style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: c.primaryText)),
                ),
              ),
            ),
          ],
        ),
        for (final (i, course) in today.courses.indexed) ...[
          // gap 12, moins les 8 px de zone tactile du lien au-dessus pour le premier.
          SizedBox(height: i == 0 ? 4 : 12),
          Tappable(
            onTap: () => Nav.navigate('CourseDetail', {'courseId': course['id']}),
            semanticLabel: 'Ouvrir le cours ${course['nom'] ?? ''}',
            child: ExcludeSemantics(
              child: Container(
                constraints: const BoxConstraints(minHeight: 44),
                padding: const EdgeInsets.symmetric(horizontal: 12),
                decoration: BoxDecoration(color: c.background, borderRadius: BorderRadius.circular(12)),
                child: Row(
                  children: [
                    Icon(Ionicons.documentTextOutline, size: 18, color: c.primaryDark),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text('${course['nom'] ?? ''}',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(fontSize: 15, color: c.textPrimary)),
                    ),
                    const SizedBox(width: 10),
                    Icon(Ionicons.chevronForward, size: 16, color: c.textSecondary),
                  ],
                ),
              ),
            ),
          ),
        ],
      ],
    );
  }

  Widget _chip(
    BuildContext context, {
    required IconData icon,
    required String text,
    required String label,
    required VoidCallback onTap,
    bool singleLine = false,
  }) {
    final c = context.colors;
    return Tappable(
      onTap: onTap,
      semanticLabel: label,
      child: ExcludeSemantics(
        child: Container(
          constraints: const BoxConstraints(minHeight: 44),
          padding: const EdgeInsets.symmetric(horizontal: 12),
          decoration: BoxDecoration(color: c.tintPrimary, borderRadius: BorderRadius.circular(14)),
          child: Row(
            children: [
              Icon(icon, size: 18, color: c.primaryText),
              const SizedBox(width: 6),
              Flexible(
                child: Text(text,
                    maxLines: singleLine ? 1 : null,
                    overflow: singleLine ? TextOverflow.ellipsis : null,
                    style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: c.primaryText)),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
