import 'dart:async';
import 'dart:math' as math;

import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:intl/intl.dart';
import 'package:ionicons/ionicons.dart';

import '../navigation/nav.dart';
import '../services/api.dart';
import '../theme/theme_controller.dart';
import '../utils/app_alert.dart';
import '../utils/offline.dart';
import '../utils/reminders.dart';
import '../widgets/date_picker_sheet.dart' show formatLongDate;
import '../widgets/demo_course_button.dart';
import '../widgets/insets.dart';
import '../widgets/offline_banner.dart';
import '../widgets/ui.dart';

// Onglet « Cours » (copie de DashboardScreen.tsx) : mes cours, les révisions
// de la semaine, l'examen à venir et les chiffres clés.

class _Stats {
  final int totalCourses;
  final int totalFlashcards;
  final int totalSessions;
  final double? avgScore;
  const _Stats({
    this.totalCourses = 0,
    this.totalFlashcards = 0,
    this.totalSessions = 0,
    this.avgScore,
  });
}

/// Cours avec des cartes dues (un jour donné du graphique).
class _DueGroup {
  final dynamic id;
  final String nom;
  int count;
  _DueGroup(this.id, this.nom, this.count);
}

/// Espacement façon `gap` + marges négatives de la feuille de style RN.
class _Spaced {
  final Widget child;
  final double top;
  final double bottom;
  const _Spaced(this.child, {this.top = 0, this.bottom = 0});
}

List<Widget> _withGap(double gap, List<_Spaced> items) {
  final out = <Widget>[];
  for (var i = 0; i < items.length; i++) {
    if (i > 0) out.add(SizedBox(height: math.max(0, gap + items[i - 1].bottom + items[i].top)));
    out.add(items[i].child);
  }
  return out;
}

const _barMaxHeight = 84.0;

int _int(dynamic v) => v is num ? v.toInt() : 0;

String _formatShortDate(dynamic iso) {
  if (iso is! String || iso.isEmpty) return '';
  final date = DateTime.tryParse(iso);
  return date == null ? '' : DateFormat('d MMM', 'fr_FR').format(date.toLocal());
}

String _plural(int n, String word) => '$n $word${n > 1 ? 's' : ''}';

// Tri des spécialités comme localeCompare(…, 'fr') : sans tenir compte des
// accents ni de la casse.
const _accents = {
  'à': 'a', 'â': 'a', 'ä': 'a', 'á': 'a', 'ã': 'a', 'å': 'a', 'ç': 'c', //
  'é': 'e', 'è': 'e', 'ê': 'e', 'ë': 'e', 'î': 'i', 'ï': 'i', 'í': 'i', 'ì': 'i',
  'ô': 'o', 'ö': 'o', 'ó': 'o', 'ò': 'o', 'õ': 'o', 'ù': 'u', 'û': 'u', 'ü': 'u', 'ú': 'u',
  'ÿ': 'y', 'ñ': 'n', 'œ': 'oe', 'æ': 'ae',
};

String _fold(String s) => s.toLowerCase().split('').map((ch) => _accents[ch] ?? ch).join();

