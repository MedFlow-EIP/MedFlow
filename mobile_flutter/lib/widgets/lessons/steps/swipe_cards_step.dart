import 'package:flutter/material.dart';
import 'package:ionicons/ionicons.dart';

import '../../../content/lessons.dart';
import '../../../theme/theme_controller.dart';
import 'step_shared.dart';

// Copie de components/steps/SwipeCardsStep.tsx.

const double _swipeDistance = 50;

class SwipeCardsStep extends StatefulWidget {
  final String title;
  final List<SwipeCard> cards;
  final VoidCallback onComplete;
  const SwipeCardsStep({super.key, this.title = 'À retenir', required this.cards, required this.onComplete});

  @override
  State<SwipeCardsStep> createState() => _SwipeCardsStepState();
}

class _SwipeCardsStepState extends State<SwipeCardsStep> {
  int _currentIndex = 0;
  int _direction = 1;
  double _dragDx = 0;

  void _goTo(int next) {
    if (next < 0 || next > widget.cards.length - 1) return;
    setState(() {
      _direction = next > _currentIndex ? 1 : -1;
      _currentIndex = next;
    });
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final cards = widget.cards;
    final isLastCard = _currentIndex == cards.length - 1;
    final card = cards[_currentIndex];
    final detail = card.detail;

    return ColoredBox(
      color: c.background,
      child: Stack(
        children: [
          Positioned.fill(
            child: SingleChildScrollView(
              padding: stepScrollPadding,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  StepOverline(icon: Ionicons.albums_outline, label: 'CARTE ${_currentIndex + 1}/${cards.length}'),
                  const SizedBox(height: stepGapTight),
                  ...withGap(stepGap, [
                    Semantics(
                      header: true,
                      child: Text(widget.title,
                          style: TextStyle(
                              fontSize: 24, height: 30 / 24, fontWeight: FontWeight.w700, color: c.textPrimary)),
                    ),
                    // Glisser vers la gauche = carte suivante, vers la droite = précédente.
                    GestureDetector(
                      behavior: HitTestBehavior.opaque,
                      onHorizontalDragStart: (_) => _dragDx = 0,
                      onHorizontalDragUpdate: (d) => _dragDx += d.delta.dx,
                      onHorizontalDragEnd: (_) {
                        if (_dragDx < -_swipeDistance) {
                          _goTo(_currentIndex + 1);
                        } else if (_dragDx > _swipeDistance) {
                          _goTo(_currentIndex - 1);
                        }
                        _dragDx = 0;
                      },
                      child: TweenAnimationBuilder<double>(
                        key: ValueKey(card.id),
                        tween: Tween(begin: 0, end: 1),
                        duration: const Duration(milliseconds: 200),
                        builder: (context, t, child) => Opacity(
                          opacity: t,
                          child: Transform.translate(
                            // FadeInRight / FadeInLeft : la carte arrive du côté où l'on va.
                            offset: Offset((1 - t) * 25 * _direction, 0),
                            child: child,
                          ),
                        ),
                        child: Semantics(
                          container: true,
                          label: '${card.concept}. ${detail ?? ''}',
                          hint: 'Glisse à gauche ou à droite pour changer de carte',
                          excludeSemantics: true,
                          child: Container(
                            constraints: const BoxConstraints(minHeight: 260),
                            padding: const EdgeInsets.all(24),
                            decoration: BoxDecoration(
                              color: c.surface,
                              borderRadius: BorderRadius.circular(20),
                              border: Border.all(color: c.action, width: 2),
                              boxShadow: [
                                BoxShadow(
                                  color: c.primaryDark.withOpacity(0.12),
                                  blurRadius: 24,
                                  offset: const Offset(0, 8),
                                ),
                              ],
                            ),
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: withGap(14, [
                                Container(
                                  width: 64,
                                  height: 64,
                                  decoration: BoxDecoration(color: c.tintPrimary, shape: BoxShape.circle),
                                  child: Icon(card.icon ?? Ionicons.bookmark_outline, size: 30, color: c.primaryDark),
                                ),
                                Text(card.concept,
                                    textAlign: TextAlign.center,
                                    style: TextStyle(fontSize: 21, fontWeight: FontWeight.w700, color: c.textPrimary)),
                                if (detail != null && detail.isNotEmpty)
                                  Text(detail,
                                      textAlign: TextAlign.center,
                                      style: TextStyle(fontSize: 16, height: 24 / 16, color: c.textSecondary)),
                              ]),
                            ),
                          ),
                        ),
                      ),
                    ),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        _NavButton(
                          icon: Ionicons.chevron_back,
                          label: 'Carte précédente',
                          disabled: _currentIndex == 0,
                          onPress: () => _goTo(_currentIndex - 1),
                        ),
                        Flexible(
                          child: Wrap(
                            spacing: 6,
                            runSpacing: 6,
                            alignment: WrapAlignment.center,
                            children: [
                              for (var i = 0; i < cards.length; i++)
                                Container(
                                  key: ValueKey(cards[i].id),
                                  width: i == _currentIndex ? 20 : 8,
                                  height: 8,
                                  decoration: BoxDecoration(
                                    color: i == _currentIndex ? c.action : c.border,
                                    borderRadius: BorderRadius.circular(4),
                                  ),
                                ),
                            ],
                          ),
                        ),
                        _NavButton(
                          icon: Ionicons.chevron_forward,
                          label: 'Carte suivante',
                          disabled: isLastCard,
                          onPress: () => _goTo(_currentIndex + 1),
                        ),
                      ],
                    ),
                  ]),
                ],
              ),
            ),
          ),
          StepPrimaryButton(
            label: isLastCard ? 'J’ai compris' : 'Carte suivante',
            onPress: isLastCard ? widget.onComplete : () => _goTo(_currentIndex + 1),
          ),
        ],
      ),
    );
  }
}

/// Bouton rond précédent / suivant (Pressable sans retour visuel au toucher).
class _NavButton extends StatelessWidget {
  final IconData icon;
  final String label;
  final bool disabled;
  final VoidCallback onPress;
  const _NavButton({required this.icon, required this.label, required this.disabled, required this.onPress});

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Semantics(
      button: true,
      enabled: !disabled,
      label: label,
      excludeSemantics: true,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: disabled ? null : onPress,
        child: Opacity(
          opacity: disabled ? 0.4 : 1,
          child: Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: c.surface,
              shape: BoxShape.circle,
              border: Border.all(color: c.border),
            ),
            child: Icon(icon, size: 22, color: c.textPrimary),
          ),
        ),
      ),
    );
  }
}
