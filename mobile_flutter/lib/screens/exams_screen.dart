import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:ionicons/ionicons.dart';

import '../navigation/nav.dart';
import '../services/api.dart';
import '../theme/theme_controller.dart';
import '../utils/analytics.dart';
import '../utils/app_alert.dart';
import '../utils/reminders.dart';
import '../widgets/date_picker_sheet.dart';
import '../widgets/insets.dart';
import '../widgets/revision/common.dart';
import '../widgets/ui.dart';

// Examen : {id, title, exam_date (« 2026-11-03 »), days_left, courses: [{id, nom}]}.

List<Map<String, dynamic>> _mapList(Object? value) =>
    value is List ? value.whereType<Map>().map((m) => Map<String, dynamic>.from(m)).toList() : [];

List<ExamSummary> _summaries(List<Map<String, dynamic>> exams) => exams.map(ExamSummary.fromJson).toList();

/// Équivalent de `textTransform: 'capitalize'` : majuscule au début de chaque mot.
String _capitalizeWords(String text) => text.replaceAllMapped(
      RegExp(r'\S+'),
      (m) => m[0]!.substring(0, 1).toUpperCase() + m[0]!.substring(1).toLowerCase(),
    );

class ExamsScreen extends StatefulWidget {
  const ExamsScreen({super.key});

  @override
  State<ExamsScreen> createState() => _ExamsScreenState();
}

class _ExamsScreenState extends State<ExamsScreen> {
  List<Map<String, dynamic>>? _exams;
  String? _loadError;

