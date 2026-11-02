import 'package:flutter/material.dart';
import 'package:ionicons/ionicons.dart';

import '../theme/theme_controller.dart';
import 'insets.dart';

// Briques d'interface partagées (copie de components/ui/*).

enum Tone { primary, success, warning, danger, neutral }

/// Couleurs de fond / premier plan d'une teinte.
({Color bg, Color fg}) toneColors(BuildContext context, Tone tone) {
  final c = context.colors;
  return switch (tone) {
    Tone.primary => (bg: c.tintPrimary, fg: c.primaryDark),
    Tone.success => (bg: c.tintSuccess, fg: c.success),
    Tone.warning => (bg: c.tintWarning, fg: c.warning),
    Tone.danger => (bg: c.tintDanger, fg: c.danger),
    Tone.neutral => (bg: c.surfaceAlt, fg: c.textSecondary),
  };
}

/// Bouton rond « retour » / « fermer » des en-têtes (44 px, bordure).
class CircleIconButton extends StatelessWidget {
  final IconData icon;
  final VoidCallback? onPressed;
  final String label;
  final double size;
  final Color? background;
  final Color? iconColor;
  final bool bordered;
  const CircleIconButton({
    super.key,
    required this.icon,
    required this.onPressed,
    required this.label,
    this.size = 44,
    this.background,
    this.iconColor,
    this.bordered = true,
  });

  /// Bouton retour standard.
  factory CircleIconButton.back(VoidCallback onPressed, {Key? key}) =>
      CircleIconButton(key: key, icon: Ionicons.arrowBack, onPressed: onPressed, label: 'Retour');

  /// Bouton fermer standard.
  factory CircleIconButton.close(VoidCallback onPressed, {Key? key}) =>
      CircleIconButton(key: key, icon: Ionicons.close, onPressed: onPressed, label: 'Fermer');

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Semantics(
      button: true,
      label: label,
      excludeSemantics: true,
      child: Material(
        color: background ?? c.surface,
        shape: CircleBorder(side: bordered ? BorderSide(color: c.border) : BorderSide.none),
        child: InkWell(
          customBorder: const CircleBorder(),
          onTap: onPressed,
          child: SizedBox(
            width: size,
            height: size,
            child: Icon(icon, size: size * 0.5, color: iconColor ?? c.textPrimary),
          ),
        ),
      ),
    );
  }
}

/// Zone tactile sans effet Material (équivalent de TouchableOpacity).
class Tappable extends StatefulWidget {
  final Widget child;
  final VoidCallback? onTap;
  final VoidCallback? onLongPress;
  final String? semanticLabel;
  final bool button;
  final bool? selected;
  const Tappable({
    super.key,
    required this.child,
    this.onTap,
    this.onLongPress,
    this.semanticLabel,
    this.button = true,
    this.selected,
  });

  @override
  State<Tappable> createState() => _TappableState();
}

class _TappableState extends State<Tappable> {
  bool _down = false;

  @override
  Widget build(BuildContext context) {
    final enabled = widget.onTap != null || widget.onLongPress != null;
    return Semantics(
      button: widget.button,
      enabled: enabled,
      selected: widget.selected,
      label: widget.semanticLabel,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: widget.onTap,
        onLongPress: widget.onLongPress,
        onTapDown: enabled ? (_) => setState(() => _down = true) : null,
        onTapUp: enabled ? (_) => setState(() => _down = false) : null,
        onTapCancel: enabled ? () => setState(() => _down = false) : null,
        child: AnimatedOpacity(
          opacity: _down ? 0.6 : 1,
          duration: const Duration(milliseconds: 100),
          child: widget.child,
        ),
      ),
    );
  }
}

/// Bouton plein de l'action principale (fond `action`, 56 px).
class PrimaryButton extends StatelessWidget {
  final String label;
  final VoidCallback? onPressed;
  final bool loading;
  final IconData? icon;
  final double height;
  final Color? color;
  const PrimaryButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.loading = false,
    this.icon,
    this.height = 56,
    this.color,
  });

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final disabled = onPressed == null;
    return Semantics(
      button: true,
      enabled: !disabled && !loading,
      label: label,
      excludeSemantics: true,
      child: SizedBox(
        height: height,
        child: TextButton(
          style: TextButton.styleFrom(
            backgroundColor: color ?? c.action,
            foregroundColor: c.onAction,
            disabledBackgroundColor: (color ?? c.action).withValues(alpha: 0.5),
            disabledForegroundColor: c.onAction,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
            padding: const EdgeInsets.symmetric(horizontal: 16),
          ),
          onPressed: loading ? () {} : onPressed,
          child: loading
              ? SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2.5, color: c.onAction))
              : Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    if (icon != null) ...[Icon(icon, size: 20, color: c.onAction), const SizedBox(width: 8)],
                    Flexible(
                      child: Text(label,
                          textAlign: TextAlign.center,
                          style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: c.onAction)),
                    ),
                  ],
                ),
        ),
      ),
    );
  }
}

