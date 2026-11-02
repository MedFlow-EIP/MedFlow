import 'dart:async';

import 'package:flutter/material.dart';
import 'package:ionicons/ionicons.dart';

import '../navigation/nav.dart';
import '../services/api.dart';
import '../theme/theme_controller.dart';
import '../utils/analytics.dart';
import '../utils/explain_prompt.dart';
import '../utils/offline.dart';
import '../utils/reminders.dart';
import '../utils/shuffle.dart';
import '../widgets/insets.dart';
import '../widgets/offline_banner.dart';
import '../widgets/report_error_sheet.dart';
import '../widgets/revision/common.dart';
import '../widgets/ui.dart';

// Révision SM-2 (copie de RevisionScreen.tsx).
//
// Carte (DueItem) : {course_id, course_nom, item_index, question,
//   options: {A: '…'}, lapses?, exam?: {title, days_left} (examen proche lié à
//   ce cours : la carte passe en priorité), optionOrder? (ordre d'affichage des
//   réponses, tiré au chargement de la session)}.
// Réponse (AnswerResult) : {correct, correct_answer, explanation?, is_leech?}.

enum _OptionState { idle, pending, correct, incorrect, dimmed }

Map<String, String> _optionsOf(Map item) =>
    (item['options'] as Map? ?? const {}).map((k, v) => MapEntry('$k', v == null ? '' : '$v'));

List<Map<String, dynamic>> _mapList(Object? value) =>
    value is List ? value.whereType<Map>().map((m) => Map<String, dynamic>.from(m)).toList() : [];

/// Paramètres : `courseId` (optionnel), `startMode` ('scheduled' | 'practice' | 'leeches').
class RevisionScreen extends StatefulWidget {
  const RevisionScreen({super.key});

  @override
  State<RevisionScreen> createState() => _RevisionScreenState();
}

class _RevisionScreenState extends State<RevisionScreen> {
  String? _courseId;
  bool _started = false;

