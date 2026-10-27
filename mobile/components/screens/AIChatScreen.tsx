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
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Speech from "expo-speech";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system";
import { getAuthHeaders } from "../../utils/authHeaders";
import { Audio } from "expo-av";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
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

type Message = {
  type: "user" | "ai";
  text: string;
  attachments?: {
    type: "image" | "file";
    uri: string;
    name?: string;
  }[];
  timestamp: number;
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
  AIChat: undefined;
  UploadCourse: undefined;
};

const { height } = Dimensions.get('window');

// Ancienne clé commune à tous les comptes du téléphone : un compte voyait les
// conversations d'un autre. Elle est supprimée au chargement.
const LEGACY_STORAGE_KEY = "@ai_conversations";

/** Historique stocké par utilisateur Firebase. */
const storageKey = (uid: string) => `@ai_conversations:${uid}`;

const SUGGESTIONS = [
  "Résume les points clés de mon dernier cours",
  "Fais-moi un quiz sur les os du crâne",
  "Explique le cycle cardiaque simplement",
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
  const [isListening, setIsListening] = useState(false);
  const [isAISpeaking, setIsAISpeaking] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [attachments, setAttachments] = useState<any[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [isAttachMenuOpen, setIsAttachMenuOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scrollViewRef = useRef<ScrollView>(null);
  const inputRef = useRef<TextInput>(null);

  const { width } = useWindowDimensions();

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
      loadConversations();
    }, [])
  );

  const loadConversations = async () => {
    try {
      const uid = auth.currentUser?.uid;
      if (!uid) return;
      await AsyncStorage.removeItem(LEGACY_STORAGE_KEY);
      const stored = await AsyncStorage.getItem(storageKey(uid));
      if (stored) {
        const parsed: Conversation[] = JSON.parse(stored);
        setConversations(parsed.sort((a, b) => b.createdAt - a.createdAt));
        if (parsed.length > 0) {
          setCurrentConvId(parsed[0].id);
        } else {
          createNewConversation();
        }
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

  const showToast = (message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2000);
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
  ): Promise<{ response: string; conversationId?: string }> => {
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

      const response = await fetch(`${API_URL}/chat`, {
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
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        return { response: data?.error || "L'assistant n'a pas pu répondre. Réessaie dans un instant." };
      }

      return { response: data.response, conversationId: data.conversation_id };
    } catch (error) {
      console.error("Erreur AI:", error);

      return { response: "Une erreur est survenue lors de la communication avec l'assistant médical." };
    }
  };

  const sendMessage = async (textOverride?: string) => {
    const text = textOverride ?? input;
    if ((!text.trim() && attachments.length === 0) || !currentConvId) return;

    const userMessage: Message = {
      type: "user",
      text,
      attachments: attachments.length > 0 ? [...attachments] : undefined,
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

    const files = [...attachments] as PendingAttachment[];
    const serverId = conversations.find((c) => c.id === currentConvId)?.serverId;

    setInput("");
    setAttachments([]);
    setIsAttachMenuOpen(false);
    setIsTyping(true);

    try {
      const { response: aiResponse, conversationId } = await askMedicalAI(text, serverId, files);

      setIsTyping(false);

      const aiMessage: Message = {
        type: "ai",
        text: aiResponse,
        timestamp: Date.now(),
      };

      setConversations(prev =>
        prev.map(c =>
          c.id === currentConvId
            ? { ...c, serverId: conversationId ?? c.serverId, messages: [...c.messages, aiMessage] }
            : c
        )
      );

      if (isAISpeaking) {
        Speech.speak(aiResponse, {
          language: "fr",
          pitch: 1,
          rate: 0.9,
        });
      }
    } catch (error) {
      setIsTyping(false);

      appAlert(
        "Erreur",
        "Impossible de contacter l'assistant médical."
      );
    }
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
        {toast && (
          <Animated.View entering={FadeIn} exiting={FadeOut} style={styles.toastRow}>
            <View style={styles.toast} accessibilityLiveRegion="polite">
              <Ionicons name="create-outline" size={16} color={colors.background} />
              <Text style={styles.toastText}>{toast}</Text>
            </View>
          </Animated.View>
        )}

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
              <View style={message.type === 'user' ? styles.userBubble : styles.aiBubble}>
                {message.attachments?.map((att, idx) => (
                  <View key={idx} style={styles.attachmentPreview}>
                    {att.type === 'image' ? (
                      <Image
                        source={{ uri: att.uri }}
                        style={styles.attachmentImage}
                        accessibilityLabel={`Image jointe : ${att.name}`}
                      />
                    ) : (
                      <View style={styles.attachmentFile}>
                        <Ionicons name="document-text" size={24} color={colors.primaryDark} />
                        <Text style={styles.attachmentFileName}>{att.name}</Text>
                      </View>
                    )}
                  </View>
                ))}

                {message.type === "ai" ? (
                  isHTML(message.text) ? (
                    <RenderHTML
                      contentWidth={width}
                      source={{ html: message.text }}
                      baseStyle={{ color: colors.textPrimary, fontSize: 15, lineHeight: 23 }}
                    />
                  ) : (
                    <Markdown
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
                        table: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, marginVertical: 4 },
                        thead: { backgroundColor: colors.surfaceAlt },
                        th: { padding: 10, fontWeight: "600" },
                        td: { padding: 10 },
                        tr: { borderBottomWidth: 0 },
                        code_inline: {
                          backgroundColor: colors.surfaceAlt,
                          color: colors.textPrimary,
                          padding: 4,
                          borderRadius: 6,
                        },
                      }}
                    >
                      {message.text}
                    </Markdown>
                  )
                ) : (
                  <Text style={styles.userText}>{message.text}</Text>
                )}
              </View>

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
      alignItems: 'center',
    },

    toast: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 999,
      backgroundColor: colors.textPrimary,
    },

    toastText: {
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
