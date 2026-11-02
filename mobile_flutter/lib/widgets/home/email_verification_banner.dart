import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:ionicons/ionicons.dart';

import '../../theme/theme_controller.dart';
import '../ui.dart';

/// Rappel affiché tant que l'email du compte (email + mot de passe) n'est
/// pas vérifié : l'assistant IA et la génération de cours en dépendent.
class EmailVerificationBanner extends StatefulWidget {
  /// Écart au-dessus du bandeau, appliqué seulement quand il s'affiche.
  final EdgeInsetsGeometry margin;
  const EmailVerificationBanner({super.key, this.margin = EdgeInsets.zero});

  @override
  State<EmailVerificationBanner> createState() => _EmailVerificationBannerState();
}

class _EmailVerificationBannerState extends State<EmailVerificationBanner> {
  late bool _verified = FirebaseAuth.instance.currentUser?.emailVerified ?? false;
  String? _busy; // 'send' | 'check'
  String? _info;

  Future<void> _resend(User user) async {
    setState(() => _busy = 'send');
    try {
      await user.sendEmailVerification();
      if (mounted) setState(() => _info = 'Email envoyé à ${user.email}.');
    } on FirebaseAuthException catch (e) {
      if (mounted) {
        setState(() => _info = e.code == 'too-many-requests'
            ? 'Email déjà envoyé, patiente quelques minutes.'
            : "L'email n'a pas pu être envoyé.");
      }
    } catch (_) {
      if (mounted) setState(() => _info = "L'email n'a pas pu être envoyé.");
    } finally {
      if (mounted) setState(() => _busy = null);
    }
  }

  Future<void> _check(User user) async {
    setState(() => _busy = 'check');
    try {
      await user.reload();
      final current = FirebaseAuth.instance.currentUser;
      if (current != null && current.emailVerified) {
        // Nouveau token : le serveur doit voir email_verified=true tout de suite.
        await current.getIdToken(true);
        if (mounted) setState(() => _verified = true);
      } else {
        if (mounted) setState(() => _info = 'Pas encore vérifié : clique sur le lien reçu par email.');
      }
    } catch (_) {
      if (mounted) setState(() => _info = 'Vérification impossible, réessaie.');
    } finally {
      if (mounted) setState(() => _busy = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = FirebaseAuth.instance.currentUser;
    final email = user?.email;
    if (user == null || _verified || email == null || email.isEmpty) return const SizedBox.shrink();
    final c = context.colors;
    final busy = _busy != null;

    return Padding(
      padding: widget.margin,
      child: Semantics(
        liveRegion: true,
        child: Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(color: c.tintWarning, borderRadius: BorderRadius.circular(16)),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(Ionicons.mail_unread_outline, size: 22, color: c.warningText),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('Vérifie ton adresse email',
                            style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: c.textPrimary)),
                        const SizedBox(height: 4),
                        Text(
                          _info ??
                              "Clique sur le lien reçu par email pour débloquer l'assistant IA et l'import de cours.",
                          style: TextStyle(fontSize: 14, height: 20 / 14, color: c.textSecondary),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: Tappable(
                      onTap: busy ? null : () => _resend(user),
                      child: Container(
                        constraints: const BoxConstraints(minHeight: 44),
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                          color: c.surface,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: c.border),
                        ),
                        child: _busy == 'send'
                            ? SizedBox(
                                width: 20,
                                height: 20,
                                child: CircularProgressIndicator(strokeWidth: 2, color: c.textPrimary),
                              )
                            : Text('Renvoyer',
                                style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: c.textPrimary)),
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Tappable(
                      onTap: busy ? null : () => _check(user),
                      child: Container(
                        constraints: const BoxConstraints(minHeight: 44),
                        alignment: Alignment.center,
                        decoration: BoxDecoration(color: c.action, borderRadius: BorderRadius.circular(12)),
                        child: _busy == 'check'
                            ? SizedBox(
                                width: 20,
                                height: 20,
                                child: CircularProgressIndicator(strokeWidth: 2, color: c.onAction),
                              )
                            : Text("J'ai vérifié",
                                style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: c.onAction)),
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
