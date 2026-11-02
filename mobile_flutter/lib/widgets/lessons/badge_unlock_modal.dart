import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/physics.dart';
import 'package:ionicons/ionicons.dart';

import '../../theme/theme_controller.dart';
import '../ui.dart';
import 'modal_overlay.dart';

// Copie de components/BadgeUnlockModal.tsx.
//
// Le <Modal transparent> RN devient un calque plein écran : l'écran qui
// l'affiche le place dans un `Stack` (Positioned.fill) tant que `badges`
// n'est pas vide.

class UnlockedBadge {
  final String id;
  final String title;
  final String description;

  /// Nom d'icône Ionicons envoyé par le backend (ex. « flame »).
  final String icon;

  /// Couleur hexadécimale (ex. « #f59e0b »).
  final String color;
  const UnlockedBadge({
    required this.id,
    required this.title,
    required this.description,
    required this.icon,
    required this.color,
  });

  factory UnlockedBadge.fromJson(Map json) => UnlockedBadge(
        id: '${json['id'] ?? ''}',
        title: '${json['title'] ?? ''}',
        description: '${json['description'] ?? ''}',
        icon: '${json['icon'] ?? ''}',
        color: '${json['color'] ?? ''}',
      );
}

/// Icône Ionicons d'un badge à partir de son nom (catalogue BADGE_CATALOG du
/// backend). Un nom inconnu affiche un ruban.
IconData badgeIcon(String name) => switch (name) {
      'school' => Ionicons.school,
      'flame' => Ionicons.flame,
      'star' => Ionicons.star,
      'trophy' => Ionicons.trophy,
      'checkmark-done' => Ionicons.checkmark_done,
      'checkmark-done-circle' => Ionicons.checkmark_done_circle,
      'ribbon' => Ionicons.ribbon,
      'medal' => Ionicons.medal,
      _ => Ionicons.ribbon,
    };

/// Couleur d'un code hexadécimal `#rrggbb` (ou `#rgb`).
Color hexColor(String hex, {Color fallback = const Color(0xFF3B82F6)}) {
  var h = hex.replaceFirst('#', '');
  if (h.length == 3) h = h.split('').map((ch) => '$ch$ch').join();
  if (h.length == 6) h = 'FF$h';
  final value = h.length == 8 ? int.tryParse(h, radix: 16) : null;
  return value == null ? fallback : Color(value);
}

class BadgeUnlockModal extends StatefulWidget {
  final List<UnlockedBadge> badges;
  final VoidCallback onDismiss;
  const BadgeUnlockModal({super.key, required this.badges, required this.onDismiss});

  @override
  State<BadgeUnlockModal> createState() => _BadgeUnlockModalState();
}

class _BadgeUnlockModalState extends State<BadgeUnlockModal> with TickerProviderStateMixin {
  int _index = 0;

  // Ressort RN (friction 5, tension 60) converti en raideur / amortissement.
  static const _spring = SpringDescription(mass: 1, stiffness: 302.6, damping: 16);

  late final AnimationController _scale = AnimationController.unbounded(vsync: this);
  late final AnimationController _rotate = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1600),
  );
  late final Animation<double> _rotation = CurvedAnimation(parent: _rotate, curve: Curves.easeInOut);

  bool get _visible => widget.badges.isNotEmpty;

  @override
  void initState() {
    super.initState();
    if (_visible) _startAnimations();
  }

  @override
  void didUpdateWidget(BadgeUnlockModal oldWidget) {
    super.didUpdateWidget(oldWidget);
    final wasVisible = oldWidget.badges.isNotEmpty;
    if (_visible && !wasVisible) {
      _index = 0;
      _startAnimations();
    } else if (!_visible) {
      _rotate.stop();
    }
  }

  void _startAnimations() {
    _scale.value = 0;
    _scale.animateWith(SpringSimulation(_spring, 0, 1, 0));
    _rotate.value = 0;
    _rotate.repeat(reverse: true);
  }

  @override
  void dispose() {
    _scale.dispose();
    _rotate.dispose();
    super.dispose();
  }

  void _handleNext() {
    final isLast = _index == widget.badges.length - 1;
    if (isLast) {
      widget.onDismiss();
    } else {
      setState(() => _index += 1);
      _startAnimations();
    }
  }

  @override
  Widget build(BuildContext context) {
    if (!_visible || _index >= widget.badges.length) return const SizedBox.shrink();
    final c = context.colors;
    final badge = widget.badges[_index];
    final isLast = _index == widget.badges.length - 1;
    final badgeColor = hexColor(badge.color);

    return LessonModalOverlay(
      label: 'Badge débloqué !',
      child: Container(
        width: double.infinity,
        constraints: const BoxConstraints(maxWidth: 340),
        padding: const EdgeInsets.all(28),
        decoration: BoxDecoration(
          color: c.surface,
          borderRadius: BorderRadius.circular(24),
          boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.3), blurRadius: 20, offset: const Offset(0, 8))],
        ),
        child: Stack(
          clipBehavior: Clip.none,
          children: [
            Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                Text(
                  'Badge débloqué !'.toUpperCase(),
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: c.primaryText, letterSpacing: 0.5),
                ),
                const SizedBox(height: 16),
                AnimatedBuilder(
                  animation: Listenable.merge([_scale, _rotation]),
                  builder: (context, child) {
                    // -8° → 8°, aller-retour.
                    final degrees = -8 + 16 * _rotation.value;
                    return Transform(
                      alignment: Alignment.center,
                      transform: Matrix4.identity()
                        ..scale(_scale.value, _scale.value)
                        ..rotateZ(degrees * math.pi / 180),
                      child: child,
                    );
                  },
                  child: Container(
                    width: 96,
                    height: 96,
                    decoration: BoxDecoration(color: badgeColor.withAlpha(0x20), shape: BoxShape.circle),
                    child: Icon(badgeIcon(badge.icon), size: 48, color: badgeColor),
                  ),
                ),
                const SizedBox(height: 20),
                Text(badge.title,
                    textAlign: TextAlign.center,
                    style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700, color: c.textPrimary)),
                const SizedBox(height: 8),
                Text(badge.description,
                    textAlign: TextAlign.center,
                    style: TextStyle(fontSize: 14, height: 20 / 14, color: c.textSecondary)),
                const SizedBox(height: 24),
                Tappable(
                  onTap: _handleNext,
                  semanticLabel: isLast ? 'Super !' : 'Suivant',
                  child: ExcludeSemantics(
                    child: Container(
                      width: double.infinity,
                      padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 14),
                      alignment: Alignment.center,
                      decoration: BoxDecoration(color: c.action, borderRadius: BorderRadius.circular(14)),
                      child: Text(isLast ? 'Super !' : 'Suivant',
                          style: TextStyle(color: c.onAction, fontSize: 16, fontWeight: FontWeight.w700)),
                    ),
                  ),
                ),
              ],
            ),
            if (widget.badges.length > 1)
              Positioned(
                // Le compteur RN est à 16 / 18 px du bord de la carte (padding 28).
                top: 16 - 28,
                right: 18 - 28,
                child: Text('${_index + 1} / ${widget.badges.length}',
                    style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: c.textSecondary)),
              ),
          ],
        ),
      ),
    );
  }
}
