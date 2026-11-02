import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:ionicons/ionicons.dart';

import '../navigation/nav.dart';
import '../services/api.dart';
import '../theme/theme_controller.dart';
import '../utils/analytics.dart';
import '../utils/app_alert.dart';
import '../widgets/insets.dart';
import '../widgets/quiz.dart';
import '../widgets/revision/common.dart';
import '../widgets/ui.dart';

const _counts = [10, 20, 40];

// Cours proposé : {id, nom, quiz?} (quiz = nombre de questions).
// Résultat : {score, total, grade, xp_gained, corrections}.

/// « 09:05 »
String formatClock(num seconds) {
  final s = math.max(0, seconds.floor());
  return '${(s ~/ 60).toString().padLeft(2, '0')}:${(s % 60).toString().padLeft(2, '0')}';
}

/// Examen blanc : quiz chronométré (1 min par question) qui mélange les cours
/// choisis, sans correction avant la fin, noté sur 20.
class MockExamScreen extends StatefulWidget {
  const MockExamScreen({super.key});

  @override
  State<MockExamScreen> createState() => _MockExamScreenState();
}

class _MockExamScreenState extends State<MockExamScreen> {
  String _phase = 'setup'; // 'setup' | 'running' | 'result'
  List<Map<String, dynamic>>? _courses;
  Set<String> _selected = {};
  int _count = 20;
  bool _busy = false;
  String? _error;

  int? _examId;
  List<Map<String, dynamic>> _questions = [];
  Map<String, String> _answers = {};
  int _endsAt = 0;
  int _remaining = 0;
  Map<String, dynamic>? _result;
  bool _submitted = false;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    // L'écran ne mène nulle part ailleurs : un seul chargement suffit (les
    // dialogues de l'examen ne doivent pas recharger les cours ni la sélection).
    _loadCourses();
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  Future<void> _loadCourses() async {
    final user = Api.currentUser;
    if (user == null) return;
    try {
      final data = await Api.getJson('/api/dashboard',
          query: {'per_page': 100}, fallback: 'Impossible de charger tes cours.');
      final cours = data is Map && data['cours'] is List ? data['cours'] as List : const [];
      final withQuiz = cours
          .whereType<Map>()
          .map((m) => Map<String, dynamic>.from(m))
          .where((c) => ((c['quiz'] as num?) ?? 0) > 0)
          .toList();
      if (!mounted) return;
      setState(() {
        _courses = withQuiz;
        _selected = {for (final c in withQuiz) '${c['id']}'};
      });
    } catch (err) {
      if (!mounted) return;
      setState(() {
        _courses = [];
        _error = errorMessage(err, 'Impossible de charger tes cours.');
      });
    }
  }

  void _setPhase(String phase) {
    if (phase != 'running') _timer?.cancel();
    setState(() => _phase = phase);
  }

