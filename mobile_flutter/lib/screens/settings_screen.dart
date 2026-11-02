import 'dart:io';

import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:image_picker/image_picker.dart';
import 'package:ionicons/ionicons.dart';
import 'package:provider/provider.dart';

import '../navigation/nav.dart';
import '../services/api.dart';
import '../theme/theme_controller.dart';
import '../utils/app_alert.dart';
import '../utils/export_data.dart';
import '../utils/first_time.dart';
import '../utils/push_notifications.dart';
import '../utils/reminders.dart';
import '../utils/tutorial.dart';
import '../widgets/account/delete_account_sheet.dart';
import '../widgets/account/time_picker_sheet.dart';
import '../widgets/insets.dart';
import '../widgets/ui.dart';

// Copie de components/screens/SettingsScreen.tsx.

final _specialChar = RegExp(r'[!@#$%^&*(),.?":{}|<>]');

/// Message d'une erreur attrapée (équivalent de `e.message` en JS).
String _messageOf(Object e) {
  if (e is UserFacingError) return e.message;
  if (e is FirebaseException) return e.message ?? e.code;
  return '$e';
}

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  late final TextEditingController _fullName;
  String? _photo;
  bool _uploadingPhoto = false;
  bool _streakRemindersOn = false;
  bool _revisionRemindersOn = false;
  int _reminderHour = 9;
  int _reminderMinute = 0;
  bool _exporting = false;

  final _newPassword = TextEditingController();
  final _confirmPassword = TextEditingController();

  User? get _user => FirebaseAuth.instance.currentUser;

  @override
  void initState() {
    super.initState();
    _fullName = TextEditingController(text: _user?.displayName ?? '');
    _photo = _user?.photoURL;
    _newPassword.addListener(_refresh);
    _confirmPassword.addListener(_refresh);
    isStreakReminderEnabled().then((v) {
      if (mounted) setState(() => _streakRemindersOn = v);
    });
    isRevisionReminderEnabled().then((v) {
      if (mounted) setState(() => _revisionRemindersOn = v);
    });
    getRevisionReminderTime().then((t) {
      if (!mounted) return;
      setState(() {
        _reminderHour = t.hour;
        _reminderMinute = t.minute;
      });
    });
  }

  void _refresh() => setState(() {});

  @override
  void dispose() {
    _fullName.dispose();
    _newPassword.dispose();
    _confirmPassword.dispose();
    super.dispose();
  }

  Future<void> _handleExportData(BuildContext origin) async {
    final user = _user;
    if (user == null || _exporting) return;
    final box = origin.findRenderObject();
    final rect = box is RenderBox && box.hasSize ? box.localToGlobal(Offset.zero) & box.size : null;
    setState(() => _exporting = true);
    try {
      final result = await exportUserData(user, origin: rect);
      if (result == ExportResult.saved) {
        appAlert('Données exportées', 'Le fichier JSON est enregistré dans le dossier choisi.');
      }
    } catch (err) {
      appAlert('Export impossible', errorMessage(err, 'Réessaie dans un instant.'));
    } finally {
      if (mounted) setState(() => _exporting = false);
    }
  }

  // Les comptes Google n'ont pas de mot de passe MedFlow à changer.
  bool get _hasPassword => _user?.providerData.any((p) => p.providerId == 'password') ?? false;

  Future<void> _handleToggleStreakReminders(bool value) async {
    if (value) {
      final user = _user;
      String? lastActivity;
      if (user != null) {
        try {
          final data = decodeBody(await Api.get('/api/account'));
          final stats = data is Map ? data['stats'] : null;
          lastActivity = stats is Map && stats['lastActivity'] is String ? stats['lastActivity'] as String : null;
        } catch (_) {
          // Pas grave si ça échoue : on planifie quand même, juste sans
          // savoir si l'utilisateur a déjà été actif aujourd'hui.
        }
      }
      final granted = await enableStreakReminders(lastActivity);
      if (!granted) {
        appAlert(
          'Permission refusée',
          'Active les notifications pour MedFlow dans les réglages de ton téléphone pour utiliser cette fonctionnalité.',
        );
        return;
      }
      if (mounted) setState(() => _streakRemindersOn = true);
    } else {
      await disableStreakReminders();
      if (mounted) setState(() => _streakRemindersOn = false);
    }
  }

  /// Nombre de cartes à réviser aujourd'hui (prévision du serveur).
  Future<int> _fetchDueToday() async {
    final data = decodeBody(await Api.get('/api/revision/forecast', query: {'days': 1}));
    final forecast = data is Map ? data['forecast'] : null;
    final first = forecast is List && forecast.isNotEmpty ? forecast.first : null;
    final count = first is Map ? first['count'] : null;
    return count is num ? count.toInt() : 0;
  }

  Future<void> _handleToggleRevisionReminders(bool value) async {
    if (value) {
      var dueToday = 0;
      if (_user != null) {
        try {
          dueToday = await _fetchDueToday();
        } catch (_) {
          // Pas grave si ça échoue : on active quand même, le rappel se
          // mettra à jour dès le prochain chargement du forecast.
        }
      }
      final granted = await enableRevisionReminders(dueToday);
      if (!granted) {
        appAlert(
          'Permission refusée',
          'Active les notifications pour MedFlow dans les réglages de ton téléphone pour utiliser cette fonctionnalité.',
        );
        return;
      }
      if (mounted) setState(() => _revisionRemindersOn = true);
    } else {
      await disableRevisionReminders();
      if (mounted) setState(() => _revisionRemindersOn = false);
    }
  }

  Future<void> _openTimePicker() async {
    final picked = await showTimePickerSheet(
      context,
      title: 'Heure du rappel de révision',
      hour: _reminderHour,
      minute: _reminderMinute,
    );
    if (picked != null) await _handleSelectReminderTime(picked.hour, picked.minute);
  }

  Future<void> _handleSelectReminderTime(int hour, int minute) async {
    await setRevisionReminderTime(hour, minute);
    if (!mounted) return;
    setState(() {
      _reminderHour = hour;
      _reminderMinute = minute;
    });
    // Si un rappel est déjà programmé, le remettre à jour tout de suite
    // avec la nouvelle heure plutôt que d'attendre le prochain chargement
    // du forecast (Dashboard/écran Révision).
    if (_revisionRemindersOn && _user != null) {
      try {
        await scheduleRevisionReminder(await _fetchDueToday());
      } catch (_) {
        // Pas grave si ça échoue : se remettra à jour au prochain chargement.
      }
    }
  }

  Future<void> _handleTestNotification() async {
    final sent = await sendTestNotification();
    if (sent) {
      appAlert("C'est parti", 'Tu devrais recevoir une notification dans 5 secondes.');
    } else {
      appAlert('Permission refusée', 'Active les notifications pour MedFlow dans les réglages de ton téléphone.');
    }
  }

  Future<void> _handleTestRevisionNotification() async {
    final sent = await sendTestRevisionNotification();
    if (sent) {
      appAlert("C'est parti", 'Tu devrais recevoir une notification de révision dans 5 secondes.');
    } else {
      appAlert('Permission refusée', 'Active les notifications pour MedFlow dans les réglages de ton téléphone.');
    }
  }

  // ---------------- PASSWORD RULES ----------------
  static final _rules = <bool Function(String)>[
    (v) => v.length >= 8, // 8 caractères minimum
    (v) => RegExp('[A-Z]').hasMatch(v), // 1 majuscule
    (v) => RegExp('[a-z]').hasMatch(v), // 1 minuscule
    (v) => RegExp(r'\d').hasMatch(v), // 1 chiffre
    (v) => _specialChar.hasMatch(v), // 1 caractère spécial
  ];

  bool get _isPasswordValid => _rules.every((r) => r(_newPassword.text));
  bool get _passwordsMatch =>
      _newPassword.text.isNotEmpty && _confirmPassword.text.isNotEmpty && _newPassword.text == _confirmPassword.text;

  // ---------------- IMAGE PICKER ----------------
  Future<void> _pickImage() async {
    final user = _user;
    if (user == null) return;

    final XFile? asset;
    try {
      asset = await ImagePicker().pickImage(source: ImageSource.gallery, imageQuality: 70);
    } catch (_) {
      return;
    }
    if (asset == null) return;

    // Aperçu instantané avec le fichier local, le temps que l'upload se termine.
    setState(() {
      _photo = asset!.path;
      _uploadingPhoto = true;
    });

    try {
      final dot = asset.path.lastIndexOf('.');
      final ext = dot >= 0 && dot < asset.path.length - 1 ? asset.path.substring(dot + 1).toLowerCase() : 'jpg';

      final response = await Api.multipart(
        '/api/account/avatar',
        files: [await http.MultipartFile.fromPath('file', asset.path, filename: 'avatar.$ext')],
        timeout: const Duration(seconds: 30),
      );

      final data = decodeBody(response);
      final ok = response.statusCode >= 200 && response.statusCode < 300;
      final avatarUrl = data is Map ? data['avatarUrl'] : null;
      if (!ok || avatarUrl is! String) {
        final serverError = data is Map && data['error'] is String ? data['error'] as String : '';
        throw UserFacingError(
            serverError.isNotEmpty ? serverError : 'Erreur serveur (${response.statusCode})', response.statusCode);
      }

      // Remplace l'aperçu local par la vraie URL du backend — c'est celle-là
      // qui sera persistée sur le profil Firebase (photoURL).
      if (mounted) setState(() => _photo = avatarUrl);
    } catch (e) {
      appAlert('Erreur', "Impossible d'uploader la photo : ${_messageOf(e)}");
    } finally {
      if (mounted) setState(() => _uploadingPhoto = false);
    }
  }

  // ---------------- UPDATE PROFILE ----------------
  Future<void> _handleSaveProfile() async {
    final user = _user;
    if (user == null) return;

    try {
      await user.updateProfile(displayName: _fullName.text, photoURL: _photo);
      if (mounted) setState(() {});
      appAlert('Succès', 'Profil mis à jour');
    } catch (e) {
      appAlert('Erreur', _messageOf(e));
    }
  }

  // ---------------- UPDATE PASSWORD ----------------
  Future<void> _handleUpdatePassword() async {
    final user = _user;
    if (user == null) return;

    if (!_isPasswordValid) {
      appAlert('Erreur', 'Mot de passe non valide');
      return;
    }

    if (!_passwordsMatch) {
      appAlert('Erreur', 'Les mots de passe ne correspondent pas');
      return;
    }

    try {
      await user.updatePassword(_newPassword.text);

      _newPassword.clear();
      _confirmPassword.clear();

      appAlert('Succès', 'Mot de passe mis à jour');
    } catch (e) {
      appAlert(
        'Erreur',
        e is FirebaseAuthException && e.code == 'requires-recent-login'
            ? 'Par sécurité, déconnecte-toi puis reconnecte-toi avant de changer ton mot de passe.'
            : "Le mot de passe n'a pas pu être changé. Réessaie.",
      );
    }
  }

  Future<void> _handleReplayTutorial() async {
    await resetTutorial();
    Nav.navigate('Home');
    showTutorial();
  }

  void _handleResetProgress() {
    appAlert(
      'Réinitialiser la progression',
      'XP, streak, leçons, badges et activité seront remis à zéro. Cette action est irréversible.',
      [
        const AlertButton('Annuler', style: AlertStyle.cancel),
        AlertButton(
          'Réinitialiser',
          style: AlertStyle.destructive,
          onPress: () async {
            if (_user == null) return;
            try {
              final res = await Api.post('/api/account/reset-progress');
              if (res.statusCode < 200 || res.statusCode >= 300) throw UserFacingError('HTTP ${res.statusCode}');
              appAlert("C'est fait", 'Ta progression a été réinitialisée.');
            } catch (e) {
              appAlert('Erreur', 'Impossible de réinitialiser : ${_messageOf(e)}');
            }
          },
        ),
      ],
    );
  }

  Future<void> _handleLogout() async {
    try {
      // Ce téléphone ne doit plus recevoir les notifications de ce compte.
      final user = _user;
      if (user != null) await unregisterPushNotifications(user);
      await FirebaseAuth.instance.signOut();
    } catch (e) {
      appAlert('Erreur', _messageOf(e));
    }
  }

  // ---------------- UI ----------------

  Widget _row({
    required IconData icon,
    required Color tint,
    required Color iconColor,
    required String title,
    String? subtitle,
    VoidCallback? onPress,
    Widget? right,
    bool danger = false,
    bool first = false,
  }) {
    final c = context.colors;
    final trailing =
        right ?? (onPress != null ? Icon(Ionicons.chevronForward, size: 18, color: c.textSecondary) : null);
    final content = Container(
      constraints: const BoxConstraints(minHeight: 64),
      padding: const EdgeInsets.symmetric(vertical: 12),
      decoration: first ? null : BoxDecoration(border: Border(top: BorderSide(color: c.border))),
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(color: tint, borderRadius: BorderRadius.circular(12)),
            child: Icon(icon, size: 20, color: iconColor),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title,
                    style: TextStyle(
                        fontSize: 15, fontWeight: FontWeight.w600, color: danger ? c.dangerText : c.textPrimary)),
                if (subtitle != null && subtitle.isNotEmpty) ...[
                  const SizedBox(height: 2),
                  Text(subtitle, style: TextStyle(fontSize: 13, height: 18 / 13, color: c.textSecondary)),
                ],
              ],
            ),
          ),
          if (trailing != null) ...[const SizedBox(width: 12), trailing],
        ],
      ),
    );
    return onPress != null ? Tappable(onTap: onPress, child: content) : content;
  }

  Widget _listCard(List<Widget> rows) {
    final c = context.colors;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      decoration: BoxDecoration(
        color: c.surface,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: c.border),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: rows),
    );
  }

  Widget _card(List<Widget> children) {
    final c = context.colors;
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: c.surface,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: c.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          for (var i = 0; i < children.length; i++) ...[
            if (i > 0) const SizedBox(height: 14),
            children[i],
          ],
        ],
      ),
    );
  }

  /// Titre de section : petites capitales, 12 de marge en plus au-dessus.
  Widget _sectionLabel(String text) {
    final c = context.colors;
    return Padding(
      padding: const EdgeInsets.only(top: 12, left: 4),
      child: Text(text.toUpperCase(),
          style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: c.textSecondary, letterSpacing: 0.4)),
    );
  }

  Widget _switch({required bool value, required ValueChanged<bool> onChanged, required String label}) {
    final c = context.colors;
    return Semantics(
      label: label,
      child: CupertinoSwitch(
        value: value,
        onChanged: onChanged,
        activeTrackColor: c.action,
        inactiveTrackColor: c.border,
        thumbColor: Colors.white,
      ),
    );
  }

  Widget _input({
    required TextEditingController controller,
    required String label,
    String? hint,
    bool obscure = false,
  }) {
    final c = context.colors;
    final border = OutlineInputBorder(
      borderRadius: BorderRadius.circular(14),
      borderSide: BorderSide(color: c.border),
    );
    return Semantics(
      label: label,
      child: TextField(
        controller: controller,
        obscureText: obscure,
        style: TextStyle(fontSize: 16, color: c.textPrimary),
        cursorColor: c.primaryDark,
        decoration: InputDecoration(
          hintText: hint,
          hintStyle: TextStyle(color: c.textSecondary),
          filled: true,
          fillColor: c.background,
          isDense: true,
          constraints: const BoxConstraints(minHeight: 50),
          contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
          border: border,
          enabledBorder: border,
          focusedBorder: border,
        ),
      ),
    );
  }

  Widget _primaryButton({required String label, required VoidCallback? onPressed}) {
    final c = context.colors;
    return Opacity(
      opacity: onPressed == null ? 0.5 : 1,
      child: Tappable(
        onTap: onPressed,
        child: Container(
          height: 52,
          alignment: Alignment.center,
          decoration: BoxDecoration(color: c.action, borderRadius: BorderRadius.circular(14)),
          child: Text(label, style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: c.onAction)),
        ),
      ),
    );
  }

  Widget _avatar() {
    final c = context.colors;
    final user = _user;
    final photo = _photo;
    final placeholder = Container(
      width: 72,
      height: 72,
      alignment: Alignment.center,
      decoration: BoxDecoration(color: c.warning, shape: BoxShape.circle),
      child: Text(
        user?.displayName != null && user!.displayName!.isNotEmpty
            ? user.displayName!.substring(0, 1).toUpperCase()
            : 'U',
        style: TextStyle(fontSize: 28, fontWeight: FontWeight.w700, color: c.onAction),
      ),
    );
    if (photo == null || photo.isEmpty) return placeholder;
    final isRemote = photo.startsWith('http://') || photo.startsWith('https://');
    return Semantics(
      image: true,
      label: 'Photo de profil actuelle',
      child: ClipOval(
        child: isRemote
            ? Image.network(photo,
                width: 72,
                height: 72,
                fit: BoxFit.cover,
                excludeFromSemantics: true,
                errorBuilder: (_, __, ___) => placeholder)
            : Image.file(File(photo),
                width: 72,
                height: 72,
                fit: BoxFit.cover,
                excludeFromSemantics: true,
                errorBuilder: (_, __, ___) => placeholder),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final theme = context.watchTheme;
    final insets = ScreenInsets.of(context);
    final user = _user;

    final newPassword = _newPassword.text;
    final passwordRules = [
      (label: '8 caractères', ok: newPassword.length >= 8),
      (label: '1 majuscule', ok: RegExp('[A-Z]').hasMatch(newPassword)),
      (label: '1 minuscule', ok: RegExp('[a-z]').hasMatch(newPassword)),
      (label: '1 chiffre', ok: RegExp(r'\d').hasMatch(newPassword)),
      (label: '1 caractère spécial', ok: _specialChar.hasMatch(newPassword)),
    ];
    final canUpdatePassword = _isPasswordValid && _passwordsMatch;

    final appearanceOptions = [
      (key: ThemePreference.system, label: 'Système', icon: Ionicons.phonePortraitOutline),
      (key: ThemePreference.light, label: 'Clair', icon: Ionicons.sunnyOutline),
      (key: ThemePreference.dark, label: 'Sombre', icon: Ionicons.moonOutline),
    ];

    final children = <Widget>[
      // HEADER
      Padding(
        padding: const EdgeInsets.only(bottom: 8),
        child: Row(
          children: [
            CircleIconButton.back(Nav.goBack),
            const SizedBox(width: 12),
            Expanded(
              child: Semantics(
                header: true,
                child:
                    Text('Réglages', style: TextStyle(fontSize: 22, fontWeight: FontWeight.w700, color: c.textPrimary)),
              ),
            ),
          ],
        ),
      ),

      // PROFIL
      _card([
        Row(
          children: [
            SizedBox(
              width: 72,
              height: 72,
              child: Stack(
                clipBehavior: Clip.none,
                children: [
                  _avatar(),
                  Positioned(
                    right: -4,
                    bottom: -4,
                    child: Tappable(
                      onTap: _uploadingPhoto ? null : _pickImage,
                      semanticLabel: 'Changer la photo de profil',
                      child: Container(
                        width: 30,
                        height: 30,
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                          color: c.action,
                          shape: BoxShape.circle,
                          border: Border.all(color: c.surface, width: 3),
                        ),
                        child: _uploadingPhoto
                            ? SizedBox(
                                width: 14,
                                height: 14,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  color: c.onAction,
                                  semanticsLabel: 'Envoi de la photo en cours',
                                ),
                              )
                            : Icon(Ionicons.camera, size: 16, color: c.onAction),
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    user?.displayName != null && user!.displayName!.isNotEmpty ? user.displayName! : 'Utilisateur',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: c.textPrimary),
                  ),
                  const SizedBox(height: 2),
                  Text(user?.email ?? '',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(fontSize: 14, color: c.textSecondary)),
                ],
              ),
            ),
          ],
        ),
        Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('Nom', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: c.textSecondary)),
            const SizedBox(height: 6),
            _input(controller: _fullName, label: 'Nom'),
          ],
        ),
        Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('Email', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: c.textSecondary)),
            const SizedBox(height: 6),
            Container(
              constraints: const BoxConstraints(minHeight: 50),
              padding: const EdgeInsets.symmetric(horizontal: 14),
              decoration: BoxDecoration(
                color: c.surfaceAlt,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: c.border),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Semantics(
                      label: 'Email (non modifiable)',
                      child: ExcludeSemantics(
                        child: Text(user?.email ?? '',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(fontSize: 16, color: c.textSecondary)),
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Icon(Ionicons.lockClosedOutline, size: 16, color: c.textSecondary),
                ],
              ),
            ),
          ],
        ),
        _primaryButton(label: 'Sauvegarder', onPressed: _handleSaveProfile),
      ]),

      // APPARENCE
      _sectionLabel('Apparence'),
      Container(
        padding: const EdgeInsets.all(4),
        decoration: BoxDecoration(color: c.surfaceAlt, borderRadius: BorderRadius.circular(14)),
        child: Row(
          children: [
            for (var i = 0; i < appearanceOptions.length; i++) ...[
              if (i > 0) const SizedBox(width: 4),
              Expanded(
                child: Builder(builder: (_) {
                  final option = appearanceOptions[i];
                  final active = theme.preference == option.key;
                  return Semantics(
                    container: true,
                    inMutuallyExclusiveGroup: true,
                    checked: active,
                    label: option.label,
                    child: Tappable(
                      button: false,
                      onTap: () => context.read<ThemeController>().setPreference(option.key),
                      child: Container(
                        constraints: const BoxConstraints(minHeight: 44),
                        decoration: BoxDecoration(
                          color: active ? c.surface : null,
                          borderRadius: BorderRadius.circular(11),
                          boxShadow: active
                              ? [
                                  BoxShadow(
                                    color: Colors.black.withValues(alpha: 0.08),
                                    offset: const Offset(0, 2),
                                    blurRadius: 6,
                                  ),
                                ]
                              : null,
                        ),
                        child: ExcludeSemantics(
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(option.icon, size: 16, color: active ? c.primaryText : c.textSecondary),
                              const SizedBox(width: 6),
                              Flexible(
                                child: Text(
                                  option.label,
                                  style: TextStyle(
                                    fontSize: 14,
                                    fontWeight: active ? FontWeight.w600 : FontWeight.w500,
                                    color: active ? c.primaryText : c.textSecondary,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  );
                }),
              ),
            ],
          ],
        ),
      ),

      Padding(
        padding: const EdgeInsets.only(top: 12),
        child: _listCard([
          _row(
            first: true,
            icon: Ionicons.contrastOutline,
            tint: c.surfaceAlt,
            iconColor: c.textPrimary,
            title: 'Contraste élevé',
            subtitle: 'Textes et bordures plus marqués',
            right: _switch(
              value: theme.highContrast,
              onChanged: (on) => context.read<ThemeController>().setHighContrast(on),
              label: 'Contraste élevé',
            ),
          ),
        ]),
      ),

      // NOTIFICATIONS
      _sectionLabel('Notifications'),
      _listCard([
        _row(
          first: true,
          icon: Ionicons.flameOutline,
          tint: c.tintWarning,
          iconColor: c.warning,
          title: 'Rappels de streak',
          subtitle: "Un rappel le soir si tu n'as pas encore révisé",
          right: _switch(
            value: _streakRemindersOn,
            onChanged: _handleToggleStreakReminders,
            label: 'Rappels de série',
          ),
        ),
        _row(
          icon: Ionicons.schoolOutline,
          tint: c.tintPrimary,
          iconColor: c.primaryDark,
          title: 'Rappels de révision',
          subtitle:
              'Un rappel à ${formatReminderTime(_reminderHour, _reminderMinute)} avec le nombre de cartes à réviser',
          right: _switch(
            value: _revisionRemindersOn,
            onChanged: _handleToggleRevisionReminders,
            label: 'Rappels de révision',
          ),
        ),
        if (_revisionRemindersOn)
          _row(
            icon: Ionicons.timeOutline,
            tint: c.surfaceAlt,
            iconColor: c.textSecondary,
            title: 'Heure du rappel',
            onPress: _openTimePicker,
            right: Semantics(
              label: "Modifier l'heure du rappel",
              child: ExcludeSemantics(
                child: Container(
                  padding: const EdgeInsets.only(left: 12, right: 8, top: 8, bottom: 8),
                  decoration: BoxDecoration(color: c.tintPrimary, borderRadius: BorderRadius.circular(999)),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        '${pad2(_reminderHour)}:${pad2(_reminderMinute)}',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w700,
                          color: c.primaryText,
                          fontFeatures: const [FontFeature.tabularFigures()],
                        ),
                      ),
                      const SizedBox(width: 4),
                      Icon(Ionicons.chevronForward, size: 16, color: c.primaryText),
                    ],
                  ),
                ),
              ),
            ),
          ),
      ]),

      // SÉCURITÉ
      if (_hasPassword) ...[
        _sectionLabel('Sécurité'),
        _card([
          Text('Changer de mot de passe',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: c.textPrimary)),
          _input(
            controller: _newPassword,
            label: 'Nouveau mot de passe',
            hint: 'Nouveau mot de passe',
            obscure: true,
          ),
          _input(
            controller: _confirmPassword,
            label: 'Confirmer le nouveau mot de passe',
            hint: 'Confirmer le mot de passe',
            obscure: true,
          ),
          Wrap(
            spacing: 6,
            runSpacing: 6,
            children: [
              for (final r in passwordRules)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                  decoration: BoxDecoration(
                    color: r.ok ? c.tintSuccess : c.surfaceAlt,
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        r.ok ? Ionicons.checkmarkCircle : Ionicons.ellipseOutline,
                        size: 14,
                        color: r.ok ? c.successText : c.textSecondary,
                      ),
                      const SizedBox(width: 4),
                      Text(r.label,
                          style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                              color: r.ok ? c.successText : c.textSecondary)),
                    ],
                  ),
                ),
            ],
          ),
          _primaryButton(
            label: 'Mettre à jour le mot de passe',
            onPressed: canUpdatePassword ? _handleUpdatePassword : null,
          ),
        ]),
      ],

      // AIDE
      _sectionLabel('Aide'),
      _listCard([
        _row(
          first: true,
          icon: Ionicons.playCircleOutline,
          tint: c.tintPrimary,
          iconColor: c.primaryDark,
          title: 'Revoir le tutoriel',
          onPress: _handleReplayTutorial,
        ),
      ]),

      // MES DONNÉES (RGPD)
      _sectionLabel('Mes données'),
      _listCard([
        Builder(
          builder: (rowContext) => _row(
            first: true,
            icon: Ionicons.downloadOutline,
            tint: c.tintPrimary,
            iconColor: c.primaryDark,
            title: 'Exporter mes données',
            subtitle: 'Fichier JSON : profil, cours, progression, conversations',
            onPress: () => _handleExportData(rowContext),
            right: _exporting
                ? SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: c.primaryDark,
                      semanticsLabel: 'Export en cours',
                    ),
                  )
                : null,
          ),
        ),
      ]),

      // AVANCÉ
      _sectionLabel('Avancé'),
      _listCard([
        _row(
          first: true,
          icon: Ionicons.notificationsOutline,
          tint: c.tintPrimary,
          iconColor: c.primaryDark,
          title: 'Tester une notification (5s)',
          onPress: _handleTestNotification,
        ),
        _row(
          icon: Ionicons.schoolOutline,
          tint: c.tintWarning,
          iconColor: c.warning,
          title: 'Tester une notification de révision (5s)',
          onPress: _handleTestRevisionNotification,
        ),
        _row(
          icon: Ionicons.refreshCircleOutline,
          tint: c.tintDanger,
          iconColor: c.danger,
          title: 'Réinitialiser XP / progression',
          subtitle: 'XP, série, leçons et badges remis à zéro',
          onPress: _handleResetProgress,
          danger: true,
        ),
      ]),

      // DÉCONNEXION
      Padding(
        padding: const EdgeInsets.only(top: 16),
        child: Tappable(
          onTap: _handleLogout,
          child: Container(
            height: 52,
            decoration: BoxDecoration(color: c.tintDanger, borderRadius: BorderRadius.circular(14)),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Ionicons.logOutOutline, size: 20, color: c.dangerText),
                const SizedBox(width: 10),
                Text('Se déconnecter',
                    style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: c.dangerText)),
              ],
            ),
          ),
        ),
      ),

      Center(
        child: Tappable(
          onTap: () => showDeleteAccountSheet(context),
          child: Container(
            constraints: const BoxConstraints(minHeight: 44),
            padding: const EdgeInsets.symmetric(horizontal: 16),
            alignment: Alignment.center,
            child: Text(
              'Supprimer mon compte',
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w600,
                color: c.textSecondary,
                decoration: TextDecoration.underline,
                decorationColor: c.textSecondary,
              ),
            ),
          ),
        ),
      ),
    ];

    return Scaffold(
      backgroundColor: c.background,
      body: ScrollConfiguration(
        behavior: ScrollConfiguration.of(context).copyWith(scrollbars: false),
        child: SingleChildScrollView(
          padding: EdgeInsets.fromLTRB(20, insets.top, 20, insets.bottom + 32),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              for (var i = 0; i < children.length; i++) ...[
                if (i > 0) const SizedBox(height: 12),
                children[i],
              ],
            ],
          ),
        ),
      ),
    );
  }
}
