import 'package:flutter/material.dart';
import 'package:ionicons/ionicons.dart';

import '../content/lessons.dart';
import '../models/lessons.dart';
import '../navigation/nav.dart';
import '../services/api.dart';
import '../theme/theme_controller.dart';
import '../utils/app_alert.dart';
import '../utils/reminders.dart';
import '../widgets/insets.dart';
import '../widgets/lessons/badge_unlock_modal.dart';
import '../widgets/lessons/notification_opt_in_modal.dart';
import '../widgets/lessons/steps/explanation_step.dart';
import '../widgets/lessons/steps/quick_quiz_cards_step.dart';
import '../widgets/lessons/steps/speed_challenge_step.dart';
import '../widgets/lessons/steps/swipe_cards_step.dart';
import '../widgets/lessons/steps/visual_discovery_step.dart';
import '../widgets/ui.dart';

// Copie de components/screens/LessonScreen.tsx.
//
// Paramètres de navigation : `{'path': LearningPath, 'lesson': Lesson}` (les
// Map JSON de l'API sont aussi acceptées).

class LessonScreen extends StatefulWidget {
  const LessonScreen({super.key});

  @override
  State<LessonScreen> createState() => _LessonScreenState();
}

class _LessonScreenState extends State<LessonScreen> {
  late LearningPath _path;
  late Lesson _lesson;
  late List<LessonStep> _steps;
  late int _gradedCount;
  bool _initialized = false;

  bool _showResults = false;
  int _index = 0;
  int _correctCount = 0;

  /// null = en cours de chargement, -1 = indisponible.
  int? _streak;
  List<UnlockedBadge> _newBadges = const [];
  bool _showNotifPrompt = false;
  String? _lastActivityForPrompt;