/// Bouton secondaire à bordure (52 px).
class SecondaryButton extends StatelessWidget {
  final String label;
  final VoidCallback? onPressed;
  final IconData? icon;
  final double height;
  const SecondaryButton({super.key, required this.label, required this.onPressed, this.icon, this.height = 52});

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return SizedBox(
      height: height,
      child: OutlinedButton(
        style: OutlinedButton.styleFrom(
          backgroundColor: c.surface,
          foregroundColor: c.primaryText,
          side: BorderSide(color: c.primaryDark, width: 1.5),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        ),
        onPressed: onPressed,
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (icon != null) ...[Icon(icon, size: 20, color: c.primaryText), const SizedBox(width: 8)],
            Flexible(
              child: Text(label,
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: c.primaryText)),
            ),
          ],
        ),
      ),
    );
  }
}

enum ButtonVariant { normal, secondary, outline, ghost }

enum ButtonSize { sm, md, lg }

/// Bouton générique (copie de components/ui/button.tsx).
class AppButton extends StatelessWidget {
  final String title;
  final VoidCallback? onPressed;
  final ButtonVariant variant;
  final ButtonSize size;
  final bool loading;
  final Color? color;
  const AppButton({
    super.key,
    required this.title,
    this.onPressed,
    this.variant = ButtonVariant.normal,
    this.size = ButtonSize.md,
    this.loading = false,
    this.color,
  });

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final (bg, fg) = switch (variant) {
      ButtonVariant.normal => (c.textPrimary, c.background),
      ButtonVariant.secondary => (c.surfaceAlt, c.textPrimary),
      ButtonVariant.outline => (Colors.transparent, c.textPrimary),
      ButtonVariant.ghost => (Colors.transparent, c.textPrimary),
    };
    final (minH, padH, font) = switch (size) {
      ButtonSize.sm => (36.0, 12.0, 14.0),
      ButtonSize.md => (44.0, 16.0, 16.0),
      ButtonSize.lg => (52.0, 18.0, 18.0),
    };
    final disabled = onPressed == null || loading;
    return Opacity(
      opacity: disabled ? 0.5 : 1,
      child: ConstrainedBox(
        constraints: BoxConstraints(minHeight: minH),
        child: TextButton(
          style: TextButton.styleFrom(
            backgroundColor: color ?? bg,
            foregroundColor: fg,
            padding: EdgeInsets.symmetric(horizontal: padH),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
              side: variant == ButtonVariant.outline ? BorderSide(color: c.border) : BorderSide.none,
            ),
          ),
          onPressed: disabled ? null : onPressed,
          child: loading
              ? SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: fg))
              : Text(title, style: TextStyle(fontSize: font, fontWeight: FontWeight.w700, color: fg)),
        ),
      ),
    );
  }
}

/// Carte (copie de components/ui/card.tsx).
class AppCard extends StatelessWidget {
  final Widget child;
  final EdgeInsetsGeometry? padding;
  final Color? color;
  final double radius;
  final VoidCallback? onTap;
  final String? semanticLabel;
  const AppCard({
    super.key,
    required this.child,
    this.padding,
    this.color,
    this.radius = 16,
    this.onTap,
    this.semanticLabel,
  });

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final content = Container(
      padding: padding,
      decoration: BoxDecoration(
        color: color ?? c.surface,
        borderRadius: BorderRadius.circular(radius),
        border: Border.all(color: c.border, width: 0.5),
        boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.08), blurRadius: 10, offset: const Offset(0, 6))],
      ),
      child: ClipRRect(borderRadius: BorderRadius.circular(radius), child: child),
    );
    if (onTap == null) return content;
    return Tappable(onTap: onTap, semanticLabel: semanticLabel, child: content);
  }
}