  @override
  void initState() {
    super.initState();
    // L'écran ne mène nulle part ailleurs : un seul chargement suffit (fermer
    // un dialogue ou la feuille d'ajout ne doit pas relancer la requête).
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _load();
    });
  }

  Future<void> _load() async {
    final user = Api.currentUser;
    if (user == null) return;
    try {
      setState(() => _loadError = null);
      final data = await Api.getJson('/api/exams', fallback: 'Impossible de charger tes examens.');
      final exams = _mapList(data is Map ? data['exams'] : null);
      if (!mounted) return;
      setState(() => _exams = exams);
      unawaited(syncExamReminders(_summaries(exams)));
    } catch (err) {
      if (mounted) setState(() => _loadError = errorMessage(err, 'Impossible de charger tes examens.'));
    }
  }

  void _remove(Map<String, dynamic> exam) {
    appAlert('Supprimer cet examen ?', '« ${exam['title']} » et ses rappels seront supprimés.', [
      const AlertButton('Annuler', style: AlertStyle.cancel),
      AlertButton(
        'Supprimer',
        style: AlertStyle.destructive,
        onPress: () async {
          final user = Api.currentUser;
          if (user == null) return;
          try {
            await Api.deleteJson('/api/exams/${exam['id']}', fallback: 'Suppression impossible.');
            final next = (_exams ?? []).where((e) => e['id'] != exam['id']).toList();
            if (mounted) setState(() => _exams = next);
            unawaited(syncExamReminders(_summaries(next)));
          } catch (err) {
            appAlert('Suppression impossible', errorMessage(err, 'Réessaie dans un instant.'));
          }
        },
      ),
    ]);
  }

  Future<void> _openAddSheet() async {
    final exam = await Navigator.of(context).push<Map<String, dynamic>>(
      MaterialPageRoute(fullscreenDialog: true, builder: (_) => const _AddExamSheet()),
    );
    if (exam == null || !mounted) return;
    final next = [...?_exams, exam]..sort((a, b) => '${a['exam_date']}'.compareTo('${b['exam_date']}'));
    setState(() => _exams = next);
    unawaited(syncExamReminders(_summaries(next), askPermission: true));
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
    final exams = _exams;

    if (_loadError != null && exams == null) {
      return StateView(
        icon: Ionicons.cloudOfflineOutline,
        tone: Tone.neutral,
        title: 'Impossible de charger tes examens',
        subtitle: _loadError,
        primary: StateAction('Réessayer', _load),
        onClose: () => Nav.goBack(),
      );
    }

    final upcoming = (exams ?? []).where((e) => _daysLeft(e) >= 0).toList();
    final past = (exams ?? []).where((e) => _daysLeft(e) < 0).toList().reversed.toList();

    final blocks = <Widget>[
      Row(
        children: [
          CircleIconButton.back(() => Nav.goBack()),
          const SizedBox(width: 12),
          Flexible(
            child: Semantics(
              header: true,
              child: Text('Mes examens',
                  style: TextStyle(fontSize: 22, fontWeight: FontWeight.w700, color: c.textPrimary)),
            ),
          ),
        ],
      ),
      const InfoBox(
        icon: Ionicons.flashOutline,
        text:
            'Dans les 30 jours avant un examen, ses cours passent en premier dans tes révisions. Rappels à J-7 et la veille.',
      ),
      if (exams == null)
        Padding(
          padding: const EdgeInsets.only(top: 32),
          child: Center(child: Spinner(color: c.primaryDark, label: 'Chargement')),
        )
      else if (exams.isEmpty)
        Padding(
          padding: const EdgeInsets.symmetric(vertical: 40, horizontal: 20),
          child: Column(
            children: [
              Icon(Ionicons.calendarOutline, size: 36, color: c.textSecondary),
              const SizedBox(height: 8),
              Text('Aucun examen prévu',
                  style: TextStyle(fontSize: 17, fontWeight: FontWeight.w600, color: c.textPrimary)),
              const SizedBox(height: 8),
              Text('Ajoute ton prochain partiel pour réviser les bons cours au bon moment.',
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 14, height: 20 / 14, color: c.textSecondary)),
            ],
          ),
        )
      else ...[
        for (final exam in upcoming) _examCard(context, exam),
        if (past.isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: Text('Passés',
                style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: c.textSecondary)),
          ),
        for (final exam in past) _examCard(context, exam),
      ],
    ];

    return Stack(
      children: [
        ListView(
          padding: EdgeInsets.fromLTRB(20, insets.top, 20, insets.bottom + 110),
          children: [
            for (var i = 0; i < blocks.length; i++) ...[
              if (i > 0) const SizedBox(height: 14),
              blocks[i],
            ],
          ],
        ),
        Positioned(
          left: 0,
          right: 0,
          bottom: 0,
          child: BottomActionBar(children: [
            BarPrimaryButton(label: 'Ajouter un examen', icon: Ionicons.add, onTap: _openAddSheet),
          ]),
        ),
      ],
    );
  }

  int _daysLeft(Map<String, dynamic> exam) => ((exam['days_left'] as num?) ?? 0).toInt();

  Widget _examCard(BuildContext context, Map<String, dynamic> exam) {
    final c = context.colors;
    final daysLeft = _daysLeft(exam);
    final soon = daysLeft >= 0 && daysLeft <= 7;
    final isPast = daysLeft < 0;
    final courses = _mapList(exam['courses']);
    final title = '${exam['title'] ?? ''}';

    return Opacity(
      opacity: isPast ? 0.6 : 1,
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: c.surface,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: c.border),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: soon
                        ? c.tintWarning
                        : isPast
                            ? c.surfaceAlt
                            : c.tintPrimary,
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Text(countdownLabel(daysLeft),
                      style: TextStyle(
                          fontSize: 13, fontWeight: FontWeight.w700, color: soon ? c.warningText : c.primaryText)),
                ),
                Tappable(
                  onTap: () => _remove(exam),
                  semanticLabel: 'Supprimer l’examen $title',
                  child: SizedBox(
                    width: 44,
                    height: 44,
                    child: Icon(Ionicons.trashOutline, size: 19, color: c.textSecondary),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 6),
            Text(title, style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: c.textPrimary)),
            const SizedBox(height: 6),
            Text(_capitalizeWords(formatLongDate('${exam['exam_date']}')),
                style: TextStyle(fontSize: 14, color: c.textSecondary)),
            if (courses.isNotEmpty) ...[
              const SizedBox(height: 6 + 4),
              Wrap(
                spacing: 6,
                runSpacing: 6,
                children: [
                  for (final course in courses)
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                      decoration: BoxDecoration(color: c.surfaceAlt, borderRadius: BorderRadius.circular(999)),
                      child: Text('${course['nom'] ?? ''}',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(fontSize: 13, fontWeight: FontWeight.w500, color: c.textPrimary)),
                    ),
                ],
              ),
            ] else ...[
              const SizedBox(height: 6),
              Text('Aucun cours lié', style: TextStyle(fontSize: 14, color: c.textSecondary)),
            ],
          ],
        ),
      ),
    );
  }
}

/// Saisie d'un nouvel examen, en plein écran (le Modal « slide » de l'app RN).
/// Renvoie l'examen créé par le serveur, ou null.
class _AddExamSheet extends StatefulWidget {
  const _AddExamSheet();

  @override
  State<_AddExamSheet> createState() => _AddExamSheetState();
}

