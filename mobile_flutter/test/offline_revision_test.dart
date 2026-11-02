import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:medflow/services/api.dart';
import 'package:medflow/utils/offline.dart';
import 'package:shared_preferences/shared_preferences.dart';

const _uid = 'u1';

class _FakeUser implements User {
  @override
  String get uid => _uid;

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

final _course = {
  'nom': 'Cardio',
  'quiz': [
    {'question': 'Q0', 'options': {'A': 'a', 'B': 'b'}, 'correct': 'B', 'explanation': 'Parce que B.'},
    {'question': 'Q1', 'options': {'A': 'a', 'B': 'b'}, 'correct': 'A'},
  ],
};

/// Réponses du serveur, dans l'ordre ; les chemins appelés sont notés dans ``calls``.
List<String> _serve(List<Object> responses) {
  final calls = <String>[];
  var i = 0;
  Api.clientFactory = () => MockClient((request) async {
        calls.add(request.url.path);
        final r = responses[i < responses.length ? i++ : responses.length - 1];
        if (r is Exception) throw r;
        return http.Response('{}', r as int);
      });
  return calls;
}

void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));

  group('readOfflineItems', () {
    test('reprend la dernière liste de cartes dues', () async {
      final items = [
        {'course_id': 'c', 'course_nom': 'C', 'item_index': 0, 'question': 'Q', 'options': <String, dynamic>{}},
      ];
      await saveDueItems(_uid, null, items);
      expect(await readOfflineItems(_uid), items);
    });

    test('sinon, toutes les questions du cours gardé sur le téléphone', () async {
      await saveOffline(_uid, courseCacheName('cardio'), _course);
      final items = await readOfflineItems(_uid, 'cardio');
      expect(items.map((i) => i['item_index']).toList(), [0, 1]);
      expect(items[0]['course_nom'], 'Cardio');
    });

    test('liste vide sans rien en cache', () async {
      expect(await readOfflineItems(_uid), isEmpty);
    });
  });

  group('gradeOffline', () {
    test('corrige avec la copie locale du cours', () async {
      await saveOffline(_uid, courseCacheName('cardio'), _course);
      expect(await gradeOffline(_uid, 'cardio', 0, 'A'), {
        'correct': false,
        'correct_answer': 'B',
        'explanation': 'Parce que B.',
      });
      expect((await gradeOffline(_uid, 'cardio', 1, 'A'))?['correct'], isTrue);
    });

    test('null si le cours n’est pas sur le téléphone', () async {
      expect(await gradeOffline(_uid, 'absent', 0, 'A'), isNull);
    });
  });

  group('flushRevisionQueue', () {
    final user = _FakeUser();

    test('envoie les réponses dans l’ordre puis vide la file', () async {
      final calls = _serve([200]);
      await queueAnswer(_uid, {'course_id': 'cardio', 'item_index': 0, 'selected_option': 'A'});
      await queueSessionDone(_uid, {'session_type': 'revision'});
      expect(await flushRevisionQueue(user), 2);
      expect(calls, ['/api/revision/answer', '/api/session-done']);
      expect(await pendingCount(_uid), 0);
    });

    test('garde la file intacte si le réseau est toujours coupé', () async {
      _serve([http.ClientException('Network request failed')]);
      await queueAnswer(_uid, {'course_id': 'cardio', 'item_index': 0, 'selected_option': 'A'});
      expect(await flushRevisionQueue(user), 0);
      expect(await pendingCount(_uid), 1);
    });

    test('s’arrête sur une erreur serveur et garde le reste', () async {
      _serve([200, 503]);
      for (var i = 0; i < 3; i++) {
        await queueAnswer(_uid, {'course_id': 'c', 'item_index': i, 'selected_option': 'A'});
      }
      expect(await flushRevisionQueue(user), 1);
      expect(await pendingCount(_uid), 2);
    });

    test('abandonne une réponse refusée par le serveur (cours supprimé)', () async {
      _serve([404]);
      await queueAnswer(_uid, {'course_id': 'supprime', 'item_index': 0, 'selected_option': 'A'});
      expect(await flushRevisionQueue(user), 1);
      expect(await pendingCount(_uid), 0);
    });
  });
}