  Future<void> _submit() async {
    final user = Api.currentUser;
    if (user == null || _examId == null || _submitted) return;
    _submitted = true;
    setState(() => _busy = true);
    try {
      // Réponses lues au moment de l'envoi (le chrono peut appeler submit).
      final data = await Api.postJson('/api/mock-exam/$_examId/submit', {'answers': _answers},
          fallback: 'Correction impossible.');
      if (!mounted) return;
      setState(() => _result = Map<String, dynamic>.from(data as Map));
      logEvent('mock_exam_finished');
      _setPhase('result');
    } catch (err) {
      _submitted = false;
      appAlert('Copie non envoyée', errorMessage(err, 'Réessaie dans un instant.'), [
        AlertButton('Réessayer', onPress: () => _submit()),
      ]);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  /// Chrono : calculé depuis l'heure de fin (reste juste si l'app passe en arrière-plan).
  void _startClock() {
    _timer?.cancel();
    void tick() {
      final left = ((_endsAt - DateTime.now().millisecondsSinceEpoch) / 1000).round();
      setState(() => _remaining = left);
      if (left <= 0) _submit();
    }

    tick();
    _timer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted && _phase == 'running') tick();
    });
  }

  Future<void> _start() async {
    final user = Api.currentUser;
    if (user == null || _selected.isEmpty) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final data = await Api.postJson('/api/mock-exam/start', {'count': _count, 'course_ids': [..._selected]},
          fallback: 'Impossible de lancer l’examen.');
      final examId = (data['exam_id'] as num).toInt();
      final duration = data['duration_seconds'] as num;
      final questions = (data['questions'] as List).whereType<Map>().map((m) => Map<String, dynamic>.from(m)).toList();
      if (!mounted) return;
      _submitted = false;
      logEvent('mock_exam_started');
      setState(() {
        _examId = examId;
        _questions = questions;
        _answers = {};
        _result = null;
        _endsAt = DateTime.now().millisecondsSinceEpoch + (duration * 1000).round();
        _phase = 'running';
      });
      _startClock();
    } catch (err) {
      if (mounted) setState(() => _error = errorMessage(err, 'Impossible de lancer l’examen.'));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  void _confirmSubmit() {
    final missing = _questions.length - _answers.length;
    if (missing == 0) {
      _submit();
      return;
    }
    final plural = missing > 1;
    appAlert(
      'Rendre la copie ?',
      '$missing question${plural ? 's' : ''} sans réponse ${plural ? 'compteront' : 'comptera'} comme fausse${plural ? 's' : ''}.',
      [
        const AlertButton('Continuer', style: AlertStyle.cancel),
        AlertButton('Rendre', onPress: () => _submit()),
      ],
    );
  }

  void _toggle(String id) => setState(() {
        final next = {..._selected};
        if (!next.remove(id)) next.add(id);
        _selected = next;
      });

  @override
  Widget build(BuildContext context) {
    // Quitter pendant l'examen : confirmation (croix de l'en-tête ; le geste
    // retour d'iOS est désactivé tant que l'examen tourne).
    return PopScope(
      canPop: _phase != 'running',
      onPopInvokedWithResult: (didPop, _) {
        if (didPop) return;
        appAlert('Abandonner l’examen ?', 'Ta copie ne sera pas corrigée.', [
          const AlertButton('Continuer l’examen', style: AlertStyle.cancel),
          AlertButton('Abandonner', style: AlertStyle.destructive, onPress: () => Nav.goBack()),
        ]);
      },
      child: Scaffold(
        backgroundColor: context.colors.background,
        body: _body(context),
      ),
    );
  }

  Widget _header(BuildContext context, String title, [Widget? right]) {
    final c = context.colors;
    final running = _phase == 'running';
    return Padding(
      padding: EdgeInsets.fromLTRB(20, ScreenInsets.of(context).top, 20, 12),
      child: Row(
        children: [
          CircleIconButton(
            icon: running ? Ionicons.close : Ionicons.arrow_back,
            label: running ? 'Abandonner l’examen' : 'Retour',
            onPressed: () => Navigator.of(context).maybePop(),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Semantics(
              header: true,
              child: Text(title, style: TextStyle(fontSize: 22, fontWeight: FontWeight.w700, color: c.textPrimary)),
            ),
          ),
          if (right != null) ...[const SizedBox(width: 12), right],
        ],
      ),
    );
  }

  Widget _body(BuildContext context) {
    final c = context.colors;
    final insets = ScreenInsets.of(context);

    if (_phase == 'running') {
      final urgent = _remaining <= 60;
      final clock = formatClock(_remaining);
      return Padding(
        padding: EdgeInsets.only(bottom: insets.bottom + 12),
        child: Column(
          children: [
            _header(
              context,
              'Examen blanc',
              Semantics(
                container: true,
                label: 'Temps restant $clock',
                child: ExcludeSemantics(
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    decoration: BoxDecoration(
                      color: urgent ? c.tintDanger : c.tintPrimary,
                      borderRadius: BorderRadius.circular(999),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Ionicons.time_outline, size: 16, color: urgent ? c.dangerText : c.primaryText),
                        const SizedBox(width: 6),
                        Text(clock,
                            style: TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.w700,
                              color: urgent ? c.dangerText : c.primaryText,
                              fontFeatures: const [FontFeature.tabularFigures()],
                            )),
                      ],
                    ),
                  ),
                ),
              ),
            ),
            Expanded(
              child: _busy
                  ? Align(
                      alignment: Alignment.topCenter,
                      child: Padding(
                        padding: const EdgeInsets.only(top: 60),
                        child: Spinner(large: true, color: c.primaryDark, label: 'Correction en cours'),
                      ),
                    )
                  : _questions.isEmpty
                      ? const SizedBox.shrink()
                      : QuizRunner(
                          questions: _questions,
                          answers: _answers,
                          onAnswer: (key, option) => setState(() => _answers = {..._answers, key: option}),
                          onFinish: _confirmSubmit,
                        ),
            ),
          ],
        ),
      );
    }

    final result = _result;
    if (_phase == 'result' && result != null) {
      final grade = (result['grade'] as num?) ?? 0;
      final good = grade >= 10;
      final score = (result['score'] as num?) ?? 0;
      final xp = result['xp_gained'];
      final hasXp = xp is num && xp != 0;
      final corrections = result['corrections'] is List
          ? (result['corrections'] as List).whereType<Map>().map((m) => Map<String, dynamic>.from(m)).toList()
          : <Map<String, dynamic>>[];
      return Stack(
        children: [
          Column(
            children: [
              _header(context, 'Résultat'),
              Expanded(
                child: ListView(
                  padding: EdgeInsets.fromLTRB(20, 0, 20, insets.bottom + 110),
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(vertical: 28),
                      decoration: BoxDecoration(
                        color: good ? c.tintSuccess : c.tintWarning,
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: Column(
                        children: [
                          Text('${jsNum(grade).replaceFirst('.', ',')}/20',
                              style: TextStyle(
                                fontSize: 48,
                                fontWeight: FontWeight.w800,
                                color: good ? c.successText : c.warningText,
                              )),
                          const SizedBox(height: 6),
                          Text(
                            '${jsNum(score)} bonne${score > 1 ? 's' : ''} réponse${score > 1 ? 's' : ''} '
                            'sur ${jsNum(result['total'])}${hasXp ? ' · +${jsNum(xp)} XP' : ''}',
                            style: TextStyle(fontSize: 15, fontWeight: FontWeight.w500, color: c.textPrimary),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 12 + 8),
                    Text('Corrigé', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: c.textPrimary)),
                    const SizedBox(height: 12),
                    QuizCorrection(items: corrections),
                  ],
                ),
              ),
            ],
          ),
          Positioned(
            left: 0,
            right: 0,
            bottom: 0,
            child: BottomActionBar(children: [
              BarSecondaryButton(label: 'Refaire un examen', onTap: () => _setPhase('setup')),
              BarPrimaryButton(label: 'Terminer', onTap: () => Nav.goBack()),
            ]),
          ),
        ],
      );
    }

    final courses = _courses;
    final available = (courses ?? const [])
        .where((course) => _selected.contains('${course['id']}'))
        .fold<num>(0, (n, course) => n + ((course['quiz'] as num?) ?? 0));
    final label = TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: c.textPrimary);

    final blocks = <Widget>[
      const InfoBox(
        icon: Ionicons.timer_outline,
        text:
            'Questions tirées au hasard dans tes cours, 1 minute par question. La correction arrive à la fin, avec ta note sur 20.',
      ),
      if (_error != null && _error!.isNotEmpty) InlineErrorBox(message: _error!),
      Padding(padding: const EdgeInsets.only(top: 6), child: Text('Nombre de questions', style: label)),
      Row(
        children: [
          for (var i = 0; i < _counts.length; i++) ...[
            if (i > 0) const SizedBox(width: 10),
            Expanded(child: _countChip(context, _counts[i])),
          ],
        ],
      ),
      Padding(padding: const EdgeInsets.only(top: 6), child: Text('Cours', style: label)),
      if (courses == null)
        Center(child: Spinner(color: c.primaryDark, label: 'Chargement des cours'))
      else if (courses.isEmpty)
        Text('Importe d’abord un cours pour lancer un examen blanc.',
            style: TextStyle(fontSize: 14, color: c.textSecondary))
      else
        for (final course in courses)
          CourseCheckRow(
            name: '${course['nom'] ?? ''}',
            checked: _selected.contains('${course['id']}'),
            onTap: () => _toggle('${course['id']}'),
            trailing: '${jsNum(course['quiz'])} Q',
          ),
    ];

    final disabled = _busy || _selected.isEmpty;
    return Stack(
      children: [
        Column(
          children: [
            _header(context, 'Examen blanc'),
            Expanded(
              child: ListView(
                padding: EdgeInsets.fromLTRB(20, 0, 20, insets.bottom + 110),
                children: [
                  for (var i = 0; i < blocks.length; i++) ...[
                    if (i > 0) const SizedBox(height: 12),
                    blocks[i],
                  ],
                ],
              ),
            ),
          ],
        ),
        Positioned(
          left: 0,
          right: 0,
          bottom: 0,
          child: BottomActionBar(children: [
            BarPrimaryButton(
              label: 'Commencer (${jsNum(math.min<num>(_count, available))} questions)',
              busy: _busy,
              onTap: disabled ? null : _start,
            ),
          ]),
        ),
      ],
    );
  }

  Widget _countChip(BuildContext context, int n) {
    final c = context.colors;
    final active = n == _count;
    return Semantics(
      container: true,
      inMutuallyExclusiveGroup: true,
      checked: active,
      label: '$n questions, $n minutes',
      child: Tappable(
        onTap: () => setState(() => _count = n),
        button: false,
        child: ExcludeSemantics(
          child: Container(
            padding: const EdgeInsets.symmetric(vertical: 12),
            decoration: BoxDecoration(
              color: active ? c.tintPrimary : c.surface,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: active ? c.primaryDark : c.border, width: 1.5),
            ),
            child: Column(
              children: [
                Text('$n',
                    style: TextStyle(
                        fontSize: 20, fontWeight: FontWeight.w700, color: active ? c.primaryText : c.textPrimary)),
                Text('$n min', style: TextStyle(fontSize: 12, color: active ? c.primaryText : c.textSecondary)),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
