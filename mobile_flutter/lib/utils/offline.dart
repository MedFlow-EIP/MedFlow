import 'dart:async';

import 'package:firebase_auth/firebase_auth.dart';

import '../services/api.dart';
import '../services/storage.dart';

// Cache local des cours pour la consultation hors ligne, toujours rangé par
// utilisateur (copie de utils/offlineCache.ts), et révision hors ligne (F74,
// copie de utils/offlineRevision.ts) : la dernière liste de cartes dues est
// gardée sur le téléphone, les réponses sont corrigées avec la copie locale
// du cours, puis envoyées au serveur au retour du réseau.

String _key(String uid, String name) => '@offline:$uid:$name';

Future<void> saveOffline(String uid, String name, Object? value) =>
    Storage.setJson(_key(uid, name), {'savedAt': DateTime.now().millisecondsSinceEpoch, 'value': value});

Future<dynamic> readOffline(String uid, String name) async {
  final raw = await Storage.getJson(_key(uid, name));
  return raw is Map ? raw['value'] : null;
}

Future<void> removeOffline(String uid, String name) => Storage.remove(_key(uid, name));

String courseCacheName(String courseId) => 'course:$courseId';
const dashboardCacheName = 'dashboard';

// ---------------------------------------------------------------- Révision

const _queueName = 'revision-queue';
// Au-delà, on garde les plus récentes : une file infinie remplirait le stockage.
const _maxQueue = 500;

String dueCacheName([String? courseId]) => 'revision-due:${(courseId == null || courseId.isEmpty) ? 'all' : courseId}';

/// Carte de révision (question de quiz d'un cours).
/// Les champs sont ceux renvoyés par /api/revision/due.
typedef RevisionItem = Map<String, dynamic>;

Future<void> saveDueItems(String uid, String? courseId, List<RevisionItem> items) =>
    saveOffline(uid, dueCacheName(courseId), items);

/// Cartes à réviser sans réseau : la dernière liste de cartes dues connue,
/// sinon toutes les questions des cours gardés sur le téléphone.
Future<List<RevisionItem>> readOfflineItems(String uid, [String? courseId]) async {
  final cached = await readOffline(uid, dueCacheName(courseId));
  if (cached is List && cached.isNotEmpty) return cached.whereType<Map>().map((m) => m.cast<String, dynamic>()).toList();
  if (courseId == null || courseId.isEmpty) return [];
  final course = await readOffline(uid, courseCacheName(courseId));
  if (course is! Map || course['quiz'] is! List) return [];
  final quiz = course['quiz'] as List;
  return [
    for (var i = 0; i < quiz.length; i++)
      {
        'course_id': courseId,
        'course_nom': course['nom'] ?? '',
        'item_index': i,
        'question': quiz[i]['question'],
        'options': quiz[i]['options'] ?? {},
      },
  ];
}

/// Correction locale à partir de la copie du cours (null si le cours n'est pas sur le téléphone).
Future<Map<String, dynamic>?> gradeOffline(String uid, String courseId, int itemIndex, String selectedOption) async {
  final course = await readOffline(uid, courseCacheName(courseId));
  if (course is! Map || course['quiz'] is! List) return null;
  final quiz = course['quiz'] as List;
  if (itemIndex < 0 || itemIndex >= quiz.length) return null;
  final question = quiz[itemIndex];
  if (question is! Map || question['correct'] == null) return null;
  return {
    'correct': question['correct'] == selectedOption,
    'correct_answer': question['correct'],
    'explanation': question['explanation'],
  };
}

Future<List<Map<String, dynamic>>> _readQueue(String uid) async {
  final q = await readOffline(uid, _queueName);
  return q is List ? q.whereType<Map>().map((m) => m.cast<String, dynamic>()).toList() : [];
}

Future<void> _enqueue(String uid, String path, Map<String, dynamic> body) async {
  final queue = await _readQueue(uid);
  queue.add({'path': path, 'body': body, 'queuedAt': DateTime.now().millisecondsSinceEpoch});
  final trimmed = queue.length > _maxQueue ? queue.sublist(queue.length - _maxQueue) : queue;
  await saveOffline(uid, _queueName, trimmed);
}

Future<void> queueAnswer(String uid, Map<String, dynamic> body) => _enqueue(uid, '/api/revision/answer', body);

Future<void> queueSessionDone(String uid, Map<String, dynamic> body) => _enqueue(uid, '/api/session-done', body);

Future<int> pendingCount(String uid) async => (await _readQueue(uid)).length;

Future<int>? _flushing;

/// Envoie les réponses en attente, dans l'ordre. S'arrête à la première coupure
/// réseau ; une requête refusée par le serveur est abandonnée. Renvoie le
/// nombre de requêtes envoyées.
Future<int> flushRevisionQueue([User? user]) {
  final u = user ?? FirebaseAuth.instance.currentUser;
  if (u == null) return Future.value(0);
  return _flushing ??= _doFlush(u).whenComplete(() => _flushing = null);
}

Future<int> _doFlush(User user) async {
  final queue = await _readQueue(user.uid);
  if (queue.isEmpty) return 0;
  var done = 0;
  try {
    for (final request in queue) {
      final res = await Api.post(request['path'] as String, request['body']);
      if (res.statusCode >= 500) break; // serveur en difficulté : on réessaiera
      done += 1;
    }
  } catch (_) {
    // Toujours hors ligne : on garde le reste pour la prochaine fois.
  }
  // Relit la file : des réponses ont pu s'ajouter pendant l'envoi.
  final latest = await _readQueue(user.uid);
  await saveOffline(user.uid, _queueName, latest.sublist(done.clamp(0, latest.length)));
  return done;
}
