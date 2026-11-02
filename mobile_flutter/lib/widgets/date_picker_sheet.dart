import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:ionicons/ionicons.dart';

import '../theme/colors.dart';
import '../theme/theme_controller.dart';
import 'sheet.dart';
import 'ui.dart';

const _weekdays = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const _months = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin', //
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];

/// Date locale → « AAAA-MM-JJ » (sans passer par l'UTC, qui décalerait d'un jour).
String toIsoDate(DateTime d) =>
    '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

DateTime fromIsoDate(String iso) {
  final p = iso.split('-').map(int.parse).toList();
  return DateTime(p[0], p[1], p[2]);
}

/// « mardi 3 novembre »
String formatLongDate(String iso) => DateFormat('EEEE d MMMM', 'fr_FR').format(fromIsoDate(iso));

DateTime _startOfDay(DateTime d) => DateTime(d.year, d.month, d.day);

/// Feuille du bas avec un calendrier mensuel. Les jours avant ``minDate`` ne
/// sont pas sélectionnables. Renvoie la date choisie (« AAAA-MM-JJ ») ou null.
Future<String?> showDatePickerSheet(BuildContext context, {required String title, String? value, DateTime? minDate}) {
  return showAppSheet<String>(
    context,
    title: title,
    showClose: false,
    builder: (_) => _DatePickerBody(value: value, minDate: _startOfDay(minDate ?? DateTime.now())),
  );
}

class _DatePickerBody extends StatefulWidget {
  final String? value;
  final DateTime minDate;
  const _DatePickerBody({this.value, required this.minDate});

  @override
  State<_DatePickerBody> createState() => _DatePickerBodyState();
}

class _DatePickerBodyState extends State<_DatePickerBody> {
  late String? _selected = widget.value;
  late DateTime _month = () {
    final base = widget.value != null ? fromIsoDate(widget.value!) : widget.minDate;
    return DateTime(base.year, base.month, 1);
  }();

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final min = widget.minDate;
    // Cases du mois, semaines commençant le lundi ; null = case vide.
    final offset = (_month.weekday + 6) % 7;
    final daysInMonth = DateTime(_month.year, _month.month + 1, 0).day;
    final cells = <DateTime?>[
      ...List.filled(offset, null),
      for (var d = 1; d <= daysInMonth; d++) DateTime(_month.year, _month.month, d),
    ];
    while (cells.length % 7 != 0) {
      cells.add(null);
    }
    final canGoBack = _month.isAfter(DateTime(min.year, min.month, 1));
    final todayIso = toIsoDate(DateTime.now());
    final scaler = MediaQuery.textScalerOf(context).clamp(maxScaleFactor: 1.4);

    Widget navButton(IconData icon, String label, VoidCallback? onTap) => Opacity(
          opacity: onTap == null ? 0.5 : 1,
          child: CircleIconButton(
            icon: icon,
            label: label,
            onPressed: onTap,
            bordered: false,
            background: c.surfaceAlt,
            size: 44,
          ),
        );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            navButton(Ionicons.chevron_back, 'Mois précédent',
                canGoBack ? () => setState(() => _month = DateTime(_month.year, _month.month - 1, 1)) : null),
            Semantics(
              liveRegion: true,
              child: Text('${_months[_month.month - 1]} ${_month.year}'.replaceFirstMapped(
                      RegExp(r'^.'), (m) => m[0]!.toUpperCase()),
                  style: TextStyle(fontSize: 17, fontWeight: FontWeight.w600, color: c.textPrimary)),
            ),
            navButton(Ionicons.chevron_forward, 'Mois suivant',
                () => setState(() => _month = DateTime(_month.year, _month.month + 1, 1))),
          ],
        ),
        const SizedBox(height: 14),
        ExcludeSemantics(
          child: Row(
            children: [
              for (final d in _weekdays)
                Expanded(
                  child: Padding(
                    padding: const EdgeInsets.only(bottom: 6),
                    child: Text(d,
                        textAlign: TextAlign.center,
                        textScaler: scaler,
                        style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: c.textSecondary)),
                  ),
                ),
            ],
          ),
        ),
        for (var row = 0; row < cells.length / 7; row++)
          Row(
            children: [
              for (final day in cells.sublist(row * 7, row * 7 + 7))
                Expanded(
                  child: SizedBox(
                    height: 46,
                    child: day == null ? null : _dayCell(c, day, min, todayIso, scaler),
                  ),
                ),
            ],
          ),
        const SizedBox(height: 14),
        PrimaryButton(
          height: 54,
          label: _selected != null ? 'Choisir le ${formatLongDate(_selected!)}' : 'Choisis un jour',
          onPressed: _selected != null ? () => Navigator.of(context).pop(_selected) : null,
        ),
      ],
    );
  }

  Widget _dayCell(AppColors c, DateTime day, DateTime min, String todayIso, TextScaler scaler) {
    final iso = toIsoDate(day);
    final disabled = day.isBefore(min);
    final active = iso == _selected;
    return Tappable(
      onTap: disabled ? null : () => setState(() => _selected = iso),
      selected: active,
      semanticLabel: formatLongDate(iso),
      child: Center(
        child: Container(
          width: 40,
          height: 40,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: active ? c.action : null,
            shape: BoxShape.circle,
            border: iso == todayIso && !active ? Border.all(color: c.primary, width: 1.5) : null,
          ),
          child: Text('${day.day}',
              textScaler: scaler,
              style: TextStyle(
                fontSize: 15,
                fontWeight: active ? FontWeight.w700 : FontWeight.w500,
                color: active ? c.onAction : (disabled ? c.muted : c.textPrimary),
              )),
        ),
      ),
    );
  }
}
