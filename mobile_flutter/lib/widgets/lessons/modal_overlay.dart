import 'package:flutter/material.dart';

/// Fond assombri plein écran avec la carte centrée, apparition en fondu
/// (équivalent du <Modal transparent animationType="fade"> RN, fond
/// rgba(0, 0, 0, 0.75), marge 24). Bloque la lecture de l'écran situé
/// dessous par les lecteurs d'écran.
///
/// À placer dans un `Stack` qui couvre tout l'écran (Positioned.fill).
class LessonModalOverlay extends StatelessWidget {
  final String label;
  final Widget child;
  const LessonModalOverlay({super.key, required this.label, required this.child});

  @override
  Widget build(BuildContext context) {
    return BlockSemantics(
      child: Semantics(
        scopesRoute: true,
        namesRoute: true,
        explicitChildNodes: true,
        label: label,
        child: TweenAnimationBuilder<double>(
          tween: Tween(begin: 0, end: 1),
          duration: const Duration(milliseconds: 300),
          builder: (context, t, child) => Opacity(opacity: t, child: child),
          child: GestureDetector(
            // Le fond absorbe les touchers : rien n'est cliquable dessous.
            behavior: HitTestBehavior.opaque,
            onTap: () {},
            child: Container(
              color: const Color.fromRGBO(0, 0, 0, 0.75),
              padding: const EdgeInsets.all(24),
              alignment: Alignment.center,
              child: SingleChildScrollView(child: child),
            ),
          ),
        ),
      ),
    );
  }
}
