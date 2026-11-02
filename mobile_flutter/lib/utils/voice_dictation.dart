import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:path_provider/path_provider.dart';
import 'package:record/record.dart';

import '../services/api.dart';

// Dictée vocale du chat (F45) : enregistrement court, retranscrit par le
// serveur (Gemini), puis placé dans le champ de saisie pour relecture.
// (copie de utils/voiceDictation.ts)

const int maxDictationSeconds = 120;

// Formats lus par Gemini : WAV 16 kHz mono (PCM 16 bits) sur iOS. Sur Android,
// AAC 16 kHz mono ; `record` l'écrit dans un conteneur MPEG-4 (audio/mp4).
RecordConfig get _recordConfig => Platform.isIOS
    ? const RecordConfig(encoder: AudioEncoder.wav, sampleRate: 16000, numChannels: 1)
    : const RecordConfig(encoder: AudioEncoder.aacLc, sampleRate: 16000, numChannels: 1, bitRate: 32000);

String get _extension => Platform.isIOS ? '.wav' : '.m4a';

String get _mimeType => Platform.isIOS ? 'audio/wav' : 'audio/mp4';

enum DictationState { idle, recording, transcribing }

/// Équivalent du hook useVoiceDictation : ``onText`` reçoit le texte
/// retranscrit ; ``onError`` un message à afficher. Écouter les changements
/// (state, seconds) avec addListener, et appeler dispose() en quittant l'écran.
class VoiceDictation extends ChangeNotifier {
  final void Function(String text) onText;
  final void Function(String message) onError;
  VoiceDictation({required this.onText, required this.onError});

  DictationState _state = DictationState.idle;
  int _seconds = 0;
  AudioRecorder? _recorder;
  String? _recordingPath;
  Timer? _timer;
  bool _disposed = false;

  DictationState get state => _state;
  int get seconds => _seconds;

  void _set({DictationState? state, int? seconds}) {
    if (state != null) _state = state;
    if (seconds != null) _seconds = seconds;
    if (!_disposed) notifyListeners();
  }

  void _clearTimer() {
    _timer?.cancel();
    _timer = null;
  }

  Future<String?> _release() async {
    _clearTimer();
    final path = _recordingPath;
    final recorder = _recorder;
    _recordingPath = null;
    _recorder = null;
    if (path == null || recorder == null) return null;
    String? uri;
    try {
      uri = await recorder.stop();
    } catch (_) {
      // Déjà arrêté.
    }
    recorder.dispose().catchError((_) {});
    return uri ?? path;
  }

  Future<void> start() async {
    if (_state != DictationState.idle) return;
    final recorder = AudioRecorder();
    try {
      final granted = await recorder.hasPermission();
      if (!granted) {
        recorder.dispose().catchError((_) {});
        onError('Autorise le micro dans les réglages du téléphone pour dicter ta question.');
        return;
      }
      final dir = await getTemporaryDirectory();
      final path = '${dir.path}/dictee-${DateTime.now().millisecondsSinceEpoch}$_extension';
      _recorder = recorder;
      _recordingPath = path;
      await recorder.start(_recordConfig, path: path);
      _set(seconds: 0, state: DictationState.recording);
      final startedAt = DateTime.now();
      _timer = Timer.periodic(const Duration(milliseconds: 500), (_) {
        final elapsed = DateTime.now().difference(startedAt).inSeconds;
        _set(seconds: elapsed);
        // Limite du serveur (2 min) : on s'arrête et on retranscrit.
        if (elapsed >= maxDictationSeconds) stop();
      });
    } catch (_) {
      if (_recorder == null) recorder.dispose().catchError((_) {});
      await _release();
      _set(state: DictationState.idle);
      onError('Micro indisponible. Réessaie.');
    }
  }

  Future<void> cancel() async {
    final uri = await _release();
    if (uri != null) _deleteFile(uri);
    _set(state: DictationState.idle);
  }

  Future<void> stop() async {
    final uri = await _release();
    if (uri == null) {
      _set(state: DictationState.idle);
      return;
    }
    _set(state: DictationState.transcribing);
    try {
      if (Api.currentUser == null) throw UserFacingError('Reconnecte-toi pour dicter.');
      final audio = base64Encode(await File(uri).readAsBytes());
      final res = await Api.post(
        '/chat/transcribe',
        {'audio': audio, 'mime_type': _mimeType},
        const Duration(seconds: 60),
      );
      final data = readJsonOrThrow(res, 'Dictée impossible. Réessaie.');
      final text = data is Map ? data['text'] : null;
      if (!_disposed) onText(text is String ? text : '');
    } catch (err) {
      if (!_disposed) onError(errorMessage(err, 'Dictée impossible. Réessaie.'));
    } finally {
      _deleteFile(uri);
      _set(state: DictationState.idle);
    }
  }

  void _deleteFile(String uri) {
    File(uri).delete().then((_) {}, onError: (_) {});
  }

  /// Écran quitté pendant l'enregistrement : on libère le micro.
  @override
  void dispose() {
    _disposed = true;
    _release().then((uri) {
      if (uri != null) _deleteFile(uri);
    });
    super.dispose();
  }
}
