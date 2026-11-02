import 'package:flutter/material.dart';
import 'package:ionicons/ionicons.dart';

import '../navigation/nav.dart';
import '../services/api.dart';
import '../theme/theme_controller.dart';
import '../utils/app_alert.dart';
import '../utils/background_jobs.dart';
import '../widgets/courses/footer_bar.dart';
import '../widgets/insets.dart';
import '../widgets/sheet.dart';
import '../widgets/ui.dart';

// Liste des cas cliniques (à reprendre / terminés) et création d'un nouveau
// cas (copie de ClinicalCasesScreen.tsx).

const _difficulties = [
  (value: 'facile', label: 'Facile'),
  (value: 'normal', label: 'Normal'),
  (value: 'difficile', label: 'Difficile'),
];

List<Map<String, dynamic>> _maps(dynamic list) =>
    list is List ? list.whereType<Map>().map((m) => m.cast<String, dynamic>()).toList() : [];

int _int(dynamic v) => v is num ? v.toInt() : 0;

/// Ce que la feuille « Nouveau cas » garde d'une ouverture à l'autre (dans
/// l'app RN, la feuille reste montée : liste des cours et difficulté conservées).
class _NewCaseMemory {
  List<Map<String, dynamic>>? courses;
  String difficulty = 'normal';
}

class ClinicalCasesScreen extends StatefulWidget {
  const ClinicalCasesScreen({super.key});

  @override
  State<ClinicalCasesScreen> createState() => _ClinicalCasesScreenState();
}

class _ClinicalCasesScreenState extends State<ClinicalCasesScreen> with FocusRefresh<ClinicalCasesScreen> {
  List<Map<String, dynamic>>? _cases;
  String? _loadError;
  bool _creating = false;
  bool _paramsRead = false;
  final _memory = _NewCaseMemory();
  // Un cas prêt pendant qu'on est sur l'écran : la liste se met à jour.
  late int _finishedJobs = _countFinished();

  @override
  void initState() {
    super.initState();
    caseJobs.addListener(_onCaseJobs);
  }

