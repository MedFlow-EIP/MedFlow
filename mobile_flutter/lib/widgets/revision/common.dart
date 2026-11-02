import 'package:flutter/material.dart';
import 'package:ionicons/ionicons.dart';

import '../../theme/theme_controller.dart';
import '../insets.dart';
import '../ui.dart';

// Briques communes aux écrans de révision, flashcards et examens
// (styles identiques recopiés de RevisionScreen, FlashcardReviewScreen,
// MockExamScreen et ExamsScreen).

/// Nombre affiché comme `String(n)` en JavaScript : un JSON « 14.0 » devient
/// un double Dart qui s'écrirait « 14.0 », là où l'app RN affichait « 14 ».
String jsNum(Object? value) {
  if (value is double && value.isFinite && value == value.truncateToDouble()) return '${value.toInt()}';
  return '$value';
}

/// Équivalent d'ActivityIndicator : « large » (36 px) ou « small » (20 px).
class Spinner extends StatelessWidget {
  final bool large;
  final Color? color;
  final String? label;
  const Spinner({super.key, this.large = false, this.color, this.label});

  @override
  Widget build(BuildContext context) {
    final size = large ? 36.0 : 20.0;
    return SizedBox(
      width: size,
      height: size,
      child: CircularProgressIndicator(
        strokeWidth: large ? 3.5 : 2.5,
        color: color ?? context.colors.primaryDark,
        semanticsLabel: label,
      ),
    );
  }
}

/// En-tête d'une session : croix « Quitter la révision », progression, compteur.
class SessionHeader extends StatelessWidget {
  final int index;
  final int total;
  final double paddingBottom;
  final VoidCallback onClose;
  const SessionHeader({
    super.key,
    required this.index,
    required this.total,
    required this.paddingBottom,
    required this.onClose,
  });

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Padding(
      padding: EdgeInsets.fromLTRB(20, 0, 20, paddingBottom),
      child: Row(
        children: [
          CircleIconButton(icon: Ionicons.close, label: 'Quitter la révision', onPressed: onClose),
          const SizedBox(width: 12),
          Expanded(
            child: ProgressBar(progress: total == 0 ? 0 : (index / total) * 100, height: 8, color: c.primaryDark),
          ),
          const SizedBox(width: 12),
          Text('${index + 1}/$total',
              style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: c.textSecondary)),
        ],
      ),
    );
  }
}

/// Pastille « examen proche » (fond orange pâle, icône calendrier).
class ExamChip extends StatelessWidget {
  final String text;
  final bool singleLine;
  const ExamChip({super.key, required this.text, this.singleLine = false});

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final label = Text(
      text,
      maxLines: singleLine ? 1 : null,
      overflow: singleLine ? TextOverflow.ellipsis : null,
      style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: c.warningText),
    );
    return Align(
      alignment: Alignment.centerLeft,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
        decoration: BoxDecoration(color: c.tintWarning, borderRadius: BorderRadius.circular(999)),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Ionicons.calendar_outline, size: 13, color: c.warningText),
            const SizedBox(width: 5),
            Flexible(child: label),
          ],
        ),
      ),
    );
  }
}

