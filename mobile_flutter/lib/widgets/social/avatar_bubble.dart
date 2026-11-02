import 'package:flutter/material.dart';

import '../../theme/theme_controller.dart';

/// Photo de profil ronde, ou initiale sur fond `action` quand il n'y en a pas
/// (copie de components/AvatarBubble.tsx).
class AvatarBubble extends StatelessWidget {
  final String? uri;
  final String displayName;
  final double size;
  const AvatarBubble({super.key, this.uri, required this.displayName, this.size = 36});

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final label = 'Photo de profil de $displayName';

    if (uri != null && uri!.isNotEmpty) {
      return Semantics(
        label: label,
        image: true,
        child: ClipOval(
          child: Image.network(
            uri!,
            width: size,
            height: size,
            fit: BoxFit.cover,
            excludeFromSemantics: true,
            // Comme <Image> en RN : rien d'affiché si la photo ne charge pas.
            errorBuilder: (_, __, ___) => SizedBox(width: size, height: size),
          ),
        ),
      );
    }

    return Semantics(
      label: label,
      excludeSemantics: true,
      child: Container(
        width: size,
        height: size,
        alignment: Alignment.center,
        decoration: BoxDecoration(color: c.action, shape: BoxShape.circle),
        child: Text(
          displayName.isEmpty ? '' : displayName.characters.first.toUpperCase(),
          style: TextStyle(color: c.onAction, fontWeight: FontWeight.w700, fontSize: size * 0.42),
        ),
      ),
    );
  }
}
