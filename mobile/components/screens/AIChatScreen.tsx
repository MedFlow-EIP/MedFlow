import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  FlatList,
  StyleSheet,
  Modal,
  Image,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  Keyboard,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Speech from "expo-speech";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system";
import { getAuthHeaders } from "../../utils/authHeaders";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation, useFocusEffect, useRoute } from "@react-navigation/native";
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Svg, { Path as SvgPath } from 'react-native-svg';
import Animated, { FadeIn, FadeOut, SlideInLeft, ZoomIn } from 'react-native-reanimated';

import { API_URL } from '@/services/api';
import { auth } from '../../firebaseConfig';
import Markdown from 'react-native-markdown-display';
import RenderHTML from 'react-native-render-html';
import { useWindowDimensions } from "react-native";
import { useTheme } from '../../theme/ThemeContext';
import type { ThemeColors } from '../../theme/colors';
import { logScreenView } from '../../utils/analytics';

import { useScreenInsets } from '../navigation/constants';
import { appAlert } from '../../utils/appAlert';
import { errorMessage, fetchWithTimeout, httpErrorMessage } from '../../utils/network';
import { FlashcardsFromChatSheet } from '../chat/FlashcardsFromChatSheet';
import { useVoiceDictation } from '../../utils/voiceDictation';
import { splitDiagrams, stripDiagrams } from '../../utils/diagrams';
import { tableColumnWidth, worthFlashcards } from '../../utils/chatAnswers';
import { ChatDiagram } from '../chat/ChatDiagram';

type Message = {
  type: "user" | "ai";
  text: string;
  attachments?: {
    type: "image" | "file";
    uri: string;
    name?: string;
  }[];
  timestamp: number;
  /** Réponse non obtenue (réseau, quota…) : affichée en erreur avec « Réessayer ». */
  error?: boolean;
};

type Conversation = {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  /** Identifiant de la conversation côté serveur : permet à l'IA de garder le fil. */
  serverId?: string;
};

type PendingAttachment = {
  type: "image" | "file";
  uri: string;
  name?: string;
  mimeType: string;
};

// Mêmes limites que le backend (/chat).
const MAX_ATTACHMENT_BYTES = 7 * 1024 * 1024;
const MAX_ATTACHMENTS = 3;

type RootStackParamList = {
  MainTabs: undefined;
  AIChat: { prompt?: string } | undefined;
  UploadCourse: undefined;
};

// Une réponse peut être longue à générer, mais jamais d'attente infinie.
const CHAT_TIMEOUT_MS = 90_000;

const { height } = Dimensions.get('window');

// Ancienne clé commune à tous les comptes du téléphone : un compte voyait les
// conversations d'un autre. Elle est supprimée au chargement.
const LEGACY_STORAGE_KEY = "@ai_conversations";

/** Historique stocké par utilisateur Firebase. */
const storageKey = (uid: string) => `@ai_conversations:${uid}`;

type ServerConversation = {
  conversation_id: string;
  title: string;
  created_at: string;
  messages: { sender: 'user' | 'ai'; content: string; attachments?: { name?: string; mime_type?: string }[]; created_at: string }[];
};

/** Dates SQLite (« 2026-10-27 14:03:00 », en UTC) → millisecondes. */
const parseServerDate = (value: string) => {
  const ms = Date.parse(value.replace(' ', 'T') + 'Z');
  return Number.isNaN(ms) ? Date.now() : ms;
};

/** Conversations enregistrées sur le serveur, ou null hors ligne. */
async function fetchServerConversations(): Promise<ServerConversation[] | null> {
  try {
    const user = auth.currentUser;
    if (!user) return null;
    const res = await fetch(`${API_URL}/chat/conversations`, { headers: await getAuthHeaders(user) });
    if (!res.ok) return null;
    const data = await res.json();
    return Array.isArray(data?.conversations) ? data.conversations : null;
  } catch {
    return null;
  }
}

/**
 * Le serveur fait foi pour les conversations qu'il connaît (même compte sur un
 * autre téléphone). On garde la copie locale quand elle est à jour, car elle
 * contient les aperçus des pièces jointes que le serveur ne stocke pas.
 */
/** Isole chaque message : s'il ne peut pas s'afficher, on montre un texte simple. */
class MessageBoundary extends React.Component<{ text: string; color: string; children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? <Text style={{ color: this.props.color }}>{this.props.text}</Text> : this.props.children;
  }
}

function mergeWithServer(local: Conversation[], server: ServerConversation[] | null): Conversation[] {
  if (!server) return local;
  const serverIds = new Set(server.map((s) => s.conversation_id));
  const byServerId = new Map(local.filter((c) => c.serverId).map((c) => [c.serverId as string, c]));

  const fromServer = server.map((s): Conversation => {
    const existing = byServerId.get(s.conversation_id);
    if (existing && existing.messages.length >= s.messages.length) return existing;
    return {
      id: existing?.id ?? s.conversation_id,
      serverId: s.conversation_id,
      title: s.title || 'Conversation',
      createdAt: parseServerDate(s.created_at),
      messages: s.messages.map((m, i) => ({
        type: m.sender,
        text: m.content,
        timestamp: parseServerDate(m.created_at),
        attachments:
          existing?.messages[i]?.attachments ??
          (m.attachments?.length
            ? m.attachments.map((a) => ({
                type: a.mime_type?.startsWith('image/') ? ('image' as const) : ('file' as const),
                uri: '',
                name: a.name,
              }))
            : undefined),
      })),
    };
  });

  // Conversations pas encore envoyées (vides) : gardées. Celles supprimées
  // depuis un autre appareil : retirées.
  const localOnly = local.filter((c) => !c.serverId);
  return [...fromServer, ...localOnly.filter((c) => !serverIds.has(c.id))];
}

