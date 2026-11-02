import 'package:flutter/foundation.dart';

import '../services/notifications.dart';
import '../services/storage.dart';

// Rappels locaux : révision (heure choisie), série (19 h), examens (J-7, J-1).
// Copie de utils/revisionNotifications.ts, streakNotifications.ts, examReminders.ts.

// ---------------------------------------------------------------- Révision

const _revEnabledKey = '@medflow_revision_reminders_enabled';
const _revIdKey = '@medflow_revision_reminder_notification_id';
const _revLastCountKey = '@medflow_revision_reminder_last_count';
const _defaultReminderHour = 9;
const _revHourKey = '@medflow_revision_reminder_hour';
const _revMinuteKey = '@medflow_revision_reminder_minute';

Future<bool> requestNotificationPermission() => Notifs.requestPermission();

Future<bool> isRevisionReminderEnabled() async => await Storage.getString(_revEnabledKey) == 'true';

/// Heure et minutes du rappel (minutes à 0 si jamais choisies).
Future<({int hour, int minute})> getRevisionReminderTime() async {
  final h = int.tryParse(await Storage.getString(_revHourKey) ?? '') ?? _defaultReminderHour;
  final m = int.tryParse(await Storage.getString(_revMinuteKey) ?? '') ?? 0;
  return (
    hour: (h >= 0 && h <= 23) ? h : _defaultReminderHour,
    minute: (m >= 0 && m <= 59) ? m : 0,
  );
}

Future<void> setRevisionReminderTime(int hour, int minute) async {
  await Storage.setString(_revHourKey, '${hour.clamp(0, 23)}');
  await Storage.setString(_revMinuteKey, '${minute.clamp(0, 59)}');
  await Storage.remove(_revLastCountKey);
}

Future<void> _cancelStored(String key) async {
  final id = await Storage.getString(key);
  if (id != null) {
    await Notifs.cancel(id);
    await Storage.remove(key);
  }
}

DateTime _nextOccurrence(int hour, int minute) {
  final now = DateTime.now();
  var target = DateTime(now.year, now.month, now.day, hour, minute);
  if (!target.isAfter(now)) target = target.add(const Duration(days: 1));
  final minimum = now.add(const Duration(seconds: 60));
  return target.isBefore(minimum) ? minimum : target;
}

/// Active les rappels de révision : demande la permission, puis planifie
/// selon le nombre de cartes actuellement dues.
Future<bool> enableRevisionReminders(int dueCount) async {
  if (!await requestNotificationPermission()) return false;
  await Storage.setString(_revEnabledKey, 'true');
  await scheduleRevisionReminder(dueCount);
  return true;
}

Future<void> disableRevisionReminders() async {
  await Storage.setString(_revEnabledKey, 'false');
  await _cancelStored(_revIdKey);
}

/// À appeler après chaque récupération de la prévision de révision. Le texte
/// reflète le nombre de cartes dues connu au moment de la planification ;
/// à 0, le rappel est annulé.
Future<void> scheduleRevisionReminder(int dueCount) async {
  try {
    if (!await isRevisionReminderEnabled()) return;
    if (dueCount <= 0) {
      await _cancelStored(_revIdKey);
      return;
    }
    if (await Storage.getString(_revLastCountKey) == '$dueCount') return;
    await _cancelStored(_revIdKey);

    final time = await getRevisionReminderTime();
    final body = dueCount == 1
        ? "Tu as 1 carte à réviser aujourd'hui, ça prend 2 minutes."
        : "Tu as $dueCount cartes à réviser aujourd'hui, ça prend quelques minutes.";
    final id = await Notifs.schedule(
      title: "🧠 C'est l'heure de réviser",
      body: body,
      at: _nextOccurrence(time.hour, time.minute),
    );
    await Storage.setString(_revIdKey, id);
    await Storage.setString(_revLastCountKey, '$dueCount');
  } catch (e) {
    debugPrint('Rappel de révision non planifié : $e');
  }
}

/// Notification de test (5 s), séparée du vrai rappel.
Future<bool> sendTestRevisionNotification() async {
  if (!await requestNotificationPermission()) return false;
  await Notifs.schedule(
    title: '🧠 Test révision MedFlow',
    body: 'Si tu vois ça, les rappels de révision fonctionnent !',
    at: DateTime.now().add(const Duration(seconds: 5)),
  );
  return true;
}

// ---------------------------------------------------------------- Série

const _streakEnabledKey = '@medflow_streak_reminders_enabled';
const _promptSeenKey = '@medflow_notif_prompt_seen';
const _streakIdKey = '@medflow_streak_reminder_notification_id';
const _streakHour = 19;
const _streakMinute = 0;

Future<bool> isStreakReminderEnabled() async => await Storage.getString(_streakEnabledKey) == 'true';

/// Le modal maison n'apparaît qu'une fois ; ensuite activable dans Réglages.
Future<bool> hasSeenNotificationPrompt() async => await Storage.getString(_promptSeenKey) == 'true';

