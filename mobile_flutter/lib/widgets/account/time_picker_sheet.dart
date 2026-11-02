import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:ionicons/ionicons.dart';

import '../../theme/theme_controller.dart';
import '../sheet.dart';
import '../ui.dart';

// Copie de components/ui/TimePickerSheet.tsx.

String pad2(int n) => '$n'.padLeft(2, '0');

/// « 9h », « 21h30 » : format court utilisé dans les textes.
String formatReminderTime(int hour, int minute) => minute == 0 ? '${hour}h' : '${hour}h${pad2(minute)}';

final _hours = List<int>.generate(24, (i) => i);
final _minutes = List<int>.generate(12, (i) => i * 5);
const double _itemHeight = 48;
const double _listHeight = _itemHeight * 4;

class _Preset {
  final String label;
  final IconData icon;
  final int hour;
  final int minute;
  const _Preset(this.label, this.icon, this.hour, this.minute);
}

const _presets = [
  _Preset('Matin', Ionicons.sunnyOutline, 8, 0),
  _Preset('Midi', Ionicons.restaurantOutline, 12, 30),
  _Preset('Soir', Ionicons.partlySunnyOutline, 19, 0),
  _Preset('Nuit', Ionicons.moonOutline, 21, 30),
];

/// Feuille du bas pour choisir une heure : raccourcis + deux colonnes
/// (heures, minutes par pas de 5) où l'on touche directement la valeur.
/// Renvoie l'heure choisie (« Valider »), ou null si on annule.
Future<({int hour, int minute})?> showTimePickerSheet(
  BuildContext context, {
  required String title,
  required int hour,
  required int minute,
}) {
  return showAppSheet<({int hour, int minute})>(
    context,
    showClose: false,
    builder: (_) => _TimePicker(title: title, hour: hour, minute: minute),
  );
}

class _TimePicker extends StatefulWidget {
  final String title;
  final int hour;
  final int minute;
  const _TimePicker({required this.title, required this.hour, required this.minute});

  @override
  State<_TimePicker> createState() => _TimePickerState();
}

class _TimePickerState extends State<_TimePicker> {
  late int _h;
  late int _m;
  late final ScrollController _hoursRef;
  late final ScrollController _minutesRef;

  static double _offsetFor(int index, int count) =>
      math.min(math.max(0, (index - 1) * _itemHeight), count * _itemHeight - _listHeight).toDouble();

  @override
  void initState() {
    super.initState();
    // À chaque ouverture : repart de la valeur actuelle et la centre dans les colonnes.
    final startMinute = widget.minute - (widget.minute % 5);
    _h = widget.hour;
    _m = startMinute;
    _hoursRef = ScrollController(initialScrollOffset: _offsetFor(_h, _hours.length));
    _minutesRef = ScrollController(initialScrollOffset: _offsetFor(startMinute ~/ 5, _minutes.length));
  }

  @override
  void dispose() {
    _hoursRef.dispose();
    _minutesRef.dispose();
    super.dispose();
  }

  void _pick(int nextH, int nextM) {
    setState(() {
      _h = nextH;
      _m = nextM;
    });
    const duration = Duration(milliseconds: 250);
    if (_hoursRef.hasClients) {
      _hoursRef.animateTo(_offsetFor(nextH, _hours.length), duration: duration, curve: Curves.easeOut);
    }
    if (_minutesRef.hasClients) {
      _minutesRef.animateTo(_offsetFor(nextM ~/ 5, _minutes.length), duration: duration, curve: Curves.easeOut);
    }
  }

