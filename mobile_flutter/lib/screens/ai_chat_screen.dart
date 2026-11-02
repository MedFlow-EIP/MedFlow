import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:math' as math;

import 'package:file_picker/file_picker.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:flutter_tts/flutter_tts.dart';
import 'package:image_picker/image_picker.dart';
import 'package:ionicons/ionicons.dart';

import '../navigation/nav.dart';
import '../services/api.dart';
import '../services/storage.dart';
import '../theme/colors.dart';
import '../theme/theme_controller.dart';
import '../utils/analytics.dart';
import '../utils/app_alert.dart';
import '../utils/chat_answers.dart';
import '../utils/diagrams.dart';
import '../utils/voice_dictation.dart';
import '../widgets/chat/chat_diagram.dart';
import '../widgets/chat/chat_markdown.dart';
import '../widgets/chat/flashcards_from_chat_sheet.dart';
import '../widgets/insets.dart';
import '../widgets/report_error_sheet.dart';
import '../widgets/ui.dart';

// Copie de components/screens/AIChatScreen.tsx.

class _Attachment {
  /// image | file
  final String type;
  final String uri;
  final String? name;
  final String? mimeType;
  const _Attachment({required this.type, required this.uri, this.name, this.mimeType});

  factory _Attachment.fromJson(Map json) => _Attachment(
        type: json['type'] == 'image' ? 'image' : 'file',
        uri: json['uri'] is String ? json['uri'] as String : '',
        name: json['name'] is String ? json['name'] as String : null,
        mimeType: json['mimeType'] is String ? json['mimeType'] as String : null,
      );

  Map<String, dynamic> toJson() => {
        'type': type,
        'uri': uri,
        if (name != null) 'name': name,
        if (mimeType != null) 'mimeType': mimeType,
      };
}

class _Message {
  /// user | ai
  final String type;
  final String text;
  final List<_Attachment>? attachments;
  final int timestamp;

  /// Réponse non obtenue (réseau, quota…) : affichée en erreur avec « Réessayer ».
  final bool error;
  const _Message({required this.type, required this.text, this.attachments, required this.timestamp, this.error = false});

  factory _Message.fromJson(Map json) => _Message(
        type: json['type'] == 'user' ? 'user' : 'ai',
        text: '${json['text'] ?? ''}',
        attachments: json['attachments'] is List
            ? [for (final a in json['attachments'] as List) if (a is Map) _Attachment.fromJson(a)]
            : null,
        timestamp: json['timestamp'] is num ? (json['timestamp'] as num).toInt() : DateTime.now().millisecondsSinceEpoch,
        error: json['error'] == true,
      );

  Map<String, dynamic> toJson() => {
        'type': type,
        'text': text,
        if (attachments != null) 'attachments': [for (final a in attachments!) a.toJson()],
        'timestamp': timestamp,
        if (error) 'error': true,
      };
}

class _Conversation {
  final String id;
  final String title;
  final List<_Message> messages;
  final int createdAt;

  /// Identifiant de la conversation côté serveur : permet à l'IA de garder le fil.
  final String? serverId;
  const _Conversation({
    required this.id,
    required this.title,
    required this.messages,
    required this.createdAt,
    this.serverId,
  });

  _Conversation copyWith({String? title, List<_Message>? messages, String? serverId}) => _Conversation(
        id: id,
        title: title ?? this.title,
        messages: messages ?? this.messages,
        createdAt: createdAt,
        serverId: serverId ?? this.serverId,
      );

  factory _Conversation.fromJson(Map json) => _Conversation(
        id: '${json['id']}',
        title: '${json['title'] ?? ''}',
        messages: [
          if (json['messages'] is List)
            for (final m in json['messages'] as List)
              if (m is Map) _Message.fromJson(m),
        ],
        createdAt: json['createdAt'] is num ? (json['createdAt'] as num).toInt() : 0,
        serverId: json['serverId'] is String ? json['serverId'] as String : null,
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'title': title,
        'messages': [for (final m in messages) m.toJson()],
        'createdAt': createdAt,
        if (serverId != null) 'serverId': serverId,
      };
}

class _AIResult {
  final String response;
  final String? conversationId;
  final String? title;
  final bool error;
  const _AIResult(this.response, {this.conversationId, this.title, this.error = false});
}

// Mêmes limites que le backend (/chat).
const int _maxAttachmentBytes = 7 * 1024 * 1024;
const int _maxAttachments = 3;

// Une réponse peut être longue à générer, mais jamais d'attente infinie.
const Duration _chatTimeout = Duration(seconds: 90);

// Ancienne clé commune à tous les comptes du téléphone : un compte voyait les
// conversations d'un autre. Elle est supprimée au chargement.
const String _legacyStorageKey = '@ai_conversations';

/// Historique stocké par utilisateur Firebase.
String _storageKey(String uid) => '@ai_conversations:$uid';

int _now() => DateTime.now().millisecondsSinceEpoch;

/// Dates SQLite (« 2026-10-27 14:03:00 », en UTC) → millisecondes.
int _parseServerDate(Object? value) {
  if (value is! String) return _now();
  return DateTime.tryParse('${value.replaceFirst(' ', 'T')}Z')?.millisecondsSinceEpoch ?? _now();
}

/// Conversations enregistrées sur le serveur, ou null hors ligne.
Future<List<Map<String, dynamic>>?> _fetchServerConversations() async {
  try {
    if (Api.currentUser == null) return null;
    final res = await Api.get('/chat/conversations');
    if (res.statusCode < 200 || res.statusCode >= 300) return null;
    final data = decodeBody(res);
    final list = data is Map ? data['conversations'] : null;
    if (list is! List) return null;
    return [
      for (final s in list)
        if (s is Map) s.cast<String, dynamic>(),
    ];
  } catch (_) {
    return null;
  }
}

/// Le serveur fait foi pour les conversations qu'il connaît (même compte sur un
/// autre téléphone). On garde la copie locale quand elle est à jour, car elle
/// contient les aperçus des pièces jointes que le serveur ne stocke pas.
List<_Conversation> _mergeWithServer(List<_Conversation> local, List<Map<String, dynamic>>? server) {
  if (server == null) return local;
  final serverIds = {for (final s in server) '${s['conversation_id']}'};
  final byServerId = {
    for (final c in local)
      if (c.serverId != null) c.serverId!: c,
  };

  final fromServer = server.map((s) {
    final sid = '${s['conversation_id']}';
    final existing = byServerId[sid];
    final messages = s['messages'] is List ? s['messages'] as List : const [];
    if (existing != null && existing.messages.length >= messages.length) return existing;
    final title = s['title'];
    return _Conversation(
      id: existing?.id ?? sid,
      serverId: sid,
      title: title is String && title.isNotEmpty ? title : 'Conversation',
      createdAt: _parseServerDate(s['created_at']),
      messages: [
        for (var i = 0; i < messages.length; i++)
          if (messages[i] is Map) _serverMessage(messages[i] as Map, existing, i),
      ],
    );
  }).toList();

  // Conversations pas encore envoyées (vides) : gardées. Celles supprimées
  // depuis un autre appareil : retirées.
  final localOnly = local.where((c) => c.serverId == null);
  return [...fromServer, ...localOnly.where((c) => !serverIds.contains(c.id))];
}

