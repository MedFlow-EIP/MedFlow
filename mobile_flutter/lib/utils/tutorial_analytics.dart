import 'dart:convert';

import 'package:flutter/foundation.dart';

import '../services/storage.dart';

// Journal local du tutoriel de bienvenue (copie de utils/tutorialAnalytics.ts).

const _eventsKey = '@medflow_tutorial_events';

/// Les événements sont des Map JSON, comme dans l'app RN :
/// - `{type: 'tutorial_started', timestamp}`
/// - `{type: 'step_viewed', stepIndex, stepId, stepTitle, timestamp, msSinceStart}`
/// - `{type: 'tutorial_skipped', atStepIndex, atStepId, atStepTitle, timestamp, msSinceStart}`
/// - `{type: 'tutorial_completed', timestamp, msSinceStart}`
typedef TutorialEvent = Map<String, dynamic>;

// Les fonctions de log sont « fire-and-forget » (l'écran ne les attend pas) :
// les écritures sont mises à la file pour qu'un événement n'écrase pas le
// précédent quand deux logs partent dans la même frame. File vide → null.
Future<void>? _pendingWrites;

int _now() => DateTime.now().millisecondsSinceEpoch;

Future<void> _writeEvent(TutorialEvent event) async {
  try {
    final raw = await Storage.getString(_eventsKey);
    final events = raw != null ? (jsonDecode(raw) as List).cast<dynamic>().toList() : <dynamic>[];
    events.add(event);
    await Storage.setString(_eventsKey, jsonEncode(events));
    if (kDebugMode) debugPrint('[tutorial analytics] $event');
  } catch (error) {
    debugPrint('Erreur log analytics tutoriel: $error');
  }
}

Future<void> _appendEvent(TutorialEvent event) {
  final previous = _pendingWrites;
  final next = previous == null ? _writeEvent(event) : previous.then((_) => _writeEvent(event));
  _pendingWrites = next;
  next.whenComplete(() {
    if (identical(_pendingWrites, next)) _pendingWrites = null;
  });
  return next;
}

int logTutorialStarted() {
  final timestamp = _now();
  _appendEvent({'type': 'tutorial_started', 'timestamp': timestamp});
  return timestamp;
}

void logStepViewed(int startedAt, int stepIndex, String stepId, String stepTitle) {
  final timestamp = _now();
  _appendEvent({
    'type': 'step_viewed',
    'stepIndex': stepIndex,
    'stepId': stepId,
    'stepTitle': stepTitle,
    'timestamp': timestamp,
    'msSinceStart': timestamp - startedAt,
  });
}

void logTutorialSkipped(int startedAt, int atStepIndex, String atStepId, String atStepTitle) {
  final timestamp = _now();
  _appendEvent({
    'type': 'tutorial_skipped',
    'atStepIndex': atStepIndex,
    'atStepId': atStepId,
    'atStepTitle': atStepTitle,
    'timestamp': timestamp,
    'msSinceStart': timestamp - startedAt,
  });
}

void logTutorialCompleted(int startedAt) {
  final timestamp = _now();
  _appendEvent({
    'type': 'tutorial_completed',
    'timestamp': timestamp,
    'msSinceStart': timestamp - startedAt,
  });
}

/// Récupère tous les événements bruts, dans l'ordre chronologique.
Future<List<TutorialEvent>> getTutorialEvents() async {
  try {
    await _pendingWrites;
    final raw = await Storage.getString(_eventsKey);
    if (raw == null) return [];
    return (jsonDecode(raw) as List).map((e) => (e as Map).cast<String, dynamic>()).toList();
  } catch (error) {
    debugPrint('Erreur lecture analytics tutoriel: $error');
    return [];
  }
}

/// Résumé directement exploitable pour l'objectif usabilité du track EIP :
/// - timeToFirstActionMs : délai jusqu'au premier "Suivant" (première action
///   délibérée qui fonctionne, cf. guide "time to first successful action")
/// - droppedAtStep : étape à laquelle l'utilisateur a quitté, si abandon
/// - completed : est allé jusqu'au bout
Future<
    ({
      bool started,
      bool completed,
      ({int index, String title})? droppedAtStep,
      int? timeToFirstActionMs,
      int? totalDurationMs,
      int stepsViewedCount,
    })> getTutorialAnalyticsSummary() async {
  final events = await getTutorialEvents();

  TutorialEvent? first(String type) => events.where((e) => e['type'] == type).firstOrNull;

  final started = first('tutorial_started');
  final steps = events.where((e) => e['type'] == 'step_viewed').toList();
  final skipped = first('tutorial_skipped');
  final completed = first('tutorial_completed');

  // Le 2e step_viewed correspond au premier "Suivant" pressé (le 1er est
  // l'affichage de l'étape d'accueil, à msSinceStart ~0).
  final timeToFirstActionMs = steps.length > 1 ? (steps[1]['msSinceStart'] as num?)?.toInt() : null;

  return (
    started: started != null,
    completed: completed != null,
    droppedAtStep:
        skipped != null ? (index: (skipped['atStepIndex'] as num).toInt(), title: '${skipped['atStepTitle']}') : null,
    timeToFirstActionMs: timeToFirstActionMs,
    totalDurationMs: ((completed?['msSinceStart'] ?? skipped?['msSinceStart']) as num?)?.toInt(),
    stepsViewedCount: steps.length,
  );
}

Future<void> clearTutorialEvents() async {
  try {
    await _pendingWrites;
    await Storage.remove(_eventsKey);
  } catch (error) {
    debugPrint('Erreur reset analytics tutoriel: $error');
  }
}
