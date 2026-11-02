import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:ionicons/ionicons.dart';

import '../../navigation/nav.dart';
import '../../theme/theme_controller.dart';
import '../../widgets/ui.dart';
import 'auth_kit.dart';

class ForgotPasswordScreen extends StatefulWidget {
  const ForgotPasswordScreen({super.key});

  @override
  State<ForgotPasswordScreen> createState() => _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends State<ForgotPasswordScreen> {
  final _email = TextEditingController();
  bool _loading = false;
  bool _sent = false;
  String? _error;

  @override
  void dispose() {
    _email.dispose();
    super.dispose();
  }

  Future<void> _reset() async {
    if (_email.text.trim().isEmpty) {
      setState(() => _error = 'Renseigne l’email de ton compte.');
      return;
    }
    setState(() {
      _error = null;
      _loading = true;
    });
    try {
      await FirebaseAuth.instance.sendPasswordResetEmail(email: _email.text.trim());
      setState(() => _sent = true);
    } on FirebaseAuthException catch (e) {
      // Pas de distinction « compte inexistant » : on ne révèle pas quels emails ont un compte.
      setState(() {
        if (e.code == 'user-not-found') {
          _sent = true;
        } else {
          _error = authErrorMessage(e.code);
        }
      });
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return AuthLayout(
      title: 'Mot de passe oublié',
      subtitle: 'Entre l’email de ton compte : on t’envoie un lien pour en choisir un nouveau.',
      onBack: () => Nav.goBack(),
      footer: AuthLink(text: 'Tu t’en souviens ?', action: 'Se connecter', onPressed: () => Nav.popToTop()),
      children: _sent
          ? [
              Semantics(
                liveRegion: true,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Center(
                      child: Container(
                        width: 64,
                        height: 64,
                        decoration: BoxDecoration(color: c.tintSuccess, shape: BoxShape.circle),
                        child: Icon(Ionicons.mail_open_outline, size: 28, color: c.success),
                      ),
                    ),
                    const SizedBox(height: 10),
                    Text('Vérifie ta boîte mail',
                        textAlign: TextAlign.center,
                        style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: c.textPrimary)),
                    const SizedBox(height: 10),
                    Text(
                      'Si un compte existe pour ${_email.text.trim()}, un lien de réinitialisation vient d’y être '
                      'envoyé. Pense à regarder dans les spams.',
                      textAlign: TextAlign.center,
                      style: TextStyle(fontSize: 14, height: 21 / 14, color: c.textSecondary),
                    ),
                    const SizedBox(height: 18),
                    PrimaryButton(label: 'Retour à la connexion', onPressed: () => Nav.popToTop()),
                  ],
                ),
              ),
            ]
          : [
              AuthField(
                label: 'Email',
                icon: Ionicons.mail_outline,
                controller: _email,
                hint: 'prenom.nom@email.com',
                keyboardType: TextInputType.emailAddress,
                textCapitalization: TextCapitalization.none,
                autofillHints: const [AutofillHints.email],
                textInputAction: TextInputAction.send,
                onSubmitted: (_) => _reset(),
              ),
              if (_error != null) AuthError(message: _error),
              PrimaryButton(label: 'Envoyer le lien', loading: _loading, onPressed: _reset),
            ],
    );
  }
}
