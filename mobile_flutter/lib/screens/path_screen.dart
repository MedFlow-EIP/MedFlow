import 'package:flutter/material.dart';
import 'package:ionicons/ionicons.dart';

import '../models/lessons.dart';
import '../navigation/nav.dart';
import '../services/api.dart';
import '../theme/theme_controller.dart';
import '../widgets/insets.dart';
import '../widgets/lessons/lesson_node.dart';
import '../widgets/ui.dart';

// Copie de components/screens/PathScreen.tsx.
//
// Paramètre de navigation : `{'path': LearningPath}` (la Map JSON d'un
// parcours renvoyée par /api/paths est aussi acceptée).

class _Stats {
  final int xp;
  final int streak;
  const _Stats({required this.xp, required this.streak});
}

// Géométrie du zigzag : 2 colonnes fixes de part et d'autre du centre, et un
// tracé courbe qui passe par le centre de chaque nœud (plus de ligne cassée).
const double _columnOffset = 65;
const double _rowHeight = 180;
const double _firstCenterY = 70;
const double _curve = 100;

class PathScreen extends StatefulWidget {
  const PathScreen({super.key});

  @override
  State<PathScreen> createState() => _PathScreenState();
}

class _PathScreenState extends State<PathScreen> with FocusRefresh<PathScreen> {
  LearningPath? _path;
  List<Lesson> _lessons = const [];
  _Stats? _stats;

  LearningPath get path => _path ??= LearningPath.from(routeParams(context)['path']);

  Future<void> _loadStats() async {
    if (Api.currentUser == null) return;
    try {
      final res = await Api.get('/api/account');
      final data = decodeBody(res);
      if (data == null) throw const FormatException('Réponse illisible');
      final stats = data is Map ? data['stats'] : null;
      if (!mounted) return;
      setState(() {
        _stats = _Stats(
          xp: stats is Map && stats['xp'] is num ? (stats['xp'] as num).toInt() : 0,
          streak: stats is Map && stats['streak'] is num ? (stats['streak'] as num).toInt() : 0,
        );
      });
    } catch (err) {
      debugPrint('Erreur chargement stats: $err');
    }
  }

  Future<void> _loadLessons() async {
    if (Api.currentUser == null) return;
    try {
      final res = await Api.get('/api/lessons/${path.id}');
      final data = decodeBody(res);
      if (data == null) throw const FormatException('Réponse illisible');
      final list = data is Map ? data['lessons'] : null;
      if (!mounted) return;
      setState(() {
        _lessons = list is List ? list.whereType<Map>().map(Lesson.fromJson).toList() : const [];
      });
    } catch (err) {
      debugPrint('$err');
    }
  }

  // RN : `navigation.getParent()?.setParams({ updatedPaths })`. PathScreen est
  // un écran de la pile racine, sans navigateur parent : l'appel RN ne
  // transmet rien à l'accueil, qui recharge de toute façon ses parcours en
  // revenant au premier plan. La requête est gardée telle quelle.
  Future<void> _loadPathsForHome() async {
    if (Api.currentUser == null) return;
    try {
      await Api.get('/api/paths');
    } catch (err) {
      debugPrint('$err');
    }
  }

  // Se rafraîchit à chaque fois qu'on revient sur cet écran — notamment au
  // retour de LessonScreen une fois une leçon réellement terminée (la
  // complétion ne se fait plus au tap, mais à la fin de la leçon).
  @override
  void onFocus() {
    _loadLessons();
    _loadStats();
    _loadPathsForHome();
  }

