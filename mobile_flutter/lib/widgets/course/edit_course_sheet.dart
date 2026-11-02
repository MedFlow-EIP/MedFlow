import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:ionicons/ionicons.dart';

import '../../services/api.dart';
import '../../theme/theme_controller.dart';
import '../../utils/app_alert.dart';
import '../../utils/specialties.dart';
import '../insets.dart';
import '../ui.dart';
import 'layout.dart';

// Copie de components/course/EditCourseSheet.tsx.

// Mêmes limites que le backend (routes/courses.py).
const _maxTitleChars = 120;
const _maxCardChars = 1000;
const _maxFlashcards = 200;

/// Renommer un cours et corriger ses flashcards (l'IA se trompe parfois).
/// Le quiz n'est pas modifiable : le planning de révision dépend de ses questions.
///
/// Plein écran glissant du bas (Modal `animationType="slide"`). [onSaved] reçoit
/// le cours renvoyé par le serveur après enregistrement ; la feuille se ferme ensuite.
Future<void> showEditCourseSheet(
  BuildContext context, {
  required String courseId,
  required String title,
  required List flashcards,
  required List<String> tags,
  required ValueChanged<dynamic> onSaved,
}) {
  return Navigator.of(context).push<void>(MaterialPageRoute(
    fullscreenDialog: true,
    builder: (_) => EditCourseSheet(
      courseId: courseId,
      title: title,
      flashcards: flashcards,
      tags: tags,
      onSaved: onSaved,
    ),
  ));
}

class EditCourseSheet extends StatefulWidget {
  final String courseId;
  final String title;
  final List flashcards;
  final List<String> tags;
  final ValueChanged<dynamic> onSaved;
  const EditCourseSheet({
    super.key,
    required this.courseId,
    required this.title,
    required this.flashcards,
    required this.tags,
    required this.onSaved,
  });

  @override
  State<EditCourseSheet> createState() => _EditCourseSheetState();
}

class _CardControllers {
  final TextEditingController question;
  final TextEditingController answer;
  _CardControllers(String q, String a)
      : question = TextEditingController(text: q),
        answer = TextEditingController(text: a);

  void dispose() {
    question.dispose();
    answer.dispose();
  }
}

class _EditCourseSheetState extends State<EditCourseSheet> {
  // Repart du cours actuel à chaque ouverture.
  late final TextEditingController _name = TextEditingController(text: widget.title);
  late final List<_CardControllers> _cards = [
    for (final c in widget.flashcards) _CardControllers('${c['question'] ?? ''}', '${c['answer'] ?? ''}'),
  ];
  late List<String> _tags = [...widget.tags];
  final _customTag = TextEditingController();
  bool _saving = false;
  String? _error;

  @override
  void dispose() {
    _name.dispose();
    _customTag.dispose();
    for (final c in _cards) {
      c.dispose();
    }
    super.dispose();
  }

  bool get _dirty {
    if (_name.text.trim() != widget.title) return true;
    if (_tags.join('|') != widget.tags.join('|')) return true;
    if (_cards.length != widget.flashcards.length) return true;
    for (var i = 0; i < _cards.length; i++) {
      final original = widget.flashcards[i];
      if (_cards[i].question.text != '${original['question'] ?? ''}' ||
          _cards[i].answer.text != '${original['answer'] ?? ''}') {
        return true;
      }
    }
    return false;
  }

  void _toggleTag(String tag) => setState(() {
        _tags = _tags.contains(tag)
            ? _tags.where((t) => t != tag).toList()
            : _tags.length >= maxTags
                ? _tags
                : [..._tags, tag];
      });

  void _addCustomTag() {
    final tag = _customTag.text.trim().replaceAll(RegExp(r'\s+'), ' ');
    if (tag.isEmpty) return;
    setState(() {
      if (!_tags.any((t) => t.toLowerCase() == tag.toLowerCase()) && _tags.length < maxTags) {
        _tags = [..._tags, tag];
      }
      _customTag.clear();
    });
  }

  void _removeCard(int index) => setState(() => _cards.removeAt(index).dispose());

  void _addCard() {
    if (_cards.length >= _maxFlashcards) return;
    setState(() => _cards.add(_CardControllers('', '')));
  }

  void _dismiss() {
    if (mounted) Navigator.of(context).pop();
  }

  void _close() {
    if (_saving) return;
    if (!_dirty) {
      _dismiss();
      return;
    }
    appAlert('Abandonner les modifications ?', 'Tes changements ne seront pas enregistrés.', [
      const AlertButton('Continuer à modifier', style: AlertStyle.cancel),
      AlertButton('Abandonner', style: AlertStyle.destructive, onPress: _dismiss),
    ]);
  }

