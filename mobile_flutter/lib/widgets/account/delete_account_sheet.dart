import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:ionicons/ionicons.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../config.dart';
import '../../screens/auth/google_sign_in_button.dart';
import '../../services/api.dart';
import '../../theme/theme_controller.dart';
import '../sheet.dart';
import '../ui.dart';

// Copie de components/ui/DeleteAccountSheet.tsx.

const _lost = [
  'Tes cours importés et leur contenu',
  'Ta progression, ton XP, tes badges et ta série',
  'Tes amis et tes conversations avec l’assistant',
];

/// Efface les données gardées sur le téléphone pour ce compte.
Future<void> _clearLocalData(String uid) async {
  try {
    final prefs = await SharedPreferences.getInstance();
    for (final k in prefs.getKeys().where((k) => k.contains(uid)).toList()) {
      await prefs.remove(k);
    }
  } catch (_) {
    // Non bloquant : le compte est déjà supprimé côté serveur.
  }
}

/// Suppression définitive du compte. Demande de se reconnecter (mot de passe
/// ou Google) : le serveur refuse si la dernière connexion date de plus de 5 min.
Future<void> showDeleteAccountSheet(BuildContext context) {
  return showAppSheet<void>(
    context,
    showClose: false,
    builder: (_) => const _DeleteAccount(),
  );
}

class _DeleteAccount extends StatefulWidget {
  const _DeleteAccount();

  @override
  State<_DeleteAccount> createState() => _DeleteAccountState();
}

class _DeleteAccountState extends State<_DeleteAccount> {
  final _password = TextEditingController();
  bool _busy = false;
  String? _error;

  User? get _user => FirebaseAuth.instance.currentUser;
  bool get _usesPassword => _user?.providerData.any((p) => p.providerId == 'password') ?? false;
  bool get _usesGoogle => _user?.providerData.any((p) => p.providerId == 'google.com') ?? false;

  /// Google seulement sur Android, comme l'app Expo : sur iOS, mot de passe uniquement.
  bool get _canUseGoogle => !_usesPassword && _usesGoogle && googleSignInAvailable;

  @override
  void dispose() {
    _password.dispose();
    super.dispose();
  }

  void _close() {
    if (_busy) return;
    Navigator.of(context).maybePop();
  }

  void _setError(String? message) {
    if (!mounted) return;
    setState(() {
      _busy = false;
      _error = message;
    });
  }

  Future<void> _deleteWith(AuthCredential credential) async {
    final user = _user;
    if (user == null) return;
    try {
      await user.reauthenticateWithCredential(credential);
      // Token neuf : il porte la date de connexion que le serveur vérifie.
      await user.getIdToken(true);
      final res = await Api.delete('/api/account');
      if (res.statusCode < 200 || res.statusCode >= 300) {
        final data = decodeBody(res);
        final serverError = data is Map && data['error'] is String && (data['error'] as String).isNotEmpty
            ? data['error'] as String
            : null;
        throw UserFacingError(serverError ?? 'Suppression impossible, réessaie.', res.statusCode);
      }
      final uid = user.uid;
      await _clearLocalData(uid);
      // Le compte n'existe plus : la navigation repart sur l'écran de connexion.
      try {
        await FirebaseAuth.instance.signOut();
      } catch (_) {}
    } on FirebaseAuthException catch (e) {
      if (e.code == 'wrong-password' || e.code == 'invalid-credential' || e.code == 'INVALID_LOGIN_CREDENTIALS') {
        _setError('Mot de passe incorrect.');
      } else if (e.code == 'too-many-requests') {
        _setError('Trop de tentatives. Réessaie dans quelques minutes.');
      } else if (e.code == 'network-request-failed') {
        _setError('Pas de connexion internet.');
      } else {
        _setError('Suppression impossible, réessaie.');
      }
    } on UserFacingError catch (e) {
      _setError(e.message);
    } catch (_) {
      _setError('Suppression impossible, réessaie.');
    }
  }

  void _confirmWithPassword() {
    final email = _user?.email;
    if (email == null || email.isEmpty || _password.text.isEmpty) {
      setState(() => _error = 'Entre ton mot de passe pour confirmer.');
      return;
    }
    setState(() {
      _error = null;
      _busy = true;
    });
    _deleteWith(EmailAuthProvider.credential(email: email, password: _password.text));
  }

