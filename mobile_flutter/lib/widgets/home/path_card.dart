import 'package:flutter/material.dart';
import 'package:flutter/physics.dart';
import 'package:ionicons/ionicons.dart';

import '../../theme/theme_controller.dart';
import '../ui.dart';

/// `color + '1A'` de l'app RN : la couleur du parcours (« #RRGGBB ») à 10 % d'opacité.
Color pathTint(Object? hex) {
  final raw = '${hex ?? ''}'.replaceFirst('#', '');
  final rgb = raw.length == 6 ? int.tryParse(raw, radix: 16) : null;
  return rgb == null ? Colors.transparent : Color(0x1A000000 | rgb);
}

/// Nombre affiché comme en JS (3 et non 3.0).
String _n(Object? v) {
  if (v is num) return v == v.roundToDouble() ? '${v.round()}' : '$v';
  return '${v ?? ''}';
}

/// Carte d'un parcours d'apprentissage (copie de PathCard.tsx). `path` est
/// l'objet renvoyé par /api/paths (id, title, description, progress,
/// totalLessons, completedLessons, isLocked, comingSoon, color, emoji).
class PathCard extends StatefulWidget {
  final Map<String, dynamic> path;
  final VoidCallback onPress;
  final int index;

  /// Parcours en cours : carte héros (bordure bleue + ombre) avec la prochaine leçon et un bouton plein.
  final bool isHero;

  /// Titre de la prochaine leçon disponible, affiché sur la carte héros.
  final String? nextLessonTitle;

  /// Condition de déblocage affichée sous un parcours verrouillé (ex. « Termine Anatomie pour débloquer »).
  final String? unlockHint;

  const PathCard({
    super.key,
    required this.path,
    required this.onPress,
    this.index = 0,
    this.isHero = false,
    this.nextLessonTitle,
    this.unlockHint,
  });

  @override
  State<PathCard> createState() => _PathCardState();
}