/// Lien souligné « Signaler une erreur » (drapeau).
class ReportLink extends StatelessWidget {
  final String semanticLabel;
  final VoidCallback onTap;
  const ReportLink({super.key, required this.semanticLabel, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Tappable(
      onTap: onTap,
      semanticLabel: semanticLabel,
      child: ExcludeSemantics(
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: 44),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Ionicons.flag_outline, size: 16, color: c.textSecondary),
              const SizedBox(width: 6),
              Flexible(
                child: Text('Signaler une erreur',
                    style: TextStyle(
                      fontSize: 14,
                      color: c.textSecondary,
                      decoration: TextDecoration.underline,
                      decorationColor: c.textSecondary,
                    )),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Encadré d'erreur rouge (icône alerte + message), annoncé aux lecteurs d'écran.
class InlineErrorBox extends StatelessWidget {
  final String message;
  const InlineErrorBox({super.key, required this.message});

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Semantics(
      liveRegion: true,
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(color: c.tintDanger, borderRadius: BorderRadius.circular(12)),
        child: Row(
          children: [
            Icon(Ionicons.alert_circle, size: 18, color: c.dangerText),
            const SizedBox(width: 8),
            Expanded(
              child: Text(message,
                  style: TextStyle(fontSize: 14, fontWeight: FontWeight.w500, color: c.dangerText)),
            ),
          ],
        ),
      ),
    );
  }
}

/// Encadré d'information bleu (icône + texte).
class InfoBox extends StatelessWidget {
  final IconData icon;
  final String text;
  const InfoBox({super.key, required this.icon, required this.text});

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(color: c.tintPrimary, borderRadius: BorderRadius.circular(14)),
      child: Row(
        children: [
          Icon(icon, size: 18, color: c.primaryText),
          const SizedBox(width: 10),
          Expanded(
            child: Text(text,
                style: TextStyle(fontSize: 13, height: 18 / 13, fontWeight: FontWeight.w500, color: c.primaryText)),
          ),
        ],
      ),
    );
  }
}

/// Ligne de cours à cocher (case + nom, compteur optionnel à droite).
class CourseCheckRow extends StatelessWidget {
  final String name;
  final bool checked;
  final VoidCallback onTap;
  final String? trailing;
  const CourseCheckRow({super.key, required this.name, required this.checked, required this.onTap, this.trailing});

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Semantics(
      container: true,
      checked: checked,
      child: Tappable(
        onTap: onTap,
        button: false,
        child: Container(
          constraints: const BoxConstraints(minHeight: 52),
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          decoration: BoxDecoration(
            color: checked ? c.tintPrimary : c.surface,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: checked ? c.primaryDark : c.border),
          ),
          child: Row(
            children: [
              Icon(checked ? Ionicons.checkbox : Ionicons.square_outline,
                  size: 22, color: checked ? c.primaryDark : c.textSecondary),
              const SizedBox(width: 12),
              Expanded(
                child: Text(name,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(fontSize: 15, color: c.textPrimary)),
              ),
              if (trailing != null) ...[
                const SizedBox(width: 12),
                Text(trailing!, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: c.textSecondary)),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

/// Barre d'action fixée en bas de l'écran (fond surface, trait au-dessus).
class BottomActionBar extends StatelessWidget {
  final List<Widget> children;
  const BottomActionBar({super.key, required this.children});

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
      child: Row(
        children: [
          for (var i = 0; i < children.length; i++) ...[
            if (i > 0) const SizedBox(width: 12),
            Expanded(child: children[i]),
          ],
        ],
      ),
    );
  }
}

/// Bouton plein (54 px) de la barre d'action.
class BarPrimaryButton extends StatelessWidget {
  final String label;
  final VoidCallback? onTap;
  final bool busy;
  final IconData? icon;
  final double disabledOpacity;
  const BarPrimaryButton({
    super.key,
    required this.label,
    required this.onTap,
    this.busy = false,
    this.icon,
    this.disabledOpacity = 0.5,
  });

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final disabled = onTap == null;
    return Semantics(
      button: true,
      enabled: !disabled,
      label: busy ? label : null,
      child: Opacity(
        opacity: disabled ? disabledOpacity : 1,
        child: Tappable(
          onTap: onTap,
          button: false,
          child: Container(
            height: 54,
            decoration: BoxDecoration(color: c.action, borderRadius: BorderRadius.circular(14)),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: busy
                  ? [Spinner(color: c.onAction)]
                  : [
                      if (icon != null) ...[Icon(icon, size: 22, color: c.onAction), const SizedBox(width: 8)],
                      Flexible(
                        child: Text(label,
                            textAlign: TextAlign.center,
                            style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: c.onAction)),
                      ),
                    ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Bouton à bordure (54 px) de la barre d'action.
class BarSecondaryButton extends StatelessWidget {
  final String label;
  final VoidCallback onTap;
  const BarSecondaryButton({super.key, required this.label, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Tappable(
      onTap: onTap,
      child: Container(
        height: 54,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: c.surface,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: c.primaryDark, width: 1.5),
        ),
        child: Text(label,
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: c.primaryText)),
      ),
    );
  }
}