  // Android seulement (googleSignInAvailable) : jamais appelé sur iOS.
  Future<void> _confirmWithGoogle() async {
    setState(() {
      _error = null;
      _busy = true;
    });
    try {
      final account = await GoogleSignIn(serverClientId: googleWebClientId).signIn();
      if (account == null) {
        _setError(null);
        return;
      }
      final idToken = (await account.authentication).idToken;
      if (idToken == null) throw Exception('no id token');
      await _deleteWith(GoogleAuthProvider.credential(idToken: idToken));
    } catch (_) {
      _setError('Connexion Google impossible.');
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final usesPassword = _usesPassword;
    final canUseGoogle = _canUseGoogle;
    final disabled = _busy || (!usesPassword && !canUseGoogle);

    const gap = SizedBox(height: 14);
    return PopScope(
      canPop: !_busy,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Center(
            child: Container(
              width: 56,
              height: 56,
              decoration: BoxDecoration(color: c.tintDanger, shape: BoxShape.circle),
              child: Icon(Ionicons.warning_outline, size: 28, color: c.dangerText),
            ),
          ),
          gap,
          Semantics(
            header: true,
            child: Text('Supprimer mon compte',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700, color: c.textPrimary)),
          ),
          gap,
          Text('Cette action est définitive. Tu perdras :',
              textAlign: TextAlign.center, style: TextStyle(fontSize: 15, color: c.textSecondary)),
          gap,
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(color: c.surfaceAlt, borderRadius: BorderRadius.circular(14)),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                for (var i = 0; i < _lost.length; i++) ...[
                  if (i > 0) const SizedBox(height: 8),
                  Row(
                    children: [
                      Icon(Ionicons.close_circle, size: 18, color: c.dangerText),
                      const SizedBox(width: 10),
                      Expanded(child: Text(_lost[i], style: TextStyle(fontSize: 14, color: c.textPrimary))),
                    ],
                  ),
                ],
              ],
            ),
          ),
          if (usesPassword) ...[
            gap,
            Semantics(
              label: 'Mot de passe pour confirmer',
              child: TextField(
                controller: _password,
                obscureText: true,
                enabled: !_busy,
                autofillHints: const [AutofillHints.password],
                textInputAction: TextInputAction.done,
                onSubmitted: (_) => _confirmWithPassword(),
                style: TextStyle(fontSize: 16, color: c.textPrimary),
                cursorColor: c.primaryDark,
                decoration: InputDecoration(
                  hintText: 'Ton mot de passe',
                  hintStyle: TextStyle(color: c.textSecondary),
                  filled: true,
                  fillColor: c.background,
                  isDense: true,
                  constraints: const BoxConstraints(minHeight: 52),
                  contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 15),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(14),
                    borderSide: BorderSide(color: c.border, width: 1.5),
                  ),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(14),
                    borderSide: BorderSide(color: c.border, width: 1.5),
                  ),
                  disabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(14),
                    borderSide: BorderSide(color: c.border, width: 1.5),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(14),
                    borderSide: BorderSide(color: c.border, width: 1.5),
                  ),
                ),
              ),
            ),
          ],
          if (!usesPassword && !canUseGoogle) ...[
            gap,
            Text(
              'Reconnecte-toi avec Google depuis l’application installée (APK) pour confirmer.',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 14, color: c.textSecondary),
            ),
          ],
          if (_error != null && _error!.isNotEmpty) ...[
            gap,
            Semantics(
              liveRegion: true,
              child: Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(color: c.tintDanger, borderRadius: BorderRadius.circular(12)),
                child: Row(
                  children: [
                    Icon(Ionicons.alert_circle, size: 18, color: c.dangerText),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(_error!,
                          style: TextStyle(fontSize: 14, fontWeight: FontWeight.w500, color: c.dangerText)),
                    ),
                  ],
                ),
              ),
            ),
          ],
          gap,
          Semantics(
            button: true,
            enabled: !disabled,
            label: _busy ? null : (usesPassword ? 'Supprimer définitivement' : 'Confirmer avec Google'),
            child: Opacity(
              opacity: disabled ? 0.6 : 1,
              child: Tappable(
                onTap: disabled ? null : (usesPassword ? _confirmWithPassword : _confirmWithGoogle),
                child: Container(
                  height: 54,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(color: c.dangerText, borderRadius: BorderRadius.circular(14)),
                  child: _busy
                      ? SizedBox(
                          width: 22,
                          height: 22,
                          child: CircularProgressIndicator(strokeWidth: 2.5, color: c.surface),
                        )
                      : ExcludeSemantics(
                          child: Text(
                            usesPassword ? 'Supprimer définitivement' : 'Confirmer avec Google',
                            style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: c.surface),
                          ),
                        ),
                ),
              ),
            ),
          ),
          gap,
          Tappable(
            onTap: _busy ? null : _close,
            child: SizedBox(
              height: 48,
              child: Center(
                child: Text('Annuler',
                    style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: c.textSecondary)),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