/// Barre de progression (0–100).
class ProgressBar extends StatelessWidget {
  final double progress;
  final Color? color;
  final double height;
  const ProgressBar({super.key, required this.progress, this.color, this.height = 8});

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final clamped = progress.clamp(0, 100).toDouble();
    return Semantics(
      label: 'Progression : ${clamped.round()}%',
      value: '${clamped.round()}%',
      child: ClipRRect(
        borderRadius: BorderRadius.circular(100),
        child: SizedBox(
          height: height,
          child: Stack(
            children: [
              Positioned.fill(child: ColoredBox(color: c.border)),
              FractionallySizedBox(
                widthFactor: clamped / 100,
                heightFactor: 1,
                child: DecoratedBox(
                  decoration: BoxDecoration(color: color ?? c.primary, borderRadius: BorderRadius.circular(100)),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Indicateur de chargement plein écran.
class LoadingView extends StatelessWidget {
  final String? label;
  const LoadingView({super.key, this.label});

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return ColoredBox(
      color: c.background,
      child: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            CircularProgressIndicator(color: c.primary, semanticsLabel: label ?? 'Chargement'),
            if (label != null) ...[
              const SizedBox(height: 12),
              Text(label!, style: TextStyle(fontSize: 15, color: c.textSecondary)),
            ],
          ],
        ),
      ),
    );
  }
}

class StateAction {
  final String label;
  final VoidCallback onPress;
  const StateAction(this.label, this.onPress);
}

/// État plein écran (vide, erreur, fin de session) : icône dans une pastille
/// teintée, titre, texte, puis actions fixées en bas (copie de StateView.tsx).
class StateView extends StatelessWidget {
  final IconData icon;
  final Tone tone;
  final String title;
  final String? subtitle;
  final String? hint;
  final StateAction? primary;
  final StateAction? secondary;
  final VoidCallback? onClose;
  final bool closeIsCross;
  const StateView({
    super.key,
    required this.icon,
    this.tone = Tone.primary,
    required this.title,
    this.subtitle,
    this.hint,
    this.primary,
    this.secondary,
    this.onClose,
    this.closeIsCross = false,
  });

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final insets = ScreenInsets.of(context);
    final t = toneColors(context, tone);
    return Container(
      color: c.background,
      padding: EdgeInsets.fromLTRB(20, insets.top, 20, insets.bottom + 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (onClose != null)
            Align(
              alignment: Alignment.centerLeft,
              child: closeIsCross ? CircleIconButton.close(onClose!) : CircleIconButton.back(onClose!),
            ),
          Expanded(
            child: Center(
              child: SingleChildScrollView(
                padding: const EdgeInsets.symmetric(horizontal: 12),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      width: 104,
                      height: 104,
                      decoration: BoxDecoration(color: t.bg, shape: BoxShape.circle),
                      child: Icon(icon, size: 48, color: t.fg),
                    ),
                    const SizedBox(height: 18),
                    Semantics(
                      header: true,
                      child: Text(title,
                          textAlign: TextAlign.center,
                          style: TextStyle(fontSize: 22, fontWeight: FontWeight.w700, color: c.textPrimary)),
                    ),
                    if (subtitle != null && subtitle!.isNotEmpty) ...[
                      const SizedBox(height: 10),
                      Text(subtitle!,
                          textAlign: TextAlign.center,
                          style: TextStyle(fontSize: 15, height: 22 / 15, color: c.textSecondary)),
                    ],
                    if (hint != null && hint!.isNotEmpty) ...[
                      const SizedBox(height: 14),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                        decoration: BoxDecoration(color: c.surfaceAlt, borderRadius: BorderRadius.circular(12)),
                        child: Text(hint!,
                            textAlign: TextAlign.center,
                            style: TextStyle(fontSize: 13, height: 18 / 13, color: c.textSecondary)),
                      ),
                    ],
                  ],
                ),
              ),
            ),
          ),
          if (primary != null) PrimaryButton(label: primary!.label, onPressed: primary!.onPress),
          if (primary != null && secondary != null) const SizedBox(height: 10),
          if (secondary != null) SecondaryButton(label: secondary!.label, onPressed: secondary!.onPress),
        ],
      ),
    );
  }
}

/// Pastille de texte (chips, tags).
class Pill extends StatelessWidget {
  final String text;
  final Color background;
  final Color foreground;
  final IconData? icon;
  final double fontSize;
  const Pill({
    super.key,
    required this.text,
    required this.background,
    required this.foreground,
    this.icon,
    this.fontSize = 12,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(color: background, borderRadius: BorderRadius.circular(999)),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[Icon(icon, size: fontSize + 2, color: foreground), const SizedBox(width: 4)],
          Flexible(
            child: Text(text,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(fontSize: fontSize, fontWeight: FontWeight.w600, color: foreground)),
          ),
        ],
      ),
    );
  }
}

/// En-tête d'écran empilé : bouton retour, titre, action optionnelle à droite.
class ScreenHeader extends StatelessWidget {
  final String title;
  final String? subtitle;
  final VoidCallback? onBack;
  final Widget? trailing;
  final bool closeIsCross;
  const ScreenHeader({
    super.key,
    required this.title,
    this.subtitle,
    this.onBack,
    this.trailing,
    this.closeIsCross = false,
  });

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final back = onBack ?? () => Navigator.of(context).maybePop();
    return Row(
      children: [
        closeIsCross ? CircleIconButton.close(back) : CircleIconButton.back(back),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Semantics(
                header: true,
                child: Text(title,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700, color: c.textPrimary)),
              ),
              if (subtitle != null)
                Text(subtitle!,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(fontSize: 13, color: c.textSecondary)),
            ],
          ),
        ),
        if (trailing != null) ...[const SizedBox(width: 12), trailing!],
      ],
    );
  }
}
