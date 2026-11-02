import 'dart:io';

import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:ionicons/ionicons.dart';

import '../../config.dart';
import '../../theme/theme_controller.dart';
import 'auth_kit.dart';

/// Connexion Google : Android seulement, comme l'app Expo (sur iOS, l'App
/// Store exigerait aussi « Se connecter avec Apple »).
final bool googleSignInAvailable = Platform.isAndroid && googleWebClientId.isNotEmpty;

/// « Continuer avec Google » + séparateur « ou ». Rien n'est affiché si la
/// connexion Google n'est pas disponible.
class GoogleSignInButton extends StatefulWidget {
  const GoogleSignInButton({super.key});

  @override
  State<GoogleSignInButton> createState() => _GoogleSignInButtonState();
}

class _GoogleSignInButtonState extends State<GoogleSignInButton> {
  bool _loading = false;
  String? _error;

  Future<void> _signIn() async {
    setState(() {
      _error = null;
      _loading = true;
    });
    try {
      final account = await GoogleSignIn(serverClientId: googleWebClientId).signIn();
      if (account == null) {
        setState(() => _loading = false);
        return;
      }
      final auth = await account.authentication;
      if (auth.idToken == null) throw Exception('no id token');
      // La navigation bascule d'elle-même via authStateChanges.
      await FirebaseAuth.instance.signInWithCredential(GoogleAuthProvider.credential(idToken: auth.idToken));
    } on FirebaseAuthException catch (e) {
      setState(() {
        _loading = false;
        _error = e.code == 'account-exists-with-different-credential'
            ? 'Un compte existe déjà avec cet email : connecte-toi avec ton mot de passe.'
            : authErrorMessage(e.code);
      });
    } catch (_) {
      if (mounted) {
        setState(() {
          _loading = false;
          _error = 'Connexion Google impossible.';
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    if (!googleSignInAvailable) return const SizedBox.shrink();
    final c = context.colors;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            Expanded(child: Container(height: 1, color: c.border)),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12),
              child: Text('ou', style: TextStyle(fontSize: 13, color: c.textSecondary)),
            ),
            Expanded(child: Container(height: 1, color: c.border)),
          ],
        ),
        const SizedBox(height: 16),
        SizedBox(
          height: 56,
          child: OutlinedButton(
            style: OutlinedButton.styleFrom(
              backgroundColor: c.surface,
              side: BorderSide(color: c.border, width: 1.5),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
            ),
            onPressed: _loading ? null : _signIn,
            child: _loading
                ? SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2.5, color: c.textPrimary))
                : Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Ionicons.logoGoogle, size: 20, color: c.textPrimary),
                      const SizedBox(width: 10),
                      Text('Continuer avec Google',
                          style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: c.textPrimary)),
                    ],
                  ),
          ),
        ),
        if (_error != null) ...[const SizedBox(height: 16), AuthError(message: _error)],
      ],
    );
  }
}
