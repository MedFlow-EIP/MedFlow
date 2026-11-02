import 'package:flutter/material.dart';

import '../screens/auth/forgot_password_screen.dart';
import '../screens/auth/register_screen.dart';
import '../screens/challenge_screen.dart';
import '../screens/clinical_case_screen.dart';
import '../screens/clinical_cases_screen.dart';
import '../screens/course_detail_screen.dart';
import '../screens/documents_screen.dart';
import '../screens/exams_screen.dart';
import '../screens/flashcard_review_screen.dart';
import '../screens/friends_screen.dart';
import '../screens/leaderboard_screen.dart';
import '../screens/legal_screen.dart';
import '../screens/lesson_screen.dart';
import '../screens/mastered_screen.dart';
import '../screens/mock_exam_screen.dart';
import '../screens/path_screen.dart';
import '../screens/progress_screen.dart';
import '../screens/revision_screen.dart';
import '../screens/search_screen.dart';
import '../screens/settings_screen.dart';
import '../screens/upload_course_screen.dart';

/// Écrans empilés, par nom (mêmes noms que RootStackParamList de l'app RN).
/// Les paramètres se lisent dans l'écran avec `routeParams(context)`.
final Map<String, Widget Function()> appRoutes = {
  'Register': () => const RegisterScreen(),
  'ForgotPassword': () => const ForgotPasswordScreen(),
  'UploadCourse': () => const UploadCourseScreen(),
  'Path': () => const PathScreen(),
  'Lesson': () => const LessonScreen(),
  'CourseDetail': () => const CourseDetailScreen(),
  'Settings': () => const SettingsScreen(),
  'Legal': () => const LegalScreen(),
  'Progress': () => const ProgressScreen(),
  'Leaderboard': () => const LeaderboardScreen(),
  'Friends': () => const FriendsScreen(),
  'Revision': () => const RevisionScreen(),
  'Search': () => const SearchScreen(),
  'Mastered': () => const MasteredScreen(),
  'Exams': () => const ExamsScreen(),
  'MockExam': () => const MockExamScreen(),
  'Challenge': () => const ChallengeScreen(),
  'FlashcardReview': () => const FlashcardReviewScreen(),
  'Documents': () => const DocumentsScreen(),
  'ClinicalCases': () => const ClinicalCasesScreen(),
  'ClinicalCase': () => const ClinicalCaseScreen(),
  'LessonScreen': () => const LessonScreen(),
};

Route<dynamic>? onGenerateRoute(RouteSettings settings) {
  final builder = appRoutes[settings.name];
  if (builder == null) return null;
  return MaterialPageRoute(settings: settings, builder: (_) => builder());
}