  @override
  void dispose() {
    caseJobs.removeListener(_onCaseJobs);
    super.dispose();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    // Ouvert depuis un cours : création directe sur ce cours.
    if (_paramsRead) return;
    _paramsRead = true;
    final courseId = routeParams(context)['courseId'];
    if (courseId != null && '$courseId'.isNotEmpty) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _openNewCase(courseId);
      });
    }
  }

  int _countFinished() => caseJobs.value.where((j) => j.status != CaseStatus.generating).length;

  void _onCaseJobs() {
    final finished = _countFinished();
    if (finished == _finishedJobs) return;
    _finishedJobs = finished;
    if (mounted) _load();
  }

  @override
  void onFocus() => _load();

  void _set(VoidCallback fn) {
    if (mounted) setState(fn);
  }

  Future<void> _load() async {
    if (Api.currentUser == null) return;
    _set(() => _loadError = null);
    try {
      final data = await Api.getJson('/api/cases', fallback: 'Impossible de charger tes cas.');
      _set(() => _cases = _maps(data is Map ? data['cases'] : null));
    } catch (err) {
      _set(() => _loadError = errorMessage(err, 'Impossible de charger tes cas.'));
    }
  }

  void _remove(Map<String, dynamic> item) {
    appAlert('Supprimer ce cas ?', '« ${item['title']} »', [
      const AlertButton('Annuler', style: AlertStyle.cancel),
      AlertButton(
        'Supprimer',
        style: AlertStyle.destructive,
        onPress: () async {
          if (Api.currentUser == null) return;
          try {
            await Api.deleteJson('/api/cases/${item['id']}', fallback: 'Suppression impossible.');
            _set(() => _cases = (_cases ?? []).where((x) => x['id'] != item['id']).toList());
          } catch (err) {
            appAlert('Suppression impossible', errorMessage(err, 'Réessaie dans un instant.'));
          }
        },
      ),
    ]);
  }

  Future<void> _openNewCase([dynamic presetCourseId]) async {
    if (_creating) return;
    _creating = true;
    final c = context.readColors;
    final caseId = await showModalBottomSheet<int>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      // Comme le Modal RN : pas de glissement, fermeture en touchant le fond (sauf pendant le lancement).
      enableDrag: false,
      backgroundColor: c.surface,
      barrierColor: const Color(0x80000000),
      constraints: BoxConstraints(maxHeight: MediaQuery.sizeOf(context).height * 0.9),
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(28))),
      builder: (_) => AppSheetBody(
        title: 'Nouveau cas clinique',
        showClose: false,
        child: _NewCaseSheet(presetCourseId: presetCourseId, memory: _memory),
      ),
    );
    _creating = false;
    if (!mounted) return;
    if (caseId != null) {
      _load();
      appAlert(
        'Cas en préparation',
        'Ça prend environ 30 secondes. Continue ce que tu veux dans l’app : une notification te prévient quand le cas est prêt.',
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final insets = ScreenInsets.of(context);
    final cases = _cases;

    if (_loadError != null && cases == null) {
      return Scaffold(
        backgroundColor: c.background,
        body: StateView(
          icon: Ionicons.cloudOfflineOutline,
          tone: Tone.neutral,
          title: 'Impossible de charger tes cas',
          subtitle: _loadError,
          primary: StateAction('Réessayer', _load),
          onClose: () => Nav.goBack(),
        ),
      );
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
                  padding: const EdgeInsets.fromLTRB(20, 0, 20, 12),
                  child: Row(
                    children: [
                      CircleIconButton.back(() => Nav.goBack()),
                      const SizedBox(width: 12),
                      Flexible(
                        child: Semantics(
                          header: true,
                          child: Text('Cas cliniques',
                              style: TextStyle(fontSize: 22, fontWeight: FontWeight.w700, color: c.textPrimary)),
                        ),
                      ),
                    ],
                  ),
                ),
                if (cases == null)
                  Padding(
                    padding: const EdgeInsets.only(top: 40),
                    child: Center(
                      child: CircularProgressIndicator(color: c.primaryDark, semanticsLabel: 'Chargement'),
                    ),
                  )
                else
                  Expanded(
                    child: ListView(
                      padding: EdgeInsets.fromLTRB(20, 0, 20, insets.bottom + 110),
                      children: [
                        Container(
                          padding: const EdgeInsets.all(14),
                          decoration: BoxDecoration(color: c.tintPrimary, borderRadius: BorderRadius.circular(14)),
                          child: Row(
                            children: [
                              Icon(Ionicons.medkitOutline, size: 20, color: c.primaryText),
                              const SizedBox(width: 10),
                              Expanded(
                                child: Text(
                                  'Un patient, des décisions à prendre à chaque étape, et un retour sur chacun de tes choix.',
                                  style: TextStyle(
                                    fontSize: 13,
                                    height: 18 / 13,
                                    fontWeight: FontWeight.w500,
                                    color: c.primaryText,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 10 + 4),
                        if (cases.isEmpty)
                          Padding(
                            padding: const EdgeInsets.symmetric(vertical: 20),
                            child: Text('Aucun cas pour l’instant : crée le premier.',
                                textAlign: TextAlign.center, style: TextStyle(fontSize: 14, color: c.textSecondary)),
                          )
                        else
                          for (final (i, item) in cases.indexed) ...[
                            if (i > 0) const SizedBox(height: 10),
                            _CaseRow(
                              item: item,
                              onOpen: () => Nav.navigate('ClinicalCase', {'caseId': _int(item['id'])}),
                              onRemove: () => _remove(item),
                            ),
                          ],
                      ],
                    ),
                  ),
              ],
            ),
          ),
          Positioned(
            left: 0,
            right: 0,
            bottom: 0,
            child: FooterBar(
              child: FooterActionButton(
                label: 'Nouveau cas clinique',
                leadingIcon: Ionicons.add,
                leadingIconSize: 22,
                onPressed: () => _openNewCase(),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _CaseRow extends StatelessWidget {
  final Map<String, dynamic> item;
  final VoidCallback onOpen;
  final VoidCallback onRemove;
  const _CaseRow({required this.item, required this.onOpen, required this.onRemove});

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final generating = item['status'] == 'generating';
    final failed = item['status'] == 'error';
    final finished = item['finished'] == true;
    final sourceLabel = '${item['source_label'] ?? ''}';
    final error = item['error'];
    final total = _int(item['total_steps']);
    final meta = generating
        ? '$sourceLabel · en préparation, on te prévient quand c’est prêt'
        : failed
            ? (error is String && error.isNotEmpty ? error : 'Le cas n’a pas pu être créé.')
            : '$sourceLabel · ${finished ? '${_int(item['score'])}/$total bonnes décisions' : 'étape ${_int(item['answered']) + 1}/$total'}';

    return Semantics(
      hint: failed ? 'Toucher pour supprimer' : 'Appui long pour supprimer',
      child: Tappable(
        onTap: generating ? null : (failed ? onRemove : onOpen),
        onLongPress: generating ? null : onRemove,
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
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: failed ? c.tintDanger : (finished ? c.success : c.tintPrimary),
                ),
                child: generating
                    ? SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(strokeWidth: 2, color: c.primaryDark),
                      )
                    : Icon(
                        failed ? Ionicons.alert : (finished ? Ionicons.checkmark : Ionicons.play),
                        size: 18,
                        color: failed ? c.dangerText : (finished ? c.onAction : c.primaryDark),
                      ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('${item['title'] ?? ''}',
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: c.textPrimary)),
                    const SizedBox(height: 2),
                    Text(meta,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(fontSize: 13, color: failed ? c.dangerText : c.textSecondary)),
                  ],
                ),
              ),
              if (!generating) ...[
                const SizedBox(width: 12),
                Icon(Ionicons.chevronForward, size: 18, color: c.textSecondary),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _NewCaseSheet extends StatefulWidget {
  final dynamic presetCourseId;
  final _NewCaseMemory memory;
  const _NewCaseSheet({this.presetCourseId, required this.memory});

  @override
  State<_NewCaseSheet> createState() => _NewCaseSheetState();
}

class _NewCaseSheetState extends State<_NewCaseSheet> {
  late List<Map<String, dynamic>>? _courses = widget.memory.courses;
  late dynamic _courseId = widget.presetCourseId;
  final _topic = TextEditingController();
  late String _difficulty = widget.memory.difficulty;
  bool _busy = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _onShow();
  }

  @override
  void dispose() {
    _topic.dispose();
    super.dispose();
  }

  void _set(VoidCallback fn) {
    if (mounted) setState(fn);
  }

  void _setCourses(List<Map<String, dynamic>> courses) {
    widget.memory.courses = courses;
    _set(() => _courses = courses);
  }

  Future<void> _onShow() async {
    if (Api.currentUser == null) return;
    try {
      final data =
          await Api.getJson('/api/dashboard', query: {'per_page': 100}, fallback: 'Impossible de charger tes cours.');
      _setCourses(_maps(data is Map ? data['cours'] : null));
    } catch (err) {
      _setCourses([]);
      _set(() => _error = errorMessage(err, 'Impossible de charger tes cours.'));
    }
  }

  Future<void> _create() async {
    if (Api.currentUser == null || _busy) return;
    final topic = _topic.text.trim();
    if (_courseId == null && topic.length < 3) {
      setState(() => _error = 'Choisis un cours ou écris un sujet.');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final label =
          _courseId != null ? '${_courses?.where((c) => c['id'] == _courseId).firstOrNull?['nom'] ?? 'Cours'}' : topic;
      final caseId = await startBackgroundCase(
        courseId: _courseId != null ? '$_courseId' : null,
        topic: _courseId != null ? null : topic,
        difficulty: _difficulty,
        label: label,
      );
      if (mounted) Navigator.of(context).pop(caseId);
    } catch (err) {
      _set(() => _error = errorMessage(err, 'Le cas n’a pas pu être créé.'));
    } finally {
      _set(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final labelStyle = TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: c.textPrimary);
    final courses = _courses;

    final children = <Widget>[
      if (_error != null)
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
                  child:
                      Text(_error!, style: TextStyle(fontSize: 14, fontWeight: FontWeight.w500, color: c.dangerText)),
                ),
              ],
            ),
          ),
        ),
      if (_busy)
        Semantics(
          liveRegion: true,
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 32),
            child: Column(
              children: [
                CircularProgressIndicator(color: c.primaryDark),
                const SizedBox(height: 12),
                Text('Lancement…', textAlign: TextAlign.center, style: TextStyle(fontSize: 14, color: c.textSecondary)),
              ],
            ),
          ),
        )
      else ...[
        Text('À partir d’un de tes cours', style: labelStyle),
        ConstrainedBox(
          constraints: const BoxConstraints(maxHeight: 220),
          child: SingleChildScrollView(
            child: courses == null
                ? Center(
                    child: SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(
                          strokeWidth: 2, color: c.primaryDark, semanticsLabel: 'Chargement des cours'),
                    ),
                  )
                : courses.isEmpty
                    ? Padding(
                        padding: const EdgeInsets.symmetric(vertical: 20),
                        child: Text('Aucun cours importé : écris un sujet ci-dessous.',
                            textAlign: TextAlign.center, style: TextStyle(fontSize: 14, color: c.textSecondary)),
                      )
                    : Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          for (final (i, course) in courses.indexed) ...[
                            if (i > 0) const SizedBox(height: 8),
                            _CourseChoice(
                              name: '${course['nom'] ?? ''}',
                              active: course['id'] == _courseId,
                              onTap: () {
                                final active = course['id'] == _courseId;
                                setState(() => _courseId = active ? null : course['id']);
                                _topic.clear();
                              },
                            ),
                          ],
                        ],
                      ),
          ),
        ),
        Text('Ou sur un sujet', style: labelStyle),
        Container(
          constraints: const BoxConstraints(minHeight: 50),
          alignment: Alignment.centerLeft,
          padding: const EdgeInsets.symmetric(horizontal: 14),
          decoration: BoxDecoration(
            color: c.background,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: c.border, width: 1.5),
          ),
          child: Semantics(
            label: 'Sujet du cas clinique',
            child: TextField(
              controller: _topic,
              maxLength: 150,
              onChanged: (t) {
                if (t.isNotEmpty && _courseId != null) setState(() => _courseId = null);
              },
              style: TextStyle(fontSize: 15, color: c.textPrimary),
              decoration: InputDecoration(
                isDense: true,
                border: InputBorder.none,
                counterText: '',
                contentPadding: const EdgeInsets.symmetric(vertical: 14),
                hintText: 'Ex. Douleur abdominale aiguë',
                hintStyle: TextStyle(color: c.textSecondary),
              ),
            ),
          ),
        ),
        Container(
          padding: const EdgeInsets.all(4),
          decoration: BoxDecoration(color: c.surfaceAlt, borderRadius: BorderRadius.circular(12)),
          child: Row(
            children: [
              for (final (i, d) in _difficulties.indexed) ...[
                if (i > 0) const SizedBox(width: 4),
                Expanded(
                  child: _SegmentItem(
                    label: d.label,
                    active: d.value == _difficulty,
                    onTap: () {
                      widget.memory.difficulty = d.value;
                      setState(() => _difficulty = d.value);
                    },
                  ),
                ),
              ],
            ],
          ),
        ),
        FooterActionButton(label: 'Créer le cas', leadingIcon: Ionicons.medkitOutline, onPressed: _create),
      ],
    ];

    return PopScope(
      // Pendant le lancement, la feuille ne se ferme pas.
      canPop: !_busy,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          for (final (i, child) in children.indexed) ...[
            if (i > 0) const SizedBox(height: 12),
            child,
          ],
        ],
      ),
    );
  }
}

class _CourseChoice extends StatelessWidget {
  final String name;
  final bool active;
  final VoidCallback onTap;
  const _CourseChoice({required this.name, required this.active, required this.onTap});

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
          constraints: const BoxConstraints(minHeight: 48),
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          decoration: BoxDecoration(
            color: active ? c.tintPrimary : null,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: active ? c.primaryDark : c.border),
          ),
          child: Row(
            children: [
              Icon(
                active ? Ionicons.radioButtonOn : Ionicons.radioButtonOff,
                size: 20,
                color: active ? c.primaryDark : c.textSecondary,
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Text(name,
                    maxLines: 2, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 15, color: c.textPrimary)),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _SegmentItem extends StatelessWidget {
  final String label;
  final bool active;
  final VoidCallback onTap;
  const _SegmentItem({required this.label, required this.active, required this.onTap});

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
          constraints: const BoxConstraints(minHeight: 40),
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: active ? c.surface : null,
            borderRadius: BorderRadius.circular(9),
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
      ),
    );
  }
}
