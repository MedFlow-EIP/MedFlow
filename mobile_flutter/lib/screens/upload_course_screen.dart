import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:http/http.dart' as http;
import 'package:image_picker/image_picker.dart';
import 'package:ionicons/ionicons.dart';

import '../navigation/nav.dart';
import '../services/api.dart';
import '../theme/theme_controller.dart';
import '../utils/analytics.dart';
import '../utils/app_alert.dart';
import '../utils/background_jobs.dart';
import '../widgets/course/course_content.dart';
import '../widgets/course/layout.dart';
import '../widgets/insets.dart';
import '../widgets/ui.dart';

// Copie de components/screens/UploadCourseScreen.tsx.

// Même limite que le backend (MAX_PDF_BYTES).
const _maxFileBytes = 20 * 1024 * 1024;

const _docx = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const _pptx = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
// Au-delà, les quotas d'import du jour seraient de toute façon atteints.
const _maxFiles = 10;

const _acceptedTypes = ['application/pdf', _docx, _pptx, 'image/jpeg', 'image/png', 'image/webp'];
// Sélecteur de fichiers iOS : filtré par extension (équivalent des types ci-dessus).
const _acceptedExtensions = ['pdf', 'docx', 'pptx', 'jpg', 'jpeg', 'png', 'webp'];

const _difficulties = [
  (value: 'facile', label: 'Facile', hint: 'Notions principales, réponses évidentes à éliminer'),
  (value: 'normal', label: 'Normal', hint: 'Connaissances et compréhension'),
  (value: 'difficile', label: 'Difficile', hint: 'Cas cliniques et pièges d’examen'),
];

class _PickedFile {
  final String path;
  final String name;
  final int? size;
  final String mimeType;
  const _PickedFile({required this.path, required this.name, this.size, required this.mimeType});
}

String _formatSize(int? bytes) =>
    (bytes == null || bytes == 0) ? '' : '${(bytes / 1024 / 1024).toStringAsFixed(2).replaceAll('.', ',')} Mo';

IconData _fileIcon(String mimeType) =>
    mimeType.startsWith('image/') ? Ionicons.image : (mimeType == _pptx ? Ionicons.easel : Ionicons.documentText);

/// Type MIME à envoyer : celui du sélecteur, sinon déduit de l'extension.
String _guessMimeType(String name, [String? mimeType]) {
  if (mimeType != null && _acceptedTypes.contains(mimeType)) return mimeType;
  final ext = name.toLowerCase().split('.').last;
  if (ext == 'docx') return _docx;
  if (ext == 'pptx') return _pptx;
  if (ext == 'png') return 'image/png';
  if (ext == 'webp') return 'image/webp';
  if (ext == 'jpg' || ext == 'jpeg') return 'image/jpeg';
  return 'application/pdf';
}

const _aiOutputs = [
  (title: 'Un résumé structuré', detail: 'titres, définitions, points clés, schémas compris'),
  (title: 'Des flashcards', detail: 'révisées ensuite en répétition espacée'),
  (title: 'Un quiz', detail: 'pour vérifier que c’est acquis'),
];

/// Champ « file » du formulaire multipart (même nom et même type que l'app RN).
Future<http.MultipartFile> _multipartFile(_PickedFile f) =>
    http.MultipartFile.fromPath('file', f.path, filename: f.name, contentType: http.MediaType.parse(f.mimeType));

class UploadCourseScreen extends StatefulWidget {
  const UploadCourseScreen({super.key});

  @override
  State<UploadCourseScreen> createState() => _UploadCourseScreenState();
}

class _UploadCourseScreenState extends State<UploadCourseScreen> {
  _PickedFile? _file;
  // Plusieurs fichiers choisis d'un coup : chacun devient un import en arrière-plan.
  List<_PickedFile> _files = [];
  bool _loading = false;
  Map<String, dynamic>? _data;
  String _error = '';
  CourseTab _activeTab = CourseTab.resume;
  String _difficulty = 'normal';

  // Import suivi par cet écran : la génération continue même si on le quitte.
  String? _jobId;