int _compareFr(String a, String b) {
  final base = _fold(a).compareTo(_fold(b));
  if (base != 0) return base;
  final accents = a.toLowerCase().compareTo(b.toLowerCase());
  return accents != 0 ? accents : b.compareTo(a);
}

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> with FocusRefresh<DashboardScreen> {
  @override
  String? get tabName => 'Dashboard';

  List<Map<String, dynamic>> _courses = [];
  _Stats _stats = const _Stats();
  List<Map<String, dynamic>> _forecast = [];
  int _selectedDay = 0;
  List<Map<String, dynamic>> _dueToday = [];
  bool _offline = false;
  Map<String, dynamic>? _nextExam;
  int? _flashcardsDue;
  // Filtre « Mes cours » par spécialité (null = tous).
  String? _tagFilter;

  @override
  void onFocus() {
    if (Api.currentUser == null) return;
    _loadCourses();
  }

  void _set(VoidCallback fn) {
    if (mounted) setState(fn);
  }

  static List<Map<String, dynamic>> _maps(dynamic list) =>
      list is List ? list.whereType<Map>().map((m) => m.cast<String, dynamic>()).toList() : [];

  void _applyDashboard(dynamic data) {
    if (data is! Map) return;
    if (data['cours'] is List) {
      _courses = _maps(data['cours']);
    }
    final stats = data['stats'];
    if (stats is Map) {
      final detailed = stats['detailed_sessions'];
      _stats = _Stats(
        totalCourses: _int(stats['cours']),
        totalFlashcards: _int(stats['flashcards']),
        totalSessions: _int(stats['sessions']),
        avgScore: detailed is Map && detailed['avg_score'] is num ? (detailed['avg_score'] as num).toDouble() : null,
      );
    }
  }

  /// Corps JSON d'une réponse, comme `res.json()` : lève une erreur s'il n'est pas lisible.
  static dynamic _json(http.Response res) {
    final body = decodeBody(res);
    if (body == null) throw const FormatException('Réponse illisible');
    return body;
  }

  // Télécharge en arrière-plan le contenu de chaque cours pour qu'il reste
  // consultable hors ligne, même s'il n'a jamais été ouvert.
  Future<void> _prefetchCourses(User user, List<Map<String, dynamic>> list) async {
    for (final course in list) {
      try {
        final res = await Api.get('/api/course/${course['id']}');
        if (res.statusCode >= 200 && res.statusCode < 300) {
          await saveOffline(user.uid, courseCacheName('${course['id']}'), _json(res));
        }
      } catch (_) {
        return; // réseau perdu : on réessaiera au prochain affichage
      }
    }
  }

  Future<void> _loadCourses() async {
    final user = Api.currentUser;
    if (user == null) return;
    try {
      final res = await Api.get('/api/dashboard', query: {'per_page': 100});

      if (res.statusCode < 200 || res.statusCode >= 300) throw Exception('HTTP ${res.statusCode}');
      final data = _json(res);
      _set(() {
        _applyDashboard(data);
        _offline = false;
      });
      unawaited(saveOffline(user.uid, dashboardCacheName, data));
      // Réponses données hors ligne : envoyées dès que le réseau revient.
      unawaited(flushRevisionQueue(user).catchError((_) => 0));
      if (data is Map && data['cours'] is List) unawaited(_prefetchCourses(user, _maps(data['cours'])));

      // Récupère la prévision (7 jours) une seule fois : sert à la fois à
      // l'affichage et à rafraîchir le rappel de notification — best-effort,
      // ne doit jamais faire échouer le chargement du reste du Dashboard.
      try {
        final forecastData = _json(await Api.get('/api/revision/forecast', query: {'days': 7}));
        final days = forecastData is Map && forecastData['forecast'] is List
            ? _maps(forecastData['forecast'])
            : <Map<String, dynamic>>[];
        _set(() => _forecast = days);
        final dueTodayCount = days.isNotEmpty && days[0]['count'] is num ? _int(days[0]['count']) : 0;
        await scheduleRevisionReminder(dueTodayCount);
      } catch (_) {
        // Silencieux : la prévision n'est pas critique pour l'écran.
      }

      // Flashcards à revoir (répétition espacée) : best-effort.
      try {
        final fcData = _json(await Api.get('/api/flashcards/due'));
        _set(() => _flashcardsDue = fcData is Map && fcData['total_due'] is num ? _int(fcData['total_due']) : null);
      } catch (_) {
        // Silencieux : le compteur est un bonus.
      }

      // Prochain examen (et rappels à jour) : best-effort aussi.
      try {
        final examsData = _json(await Api.get('/api/exams'));
        final exams = examsData is Map ? _maps(examsData['exams']) : <Map<String, dynamic>>[];
        _set(() => _nextExam = exams.where((e) => e['days_left'] is num && _int(e['days_left']) >= 0).firstOrNull);
        unawaited(syncExamReminders(exams.map(ExamSummary.fromJson).toList()));
      } catch (_) {
        // Silencieux : la carte examen n'est pas critique.
      }

      // Cartes dues aujourd'hui, regroupées par cours sous le graphique.
      try {
        final dueData = _json(await Api.get('/api/revision/due'));
        _set(() => _dueToday = dueData is Map ? _maps(dueData['items']) : []);
      } catch (_) {
        // Silencieux : le détail du jour est un bonus.
      }
    } catch (e) {
      // Hors ligne : on affiche la dernière liste de cours connue.
      final cached = await readOffline(user.uid, dashboardCacheName);
      if (cached != null) {
        _set(() {
          _applyDashboard(cached);
          _offline = true;
        });
      } else {
        debugPrint('$e');
      }
    }
  }

  Future<void> _deleteCourse(dynamic courseId) async {
    final user = Api.currentUser;
    if (user == null) return;
    try {
      await Api.delete('/api/course/$courseId');

      _set(() => _courses = _courses.where((c) => c['id'] != courseId).toList());
      unawaited(removeOffline(user.uid, courseCacheName('$courseId')));
    } catch (e) {
      debugPrint('$e');
    }
  }

  void _confirmDeleteCourse(Map<String, dynamic> course) {
    appAlert('Supprimer le cours', '« ${course['nom']} » et ses flashcards seront supprimés.', [
      const AlertButton('Annuler', style: AlertStyle.cancel),
      AlertButton('Supprimer', style: AlertStyle.destructive, onPress: () => _deleteCourse(course['id'])),
    ]);
  }

  List<_DueGroup> get _dueByCourse {
    final groups = <dynamic, _DueGroup>{};
    for (final item in _dueToday) {
      final group =
          groups.putIfAbsent(item['course_id'], () => _DueGroup(item['course_id'], '${item['course_nom'] ?? ''}', 0));
      group.count += 1;
    }
    return groups.values.toList();
  }

  String _dayLabel(dynamic date, int idx) {
    if (idx == 0) return 'Auj.';
    final d = DateTime.tryParse('${date}T12:00:00');
    if (d == null) return '';
    final label = DateFormat('E', 'fr_FR').format(d).replaceFirst('.', '');
    return label.isEmpty ? label : label[0].toUpperCase() + label.substring(1);
  }

  static String _safeLongDate(dynamic iso) {
    try {
      return formatLongDate('$iso');
    } catch (_) {
      return '';
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final insets = ScreenInsets.of(context);
    final courseDotColors = [c.primaryDark, c.warning, c.secondary, c.success, c.danger];

    if (Api.currentUser == null) {
      return ColoredBox(
        color: c.background,
        child: SizedBox.expand(
          child: Align(
            alignment: Alignment.topLeft,
            child: Text('Aucun utilisateur connecté', style: TextStyle(color: c.textPrimary)),
          ),
        ),
      );
    }

    // Aujourd'hui : on compte les mêmes cartes que la liste en dessous (nouvelles
    // cartes comprises), sinon la barre affichait 0 au-dessus de 16 cartes.
    final days = [
      for (var i = 0; i < _forecast.length; i++)
        i == 0 ? {..._forecast[0], 'count': math.max(_int(_forecast[0]['count']), _dueToday.length)} : _forecast[i],
    ];
    final maxCount = days.fold<int>(1, (m, d) => math.max(m, _int(d['count'])));
    final selected = _selectedDay < days.length ? days[_selectedDay] : null;
    // Aujourd'hui : cartes dues réelles (nouvelles cartes incluses). Jours à venir : prévision SM-2 par cours.
    final selectedGroups = _selectedDay == 0
        ? _dueByCourse
        : _maps(selected?['courses'])
            .map((g) => _DueGroup(g['course_id'], '${g['course_nom'] ?? ''}', _int(g['count'])))
            .toList();

    final kpis = [
      (icon: Ionicons.documentTextOutline, color: c.primaryDark, value: '${_stats.totalCourses}', label: 'Cours'),
      (icon: Ionicons.layersOutline, color: c.secondary, value: '${_stats.totalFlashcards}', label: 'Flashcards'),
      (icon: Ionicons.schoolOutline, color: c.success, value: '${_stats.totalSessions}', label: 'Sessions'),
      (
        icon: Ionicons.trendingUpOutline,
        color: c.warning,
        value: _stats.avgScore != null ? '${_stats.avgScore!.round()} %' : 'Aucun',
        label: 'Score',
      ),
    ];

    List<String> tagsOf(Map<String, dynamic> course) =>
        course['tags'] is List ? (course['tags'] as List).map((t) => '$t').toList() : const [];
    final allTags = {for (final course in _courses) ...tagsOf(course)}.toList()..sort(_compareFr);
    final visibleCourses =
        _tagFilter != null ? _courses.where((course) => tagsOf(course).contains(_tagFilter)).toList() : _courses;

    final sectionTitle = TextStyle(fontSize: 20, fontWeight: FontWeight.w700, color: c.textPrimary);
    Widget header(String text) => Semantics(header: true, child: Text(text, style: sectionTitle));

    final items = <_Spaced>[
      _Spaced(Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Semantics(
                  header: true,
                  child:
                      Text('Cours', style: TextStyle(fontSize: 26, fontWeight: FontWeight.w700, color: c.textPrimary)),
                ),
                const SizedBox(height: 4),
                Text('Tes cours, tes révisions et ta progression',
                    style: TextStyle(fontSize: 14, color: c.textSecondary)),
              ],
            ),
          ),
          const SizedBox(width: 10),
          CircleIconButton(
            icon: Ionicons.searchOutline,
            label: 'Rechercher dans mes cours',
            onPressed: () => Nav.navigate('Search'),
          ),
          const SizedBox(width: 10),
          CircleIconButton(
            icon: Ionicons.trendingUpOutline,
            label: 'Progression détaillée',
            onPressed: () => Nav.navigate('Progress'),
          ),
        ],
      )),
      if (_offline) const _Spaced(OfflineBanner()),
      _Spaced(
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Flexible(child: header('Mes cours')),
            Tappable(
              onTap: () => Nav.navigate('Documents'),
              semanticLabel: 'Voir mes documents importés',
              child: ExcludeSemantics(
                child: Container(
                  constraints: const BoxConstraints(minHeight: 40),
                  padding: const EdgeInsets.symmetric(horizontal: 4),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Ionicons.folderOpenOutline, size: 16, color: c.primaryText),
                      const SizedBox(width: 6),
                      Text('Mes documents',
                          style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: c.primaryText)),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
        bottom: -8,
      ),
      if (allTags.isNotEmpty)
        _Spaced(SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.only(right: 8),
          child: Row(
            children: [
              for (final (i, tag) in <String?>[null, ...allTags].indexed) ...[
                if (i > 0) const SizedBox(width: 8),
                _TagFilterChip(
                  label: tag ?? 'Tous',
                  active: _tagFilter == tag,
                  onTap: () => setState(() => _tagFilter = tag),
                ),
              ],
            ],
          ),
        )),
      if (_courses.isEmpty) ...[
        _Spaced(Text('Aucun cours importé',
            textAlign: TextAlign.center, style: TextStyle(color: c.textSecondary, fontSize: 14))),
        const _Spaced(DemoCourseButton()),
      ] else if (visibleCourses.isEmpty)
        _Spaced(Text('Aucun cours dans cette spécialité',
            textAlign: TextAlign.center, style: TextStyle(color: c.textSecondary, fontSize: 14)))
      else
        for (final course in visibleCourses)
          _Spaced(
            _CourseCard(
              course: course,
              meta: [
                tagsOf(course).isNotEmpty ? tagsOf(course).join(', ') : '',
                course['flashcards'] is num ? _plural(_int(course['flashcards']), 'flashcard') : '',
                course['quiz'] is num && course['quiz'] != 0 ? '1 quiz' : '',
                _formatShortDate(course['created_at']),
              ].where((s) => s.isNotEmpty).join(' · '),
              onOpen: () => Nav.navigate('CourseDetail', {'courseId': course['id']}),
              onDelete: () => _confirmDeleteCourse(course),
            ),
            top: -8,
          ),
      _Spaced(
        Tappable(
          onTap: () => Nav.navigate('UploadCourse'),
          child: CustomPaint(
            painter: _DashedRRectPainter(color: c.primary, strokeWidth: 1.5, radius: 16),
            child: Container(
              padding: const EdgeInsets.symmetric(vertical: 14 + 1.5, horizontal: 1.5),
              decoration: BoxDecoration(color: c.tintPrimary, borderRadius: BorderRadius.circular(16)),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Ionicons.add, size: 20, color: c.primaryText),
                  const SizedBox(width: 8),
                  Text('Importer un PDF',
                      style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: c.primaryText)),
                ],
              ),
            ),
          ),
        ),
        top: -8,
      ),
      _Spaced(header('Réviser autrement')),
      _Spaced(Tappable(
        onTap: () => Nav.navigate('Revision'),
        semanticLabel: 'Lancer une session de révision',
        child: ExcludeSemantics(
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
            decoration: BoxDecoration(color: c.action, borderRadius: BorderRadius.circular(14)),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Ionicons.flashOutline, size: 20, color: c.onAction),
                const SizedBox(width: 10),
                Text('Réviser maintenant',
                    style: TextStyle(color: c.onAction, fontSize: 16, fontWeight: FontWeight.w600)),
              ],
            ),
          ),
        ),
      )),
      _Spaced(_OutlineRowButton(
        icon: Ionicons.albumsOutline,
        title: 'Flashcards',
        hint: (_flashcardsDue ?? 0) != 0 ? '$_flashcardsDue à revoir' : 'répétition espacée',
        semanticLabel: 'Réviser les flashcards${(_flashcardsDue ?? 0) != 0 ? ', $_flashcardsDue à revoir' : ''}',
        onTap: () => Nav.navigate('FlashcardReview'),
      )),
      _Spaced(
        Row(
          children: [
            Expanded(
              child: _SecondaryChip(
                icon: Ionicons.warningOutline,
                label: 'Cartes difficiles',
                semanticLabel: 'Revoir les cartes difficiles',
                background: c.tintWarning,
                foreground: c.warningText,
                onTap: () => Nav.navigate('Revision', {'startMode': 'leeches'}),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: _SecondaryChip(
                icon: Ionicons.trophyOutline,
                label: 'Cartes maîtrisées',
                semanticLabel: 'Voir les cartes maîtrisées',
                background: c.tintSuccess,
                foreground: c.successText,
                onTap: () => Nav.navigate('Mastered'),
              ),
            ),
          ],
        ),
        top: -8,
      ),
      _Spaced(_OutlineRowButton(
        icon: Ionicons.timerOutline,
        title: 'Examen blanc',
        hint: 'chronométré, noté sur 20',
        semanticLabel: 'Lancer un examen blanc',
        onTap: () => Nav.navigate('MockExam'),
      )),
      // Prochain examen : ses cours passent en priorité dans les révisions.
      _Spaced(_ExamCard(
        exam: _nextExam,
        longDate: _nextExam != null ? _safeLongDate(_nextExam!['exam_date']) : '',
        onTap: () => Nav.navigate('Exams'),
      )),
      if (_forecast.isNotEmpty)
        _Spaced(Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: c.surface,
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: c.border),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: _withGap(16, [
              _Spaced(Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Flexible(
                    child: Text('À réviser cette semaine',
                        style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: c.textPrimary)),
                  ),
                  Text('Touche un jour',
                      style: TextStyle(fontSize: 12, fontWeight: FontWeight.w500, color: c.textSecondary)),
                ],
              )),
              _Spaced(Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  for (final (idx, day) in days.indexed)
                    _ForecastDay(
                      count: _int(day['count']),
                      label: _dayLabel(day['date'], idx),
                      selected: idx == _selectedDay,
                      barHeight:
                          _int(day['count']) == 0 ? 6 : math.max(14, (_int(day['count']) / maxCount) * _barMaxHeight),
                      onTap: () => setState(() => _selectedDay = idx),
                    ),
                ],
              )),
              if (selected != null) ...[
                _Spaced(Container(height: 1, color: c.border)),
                _Spaced(Text(
                  '${_selectedDay == 0 ? 'Aujourd’hui' : _dayLabel(selected['date'], _selectedDay)} · ${_plural(_int(selected['count']), 'carte')}',
                  style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: c.textPrimary),
                )),
                if (selectedGroups.isEmpty)
                  _Spaced(Text('Rien de prévu ce jour-là.', style: TextStyle(fontSize: 13, color: c.textSecondary)))
                else
                  for (final (i, group) in selectedGroups.indexed)
                    _Spaced(
                      _DueRow(
                        name: group.nom,
                        count: group.count,
                        dotColor: courseDotColors[i % courseDotColors.length],
                        semanticLabel:
                            '${_selectedDay == 0 ? 'Réviser' : 'S’entraîner sur'} ${group.nom}, ${_plural(group.count, 'carte')}',
                        // Jour à venir : entraînement libre, sans avancer le planning de répétition.
                        onTap: () => Nav.navigate(
                          'Revision',
                          _selectedDay == 0 ? {'courseId': group.id} : {'courseId': group.id, 'startMode': 'practice'},
                        ),
                      ),
                      top: -6,
                    ),
                if (_selectedDay != 0 && selectedGroups.isNotEmpty)
                  _Spaced(Text('Touche un cours pour t’entraîner dessus en avance.',
                      style: TextStyle(fontSize: 13, color: c.textSecondary))),
              ],
            ]),
          ),
        )),
      _Spaced(header('Ta progression')),
      _Spaced(IntrinsicHeight(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            for (final (i, kpi) in kpis.indexed) ...[
              if (i > 0) const SizedBox(width: 10),
              Expanded(
                child: Semantics(
                  label: '${kpi.label} : ${kpi.value}',
                  excludeSemantics: true,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 14),
                    decoration: BoxDecoration(
                      color: c.surface,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: c.border),
                    ),
                    child: Column(
                      children: [
                        Icon(kpi.icon, size: 20, color: kpi.color),
                        const SizedBox(height: 6),
                        Text(kpi.value,
                            textAlign: TextAlign.center,
                            style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700, color: c.textPrimary)),
                        const SizedBox(height: 6),
                        Text(kpi.label,
                            textAlign: TextAlign.center,
                            style: TextStyle(fontSize: 12, fontWeight: FontWeight.w500, color: c.textSecondary)),
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ],
        ),
      )),
    ];

    return ColoredBox(
      color: c.background,
      child: ScrollConfiguration(
        behavior: ScrollConfiguration.of(context).copyWith(scrollbars: false),
        child: SingleChildScrollView(
          padding: EdgeInsets.fromLTRB(20, insets.top, 20, insets.tabBar + 24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: _withGap(20, items),
          ),
        ),
      ),
    );
  }
}