  Future<void> _save() async {
    final trimmedName = _name.text.trim();
    final cleaned = [
      for (final c in _cards) {'question': c.question.text.trim(), 'answer': c.answer.text.trim()},
    ];
    if (trimmedName.isEmpty) {
      setState(() => _error = 'Le titre ne peut pas être vide.');
      return;
    }
    final incomplete = cleaned.indexWhere((c) => c['question']!.isEmpty || c['answer']!.isEmpty);
    if (incomplete >= 0) {
      setState(() => _error = 'La carte ${incomplete + 1} doit avoir une question et une réponse.');
      return;
    }

    if (Api.currentUser == null) return;
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      final updated = await Api.patchJson(
        '/api/course/${Uri.encodeComponent(widget.courseId)}',
        {'nom': trimmedName, 'flashcards': cleaned, 'tags': _tags},
        fallback: 'Enregistrement impossible. Réessaie.',
      );
      widget.onSaved(updated);
      _dismiss();
    } catch (err) {
      if (mounted) setState(() => _error = errorMessage(err, 'Enregistrement impossible. Réessaie.'));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final insets = ScreenInsets.of(context);
    final dirty = _dirty;
    final canSave = dirty && !_saving;
    final full = _tags.length >= maxTags;

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) _close();
      },
      child: Scaffold(
        backgroundColor: c.background,
        body: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Container(
              padding: EdgeInsets.fromLTRB(20, insets.top, 20, 12),
              decoration: BoxDecoration(
                color: c.surface,
                border: Border(bottom: BorderSide(color: c.border)),
              ),
              child: Row(
                children: [
                  _IconButton(icon: Ionicons.close, size: 44, iconSize: 22, label: 'Fermer', onTap: _close),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Semantics(
                      header: true,
                      child: Text('Modifier le cours',
                          style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: c.textPrimary)),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Opacity(
                    opacity: canSave ? 1 : 0.5,
                    child: Tappable(
                      onTap: canSave ? _save : null,
                      semanticLabel: _saving ? 'Enregistrement' : 'Enregistrer',
                      child: Container(
                        constraints: const BoxConstraints(minWidth: 112),
                        height: 44,
                        padding: const EdgeInsets.symmetric(horizontal: 16),
                        alignment: Alignment.center,
                        decoration: BoxDecoration(color: c.action, borderRadius: BorderRadius.circular(12)),
                        child: _saving
                            ? SizedBox(
                                width: 20,
                                height: 20,
                                child: CircularProgressIndicator(strokeWidth: 2.5, color: c.onAction),
                              )
                            : ExcludeSemantics(
                                child: Text('Enregistrer',
                                    style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: c.onAction)),
                              ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
            Expanded(
              child: SingleChildScrollView(
                padding: EdgeInsets.fromLTRB(20, 20, 20, insets.bottom + 32),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: gapped([
                    if (_error != null)
                      Semantics(
                        liveRegion: true,
                        child: Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(color: c.tintDanger, borderRadius: BorderRadius.circular(12)),
                          child: Row(
                            children: [
                              Icon(Ionicons.alertCircle, size: 18, color: c.dangerText),
                              const SizedBox(width: 8),
                              Expanded(
                                child: Text(_error!,
                                    style: TextStyle(fontSize: 14, fontWeight: FontWeight.w500, color: c.dangerText)),
                              ),
                            ],
                          ),
                        ),
                      ),
                    const _Label('Titre du cours'),
                    _Input(
                      controller: _name,
                      maxLength: _maxTitleChars,
                      placeholder: 'Titre du cours',
                      label: 'Titre du cours',
                      onChanged: (_) => setState(() {}),
                    ),
                    Padding(
                      padding: const EdgeInsets.only(top: 12),
                      child: _Label('Spécialités (${_tags.length}/$maxTags)'),
                    ),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: [
                        for (final tag in [..._tags.where((t) => !specialties.contains(t)), ...specialties])
                          _TagChip(
                            tag: tag,
                            active: _tags.contains(tag),
                            disabled: !_tags.contains(tag) && full,
                            onTap: () => _toggleTag(tag),
                          ),
                      ],
                    ),
                    if (!full)
                      Row(
                        children: [
                          Expanded(
                            child: _Input(
                              controller: _customTag,
                              maxLength: maxTagChars,
                              placeholder: 'Autre tag (ex. Partiel S1)',
                              label: 'Ajouter un tag personnalisé',
                              onChanged: (_) => setState(() {}),
                              onSubmitted: (_) => _addCustomTag(),
                            ),
                          ),
                          const SizedBox(width: 8),
                          Opacity(
                            opacity: _customTag.text.trim().isEmpty ? 0.5 : 1,
                            child: Tappable(
                              onTap: _customTag.text.trim().isEmpty ? null : _addCustomTag,
                              semanticLabel: 'Ajouter ce tag',
                              child: Container(
                                width: 50,
                                height: 50,
                                decoration: BoxDecoration(color: c.action, borderRadius: BorderRadius.circular(12)),
                                child: Icon(Ionicons.add, size: 22, color: c.onAction),
                              ),
                            ),
                          ),
                        ],
                      ),
                    Padding(
                      padding: const EdgeInsets.only(top: 12),
                      child: _Label('Flashcards (${_cards.length})'),
                    ),
                    for (var index = 0; index < _cards.length; index++)
                      Container(
                        key: ObjectKey(_cards[index]),
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: c.surfaceAlt,
                          border: Border.all(color: c.border),
                          borderRadius: BorderRadius.circular(16),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: gapped([
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Text('CARTE ${index + 1}',
                                    style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: c.primaryText)),
                                _IconButton(
                                  icon: Ionicons.trashOutline,
                                  size: 40,
                                  iconSize: 18,
                                  color: c.dangerText,
                                  label: 'Supprimer la carte ${index + 1}',
                                  onTap: () => _removeCard(index),
                                ),
                              ],
                            ),
                            _Input(
                              controller: _cards[index].question,
                              maxLength: _maxCardChars,
                              multiline: true,
                              placeholder: 'Question',
                              label: 'Question de la carte ${index + 1}',
                              onChanged: (_) => setState(() {}),
                            ),
                            _Input(
                              controller: _cards[index].answer,
                              maxLength: _maxCardChars,
                              multiline: true,
                              placeholder: 'Réponse',
                              label: 'Réponse de la carte ${index + 1}',
                              onChanged: (_) => setState(() {}),
                            ),
                          ], 10),
                        ),
                      ),
                    if (_cards.length < _maxFlashcards)
                      Tappable(
                        onTap: _addCard,
                        child: DashedBorderBox(
                          color: c.primary,
                          background: c.tintPrimary,
                          radius: 14,
                          constraints: const BoxConstraints(minHeight: 52),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(Ionicons.add, size: 20, color: c.primaryText),
                              const SizedBox(width: 8),
                              Text('Ajouter une carte',
                                  style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: c.primaryText)),
                            ],
                          ),
                        ),
                      ),
                  ], 12),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Label extends StatelessWidget {
  final String text;
  const _Label(this.text);

  @override
  Widget build(BuildContext context) =>
      Text(text, style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: context.colors.textPrimary));
}