_Message _serverMessage(Map m, _Conversation? existing, int i) {
  final previous = existing != null && i < existing.messages.length ? existing.messages[i].attachments : null;
  final serverAttachments = m['attachments'] is List ? m['attachments'] as List : const [];
  return _Message(
    type: m['sender'] == 'user' ? 'user' : 'ai',
    text: '${m['content'] ?? ''}',
    timestamp: _parseServerDate(m['created_at']),
    attachments: previous ??
        (serverAttachments.isNotEmpty
            ? [
                for (final a in serverAttachments)
                  if (a is Map)
                    _Attachment(
                      type: '${a['mime_type'] ?? ''}'.startsWith('image/') ? 'image' : 'file',
                      uri: '',
                      name: a['name'] is String ? a['name'] as String : null,
                    ),
              ]
            : null),
  );
}

const List<String> _suggestions = [
  'Résume les points clés de mon dernier cours',
  'Fais-moi un quiz sur les os du crâne',
  'Fais-moi un schéma du cycle cardiaque',
];

const String _emptyIconSvg = '<svg width="30" height="30" viewBox="0 0 30 30" fill="none" '
    'xmlns="http://www.w3.org/2000/svg"><path d="M15 1.5V7.5M15 22.5V28.5M1.5 15H7.5M22.5 15H28.5M6 6L9.75 '
    '9.75M20.25 20.25L24 24M6 24L9.75 20.25M20.25 9.75L24 6" stroke="#000000" stroke-width="3" '
    'stroke-linecap="round" stroke-linejoin="round"/></svg>';

/// Type MIME d'un fichier d'après son extension (fourni par Expo dans l'app RN).
String? _mimeFromName(String name) {
  final dot = name.lastIndexOf('.');
  final ext = dot < 0 ? '' : name.substring(dot + 1).toLowerCase();
  return switch (ext) {
    'pdf' => 'application/pdf',
    'jpg' || 'jpeg' => 'image/jpeg',
    'png' => 'image/png',
    'webp' => 'image/webp',
    'gif' => 'image/gif',
    'heic' => 'image/heic',
    'heif' => 'image/heif',
    _ => null,
  };
}

class AIChatScreen extends StatefulWidget {
  const AIChatScreen({super.key});

  @override
  State<AIChatScreen> createState() => _AIChatScreenState();
}

class _AIChatScreenState extends State<AIChatScreen> with FocusRefresh<AIChatScreen> {
  @override
  String? get tabName => 'AIChat';

  final _input = TextEditingController();
  final _inputFocus = FocusNode();
  final _scroll = ScrollController();

  List<_Conversation> _conversations = [];
  String? _currentConvId;
  bool _isHistoryVisible = false;
  ModalRoute<void>? _historyRoute;

  /// Le tiroir d'historique est une route à part : il se redessine à chaque setState.
  final _drawerTick = ValueNotifier<int>(0);

  // Lecture vocale des réponses : comme dans l'app RN, rien ne l'active encore.
  final bool _isAISpeaking = false;
  FlutterTts? _tts;

  List<_Attachment> _attachments = [];

  // Conversations qui attendent une réponse : changer de conversation ne
  // doit pas y afficher les « … » d'une autre.
  final Set<String> _pendingConvs = {};
  bool _isAttachMenuOpen = false;
  ({String text, IconData icon})? _toast;
  Timer? _toastTimer;

  // Renommer une conversation depuis l'historique (titre modifié sur place).
  String? _renamingId;
  final _renameText = TextEditingController();
  FocusNode? _renameFocus;

  // Question envoyée par un autre écran (« Explique-moi cette carte ») :
  // `stamp` de l'onglet déjà traité (équivalent de setParams({ prompt: undefined })).
  int? _handledPromptStamp;

  late final VoiceDictation _dictation;

  // Défilement vers le bas quand un message arrive (nombre de messages, « … »).
  String? _scrollKey;

  bool get _isTyping => _currentConvId != null && _pendingConvs.contains(_currentConvId);

  _Conversation? get _currentConv => _conversations.where((c) => c.id == _currentConvId).firstOrNull;

  @override
  void initState() {
    super.initState();
    logScreenView('AIChatScreen');
    _input.addListener(_onInputChanged);
    // Dictée vocale (F45) : le texte retranscrit s'ajoute au champ, à relire avant d'envoyer.
    _dictation = VoiceDictation(
      onText: (text) {
        final prev = _input.text;
        var next = prev.trim().isNotEmpty ? '${prev.trimRight()} $text' : text;
        if (next.length > 2000) next = next.substring(0, 2000);
        _input.value = TextEditingValue(text: next, selection: TextSelection.collapsed(offset: next.length));
        _inputFocus.requestFocus();
      },
      onError: (message) => appAlert('Dictée', message),
    )..addListener(_onDictationChanged);
  }

  void _onInputChanged() => setState(() {});

  void _onDictationChanged() {
    if (mounted) setState(() {});
  }

  @override
  void setState(VoidCallback fn) {
    super.setState(fn);
    _drawerTick.value++;
  }

  @override
  void dispose() {
    _toastTimer?.cancel();
    _dictation.removeListener(_onDictationChanged);
    _dictation.dispose();
    _tts?.stop();
    _input.dispose();
    _inputFocus.dispose();
    _scroll.dispose();
    _renameText.dispose();
    _renameFocus?.dispose();
    final route = _historyRoute;
    _historyRoute = null;
    if (route != null) {
      // Le tiroir est encore ouvert (déconnexion) : retiré après ce cycle.
      scheduleMicrotask(() {
        if (route.isActive) route.navigator?.removeRoute(route);
        scheduleMicrotask(_drawerTick.dispose);
      });
    } else {
      _drawerTick.dispose();
    }
    super.dispose();
  }

  @override
  void onFocus() {
    // Après le chargement, sinon il remplacerait la nouvelle conversation.
    _loadConversations().then((_) {
      final tab = currentTab.value;
      if (!mounted || tab.route != 'AIChat') return;
      final prompt = tab.params?['prompt'];
      if (prompt is! String || prompt.isEmpty || tab.stamp == _handledPromptStamp) return;
      _handledPromptStamp = tab.stamp;
      _createNewConversation();
      // Envoie la question reçue d'un autre écran dès que la conversation vide est prête.
      _sendMessage(prompt, const []);
    });
  }

  void _persist(List<_Conversation> list) {
    final uid = Api.currentUser?.uid;
    if (uid != null) Storage.setJson(_storageKey(uid), [for (final c in list) c.toJson()]);
  }

  /// Nouvelle liste de conversations, enregistrée sur le téléphone si elle n'est pas vide.
  void _setConversations(List<_Conversation> next) {
    setState(() => _conversations = next);
    if (next.isNotEmpty) _persist(next);
  }

