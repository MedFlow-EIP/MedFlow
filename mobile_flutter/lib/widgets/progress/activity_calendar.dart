import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../navigation/nav.dart';
import '../../services/api.dart';
import '../../theme/theme_controller.dart';
import '../date_picker_sheet.dart';
import '../ui.dart';

// Jour : {date: 'AAAA-MM-JJ', count}
// Calendrier : {days, active_days, total, best_run}
// (copie de components/ActivityCalendar.tsx)

const double _gap = 3;

/// Intensité 0 à 4 selon le nombre d'activités du jour.
int activityLevel(num count) {
  if (count <= 0) return 0;
  if (count < 5) return 1;
  if (count < 15) return 2;
  if (count < 30) return 3;
  return 4;
}

/// Colonnes de 7 jours (lundi en haut), la première complétée par des cases
/// vides pour que chaque ligne corresponde toujours au même jour de la semaine.
List<List<Map<String, dynamic>?>> toWeeks(List<Map<String, dynamic>> days) {
  if (days.isEmpty) return [];
  final offset = fromIsoDate('${days.first['date']}').weekday - 1;
  final cells = <Map<String, dynamic>?>[...List.filled(offset, null), ...days];
  return [
    for (var i = 0; i < cells.length; i += 7) cells.sublist(i, math.min(i + 7, cells.length)),
  ];
}

String _activities(num count) => '$count activité${count > 1 ? 's' : ''}';

/// Calendrier d'activité façon GitHub : une case par jour, plus foncée quand on a beaucoup révisé.
class ActivityCalendar extends StatefulWidget {
  const ActivityCalendar({super.key});

  @override
  State<ActivityCalendar> createState() => _ActivityCalendarState();
}

class _ActivityCalendarState extends State<ActivityCalendar> with FocusRefresh<ActivityCalendar> {
  Map<String, dynamic>? _data;
  Map<String, dynamic>? _selected;

  @override
  void onFocus() => _load();

  Future<void> _load() async {
    if (Api.currentUser == null) return;
    try {
      final res = await Api.get('/api/activity/calendar');
      if (res.statusCode < 200 || res.statusCode >= 300) return;
      final json = decodeBody(res);
      if (mounted && json is Map && json['days'] is List) {
        setState(() => _data = json.cast<String, dynamic>());
      }
    } catch (_) {
      // Section secondaire : rien à afficher hors ligne.
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final data = _data;
    if (data == null) return const SizedBox.shrink();

    final days = [for (final d in data['days'] as List) (d as Map).cast<String, dynamic>()];
    final weeks = toWeeks(days);
    final width = MediaQuery.sizeOf(context).width;
    // Largeur de la carte (écran - marges) répartie entre les semaines.
    final cell = weeks.isEmpty
        ? 10.0
        : math.max(10, ((width - 40 - 32 - _gap * (weeks.length - 1)) / weeks.length).floor()).toDouble();
    final levelColors = [c.surfaceAlt, c.tintPrimaryStrong, c.primary, c.primaryDark, c.primaryText];
    final activeDays = (data['active_days'] as num?) ?? 0;
    final bestRun = (data['best_run'] as num?) ?? 0;
    final selected = _selected;

    return Container(
      margin: const EdgeInsets.only(top: 20),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: c.surface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: c.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Semantics(
            header: true,
            child:
                Text('Ton activité', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: c.textPrimary)),
          ),
          const SizedBox(height: 10),
          Text(
            '$activeDays jour${activeDays > 1 ? 's' : ''} actif${activeDays > 1 ? 's' : ''} sur 18 semaines'
            '${bestRun > 1 ? ' · meilleure suite : $bestRun jours' : ''}',
            style: TextStyle(fontSize: 13, color: c.textSecondary),
          ),
          const SizedBox(height: 10),
          // Défile seulement si l'écran est trop étroit pour la taille minimale des cases.
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                for (var w = 0; w < weeks.length; w++) ...[
                  if (w > 0) const SizedBox(width: _gap),
                  Column(
                    children: [
                      for (var i = 0; i < weeks[w].length; i++) ...[
                        if (i > 0) const SizedBox(height: _gap),
                        _cell(weeks[w][i], cell, levelColors),
                      ],
                    ],
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(height: 10),
          Semantics(
            liveRegion: true,
            child: Text(
              selected != null
                  ? '${formatLongDate('${selected['date']}')} : ${_activities(selected['count'] as num? ?? 0)}'
                  : 'Touche une case pour voir le détail',
              style: TextStyle(fontSize: 13, color: c.textSecondary),
            ),
          ),
          const SizedBox(height: 8),
          Align(
            alignment: Alignment.centerRight,
            child: ExcludeSemantics(
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text('Moins', style: TextStyle(fontSize: 11, color: c.textSecondary)),
                  for (final color in levelColors) ...[
                    const SizedBox(width: 4),
                    Container(
                      width: 11,
                      height: 11,
                      decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(2)),
                    ),
                  ],
                  const SizedBox(width: 4),
                  Text('Plus', style: TextStyle(fontSize: 11, color: c.textSecondary)),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _cell(Map<String, dynamic>? day, double size, List<Color> levelColors) {
    if (day == null) return SizedBox(width: size, height: size);
    final c = context.colors;
    final count = day['count'] as num? ?? 0;
    final isSelected = _selected?['date'] == day['date'];
    return Tappable(
      onTap: () => setState(() => _selected = day),
      semanticLabel: '${formatLongDate('${day['date']}')} : ${_activities(count)}',
      child: Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          color: levelColors[activityLevel(count)],
          borderRadius: BorderRadius.circular(3),
          border: isSelected ? Border.all(color: c.textPrimary, width: 2) : null,
        ),
      ),
    );
  }
}
