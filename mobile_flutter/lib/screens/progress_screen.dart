import 'package:flutter/material.dart';
import 'package:ionicons/ionicons.dart';

import '../navigation/nav.dart';
import '../services/api.dart';
import '../theme/colors.dart';
import '../theme/theme_controller.dart';
import '../widgets/insets.dart';
import '../widgets/progress/activity_calendar.dart';
import '../widgets/progress/progress_dashboard.dart';
import '../widgets/progress/specialty_stats.dart';
import '../widgets/ui.dart';

class _ProgressData {
  final int totalLessons;
  final int completedLessons;
  final int totalXP;
  final int currentStreak;
  final int weeklyGoal;
  final int weeklyProgress;
  const _ProgressData({
    required this.totalLessons,
    required this.completedLessons,
    required this.totalXP,
    required this.currentStreak,
    required this.weeklyGoal,
    required this.weeklyProgress,
  });
}

int _int(dynamic v) => v is num ? v.toInt() : 0;

class ProgressScreen extends StatefulWidget {
  const ProgressScreen({super.key});

  @override
  State<ProgressScreen> createState() => _ProgressScreenState();
}

class _ProgressScreenState extends State<ProgressScreen> with FocusRefresh<ProgressScreen> {
  _ProgressData? _data;
  bool _loading = true;
  bool _error = false;

  @override
  void onFocus() {
    setState(() => _loading = true);
    _load();
  }

  Future<void> _load() async {
    if (Api.currentUser == null) {
      setState(() => _loading = false);
      return;
    }

    setState(() => _error = false);
    try {
      final results = await Future.wait([Api.get('/api/account'), Api.get('/api/paths')]);
      final accountRes = results[0];
      final pathsRes = results[1];

      bool ok(int s) => s >= 200 && s < 300;
      if (!ok(accountRes.statusCode) || !ok(pathsRes.statusCode)) {
        throw Exception('account=${accountRes.statusCode} paths=${pathsRes.statusCode}');
      }

      final account = decodeBody(accountRes);
      final pathsData = decodeBody(pathsRes);
      final paths = (pathsData is Map ? pathsData['paths'] as List? : null) ?? const [];

      final totalLessons = paths.fold<int>(0, (sum, p) => sum + _int((p as Map)['totalLessons']));
      final completedLessons = paths.fold<int>(0, (sum, p) => sum + _int((p as Map)['completedLessons']));

      final stats = account is Map && account['stats'] is Map ? account['stats'] as Map : const {};
      if (!mounted) return;
      setState(() {
        _data = _ProgressData(
          totalLessons: totalLessons,
          completedLessons: completedLessons,
          totalXP: _int(stats['xp']),
          currentStreak: _int(stats['streak']),
          weeklyGoal: _int(stats['weeklyGoal']),
          weeklyProgress: _int(stats['weeklyProgress']),
        );
      });
    } catch (e) {
      debugPrint('Erreur chargement progression: $e');
      if (mounted) setState(() => _error = true);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final insets = ScreenInsets.of(context);
    final data = _data;

    Widget? body;
    if (_loading) {
      body = Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: CircularProgressIndicator(color: c.primary, semanticsLabel: 'Chargement de la progression'),
        ),
      );
    } else if (_error) {
      body = _stateCard(c, [
        Icon(Ionicons.alert_circle_outline, size: 48, color: c.warning),
        _stateTitle(c, 'Impossible de charger ta progression'),
        _stateText(c, 'Vérifie ta connexion et réessaie dans un instant.'),
        _retryButton(c),
      ]);
    } else if (data != null && data.totalLessons == 0) {
      body = _stateCard(c, [
        Icon(Ionicons.stats_chart_outline, size: 48, color: c.muted),
        _stateTitle(c, 'Pas encore de progression'),
        _stateText(c, 'Importe un cours pour commencer à suivre tes leçons et ton XP ici.'),
      ]);
    } else if (data != null) {
      body = ListView(
        padding: EdgeInsets.fromLTRB(20, 20, 20, insets.bottom + 16),
        children: [
          ProgressDashboard(
            totalLessons: data.totalLessons,
            completedLessons: data.completedLessons,
            totalXP: data.totalXP,
            currentStreak: data.currentStreak,
            weeklyGoal: data.weeklyGoal,
            weeklyProgress: data.weeklyProgress,
          ),
          const ActivityCalendar(),
          const SpecialtyStats(),
        ],
      );
    }

    return Scaffold(
      backgroundColor: c.background,
      body: Padding(
        padding: EdgeInsets.only(top: insets.top),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 12),
              child: Row(
                children: [
                  CircleIconButton.back(Nav.goBack),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Semantics(
                          header: true,
                          child: Text('Ta progression',
                              style: TextStyle(fontSize: 22, fontWeight: FontWeight.w700, color: c.textPrimary)),
                        ),
                        const SizedBox(height: 4),
                        Text('Suivi de tes leçons et de ton XP',
                            style: TextStyle(fontSize: 14, color: c.textSecondary)),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            if (body != null) Expanded(child: body),
          ],
        ),
      ),
    );
  }

  /// Carte d'état (erreur, vide), en haut du contenu.
  Widget _stateCard(AppColors c, List<Widget> children) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: Container(
        padding: const EdgeInsets.all(32),
        decoration: BoxDecoration(color: c.surface, borderRadius: BorderRadius.circular(16)),
        child: Column(
          children: [
            for (var i = 0; i < children.length; i++) ...[
              if (i > 0) const SizedBox(height: 12),
              children[i],
            ],
          ],
        ),
      ),
    );
  }

  Widget _stateTitle(AppColors c, String text) =>
      Text(text, style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: c.textPrimary));

  Widget _stateText(AppColors c, String text) =>
      Text(text, textAlign: TextAlign.center, style: TextStyle(fontSize: 14, color: c.textSecondary));

  Widget _retryButton(AppColors c) {
    return Padding(
      padding: const EdgeInsets.only(top: 8),
      child: Tappable(
        onTap: _load,
        semanticLabel: 'Réessayer',
        child: ExcludeSemantics(
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
            decoration: BoxDecoration(
              color: c.action,
              borderRadius: BorderRadius.circular(12),
              boxShadow: [
                BoxShadow(color: c.primary.withOpacity(0.2), blurRadius: 8, offset: const Offset(0, 4)),
              ],
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Ionicons.refresh, size: 18, color: c.onAction),
                const SizedBox(width: 8),
                Text('Réessayer', style: TextStyle(color: c.onAction, fontSize: 15, fontWeight: FontWeight.w600)),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