const SUGGESTIONS = [
  "Résume les points clés de mon dernier cours",
  "Fais-moi un quiz sur les os du crâne",
  "Fais-moi un schéma du cycle cardiaque",
];

export function AIChatScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { top, tabBarHeight } = useScreenInsets();

  useEffect(() => {
    logScreenView('AIChatScreen');
  }, []);

  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [input, setInput] = useState("");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConvId, setCurrentConvId] = useState<string | null>(null);
  const [isHistoryVisible, setIsHistoryVisible] = useState(false);
  const [isAISpeaking, setIsAISpeaking] = useState(false);
  const [attachments, setAttachments] = useState<any[]>([]);
  // Conversations qui attendent une réponse : changer de conversation ne
  // doit pas y afficher les « … » d'une autre.
  const [pendingConvs, setPendingConvs] = useState<Set<string>>(() => new Set());
  const isTyping = !!currentConvId && pendingConvs.has(currentConvId);
  // Conversation affichée au moment où la réponse arrive (lecture vocale).
  const currentConvIdRef = useRef(currentConvId);
  currentConvIdRef.current = currentConvId;
  const setPending = (convId: string, pending: boolean) =>
    setPendingConvs((prev) => {
      const next = new Set(prev);
      if (pending) next.add(convId);
      else next.delete(convId);
      return next;
    });
  const [isLoading, setIsLoading] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [isAttachMenuOpen, setIsAttachMenuOpen] = useState(false);
  const [toast, setToast] = useState<{ text: string; icon: keyof typeof Ionicons.glyphMap } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Texte d'une réponse à transformer en flashcards (feuille ouverte si non nul).
  const [flashcardSource, setFlashcardSource] = useState<string | null>(null);

  // Question envoyée par un autre écran (« Explique-moi cette carte »).
  const route = useRoute<any>();
  const promptParamRef = useRef<string | undefined>(undefined);
  promptParamRef.current = route.params?.prompt;
  const [pendingPrompt, setPendingPrompt] = useState<string | null>(null);

  const scrollViewRef = useRef<ScrollView>(null);
  const inputRef = useRef<TextInput>(null);

  // Dictée vocale (F45) : le texte retranscrit s'ajoute au champ, à relire avant d'envoyer.
  const dictation = useVoiceDictation(
    (text) => {
      setInput((prev) => (prev.trim() ? `${prev.trimEnd()} ${text}` : text).slice(0, 2000));
      inputRef.current?.focus();
    },
    (message) => appAlert('Dictée', message)
  );

  const { width } = useWindowDimensions();
  // Largeur utile d'une bulle de réponse (schémas, tableaux).
  const bubbleWidth = Math.min(width * 0.8, 520) - 48;

  const currentConv = conversations.find((c) => c.id === currentConvId);

  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      'keyboardDidShow',
      (e) => {
        setKeyboardHeight(e.endCoordinates.height);
      }
    );
    const keyboardDidHideListener = Keyboard.addListener(
      'keyboardDidHide',
      () => {
        setKeyboardHeight(0);
      }
    );

    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      // Après le chargement, sinon il remplacerait la nouvelle conversation.
      loadConversations().then(() => {
        const prompt = promptParamRef.current;
        if (!active || !prompt) return;
        (navigation as any).setParams({ prompt: undefined });
        createNewConversation();
        setPendingPrompt(prompt);
      });
      return () => {
        active = false;
      };
    }, [])
  );

  const loadConversations = async () => {
    try {
      const uid = auth.currentUser?.uid;
      if (!uid) return;
      await AsyncStorage.removeItem(LEGACY_STORAGE_KEY);
      const stored = await AsyncStorage.getItem(storageKey(uid));
      // Affiche tout de suite la copie locale (aussi hors ligne)...
      const local: Conversation[] = stored ? JSON.parse(stored) : [];
      const merged = mergeWithServer(local, await fetchServerConversations());
      const sorted = merged.sort((a, b) => b.createdAt - a.createdAt);
      setConversations(sorted);
      if (sorted.length > 0) {
        setCurrentConvId((prev) => (prev && sorted.some((c) => c.id === prev) ? prev : sorted[0].id));
      } else {
        createNewConversation();
      }
    } catch (error) {
      console.error('Erreur chargement conversations:', error);
    }
  };

  useEffect(() => {
    if (conversations.length > 0) {
      const uid = auth.currentUser?.uid;
      if (uid) AsyncStorage.setItem(storageKey(uid), JSON.stringify(conversations));
    }
  }, [conversations]);

  useEffect(() => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 200);
  }, [currentConv?.messages.length, isTyping]);

  const showToast = (message: string, icon: keyof typeof Ionicons.glyphMap = 'create-outline', duration = 2000) => {
    setToast({ text: message, icon });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), duration);
  };

  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
  }, []);

  const createNewConversation = (announce = false) => {
    const newConv: Conversation = {
      id: Date.now().toString(),
      title: "Nouvelle conversation",
      messages: [],
      createdAt: Date.now(),
    };
    setConversations(prev => [newConv, ...prev]);
    setCurrentConvId(newConv.id);
    setAttachments([]);
    setInput("");
    setIsHistoryVisible(false);
    setIsAttachMenuOpen(false);
    if (announce) showToast("Nouvelle conversation démarrée");
  };

  const generateTitle = (messages: Message[]): string => {
    const firstUserMsg = messages.find(m => m.type === "user");
    if (firstUserMsg?.text) {
      return firstUserMsg.text.length > 30
        ? firstUserMsg.text.substring(0, 30) + "..."
        : firstUserMsg.text;
    }
    return "Nouvelle conversation";
  };

  const askMedicalAI = async (
    message: string,
    serverId: string | undefined,
    files: PendingAttachment[]
  ): Promise<{ response: string; conversationId?: string; title?: string; error?: boolean }> => {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("Non connecté");

      // Les fichiers partent en base64 ; le serveur les transmet au modèle sans les stocker.
      const attachmentsPayload = await Promise.all(
        files.map(async (f) => ({
          name: f.name,
          mime_type: f.mimeType,
          data: await FileSystem.readAsStringAsync(f.uri, { encoding: FileSystem.EncodingType.Base64 }),
        }))
      );

      const response = await fetchWithTimeout(
        `${API_URL}/chat`,
        {
          method: "POST",
          headers: {
            ...(await getAuthHeaders(user)),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message,
            conversation_id: serverId,
            attachments: attachmentsPayload,
          }),
        },
        CHAT_TIMEOUT_MS
      );

      const data = await response.json().catch(() => ({}));
      if (!response.ok || typeof data?.response !== "string") {
        return {
          response: httpErrorMessage(response.status, data, "L'assistant n'a pas pu répondre. Réessaie dans un instant."),
          error: true,
        };
      }

      return {
        response: data.response,
        conversationId: data.conversation_id,
        title: typeof data.title === "string" && data.title ? data.title : undefined,
      };
    } catch (error) {
      console.error("Erreur AI:", error);

      return {
        response: errorMessage(error, "L'assistant n'a pas pu répondre. Réessaie dans un instant."),
        error: true,
      };
    }
  };

  const sendMessage = async (textOverride?: string, filesOverride?: PendingAttachment[]) => {
    const text = textOverride ?? input;
    const outgoing = filesOverride ?? (attachments as PendingAttachment[]);
    const convId = currentConvId;
    if ((!text.trim() && outgoing.length === 0) || !convId || pendingConvs.has(convId)) return;

    const userMessage: Message = {
      type: "user",
      text,
      attachments: outgoing.length > 0 ? [...outgoing] : undefined,
      timestamp: Date.now(),
    };

    setConversations(prev =>
      prev.map(c =>
        c.id === currentConvId
          ? {
              ...c,
              messages: [...c.messages, userMessage],
              title: c.messages.length === 0 ? generateTitle([userMessage]) : c.title,
            }
          : c
      )
    );

    const files = [...outgoing];
    const serverId = conversations.find((c) => c.id === currentConvId)?.serverId;

    if (!filesOverride) {
      setInput("");
      setAttachments([]);
    }
    setIsAttachMenuOpen(false);
    setPending(convId, true);

    try {
      const { response: aiResponse, conversationId, title, error } = await askMedicalAI(text, serverId, files);

      setPending(convId, false);

      const aiMessage: Message = {
        type: "ai",
        text: aiResponse,
        timestamp: Date.now(),
        error,
      };

      setConversations(prev =>
        prev.map(c =>
          c.id === convId
            ? { ...c, serverId: conversationId ?? c.serverId, title: title ?? c.title, messages: [...c.messages, aiMessage] }
            : c
        )
      );

      if (isAISpeaking && !error && convId === currentConvIdRef.current) {
        Speech.speak(stripDiagrams(aiResponse), {
          language: "fr",
          pitch: 1,
          rate: 0.9,
        });
      }
    } catch (error) {
      setPending(convId, false);

      appAlert(
        "Erreur",
        "Impossible de contacter l'assistant médical."
      );
    }
  };

  // Envoie la question reçue d'un autre écran dès que la conversation vide est prête.
  useEffect(() => {
    if (pendingPrompt && currentConv && currentConv.messages.length === 0) {
      const prompt = pendingPrompt;
      setPendingPrompt(null);
      sendMessage(prompt, []);
    }
  }, [pendingPrompt, currentConv?.id]);

  /** Renvoie la dernière question restée sans réponse (message d'erreur retiré). */
  const retryLastMessage = () => {
    const messages = currentConv?.messages ?? [];
    const failed = messages[messages.length - 1];
    const question = messages[messages.length - 2];
    if (!failed?.error || question?.type !== "user" || isTyping) return;

    setConversations((prev) =>
      prev.map((c) => (c.id === currentConvId ? { ...c, messages: c.messages.slice(0, -2) } : c))
    );
    // Pièces jointes venues d'un autre appareil (sans fichier local) : non renvoyées.
    sendMessage(question.text, (question.attachments ?? []).filter((a) => !!a.uri) as PendingAttachment[]);
  };

  const deleteConversation = (convId: string) => {
    appAlert(
      "Supprimer la conversation",
      "Cette action est irréversible.",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Supprimer",
          style: "destructive",
          onPress: () => {
            // Supprimée aussi côté serveur, sinon elle reviendrait à la prochaine synchro.
            const serverId = conversations.find((c) => c.id === convId)?.serverId;
            const user = auth.currentUser;
            if (serverId && user) {
              getAuthHeaders(user)
                .then((headers) => fetch(`${API_URL}/chat/conversations/${serverId}`, { method: 'DELETE', headers }))
                .catch(() => {});
            }
            setConversations(prev => {
              const filtered = prev.filter(c => c.id !== convId);

              const uid = auth.currentUser?.uid;
              if (uid) AsyncStorage.setItem(storageKey(uid), JSON.stringify(filtered));

              if (currentConvId === convId) {
                if (filtered.length > 0) {
                  setCurrentConvId(filtered[0].id);
                } else {
                  const newConv: Conversation = {
                    id: Date.now().toString(),
                    title: "Nouvelle conversation",
                    messages: [],
                    createdAt: Date.now(),
                  };
                  setCurrentConvId(newConv.id);
                  return [newConv];
                }
              }

              return filtered;
            });
          }
        }
      ]
    );
  };

  const selectConversation = (convId: string) => {
    setCurrentConvId(convId);
    setIsHistoryVisible(false);
    setAttachments([]);
    setInput("");
  };

  // Vérifie le nombre et la taille avant d'ajouter une pièce jointe (mêmes règles que le serveur).
  const addAttachment = (attachment: PendingAttachment, size?: number | null) => {
    if (attachments.length >= MAX_ATTACHMENTS) {
      appAlert("Trop de fichiers", `${MAX_ATTACHMENTS} pièces jointes maximum par message.`);
      return;
    }
    if (size && size > MAX_ATTACHMENT_BYTES) {
      appAlert("Fichier trop lourd", "Chaque pièce jointe doit faire 7 Mo maximum.");
      return;
    }
    setAttachments([...attachments, attachment]);
  };

  const pickImage = async () => {
    setIsAttachMenuOpen(false);
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.7,
    });
    if (!result.canceled) {
      const asset = result.assets[0];
      const mimeType = asset.mimeType && asset.mimeType.startsWith("image/") ? asset.mimeType : "image/jpeg";
      addAttachment({ type: 'image', uri: asset.uri, name: asset.fileName || 'Image', mimeType }, asset.fileSize);
    }
  };

  const pickDocument = async () => {
    setIsAttachMenuOpen(false);
    const result = await DocumentPicker.getDocumentAsync({
      type: ["application/pdf", "image/jpeg", "image/png", "image/webp"],
      copyToCacheDirectory: true,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      addAttachment(
        { type: 'file', uri: asset.uri, name: asset.name, mimeType: asset.mimeType || "application/pdf" },
        asset.size
      );
    }
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  };

  const isHTML = (text: string) =>
  text.trim().startsWith("<") && text.includes("</");

  // Conversations groupées par date dans le tiroir d'historique.
  const historySections = useMemo(() => {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const today = startOfToday.getTime();
    const weekAgo = today - 6 * 24 * 60 * 60 * 1000;
    const groups: { title: string; items: Conversation[] }[] = [
      { title: "AUJOURD’HUI", items: [] },
      { title: "CETTE SEMAINE", items: [] },
      { title: "PLUS ANCIEN", items: [] },
    ];
    for (const conv of conversations) {
      const bucket = conv.createdAt >= today ? 0 : conv.createdAt >= weekAgo ? 1 : 2;
      groups[bucket].items.push(conv);
    }
    return groups.filter((g) => g.items.length > 0);
  }, [conversations]);

  const canSend = !!input.trim() || attachments.length > 0;

  return (
    <View style={[styles.container, { paddingTop: top - 12 }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => setIsHistoryVisible(true)}
          accessibilityRole="button"
          accessibilityLabel="Historique des conversations"
        >
          <Ionicons name="menu" size={22} color={colors.textPrimary} />
        </TouchableOpacity>

        <Text style={styles.headerTitle} numberOfLines={1} accessibilityRole="header">
          {currentConv?.title || "Assistant Médical"}
        </Text>

        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => createNewConversation(true)}
          accessibilityRole="button"
          accessibilityLabel="Nouvelle conversation"
        >
          <Ionicons name="create-outline" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>

      {/* Tiroir Historique */}
      <Modal
        visible={isHistoryVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setIsHistoryVisible(false)}
      >
        <View style={styles.modalOverlay}>
          {/* Toucher n'importe où sur la zone assombrie ferme l'historique */}
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setIsHistoryVisible(false)}
            accessibilityRole="button"
            accessibilityLabel="Fermer l'historique"
          />
          <Animated.View entering={SlideInLeft.duration(200)} style={[styles.drawer, { paddingTop: top + 12 }]}>
            <View style={styles.drawerHeader}>
              <Text style={styles.drawerTitle} accessibilityRole="header">Historique</Text>
              <TouchableOpacity
                style={styles.newChip}
                onPress={() => createNewConversation(true)}
                accessibilityRole="button"
                accessibilityLabel="Nouvelle conversation"
              >
                <Ionicons name="create-outline" size={16} color={colors.primaryText} />
                <Text style={styles.newChipText}>Nouveau</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.drawerList}>
              {historySections.map((section) => (
                <View key={section.title} style={styles.drawerSection}>
                  <Text style={styles.drawerSectionTitle}>{section.title}</Text>
                  {section.items.map((item) => {
                    const active = item.id === currentConvId;
                    return (
                      <View key={item.id} style={[styles.historyItem, active && styles.historyItemActive]}>
                        {active && <View style={styles.historyActiveBar} />}
                        <TouchableOpacity
                          style={styles.historyItemMain}
                          onPress={() => selectConversation(item.id)}
                          accessibilityRole="button"
                          accessibilityLabel={item.title}
                          accessibilityState={{ selected: active }}
                        >
                          <Text
                            style={[styles.historyTitle, active && styles.historyTitleActive]}
                            numberOfLines={1}
                          >
                            {item.title}
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => deleteConversation(item.id)}
                          style={styles.historyDelete}
                          accessibilityRole="button"
                          accessibilityLabel={`Supprimer la conversation ${item.title}`}
                        >
                          <Ionicons name="trash-outline" size={18} color={colors.textSecondary} />
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </View>
              ))}
            </ScrollView>
          </Animated.View>
        </View>
      </Modal>

      {/* Messages */}
      <ScrollView
        ref={scrollViewRef}
        style={[styles.messagesContainer, { marginBottom: tabBarHeight + 72 }]}
        contentContainerStyle={styles.messagesContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {currentConv?.messages.length === 0 ? (
          <Animated.View key={currentConvId} entering={ZoomIn.duration(250)} style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Svg width={30} height={30} viewBox="0 0 30 30" fill="none">
                <SvgPath
                  d="M15 1.5V7.5M15 22.5V28.5M1.5 15H7.5M22.5 15H28.5M6 6L9.75 9.75M20.25 20.25L24 24M6 24L9.75 20.25M20.25 9.75L24 6"
                  strokeWidth={3}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  stroke={colors.primaryDark}
                />
              </Svg>
            </View>
            <Text style={styles.emptyTitle}>Sur quoi veux-tu réviser ?</Text>
            <Text style={styles.emptyText}>Pose une question ou pars d’un de tes cours.</Text>

            <View style={styles.suggestions}>
              {SUGGESTIONS.map((suggestion) => (
                <TouchableOpacity
                  key={suggestion}
                  style={styles.suggestion}
                  onPress={() => sendMessage(suggestion)}
                  accessibilityRole="button"
                >
                  <Text style={styles.suggestionText}>{suggestion}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </Animated.View>
        ) : (
          currentConv?.messages.map((message, index) => (
            <Animated.View
              key={index}
              entering={FadeIn.delay(index * 100)}
              style={message.type === 'user' ? styles.userRow : styles.aiRow}
            >
              <View style={message.type === 'user' ? styles.userBubble : message.error ? styles.errorBubble : styles.aiBubble}>
                <MessageBoundary text={String(message.text ?? '')} color={colors.textPrimary}>
                {message.attachments?.map((att, idx) => (
                  <View key={idx} style={styles.attachmentPreview}>
                    {/* Sans uri : pièce jointe venue d'un autre appareil, seul le nom est connu. */}
                    {att.type === 'image' && !!att.uri ? (
                      <Image
                        source={{ uri: att.uri }}
                        style={styles.attachmentImage}
                        accessibilityLabel={`Image jointe : ${att.name}`}
                      />
                    ) : (
                      <View style={styles.attachmentFile}>
                        <Ionicons name={att.type === 'image' ? 'image-outline' : 'document-text'} size={24} color={colors.primaryDark} />
                        <Text style={styles.attachmentFileName}>{att.name}</Text>
                      </View>
                    )}
                  </View>
                ))}

                {message.type === "ai" && message.error ? (
                  <View style={styles.errorContent} accessibilityLiveRegion="polite">
                    <Ionicons name="alert-circle" size={18} color={colors.dangerText} />
                    <Text style={styles.errorText}>{message.text}</Text>
                  </View>
                ) : message.type === "ai" ? (
                  isHTML(message.text) ? (
                    <RenderHTML
                      contentWidth={width}
                      source={{ html: message.text }}
                      baseStyle={{ color: colors.textPrimary, fontSize: 15, lineHeight: 23 }}
                    />
                  ) : (
                    splitDiagrams(message.text).map((part, partIndex) =>
                      part.type === 'svg' ? (
                        <ChatDiagram key={partIndex} xml={part.content} width={bubbleWidth} />
                      ) : (
                    <Markdown
                      key={partIndex}
                      rules={{
                        // Tableaux : colonnes de largeur fixe (le texte passe à la ligne dans la
                        // cellule) qui remplissent la bulle ; au-delà, le tableau défile.
                        table: (node, children, _parent, mdStyles) => (
                          <ScrollView key={node.key} horizontal showsHorizontalScrollIndicator nestedScrollEnabled>
                            <View style={mdStyles._VIEW_SAFE_table}>{children}</View>
                          </ScrollView>
                        ),
                        th: (node, children, parents, mdStyles) => (
                          <View key={node.key} style={[mdStyles._VIEW_SAFE_th, { width: tableColumnWidth(parents, bubbleWidth) }]}>
                            {children}
                          </View>
                        ),
                        td: (node, children, parents, mdStyles) => (
                          <View key={node.key} style={[mdStyles._VIEW_SAFE_td, { width: tableColumnWidth(parents, bubbleWidth) }]}>
                            {children}
                          </View>
                        ),
                      }}
                      style={{
                        body: {
                          color: colors.textPrimary,
                          fontSize: 15,
                          lineHeight: 23,
                        },
                        heading1: { fontSize: 19, fontWeight: "600", color: colors.textPrimary, marginBottom: 4 },
                        heading2: { fontSize: 17, fontWeight: "600", color: colors.textPrimary, marginBottom: 4 },
                        heading3: { fontSize: 17, fontWeight: "600", color: colors.textPrimary, marginBottom: 4 },
                        strong: { fontWeight: "700" },
                        bullet_list: { marginTop: 4 },
                        // Séparateur « --- » de l'IA : une ligne discrète avec de l'air autour,
                        // au lieu d'une barre grise collée au texte.
                        hr: { backgroundColor: colors.border, height: StyleSheet.hairlineWidth, marginVertical: 14 },
                        table: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, marginVertical: 4 },
                        thead: { backgroundColor: colors.surfaceAlt },
                        th: { padding: 10, fontWeight: "600", flex: 0 },
                        td: { padding: 10, flex: 0 },
                        tr: { borderBottomWidth: 0 },
                        code_inline: {
                          backgroundColor: colors.surfaceAlt,
                          color: colors.textPrimary,
                          padding: 4,
                          borderRadius: 6,
                        },
                      }}
                    >
                      {part.content}
                    </Markdown>
                      )
                    )
                  )
                ) : (
                  <Text style={styles.userText}>{message.text}</Text>
                )}
                </MessageBoundary>
              </View>

              {message.type === 'ai' && message.error && index === (currentConv?.messages.length ?? 0) - 1 && (
                <TouchableOpacity
                  style={styles.messageAction}
                  onPress={retryLastMessage}
                  disabled={isTyping}
                  accessibilityRole="button"
                  accessibilityLabel="Renvoyer la question"
                >
                  <Ionicons name="refresh" size={16} color={colors.primaryText} />
                  <Text style={styles.messageActionText}>Réessayer</Text>
                </TouchableOpacity>
              )}

              {message.type === 'ai' && !message.error && worthFlashcards(message.text) && (
                <TouchableOpacity
                  style={styles.messageAction}
                  onPress={() => setFlashcardSource(stripDiagrams(message.text))}
                  accessibilityRole="button"
                  accessibilityLabel="Créer des flashcards à partir de cette réponse"
                >
                  <Ionicons name="albums-outline" size={16} color={colors.primaryText} />
                  <Text style={styles.messageActionText}>Créer des flashcards</Text>
                </TouchableOpacity>
              )}

              <Text style={[styles.messageTime, message.type === 'user' && styles.userTime]}>
                {formatTime(message.timestamp)}
              </Text>
            </Animated.View>
          ))
        )}

        {isTyping && (
          <Animated.View entering={FadeIn} style={styles.aiRow}>
            <View
              style={[styles.aiBubble, styles.typingBubble]}
              accessible
              accessibilityLabel="L'assistant écrit une réponse"
            >
              <View style={styles.typingDot} />
              <View style={[styles.typingDot, styles.typingDotDelay]} />
              <View style={[styles.typingDot, styles.typingDotDelay2]} />
            </View>
          </Animated.View>
        )}
      </ScrollView>

      {/* Input area */}
      {currentConvId && (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
          style={[styles.keyboardAvoidingView, { bottom: tabBarHeight + 14 }]}
        >
          {/* Menu d'attachement */}
          {isAttachMenuOpen && (
            <Animated.View entering={FadeIn.duration(150)} exiting={FadeOut.duration(150)} style={styles.attachmentMenu}>
              <TouchableOpacity
                style={styles.attachmentMenuItem}
                accessibilityRole="button"
                accessibilityLabel="Ajouter une image"
                onPress={pickImage}
              >
                <Ionicons name="image-outline" size={22} color={colors.primaryDark} />
                <Text style={styles.attachmentMenuItemText}>Image</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.attachmentMenuItem}
                accessibilityRole="button"
                accessibilityLabel="Ajouter un document"
                onPress={pickDocument}
              >
                <Ionicons name="document-outline" size={22} color={colors.primaryDark} />
                <Text style={styles.attachmentMenuItemText}>Document</Text>
              </TouchableOpacity>
            </Animated.View>
          )}

          {/* Pièces jointes en attente */}
          {attachments.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.attachmentsContainer}>
              {attachments.map((att, index) => (
                <View key={index} style={styles.attachmentItem}>
                  {att.type === 'image' ? (
                    <Image
                      source={{ uri: att.uri }}
                      style={styles.attachmentThumb}
                      accessibilityLabel={`Image à envoyer : ${att.name}`}
                    />
                  ) : (
                    <View style={styles.attachmentThumbFile}>
                      <Ionicons name="document-text" size={30} color={colors.primaryDark} />
                    </View>
                  )}
                  <TouchableOpacity
                    style={styles.removeAttachment}
                    onPress={() => setAttachments(attachments.filter((_, i) => i !== index))}
                    accessibilityRole="button"
                    accessibilityLabel="Retirer la pièce jointe"
                  >
                    <Ionicons name="close-circle" size={22} color={colors.danger} />
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          )}

          {dictation.state !== 'idle' && (
            <View style={styles.dictationBar} accessibilityLiveRegion="polite">
              {dictation.state === 'recording' ? (
                <>
                  <View style={styles.recordingDot} />
                  <Text style={styles.dictationText}>
                    Je t’écoute… {Math.floor(dictation.seconds / 60)}:{String(dictation.seconds % 60).padStart(2, '0')}
                  </Text>
                  <TouchableOpacity
                    style={styles.dictationAction}
                    onPress={dictation.cancel}
                    accessibilityRole="button"
                    accessibilityLabel="Annuler la dictée"
                  >
                    <Ionicons name="close" size={20} color={colors.textSecondary} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.dictationAction, styles.dictationStop]}
                    onPress={dictation.stop}
                    accessibilityRole="button"
                    accessibilityLabel="Terminer la dictée"
                  >
                    <Ionicons name="checkmark" size={20} color={colors.onAction} />
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <ActivityIndicator size="small" color={colors.primaryDark} />
                  <Text style={styles.dictationText}>Transcription…</Text>
                </>
              )}
            </View>
          )}

          {/* Capsule dans capsule : rayon extérieur 28 = rayon intérieur 22 + padding 6 */}
          <View style={styles.chatBar}>
            <View style={styles.inputField}>
              <TouchableOpacity
                onPress={() => setIsAttachMenuOpen((open) => !open)}
                style={styles.attachButton}
                accessibilityRole="button"
                accessibilityLabel="Joindre un fichier"
                accessibilityState={{ expanded: isAttachMenuOpen }}
              >
                <Ionicons name="attach" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
              <TextInput
                ref={inputRef}
                value={input}
                onChangeText={setInput}
                maxLength={2000}
                placeholder="Écris ta question…"
                accessibilityLabel="Message à l'assistant IA"
                style={styles.input}
                multiline
                placeholderTextColor={colors.textSecondary}
              />
              <TouchableOpacity
                onPress={dictation.start}
                disabled={dictation.state !== 'idle'}
                style={styles.attachButton}
                accessibilityRole="button"
                accessibilityLabel="Dicter ta question"
              >
                <Ionicons
                  name={dictation.state === 'recording' ? 'mic' : 'mic-outline'}
                  size={20}
                  color={dictation.state === 'recording' ? colors.danger : colors.textSecondary}
                />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.sendButton, !canSend && styles.sendButtonDisabled]}
              onPress={() => sendMessage()}
              disabled={!canSend}
              accessibilityRole="button"
              accessibilityLabel="Envoyer"
              accessibilityState={{ disabled: !canSend }}
            >
              <Ionicons name="arrow-forward" size={22} color={colors.onAction} />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      )}

      {toast && (
        <Animated.View
          entering={FadeIn}
          exiting={FadeOut}
          style={[styles.toastRow, { bottom: tabBarHeight + 84 }]}
          pointerEvents="none"
        >
          <View style={styles.toast} accessibilityLiveRegion="polite">
            <Ionicons name={toast.icon} size={16} color={colors.background} />
            <Text style={styles.toastText}>{toast.text}</Text>
          </View>
        </Animated.View>
      )}

      <FlashcardsFromChatSheet
        text={flashcardSource}
        onClose={() => setFlashcardSource(null)}
        onAdded={(count, courseName) => {
          setFlashcardSource(null);
          showToast(
            `${count} flashcard${count > 1 ? 's' : ''} ajoutée${count > 1 ? 's' : ''} à « ${courseName} »`,
            'checkmark-circle',
            4000
          );
        }}
      />
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },

    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 20,
      paddingTop: 12,
      paddingBottom: 8,
    },

    headerButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },

    headerTitle: {
      flex: 1,
      fontSize: 18,
      fontWeight: '600',
      color: colors.textPrimary,
    },

    keyboardAvoidingView: {
      position: 'absolute',
      left: 20,
      right: 20,
    },

    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
    },

    drawer: {
      position: 'absolute',
      left: 0,
      top: 0,
      bottom: 0,
      width: 300,
      maxWidth: '80%',
      backgroundColor: colors.surface,
      borderTopRightRadius: 24,
      borderBottomRightRadius: 24,
      paddingHorizontal: 12,
      paddingBottom: 24,
    },

    drawerHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 8,
      paddingBottom: 12,
    },

    drawerTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.textPrimary,
    },

    newChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      borderWidth: 1.5,
      borderColor: colors.primaryDark,
    },

    newChipText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.primaryText,
    },

    drawerList: {
      gap: 6,
    },

    drawerSection: {
      gap: 6,
    },

    drawerSectionTitle: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.textSecondary,
    },

    historyItem: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 12,
      paddingLeft: 12,
    },

    // Conversation active : fond bleu très clair + barre bleue + texte bleu foncé (AA).
    historyItemActive: {
      backgroundColor: colors.tintPrimary,
      gap: 10,
    },

    historyActiveBar: {
      width: 4,
      height: 22,
      borderRadius: 2,
      backgroundColor: colors.primaryDark,
    },

    historyItemMain: {
      flex: 1,
      paddingVertical: 12,
    },

    historyTitle: {
      fontSize: 15,
      color: colors.textPrimary,
    },

    historyTitleActive: {
      fontWeight: '600',
      color: colors.primaryText,
    },

    historyDelete: {
      width: 44,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },

    messagesContainer: {
      flex: 1,
    },

    messagesContent: {
      paddingHorizontal: 20,
      paddingTop: 8,
      paddingBottom: 24,
      gap: 16,
    },

    toastRow: {
      position: 'absolute',
      left: 16,
      right: 16,
      alignItems: 'center',
      zIndex: 20,
    },

    toast: {
      maxWidth: '100%',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 999,
      backgroundColor: colors.textPrimary,
    },

    toastText: {
      flexShrink: 1,
      fontSize: 14,
      fontWeight: '500',
      color: colors.background,
    },

    emptyState: {
      alignItems: 'center',
      paddingTop: 24,
      gap: 12,
    },

    emptyIcon: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: colors.tintPrimary,
      alignItems: 'center',
      justifyContent: 'center',
    },

    emptyTitle: {
      fontSize: 22,
      fontWeight: '700',
      color: colors.textPrimary,
    },

    emptyText: {
      fontSize: 15,
      lineHeight: 22,
      color: colors.textSecondary,
      textAlign: 'center',
    },

    suggestions: {
      alignSelf: 'stretch',
      gap: 10,
      marginTop: 16,
    },

    suggestion: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      paddingHorizontal: 16,
      paddingVertical: 14,
    },

    suggestionText: {
      fontSize: 15,
      lineHeight: 21,
      color: colors.textPrimary,
    },

    userRow: {
      alignItems: 'flex-end',
      gap: 4,
    },

    aiRow: {
      alignItems: 'stretch',
      gap: 4,
    },

    // Bulle utilisateur en bleu très clair + texte foncé : le bleu plein est réservé à « Envoyer ».
    userBubble: {
      maxWidth: '80%',
      backgroundColor: colors.tintPrimary,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderTopLeftRadius: 18,
      borderTopRightRadius: 18,
      borderBottomLeftRadius: 18,
      borderBottomRightRadius: 6,
    },

    aiBubble: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 16,
      borderTopLeftRadius: 6,
      borderTopRightRadius: 18,
      borderBottomLeftRadius: 18,
      borderBottomRightRadius: 18,
    },

    errorBubble: {
      backgroundColor: colors.tintDanger,
      padding: 14,
      borderTopLeftRadius: 6,
      borderTopRightRadius: 18,
      borderBottomLeftRadius: 18,
      borderBottomRightRadius: 18,
    },

    errorContent: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
    },

    errorText: {
      flex: 1,
      fontSize: 15,
      lineHeight: 21,
      fontWeight: '500',
      color: colors.dangerText,
    },

    messageAction: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      gap: 6,
      minHeight: 40,
      marginTop: 6,
      paddingHorizontal: 12,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },

    messageActionText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.primaryText,
    },

    typingBubble: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },

    typingDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.primaryDark,
      opacity: 0.5,
    },

    typingDotDelay: {
      opacity: 0.7,
    },

    typingDotDelay2: {
      opacity: 1,
    },

    userText: {
      fontSize: 15,
      lineHeight: 22,
      color: colors.textPrimary,
    },

    messageTime: {
      fontSize: 11,
      color: colors.textSecondary,
    },

    userTime: {
      alignSelf: 'flex-end',
    },

    attachmentsContainer: {
      gap: 8,
      paddingBottom: 8,
      paddingTop: 6,
    },

    attachmentItem: {
      width: 70,
      height: 70,
      borderRadius: 12,
      backgroundColor: colors.surfaceAlt,
    },

    attachmentThumb: {
      width: '100%',
      height: '100%',
      borderRadius: 12,
    },

    attachmentThumbFile: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },

    removeAttachment: {
      position: 'absolute',
      top: -6,
      right: -6,
      backgroundColor: colors.surface,
      borderRadius: 11,
    },

    attachmentPreview: {
      marginBottom: 8,
    },

    attachmentImage: {
      width: 220,
      height: 150,
      borderRadius: 12,
    },

    attachmentFile: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
      borderRadius: 12,
      gap: 8,
      backgroundColor: colors.surface,
    },

    attachmentFileName: {
      fontSize: 14,
      color: colors.textPrimary,
      flexShrink: 1,
    },

    chatBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      padding: 6,
      borderRadius: 28,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.06,
      shadowRadius: 12,
      elevation: 4,
    },

    inputField: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingLeft: 6,
      paddingRight: 14,
      minHeight: 44,
      borderRadius: 22,
      backgroundColor: colors.surfaceAlt,
    },

    dictationBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginBottom: 8,
      paddingLeft: 16,
      paddingRight: 6,
      minHeight: 52,
      borderRadius: 26,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },

    recordingDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: colors.danger,
    },

    dictationText: {
      flex: 1,
      fontSize: 15,
      fontWeight: '500',
      color: colors.textPrimary,
      fontVariant: ['tabular-nums'],
    },

    dictationAction: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },

    dictationStop: {
      backgroundColor: colors.action,
    },

    attachButton: {
      width: 32,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },

    input: {
      flex: 1,
      paddingVertical: 10,
      maxHeight: 100,
      fontSize: 16,
      color: colors.textPrimary,
    },

    sendButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.action,
      alignItems: 'center',
      justifyContent: 'center',
    },

    sendButtonDisabled: {
      opacity: 0.5,
    },

    attachmentMenu: {
      alignSelf: 'flex-start',
      marginBottom: 8,
      padding: 6,
      borderRadius: 16,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 4,
    },

    attachmentMenuItem: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: 44,
      paddingHorizontal: 12,
      gap: 12,
    },

    attachmentMenuItemText: {
      fontSize: 16,
      color: colors.textPrimary,
    },
  });
}

export default AIChatScreen;
