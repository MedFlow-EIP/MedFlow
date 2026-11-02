import 'dart:async';

import 'package:flutter/material.dart';
import 'package:ionicons/ionicons.dart';

import '../navigation/nav.dart';
import '../services/api.dart';
import '../theme/theme_controller.dart';
import '../utils/analytics.dart';
import '../widgets/courses/footer_bar.dart';
import '../widgets/insets.dart';
import '../widgets/ui.dart';

/// Cas clinique interactif : dossier du patient, puis une décision par étape
/// avec un retour sur le choix fait, et un débriefing à la fin
/// (copie de ClinicalCaseScreen.tsx).
class ClinicalCaseScreen extends StatefulWidget {
  const ClinicalCaseScreen({super.key});

  @override
  State<ClinicalCaseScreen> createState() => _ClinicalCaseScreenState();
}

List<Map<String, dynamic>> _maps(dynamic list) =>
    list is List ? list.whereType<Map>().map((m) => m.cast<String, dynamic>()).toList() : [];

int _int(dynamic v) => v is num ? v.toInt() : 0;

String _str(dynamic v) => v == null ? '' : '$v';

/// Texte de l'option ``key`` d'une étape (`step.options[key]`).
String _option(Map<String, dynamic> step, dynamic key) {
  final options = step['options'];
  return options is Map ? _str(options[key]) : '';
}

class _ClinicalCaseScreenState extends State<ClinicalCaseScreen> with FocusRefresh<ClinicalCaseScreen> {
  final _scroll = ScrollController();
  int? _caseId;