  Future<void> _loadConversations() async {
    try {
      final uid = Api.currentUser?.uid;
      if (uid == null) return;
      await Storage.remove(_legacyStorageKey);
      final stored = await Storage.getString(_storageKey(uid));
      // Affiche tout de suite la copie locale (aussi hors ligne)...
      final decoded = stored != null ? jsonDecode(stored) : const [];
      final local = [
        for (final c in decoded as List)
          if (c is Map) _Conversation.fromJson(c),
      ];
      final merged = _mergeWithServer(local, await _fetchServerConversations());
      mergeSort(merged, compare: (a, b) => b.createdAt.compareTo(a.createdAt));
      if (!mounted) return;
      _setConversations(merged);
      if (merged.isNotEmpty) {
        final prev = _currentConvId;
        setState(() => _currentConvId = prev != null && merged.any((c) => c.id == prev) ? prev : merged.first.id);
      } else {
        _createNewConversation();
      }
    } catch (error) {
      debugPrint('Erreur chargement conversations: $error');
    }
  }

  void _showToast(String message,
      {IconData icon = Ionicons.createOutline, Duration duration = const Duration(milliseconds: 2000)}) {
    setState(() => _toast = (text: message, icon: icon));
    _toastTimer?.cancel();
    _toastTimer = Timer(duration, () {
      if (mounted) setState(() => _toast = null);
    });
  }

  void _createNewConversation({bool announce = false}) {
    final now = _now();
    final newConv = _Conversation(id: '$now', title: 'Nouvelle conversation', messages: const [], createdAt: now);
    _closeHistory();
    _setConversations([newConv, ..._conversations]);
    _input.clear();
    setState(() {
      _currentConvId = newConv.id;
      _attachments = [];
      _isAttachMenuOpen = false;
    });
    if (announce) _showToast('Nouvelle conversation démarrée');
  }

  String _generateTitle(List<_Message> messages) {
    final firstUserMsg = messages.where((m) => m.type == 'user').firstOrNull;
    if (firstUserMsg != null && firstUserMsg.text.isNotEmpty) {
      return firstUserMsg.text.length > 30 ? '${firstUserMsg.text.substring(0, 30)}...' : firstUserMsg.text;
    }
    return 'Nouvelle conversation';
  }

  Future<_AIResult> _askMedicalAI(String message, String? serverId, List<_Attachment> files) async {
    const fallback = "L'assistant n'a pas pu répondre. Réessaie dans un instant.";
    try {
      if (Api.currentUser == null) throw StateError('Non connecté');

      // Les fichiers partent en base64 ; le serveur les transmet au modèle sans les stocker.
      final attachmentsPayload = await Future.wait(files.map((f) async => {
            if (f.name != null) 'name': f.name,
            if (f.mimeType != null) 'mime_type': f.mimeType,
            'data': base64Encode(await File(f.uri).readAsBytes()),
          }));

      final response = await Api.post(
        '/chat',
        {
          'message': message,
          if (serverId != null) 'conversation_id': serverId,
          'attachments': attachmentsPayload,
        },
        _chatTimeout,
      );

      final data = decodeBody(response);
      final ok = response.statusCode >= 200 && response.statusCode < 300;
      if (!ok || data is! Map || data['response'] is! String) {
        return _AIResult(httpErrorMessage(response.statusCode, data, fallback), error: true);
      }

      final title = data['title'];
      return _AIResult(
        data['response'] as String,
        conversationId: data['conversation_id']?.toString(),
        title: title is String && title.isNotEmpty ? title : null,
      );
    } catch (error) {
      debugPrint('Erreur AI: $error');
      return _AIResult(errorMessage(error, fallback), error: true);
    }
  }

  Future<void> _sendMessage([String? textOverride, List<_Attachment>? filesOverride]) async {
    final text = textOverride ?? _input.text;
    final outgoing = filesOverride ?? _attachments;
    final convId = _currentConvId;
    if ((text.trim().isEmpty && outgoing.isEmpty) || convId == null || _pendingConvs.contains(convId)) return;

    final userMessage = _Message(
      type: 'user',
      text: text,
      attachments: outgoing.isNotEmpty ? [...outgoing] : null,
      timestamp: _now(),
    );

    final files = [...outgoing];
    final serverId = _conversations.where((c) => c.id == convId).firstOrNull?.serverId;

    _setConversations([
      for (final c in _conversations)
        c.id == convId
            ? c.copyWith(
                messages: [...c.messages, userMessage],
                title: c.messages.isEmpty ? _generateTitle([userMessage]) : c.title,
              )
            : c,
    ]);

    if (filesOverride == null) _input.clear();
    setState(() {
      if (filesOverride == null) _attachments = [];
      _isAttachMenuOpen = false;
      _pendingConvs.add(convId);
    });
    logEvent('chat_message_sent', outgoing.isNotEmpty ? 'avec_fichier' : null);

    try {
      final result = await _askMedicalAI(text, serverId, files);
      if (!mounted) return;

      setState(() => _pendingConvs.remove(convId));

      final aiMessage = _Message(type: 'ai', text: result.response, timestamp: _now(), error: result.error);

      _setConversations([
        for (final c in _conversations)
          c.id == convId
              ? c.copyWith(
                  serverId: result.conversationId ?? c.serverId,
                  title: result.title ?? c.title,
                  messages: [...c.messages, aiMessage],
                )
              : c,
      ]);

      if (_isAISpeaking && !result.error && convId == _currentConvId) {
        _speak(stripDiagrams(result.response));
      }
    } catch (error) {
      if (!mounted) return;
      setState(() => _pendingConvs.remove(convId));
      appAlert('Erreur', "Impossible de contacter l'assistant médical.");
    }
  }

  Future<void> _speak(String text) async {
    final tts = _tts ??= FlutterTts();
    try {
      await tts.setLanguage('fr-FR');
      await tts.setPitch(1.0);
      // expo-speech : rate 0.9 (1 = normal) ; flutter_tts : 0.5 = débit normal.
      await tts.setSpeechRate(0.45);
      await tts.speak(text);
    } catch (_) {}
  }

  /// Renvoie la dernière question restée sans réponse (message d'erreur retiré).
  void _retryLastMessage() {
    final messages = _currentConv?.messages ?? const <_Message>[];
    final failed = messages.isNotEmpty ? messages.last : null;
    final question = messages.length >= 2 ? messages[messages.length - 2] : null;
    if (failed == null || !failed.error || question == null || question.type != 'user' || _isTyping) return;

    _setConversations([
      for (final c in _conversations)
        c.id == _currentConvId ? c.copyWith(messages: c.messages.sublist(0, c.messages.length - 2)) : c,
    ]);
    // Pièces jointes venues d'un autre appareil (sans fichier local) : non renvoyées.
    _sendMessage(question.text, (question.attachments ?? const <_Attachment>[]).where((a) => a.uri.isNotEmpty).toList());
  }

