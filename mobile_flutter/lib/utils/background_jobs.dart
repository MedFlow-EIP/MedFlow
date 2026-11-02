import 'dart:async';

import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/widgets.dart';
import 'package:http/http.dart' as http;

import '../services/api.dart';
import '../services/notifications.dart';
import '../services/storage.dart';
import 'analytics.dart';
import 'push_notifications.dart';

// Imports de cours et cas cliniques générés en arrière-plan : le serveur
// travaille pendant que l'utilisateur navigue ; l'app suit l'avancement et
// prévient quand c'est prêt. Les travaux en cours sont gardés sur le
// téléphone : le suivi reprend si l'app est relancée.
// Copie de utils/importJobs.ts, utils/caseJobs.ts et utils/jobBanner.ts.

const _pollInterval = Duration(seconds: 4);

bool get _appActive => WidgetsBinding.instance.lifecycleState == AppLifecycleState.resumed;

// ---------------------------------------------------------------- Imports

enum ImportStatus { processing, done, error }

class ImportJob {
  final String jobId;
  final String fileName;
  final ImportStatus status;
  final String? courseId;
  final String? courseNom;
  final String? error;
  const ImportJob({
    required this.jobId,
    required this.fileName,
    required this.status,
    this.courseId,
    this.courseNom,
    this.error,
  });
}

class DuplicateInfo {
  final String courseId;
  final String courseName;
  const DuplicateInfo(this.courseId, this.courseName);
}

/// Imports suivis (en cours et terminés depuis l'ouverture de l'app).
final ValueNotifier<List<ImportJob>> importJobs = ValueNotifier(const []);
final Set<String> _pollingImports = {};

String _importKey(String uid) => '@import_jobs:$uid';

void _upsertImport(ImportJob job) {
  importJobs.value = [...importJobs.value.where((j) => j.jobId != job.jobId), job];
}

Future<void> _persistImports(String uid) => Storage.setJson(_importKey(uid), [
      for (final j in importJobs.value.where((j) => j.status == ImportStatus.processing))
        {'jobId': j.jobId, 'fileName': j.fileName},
    ]);

Future<void> _notifyImport(ImportJob job) async {
  // App ouverte : le bandeau dans l'app suffit. Avec les push, le serveur prévient déjà.
  if (_appActive || isPushActive()) return;
  if (!await Notifs.isGranted()) return;
  if (job.status == ImportStatus.done) {
    await Notifs.show('✅ Cours prêt', '« ${job.courseNom ?? job.fileName} » est prêt à réviser.',
        data: {'courseId': job.courseId});
  } else {
    await Notifs.show('Import échoué', '${job.fileName} : ${job.error ?? 'la génération a échoué.'}');
  }
}

void _pollImport(User user, String jobId) {
  if (!_pollingImports.add(jobId)) return;
  Future<void> tick() async {
    try {
      final res = await Api.get('/api/process/jobs/$jobId');
      if (res.statusCode == 404) {
        // Import inconnu (compte supprimé, base réinitialisée…) : on arrête de le suivre.
        importJobs.value = importJobs.value.where((j) => j.jobId != jobId).toList();
        _pollingImports.remove(jobId);
        await _persistImports(user.uid);
        return;
      }
      final data = decodeBody(res);
      if (data is Map && data['status'] != null && data['status'] != 'processing') {
        final current = importJobs.value.where((j) => j.jobId == jobId).firstOrNull;
        final done = ImportJob(
          jobId: jobId,
          fileName: (data['file_name'] ?? current?.fileName ?? 'Cours') as String,
          status: data['status'] == 'done' ? ImportStatus.done : ImportStatus.error,
          courseId: data['course_id'] as String?,
          courseNom: data['course_nom'] as String?,
          error: data['error'] as String?,
        );
        _upsertImport(done);
        logEvent(done.status == ImportStatus.done ? 'import_done' : 'import_failed');
        _pollingImports.remove(jobId);
        await _persistImports(user.uid);
        await _notifyImport(done);
        return;
      }
    } catch (_) {
      // Réseau coupé : on réessaie au prochain tour.
    }
    if (FirebaseAuth.instance.currentUser?.uid != user.uid) {
      _pollingImports.remove(jobId);
      return;
    }
    Timer(_pollInterval, tick);
  }

  Timer(_pollInterval, tick);
}