  void _handleLessonPress(Lesson lesson) {
    if (lesson.status != 'locked') {
      Nav.navigate('Lesson', {'path': path, 'lesson': lesson});
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final insets = ScreenInsets.of(context);
    final width = MediaQuery.sizeOf(context).width;
    final stats = _stats;

    // Dérivé de `lessons` (rafraîchi à chaque focus), pas de `path` qui vient
    // des paramètres de navigation et reste figé à l'état du moment où on est
    // arrivé sur cet écran — sinon le niveau affiché ne bouge jamais après une leçon.
    final lessons = _lessons;
    final completedCount = lessons.where((l) => l.status == 'completed').length;

    final centers = [
      for (var i = 0; i < lessons.length; i++)
        Offset(width / 2 + (i % 2 == 0 ? -_columnOffset : _columnOffset), _firstCenterY + i * _rowHeight),
    ];
    final trackHeight = lessons.isNotEmpty ? _firstCenterY + (lessons.length - 1) * _rowHeight + 140 : 0.0;

    return Scaffold(
      backgroundColor: c.background,
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Container(
            color: c.tintPrimary,
            padding: EdgeInsets.fromLTRB(20, insets.top, 20, 20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Tappable(
                      onTap: () => Nav.goBack(),
                      semanticLabel: 'Retour',
                      child: Container(
                        width: 40,
                        height: 40,
                        decoration: BoxDecoration(color: c.surface, shape: BoxShape.circle),
                        child: Icon(Ionicons.arrow_back, size: 22, color: c.textPrimary),
                      ),
                    ),
                    if (stats != null)
                      Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          _StatChip(
                            label: "${stats.xp} points d'expérience",
                            icon: Ionicons.star_outline,
                            text: '${stats.xp} XP',
                            color: c.primaryText,
                          ),
                          const SizedBox(width: 8),
                          _StatChip(
                            label: 'Série de ${stats.streak} jours',
                            icon: Ionicons.flame_outline,
                            text: '${stats.streak} j',
                            color: c.warningText,
                          ),
                        ],
                      ),
                  ],
                ),
                const SizedBox(height: 14),
                Text('Niveau ${completedCount + 1}',
                    style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: c.primaryText)),
                const SizedBox(height: 14),
                Semantics(
                  header: true,
                  child: Text(path.title,
                      style: TextStyle(fontSize: 28, fontWeight: FontWeight.w700, color: c.textPrimary)),
                ),
              ],
            ),
          ),
          Expanded(
            child: SingleChildScrollView(
              padding: EdgeInsets.only(top: 24, bottom: insets.bottom + 24),
              child: SizedBox(
                height: trackHeight,
                child: Stack(
                  clipBehavior: Clip.none,
                  children: [
                    Positioned.fill(
                      child: ExcludeSemantics(
                        child: CustomPaint(
                          painter: _TrackPainter(
                            centers: centers,
                            // Le segment vers la leçon i + 1 est doré dès qu'elle est débloquée.
                            done: [for (var i = 1; i < lessons.length; i++) lessons[i].status != 'locked'],
                          ),
                        ),
                      ),
                    ),
                    for (var i = 0; i < lessons.length; i++)
                      Positioned(
                        key: ValueKey(lessons[i].id),
                        left: centers[i].dx - lessonNodeWidth / 2,
                        top: centers[i].dy - (lessonNodeSize(lessons[i].status) / 2 + 8),
                        child: LessonNode(
                          title: lessons[i].title,
                          type: lessons[i].type,
                          status: lessons[i].status,
                          xp: lessons[i].xp,
                          onPress: () => _handleLessonPress(lessons[i]),
                        ),
                      ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _StatChip extends StatelessWidget {
  final String label;
  final IconData icon;
  final String text;
  final Color color;
  const _StatChip({required this.label, required this.icon, required this.text, required this.color});

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Semantics(
      label: label,
      excludeSemantics: true,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(color: c.surface, borderRadius: BorderRadius.circular(999)),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 16, color: color),
            const SizedBox(width: 6),
            Text(text, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: color)),
          ],
        ),
      ),
    );
  }
}

/// Tracé courbe entre les nœuds : plein et doré vers une leçon débloquée,
/// en pointillés gris vers une leçon verrouillée (strokeDasharray « 0.5 14 »
/// + extrémités rondes = des points).
class _TrackPainter extends CustomPainter {
  final List<Offset> centers;
  final List<bool> done;
  const _TrackPainter({required this.centers, required this.done});

  static const _doneColor = Color(0xFFFFC300);
  static const _lockedColor = Color(0xFFCBD5E1);

  @override
  void paint(Canvas canvas, Size size) {
    for (var i = 0; i + 1 < centers.length; i++) {
      final from = centers[i];
      final to = centers[i + 1];
      final segment = Path()
        ..moveTo(from.dx, from.dy)
        ..cubicTo(from.dx, from.dy + _curve, to.dx, to.dy - _curve, to.dx, to.dy);
      final isDone = done[i];
      final paint = Paint()
        ..color = isDone ? _doneColor : _lockedColor
        ..strokeWidth = 6
        ..strokeCap = StrokeCap.round
        ..style = PaintingStyle.stroke;

      if (isDone) {
        canvas.drawPath(segment, paint);
        continue;
      }
      const dash = 0.5;
      const gap = 14.0;
      for (final metric in segment.computeMetrics()) {
        var distance = 0.0;
        while (distance < metric.length) {
          final end = (distance + dash).clamp(0.0, metric.length);
          canvas.drawPath(metric.extractPath(distance, end), paint);
          distance += dash + gap;
        }
      }
    }
  }

  @override
  bool shouldRepaint(_TrackPainter oldDelegate) {
    if (oldDelegate.centers.length != centers.length) return true;
    for (var i = 0; i < centers.length; i++) {
      if (oldDelegate.centers[i] != centers[i]) return true;
    }
    for (var i = 0; i < done.length; i++) {
      if (oldDelegate.done[i] != done[i]) return true;
    }
    return false;
  }
}
