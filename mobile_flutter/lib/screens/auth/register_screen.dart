import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:ionicons/ionicons.dart';

import '../../navigation/nav.dart';
import '../../theme/theme_controller.dart';
import '../../widgets/ui.dart';
import 'auth_kit.dart';
import 'google_sign_in_button.dart';

class RegisterScreen extends StatefulWidget {
  const RegisterScreen({super.key});

  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  final _firstName = TextEditingController();
  final _lastName = TextEditingController();
  final _email = TextEditingController();
  final _password = TextEditingController();
  final _confirm = TextEditingController();
  late final TapGestureRecognizer _legalTap = TapGestureRecognizer()..onTap = () => Nav.navigate('Legal');
  bool _loading = false;
  String? _error;

  @override
  void dispose() {
    for (final c in [_firstName, _lastName, _email, _password, _confirm]) {
      c.dispose();
    }
    _legalTap.dispose();
    super.dispose();
  }

  Future<void> _register() async {
    final first = _firstName.text.trim(), last = _lastName.text.trim(), email = _email.text.trim();
    if (first.isEmpty || last.isEmpty || email.isEmpty || _password.text.isEmpty || _confirm.text.isEmpty) {
      setState(() => _error = 'Remplis tous les champs.');
      return;
    }
    if (_password.text.length < 6) {
      setState(() => _error = 'Le mot de passe doit contenir au moins 6 caractères.');
      return;
    }
    if (_password.text != _confirm.text) {
      setState(() => _error = 'Les mots de passe ne correspondent pas.');
      return;
    }
    setState(() {
      _error = null;
      _loading = true;
    });
    try {
      final cred =
          await FirebaseAuth.instance.createUserWithEmailAndPassword(email: email, password: _password.text);
      final user = cred.user!;
      // Le nom est connu du backend dès la première requête (classement, recherche d'amis).
      await user.updateDisplayName('$first $last');
      await user.reload();
      // L'IA est réservée aux emails vérifiés : le lien part tout de suite.
      // Non bloquant : le bandeau de l'accueil permet de le renvoyer.
      user.sendEmailVerification().catchError((_) {});
    } on FirebaseAuthException catch (e) {
      if (mounted) setState(() => _error = authErrorMessage(e.code));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return AutofillGroup(
      child: AuthLayout(
        title: 'Crée ton compte',
        subtitle: 'Importe tes cours et révise avec des flashcards et des quiz générés par l’IA.',
        onBack: () => Nav.goBack(),
        footer: AuthLink(text: 'Déjà un compte ?', action: 'Se connecter', onPressed: () => Nav.popToTop()),
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: AuthField(
                  label: 'Prénom',
                  icon: Ionicons.person_outline,
                  controller: _firstName,
                  autofillHints: const [AutofillHints.givenName],
                  textCapitalization: TextCapitalization.words,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: AuthField(
                  label: 'Nom',
                  icon: Ionicons.person_outline,
                  controller: _lastName,
                  autofillHints: const [AutofillHints.familyName],
                  textCapitalization: TextCapitalization.words,
                ),
              ),
            ],
          ),
          AuthField(
            label: 'Email',
            icon: Ionicons.mail_outline,
            controller: _email,
            hint: 'prenom.nom@email.com',
            keyboardType: TextInputType.emailAddress,
            textCapitalization: TextCapitalization.none,
            autofillHints: const [AutofillHints.email],
          ),
          AuthField(
            label: 'Mot de passe',
            icon: Ionicons.lock_closed_outline,
            controller: _password,
            secure: true,
            hint: '6 caractères minimum',
            autofillHints: const [AutofillHints.newPassword],
          ),
          AuthField(
            label: 'Confirmer le mot de passe',
            icon: Ionicons.lock_closed_outline,
            controller: _confirm,
            secure: true,
            autofillHints: const [AutofillHints.newPassword],
            textInputAction: TextInputAction.go,
            onSubmitted: (_) => _register(),
          ),
          if (_error != null) AuthError(message: _error),
          Text.rich(
            TextSpan(
              style: TextStyle(fontSize: 13, height: 19 / 13, color: c.textSecondary),
              children: [
                const TextSpan(
                  text: 'En créant un compte, tu acceptes que tes cours soient traités par une IA pour générer '
                      'tes révisions. MedFlow ne remplace pas un avis médical. ',
                ),
                TextSpan(
                  text: 'En savoir plus',
                  recognizer: _legalTap,
                  style: TextStyle(
                    color: c.primaryText,
                    fontWeight: FontWeight.w600,
                    decoration: TextDecoration.underline,
                  ),
                ),
              ],
            ),
          ),
          PrimaryButton(label: 'Créer mon compte', loading: _loading, onPressed: _register),
          const GoogleSignInButton(),
        ],
      ),
    );
  }
}
