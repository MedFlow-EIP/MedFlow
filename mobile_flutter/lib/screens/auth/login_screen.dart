import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:ionicons/ionicons.dart';

import '../../navigation/nav.dart';
import '../../theme/theme_controller.dart';
import '../../widgets/ui.dart';
import 'auth_kit.dart';
import 'google_sign_in_button.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _email = TextEditingController();
  final _password = TextEditingController();
  bool _loading = false;
  String? _error;

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _login() async {
    if (_email.text.trim().isEmpty || _password.text.isEmpty) {
      setState(() => _error = 'Renseigne ton email et ton mot de passe.');
      return;
    }
    setState(() {
      _error = null;
      _loading = true;
    });
    try {
      await FirebaseAuth.instance.signInWithEmailAndPassword(email: _email.text.trim(), password: _password.text);
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
        title: 'Bon retour !',
        subtitle: 'Connecte-toi pour reprendre tes révisions.',
        footer: AuthLink(text: 'Pas encore de compte ?', action: 'S’inscrire', onPressed: () => Nav.navigate('Register')),
        children: [
          AuthField(
            label: 'Email',
            icon: Ionicons.mailOutline,
            controller: _email,
            hint: 'prenom.nom@email.com',
            keyboardType: TextInputType.emailAddress,
            textCapitalization: TextCapitalization.none,
            autofillHints: const [AutofillHints.email],
            textInputAction: TextInputAction.next,
          ),
          AuthField(
            label: 'Mot de passe',
            icon: Ionicons.lockClosedOutline,
            controller: _password,
            secure: true,
            hint: 'Ton mot de passe',
            autofillHints: const [AutofillHints.password],
            textInputAction: TextInputAction.go,
            onSubmitted: (_) => _login(),
          ),
          Align(
            alignment: Alignment.centerRight,
            child: Tappable(
              onTap: () => Nav.navigate('ForgotPassword'),
              semanticLabel: 'Mot de passe oublié ?',
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 6),
                child: Text('Mot de passe oublié ?',
                    style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: c.primaryText)),
              ),
            ),
          ),
          if (_error != null) AuthError(message: _error),
          PrimaryButton(label: 'Se connecter', loading: _loading, onPressed: _login),
          const GoogleSignInButton(),
        ],
      ),
    );
  }
}