class _TagFilterChip extends StatelessWidget {
  final String label;
  final bool active;
  final VoidCallback onTap;
  const _TagFilterChip({required this.label, required this.active, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Tappable(
      onTap: onTap,
      selected: active,
      child: Container(
        constraints: const BoxConstraints(minHeight: 40),
        alignment: Alignment.center,
        padding: const EdgeInsets.symmetric(horizontal: 14),
        decoration: BoxDecoration(
          color: active ? c.tintPrimary : c.surface,
          borderRadius: BorderRadius.circular(999),
          border: Border.all(color: active ? c.primaryDark : c.border),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 14,
            fontWeight: active ? FontWeight.w600 : FontWeight.w500,
            color: active ? c.primaryText : c.textSecondary,
          ),
        ),
      ),
    );
  }
}

class _CourseCard extends StatelessWidget {
  final Map<String, dynamic> course;
  final String meta;
  final VoidCallback onOpen;
  final VoidCallback onDelete;
  const _CourseCard({required this.course, required this.meta, required this.onOpen, required this.onDelete});

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final nom = '${course['nom'] ?? ''}';
    return Container(
      padding: const EdgeInsets.only(left: 14, right: 8, top: 14, bottom: 14),
      decoration: BoxDecoration(
        color: c.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: c.border),
      ),
      child: Row(
        children: [
          Expanded(
            child: Tappable(
              onTap: onOpen,
              semanticLabel: '$nom, $meta',
              child: ExcludeSemantics(
                child: Row(
                  children: [
                    Container(
                      width: 48,
                      height: 48,
                      decoration: BoxDecoration(color: c.tintPrimary, borderRadius: BorderRadius.circular(12)),
                      child: Icon(Ionicons.documentText, size: 22, color: c.primaryDark),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(nom,
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: c.textPrimary)),
                          const SizedBox(height: 3),
                          Text(meta, style: TextStyle(fontSize: 13, color: c.textSecondary)),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
          // Zone tactile 44 px pour la suppression.
          Tappable(
            onTap: onDelete,
            semanticLabel: 'Supprimer le cours $nom',
            child: SizedBox(
              width: 44,
              height: 44,
              child: Icon(Ionicons.trashOutline, size: 20, color: c.danger),
            ),
          ),
        ],
      ),
    );
  }
}

/// Bouton à bordure avec icône, titre et indication à droite (style `mockExamButton`).
class _OutlineRowButton extends StatelessWidget {
  final IconData icon;
  final String title;
  final String hint;
  final String semanticLabel;
  final VoidCallback onTap;
  const _OutlineRowButton({
    required this.icon,
    required this.title,
    required this.hint,
    required this.semanticLabel,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Tappable(
      onTap: onTap,
      semanticLabel: semanticLabel,
      child: ExcludeSemantics(
        child: Container(
          constraints: const BoxConstraints(minHeight: 52),
          padding: const EdgeInsets.symmetric(horizontal: 16),
          decoration: BoxDecoration(
            color: c.surface,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: c.primaryDark, width: 1.5),
          ),
          child: Row(
            children: [
              Icon(icon, size: 20, color: c.primaryText),
              const SizedBox(width: 10),
              Text(title, style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: c.primaryText)),
              const SizedBox(width: 10),
              Expanded(
                child: Text(hint, textAlign: TextAlign.right, style: TextStyle(fontSize: 13, color: c.textSecondary)),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _SecondaryChip extends StatelessWidget {
  final IconData icon;
  final String label;
  final String semanticLabel;
  final Color background;
  final Color foreground;
  final VoidCallback onTap;
  const _SecondaryChip({
    required this.icon,
    required this.label,
    required this.semanticLabel,
    required this.background,
    required this.foreground,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Tappable(
      onTap: onTap,
      semanticLabel: semanticLabel,
      child: ExcludeSemantics(
        child: Container(
          constraints: const BoxConstraints(minHeight: 44),
          decoration: BoxDecoration(color: background, borderRadius: BorderRadius.circular(12)),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, size: 16, color: foreground),
              const SizedBox(width: 6),
              Flexible(
                child: Text(label, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: foreground)),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ExamCard extends StatelessWidget {
  final Map<String, dynamic>? exam;
  final String longDate;
  final VoidCallback onTap;
  const _ExamCard({required this.exam, required this.longDate, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final exam = this.exam;
    final daysLeft = exam != null ? _int(exam['days_left']) : 0;
    final soon = exam != null && daysLeft <= 7;
    final titleStyle = TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: c.textPrimary);
    final metaStyle = TextStyle(fontSize: 13, color: c.textSecondary);
    return Tappable(
      onTap: onTap,
      semanticLabel:
          exam != null ? 'Prochain examen : ${exam['title']}, ${countdownLabel(daysLeft)}' : 'Ajouter mes examens',
      child: ExcludeSemantics(
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: c.surface,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: c.border),
          ),
          child: Row(
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(color: c.tintPrimary, borderRadius: BorderRadius.circular(12)),
                child: Icon(Ionicons.calendar, size: 20, color: c.primaryDark),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: exam != null
                      ? [
                          Text('${exam['title'] ?? ''}',
                              maxLines: 1, overflow: TextOverflow.ellipsis, style: titleStyle),
                          const SizedBox(height: 2),
                          Text('$longDate · cours prioritaires en révision',
                              maxLines: 1, overflow: TextOverflow.ellipsis, style: metaStyle),
                        ]
                      : [
                          Text('Mes examens', style: titleStyle),
                          const SizedBox(height: 2),
                          Text('Ajoute tes partiels pour réviser les bons cours en premier', style: metaStyle),
                        ],
                ),
              ),
              const SizedBox(width: 12),
              if (exam != null)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: soon ? c.tintWarning : c.tintPrimary,
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Text(countdownLabel(daysLeft),
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                        color: soon ? c.warningText : c.primaryText,
                      )),
                )
              else
                Icon(Ionicons.chevronForward, size: 18, color: c.textSecondary),
            ],
          ),
        ),
      ),
    );
  }
}

class _ForecastDay extends StatelessWidget {
  final int count;
  final String label;
  final bool selected;
  final double barHeight;
  final VoidCallback onTap;
  const _ForecastDay({
    required this.count,
    required this.label,
    required this.selected,
    required this.barHeight,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Tappable(
      onTap: onTap,
      selected: selected,
      semanticLabel: '$label : ${_plural(count, 'carte')} à réviser',
      child: ExcludeSemantics(
        child: ConstrainedBox(
          constraints: const BoxConstraints(minWidth: 40),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text('$count',
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: selected ? c.primaryText : c.textPrimary,
                  )),
              const SizedBox(height: 6),
              Container(
                width: 28,
                height: barHeight,
                decoration: BoxDecoration(
                  color: count == 0 ? c.border : (selected ? c.primaryDark : c.tintPrimaryStrong),
                  borderRadius: BorderRadius.circular(8),
                ),
              ),
              const SizedBox(height: 6),
              Text(label,
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                    color: selected ? c.primaryText : c.textSecondary,
                  )),
            ],
          ),
        ),
      ),
    );
  }
}

class _DueRow extends StatelessWidget {
  final String name;
  final int count;
  final Color dotColor;
  final String semanticLabel;
  final VoidCallback onTap;
  const _DueRow({
    required this.name,
    required this.count,
    required this.dotColor,
    required this.semanticLabel,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Tappable(
      onTap: onTap,
      semanticLabel: semanticLabel,
      child: ExcludeSemantics(
        child: Container(
          constraints: const BoxConstraints(minHeight: 44),
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          decoration: BoxDecoration(color: c.surfaceAlt, borderRadius: BorderRadius.circular(12)),
          child: Row(
            children: [
              Container(width: 10, height: 10, decoration: BoxDecoration(color: dotColor, shape: BoxShape.circle)),
              const SizedBox(width: 12),
              Expanded(
                child: Text(name, style: TextStyle(fontSize: 14, fontWeight: FontWeight.w500, color: c.textPrimary)),
              ),
              const SizedBox(width: 12),
              Text(_plural(count, 'carte'), style: TextStyle(fontSize: 13, color: c.textSecondary)),
              const SizedBox(width: 12),
              Icon(Ionicons.chevronForward, size: 18, color: c.textSecondary),
            ],
          ),
        ),
      ),
    );
  }
}

/// Bordure en pointillés (borderStyle: 'dashed' du bouton « Importer un PDF »).
class _DashedRRectPainter extends CustomPainter {
  final Color color;
  final double strokeWidth;
  final double radius;
  const _DashedRRectPainter({required this.color, required this.strokeWidth, required this.radius});

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..strokeWidth = strokeWidth
      ..style = PaintingStyle.stroke;
    final rrect = RRect.fromRectAndRadius(
      (Offset.zero & size).deflate(strokeWidth / 2),
      Radius.circular(radius - strokeWidth / 2),
    );
    final dash = strokeWidth * 3;
    final gap = strokeWidth * 2;
    for (final metric in (Path()..addRRect(rrect)).computeMetrics()) {
      var d = 0.0;
      while (d < metric.length) {
        canvas.drawPath(metric.extractPath(d, math.min(d + dash, metric.length)), paint);
        d += dash + gap;
      }
    }
  }

  @override
  bool shouldRepaint(_DashedRRectPainter old) =>
      old.color != color || old.strokeWidth != strokeWidth || old.radius != radius;
}
