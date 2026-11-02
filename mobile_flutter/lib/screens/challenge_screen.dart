import 'dart:async';

import 'package:flutter/material.dart';
import 'package:ionicons/ionicons.dart';

import '../navigation/nav.dart';
import '../services/api.dart';
import '../theme/theme_controller.dart';
import '../utils/app_alert.dart';
import '../utils/social_notifications.dart';
import '../widgets/insets.dart';
import '../widgets/quiz.dart';
import '../widgets/social/challenge_section.dart';
import '../widgets/ui.dart';

// Résultat : {challenge, score, total, xp_gained, corrections}

/// Jouer un défi (F57) : même déroulé qu'un examen blanc, sans chrono.
class ChallengeScreen extends StatefulWidget {
  const ChallengeScreen({super.key});

  @override
  State<ChallengeScreen> createState() => _ChallengeScreenState();
}

class _ChallengeScreenState extends State<ChallengeScreen> with FocusRefresh<ChallengeScreen> {
  Map<String, dynamic>? _challenge;
  List<Map<String, dynamic>> _questions = [];
  Map<String, String> _answers = {};
  Map<String, dynamic>? _result;
  String? _loadError;
  bool _busy = false;

  Object? _challengeId;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _challengeId ??= routeParams(context)['challengeId'];
  }

  @override
  void onFocus() {
    if (_result == null) _load();
  }

  Future<void> _load() async {
    if (Api.currentUser == null) return;
    setState(() => _loadError = null);
    try {
      final data = await Api.getJson('/api/challenges/$_challengeId', fallback: 'Défi introuvable.');
      if (!mounted) return;
      setState(() {
        _challenge = (data['challenge'] as Map).cast<String, dynamic>();
        _questions = [for (final q in data['questions'] as List) (q as Map).cast<String, dynamic>()];
      });
    } catch (err) {
      if (!mounted) return;
      setState(() => _loadError = errorMessage(err, 'Défi introuvable.'));
    }
  }

  bool get _playing => _challenge != null && _result == null;

  /// Quitter en cours de partie fait perdre les réponses : on demande d'abord.
  void _onPopBlocked() {
    appAlert('Quitter le défi ?', 'Tes réponses seront perdues, mais tu pourras le rejouer.', [
      const AlertButton('Continuer', style: AlertStyle.cancel),
      AlertButton('Quitter', style: AlertStyle.destructive, onPress: () {
        if (mounted) Navigator.of(context).pop();
      }),
    ]);
  }

  Future<void> _submit() async {
    final user = Api.currentUser;
    if (user == null) return;
    setState(() => _busy = true);
    try {
      final result = await Api.postJson(
        '/api/challenges/$_challengeId/submit',
        {'answers': _answers},
        fallback: 'Copie non envoyée.',
      );
      if (mounted) setState(() => _result = (result as Map).cast<String, dynamic>());
      unawaited(checkSocialNotifications(user));
    } catch (err) {
      appAlert('Copie non envoyée', errorMessage(err, 'Réessaie dans un instant.'));
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
    appAlert('Valider tes réponses ?', '$missing question${missing > 1 ? 's' : ''} sans réponse.', [
      const AlertButton('Continuer', style: AlertStyle.cancel),
      AlertButton('Valider', onPress: _submit),
    ]);
  }

  @override
  Widget build(BuildContext context) {
    final guard = _playing && _answers.isNotEmpty;
    return PopScope(
      canPop: !guard,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) _onPopBlocked();
      },
      child: _content(context),
    );
  }

  Widget _content(BuildContext context) {
    final c = context.colors;
    final insets = ScreenInsets.of(context);

    if (_loadError != null) {
      return Scaffold(
        backgroundColor: c.background,
        body: StateView(
          icon: Ionicons.flash_outline,
          tone: Tone.neutral,
          title: 'Défi indisponible',
          subtitle: _loadError,
          primary: const StateAction('Retour', Nav.goBack),
          onClose: Nav.goBack,
        ),
      );
    }

    final challenge = _challenge;
    if (challenge == null) {
      return Scaffold(
        backgroundColor: c.background,
        body: Center(
          child: CircularProgressIndicator(color: c.primaryDark, semanticsLabel: 'Chargement du défi'),
        ),
      );
    }

    final result = _result;
    final header = Padding(
      padding: EdgeInsets.fromLTRB(20, insets.top, 20, 12),
      child: Row(
        children: [
          CircleIconButton(
            icon: result != null ? Ionicons.arrow_back : Ionicons.close,
            label: 'Retour',
            // maybePop passe par PopScope (confirmation si des réponses sont en cours).
            onPressed: () => Navigator.of(context).maybePop(),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Semantics(
                  header: true,
                  child: Text('Défi contre ${challenge['friend_name']}',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700, color: c.textPrimary)),
                ),
                const SizedBox(height: 2),
                Text('${challenge['course_nom']}',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(fontSize: 13, color: c.textSecondary)),
              ],
            ),
          ),
        ],
      ),
    );

    if (result != null) {
      final ch = (result['challenge'] as Map).cast<String, dynamic>();
      final tone = ch['outcome'] == 'win'
          ? c.tintSuccess
          : ch['outcome'] == 'loss'
              ? c.tintDanger
              : c.tintPrimary;
      final xpGained = (result['xp_gained'] as num?) ?? 0;
      final corrections = [
        for (final item in (result['corrections'] as List? ?? const [])) (item as Map).cast<String, dynamic>(),
      ];
      return Scaffold(
        backgroundColor: c.background,
        body: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            header,
            Expanded(
              child: ListView(
                padding: EdgeInsets.fromLTRB(20, 0, 20, insets.bottom + 32),
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(vertical: 24, horizontal: 16),
                    decoration: BoxDecoration(color: tone, borderRadius: BorderRadius.circular(20)),
                    child: Column(
                      children: [
                        Text('${result['score']}/${result['total']}',
                            style: TextStyle(fontSize: 44, fontWeight: FontWeight.w800, color: c.textPrimary)),
                        const SizedBox(height: 6),
                        Text(
                          ch['status'] == 'done'
                              ? challengeStatusText(ch)
                              : 'En attente de ${ch['friend_name']} : tu verras le résultat quand il aura joué.',
                          textAlign: TextAlign.center,
                          style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: c.textPrimary),
                        ),
                        if (xpGained > 0) ...[
                          const SizedBox(height: 6),
                          Text('+$xpGained XP',
                              style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: c.successText)),
                        ],
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
      );
    }

    return Scaffold(
      backgroundColor: c.background,
      body: Padding(
        padding: EdgeInsets.only(bottom: insets.bottom + 12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            header,
            if (_busy)
              Padding(
                padding: const EdgeInsets.only(top: 60),
                child: Center(
                  child: CircularProgressIndicator(color: c.primaryDark, semanticsLabel: 'Correction en cours'),
                ),
              )
            else
              Expanded(
                child: QuizRunner(
                  questions: _questions,
                  answers: _answers,
                  onAnswer: (key, option) => setState(() => _answers = {..._answers, key: option}),
                  onFinish: _confirmSubmit,
                  finishLabel: 'Valider mes réponses',
                ),
              ),
          ],
        ),
      ),
    );
  }
}