class _PathCardState extends State<PathCard> with SingleTickerProviderStateMixin {
  // FadeInUp.delay(index * 100).springify() : opacité 0 → 1 et montée de 25 px, en ressort.
  late final AnimationController _enter = AnimationController.unbounded(vsync: this);
  bool _started = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;
    if (MediaQuery.disableAnimationsOf(context)) {
      _enter.value = 1;
      return;
    }
    Future.delayed(Duration(milliseconds: widget.index * 100), () {
      if (!mounted) return;
      _enter.animateWith(SpringSimulation(const SpringDescription(mass: 1, stiffness: 100, damping: 10), 0, 1, 0));
    });
  }

  @override
  void dispose() {
    _enter.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _enter,
      builder: (context, child) => Opacity(
        opacity: _enter.value.clamp(0.0, 1.0),
        child: Transform.translate(offset: Offset(0, 25 * (1 - _enter.value)), child: child),
      ),
      child: widget.path['isLocked'] == true ? _locked(context) : _unlocked(context),
    );
  }

  Widget _locked(BuildContext context) {
    final c = context.colors;
    final p = widget.path;
    final title = '${p['title'] ?? ''}';
    final comingSoon = p['comingSoon'] == true;
    final hint = widget.unlockHint;
    return Semantics(
      container: true,
      label: comingSoon
          ? '$title, bientôt disponible'
          : '$title, verrouillé. ${hint ?? ''} ${_n(p['completedLessons'])} sur ${_n(p['totalLessons'])} leçons',
      excludeSemantics: true,
      child: Container(
        padding: const EdgeInsets.all(18),
        decoration: BoxDecoration(
          color: c.surface,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: c.border),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                Opacity(
                  opacity: 0.75,
                  child: Container(
                    width: 48,
                    height: 48,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(color: pathTint(p['color']), borderRadius: BorderRadius.circular(14)),
                    child: Text('${p['emoji'] ?? ''}', style: const TextStyle(fontSize: 26)),
                  ),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Verrouillé : grisé mais lisible (contraste ≥ 4.5:1), plus d'opacité globale.
                      Text(title, style: TextStyle(fontSize: 17, fontWeight: FontWeight.w600, color: c.textPrimary)),
                      const SizedBox(height: 2),
                      Text('${p['description'] ?? ''}',
                          style: TextStyle(fontSize: 13, height: 18 / 13, color: c.textSecondary)),
                    ],
                  ),
                ),
                const SizedBox(width: 14),
                Icon(Ionicons.lockClosed, size: 20, color: c.muted),
              ],
            ),
            const SizedBox(height: 10),
            if (comingSoon)
              Align(
                alignment: Alignment.centerLeft,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(color: c.tintPrimary, borderRadius: BorderRadius.circular(999)),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Ionicons.timeOutline, size: 14, color: c.primaryText),
                      const SizedBox(width: 6),
                      Text('Bientôt disponible',
                          style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: c.primaryText)),
                    ],
                  ),
                ),
              )
            else
              Text(
                '${hint != null && hint.isNotEmpty ? '$hint · ' : ''}${_n(p['completedLessons'])}/${_n(p['totalLessons'])} leçons',
                style: TextStyle(fontSize: 13, fontWeight: FontWeight.w500, color: c.textSecondary),
              ),
          ],
        ),
      ),
    );
  }

  Widget _unlocked(BuildContext context) {
    final c = context.colors;
    final p = widget.path;
    final isHero = widget.isHero;
    final title = '${p['title'] ?? ''}';
    final progress = (p['progress'] is num ? (p['progress'] as num).toDouble() : 0.0).clamp(0.0, 100.0);
    final isDone = progress == 100;
    final ctaLabel = progress == 0 ? 'Commencer le parcours' : 'Continuer la leçon';
    final gap = isHero ? 16.0 : 12.0;
    final next = widget.nextLessonTitle;

    return Tappable(
      onTap: widget.onPress,
      semanticLabel: '$title, ${_n(p['completedLessons'])} sur ${_n(p['totalLessons'])} leçons complétées',
      child: ExcludeSemantics(
        child: Container(
          padding: EdgeInsets.all(isHero ? 20 : 18),
          decoration: BoxDecoration(
            color: c.surface,
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: isHero ? c.action : c.border, width: isHero ? 2 : 1),
            boxShadow: isHero
                ? [BoxShadow(color: c.primaryDark.withValues(alpha: 0.12), blurRadius: 24, offset: const Offset(0, 8))]
                : null,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  Container(
                    width: 52,
                    height: 52,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(color: pathTint(p['color']), borderRadius: BorderRadius.circular(14)),
                    child: Text('${p['emoji'] ?? ''}', style: const TextStyle(fontSize: 28)),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(title,
                            style: TextStyle(
                              fontSize: isHero ? 19 : 17,
                              fontWeight: isHero ? FontWeight.w700 : FontWeight.w600,
                              color: c.textPrimary,
                            )),
                        const SizedBox(height: 4),
                        Text('${p['description'] ?? ''}',
                            style: TextStyle(fontSize: 14, height: 20 / 14, color: c.textSecondary)),
                      ],
                    ),
                  ),
                ],
              ),
              SizedBox(height: gap),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      Icon(Ionicons.documentText, size: 14, color: c.textSecondary),
                      const SizedBox(width: 6),
                      Text('${_n(p['completedLessons'])}/${_n(p['totalLessons'])} leçons',
                          style: TextStyle(fontSize: 14, fontWeight: FontWeight.w500, color: c.textSecondary)),
                    ],
                  ),
                  Text('${progress.round()} %',
                      style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: c.action)),
                ],
              ),
              SizedBox(height: gap),
              ClipRRect(
                borderRadius: BorderRadius.circular(4),
                child: Container(
                  height: 8,
                  color: c.border,
                  alignment: Alignment.centerLeft,
                  child: FractionallySizedBox(
                    widthFactor: progress / 100,
                    heightFactor: 1,
                    child: DecoratedBox(
                      decoration: BoxDecoration(color: c.action, borderRadius: BorderRadius.circular(4)),
                    ),
                  ),
                ),
              ),
              if (isDone) ...[
                SizedBox(height: gap),
                Row(
                  children: [
                    Icon(Ionicons.checkmarkCircle, size: 16, color: c.successText),
                    const SizedBox(width: 4),
                    Text('Terminé', style: TextStyle(fontSize: 13, color: c.successText, fontWeight: FontWeight.w600)),
                  ],
                ),
              ],
              if (isHero && !isDone) ...[
                if (next != null && next.isNotEmpty) ...[
                  SizedBox(height: gap),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                    decoration: BoxDecoration(color: c.background, borderRadius: BorderRadius.circular(12)),
                    child: Row(
                      children: [
                        Text('Prochaine leçon :', style: TextStyle(fontSize: 14, color: c.textSecondary)),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(next,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: c.textPrimary)),
                        ),
                      ],
                    ),
                  ),
                ],
                SizedBox(height: gap),
                Container(
                  height: 54,
                  decoration: BoxDecoration(color: c.action, borderRadius: BorderRadius.circular(14)),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Ionicons.play, size: 20, color: c.onAction),
                      const SizedBox(width: 10),
                      Flexible(
                        child: Text(ctaLabel,
                            style: TextStyle(fontSize: 17, fontWeight: FontWeight.w600, color: c.onAction)),
                      ),
                    ],
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