  Widget _column(ScrollController ref, List<int> values, int selected, ValueChanged<int> onSelect, String unit) {
    final c = context.colors;
    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(color: c.surfaceAlt, borderRadius: BorderRadius.circular(16)),
      child: SizedBox(
        height: _listHeight,
        child: ListView(
          controller: ref,
          padding: EdgeInsets.zero,
          children: [
            for (final v in values)
              Tappable(
                onTap: () => onSelect(v),
                selected: v == selected,
                semanticLabel: '$v $unit',
                child: Container(
                  height: _itemHeight,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: v == selected ? c.action : null,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: ExcludeSemantics(
                    child: Text(
                      pad2(v),
                      style: TextStyle(
                        fontSize: 20,
                        fontWeight: FontWeight.w600,
                        color: v == selected ? c.onAction : c.textPrimary,
                        fontFeatures: const [FontFeature.tabularFigures()],
                      ),
                    ),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _columnLabel(String text) {
    final c = context.colors;
    return Text(text.toUpperCase(),
        textAlign: TextAlign.center,
        style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: c.textSecondary));
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Semantics(
          header: true,
          child: Text(widget.title,
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700, color: c.textPrimary)),
        ),
        const SizedBox(height: 8),
        Semantics(
          liveRegion: true,
          child: Text(
            '${pad2(_h)}:${pad2(_m)}',
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 44,
              fontWeight: FontWeight.w700,
              color: c.primaryText,
              fontFeatures: const [FontFeature.tabularFigures()],
            ),
          ),
        ),
        const SizedBox(height: 16),
        IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              for (var i = 0; i < _presets.length; i++) ...[
                if (i > 0) const SizedBox(width: 8),
                Expanded(child: _presetButton(_presets[i])),
              ],
            ],
          ),
        ),
        const SizedBox(height: 16),
        Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  _columnLabel('Heure'),
                  const SizedBox(height: 6),
                  _column(_hoursRef, _hours, _h, (v) => setState(() => _h = v), 'heures'),
                ],
              ),
            ),
            const SizedBox(width: 8),
            Padding(
              padding: const EdgeInsets.only(top: 20),
              child: Text(':', style: TextStyle(fontSize: 28, fontWeight: FontWeight.w700, color: c.textSecondary)),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  _columnLabel('Minutes'),
                  const SizedBox(height: 6),
                  _column(_minutesRef, _minutes, _m, (v) => setState(() => _m = v), 'minutes'),
                ],
              ),
            ),
          ],
        ),
        const SizedBox(height: 16),
        Row(
          children: [
            Expanded(
              child: _sheetButton(
                label: 'Annuler',
                background: c.surfaceAlt,
                foreground: c.textPrimary,
                onTap: () => Navigator.of(context).pop(),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: _sheetButton(
                label: 'Valider',
                background: c.action,
                foreground: c.onAction,
                onTap: () => Navigator.of(context).pop((hour: _h, minute: _m)),
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _presetButton(_Preset p) {
    final c = context.colors;
    final active = p.hour == _h && p.minute == _m;
    return Tappable(
      onTap: () => _pick(p.hour, p.minute),
      semanticLabel: '${p.label}, ${formatReminderTime(p.hour, p.minute)}',
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 10),
        decoration: BoxDecoration(
          color: active ? c.tintPrimary : c.surface,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: active ? c.primaryDark : c.border, width: 1.5),
        ),
        child: ExcludeSemantics(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(p.icon, size: 18, color: active ? c.primaryText : c.textSecondary),
              const SizedBox(height: 2),
              Text(p.label,
                  style: TextStyle(
                      fontSize: 13, fontWeight: FontWeight.w600, color: active ? c.primaryText : c.textPrimary)),
              const SizedBox(height: 2),
              Text('${p.hour}:${pad2(p.minute)}',
                  style: TextStyle(fontSize: 12, color: active ? c.primaryText : c.textSecondary)),
            ],
          ),
        ),
      ),
    );
  }

  Widget _sheetButton({
    required String label,
    required Color background,
    required Color foreground,
    required VoidCallback onTap,
  }) {
    return Tappable(
      onTap: onTap,
      child: Container(
        height: 52,
        alignment: Alignment.center,
        decoration: BoxDecoration(color: background, borderRadius: BorderRadius.circular(14)),
        child: Text(label, style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: foreground)),
      ),
    );
  }
}