  @override
  void initState() {
    super.initState();
    logScreenView('UploadCourseScreen');
    importJobs.addListener(_onImportJobs);
  }

  @override
  void dispose() {
    importJobs.removeListener(_onImportJobs);
    super.dispose();
  }

  void _selectFile(_PickedFile picked) {
    if (picked.size != null && picked.size! > _maxFileBytes) {
      appAlert('Fichier trop lourd', 'Ce fichier fait ${_formatSize(picked.size)}. La limite est de 20 Mo.');
      return;
    }
    setState(() {
      _file = picked;
      _data = null;
      _error = '';
    });
  }

  Future<void> _pickDocument() async {
    try {
      final result = await FilePicker.pickFiles(
        type: FileType.custom,
        allowedExtensions: _acceptedExtensions,
        allowMultiple: true,
      );
      if (result == null || !mounted) return;

      final picked = [
        for (final a in result.files)
          if (a.path != null) _PickedFile(path: a.path!, name: a.name, size: a.size, mimeType: _guessMimeType(a.name)),
      ];
      if (picked.isEmpty) return;
      if (picked.length == 1) {
        setState(() => _files = []);
        _selectFile(picked[0]);
        return;
      }
      bool tooHeavy(_PickedFile f) => f.size != null && f.size! > _maxFileBytes;
      final tooBig = picked.where(tooHeavy).toList();
      final kept = picked.where((f) => !tooHeavy(f)).take(_maxFiles).toList();
      if (tooBig.isNotEmpty) {
        appAlert('Fichiers trop lourds', 'Ignorés (plus de 20 Mo) : ${tooBig.map((f) => f.name).join(', ')}');
      } else if (picked.length > _maxFiles) {
        appAlert('Trop de fichiers', 'Seuls les $_maxFiles premiers seront importés.');
      }
      setState(() {
        _file = null;
        _data = null;
        _error = '';
        _files = kept;
      });
    } catch (err) {
      debugPrint('$err');
    }
  }

  Future<void> _takePhoto() async {
    try {
      // La permission est demandée par le sélecteur lui-même (refus : camera_access_denied).
      final photo = await ImagePicker().pickImage(source: ImageSource.camera, imageQuality: 70);
      if (photo == null || !mounted) return;

      // iOS ne donne pas de nom aux photos prises : même nom par défaut que l'app RN.
      final name = 'photo-cours-${DateTime.now().millisecondsSinceEpoch}.jpg';
      _selectFile(_PickedFile(
        path: photo.path,
        name: name,
        size: await photo.length(),
        mimeType: _guessMimeType(name, photo.mimeType),
      ));
    } on PlatformException catch (err) {
      if (err.code == 'camera_access_denied') {
        appAlert(
          'Accès à l’appareil photo refusé',
          'Autorise l’appareil photo dans les réglages du téléphone pour photographier un cours.',
        );
        return;
      }
      debugPrint('$err');
      appAlert('Appareil photo indisponible', 'Choisis plutôt une photo depuis tes fichiers.');
    } catch (err) {
      debugPrint('$err');
      appAlert('Appareil photo indisponible', 'Choisis plutôt une photo depuis tes fichiers.');
    }
  }

  /// Lance un import en arrière-plan par fichier, puis revient en arrière.
  Future<void> _handleGenerateMany() async {
    if (Api.currentUser == null || _files.isEmpty) return;
    setState(() {
      _loading = true;
      _error = '';
    });
    var started = 0;
    final skipped = <String>[];
    var stopReason = '';
    for (final f in _files) {
      try {
        final res = await startBackgroundImport(
          fields: {'difficulty': _difficulty},
          files: [await _multipartFile(f)],
          fileName: f.name,
        );
        if (res.duplicate != null) {
          skipped.add('${f.name} (déjà importé)');
        } else {
          started += 1;
        }
      } catch (err) {
        stopReason = errorMessage(err, 'Import impossible.');
        // Quota ou réseau : les fichiers suivants échoueraient aussi.
        break;
      }
    }
    if (mounted) setState(() => _loading = false);
    final lines = [
      started > 0 ? '$started cours en cours de génération : une notification te prévient pour chacun.' : '',
      skipped.isNotEmpty ? 'Ignorés : ${skipped.join(', ')}.' : '',
      stopReason.isNotEmpty ? 'Arrêté : $stopReason' : '',
    ].where((l) => l.isNotEmpty);
    appAlert(started > 0 ? 'Imports lancés' : 'Aucun import lancé', lines.join('\n\n'), [
      AlertButton('OK', onPress: () {
        if (started > 0) Nav.goBack();
      }),
    ]);
  }

