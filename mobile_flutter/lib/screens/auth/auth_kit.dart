import 'package:flutter/material.dart';
import 'package:ionicons/ionicons.dart';

import '../../theme/theme_controller.dart';
import '../../widgets/insets.dart';
import '../../widgets/ui.dart';

// Briques communes aux écrans Connexion / Inscription / Mot de passe oublié.

/// Messages Firebase Auth traduits (y compris invalid-credential des SDK récents).
String authErrorMessage(String? code) {
  switch (code) {
    case 'invalid-email':
      return 'Adresse email invalide.';
    case 'user-not-found':
    case 'wrong-password':
    case 'invalid-credential':
    case 'INVALID_LOGIN_CREDENTIALS':
      return 'Email ou mot de passe incorrect.';
    case 'email-already-in-use':
      return 'Un compte existe déjà avec cet email.';
    case 'weak-password':
      return 'Mot de passe trop faible (6 caractères minimum).';
    case 'too-many-requests':
      return 'Trop de tentatives. Réessaie dans quelques minutes.';
    case 'network-request-failed':
      return 'Pas de connexion internet.';
    case 'operation-not-allowed':
      return 'Ce mode de connexion n’est pas activé.';
    default:
      return 'Une erreur est survenue. Réessaie.';
  }
}

class AuthLayout extends StatelessWidget {
  final String title;
  final String subtitle;
  final VoidCallback? onBack;
  final List<Widget> children;
  final Widget? footer;
  const AuthLayout({
    super.key,
    required this.title,
    required this.subtitle,
    this.onBack,
    required this.children,
    this.footer,
  });

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final insets = ScreenInsets.of(context);
    return Scaffold(
      backgroundColor: c.background,
      body: GestureDetector(
        onTap: () => FocusScope.of(context).unfocus(),
        child: SingleChildScrollView(
          padding: EdgeInsets.fromLTRB(20, insets.top, 20, insets.bottom + 24),
          keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (onBack != null)
                Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child: Align(alignment: Alignment.centerLeft, child: CircleIconButton.back(onBack!)),
                )
              else
                const SizedBox(height: 24),
              const SizedBox(height: 20),
              TweenAnimationBuilder<double>(
                tween: Tween(begin: 0, end: 1),
                duration: const Duration(milliseconds: 350),
                builder: (_, v, child) =>
                    Opacity(opacity: v, child: Transform.translate(offset: Offset(0, (1 - v) * -16), child: child)),
                child: Column(
                  children: [
                    Semantics(
                      label: 'MedFlow',
                      image: true,
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(22),
                        child: Image.asset('assets/icon.png', width: 88, height: 88),
                      ),
                    ),
                    const SizedBox(height: 16),
                    Semantics(
                      header: true,
                      child: Text(title,
                          textAlign: TextAlign.center,
                          style: TextStyle(fontSize: 26, fontWeight: FontWeight.w700, color: c.textPrimary)),
                    ),
                    const SizedBox(height: 8),
                    Text(subtitle,
                        textAlign: TextAlign.center,
                        style: TextStyle(fontSize: 15, height: 22 / 15, color: c.textSecondary)),
                  ],
                ),
              ),
              const SizedBox(height: 20),
              Container(
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  color: c.surface,
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: c.border),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    for (var i = 0; i < children.length; i++) ...[
                      if (i > 0) const SizedBox(height: 16),
                      children[i],
                    ],
                  ],
                ),
              ),
              if (footer != null) ...[const SizedBox(height: 20), footer!],
            ],
          ),
        ),
      ),
    );
  }
}

class AuthField extends StatefulWidget {
  final String label;
  final IconData icon;
  final bool secure;
  final TextEditingController controller;
  final String? hint;
  final TextInputType? keyboardType;
  final TextInputAction? textInputAction;
  final Iterable<String>? autofillHints;
  final TextCapitalization textCapitalization;
  final ValueChanged<String>? onSubmitted;
  const AuthField({
    super.key,
    required this.label,
    required this.icon,
    required this.controller,
    this.secure = false,
    this.hint,
    this.keyboardType,
    this.textInputAction,
    this.autofillHints,
    this.textCapitalization = TextCapitalization.sentences,
    this.onSubmitted,
  });

  @override
  State<AuthField> createState() => _AuthFieldState();
}

class _AuthFieldState extends State<AuthField> {
  final _focus = FocusNode();
  bool _visible = false;

  @override
  void initState() {
    super.initState();
    _focus.addListener(() => setState(() {}));
  }

  @override
  void dispose() {
    _focus.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final focused = _focus.hasFocus;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(widget.label, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: c.textSecondary)),
        const SizedBox(height: 6),
        Container(
          constraints: const BoxConstraints(minHeight: 52),
          padding: const EdgeInsets.only(left: 14),
          decoration: BoxDecoration(
            color: focused ? c.surface : c.background,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: focused ? c.primaryDark : c.border, width: 1.5),
          ),
          child: Row(
            children: [
              Icon(widget.icon, size: 20, color: focused ? c.primaryDark : c.textSecondary),
              const SizedBox(width: 10),
              Expanded(
                child: TextField(
                  controller: widget.controller,
                  focusNode: _focus,
                  obscureText: widget.secure && !_visible,
                  keyboardType: widget.keyboardType,
                  textInputAction: widget.textInputAction,
                  autofillHints: widget.autofillHints,
                  autocorrect: !widget.secure && widget.keyboardType != TextInputType.emailAddress,
                  textCapitalization: widget.textCapitalization,
                  onSubmitted: widget.onSubmitted,
                  style: TextStyle(fontSize: 16, color: c.textPrimary),
                  decoration: InputDecoration(
                    isDense: true,
                    border: InputBorder.none,
                    hintText: widget.hint,
                    hintStyle: TextStyle(color: c.textSecondary),
                    contentPadding: const EdgeInsets.fromLTRB(0, 14, 14, 14),
                    semanticCounterText: widget.label,
                  ),
                ),
              ),
              if (widget.secure)
                Semantics(
                  button: true,
                  label: _visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe',
                  excludeSemantics: true,
                  child: InkResponse(
                    onTap: () => setState(() => _visible = !_visible),
                    radius: 22,
                    child: SizedBox(
                      width: 44,
                      height: 44,
                      child: Icon(_visible ? Ionicons.eye_off_outline : Ionicons.eye_outline,
                          size: 20, color: c.textSecondary),
                    ),
                  ),
                ),
            ],
          ),
        ),
      ],
    );
  }
}

class AuthError extends StatelessWidget {
  final String? message;
  const AuthError({super.key, this.message});

  @override
  Widget build(BuildContext context) {
    if (message == null) return const SizedBox.shrink();
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
              child: Text(message!,
                  style: TextStyle(fontSize: 14, fontWeight: FontWeight.w500, color: c.dangerText)),
            ),
          ],
        ),
      ),
    );
  }
}

class AuthLink extends StatelessWidget {
  final String text;
  final String action;
  final VoidCallback onPressed;
  const AuthLink({super.key, required this.text, required this.action, required this.onPressed});

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Tappable(
      onTap: onPressed,
      semanticLabel: '$text $action',
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 8),
        child: Text.rich(
          TextSpan(
            text: '$text ',
            style: TextStyle(fontSize: 15, color: c.textSecondary),
            children: [
              TextSpan(text: action, style: TextStyle(fontWeight: FontWeight.w700, color: c.primaryText)),
            ],
          ),
          textAlign: TextAlign.center,
        ),
      ),
    );
  }
}