  Map<String, dynamic>? _state;
  String? _error;
  String? _selected;
  bool _sending = false;
  // Dernier retour reçu, montré avant de passer à l'étape suivante.
  Map<String, dynamic>? _lastResult;
  int _xpGained = 0;
  Timer? _pollTimer;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_caseId == null) {
      final raw = routeParams(context)['caseId'];
      _caseId = raw is num ? raw.toInt() : int.tryParse('$raw');
    }
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    _scroll.dispose();
    super.dispose();
  }

  @override
  void onFocus() {
    if (_state == null || _state!['status'] == 'generating') _load();
  }

  void _set(VoidCallback fn) {
    if (mounted) setState(fn);
  }

  void _setCase(Map<String, dynamic> next) {
    if (!mounted) return;
    setState(() => _state = next);
    // Cas encore en préparation (ouvert depuis la liste ou une notification) : on attend.
    _pollTimer?.cancel();
    if (next['status'] == 'generating') _pollTimer = Timer(const Duration(seconds: 4), _load);
  }

  Future<void> _load() async {
    if (Api.currentUser == null) return;
    _set(() => _error = null);
    try {
      final data = await Api.getJson('/api/cases/$_caseId', fallback: 'Cas introuvable.');
      _setCase((data as Map).cast<String, dynamic>());
    } catch (err) {
      _set(() => _error = errorMessage(err, 'Cas introuvable.'));
    }
  }

  void _scrollToEndSoon() {
    Timer(const Duration(milliseconds: 100), () {
      if (!mounted || !_scroll.hasClients) return;
      _scroll.animateTo(
        _scroll.position.maxScrollExtent,
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeOut,
      );
    });
  }

  Future<void> _submit() async {
    final current = _state?['current'];
    if (Api.currentUser == null || current is! Map || _selected == null || _sending) return;
    setState(() {
      _sending = true;
      _error = null;
    });
    try {
      final data = await Api.postJson(
        '/api/cases/$_caseId/answer',
        {'step': current['index'], 'option': _selected},
        fallback: 'Réponse non enregistrée.',
      );
      final next = (data['case'] as Map).cast<String, dynamic>();
      final played = _maps(next['played']);
      _set(() {
        _lastResult = played.isNotEmpty ? played.last : null;
        _xpGained += _int(data['xp_gained']);
      });
      _setCase(next);
      if (next['finished'] == true) logEvent('case_finished');
      _scrollToEndSoon();
    } catch (err) {
      _set(() => _error = errorMessage(err, 'Réponse non enregistrée. Réessaie.'));
    } finally {
      _set(() => _sending = false);
    }
  }

  void _next() {
    setState(() {
      _lastResult = null;
      _selected = null;
    });
    _scrollToEndSoon();
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final insets = ScreenInsets.of(context);
    final state = _state;

    if (state == null) {
      return Scaffold(
        backgroundColor: c.background,
        body: _error != null
            ? StateView(
                icon: Ionicons.medkit_outline,
                tone: Tone.neutral,
                title: 'Cas indisponible',
                subtitle: _error,
                primary: StateAction('Réessayer', _load),
                onClose: () => Nav.goBack(),
              )
            : Center(
                child: CircularProgressIndicator(color: c.primaryDark, semanticsLabel: 'Chargement du cas'),
              ),
      );
    }

    if (state['status'] == 'generating') {
      return Scaffold(
        backgroundColor: c.background,
        body: StateView(
          icon: Ionicons.medkit_outline,
          tone: Tone.primary,
          title: 'Cas en préparation',
          subtitle:
              'Ça prend environ 30 secondes. Tu peux quitter cet écran : une notification te prévient quand le cas est prêt.',
          primary: StateAction('Continuer ailleurs', () => Nav.goBack()),
          onClose: () => Nav.goBack(),
        ),
      );
    }

    if (state['status'] == 'error') {
      final error = state['error'];
      return Scaffold(
        backgroundColor: c.background,
        body: StateView(
          icon: Ionicons.alert_circle_outline,
          tone: Tone.danger,
          title: 'Cas non créé',
          subtitle: error is String && error.isNotEmpty ? error : 'Réessaie dans un instant.',
          primary: StateAction('Retour', () => Nav.goBack()),
          onClose: () => Nav.goBack(),
        ),
      );
    }

    final played = _maps(state['played']);
    final total = _int(state['total_steps']);
    final current = state['current'] is Map ? (state['current'] as Map).cast<String, dynamic>() : null;
    final finished = state['finished'] == true;
    final lastResult = _lastResult;
    // Étapes déjà validées (le dernier retour est affiché à part tant qu'on n'a pas continué).
    final history = lastResult != null && played.isNotEmpty ? played.sublist(0, played.length - 1) : played;
    final showDebrief = finished && lastResult == null;
    final progress = total > 0 ? played.length / total * 100 : 0.0;
    final overline = TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: c.primaryText);

    final content = <Widget>[
      Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(color: c.tintPrimary, borderRadius: BorderRadius.circular(16)),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                Icon(Ionicons.person_outline, size: 18, color: c.primaryText),
                const SizedBox(width: 8),
                Text('Dossier du patient',
                    style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: c.primaryText)),
              ],
            ),
            const SizedBox(height: 8),
            Text(_str(state['context']), style: TextStyle(fontSize: 15, height: 22 / 15, color: c.textPrimary)),
          ],
        ),
      ),
      for (final step in history)
        Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: c.surface,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: c.border),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text('ÉTAPE ${_int(step['index']) + 1}', style: overline),
              if (_str(step['situation']).isNotEmpty) ...[
                const SizedBox(height: 6),
                Text(_str(step['situation']), style: TextStyle(fontSize: 14, height: 20 / 14, color: c.textSecondary)),
              ],
              const SizedBox(height: 6),
              Text(_str(step['question']),
                  style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: c.textPrimary)),
              const SizedBox(height: 6),
              Row(
                children: [
                  Icon(
                    step['is_correct'] == true ? Ionicons.checkmark_circle : Ionicons.close_circle,
                    size: 18,
                    color: step['is_correct'] == true ? c.success : c.danger,
                  ),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(_option(step, step['choice']), style: TextStyle(fontSize: 14, color: c.textPrimary)),
                  ),
                ],
              ),
            ],
          ),
        ),
      if (lastResult != null) _ResultCard(result: lastResult),
      if (lastResult == null && current != null)
        Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('ÉTAPE ${_int(current['index']) + 1}/$total', style: overline),
            if (_str(current['situation']).isNotEmpty) ...[
              const SizedBox(height: 10),
              ClipRRect(
                borderRadius: BorderRadius.circular(14),
                child: Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: c.surface,
                    border: Border(left: BorderSide(color: c.primaryDark, width: 4)),
                  ),
                  child: Text(_str(current['situation']),
                      style: TextStyle(fontSize: 15, height: 22 / 15, color: c.textPrimary)),
                ),
              ),
            ],
            const SizedBox(height: 10),
            Text(_str(current['question']),
                style: TextStyle(fontSize: 18, height: 25 / 18, fontWeight: FontWeight.w700, color: c.textPrimary)),
            if (current['options'] is Map)
              for (final entry in (current['options'] as Map).entries) ...[
                const SizedBox(height: 10),
                _OptionRow(
                  text: _str(entry.value),
                  active: '${entry.key}' == _selected,
                  onTap: _sending ? null : () => setState(() => _selected = '${entry.key}'),
                ),
              ],
          ],
        ),
      if (showDebrief)
        Container(
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            color: c.surface,
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: c.border),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text('${_int(state['score'])}/$total bonnes décisions',
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: c.textPrimary)),
              if (_xpGained > 0) ...[
                const SizedBox(height: 10),
                Text('+$_xpGained XP',
                    textAlign: TextAlign.center,
                    style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: c.successText)),
              ],
              const SizedBox(height: 10 + 6),
              Text('À retenir', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: c.textPrimary)),
              if (state['debrief'] is List)
                for (final point in state['debrief'] as List) ...[
                  const SizedBox(height: 10),
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Icon(Ionicons.checkmark_circle, size: 18, color: c.success),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(_str(point), style: TextStyle(fontSize: 15, height: 22 / 15, color: c.textPrimary)),
                      ),
                    ],
                  ),
                ],
            ],
          ),
        ),
      if (_error != null) Text(_error!, style: TextStyle(fontSize: 14, color: c.dangerText)),
    ];

    final Widget footerButton;
    if (lastResult != null) {
      footerButton = FooterActionButton(
        label: finished ? 'Voir le débriefing' : 'Étape suivante',
        trailingIcon: Ionicons.arrow_forward,
        onPressed: _next,
      );
    } else if (current != null) {
      footerButton = FooterActionButton(
        label: 'Valider ma décision',
        loading: _sending,
        onPressed: _selected == null || _sending ? null : _submit,
      );
    } else {
      footerButton = FooterActionButton(label: 'Terminer', onPressed: () => Nav.goBack());
    }

    return Scaffold(
      backgroundColor: c.background,
      body: Stack(
        children: [
          Padding(
            padding: EdgeInsets.only(top: insets.top),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(20, 0, 20, 10),
                  child: Row(
                    children: [
                      CircleIconButton.back(() => Nav.goBack()),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Semantics(
                              header: true,
                              child: Text(_str(state['title']),
                                  maxLines: 2,
                                  overflow: TextOverflow.ellipsis,
                                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: c.textPrimary)),
                            ),
                            const SizedBox(height: 2),
                            Text(_str(state['source_label']),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: TextStyle(fontSize: 13, color: c.textSecondary)),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.fromLTRB(20, 0, 20, 10),
                  child: ProgressBar(progress: progress, height: 6, color: c.primaryDark),
                ),
                Expanded(
                  child: SingleChildScrollView(
                    controller: _scroll,
                    padding: EdgeInsets.fromLTRB(20, 0, 20, insets.bottom + 120),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        for (final (i, child) in content.indexed) ...[
                          if (i > 0) const SizedBox(height: 12),
                          child,
                        ],
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
          Positioned(left: 0, right: 0, bottom: 0, child: FooterBar(child: footerButton)),
        ],
      ),
    );
  }
}

class _ResultCard extends StatelessWidget {
  final Map<String, dynamic> result;
  const _ResultCard({required this.result});

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final good = result['is_correct'] == true;
    final feedback = _str(result['feedback']);
    final explanation = _str(result['explanation']);
    final choiceStyle = TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: c.textPrimary);
    final lines = <Widget>[
      Text(good ? 'Bonne décision' : 'Ce n’était pas le meilleur choix',
          style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700, color: good ? c.successText : c.dangerText)),
      Text('Ton choix : ${_option(result, result['choice'])}', style: choiceStyle),
      if (feedback.isNotEmpty) Text(feedback, style: TextStyle(fontSize: 15, height: 22 / 15, color: c.textPrimary)),
      if (!good)
        Text('Meilleur choix : ${_option(result, result['correct'])}',
            style: choiceStyle.copyWith(color: c.successText)),
      if (explanation.isNotEmpty)
        Text(explanation, style: TextStyle(fontSize: 14, height: 20 / 14, color: c.textSecondary)),
    ];
    return Semantics(
      liveRegion: true,
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: good ? c.tintSuccess : c.tintDanger,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: good ? c.success : c.danger, width: 1.5),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            for (final (i, line) in lines.indexed) ...[
              if (i > 0) const SizedBox(height: 8),
              line,
            ],
          ],
        ),
      ),
    );
  }
}

class _OptionRow extends StatelessWidget {
  final String text;
  final bool active;
  final VoidCallback? onTap;
  const _OptionRow({required this.text, required this.active, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Semantics(
      inMutuallyExclusiveGroup: true,
      checked: active,
      child: Tappable(
        onTap: onTap,
        button: false,
        child: Container(
          constraints: const BoxConstraints(minHeight: 56),
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: active ? c.tintPrimary : c.surface,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: active ? c.primaryDark : c.border, width: 2),
          ),
          child: Row(
            children: [
              Container(
                width: 22,
                height: 22,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  border: Border.all(color: active ? c.primaryDark : c.muted, width: 2),
                ),
                child: active
                    ? Container(
                        width: 10,
                        height: 10,
                        decoration: BoxDecoration(color: c.primaryDark, shape: BoxShape.circle),
                      )
                    : null,
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  text,
                  style: TextStyle(
                    fontSize: 15,
                    height: 21 / 15,
                    fontWeight: active ? FontWeight.w600 : FontWeight.w400,
                    color: active ? c.primaryText : c.textPrimary,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