  void _removeFile() => setState(() {
        _file = null;
        _data = null;
        _error = '';
      });

  void _onImportJobs() {
    final id = _jobId;
    if (id == null || !mounted) return;
    final job = importJobs.value.where((j) => j.jobId == id).firstOrNull;
    if (job == null || job.status == ImportStatus.processing) return;
    _jobId = null;
    dismissImportJob(job.jobId);
    if (job.status == ImportStatus.error) {
      setState(() {
        _error = job.error ?? 'La génération a échoué. Réessaie.';
        _loading = false;
      });
      return;
    }
    // Toujours sur l'écran : on affiche le cours généré.
    _showGenerated(job.courseId);
  }

  Future<void> _showGenerated(String? courseId) async {
    try {
      if (Api.currentUser == null || courseId == null || courseId.isEmpty) throw Exception('cours manquant');
      final result = await Api.getJson('/api/course/${Uri.encodeComponent(courseId)}', fallback: 'Cours introuvable.');
      if (!mounted) return;
      setState(() {
        _data = {
          'resume': result['summary'],
          'flashcards': result['flashcards'] is List ? result['flashcards'] : const [],
          'quiz': result['quiz'] is List ? result['quiz'] : const [],
          'courseId': result['id'],
          'courseName': result['nom'],
        };
        _activeTab = CourseTab.resume;
      });
    } catch (err) {
      if (mounted) setState(() => _error = errorMessage(err, 'Le cours est prêt, retrouve-le dans « Mes cours ».'));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  /// [replaceId] : régénère ce cours au lieu d'en créer un.
  /// [keepDuplicate] : importe quand même un document déjà importé.
  Future<void> _handleGenerate({String? replaceId, bool keepDuplicate = false}) async {
    final file = _file;
    if (file == null) return;

    if (Api.currentUser == null) {
      appAlert('Session expirée', 'Reconnecte-toi pour importer un cours.');
      return;
    }

    try {
      setState(() {
        _loading = true;
        _error = '';
      });

      final fields = <String, String>{'difficulty': _difficulty};
      // « Régénérer » remplace le cours déjà créé au lieu d'en ajouter un second.
      final current = _data?['courseId'];
      final replace = replaceId ?? (current == null ? null : '$current');
      if (replace != null && replace.isNotEmpty) fields['replace_course_id'] = replace;
      if (keepDuplicate) fields['on_duplicate'] = 'keep';

      final started = await startBackgroundImport(
        fields: fields,
        files: [await _multipartFile(file)],
        fileName: file.name,
      );
      if (!mounted) return;
      final duplicate = started.duplicate;
      if (duplicate != null) {
        setState(() => _loading = false);
        _askAboutDuplicate(duplicate.courseId, duplicate.courseName);
        return;
      }
      setState(() => _jobId = started.job!.jobId);
      // Import déjà terminé entre-temps (peu probable) : traité tout de suite.
      _onImportJobs();
    } catch (err) {
      if (mounted) {
        setState(() {
          _error = errorMessage(err, 'La génération a échoué. Réessaie.');
          _loading = false;
        });
      }
    }
  }

  // Document déjà importé (F52) : rien n'a été généré, l'utilisateur choisit.
  void _askAboutDuplicate(String courseId, String courseName) {
    appAlert('Cours déjà importé', 'Tu as déjà importé ce document : « $courseName ».', [
      AlertButton('Ouvrir le cours', onPress: () => Nav.navigate('CourseDetail', {'courseId': courseId})),
      AlertButton('Le remplacer', style: AlertStyle.destructive, onPress: () => _handleGenerate(replaceId: courseId)),
      AlertButton('Garder les deux', onPress: () => _handleGenerate(keepDuplicate: true)),
      const AlertButton('Annuler', style: AlertStyle.cancel),
    ]);
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final insets = ScreenInsets.of(context);
    final data = _data;
    final generateLabel = _loading
        ? 'Analyse du document…'
        : data != null
            ? 'Régénérer le contenu'
            : 'Générer le contenu';

    return Scaffold(
      backgroundColor: c.background,
      body: Stack(
        children: [
          Positioned.fill(
            child: SingleChildScrollView(
              padding: EdgeInsets.fromLTRB(20, insets.top, 20, insets.bottom + 110),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: gapped([
                  // HEADER
                  Padding(
                    padding: const EdgeInsets.only(bottom: 4),
                    child: Row(
                      children: [
                        CircleIconButton.back(() => Nav.goBack()),
                        const SizedBox(width: 12),
                        Expanded(
                          child: data != null
                              ? Semantics(
                                  header: true,
                                  child: Text('Contenu généré',
                                      style:
                                          TextStyle(fontSize: 20, fontWeight: FontWeight.w700, color: c.textPrimary)),
                                )
                              : Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Semantics(
                                      header: true,
                                      child: Text('Importer un cours',
                                          style: TextStyle(
                                              fontSize: 22, fontWeight: FontWeight.w700, color: c.textPrimary)),
                                    ),
                                    const SizedBox(height: 4),
                                    Text('Cours ou photo → résumé, flashcards & quiz IA',
                                        style: TextStyle(fontSize: 14, color: c.textSecondary)),
                                  ],
                                ),
                        ),
                      ],
                    ),
                  ),

                  if (data == null) ..._pickers(context),

                  // GÉNÉRATION EN COURS : l'utilisateur peut quitter l'écran
                  if (_loading && _jobId != null) _backgroundCard(context),

                  // ERREUR
                  if (_error.isNotEmpty)
                    Semantics(
                      liveRegion: true,
                      child: Container(
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(color: c.tintDanger, borderRadius: BorderRadius.circular(14)),
                        child: Row(
                          children: [
                            Icon(Ionicons.alertCircle, size: 20, color: c.dangerText),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Text(_error,
                                  style: TextStyle(fontSize: 14, fontWeight: FontWeight.w500, color: c.dangerText)),
                            ),
                          ],
                        ),
                      ),
                    ),

                  // RÉSULTAT
                  if (data != null) ..._result(context, data),
                ], 16),
              ),
            ),
          ),

          // BARRE D'ACTIONS FIXE
          Positioned(
            left: 0,
            right: 0,
            bottom: 0,
            child: Container(
              padding: EdgeInsets.fromLTRB(20, 14, 20, insets.bottom + 12),
              decoration: BoxDecoration(
                color: c.surface,
                border: Border(top: BorderSide(color: c.border)),
              ),
              child: Row(
                children: data != null
                    ? [
                        Expanded(
                          child: _BarButton(
                            primary: false,
                            disabled: _loading,
                            semanticLabel: 'Régénérer le contenu',
                            onTap: () => _handleGenerate(),
                            leading: _loading
                                ? _Spinner(color: c.primaryText)
                                : Icon(Ionicons.syncOutline, size: 18, color: c.primaryText),
                            label: _loading ? 'Analyse…' : 'Régénérer',
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: _BarButton(
                            primary: true,
                            onTap: () => Nav.navigate('Revision', {'courseId': data['courseId']}),
                            leading: Icon(Ionicons.play, size: 18, color: c.onAction),
                            label: 'Réviser ce cours',
                          ),
                        ),
                      ]
                    : [
                        Expanded(
                          child: _BarButton(
                            primary: true,
                            disabled: (_file == null && _files.isEmpty) || _loading,
                            onTap: () => _files.isNotEmpty ? _handleGenerateMany() : _handleGenerate(),
                            leading: _loading
                                ? _Spinner(color: c.onAction)
                                : Icon(Ionicons.flashOutline, size: 20, color: c.onAction),
                            label: _files.isNotEmpty && !_loading ? 'Importer ${_files.length} cours' : generateLabel,
                          ),
                        ),
                      ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  List<Widget> _pickers(BuildContext context) {
    final c = context.colors;
    final file = _file;
    final hint = _difficulties.firstWhere((d) => d.value == _difficulty).hint;
    return [
      // ZONE D'IMPORT : entièrement cliquable
      Tappable(
        onTap: _loading ? null : _pickDocument,
        semanticLabel: file != null ? 'Changer de fichier' : 'Choisir un fichier',
        child: DashedBorderBox(
          color: c.primary,
          background: c.tintPrimary,
          radius: 20,
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 28),
          child: ExcludeSemantics(
            child: Column(
              children: [
                Container(
                  width: 64,
                  height: 64,
                  decoration: BoxDecoration(color: c.surface, shape: BoxShape.circle),
                  child: Icon(Ionicons.cloudUploadOutline, size: 30, color: c.primaryDark),
                ),
                const SizedBox(height: 10),
                Text(file != null ? 'Changer de fichier' : 'Choisir un fichier',
                    style: TextStyle(fontSize: 17, fontWeight: FontWeight.w600, color: c.primaryText)),
                const SizedBox(height: 10),
                Text('PDF, Word, PowerPoint ou image · 20 Mo max',
                    textAlign: TextAlign.center, style: TextStyle(fontSize: 13, color: c.textSecondary)),
              ],
            ),
          ),
        ),
      ),

      // PHOTO D'UN POLY OU D'UNE DIAPO
      Tappable(
        onTap: _loading ? null : _takePhoto,
        semanticLabel: 'Prendre en photo une page de cours',
        child: Container(
          constraints: const BoxConstraints(minHeight: 52),
          decoration: BoxDecoration(
            color: c.surface,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: c.border, width: 1.5),
          ),
          child: ExcludeSemantics(
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Ionicons.cameraOutline, size: 20, color: c.primaryText),
                const SizedBox(width: 10),
                Text('Prendre une page en photo',
                    style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: c.primaryText)),
              ],
            ),
          ),
        ),
      ),

      // FICHIER SÉLECTIONNÉ
      if (file != null)
        _FileCard(
          file: file,
          detail: '${_formatSize(file.size)} · prêt à être analysé',
          removeLabel: 'Retirer le fichier',
          onRemove: _loading ? null : _removeFile,
        ),

      // PLUSIEURS FICHIERS
      if (_files.isNotEmpty)
        Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: gapped([
            _InfoTitle('${_files.length} fichiers sélectionnés'),
            for (var i = 0; i < _files.length; i++)
              _FileCard(
                key: ValueKey('${_files[i].path}-$i'),
                file: _files[i],
                detail: _formatSize(_files[i].size),
                removeLabel: 'Retirer ${_files[i].name}',
                onRemove: _loading
                    ? null
                    : () {
                        final index = i;
                        setState(() => _files = [
                              for (var j = 0; j < _files.length; j++)
                                if (j != index) _files[j],
                            ]);
                      },
              ),
          ], 10),
        ),

      // DIFFICULTÉ DU QUIZ
      _Card(
        gap: 10,
        children: [
          const _InfoTitle('Difficulté du quiz'),
          Container(
            padding: const EdgeInsets.all(4),
            decoration: BoxDecoration(color: c.surfaceAlt, borderRadius: BorderRadius.circular(12)),
            child: Row(
              children: gapped([
                for (final d in _difficulties)
                  Expanded(
                    child: Semantics(
                      inMutuallyExclusiveGroup: true,
                      checked: d.value == _difficulty,
                      hint: d.hint,
                      child: Tappable(
                        onTap: _loading ? null : () => setState(() => _difficulty = d.value),
                        button: false,
                        child: Container(
                          constraints: const BoxConstraints(minHeight: 40),
                          alignment: Alignment.center,
                          decoration: BoxDecoration(
                            color: d.value == _difficulty ? c.surface : null,
                            borderRadius: BorderRadius.circular(9),
                            boxShadow: d.value == _difficulty
                                ? [
                                    BoxShadow(
                                        color: Colors.black.withValues(alpha: 0.08),
                                        blurRadius: 3,
                                        offset: const Offset(0, 1)),
                                  ]
                                : null,
                          ),
                          child: Text(
                            d.label,
                            style: TextStyle(
                              fontSize: 14,
                              fontWeight: d.value == _difficulty ? FontWeight.w600 : FontWeight.w500,
                              color: d.value == _difficulty ? c.primaryText : c.textSecondary,
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
              ], 4, axis: Axis.horizontal),
            ),
          ),
          Text(hint, style: TextStyle(fontSize: 13, color: c.textSecondary)),
        ],
      ),

      // CE QUE L'IA VA GÉNÉRER
      _Card(
        gap: 12,
        children: [
          const _InfoTitle('L’IA va générer'),
          for (final item in _aiOutputs)
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(Ionicons.checkmarkCircle, size: 20, color: c.success),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(item.title,
                          style: TextStyle(fontSize: 14, fontWeight: FontWeight.w500, color: c.textPrimary)),
                      const SizedBox(height: 1),
                      Text(item.detail, style: TextStyle(fontSize: 13, color: c.textSecondary)),
                    ],
                  ),
                ),
              ],
            ),
        ],
      ),
    ];
  }

  Widget _backgroundCard(BuildContext context) {
    final c = context.colors;
    return Semantics(
      liveRegion: true,
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(color: c.tintPrimary, borderRadius: BorderRadius.circular(16)),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _Spinner(color: c.primaryDark),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Génération en cours…',
                      style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: c.primaryText)),
                  const SizedBox(height: 4),
                  Text(
                    'Ça peut prendre une minute. Tu peux quitter cet écran : une notification te prévient quand le cours est prêt.',
                    style: TextStyle(fontSize: 13, height: 18 / 13, color: c.primaryText),
                  ),
                  const SizedBox(height: 4),
                  Tappable(
                    onTap: () => Nav.goBack(),
                    child: Container(
                      constraints: const BoxConstraints(minHeight: 40),
                      alignment: Alignment.centerLeft,
                      child: Text(
                        'Continuer ailleurs',
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w700,
                          color: c.primaryText,
                          decoration: TextDecoration.underline,
                          decorationColor: c.primaryText,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  List<Widget> _result(BuildContext context, Map<String, dynamic> data) {
    final c = context.colors;
    final flashcards = data['flashcards'] as List;
    final quiz = data['quiz'] as List;
    final courseId = data['courseId'];
    return [
      Semantics(
        liveRegion: true,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          decoration: BoxDecoration(color: c.tintSuccess, borderRadius: BorderRadius.circular(14)),
          child: Row(
            children: [
              Container(
                width: 28,
                height: 28,
                decoration: BoxDecoration(color: c.success, shape: BoxShape.circle),
                child: Icon(Ionicons.checkmark, size: 16, color: c.onAction),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Cours enregistré',
                        style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: c.successText)),
                    const SizedBox(height: 2),
                    Text('Retrouve-le dans tes stats, rubrique « Mes cours ».',
                        style: TextStyle(fontSize: 13, height: 18 / 13, color: c.successText)),
                  ],
                ),
              ),
              if (courseId != null && '$courseId'.isNotEmpty) ...[
                const SizedBox(width: 12),
                Semantics(
                  link: true,
                  child: Tappable(
                    onTap: () => Nav.navigate('CourseDetail', {'courseId': courseId}),
                    button: false,
                    semanticLabel: 'Voir le cours dans Mes cours',
                    child: Container(
                      constraints: const BoxConstraints(minHeight: 44),
                      padding: const EdgeInsets.only(left: 4),
                      alignment: Alignment.center,
                      child: ExcludeSemantics(
                        child: Text('Voir',
                            style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: c.successText)),
                      ),
                    ),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
      Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text('${data['courseName'] ?? ''}',
              style: TextStyle(fontSize: 24, height: 30 / 24, fontWeight: FontWeight.w700, color: c.textPrimary)),
          // marginTop: -8 sous le titre : 8 px au lieu de 16.
          const SizedBox(height: 8),
          Row(
            children: [
              Icon(Ionicons.documentOutline, size: 16, color: c.textSecondary),
              const SizedBox(width: 6),
              Expanded(
                child: Text(
                  '${_file?.name ?? ''} · ${flashcards.length} flashcards · 1 quiz',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(fontSize: 13, fontWeight: FontWeight.w500, color: c.textSecondary),
                ),
              ),
            ],
          ),
        ],
      ),
      CourseTabs(value: _activeTab, onChange: (t) => setState(() => _activeTab = t)),
      if (_activeTab == CourseTab.resume) SummaryCard(html: '${data['resume'] ?? ''}'),
      if (_activeTab == CourseTab.flashcards) FlashcardList(cards: flashcards),
      if (_activeTab == CourseTab.quiz) QuizList(questions: quiz, mode: QuizListMode.answer),
    ];
  }
}

class _InfoTitle extends StatelessWidget {
  final String text;
  const _InfoTitle(this.text);

  @override
  Widget build(BuildContext context) =>
      Text(text, style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: context.colors.textPrimary));
}

/// Carte blanche à bordure (difficulté, « L’IA va générer »).
class _Card extends StatelessWidget {
  final double gap;
  final List<Widget> children;
  const _Card({required this.gap, required this.children});

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: c.surface,
        border: Border.all(color: c.border),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: gapped(children, gap)),
    );
  }
}