  void _startRename(String convId, String title) {
    if (_renamingId != null) _saveRename();
    final previous = _renameFocus;
    final focus = FocusNode();
    // Quitter le champ enregistre le titre (onBlur).
    focus.addListener(() {
      if (!focus.hasFocus && identical(focus, _renameFocus) && _renamingId != null) _saveRename();
    });
    _renameFocus = focus;
    // Texte sélectionné à l'ouverture (selectTextOnFocus).
    _renameText.value = TextEditingValue(text: title, selection: TextSelection(baseOffset: 0, extentOffset: title.length));
    setState(() => _renamingId = convId);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      previous?.dispose();
      if (identical(focus, _renameFocus) && _renamingId == convId) focus.requestFocus();
    });
  }

  void _saveRename() {
    final convId = _renamingId;
    var title = _renameText.text.trim();
    if (title.length > 80) title = title.substring(0, 80);
    setState(() => _renamingId = null);
    if (convId == null || title.isEmpty) return;
    final serverId = _conversations.where((c) => c.id == convId).firstOrNull?.serverId;
    _setConversations([for (final c in _conversations) c.id == convId ? c.copyWith(title: title) : c]);
    // Renommée aussi côté serveur, sinon l'ancien titre reviendrait à la prochaine synchro.
    if (serverId != null && Api.currentUser != null) {
      Api.patch('/chat/conversations/$serverId', {'title': title}).then((_) {}, onError: (_) {});
    }
  }

  void _deleteConversation(String convId) {
    appAlert('Supprimer la conversation', 'Cette action est irréversible.', [
      const AlertButton('Annuler', style: AlertStyle.cancel),
      AlertButton(
        'Supprimer',
        style: AlertStyle.destructive,
        onPress: () {
          if (!mounted) return;
          // Supprimée aussi côté serveur, sinon elle reviendrait à la prochaine synchro.
          final serverId = _conversations.where((c) => c.id == convId).firstOrNull?.serverId;
          if (serverId != null && Api.currentUser != null) {
            Api.delete('/chat/conversations/$serverId').then((_) {}, onError: (_) {});
          }
          final filtered = _conversations.where((c) => c.id != convId).toList();
          _persist(filtered);

          if (_currentConvId == convId) {
            if (filtered.isNotEmpty) {
              _setConversations(filtered);
              setState(() => _currentConvId = filtered.first.id);
            } else {
              final now = _now();
              final newConv =
                  _Conversation(id: '$now', title: 'Nouvelle conversation', messages: const [], createdAt: now);
              _setConversations([newConv]);
              setState(() => _currentConvId = newConv.id);
            }
          } else {
            _setConversations(filtered);
          }
        },
      ),
    ]);
  }

  void _selectConversation(String convId) {
    _closeHistory();
    _input.clear();
    setState(() {
      _currentConvId = convId;
      _attachments = [];
    });
  }

  // Vérifie le nombre et la taille avant d'ajouter une pièce jointe (mêmes règles que le serveur).
  void _addAttachment(_Attachment attachment, int? size) {
    if (_attachments.length >= _maxAttachments) {
      appAlert('Trop de fichiers', '$_maxAttachments pièces jointes maximum par message.');
      return;
    }
    if (size != null && size > _maxAttachmentBytes) {
      appAlert('Fichier trop lourd', 'Chaque pièce jointe doit faire 7 Mo maximum.');
      return;
    }
    setState(() => _attachments = [..._attachments, attachment]);
  }

  Future<void> _pickImage() async {
    setState(() => _isAttachMenuOpen = false);
    try {
      final asset = await ImagePicker().pickImage(source: ImageSource.gallery, imageQuality: 70);
      if (asset == null || !mounted) return;
      final detected = asset.mimeType ?? _mimeFromName(asset.name);
      final mimeType = detected != null && detected.startsWith('image/') ? detected : 'image/jpeg';
      _addAttachment(
        _Attachment(type: 'image', uri: asset.path, name: asset.name.isNotEmpty ? asset.name : 'Image', mimeType: mimeType),
        await asset.length(),
      );
    } catch (error) {
      debugPrint('Erreur sélection image: $error');
    }
  }

  Future<void> _pickDocument() async {
    setState(() => _isAttachMenuOpen = false);
    try {
      final result = await FilePicker.pickFiles(
        type: FileType.custom,
        allowedExtensions: const ['pdf', 'jpg', 'jpeg', 'png', 'webp'],
      );
      final asset = result?.files.firstOrNull;
      if (asset == null || asset.path == null || !mounted) return;
      _addAttachment(
        _Attachment(
          type: 'file',
          uri: asset.path!,
          name: asset.name,
          mimeType: _mimeFromName(asset.name) ?? 'application/pdf',
        ),
        asset.size,
      );
    } catch (error) {
      debugPrint('Erreur sélection document: $error');
    }
  }

  String _formatTime(int timestamp) {
    final date = DateTime.fromMillisecondsSinceEpoch(timestamp);
    String two(int n) => n.toString().padLeft(2, '0');
    return '${two(date.hour)}:${two(date.minute)}';
  }

  bool _isHTML(String text) => text.trim().startsWith('<') && text.contains('</');

  /// Conversations groupées par date dans le tiroir d'historique.
  List<({String title, List<_Conversation> items})> _historySections() {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day).millisecondsSinceEpoch;
    final weekAgo = today - 6 * 24 * 60 * 60 * 1000;
    final groups = [
      (title: 'AUJOURD’HUI', items: <_Conversation>[]),
      (title: 'CETTE SEMAINE', items: <_Conversation>[]),
      (title: 'PLUS ANCIEN', items: <_Conversation>[]),
    ];
    for (final conv in _conversations) {
      final bucket = conv.createdAt >= today
          ? 0
          : conv.createdAt >= weekAgo
              ? 1
              : 2;
      groups[bucket].items.add(conv);
    }
    return groups.where((g) => g.items.isNotEmpty).toList();
  }

  // ---------------------------------------------------------------------------
  // Tiroir d'historique
  // ---------------------------------------------------------------------------

  void _openHistory() {
    if (_isHistoryVisible) return;
    setState(() => _isHistoryVisible = true);
    showGeneralDialog<void>(
      context: context,
      useRootNavigator: true,
      barrierDismissible: false,
      barrierColor: Colors.transparent,
      transitionDuration: const Duration(milliseconds: 200),
      pageBuilder: (ctx, animation, _) {
        _historyRoute = ModalRoute.of(ctx);
        return ListenableBuilder(
          listenable: _drawerTick,
          builder: (ctx, _) => _buildHistory(ctx, animation),
        );
      },
    ).whenComplete(() {
      _historyRoute = null;
      if (mounted) setState(() => _isHistoryVisible = false);
    });
  }

  void _closeHistory() {
    final route = _historyRoute;
    if (route == null) return;
    _historyRoute = null;
    if (route.isCurrent) {
      route.navigator?.pop();
    } else if (route.isActive) {
      route.navigator?.removeRoute(route);
    }
  }

  Widget _buildHistory(BuildContext ctx, Animation<double> animation) {
    final c = ctx.colors;
    final insets = ScreenInsets.of(ctx);
    final width = math.min(300.0, MediaQuery.sizeOf(ctx).width * 0.8);
    final sections = _historySections();
    return Stack(
      children: [
        // Toucher n'importe où sur la zone assombrie ferme l'historique
        Positioned.fill(
          child: Semantics(
            button: true,
            label: "Fermer l'historique",
            child: GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: _closeHistory,
              child: const ColoredBox(color: Color(0x80000000)),
            ),
          ),
        ),
        Positioned(
          left: 0,
          top: 0,
          bottom: 0,
          width: width,
          child: SlideTransition(
            position: Tween<Offset>(begin: const Offset(-1, 0), end: Offset.zero).animate(
              CurvedAnimation(parent: animation, curve: Curves.easeOut, reverseCurve: const Threshold(0)),
            ),
            child: Material(
              color: c.surface,
              borderRadius: const BorderRadius.only(topRight: Radius.circular(24), bottomRight: Radius.circular(24)),
              clipBehavior: Clip.antiAlias,
              child: Padding(
                padding: EdgeInsets.fromLTRB(12, insets.top + 12, 12, 24),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Padding(
                      padding: const EdgeInsets.fromLTRB(8, 0, 8, 12),
                      child: Row(
                        children: [
                          Expanded(
                            child: Semantics(
                              header: true,
                              child: Text('Historique',
                                  style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700, color: c.textPrimary)),
                            ),
                          ),
                          Tappable(
                            onTap: () => _createNewConversation(announce: true),
                            semanticLabel: 'Nouvelle conversation',
                            child: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                              decoration: BoxDecoration(
                                borderRadius: BorderRadius.circular(999),
                                border: Border.all(color: c.primaryDark, width: 1.5),
                              ),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Icon(Ionicons.createOutline, size: 16, color: c.primaryText),
                                  const SizedBox(width: 6),
                                  Text('Nouveau',
                                      style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: c.primaryText)),
                                ],
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                    Expanded(
                      child: ScrollConfiguration(
                        behavior: ScrollConfiguration.of(ctx).copyWith(scrollbars: false),
                        child: SingleChildScrollView(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              for (var s = 0; s < sections.length; s++) ...[
                                if (s > 0) const SizedBox(height: 6),
                                Text(sections[s].title,
                                    style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: c.textSecondary)),
                                for (final item in sections[s].items) ...[
                                  const SizedBox(height: 6),
                                  _historyItem(c, item),
                                ],
                              ],
                            ],
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _historyItem(AppColors c, _Conversation item) {
    final active = item.id == _currentConvId;
    // Conversation active : fond bleu très clair + barre bleue + texte bleu foncé (AA).
    final decoration = BoxDecoration(
      color: active || _renamingId == item.id ? c.tintPrimary : null,
      borderRadius: BorderRadius.circular(12),
    );
    if (_renamingId == item.id) {
      return Container(
        key: ValueKey('rename-${item.id}'),
        padding: const EdgeInsets.only(left: 12),
        decoration: decoration,
        child: Row(
          children: [
            Expanded(
              child: Semantics(
                label: 'Nouveau titre de la conversation',
                child: ConstrainedBox(
                  constraints: const BoxConstraints(minHeight: 44),
                  child: Center(
                    child: TextField(
                      controller: _renameText,
                      focusNode: _renameFocus,
                      onSubmitted: (_) => _saveRename(),
                      inputFormatters: [LengthLimitingTextInputFormatter(80)],
                      textInputAction: TextInputAction.done,
                      style: TextStyle(fontSize: 15, color: c.textPrimary),
                      decoration: const InputDecoration(
                        isDense: true,
                        border: InputBorder.none,
                        contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                      ),
                    ),
                  ),
                ),
              ),
            ),
            const SizedBox(width: 10),
            Tappable(
              onTap: _saveRename,
              semanticLabel: 'Enregistrer le titre',
              child: SizedBox(width: 44, height: 44, child: Icon(Ionicons.checkmark, size: 20, color: c.primaryText)),
            ),
          ],
        ),
      );
    }
    final gap = active ? 10.0 : 0.0;
    return Container(
      key: ValueKey(item.id),
      padding: const EdgeInsets.only(left: 12),
      decoration: decoration,
      child: Row(
        children: [
          if (active) ...[
            Container(
              width: 4,
              height: 22,
              decoration: BoxDecoration(color: c.primaryDark, borderRadius: BorderRadius.circular(2)),
            ),
            SizedBox(width: gap),
          ],
          Expanded(
            child: Tappable(
              onTap: () => _selectConversation(item.id),
              semanticLabel: item.title,
              selected: active,
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 12),
                child: Text(
                  item.title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: 15,
                    color: active ? c.primaryText : c.textPrimary,
                    fontWeight: active ? FontWeight.w600 : FontWeight.w400,
                  ),
                ),
              ),
            ),
          ),
          SizedBox(width: gap),
          Tappable(
            onTap: () => _startRename(item.id, item.title),
            semanticLabel: 'Renommer la conversation ${item.title}',
            child: SizedBox(
                width: 44, height: 44, child: Icon(Ionicons.pencilOutline, size: 18, color: c.textSecondary)),
          ),
          SizedBox(width: gap),
          Tappable(
            onTap: () => _deleteConversation(item.id),
            semanticLabel: 'Supprimer la conversation ${item.title}',
            child: SizedBox(
                width: 44, height: 44, child: Icon(Ionicons.trashOutline, size: 18, color: c.textSecondary)),
          ),
        ],
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // Messages
  // ---------------------------------------------------------------------------

  void _scrollToEnd() {
    if (!mounted || !_scroll.hasClients) return;
    _scroll.animateTo(_scroll.position.maxScrollExtent,
        duration: const Duration(milliseconds: 300), curve: Curves.easeOut);
  }

  Widget _emptyState(AppColors c) {
    return _ZoomIn(
      key: ValueKey('empty-$_currentConvId'),
      child: Padding(
        padding: const EdgeInsets.only(top: 24),
        child: Column(
          children: [
            Container(
              width: 80,
              height: 80,
              decoration: BoxDecoration(color: c.tintPrimary, shape: BoxShape.circle),
              alignment: Alignment.center,
              child: SvgPicture.string(
                _emptyIconSvg,
                width: 30,
                height: 30,
                excludeFromSemantics: true,
                colorFilter: ColorFilter.mode(c.primaryDark, BlendMode.srcIn),
              ),
            ),
            const SizedBox(height: 12),
            Text('Sur quoi veux-tu réviser ?',
                style: TextStyle(fontSize: 22, fontWeight: FontWeight.w700, color: c.textPrimary)),
            const SizedBox(height: 12),
            Text('Pose une question ou pars d’un de tes cours.',
                textAlign: TextAlign.center, style: TextStyle(fontSize: 15, height: 22 / 15, color: c.textSecondary)),
            const SizedBox(height: 12),
            Text('L’assistant peut se tromper : vérifie avec ton cours.',
                textAlign: TextAlign.center, style: TextStyle(fontSize: 13, color: c.textSecondary)),
            const SizedBox(height: 12 + 16),
            for (var i = 0; i < _suggestions.length; i++) ...[
              if (i > 0) const SizedBox(height: 10),
              Tappable(
                onTap: () => _sendMessage(_suggestions[i]),
                child: Container(
                  width: double.infinity,
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                  decoration: BoxDecoration(
                    color: c.surface,
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: c.border),
                  ),
                  child: Text(_suggestions[i],
                      style: TextStyle(fontSize: 15, height: 21 / 15, color: c.textPrimary)),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _attachmentPreview(AppColors c, _Attachment att) {
    // Sans uri : pièce jointe venue d'un autre appareil, seul le nom est connu.
    if (att.type == 'image' && att.uri.isNotEmpty) {
      return Semantics(
        image: true,
        label: 'Image jointe : ${att.name ?? ''}',
        child: ClipRRect(
          borderRadius: BorderRadius.circular(12),
          child: Image.file(
            File(att.uri),
            width: 220,
            height: 150,
            fit: BoxFit.cover,
            excludeFromSemantics: true,
            errorBuilder: (_, __, ___) => const SizedBox(width: 220, height: 150),
          ),
        ),
      );
    }
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(color: c.surface, borderRadius: BorderRadius.circular(12)),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(att.type == 'image' ? Ionicons.imageOutline : Ionicons.documentText, size: 24, color: c.primaryDark),
          const SizedBox(width: 8),
          Flexible(child: Text(att.name ?? '', style: TextStyle(fontSize: 14, color: c.textPrimary))),
        ],
      ),
    );
  }

  List<Widget> _aiContent(AppColors c, String text, double bubbleWidth) {
    if (_isHTML(text)) return [ChatMarkdown(data: htmlToMarkdown(text), bubbleWidth: bubbleWidth)];
    return [
      for (final part in splitDiagrams(text))
        part.type == MessagePartType.svg
            ? ChatDiagram(xml: part.content, width: bubbleWidth)
            : ChatMarkdown(data: part.content, bubbleWidth: bubbleWidth),
    ];
  }

  /// Contenu d'une bulle. S'il ne peut pas être préparé, on montre un texte simple.
  Widget _bubbleContent(AppColors c, _Message message, double bubbleWidth) {
    try {
      final isUser = message.type == 'user';
      final children = <Widget>[
        for (final att in message.attachments ?? const <_Attachment>[])
          Padding(padding: const EdgeInsets.only(bottom: 8), child: _attachmentPreview(c, att)),
        if (!isUser && message.error)
          Semantics(
            liveRegion: true,
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(Ionicons.alertCircle, size: 18, color: c.dangerText),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(message.text,
                      style: TextStyle(fontSize: 15, height: 21 / 15, fontWeight: FontWeight.w500, color: c.dangerText)),
                ),
              ],
            ),
          )
        else if (!isUser)
          ..._aiContent(c, message.text, bubbleWidth)
        else
          Text(message.text, style: TextStyle(fontSize: 15, height: 22 / 15, color: c.textPrimary)),
      ];
      final column = Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: children,
      );
      // Bulle utilisateur : aussi large que son contenu (jusqu'à 80 %).
      return isUser ? IntrinsicWidth(child: column) : column;
    } catch (_) {
      return Text(message.text, style: TextStyle(color: c.textPrimary));
    }
  }

  Widget _messageAction(AppColors c,
      {required IconData icon,
      required String text,
      required String label,
      required VoidCallback? onTap,
      Color? color}) {
    final fg = color ?? c.primaryText;
    return Align(
      alignment: Alignment.centerLeft,
      child: Padding(
        padding: const EdgeInsets.only(top: 6),
        child: Tappable(
          onTap: onTap,
          semanticLabel: label,
          child: Container(
            constraints: const BoxConstraints(minHeight: 40),
            padding: const EdgeInsets.symmetric(horizontal: 12),
            decoration: BoxDecoration(
              color: c.surface,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: c.border),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(icon, size: 16, color: fg),
                const SizedBox(width: 6),
                Text(text, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: fg)),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _messageRow(AppColors c, _Message message, int index, int count, double contentWidth, double bubbleWidth) {
    final isUser = message.type == 'user';
    final isAi = message.type == 'ai';
    const tail = Radius.circular(6);
    const round = Radius.circular(18);
    final BoxDecoration decoration;
    final EdgeInsets padding;
    if (isUser) {
      // Bulle utilisateur en bleu très clair + texte foncé : le bleu plein est réservé à « Envoyer ».
      decoration = BoxDecoration(
        color: c.tintPrimary,
        borderRadius: const BorderRadius.only(topLeft: round, topRight: round, bottomLeft: round, bottomRight: tail),
      );
      padding = const EdgeInsets.symmetric(horizontal: 16, vertical: 12);
    } else if (message.error) {
      decoration = BoxDecoration(
        color: c.tintDanger,
        borderRadius: const BorderRadius.only(topLeft: tail, topRight: round, bottomLeft: round, bottomRight: round),
      );
      padding = const EdgeInsets.all(14);
    } else {
      decoration = BoxDecoration(
        color: c.surface,
        border: Border.all(color: c.border),
        borderRadius: const BorderRadius.only(topLeft: tail, topRight: round, bottomLeft: round, bottomRight: round),
      );
      padding = const EdgeInsets.all(16);
    }

    final bubble = Container(
      constraints: isUser ? BoxConstraints(maxWidth: contentWidth * 0.8) : null,
      padding: padding,
      decoration: decoration,
      child: _bubbleContent(c, message, bubbleWidth),
    );

    return _FadeIn(
      key: ValueKey(index),
      delay: Duration(milliseconds: index * 100),
      child: Column(
        crossAxisAlignment: isUser ? CrossAxisAlignment.end : CrossAxisAlignment.stretch,
        children: [
          bubble,
          if (isAi && message.error && index == count - 1) ...[
            const SizedBox(height: 4),
            _messageAction(
              c,
              icon: Ionicons.refresh,
              text: 'Réessayer',
              label: 'Renvoyer la question',
              onTap: _isTyping ? null : _retryLastMessage,
            ),
          ],
          if (isAi && !message.error && worthFlashcards(message.text)) ...[
            const SizedBox(height: 4),
            _messageAction(
              c,
              icon: Ionicons.albumsOutline,
              text: 'Créer des flashcards',
              label: 'Créer des flashcards à partir de cette réponse',
              onTap: () => _openFlashcards(stripDiagrams(message.text)),
            ),
          ],
          if (isAi && !message.error && message.text.length >= 40) ...[
            const SizedBox(height: 4),
            _messageAction(
              c,
              icon: Ionicons.flagOutline,
              text: 'Signaler une erreur',
              label: 'Signaler une erreur dans cette réponse',
              color: c.textSecondary,
              onTap: () => showReportErrorSheet(context, ReportTarget(kind: 'chat', excerpt: stripDiagrams(message.text))),
            ),
          ],
          const SizedBox(height: 4),
          Text(_formatTime(message.timestamp), style: TextStyle(fontSize: 11, color: c.textSecondary)),
        ],
      ),
    );
  }

  void _openFlashcards(String text) {
    showFlashcardsFromChatSheet(
      context,
      text: text,
      onAdded: (count, courseName) {
        logEvent('chat_flashcards_added', '$count');
        if (!mounted) return;
        _showToast(
          '$count flashcard${count > 1 ? 's' : ''} ajoutée${count > 1 ? 's' : ''} à « $courseName »',
          icon: Ionicons.checkmarkCircle,
          duration: const Duration(milliseconds: 4000),
        );
      },
    );
  }

  Widget _typingBubble(AppColors c) {
    Widget dot(double opacity) => Container(
          width: 8,
          height: 8,
          decoration: BoxDecoration(color: c.primaryDark.withValues(alpha: opacity), shape: BoxShape.circle),
        );
    return _FadeIn(
      key: const ValueKey('typing'),
      child: Align(
        alignment: Alignment.centerLeft,
        child: Semantics(
          label: "L'assistant écrit une réponse",
          excludeSemantics: true,
          child: Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: c.surface,
              border: Border.all(color: c.border),
              borderRadius: const BorderRadius.only(
                topLeft: Radius.circular(6),
                topRight: Radius.circular(18),
                bottomLeft: Radius.circular(18),
                bottomRight: Radius.circular(18),
              ),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [dot(0.5), const SizedBox(width: 4), dot(0.7), const SizedBox(width: 4), dot(1)],
            ),
          ),
        ),
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // Zone de saisie
  // ---------------------------------------------------------------------------

  Widget _attachMenu(AppColors c) {
    Widget item(IconData icon, String text, String label, VoidCallback onTap) => Tappable(
          onTap: onTap,
          semanticLabel: label,
          child: Container(
            constraints: const BoxConstraints(minHeight: 44),
            padding: const EdgeInsets.symmetric(horizontal: 12),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(icon, size: 22, color: c.primaryDark),
                const SizedBox(width: 12),
                Text(text, style: TextStyle(fontSize: 16, color: c.textPrimary)),
              ],
            ),
          ),
        );
    return Align(
      alignment: Alignment.centerLeft,
      child: Container(
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.all(6),
        decoration: BoxDecoration(
          color: c.surface,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: c.border),
          boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.1), blurRadius: 8, offset: const Offset(0, 4))],
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            item(Ionicons.imageOutline, 'Image', 'Ajouter une image', _pickImage),
            item(Ionicons.documentOutline, 'Document', 'Ajouter un document', _pickDocument),
          ],
        ),
      ),
    );
  }

  Widget _pendingAttachments(AppColors c) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      clipBehavior: Clip.none,
      padding: const EdgeInsets.only(top: 6, bottom: 8),
      child: Row(
        children: [
          for (var index = 0; index < _attachments.length; index++) ...[
            if (index > 0) const SizedBox(width: 8),
            Stack(
              clipBehavior: Clip.none,
              children: [
                Container(
                  width: 70,
                  height: 70,
                  clipBehavior: Clip.antiAlias,
                  decoration: BoxDecoration(color: c.surfaceAlt, borderRadius: BorderRadius.circular(12)),
                  child: _attachments[index].type == 'image'
                      ? Semantics(
                          image: true,
                          label: 'Image à envoyer : ${_attachments[index].name ?? ''}',
                          child: Image.file(
                            File(_attachments[index].uri),
                            fit: BoxFit.cover,
                            excludeFromSemantics: true,
                            errorBuilder: (_, __, ___) => const SizedBox.shrink(),
                          ),
                        )
                      : Center(child: Icon(Ionicons.documentText, size: 30, color: c.primaryDark)),
                ),
                Positioned(
                  top: -6,
                  right: -6,
                  child: Tappable(
                    onTap: () {
                      final i = index;
                      setState(() => _attachments = [
                            for (var j = 0; j < _attachments.length; j++)
                              if (j != i) _attachments[j],
                          ]);
                    },
                    semanticLabel: 'Retirer la pièce jointe',
                    child: Container(
                      decoration: BoxDecoration(color: c.surface, borderRadius: BorderRadius.circular(11)),
                      child: Icon(Ionicons.closeCircle, size: 22, color: c.danger),
                    ),
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }

  Widget _dictationBar(AppColors c) {
    final recording = _dictation.state == DictationState.recording;
    final seconds = _dictation.seconds;
    final textStyle = TextStyle(
      fontSize: 15,
      fontWeight: FontWeight.w500,
      color: c.textPrimary,
      fontFeatures: const [FontFeature.tabularFigures()],
    );
    return Semantics(
      liveRegion: true,
      child: Container(
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.only(left: 16, right: 6),
        constraints: const BoxConstraints(minHeight: 52),
        decoration: BoxDecoration(
          color: c.surface,
          borderRadius: BorderRadius.circular(26),
          border: Border.all(color: c.border),
        ),
        child: Row(
          children: recording
              ? [
                  Container(
                    width: 10,
                    height: 10,
                    decoration: BoxDecoration(color: c.danger, shape: BoxShape.circle),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      'Je t’écoute… ${seconds ~/ 60}:${(seconds % 60).toString().padLeft(2, '0')}',
                      style: textStyle,
                    ),
                  ),
                  const SizedBox(width: 10),
                  Tappable(
                    onTap: _dictation.cancel,
                    semanticLabel: 'Annuler la dictée',
                    child: SizedBox(
                        width: 40, height: 40, child: Icon(Ionicons.close, size: 20, color: c.textSecondary)),
                  ),
                  const SizedBox(width: 10),
                  Tappable(
                    onTap: _dictation.stop,
                    semanticLabel: 'Terminer la dictée',
                    child: Container(
                      width: 40,
                      height: 40,
                      decoration: BoxDecoration(color: c.action, shape: BoxShape.circle),
                      child: Icon(Ionicons.checkmark, size: 20, color: c.onAction),
                    ),
                  ),
                ]
              : [
                  SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(strokeWidth: 2.5, color: c.primaryDark),
                  ),
                  const SizedBox(width: 10),
                  Expanded(child: Text('Transcription…', style: textStyle)),
                ],
        ),
      ),
    );
  }

  Widget _chatBar(AppColors c) {
    final canSend = _input.text.trim().isNotEmpty || _attachments.isNotEmpty;
    final dictationIdle = _dictation.state == DictationState.idle;
    final recording = _dictation.state == DictationState.recording;
    // Capsule dans capsule : rayon extérieur 28 = rayon intérieur 22 + padding 6
    return Container(
      padding: const EdgeInsets.all(6),
      decoration: BoxDecoration(
        color: c.surface,
        borderRadius: BorderRadius.circular(28),
        border: Border.all(color: c.border),
        boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.06), blurRadius: 12, offset: const Offset(0, 4))],
      ),
      child: Row(
        children: [
          Expanded(
            child: Container(
              constraints: const BoxConstraints(minHeight: 44),
              padding: const EdgeInsets.only(left: 6, right: 14),
              decoration: BoxDecoration(color: c.surfaceAlt, borderRadius: BorderRadius.circular(22)),
              child: Row(
                children: [
                  Semantics(
                    expanded: _isAttachMenuOpen,
                    child: Tappable(
                      onTap: () => setState(() => _isAttachMenuOpen = !_isAttachMenuOpen),
                      semanticLabel: 'Joindre un fichier',
                      child: SizedBox(
                          width: 32, height: 44, child: Icon(Ionicons.attach, size: 20, color: c.textSecondary)),
                    ),
                  ),
                  const SizedBox(width: 4),
                  Expanded(
                    child: Semantics(
                      label: "Message à l'assistant IA",
                      child: ConstrainedBox(
                        constraints: const BoxConstraints(maxHeight: 100),
                        child: TextField(
                          controller: _input,
                          focusNode: _inputFocus,
                          minLines: 1,
                          maxLines: null,
                          keyboardType: TextInputType.multiline,
                          textInputAction: TextInputAction.newline,
                          inputFormatters: [LengthLimitingTextInputFormatter(2000)],
                          style: TextStyle(fontSize: 16, color: c.textPrimary),
                          decoration: InputDecoration(
                            isDense: true,
                            border: InputBorder.none,
                            hintText: 'Écris ta question…',
                            hintStyle: TextStyle(fontSize: 16, color: c.textSecondary),
                            contentPadding: const EdgeInsets.symmetric(vertical: 10),
                          ),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 4),
                  Tappable(
                    onTap: dictationIdle ? _dictation.start : null,
                    semanticLabel: 'Dicter ta question',
                    child: SizedBox(
                      width: 32,
                      height: 44,
                      child: Icon(
                        recording ? Ionicons.mic : Ionicons.micOutline,
                        size: 20,
                        color: recording ? c.danger : c.textSecondary,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(width: 6),
          Opacity(
            opacity: canSend ? 1 : 0.5,
            child: Tappable(
              onTap: canSend ? () => _sendMessage() : null,
              semanticLabel: 'Envoyer',
              child: Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(color: c.action, shape: BoxShape.circle),
                child: Icon(Ionicons.arrowForward, size: 22, color: c.onAction),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _inputArea(AppColors c) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // Menu d'attachement
        AnimatedSwitcher(
          duration: const Duration(milliseconds: 150),
          child: _isAttachMenuOpen ? _attachMenu(c) : const SizedBox.shrink(),
        ),
        // Pièces jointes en attente
        if (_attachments.isNotEmpty) _pendingAttachments(c),
        if (_dictation.state != DictationState.idle) _dictationBar(c),
        _chatBar(c),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final insets = ScreenInsets.of(context);
    final keyboard = MediaQuery.viewInsetsOf(context).bottom;
    final width = MediaQuery.sizeOf(context).width;
    final conv = _currentConv;
    final messages = conv?.messages ?? const <_Message>[];
    final isTyping = _isTyping;
    // Largeur utile d'une bulle de réponse (schémas, tableaux).
    final bubbleWidth = math.min(width * 0.8, 520.0) - 48;
    final contentWidth = width - 40;

    final scrollKey = '${conv?.messages.length}:$isTyping';
    if (scrollKey != _scrollKey) {
      _scrollKey = scrollKey;
      Future.delayed(const Duration(milliseconds: 200), _scrollToEnd);
    }

    // Clavier ouvert : la zone de saisie se pose juste au-dessus. (L'app RN
    // ajoutait 90 px sur iOS, un décalage jamais vu à l'écran : elle n'était
    // publiée que sur Android, où il valait 0.)
    final inputBottom = keyboard > 0 ? math.max(insets.tabBar + 14, keyboard + 12) : insets.tabBar + 14;

    return ColoredBox(
      color: c.background,
      child: Stack(
        children: [
          Padding(
            padding: EdgeInsets.only(top: insets.top - 12),
            child: Column(
              children: [
                // Header
                Padding(
                  padding: const EdgeInsets.fromLTRB(20, 12, 20, 8),
                  child: Row(
                    children: [
                      CircleIconButton(
                        icon: Ionicons.menu,
                        label: 'Historique des conversations',
                        onPressed: _openHistory,
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Semantics(
                          header: true,
                          child: Text(
                            conv != null && conv.title.isNotEmpty ? conv.title : 'Assistant Médical',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600, color: c.textPrimary),
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      CircleIconButton(
                        icon: Ionicons.createOutline,
                        label: 'Nouvelle conversation',
                        onPressed: () => _createNewConversation(announce: true),
                      ),
                    ],
                  ),
                ),

                // Messages
                Expanded(
                  child: Padding(
                    padding: EdgeInsets.only(bottom: insets.tabBar + 72),
                    // Toucher hors d'un bouton ferme le clavier (keyboardShouldPersistTaps="handled").
                    child: GestureDetector(
                      behavior: HitTestBehavior.translucent,
                      onTap: () => FocusScope.of(context).unfocus(),
                      child: ScrollConfiguration(
                        behavior: ScrollConfiguration.of(context).copyWith(scrollbars: false),
                        child: SingleChildScrollView(
                          controller: _scroll,
                          padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              if (conv != null && conv.messages.isEmpty)
                                _emptyState(c)
                              else
                                for (var i = 0; i < messages.length; i++) ...[
                                  if (i > 0) const SizedBox(height: 16),
                                  _messageRow(c, messages[i], i, messages.length, contentWidth, bubbleWidth),
                                ],
                              if (isTyping) ...[
                                if (messages.isNotEmpty) const SizedBox(height: 16),
                                _typingBubble(c),
                              ],
                            ],
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),

          // Input area
          if (_currentConvId != null)
            Positioned(left: 20, right: 20, bottom: inputBottom, child: _inputArea(c)),

          Positioned(
            left: 16,
            right: 16,
            bottom: insets.tabBar + 84,
            child: IgnorePointer(
              child: AnimatedSwitcher(
                duration: const Duration(milliseconds: 300),
                child: _toast == null
                    ? const SizedBox.shrink()
                    : Center(
                        key: ValueKey(_toast),
                        child: Semantics(
                          liveRegion: true,
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                            decoration: BoxDecoration(color: c.textPrimary, borderRadius: BorderRadius.circular(999)),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(_toast!.icon, size: 16, color: c.background),
                                const SizedBox(width: 10),
                                Flexible(
                                  child: Text(_toast!.text,
                                      style: TextStyle(fontSize: 14, fontWeight: FontWeight.w500, color: c.background)),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Apparition en fondu, éventuellement retardée (FadeIn.delay de reanimated).
class _FadeIn extends StatefulWidget {
  final Duration delay;
  final Widget child;
  const _FadeIn({super.key, this.delay = Duration.zero, required this.child});

  @override
  State<_FadeIn> createState() => _FadeInState();
}

class _FadeInState extends State<_FadeIn> with SingleTickerProviderStateMixin {
  late final AnimationController _controller =
      AnimationController(vsync: this, duration: const Duration(milliseconds: 300));
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    if (widget.delay == Duration.zero) {
      _controller.forward();
    } else {
      _timer = Timer(widget.delay, () {
        if (mounted) _controller.forward();
      });
    }
  }

  @override
  void dispose() {
    _timer?.cancel();
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => FadeTransition(opacity: _controller, child: widget.child);
}

/// Apparition par agrandissement (ZoomIn.duration(250) de reanimated).
class _ZoomIn extends StatefulWidget {
  final Widget child;
  const _ZoomIn({super.key, required this.child});

  @override
  State<_ZoomIn> createState() => _ZoomInState();
}

class _ZoomInState extends State<_ZoomIn> with SingleTickerProviderStateMixin {
  late final AnimationController _controller =
      AnimationController(vsync: this, duration: const Duration(milliseconds: 250))..forward();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) =>
      ScaleTransition(scale: CurvedAnimation(parent: _controller, curve: Curves.easeOut), child: widget.child);
}
