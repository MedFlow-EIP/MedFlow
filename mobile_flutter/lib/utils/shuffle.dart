import 'dart:math';

final _random = Random();

/// Mélange de Fisher-Yates : renvoie une copie, ne modifie pas la liste reçue.
List<T> shuffle<T>(Iterable<T> items) {
  final copy = [...items];
  for (var i = copy.length - 1; i > 0; i--) {
    final j = _random.nextInt(i + 1);
    final tmp = copy[i];
    copy[i] = copy[j];
    copy[j] = tmp;
  }
  return copy;
}