class _AddExamSheetState extends State<_AddExamSheet> {
  final _title = TextEditingController();
  String? _examDate;
  Set<String> _selected = {};
  List<Map<String, dynamic>>? _courses;
  bool _saving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadCourses();
  }

  @override
  void dispose() {
    _title.dispose();
    super.dispose();
  }

  Future<void> _loadCourses() async {
    final user = Api.currentUser;
    if (user == null) return;
    try {
      final data = await Api.getJson('/api/dashboard',
          query: {'per_page': 100}, fallback: 'Impossible de charger tes cours.');
      final courses = _mapList(data is Map ? data['cours'] : null);
      if (mounted) setState(() => _courses = courses);
    } catch (err) {
      if (!mounted) return;
      setState(() {
        _courses = [];
        _error = errorMessage(err, 'Impossible de charger tes cours.');
      });
    }
  }

  void _toggle(String id) => setState(() {
        final next = {..._selected};
        if (!next.remove(id)) next.add(id);
        _selected = next;
      });

  Future<void> _pickDate() async {
    final iso = await showDatePickerSheet(context, title: 'Date de l’examen', value: _examDate);
    if (iso != null && mounted) setState(() => _examDate = iso);
  }

  Future<void> _save() async {
    final title = _title.text.trim();
    if (title.isEmpty) {
      setState(() => _error = 'Donne un nom à l’examen.');
      return;
    }
    if (_examDate == null) {
      setState(() => _error = 'Choisis la date de l’examen.');
      return;
    }
    final user = Api.currentUser;
    if (user == null) return;
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      final exam = await Api.postJson(
        '/api/exams',
        {'title': title, 'exam_date': _examDate, 'course_ids': [..._selected]},
        fallback: 'Enregistrement impossible.',
      );
      if (!mounted) return;
      Navigator.of(context).pop(Map<String, dynamic>.from(exam as Map));
      logEvent('exam_added');
    } catch (err) {
      if (mounted) setState(() => _error = errorMessage(err, 'Enregistrement impossible.'));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final insets = ScreenInsets.of(context);
    final label = TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: c.textPrimary);
    final fieldBorder = OutlineInputBorder(
      borderRadius: BorderRadius.circular(12),
      borderSide: BorderSide(color: c.border, width: 1.5),
    );
    final courses = _courses;

    final blocks = <Widget>[
      if (_error != null && _error!.isNotEmpty) InlineErrorBox(message: _error!),
      Text('Nom de l’examen', style: label),
      Semantics(
        label: 'Nom de l’examen',
        child: TextField(
          controller: _title,
          inputFormatters: [LengthLimitingTextInputFormatter(80)],
          style: TextStyle(fontSize: 16, color: c.textPrimary),
          cursorColor: c.primaryDark,
          decoration: InputDecoration(
            hintText: 'Ex. Partiel de cardiologie',
            hintStyle: TextStyle(fontSize: 16, color: c.textSecondary),
            filled: true,
            fillColor: c.surface,
            isDense: true,
            constraints: const BoxConstraints(minHeight: 52),
            contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 16),
            enabledBorder: fieldBorder,
            focusedBorder: fieldBorder,
            border: fieldBorder,
          ),
        ),
      ),
      Text('Date', style: label),
      Tappable(
        onTap: _pickDate,
        child: Container(
          constraints: const BoxConstraints(minHeight: 52),
          padding: const EdgeInsets.symmetric(horizontal: 14),
          decoration: BoxDecoration(
            color: c.surface,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: c.border, width: 1.5),
          ),
          child: Row(
            children: [
              Icon(Ionicons.calendarOutline, size: 20, color: c.primaryDark),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  // Le style RN met une majuscule à chaque mot (textTransform: 'capitalize').
                  _capitalizeWords(_examDate != null ? formatLongDate(_examDate!) : 'Choisir une date'),
                  style: TextStyle(fontSize: 16, color: _examDate != null ? c.textPrimary : c.textSecondary),
                ),
              ),
            ],
          ),
        ),
      ),
      Text('Cours à réviser en priorité', style: label),
      if (courses == null)
        Center(child: Spinner(color: c.primaryDark, label: 'Chargement des cours'))
      else if (courses.isEmpty)
        Text('Importe d’abord un cours pour le lier à l’examen.',
            style: TextStyle(fontSize: 14, color: c.textSecondary))
      else
        for (final course in courses)
          CourseCheckRow(
            name: '${course['nom'] ?? ''}',
            checked: _selected.contains('${course['id']}'),
            onTap: () => _toggle('${course['id']}'),
          ),
    ];

    return PopScope(
      canPop: !_saving,
      child: Scaffold(
        backgroundColor: c.background,
        resizeToAvoidBottomInset: true,
        body: Stack(
          children: [
            Column(
              children: [
                Container(
                  margin: const EdgeInsets.only(bottom: 14),
                  padding: EdgeInsets.fromLTRB(12, insets.top, 12, 12),
                  decoration: BoxDecoration(
                    color: c.surface,
                    border: Border(bottom: BorderSide(color: c.border)),
                  ),
                  child: Row(
                    children: [
                      CircleIconButton(
                        icon: Ionicons.close,
                        label: 'Fermer',
                        bordered: false,
                        background: Colors.transparent,
                        onPressed: _saving ? null : () => Navigator.of(context).pop(),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Semantics(
                          header: true,
                          child: Text('Nouvel examen',
                              style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: c.textPrimary)),
                        ),
                      ),
                    ],
                  ),
                ),
                Expanded(
                  child: ListView(
                    padding: EdgeInsets.fromLTRB(20, 0, 20, insets.bottom + 110),
                    children: [
                      for (var i = 0; i < blocks.length; i++) ...[
                        if (i > 0) const SizedBox(height: 14),
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
                  label: 'Enregistrer l’examen',
                  busy: _saving,
                  disabledOpacity: 0.6,
                  onTap: _saving ? null : _save,
                ),
              ]),
            ),
          ],
        ),
      ),
    );
  }
}