class _Input extends StatelessWidget {
  final TextEditingController controller;
  final int maxLength;
  final String placeholder;
  final String label;
  final bool multiline;
  final ValueChanged<String>? onChanged;
  final ValueChanged<String>? onSubmitted;
  const _Input({
    required this.controller,
    required this.maxLength,
    required this.placeholder,
    required this.label,
    this.multiline = false,
    this.onChanged,
    this.onSubmitted,
  });

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final border = OutlineInputBorder(
      borderRadius: BorderRadius.circular(12),
      borderSide: BorderSide(color: c.border, width: 1.5),
    );
    // Une seule zone pour le lecteur d'écran : libellé + champ (accessibilityLabel).
    return MergeSemantics(
      child: Semantics(
        label: label,
        child: TextField(
          controller: controller,
          onChanged: onChanged,
          onSubmitted: onSubmitted,
          inputFormatters: [LengthLimitingTextInputFormatter(maxLength)],
          minLines: 1,
          maxLines: multiline ? null : 1,
          keyboardType: multiline ? TextInputType.multiline : TextInputType.text,
          textAlignVertical: multiline ? TextAlignVertical.top : TextAlignVertical.center,
          style: TextStyle(fontSize: 15, color: c.textPrimary),
          decoration: InputDecoration(
            isDense: true,
            filled: true,
            fillColor: c.surface,
            constraints: const BoxConstraints(minHeight: 50),
            hintText: placeholder,
            hintStyle: TextStyle(fontSize: 15, color: c.textSecondary),
            contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            border: border,
            enabledBorder: border,
            focusedBorder: border,
          ),
        ),
      ),
    );
  }
}

class _IconButton extends StatelessWidget {
  final IconData icon;
  final double size;
  final double iconSize;
  final Color? color;
  final String label;
  final VoidCallback onTap;
  const _IconButton({
    required this.icon,
    required this.size,
    required this.iconSize,
    this.color,
    required this.label,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Tappable(
      onTap: onTap,
      semanticLabel: label,
      child: SizedBox(
        width: size,
        height: size,
        child: Icon(icon, size: iconSize, color: color ?? context.colors.textPrimary),
      ),
    );
  }
}

class _TagChip extends StatelessWidget {
  final String tag;
  final bool active;
  final bool disabled;
  final VoidCallback onTap;
  const _TagChip({required this.tag, required this.active, required this.disabled, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Semantics(
      checked: active,
      child: Opacity(
        opacity: disabled ? 0.5 : 1,
        child: Tappable(
          onTap: disabled ? null : onTap,
          button: false,
          child: Container(
            constraints: const BoxConstraints(minHeight: 38),
            padding: const EdgeInsets.symmetric(horizontal: 12),
            decoration: BoxDecoration(
              color: active ? c.tintPrimary : c.surface,
              border: Border.all(color: active ? c.primaryDark : c.border),
              borderRadius: BorderRadius.circular(999),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (active) ...[
                  Icon(Ionicons.checkmark, size: 14, color: c.primaryText),
                  const SizedBox(width: 4),
                ],
                Text(
                  tag,
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: active ? FontWeight.w600 : FontWeight.w400,
                    color: active ? c.primaryText : c.textSecondary,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
