import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:provider/provider.dart';
import 'package:medflow/theme/theme_controller.dart';
import 'package:medflow/widgets/progress/activity_calendar.dart';
import 'package:medflow/widgets/progress/progress_dashboard.dart';
import 'package:medflow/widgets/social/avatar_bubble.dart';
import 'package:medflow/widgets/social/challenge_section.dart';

// Copie de components/__tests__/ActivityCalendar.test.tsx et
// components/challenge/__tests__/ChallengeSection.test.tsx (partie sans réseau).

const _base = <String, dynamic>{
  'id': 1,
  'role': 'opponent',
  'friend_uid': 'bob',
  'friend_name': 'Bob',
  'course_nom': 'Cardio',
  'total': 5,
  'status': 'pending',
  'my_score': null,
  'their_score': null,
  'outcome': null,
  'can_play': true,
};

Widget _app(Widget child) => ChangeNotifierProvider.value(
      value: ThemeController(),
      child: MaterialApp(home: Scaffold(body: SingleChildScrollView(child: child))),
    );

void main() {
  setUpAll(() => initializeDateFormatting('fr_FR'));

  group('ActivityCalendar', () {
    for (final (count, level) in const [(0, 0), (1, 1), (5, 2), (15, 3), (40, 4)]) {
      test('$count activités → niveau $level', () => expect(activityLevel(count), level));
    }

    test('aligne chaque ligne sur un jour de la semaine (lundi en haut)', () {
      // 2026-10-28 est un mercredi : 2 cases vides (lundi, mardi) avant.
      final days = [
        for (var i = 0; i < 10; i++)
          {
            'date': '2026-10-${(28 + i).toString().padLeft(2, '0')}'.replaceAll('-10-32', '-11-01'),
            'count': i,
          },
      ];
      final weeks = toWeeks(days);
      expect(weeks[0].sublist(0, 2), [null, null]);
      expect(weeks[0][2]?['date'], '2026-10-28');
      expect(weeks[0], hasLength(7));
      expect(weeks[1][0]?['count'], 5);
    });
  });

  group('challengeStatusText', () {
    final cases = [
      (_base, 'À toi de jouer'),
      ({..._base, 'role': 'challenger', 'can_play': false, 'my_score': 3}, 'En attente de Bob'),
      (
        {..._base, 'status': 'done', 'can_play': false, 'my_score': 4, 'their_score': 2, 'outcome': 'win'},
        'Gagné 4 à 2'
      ),
      (
        {..._base, 'status': 'done', 'can_play': false, 'my_score': 1, 'their_score': 2, 'outcome': 'loss'},
        'Perdu 1 à 2'
      ),
      ({..._base, 'status': 'expired', 'can_play': false}, 'Expiré'),
    ];
    for (var i = 0; i < cases.length; i++) {
      test('$i', () => expect(challengeStatusText(cases[i].$1), cases[i].$2));
    }
  });

  testWidgets('tableau de progression : chiffres, série et objectif hebdomadaire', (tester) async {
    await tester.pumpWidget(_app(const ProgressDashboard(
      totalLessons: 20,
      completedLessons: 5,
      totalXP: 340,
      currentStreak: 3,
      weeklyGoal: 4,
      weeklyProgress: 2,
    )));
    expect(find.text('340'), findsOneWidget);
    expect(find.text('Jours de série'), findsOneWidget);
    expect(find.text('25%'), findsOneWidget);
    expect(find.text('2 / 4 leçons cette semaine'), findsOneWidget);
    expect(find.bySemanticsLabel('340 points XP'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('avatar sans photo : initiale', (tester) async {
    await tester.pumpWidget(_app(const AvatarBubble(displayName: 'bob', size: 34)));
    expect(find.bySemanticsLabel('Photo de profil de bob'), findsOneWidget);
  });
}