/// Lance la génération en arrière-plan. Renvoie le job créé, ou les infos du
/// cours déjà importé (même document). Lève une UserFacingError sinon.
Future<({ImportJob? job, DuplicateInfo? duplicate})> startBackgroundImport({
  required Map<String, String> fields,
  required List<http.MultipartFile> files,
  required String fileName,
}) async {
  final user = FirebaseAuth.instance.currentUser!;
  final res = await Api.multipart(
    '/api/process',
    fields: {...fields, 'background': '1'},
    files: files,
    // Envoi du fichier (et lecture du texte) seulement : la génération suit en arrière-plan.
    timeout: const Duration(seconds: 120),
  );
  final body = decodeBody(res);
  if (res.statusCode == 409 && body is Map && body['code'] == 'duplicate') {
    return (job: null, duplicate: DuplicateInfo('${body['course_id']}', '${body['nom'] ?? ''}'));
  }
  if (res.statusCode != 202 || body is! Map || body['job_id'] == null) {
    throw UserFacingError(httpErrorMessage(res.statusCode, body, 'Import impossible. Réessaie.'), res.statusCode);
  }
  // Pour prévenir quand le cours sera prêt (demandé une fois, au premier import).
  unawaited(Notifs.requestPermission());
  final job = ImportJob(jobId: '${body['job_id']}', fileName: fileName, status: ImportStatus.processing);
  _upsertImport(job);
  logEvent('import_started', fileName.split('.').last.toLowerCase());
  await _persistImports(user.uid);
  _pollImport(user, job.jobId);
  return (job: job, duplicate: null);
}

void dismissImportJob(String jobId) {
  importJobs.value = importJobs.value.where((j) => j.jobId != jobId).toList();
}

// ---------------------------------------------------------------- Cas cliniques

enum CaseStatus { generating, ready, error }

class CaseJob {
  final int caseId;
  final String label;
  final CaseStatus status;
  final String? title;
  const CaseJob({required this.caseId, required this.label, required this.status, this.title});
}

/// Cas suivis (en préparation et terminés depuis l'ouverture de l'app).
final ValueNotifier<List<CaseJob>> caseJobs = ValueNotifier(const []);
final Set<int> _pollingCases = {};

String _caseKey(String uid) => '@case_jobs:$uid';

void _upsertCase(CaseJob job) {
  caseJobs.value = [...caseJobs.value.where((j) => j.caseId != job.caseId), job];
}

Future<void> _persistCases(String uid) => Storage.setJson(_caseKey(uid), [
      for (final j in caseJobs.value.where((j) => j.status == CaseStatus.generating))
        {'caseId': j.caseId, 'label': j.label},
    ]);

Future<void> _notifyCase(CaseJob job) async {
  if (_appActive || isPushActive()) return;
  if (!await Notifs.isGranted()) return;
  if (job.status == CaseStatus.ready) {
    await Notifs.show('🩺 Cas clinique prêt', job.title ?? job.label,
        data: {'screen': 'ClinicalCase', 'caseId': job.caseId});
  } else {
    await Notifs.show('Cas clinique non créé', '${job.label} : réessaie dans un instant.');
  }
}

void _pollCase(User user, int caseId) {
  if (!_pollingCases.add(caseId)) return;
  Future<void> tick() async {
    try {
      final res = await Api.get('/api/cases/$caseId');
      if (res.statusCode == 404) {
        caseJobs.value = caseJobs.value.where((j) => j.caseId != caseId).toList();
        _pollingCases.remove(caseId);
        await _persistCases(user.uid);
        return;
      }
      final data = decodeBody(res);
      if (data is Map && data['status'] != null && data['status'] != 'generating') {
        final current = caseJobs.value.where((j) => j.caseId == caseId).firstOrNull;
        final done = CaseJob(
          caseId: caseId,
          label: current?.label ?? '${data['source_label'] ?? ''}',
          status: data['status'] == 'ready' ? CaseStatus.ready : CaseStatus.error,
          title: data['title'] as String?,
        );
        _upsertCase(done);
        _pollingCases.remove(caseId);
        await _persistCases(user.uid);
        await _notifyCase(done);
        return;
      }
    } catch (_) {
      // Réseau coupé : on réessaie au prochain tour.
    }
    if (FirebaseAuth.instance.currentUser?.uid != user.uid) {
      _pollingCases.remove(caseId);
      return;
    }
    Timer(_pollInterval, tick);
  }

  Timer(_pollInterval, tick);
}

