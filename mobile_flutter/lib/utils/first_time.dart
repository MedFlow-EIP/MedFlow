import '../services/storage.dart';

const _firstTimeKey = '@medflow_first_time';

Future<bool> isFirstTimeUser() async => await Storage.getString(_firstTimeKey) == null;

Future<void> markTutorialCompleted() => Storage.setString(_firstTimeKey, 'completed');

Future<void> resetTutorial() => Storage.remove(_firstTimeKey);
