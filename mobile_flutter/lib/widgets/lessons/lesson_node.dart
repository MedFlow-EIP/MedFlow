import 'package:flutter/material.dart';
import 'package:ionicons/ionicons.dart';

import '../../theme/theme_controller.dart';
import '../ui.dart';

// Copie de components/LessonNode.tsx.

/// Largeur du bloc d'un nœud (cercle + titre), centré sur la colonne.
const double lessonNodeWidth = 220;

/// Diamètre du cercle selon l'état : la leçon disponible est mise en avant.
double lessonNodeSize(String status) {
  if (status == 'available') return 104;
  if (status == 'completed') return 92;
  return 84;
}

const double _ring = 8;

const _gradients = <String, List<Color>>{
  'completed': [Color(0xFFFFD700), Color(0xFFFFA500)],
  'available': [Color(0xFF3B82F6), Color(0xFF8B5CF6)],
  'locked': [Color(0xFFCBD5E1), Color(0xFFCBD5E1)],
};

class LessonNode extends StatefulWidget {
  final String title;

  /// 'lesson' | 'review' | 'test'
  final String type;

  /// 'locked' | 'available' | 'completed'
  final String status;

  /// XP rapportés par la leçon, affichés dans la pastille de la leçon disponible.
  final int? xp;
  final VoidCallback onPress;
  const LessonNode({
    super.key,
    required this.title,
    required this.type,
    required this.status,
    this.xp,
    required this.onPress,
  });

  @override
  State<LessonNode> createState() => _LessonNodeState();
}

class _LessonNodeState extends State<LessonNode> with SingleTickerProviderStateMixin {
  late final AnimationController _pulse = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1000),
  );
  late final Animation<double> _scale =
      Tween<double>(begin: 1, end: 1.04).animate(CurvedAnimation(parent: _pulse, curve: Curves.easeInOut));

  @override
  void initState() {
    super.initState();
    _syncPulse();
  }

  @override
  void didUpdateWidget(LessonNode oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.status != widget.status) _syncPulse();
  }

  /// Pulsation douce (1 → 1,04 → 1) de la leçon disponible.
  void _syncPulse() {
    if (widget.status == 'available') {
      _pulse.repeat(reverse: true);
    } else {
      _pulse
        ..stop()
        ..value = 0;
    }
  }

  @override
  void dispose() {
    _pulse.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final status = widget.status;
    final type = widget.type;
    final size = lessonNodeSize(status);
    final iconName = type == 'review'
        ? Ionicons.refresh
        : type == 'test'
            ? Ionicons.trophy
            : Ionicons.school;
    final typeLabel = type == 'lesson'
        ? 'Leçon'
        : type == 'review'
            ? 'Révision'
            : 'Test';
    final isLocked = status == 'locked';
    final outer = size + _ring * 2;
    final xp = widget.xp;

    Widget chip({IconData? icon, required String text, required Color bg, required Color fg}) => Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
          decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(999)),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (icon != null) ...[Icon(icon, size: 14, color: fg), const SizedBox(width: 6)],
              Flexible(child: Text(text, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: fg))),
            ],
          ),
        );

    Widget badge({
      double? top,
      double? right,
      double? bottom,
      required double diameter,
      required Color bg,
      required Color border,
      required IconData icon,
      required double iconSize,
      required Color iconColor,
    }) =>
        Positioned(
          top: top,
          right: right,
          bottom: bottom,
          child: Container(
            width: diameter,
            height: diameter,
            decoration: BoxDecoration(
              color: bg,
              shape: BoxShape.circle,
              border: Border.all(color: border, width: 3),
            ),
            child: Icon(icon, size: iconSize, color: iconColor),
          ),
        );

    final suffix = status == 'completed'
        ? ', complétée'
        : isLocked
            ? ', verrouillée'
            : ', disponible';

    return Tappable(
      onTap: isLocked ? null : widget.onPress,
      semanticLabel: '$typeLabel ${widget.title}$suffix',
      child: ExcludeSemantics(
        child: SizedBox(
          width: lessonNodeWidth,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              ScaleTransition(
                scale: _scale,
                child: Container(
                  width: outer,
                  height: outer,
                  decoration: BoxDecoration(
                    color: c.surface,
                    shape: BoxShape.circle,
                    boxShadow: [
                      BoxShadow(color: Colors.black.withOpacity(0.12), blurRadius: 14, offset: const Offset(0, 6)),
                    ],
                  ),
                  child: Stack(
                    clipBehavior: Clip.none,
                    alignment: Alignment.center,
                    children: [
                      Container(
                        width: size,
                        height: size,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          gradient: LinearGradient(
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight,
                            colors: _gradients[status] ?? _gradients['locked']!,
                          ),
                        ),
                        child: Icon(iconName, size: (size * 0.45).roundToDouble(), color: Colors.white),
                      ),
                      // Pastille check en haut à droite (remplace le ruban de 8 px).
                      if (status == 'completed')
                        badge(
                          top: 2,
                          right: 0,
                          diameter: 32,
                          bg: c.success,
                          border: Colors.white,
                          icon: Ionicons.checkmark,
                          iconSize: 16,
                          iconColor: Colors.white,
                        ),
                      // Badge play 46 px avec icône 22 px (au lieu de 24/12).
                      if (status == 'available')
                        badge(
                          bottom: 4,
                          right: -4,
                          diameter: 46,
                          bg: Colors.white,
                          border: c.primaryDark,
                          icon: Ionicons.play,
                          iconSize: 22,
                          iconColor: c.primaryDark,
                        ),
                      if (isLocked)
                        badge(
                          bottom: 8,
                          right: 2,
                          diameter: 30,
                          bg: c.muted,
                          border: Colors.white,
                          icon: Ionicons.lock_closed,
                          iconSize: 15,
                          iconColor: Colors.white,
                        ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 6),
              Container(
                constraints: const BoxConstraints(maxWidth: lessonNodeWidth),
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                decoration: BoxDecoration(color: c.background, borderRadius: BorderRadius.circular(12)),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      widget.title,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w700,
                        color: isLocked ? c.textSecondary : c.textPrimary,
                      ),
                    ),
                    const SizedBox(height: 6),
                    if (status == 'completed')
                      chip(icon: Ionicons.checkmark, text: 'Complété', bg: c.tintSuccess, fg: c.successText),
                    if (status == 'available')
                      chip(
                        text: (xp != null && xp != 0) ? '$typeLabel · $xp XP' : typeLabel,
                        bg: c.tintPrimary,
                        fg: c.primaryText,
                      ),
                    if (isLocked)
                      chip(icon: Ionicons.lock_closed, text: 'Verrouillé', bg: c.surfaceAlt, fg: c.textSecondary),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