class _FileCard extends StatelessWidget {
  final _PickedFile file;
  final String detail;
  final String removeLabel;
  final VoidCallback? onRemove;
  const _FileCard({super.key, required this.file, required this.detail, required this.removeLabel, this.onRemove});

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Container(
      padding: const EdgeInsets.fromLTRB(14, 12, 8, 12),
      decoration: BoxDecoration(
        color: c.surface,
        border: Border.all(color: c.border),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(color: c.tintSuccess, borderRadius: BorderRadius.circular(12)),
            child: Icon(_fileIcon(file.mimeType), size: 22, color: c.success),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(file.name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: c.textPrimary)),
                const SizedBox(height: 2),
                Text(detail, style: TextStyle(fontSize: 13, color: c.textSecondary)),
              ],
            ),
          ),
          const SizedBox(width: 12),
          Tappable(
            onTap: onRemove,
            semanticLabel: removeLabel,
            child: SizedBox(
              width: 44,
              height: 44,
              child: Icon(Ionicons.close, size: 18, color: c.textSecondary),
            ),
          ),
        ],
      ),
    );
  }
}

/// Bouton de la barre d'actions fixe (plein ou à bordure).
class _BarButton extends StatelessWidget {
  final bool primary;
  final bool disabled;
  final String? semanticLabel;
  final VoidCallback onTap;
  final Widget leading;
  final String label;
  const _BarButton({
    required this.primary,
    this.disabled = false,
    this.semanticLabel,
    required this.onTap,
    required this.leading,
    required this.label,
  });

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Opacity(
      opacity: disabled ? 0.5 : 1,
      child: Tappable(
        onTap: disabled ? null : onTap,
        semanticLabel: semanticLabel ?? label,
        child: Container(
          padding: EdgeInsets.symmetric(horizontal: 12, vertical: primary ? 16 : 15),
          decoration: BoxDecoration(
            color: primary ? c.action : c.surface,
            borderRadius: BorderRadius.circular(14),
            border: primary ? null : Border.all(color: c.primaryDark, width: 1.5),
          ),
          child: ExcludeSemantics(
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                leading,
                SizedBox(width: primary ? 10 : 8),
                Flexible(
                  child: Text(
                    label,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: primary ? 16 : 15,
                      fontWeight: FontWeight.w600,
                      color: primary ? c.onAction : c.primaryText,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// ActivityIndicator (petite taille).
class _Spinner extends StatelessWidget {
  final Color color;
  const _Spinner({required this.color});

  @override
  Widget build(BuildContext context) =>
      SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2.5, color: color));
}
