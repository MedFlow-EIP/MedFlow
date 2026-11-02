import 'package:flutter/material.dart';
import 'package:ionicons/ionicons.dart';

import '../../theme/colors.dart';
import '../../theme/theme_controller.dart';
import '../ui.dart';

/// Chiffres clés (XP, leçons, série) et barres de progression globale et
/// hebdomadaire (copie de components/ProgressDashboard.tsx).
class ProgressDashboard extends StatelessWidget {
  final int totalLessons;
  final int completedLessons;
  final int totalXP;
  final int? currentStreak;
  final int? weeklyGoal;
  final int? weeklyProgress;
  const ProgressDashboard({
    super.key,
    required this.totalLessons,
    required this.completedLessons,
    required this.totalXP,
    this.currentStreak,
    this.weeklyGoal,
    this.weeklyProgress,
  });

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final completionPercentage = totalLessons > 0 ? (completedLessons / totalLessons * 100).round() : 0;

    final hasStreak = currentStreak != null;
    final hasWeeklyGoal = weeklyGoal != null && weeklyGoal! > 0 && weeklyProgress != null;
    final weeklyPercentage = hasWeeklyGoal ? (weeklyProgress! / weeklyGoal! * 100).round() : 0;

    final xpCard = _statCard(c,
        label: '$totalXP points XP',
        tint: c.tintPrimary,
        icon: Ionicons.star_outline,
        iconColor: c.primary,
        number: totalXP,
        text: 'Points XP');
    final lessonsCard = _statCard(c,
        label: '$completedLessons leçons complétées',
        tint: c.tintSuccess,
        icon: Ionicons.checkmark_circle_outline,
        iconColor: c.success,
        number: completedLessons,
        text: 'Leçons complétées');
    final streakCard = hasStreak
        ? _statCard(c,
            label: '$currentStreak jours de série',
            tint: c.tintWarning,
            icon: Ionicons.flame_outline,
            iconColor: c.warning,
            number: currentStreak!,
            text: 'Jours de série')
        : null;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // Grille flexWrap (minWidth 48 %, flex 1, gap 12) : XP et leçons côte à
        // côte, la série seule sur toute la largeur en dessous. Sur un écran
        // trop étroit pour deux cartes de 48 %, une carte par ligne.
        // Entre deux lignes : gap 12 + marginBottom 12 de la carte.
        LayoutBuilder(builder: (context, constraints) {
          final twoPerRow = constraints.maxWidth * 0.96 + 12 <= constraints.maxWidth;
          final rows = <Widget>[
            if (twoPerRow)
              IntrinsicHeight(
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [Expanded(child: xpCard), const SizedBox(width: 12), Expanded(child: lessonsCard)],
                ),
              )
            else ...[
              xpCard,
              lessonsCard,
            ],
            if (streakCard != null) streakCard,
          ];
          return Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              for (var i = 0; i < rows.length; i++) ...[
                if (i > 0) const SizedBox(height: 24),
                rows[i],
              ],
            ],
          );
        }),
        // marginBottom 12 de la carte + 4 de la grille.
        const SizedBox(height: 16),
        _progressCard(
          c,
          label: 'Progression globale, $completionPercentage%, $completedLessons leçons complétées sur $totalLessons',
          title: 'Progression globale',
          percentage: completionPercentage,
          color: c.primary,
          subtext: '$completedLessons leçons complétées sur $totalLessons',
        ),
        if (hasWeeklyGoal)
          _progressCard(
            c,
            label: 'Objectif hebdomadaire, $weeklyPercentage%, $weeklyProgress sur $weeklyGoal leçons cette semaine',
            title: 'Objectif hebdomadaire',
            percentage: weeklyPercentage,
            color: c.success,
            subtext: '$weeklyProgress / $weeklyGoal leçons cette semaine',
          ),
      ],
    );
  }

  Widget _statCard(
    AppColors c, {
    required String label,
    required Color tint,
    required IconData icon,
    required Color iconColor,
    required int number,
    required String text,
  }) {
    return Semantics(
      label: label,
      excludeSemantics: true,
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(color: c.surfaceAlt, borderRadius: BorderRadius.circular(16)),
        child: Column(
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(color: tint, shape: BoxShape.circle),
              child: Icon(icon, size: 24, color: iconColor),
            ),
            const SizedBox(height: 8 + 8),
            Text('$number', style: TextStyle(fontSize: 24, fontWeight: FontWeight.w700, color: c.textPrimary)),
            const SizedBox(height: 4),
            Text(text, textAlign: TextAlign.center, style: TextStyle(fontSize: 12, color: c.textSecondary)),
          ],
        ),
      ),
    );
  }

  Widget _progressCard(
    AppColors c, {
    required String label,
    required String title,
    required int percentage,
    required Color color,
    required String subtext,
  }) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Semantics(
        label: label,
        excludeSemantics: true,
        child: AppCard(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  Expanded(
                    child:
                        Text(title, style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: c.textPrimary)),
                  ),
                  Text('$percentage%',
                      style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: c.primaryText)),
                ],
              ),
              const SizedBox(height: 12),
              ProgressBar(progress: percentage.toDouble(), color: color, height: 12),
              const SizedBox(height: 8),
              Text(subtext, style: TextStyle(fontSize: 12, color: c.textSecondary)),
            ],
          ),
        ),
      ),
    );
  }
}