/// Lance la préparation d'un cas (cours ou sujet). Renvoie l'identifiant du cas.
Future<int> startBackgroundCase({String? courseId, String? topic, required String difficulty, required String label}) async {
  final user = FirebaseAuth.instance.currentUser!;
  final res = await Api.post('/api/cases', {
    if (courseId != null) 'course_id': courseId,
    if (topic != null) 'topic': topic,
    'difficulty': difficulty,
    'background': true,
  });
  final body = decodeBody(res);
  if (res.statusCode != 202 || body is! Map || body['id'] is! num) {
    throw UserFacingError(httpErrorMessage(res.statusCode, body, 'Le cas n’a pas pu être lancé.'), res.statusCode);
  }
  unawaited(Notifs.requestPermission());
  final id = (body['id'] as num).toInt();
  _upsertCase(CaseJob(caseId: id, label: label, status: CaseStatus.generating));
  logEvent('case_started', courseId != null ? 'cours' : 'sujet');
  await _persistCases(user.uid);
  _pollCase(user, id);
  return id;
}

// ---------------------------------------------------------------- Reprise / déconnexion

/// À l'ouverture de l'app : reprend le suivi des travaux encore en cours.
Future<void> resumeBackgroundJobs(User user) async {
  final imports = await Storage.getJson(_importKey(user.uid));
  if (imports is List) {
    for (final p in imports.whereType<Map>()) {
      final id = '${p['jobId']}';
      if (!importJobs.value.any((j) => j.jobId == id)) {
        _upsertImport(ImportJob(jobId: id, fileName: '${p['fileName']}', status: ImportStatus.processing));
      }
      _pollImport(user, id);
    }
  }
  final cases = await Storage.getJson(_caseKey(user.uid));
  if (cases is List) {
    for (final p in cases.whereType<Map>()) {
      final id = (p['caseId'] as num).toInt();
      if (!caseJobs.value.any((j) => j.caseId == id)) {
        _upsertCase(CaseJob(caseId: id, label: '${p['label']}', status: CaseStatus.generating));
      }
      _pollCase(user, id);
    }
  }
}

/// Déconnexion : on oublie les travaux suivis en mémoire.
void resetBackgroundJobs() {
  importJobs.value = const [];
  caseJobs.value = const [];
}

// ---------------------------------------------------------------- Bandeau « c'est prêt »

class BannerJob {
  final String key;
  final bool pending;
  final bool ok;
  final String title;
  final ({String screen, Map<String, dynamic> params})? target;
  const BannerJob({required this.key, required this.pending, required this.ok, required this.title, this.target});
}

List<BannerJob> bannerJobs(List<ImportJob> imports, List<CaseJob> cases) => [
      for (final j in imports)
        BannerJob(
          key: 'import:${j.jobId}',
          pending: j.status == ImportStatus.processing,
          ok: j.status == ImportStatus.done,
          title: j.status == ImportStatus.done
              ? '« ${j.courseNom ?? j.fileName} » est prêt'
              : 'Import de « ${j.fileName} » échoué',
          target: j.status == ImportStatus.done && j.courseId != null
              ? (screen: 'CourseDetail', params: {'courseId': j.courseId})
              : null,
        ),
      for (final j in cases)
        BannerJob(
          key: 'case:${j.caseId}',
          pending: j.status == CaseStatus.generating,
          ok: j.status == CaseStatus.ready,
          title: j.status == CaseStatus.ready
              ? 'Cas clinique prêt : ${j.title ?? j.label}'
              : 'Cas clinique non créé (${j.label})',
          target: j.status == CaseStatus.ready ? (screen: 'ClinicalCase', params: {'caseId': j.caseId}) : null,
        ),
    ];

/// Travaux vus en cours et désormais terminés. Met à jour ``wasPending``.
List<BannerJob> newlyFinished(Set<String> wasPending, List<BannerJob> jobs) {
  final finished = jobs.where((j) => !j.pending && wasPending.contains(j.key)).toList();
  wasPending
    ..clear()
    ..addAll(jobs.where((j) => j.pending).map((j) => j.key));
  return finished;
}