  int get _xp => _lesson.xp ?? 10;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_initialized) return;
    _initialized = true;
    final params = routeParams(context);
    _path = LearningPath.from(params['path']);
    _lesson = Lesson.from(params['lesson']);
    // Contenu propre à la leçon (et non plus le même contenu pour toutes).
    _steps = getLessonSteps(_path.id, _lesson.id, _lesson.title);
    _gradedCount = _steps.where(isGradedStep).length;
    _trackStart();
  }

  // Signal purement analytique (jamais affiché à l'utilisateur) — sert à
  // calculer le taux d'abandon commencé/terminé pour le diagnostic de
  // frictions. Fire-and-forget : un échec ici ne doit jamais bloquer la leçon.
  Future<void> _trackStart() async {
    if (Api.currentUser == null) return;
    try {
      await Api.send('POST', '/api/lessons/${_path.id}/${_lesson.id}/start');
    } catch (err) {
      debugPrint('Erreur tracking lesson_started: $err');
    }
  }

  Future<void> _complete() async {
    if (Api.currentUser == null) {
      setState(() => _streak = -1);
      return;
    }
    try {
      // C'est ICI, une fois la leçon réellement terminée (pas au tap sur
      // le node dans PathScreen), que la complétion est envoyée au
      // backend — XP, streak et badges sont calculés à ce moment précis.
      final completeRes = await Api.send('POST', '/api/lessons/${_path.id}/${_lesson.id}/complete');
      final completeData = decodeBody(completeRes);
      if (completeData == null) throw const FormatException('Réponse illisible');
      final badges = completeData is Map ? completeData['newBadges'] : null;
      if (badges is List && badges.isNotEmpty && mounted) {
        setState(() => _newBadges = badges.whereType<Map>().map(UnlockedBadge.fromJson).toList());
      }

      final res = await Api.get('/api/account');
      if (res.statusCode < 200 || res.statusCode >= 300) {
        throw Exception('HTTP ${res.statusCode}');
      }
      final data = decodeBody(res);
      if (data == null) throw const FormatException('Réponse illisible');
      final stats = data is Map ? data['stats'] : null;
      final lastActivity = stats is Map && stats['lastActivity'] is String ? stats['lastActivity'] as String : null;
      final streak = stats is Map && stats['streak'] is num ? (stats['streak'] as num).toInt() : -1;
      if (mounted) {
        setState(() {
          _lastActivityForPrompt = lastActivity;
          _streak = streak;
        });
      }
      scheduleReminderIfNeeded(lastActivity);
    } catch (err) {
      debugPrint('Erreur complétion leçon: $err');
      if (mounted) setState(() => _streak = -1);
    }
  }

  void _next([bool correct = false]) {
    final finished = _index >= _steps.length - 1;
    setState(() {
      if (correct) _correctCount += 1;
      if (!finished) {
        _index += 1;
      } else {
        _showResults = true;
      }
    });
    if (finished) _complete();
  }

  // Toute sortie en cours de leçon (croix, geste retour iOS, bouton retour
  // Android) passe par cette confirmation ; l'écran de résultats sort librement.
  void _confirmLeave() {
    appAlert('Quitter la leçon ?', 'Ta progression dans cette leçon ne sera pas enregistrée.', [
      const AlertButton('Rester', style: AlertStyle.cancel),
      AlertButton(
        'Quitter',
        style: AlertStyle.destructive,
        onPress: () {
          if (mounted) Navigator.of(context).pop();
        },
      ),
    ]);
  }

  void _quit() => Navigator.of(context).maybePop();

  void _handleFinish() => Nav.goBack();

  Future<void> _onBadgesDismissed() async {
    final hadFirstLessonBadge = _newBadges.any((b) => b.id == 'first_lesson');
    setState(() => _newBadges = const []);

    if (hadFirstLessonBadge && !(await hasSeenNotificationPrompt())) {
      if (mounted) setState(() => _showNotifPrompt = true);
    }
  }

  Future<void> _onNotifAccept() async {
    setState(() => _showNotifPrompt = false);
    await markNotificationPromptSeen();
    await enableStreakReminders(_lastActivityForPrompt);
  }

  Future<void> _onNotifDecline() async {
    setState(() => _showNotifPrompt = false);
    await markNotificationPromptSeen();
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final modalOpen = _newBadges.isNotEmpty || _showNotifPrompt;

    return PopScope(
      canPop: _showResults && !modalOpen,
      onPopInvokedWithResult: (didPop, _) {
        if (didPop) return;
        if (!_showResults) {
          _confirmLeave();
        } else if (_newBadges.isNotEmpty) {
          // onRequestClose du Modal RN.
          _onBadgesDismissed();
        } else if (_showNotifPrompt) {
          _onNotifDecline();
        }
      },
      child: Scaffold(
        backgroundColor: c.background,
        body: _showResults ? _buildResults(context) : _buildSteps(context),
      ),
    );
  }

  Widget _buildResults(BuildContext context) {
    final c = context.colors;
    final insets = ScreenInsets.of(context);
    final score = _gradedCount > 0 ? (_correctCount / _gradedCount * 100).round() : 100;
    final streak = _streak;
    final plural = _correctCount > 1 ? 's' : '';

    Widget statCard({required Color tint, required Widget icon, String? value}) => Expanded(
          child: Container(
            padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 6),
            decoration: BoxDecoration(
              color: c.surface,
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: c.border),
            ),
            child: Column(
              children: [
                Container(
                  width: 44,
                  height: 44,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(color: tint, shape: BoxShape.circle),
                  child: icon,
                ),
                if (value != null) ...[
                  const SizedBox(height: 8),
                  Text(value,
                      textAlign: TextAlign.center,
                      style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: c.textPrimary)),
                ],
              ],
            ),
          ),
        );

    return Stack(
      children: [
        Positioned.fill(
          child: Padding(
            padding: EdgeInsets.only(top: insets.top, bottom: insets.bottom),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Expanded(
                  child: Center(
                    child: SingleChildScrollView(
                      padding: const EdgeInsets.symmetric(horizontal: 20),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Container(
                            width: 104,
                            height: 104,
                            decoration: BoxDecoration(color: c.tintWarning, shape: BoxShape.circle),
                            child: Icon(Ionicons.trophy, size: 48, color: c.warning),
                          ),
                          const SizedBox(height: 8 + 12),
                          Semantics(
                            header: true,
                            child: Text('Leçon terminée !',
                                textAlign: TextAlign.center,
                                style: TextStyle(fontSize: 28, fontWeight: FontWeight.w700, color: c.textPrimary)),
                          ),
                          const SizedBox(height: 12),
                          Text(_lesson.title,
                              textAlign: TextAlign.center,
                              style: TextStyle(fontSize: 16, color: c.textSecondary)),
                          const SizedBox(height: 12 + 12),
                          IntrinsicHeight(
                            child: Row(
                              crossAxisAlignment: CrossAxisAlignment.stretch,
                              children: [
                                statCard(
                                  tint: c.tintPrimary,
                                  icon: Icon(Ionicons.star, size: 22, color: c.primaryDark),
                                  value: '+$_xp XP',
                                ),
                                const SizedBox(width: 10),
                                statCard(
                                  tint: c.tintWarning,
                                  icon: streak == null
                                      ? SizedBox(
                                          width: 20,
                                          height: 20,
                                          child: CircularProgressIndicator(
                                            strokeWidth: 2.5,
                                            color: c.warning,
                                            semanticsLabel: 'Chargement de la série',
                                          ),
                                        )
                                      : Icon(streak == -1 ? Ionicons.flame_outline : Ionicons.flame,
                                          size: 22, color: c.warning),
                                  value: streak == null ? null : (streak == -1 ? 'Série' : 'Série : ${streak}j'),
                                ),
                                const SizedBox(width: 10),
                                statCard(
                                  tint: c.tintSuccess,
                                  icon: Icon(Ionicons.checkmark_circle, size: 22, color: c.success),
                                  value: '$score %',
                                ),
                              ],
                            ),
                          ),
                          if (_gradedCount > 0) ...[
                            const SizedBox(height: 12),
                            Text(
                              '$_correctCount/$_gradedCount bonne$plural réponse$plural',
                              textAlign: TextAlign.center,
                              style: TextStyle(fontSize: 14, fontWeight: FontWeight.w500, color: c.textSecondary),
                            ),
                          ],
                        ],
                      ),
                    ),
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.fromLTRB(20, 12, 20, 12),
                  child: PrimaryButton(label: 'Continuer', onPressed: _handleFinish),
                ),
              ],
            ),
          ),
        ),
        if (_newBadges.isNotEmpty)
          Positioned.fill(child: BadgeUnlockModal(badges: _newBadges, onDismiss: _onBadgesDismissed)),
        if (_showNotifPrompt)
          Positioned.fill(
            child: NotificationOptInModal(
              visible: _showNotifPrompt,
              onAccept: _onNotifAccept,
              onDecline: _onNotifDecline,
            ),
          ),
      ],
    );
  }

  Widget _buildSteps(BuildContext context) {
    final c = context.colors;
    final insets = ScreenInsets.of(context);
    final step = _steps[_index];
    final progress = _index / _steps.length * 100;

    final Widget stepWidget = switch (step) {
      ExplanationStepData s => ExplanationStep(
          title: s.title,
          explanation: s.explanation,
          points: s.points,
          image: s.image,
          onContinue: () => _next(),
        ),
      SwipeStepData s => SwipeCardsStep(title: s.title, cards: s.cards, onComplete: () => _next()),
      SpeedStepData s => SpeedChallengeStep(
          question: s.question,
          options: s.options,
          correctId: s.correctId,
          timeLimit: s.timeLimit,
          explanation: s.explanation,
          onComplete: _next,
        ),
      VisualQuizStepData s => VisualDiscovery(
          question: s.question,
          image: s.image,
          aspectRatio: s.aspectRatio,
          parts: s.parts,
          correctId: s.correctId,
          explanation: s.explanation,
          onComplete: _next,
        ),
      QuickQuizStepData s => QuickQuizCardsStep(
          question: s.question,
          options: s.options,
          correctId: s.correctId,
          explanation: s.explanation,
          onComplete: _next,
        ),
    };

    return Padding(
      padding: EdgeInsets.only(top: insets.top),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 0, 20, 8),
            child: Row(
              children: [
                CircleIconButton(icon: Ionicons.close, onPressed: _quit, label: 'Quitter la leçon'),
                const SizedBox(width: 12),
                Expanded(child: ProgressBar(progress: progress, color: c.primaryDark, height: 8)),
                const SizedBox(width: 12),
                Text('${_index + 1}/${_steps.length}',
                    style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: c.textSecondary)),
              ],
            ),
          ),
          // Clé = index : chaque étape repart d'un état neuf.
          Expanded(child: KeyedSubtree(key: ValueKey(_index), child: stepWidget)),
        ],
      ),
    );
  }
}
