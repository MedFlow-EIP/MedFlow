import 'package:flutter/material.dart';

import '../../theme/theme_controller.dart';
import '../insets.dart';
import '../ui.dart';

/// Barre d'action fixée en bas de l'écran, au-dessus de la zone système
/// (styles `actionBar` / `footer` des écrans de cas cliniques) : fond
/// `surface`, filet en haut.
class FooterBar extends StatelessWidget {
  final Widget child;
  const FooterBar({super.key, required this.child});

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final insets = ScreenInsets.of(context);
    return Container(
      padding: EdgeInsets.fromLTRB(20, 14, 20, insets.bottom + 12),
      decoration: BoxDecoration(
        color: c.surface,
        border: Border(top: BorderSide(color: c.border)),
      ),
      child: child,
    );
  }
}

/// Bouton plein de la barre du bas (style `primary` : 54 px, fond `action`,
/// rayon 14), avec icône avant ou après le texte. `onPressed` null : bouton
/// désactivé et estompé (style `disabled`).
class FooterActionButton extends StatelessWidget {
  final String label;
  final VoidCallback? onPressed;
  final IconData? leadingIcon;
  final double leadingIconSize;
  final IconData? trailingIcon;
  final bool loading;
  const FooterActionButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.leadingIcon,
    this.leadingIconSize = 20,
    this.trailingIcon,
    this.loading = false,
  });

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final disabled = onPressed == null;
    return Tappable(
      onTap: onPressed,
      semanticLabel: label,
      child: ExcludeSemantics(
        child: Opacity(
          opacity: disabled ? 0.5 : 1,
          child: Container(
            height: 54,
            decoration: BoxDecoration(color: c.action, borderRadius: BorderRadius.circular(14)),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: loading
                  ? [
                      SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(strokeWidth: 2, color: c.onAction),
                      ),
                    ]
                  : [
                      if (leadingIcon != null) ...[
                        Icon(leadingIcon, size: leadingIconSize, color: c.onAction),
                        const SizedBox(width: 8),
                      ],
                      Flexible(
                        child: Text(
                          label,
                          textAlign: TextAlign.center,
                          style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: c.onAction),
                        ),
                      ),
                      if (trailingIcon != null) ...[
                        const SizedBox(width: 8),
                        Icon(trailingIcon, size: 20, color: c.onAction),
                      ],
                    ],
            ),
          ),
        ),
      ),
    );
  }
}