  bool _loading = true;
  String _mode = 'scheduled'; // 'scheduled' | 'practice' | 'leeches'
  bool _error = false;
  List<Map<String, dynamic>> _items = [];
  int _currentIndex = 0;
  String? _selectedOption;
  Map<String, dynamic>? _answerResult;
  int _correctCount = 0;
  bool _finished = false;
  String? _answerError;
  // Pas de réseau : cartes de la copie locale, réponses corrigées sur le
  // téléphone puis envoyées au serveur au retour de la connexion.
  bool _offlineMode = false;
  String? _activeItemKey;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;
    final params = routeParams(context);
    final courseId = params['courseId'];
    _courseId = (courseId == null || '$courseId'.isEmpty) ? null : '$courseId';
    final startMode = params['startMode'] is String ? params['startMode'] as String : 'scheduled';
    // L'écran ne mène qu'à l'onglet IA Chat, qui le ferme : un seul chargement
    // suffit (la feuille « Signaler une erreur » ne doit pas relancer la session).
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _load(startMode);
    });
  }

  /// À appeler dans un setState.
  void _resetSession(List<Map<String, dynamic>> list) {
    // Questions et réponses mélangées à chaque session, sinon on apprend
    // l'ordre (ou la position de la bonne réponse) plutôt que le contenu.
    // Les clés (A/B/C/D) restent celles du serveur pour /api/revision/answer.
    _items = shuffle(list).map((it) => {...it, 'optionOrder': shuffle(_optionsOf(it).keys)}).toList();
    if (list.isNotEmpty) logEvent('revision_started');
    _currentIndex = 0;
    _selectedOption = null;
    _answerResult = null;
    _answerError = null;
    _correctCount = 0;
    _finished = false;
  }

  Future<void> _load([String? loadMode]) async {
    final mode = loadMode ?? _mode;
    final user = Api.currentUser;
    if (user == null) {
      setState(() => _loading = false);
      return;
    }
    setState(() {
      _loading = true;
      _error = false;
      _mode = mode;
      _offlineMode = false;
    });
    try {
      // Réponses données hors ligne lors d'une session précédente : envoyées
      // d'abord, pour que la liste des cartes dues en tienne compte.
      await flushRevisionQueue(user);
      final endpoint = mode == 'practice'
          ? '/api/revision/practice'
          : mode == 'leeches'
              ? '/api/revision/leeches'
              : '/api/revision/due';
      final res = await Api.get(endpoint, query: _courseId != null ? {'course_id': _courseId} : null);
      if (res.statusCode < 200 || res.statusCode >= 300) throw Exception('Erreur serveur');
      final data = decodeBody(res);
      if (data == null) throw const FormatException('Réponse illisible');
      final fetchedItems = _mapList(data is Map ? data['items'] : null);
      if (!mounted) return;
      setState(() => _resetSession(fetchedItems));
      if (mode == 'scheduled') unawaited(saveDueItems(user.uid, _courseId, fetchedItems));

      // Remet à jour le rappel de notification avec le vrai nombre de
      // cartes dues — uniquement en mode programmé, tous cours confondus
      // (une session ciblée sur un seul cours ne représente pas le total).
      if (mode == 'scheduled' && _courseId == null) {
        unawaited(scheduleRevisionReminder(fetchedItems.length));
      }
    } catch (err) {
      debugPrint('Erreur chargement révision: $err');
      // Hors ligne : dernière liste de cartes dues connue (ou le cours gardé).
      final offlineItems = mode == 'leeches' ? <Map<String, dynamic>>[] : await readOfflineItems(user.uid, _courseId);
      if (!mounted) return;
      setState(() {
        if (offlineItems.isNotEmpty) {
          _resetSession(offlineItems);
          _offlineMode = true;
        } else {
          _error = true;
        }
      });
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _finishSession(int finalCorrectCount, int totalReviewed) async {
    final user = Api.currentUser;
    if (user == null || totalReviewed == 0) return;
    final body = <String, dynamic>{
      'mode': _courseId != null ? 'course' : 'all',
      if (_courseId != null) 'course_id': _courseId,
      'session_type': 'revision',
      'score': (finalCorrectCount / totalReviewed * 100).round(),
      'total_questions': totalReviewed,
    };
    if (_offlineMode) {
      // Compte pour la série dès le retour du réseau.
      unawaited(queueSessionDone(user.uid, body));
      return;
    }
    try {
      await Api.post('/api/session-done', body);
    } catch (err) {
      debugPrint('Erreur fin de session: $err');
      unawaited(queueSessionDone(user.uid, body));
    }
  }

  Future<void> _selectOption(String option) async {
    if (_selectedOption != null) return; // déjà répondu, on attend « Continuer »
    if (_currentIndex >= _items.length) return;
    final item = _items[_currentIndex];
    final user = Api.currentUser;
    if (user == null) return;
    final mode = _mode;
    final courseId = '${item['course_id']}';
    final itemIndex = (item['item_index'] as num).toInt();

    // Identifie précisément CETTE question — si la réponse serveur arrive
    // après qu'on a déjà avancé (cas normalement impossible depuis le fix
    // sur le bouton « Continuer », mais gardé en filet de sécurité), on
    // l'ignore plutôt que de l'appliquer à la mauvaise question affichée.
    final requestKey = '$courseId:$itemIndex';
    _activeItemKey = requestKey;

    setState(() {
      _selectedOption = option;
      _answerError = null;
    });

    // Correction avec la copie locale du cours ; la réponse part plus tard.
    Future<bool> answerOffline() async {
      final result = await gradeOffline(user.uid, courseId, itemIndex, option);
      if (_activeItemKey != requestKey) return true;
      if (result == null) return false;
      // Le mode libre ne touche pas au planning : rien à envoyer.
      if (mode != 'practice') {
        await queueAnswer(user.uid, {
          'course_id': item['course_id'],
          'item_index': item['item_index'],
          'selected_option': option,
        });
      }
      if (mounted) setState(() => _answerResult = result);
      return true;
    }

    if (_offlineMode) {
      if (!await answerOffline() && mounted) {
        setState(() {
          _selectedOption = null;
          _answerError = 'Ce cours n’est pas enregistré sur ton téléphone. Ouvre-le une fois avec du réseau.';
        });
      }
      return;
    }

    try {
      final endpoint = mode == 'practice' ? '/api/revision/check' : '/api/revision/answer';
      final data = await Api.postJson(
        endpoint,
        {
          'course_id': item['course_id'],
          'item_index': item['item_index'],
          'selected_option': option,
        },
        fallback: 'Réponse non enregistrée.',
      );
      if (_activeItemKey != requestKey || !mounted) return; // question déjà quittée
      setState(() => _answerResult = Map<String, dynamic>.from(data as Map));
    } catch (err) {
      debugPrint('Erreur enregistrement réponse: $err');
      if (_activeItemKey != requestKey) return;
      // Réseau coupé en pleine session : on continue hors ligne si possible.
      final networkLost = err is UserFacingError && err.status == null;
      if (networkLost && await answerOffline()) {
        if (mounted) setState(() => _offlineMode = true);
        return;
      }
      if (!mounted) return;
      // Sinon on libère la question pour que l'utilisateur réponde à nouveau,
      // au lieu de la compter fausse.
      setState(() {
        _selectedOption = null;
        _answerError = errorMessage(err, 'Réponse non enregistrée. Réessaie.');
      });
    }
  }

  void _goToNext() {
    final wasCorrect = _answerResult?['correct'] == true;
    final newCorrectCount = _correctCount + (wasCorrect ? 1 : 0);

    if (_currentIndex + 1 >= _items.length) {
      setState(() {
        _correctCount = newCorrectCount;
        _finished = true;
      });
      logEvent('revision_finished', _mode);
      _finishSession(newCorrectCount, _items.length);
    } else {
      setState(() {
        _correctCount = newCorrectCount;
        _currentIndex += 1;
        _selectedOption = null;
        _answerResult = null;
        _answerError = null;
      });
    }
  }

  void _explain() {
    if (_currentIndex >= _items.length || _answerResult == null) return;
    final current = _items[_currentIndex];
    final options = _optionsOf(current);
    // L'onglet IA Chat (et non une copie du chat par-dessus) : la barre
    // d'onglets reste visible et il n'y a jamais deux chats ouverts à la fois.
    Nav.navigate('AIChat', {
      'prompt': explainPrompt(
        question: '${current['question'] ?? ''}',
        correctAnswer: options['${_answerResult!['correct_answer']}'],
        chosenAnswer: _selectedOption != null ? options[_selectedOption] : null,
        courseName: current['course_nom'] == null ? null : '${current['course_nom']}',
      ),
    });
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
          child: Spinner(large: true, color: c.primary, label: 'Chargement de la révision'),
        ),
      );
    }

    if (_error) {
      return StateView(
        icon: Ionicons.cloud_offline_outline,
        tone: Tone.neutral,
        title: 'Impossible de charger la révision',
        subtitle: 'Vérifie ta connexion puis réessaie.',
        primary: StateAction('Réessayer', () => _load()),
        onClose: () => Nav.goBack(),
      );
    }

    if (_items.isEmpty) {
      return StateView(
        icon: _mode == 'leeches' ? Ionicons.shield_checkmark_outline : Ionicons.checkmark_done_outline,
        tone: Tone.success,
        title: _mode == 'practice'
            ? 'Aucune question dans ce cours'
            : _mode == 'leeches'
                ? 'Aucune carte difficile en ce moment'
                : "Rien à réviser aujourd'hui",
        subtitle: _mode == 'practice'
            ? "Ce cours n'a pas encore de quiz généré."
            : _mode == 'leeches'
                ? "Bien joué, aucune carte n'a été ratée plusieurs fois d'affilée récemment."
                : 'Le planning te propose ce qui est vraiment utile à revoir maintenant.',
        primary: _mode == 'scheduled' ? StateAction('Réviser quand même (mode libre)', () => _load('practice')) : null,
        onClose: () => Nav.goBack(),
      );
    }

    if (_finished) {
      final scorePercent = (_correctCount / _items.length * 100).round();
      return StateView(
        icon: Ionicons.ribbon_outline,
        tone: Tone.warning,
        title: 'Session terminée !',
        subtitle: '$_correctCount / ${_items.length} bonnes réponses ($scorePercent%)',
        hint: _mode == 'practice' ? "Mode libre : ce résultat n'affecte pas ton planning de révision." : null,
        primary: StateAction('Terminer', () => Nav.goBack()),
        secondary: StateAction('Recommencer', () => _load(_mode)),
      );
    }

    final item = _items[_currentIndex];
    final options = _optionsOf(item);
    final order = (item['optionOrder'] as List?)?.map((k) => '$k').toList() ?? options.keys.toList();
    final result = _answerResult;
    final correctKey = result?['correct_answer']?.toString();
    final correctText = correctKey != null ? options[correctKey] : null;
    final explanation = result?['explanation']?.toString();
    final courseNom = '${item['course_nom'] ?? ''}';
    final exam = item['exam'] is Map ? item['exam'] as Map : null;

    void reportCurrent() => showReportErrorSheet(
          context,
          ReportTarget(
            kind: 'quiz',
            courseId: '${item['course_id']}',
            excerpt: '${item['question']}\nBonne réponse : ${correctText ?? ''}',
          ),
        );

    // Même bordure 2 px et même indicateur rond aligné à droite pour tous les états.
    _OptionState optionState(String key) {
      if (_selectedOption == null) return _OptionState.idle;
      if (result == null) return key == _selectedOption ? _OptionState.pending : _OptionState.dimmed;
      if (key == correctKey) return _OptionState.correct;
      if (key == _selectedOption) return _OptionState.incorrect;
      return _OptionState.idle;
    }

    final blocks = <Widget>[];
    void add(Widget w, [double gap = 24]) {
      if (blocks.isNotEmpty) blocks.add(SizedBox(height: gap));
      blocks.add(w);
    }

    if (_offlineMode) {
      add(const OfflineBanner(message: 'Hors ligne : tes réponses seront envoyées au retour du réseau.'));
    }

    add(Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text('QUESTION ${_currentIndex + 1}',
                style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: c.primaryText)),
            if (_mode != 'scheduled') _modeChip(context),
          ],
        ),
        if (courseNom.isNotEmpty) ...[
          const SizedBox(height: 4),
          Text(courseNom, style: TextStyle(fontSize: 13, color: c.textSecondary)),
        ],
        if (exam != null) ...[
          const SizedBox(height: 8),
          ExamChip(text: '${exam['title']} · ${_examWhen(exam['days_left'])}', singleLine: true),
        ],
        const SizedBox(height: 8),
        Semantics(
          header: true,
          child: Text('${item['question'] ?? ''}',
              style: TextStyle(fontSize: 21, height: 29 / 21, fontWeight: FontWeight.w600, color: c.textPrimary)),
        ),
      ],
    ));

    add(Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (var i = 0; i < order.length; i++) ...[
          if (i > 0) const SizedBox(height: 12),
          _option(context, order[i], options[order[i]] ?? '', optionState(order[i])),
        ],
      ],
    ));

    if (result?['is_leech'] == true) {
      add(
        Semantics(
          container: true,
          label: 'Carte difficile, plusieurs échecs récents',
          child: ExcludeSemantics(
            child: Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(color: c.tintWarning, borderRadius: BorderRadius.circular(12)),
              child: Row(
                children: [
                  Icon(Ionicons.flame_outline, size: 16, color: c.warningText),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text('Carte difficile : retravaille-la plus souvent',
                        style: TextStyle(fontSize: 13, fontWeight: FontWeight.w500, color: c.warningText)),
                  ),
                ],
              ),
            ),
          ),
        ),
        16,
      );
    }

    // Après une erreur : bonne réponse + explication courte
    final hasCorrectText = correctText != null && correctText.isNotEmpty;
    final hasExplanation = explanation != null && explanation.isNotEmpty;
    if (result != null && result['correct'] != true && (hasCorrectText || hasExplanation)) {
      add(Semantics(
        liveRegion: true,
        child: Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(color: c.tintSuccess, borderRadius: BorderRadius.circular(14)),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (hasCorrectText)
                Text('Bonne réponse : $correctText',
                    style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: c.successText)),
              if (hasCorrectText && hasExplanation) const SizedBox(height: 4),
              if (hasExplanation)
                Text(explanation, style: TextStyle(fontSize: 14, height: 20 / 14, color: c.successText)),
            ],
          ),
        ),
      ));
    }

    if (_answerError != null && _answerError!.isNotEmpty) {
      add(Semantics(
        liveRegion: true,
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(color: c.tintDanger, borderRadius: BorderRadius.circular(14)),
          child: Row(
            children: [
              Icon(Ionicons.cloud_offline_outline, size: 18, color: c.dangerText),
              const SizedBox(width: 8),
              Expanded(
                child: Text(_answerError!,
                    style: TextStyle(fontSize: 14, fontWeight: FontWeight.w500, color: c.dangerText)),
              ),
            ],
          ),
        ),
      ));
    }

    // Pas compris ? L'assistant explique cette carte, avec la question en contexte.
    if (result != null && correctKey != null && correctKey.isNotEmpty) {
      add(Tappable(
        onTap: _explain,
        semanticLabel: "Demander une explication à l'assistant",
        child: ExcludeSemantics(
          child: Container(
            constraints: const BoxConstraints(minHeight: 48),
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: c.surface,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: c.border, width: 1.5),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Ionicons.sparkles_outline, size: 18, color: c.primaryText),
                const SizedBox(width: 8),
                Text('Explique-moi cette carte',
                    style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: c.primaryText)),
              ],
            ),
          ),
        ),
      ));
    }

    if (result != null) {
      add(ReportLink(semanticLabel: 'Signaler une erreur dans cette question', onTap: reportCurrent));
    }

    return Stack(
      children: [
        Padding(
          padding: EdgeInsets.only(top: insets.top),
          child: Column(
            children: [
              SessionHeader(
                index: _currentIndex,
                total: _items.length,
                paddingBottom: 8,
                onClose: () => Nav.goBack(),
              ),
              Expanded(
                child: ListView(
                  padding: const EdgeInsets.fromLTRB(20, 16, 20, 120),
                  children: blocks,
                ),
              ),
            ],
          ),
        ),
        if (_selectedOption != null && result != null)
          Positioned(
            left: 20,
            right: 20,
            bottom: insets.bottom + 16,
            child: Tappable(
              onTap: _goToNext,
              semanticLabel: 'Continuer',
              child: ExcludeSemantics(
                child: Container(
                  height: 56,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(color: c.action, borderRadius: BorderRadius.circular(14)),
                  child: Text('Continuer',
                      style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: c.onAction)),
                ),
              ),
            ),
          ),
      ],
    );
  }

  /// « aujourd'hui », « demain » ou « J-12 ».
  String _examWhen(Object? daysLeft) {
    final d = daysLeft is num ? daysLeft : null;
    if (d == 0) return "aujourd'hui";
    if (d == 1) return 'demain';
    return 'J-${jsNum(daysLeft)}';
  }

  Widget _modeChip(BuildContext context) {
    final c = context.colors;
    final leeches = _mode == 'leeches';
    final fg = leeches ? c.warningText : c.textSecondary;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: leeches ? c.tintWarning : c.surfaceAlt,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(leeches ? Ionicons.flame_outline : Ionicons.infinite_outline, size: 13, color: fg),
          const SizedBox(width: 4),
          Text(leeches ? 'Cartes difficiles' : 'Mode libre',
              style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: fg)),
        ],
      ),
    );
  }

  Widget _option(BuildContext context, String key, String text, _OptionState state) {
    final c = context.colors;
    // Réponses aérées : 12 px entre les choix, 16 px de padding, cible ≥ 56 px.
    final (borderColor, background) = switch (state) {
      _OptionState.pending => (c.primaryDark, c.tintPrimary),
      _OptionState.correct => (c.success, c.tintSuccess),
      _OptionState.incorrect => (c.danger, c.tintDanger),
      _ => (c.border, c.surface),
    };
    final textStyle = switch (state) {
      _OptionState.correct => TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: c.successText),
      _OptionState.incorrect => TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: c.dangerText),
      _ => TextStyle(fontSize: 16, fontWeight: FontWeight.w500, color: c.textPrimary),
    };
    final Widget trailing = switch (state) {
      _OptionState.pending => Spinner(color: c.primaryDark, label: 'Vérification en cours'),
      _OptionState.correct => Icon(Ionicons.checkmark_circle, size: 26, color: c.success),
      _OptionState.incorrect => Icon(Ionicons.close_circle, size: 26, color: c.danger),
      _ => Container(
          width: 24,
          height: 24,
          decoration: BoxDecoration(
            color: c.surface,
            shape: BoxShape.circle,
            border: Border.all(color: c.muted, width: 2),
          ),
        ),
    };
    final suffix = state == _OptionState.correct
        ? ', bonne réponse'
        : state == _OptionState.incorrect
            ? ', mauvaise réponse'
            : '';

    Widget tile = Container(
      constraints: const BoxConstraints(minHeight: 56),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: background,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: borderColor, width: 2),
      ),
      child: Row(
        children: [
          Expanded(child: Text(text, style: textStyle)),
          const SizedBox(width: 12),
          trailing,
        ],
      ),
    );
    if (state == _OptionState.dimmed) tile = Opacity(opacity: 0.6, child: tile);

    return Tappable(
      onTap: _selectedOption != null ? null : () => _selectOption(key),
      semanticLabel: '$text$suffix',
      selected: key == _selectedOption,
      child: ExcludeSemantics(child: tile),
    );
  }
}
