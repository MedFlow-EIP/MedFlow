import 'package:flutter_test/flutter_test.dart';
import 'package:medflow/utils/push_notifications.dart';
import 'package:medflow/utils/reminders.dart';
import 'package:medflow/utils/social_notifications.dart';

Map<String, dynamic> _summary(List<String> requests, [List<int> challenges = const []]) => {
      'friend_requests': [
        for (final name in requests) {'uid': name.toLowerCase(), 'displayName': name},
      ],
      'challenges': [
        for (final id in challenges) {'id': id, 'friend_name': 'Bob', 'course_nom': 'Cardio'},
      ],
    };

void main() {
  test('newItems ignore ce qui a déjà été vu', () {
    final items = newItems(_summary(['Alice'], [3]), {'fr:alice'});
    expect(items.map((i) => i.id).toList(), ['ch:3']);
    expect(items[0].body, 'Bob te défie sur « Cardio ».');
  });

  group('notificationTarget', () {
    test('ouvre l’écran indiqué par la notification', () {
      expect(notificationTarget({'screen': 'CourseDetail', 'courseId': 'c1'})?.screen, 'CourseDetail');
      expect(notificationTarget({'courseId': 'c2'})?.params, {'courseId': 'c2'});
      expect(notificationTarget({'screen': 'Challenge', 'challengeId': 4})?.params, {'challengeId': 4});
      expect(notificationTarget({'screen': 'Friends'})?.screen, 'Friends');
      expect(notificationTarget({'screen': 'ClinicalCase', 'caseId': 3})?.params, {'caseId': 3});
    });

    test('relit les identifiants envoyés en chaîne par FCM', () {
      expect(notificationTarget({'screen': 'Challenge', 'challengeId': '4'})?.params, {'challengeId': 4});
      expect(notificationTarget({'screen': 'ClinicalCase', 'caseId': '3'})?.params, {'caseId': 3});
      expect(notificationTarget({'screen': 'Challenge', 'challengeId': 'abc'}), isNull);
    });

    test('rien pour une notification inconnue', () {
      expect(notificationTarget({'screen': 'Inconnu'}), isNull);
      expect(notificationTarget(null), isNull);
    });
  });

  test('reminderDate place le rappel à 9h, N jours avant, en heure locale', () {
    final d = reminderDate('2026-11-10', 7);
    expect([d.year, d.month, d.day, d.hour], [2026, 11, 3, 9]);
  });

  test('countdownLabel', () {
    expect(countdownLabel(-2), 'Passé');
    expect(countdownLabel(0), "Aujourd'hui");
    expect(countdownLabel(1), 'Demain');
    expect(countdownLabel(12), 'J-12');
  });
}