Future<void> markNotificationPromptSeen() => Storage.setString(_promptSeenKey, 'true');

Future<bool> enableStreakReminders(String? lastActivityIso) async {
  if (!await requestNotificationPermission()) return false;
  await Storage.setString(_streakEnabledKey, 'true');
  await scheduleReminderIfNeeded(lastActivityIso);
  return true;
}

Future<void> disableStreakReminders() async {
  await Storage.setString(_streakEnabledKey, 'false');
  await _cancelStored(_streakIdKey);
}

/// Après chaque récupération des stats : déjà actif aujourd'hui → pas de
/// rappel ; sinon un rappel ce soir (ou demain si 19 h est passé).
Future<void> scheduleReminderIfNeeded(String? lastActivityIso) async {
  try {
    if (!await isStreakReminderEnabled()) return;
    // Comme l'app RN : date du jour en UTC (toISOString).
    final todayIso = DateTime.now().toUtc().toIso8601String().substring(0, 10);
    await _cancelStored(_streakIdKey);
    if (lastActivityIso == todayIso) return;
    final id = await Notifs.schedule(
      title: '🔥 Ne perds pas ta série !',
      body: "Tu n'as pas encore révisé aujourd'hui : quelques minutes suffisent pour garder ton streak.",
      at: _nextOccurrence(_streakHour, _streakMinute),
    );
    await Storage.setString(_streakIdKey, id);
  } catch (e) {
    debugPrint('Rappel de série non planifié : $e');
  }
}

Future<bool> sendTestNotification() async {
  if (!await requestNotificationPermission()) return false;
  await Notifs.schedule(
    title: '✅ Test MedFlow',
    body: 'Si tu vois ça, les notifications fonctionnent !',
    at: DateTime.now().add(const Duration(seconds: 5)),
  );
  return true;
}

// ---------------------------------------------------------------- Examens

class ExamSummary {
  final int id;
  final String title;
  final String examDate; // « 2026-11-03 »
  const ExamSummary(this.id, this.title, this.examDate);

  factory ExamSummary.fromJson(Map<String, dynamic> j) =>
      ExamSummary((j['id'] as num).toInt(), '${j['title'] ?? ''}', '${j['exam_date'] ?? ''}');
}

const _examReminderDays = [7, 1];
const _examReminderHour = 9;
const _examPrefix = 'exam-';

/// « Aujourd'hui », « Demain », « J-12 », « Passé »
String countdownLabel(int daysLeft) {
  if (daysLeft < 0) return 'Passé';
  if (daysLeft == 0) return "Aujourd'hui";
  if (daysLeft == 1) return 'Demain';
  return 'J-$daysLeft';
}

/// « 2026-11-03 » → date locale à l'heure du rappel, ``daysBefore`` jours avant.
DateTime reminderDate(String examDate, int daysBefore) {
  final parts = examDate.split('-').map(int.parse).toList();
  return DateTime(parts[0], parts[1], parts[2] - daysBefore, _examReminderHour);
}

/// Aligne les notifications planifiées sur la liste d'examens : annule celles
/// d'examens supprimés, planifie celles qui manquent. Sans permission, ne fait rien.
Future<void> syncExamReminders(List<ExamSummary> exams, {bool askPermission = false}) async {
  try {
    if (!await Notifs.isGranted()) {
      if (!askPermission || !await requestNotificationPermission()) return;
    }
    final now = DateTime.now();
    final wanted = <String, ({String title, String body, DateTime at})>{};
    for (final exam in exams) {
      for (final days in _examReminderDays) {
        final at = reminderDate(exam.examDate, days);
        if (at.isAfter(now.add(const Duration(minutes: 1)))) {
          wanted['$_examPrefix${exam.id}-$days'] = (
            title: days == 1 ? '📅 Examen demain' : '📅 Examen dans une semaine',
            body: days == 1
                ? '${exam.title} demain. Une dernière révision des cartes prioritaires ?'
                : '${exam.title} dans $days jours. Tes cartes de ce cours passent en priorité.',
            at: at,
          );
        }
      }
    }
    final existing = <String>{};
    for (final id in await Notifs.scheduledIdentifiers()) {
      if (!id.startsWith(_examPrefix)) continue;
      if (wanted.containsKey(id)) {
        existing.add(id);
      } else {
        await Notifs.cancel(id);
      }
    }
    for (final e in wanted.entries) {
      if (existing.contains(e.key)) continue;
      await Notifs.schedule(identifier: e.key, title: e.value.title, body: e.value.body, at: e.value.at);
    }
  } catch (e) {
    debugPrint('Rappels d’examen non planifiés : $e');
  }
}

/// Nombre de jours entre aujourd'hui et une date « AAAA-MM-JJ » (négatif si passée).
int daysUntil(String isoDate) {
  final parts = isoDate.split('-').map(int.parse).toList();
  final now = DateTime.now();
  final today = DateTime(now.year, now.month, now.day);
  final target = DateTime(parts[0], parts[1], parts[2]);
  return (target.difference(today).inHours / 24).round();
}
