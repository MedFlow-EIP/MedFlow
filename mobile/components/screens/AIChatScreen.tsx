import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  FlatList,
  StyleSheet,
  Alert,
  Modal,
  SafeAreaView,
  Image,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  Keyboard,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Speech from "expo-speech";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { Audio } from "expo-av";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Animated, { 
  FadeIn, 
  FadeOut, 
  SlideInRight,
  SlideOutLeft,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  interpolate,
} from 'react-native-reanimated';

import { API_URL } from '@/services/api';
import Markdown from 'react-native-markdown-display';
import RenderHTML from 'react-native-render-html';
import { useWindowDimensions } from "react-native";

const TAB_BAR_HEIGHT = 70;

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
};

type RootStackParamList = {
  MainTabs: undefined;
  AIChat: undefined;
  UploadCourse: undefined;
};

const { height } = Dimensions.get('window');

const STORAGE_KEY = "@ai_conversations";

export function AIChatScreen() {
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

  const scrollViewRef = useRef<ScrollView>(null);
  const inputRef = useRef<TextInput>(null);
  const menuAnimation = useSharedValue(0);

  const { width } = useWindowDimensions();

  const currentConv = conversations.find((c) => c.id === currentConvId);

  const menuStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(menuAnimation.value, [0, 1], [0.8, 1]) }],
    opacity: menuAnimation.value,
  }));

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
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
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
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
    }
  }, [conversations]);

  useEffect(() => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 200);
  }, [currentConv?.messages.length, isTyping]);

  const createNewConversation = () => {
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

  const askMedicalAI = async (message: string): Promise<string> => {
    try {
      const response = await fetch(`${API_URL}/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message,
        }),
      });

      if (!response.ok) {
        throw new Error("Erreur serveur");
      }

      const data = await response.json();

      return data.response;
    } catch (error) {
      console.error("Erreur AI:", error);

      return "Une erreur est survenue lors de la communication avec l'assistant médical.";
    }
  };

  const sendMessage = async () => {
    if ((!input.trim() && attachments.length === 0) || !currentConvId) return;

    const userMessage: Message = {
      type: "user",
      text: input,
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

    setInput("");
    setAttachments([]);
    setIsTyping(true);

    try {
      const aiResponse = await askMedicalAI(input);

      setIsTyping(false);

      const aiMessage: Message = {
        type: "ai",
        text: aiResponse,
        timestamp: Date.now(),
      };

      setConversations(prev =>
        prev.map(c =>
          c.id === currentConvId
            ? { ...c, messages: [...c.messages, aiMessage] }
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

      Alert.alert(
        "Erreur",
        "Impossible de contacter l'assistant médical."
      );
    }
  };

  const deleteConversation = (convId: string) => {
    Alert.alert(
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
              
              AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
              
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

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  };

  const isHTML = (text: string) =>
  text.trim().startsWith("<") && text.includes("</");

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <BlurView intensity={80} tint="light" style={styles.header}>
        <TouchableOpacity 
          style={styles.menuButton}
          onPress={() => setIsHistoryVisible(true)}
        >
          <Ionicons name="menu" size={24} color="#4b5563" />
        </TouchableOpacity>
        
        <View style={styles.headerCenter}>
          <LinearGradient
            colors={['#3b82f6', '#2563eb']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.headerBadge}
          >
            <Ionicons name="sparkles" size={16} color="#ffffff" />
          </LinearGradient>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {currentConv?.title || "Assistant Médical"}
          </Text>
        </View>
        
        <TouchableOpacity 
          style={styles.headerButton}
          onPress={createNewConversation}
        >
          <Ionicons name="create-outline" size={24} color="#4b5563" />
        </TouchableOpacity>
      </BlurView>

      {/* Modal Historique */}
      <Modal
        visible={isHistoryVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setIsHistoryVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View 
            style={styles.modalContent}
          >
            <LinearGradient
              colors={['#ffffff', '#f9fafb']}
              style={styles.modalGradient}
            >
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Historique</Text>
                <TouchableOpacity 
                  style={styles.modalClose}
                  onPress={() => setIsHistoryVisible(false)}
                >
                  <Ionicons name="close" size={24} color="#6b7280" />
                </TouchableOpacity>
              </View>

              <FlatList
                data={conversations}
                keyExtractor={(item) => item.id}
                showsVerticalScrollIndicator={false}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[
                      styles.historyItem,
                      item.id === currentConvId && styles.historyItemActive
                    ]}
                    onPress={() => selectConversation(item.id)}
                  >
                    <View style={styles.historyItemLeft}>
                      <View style={[
                        styles.historyIcon,
                        item.id === currentConvId && styles.historyIconActive
                      ]}>
                        <Ionicons 
                          name="chatbubble-ellipses" 
                          size={20} 
                          color={item.id === currentConvId ? "#ffffff" : "#3b82f6"} 
                        />
                      </View>
                      <View style={styles.historyInfo}>
                        <Text 
                          style={[
                            styles.historyTitle,
                            item.id === currentConvId && styles.historyTitleActive
                          ]}
                          numberOfLines={1}
                        >
                          {item.title}
                        </Text>
                        <Text style={styles.historyDate}>
                          {new Date(item.createdAt).toLocaleDateString('fr-FR')}
                        </Text>
                      </View>
                    </View>
                    
                    <TouchableOpacity
                      onPress={() => deleteConversation(item.id)}
                      style={styles.historyDelete}
                    >
                      <Ionicons 
                        name="trash-outline" 
                        size={18} 
                        color={item.id === currentConvId ? "#ffffff" : "#ef4444"} 
                      />
                    </TouchableOpacity>
                  </TouchableOpacity>
                )}
              />

              <TouchableOpacity 
                style={styles.newConversationButton}
                onPress={createNewConversation}
              >
                <LinearGradient
                  colors={['#3b82f6', '#2563eb']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.newConversationGradient}
                >
                  <Ionicons name="add" size={24} color="#ffffff" />
                  <Text style={styles.newConversationText}>
                    Nouvelle conversation
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </LinearGradient>
          </View>
        </View>
      </Modal>

      {/* Messages */}
      <ScrollView 
        ref={scrollViewRef}
        style={styles.messagesContainer}
        contentContainerStyle={[
          styles.messagesContent,
          { paddingBottom: currentConvId ? 0 : 30 }
        ]}
        showsVerticalScrollIndicator={false}
      >
        {currentConv?.messages.length === 0 ? (
          <View style={styles.emptyState}>
            <LinearGradient
              colors={['#dbeafe', '#eff6ff']}
              style={styles.emptyIcon}
            >
              <Ionicons name="chatbubble-ellipses" size={48} color="#3b82f6" />
            </LinearGradient>
            <Text style={styles.emptyTitle}>Comment puis-je vous aider ?</Text>
            <Text style={styles.emptyText}>
              Posez vos questions médicales, demandez des explications ou partagez des documents
            </Text>
          </View>
        ) : (
          currentConv?.messages.map((message, index) => (
            <Animated.View 
              key={index}
              entering={FadeIn.delay(index * 100)}
              style={[
                styles.messageRow,
                message.type === 'user' ? styles.userRow : styles.aiRow
              ]}
            >
              {message.type === 'ai' && (
                <LinearGradient
                  colors={['#3b82f6', '#2563eb']}
                  style={styles.aiAvatar}
                >
                  <Ionicons name="sparkles" size={16} color="#ffffff" />
                </LinearGradient>
              )}

                <View style={[
                  styles.messageBubble,
                  message.type === 'user' ? styles.userBubble : styles.aiBubble
                ]}>
                  {message.attachments?.map((att, idx) => (
                    <View key={idx} style={styles.attachmentPreview}>
                      {att.type === 'image' ? (
                        <Image source={{ uri: att.uri }} style={styles.attachmentImage} />
                      ) : (
                        <BlurView intensity={60} style={styles.attachmentFile}>
                          <Ionicons name="document-text" size={24} color="#3b82f6" />
                          <Text style={styles.attachmentFileName}>{att.name}</Text>
                        </BlurView>
                      )}
                    </View>
                  ))}

                  {message.type === "ai" ? (
                    isHTML(message.text) ? (
                      <RenderHTML
                        contentWidth={width}
                        source={{ html: message.text }}
                      />
                    ) : (
                      <Markdown
                        style={{
                          body: {
                            color: "#111827",
                            fontSize: 14,
                            lineHeight: 20,
                          },
                          strong: { fontWeight: "700" },
                          bullet_list: { marginTop: 4 },
                          code_inline: {
                            backgroundColor: "#e5e7eb",
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

                  <Text style={[
                    styles.messageTime,
                    message.type === 'user' ? styles.userTime : styles.aiTime
                  ]}>
                    {formatTime(message.timestamp)}
                  </Text>
                </View>
                
                <Text style={[
                  styles.messageTime,
                  message.type === 'user' ? styles.userTime : styles.aiTime
                ]}>
                  {formatTime(message.timestamp)}
                </Text>
            </Animated.View>
          ))
        )}
        
        {isTyping && (
          <Animated.View 
            entering={FadeIn}
            style={[styles.messageRow, styles.aiRow]}
          >
            <LinearGradient
              colors={['#3b82f6', '#2563eb']}
              style={styles.aiAvatar}
            >
              <Ionicons name="sparkles" size={16} color="#ffffff" />
            </LinearGradient>
            <View style={[styles.messageBubble, styles.aiBubble, styles.typingBubble]}>
              <View style={styles.typingIndicator}>
                <View style={styles.typingDot} />
                <View style={[styles.typingDot, styles.typingDotDelay]} />
                <View style={[styles.typingDot, styles.typingDotDelay2]} />
              </View>
            </View>
          </Animated.View>
        )}
      </ScrollView>

      {/* Attachments preview */}
      {attachments.length > 0 && (
        <Animated.View 
          entering={FadeIn}
          style={[
            styles.attachmentsContainer,
            { bottom: currentConvId ? (keyboardHeight > 0 ? 100 + keyboardHeight : 100) : 0 }
          ]}
        >
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {attachments.map((att, index) => (
              <BlurView key={index} intensity={60} style={styles.attachmentItem}>
                {att.type === 'image' ? (
                  <Image source={{ uri: att.uri }} style={styles.attachmentThumb} />
                ) : (
                  <View style={styles.attachmentThumbFile}>
                    <Ionicons name="document-text" size={30} color="#3b82f6" />
                  </View>
                )}
                <TouchableOpacity 
                  style={styles.removeAttachment}
                  onPress={() => setAttachments(attachments.filter((_, i) => i !== index))}
                >
                  <Ionicons name="close-circle" size={22} color="#ef4444" />
                </TouchableOpacity>
              </BlurView>
            ))}
          </ScrollView>
        </Animated.View>
      )}

      {/* Input area */}
      {currentConvId && (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
          style={styles.keyboardAvoidingView}
        >
          <BlurView intensity={80} tint="light" style={styles.inputContainer}>
            {/* <TouchableOpacity 
              style={styles.attachButton}
              onPress={() => {
                menuAnimation.value = withSpring(menuAnimation.value === 0 ? 1 : 0);
              }}
            >
              <Ionicons name="add" size={24} color="#4b5563" />
            </TouchableOpacity> */}

            <TextInput
              ref={inputRef}
              value={input}
              onChangeText={setInput}
              placeholder="Écrivez votre message..."
              style={styles.input}
              multiline
              placeholderTextColor="#9ca3af"
            />
            
            <View style={styles.inputActions}>
              {/* <TouchableOpacity 
                style={[styles.actionButton, isListening && styles.actionButtonActive]}
                onPressIn={() => {
                  setIsListening(true);
                }}
                onPressOut={() => {
                  setIsListening(false);
                }}
              >
                <Ionicons 
                  name={isListening ? "mic" : "mic-outline"} 
                  size={22} 
                  color={isListening ? "#ffffff" : "#4b5563"} 
                />
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.actionButton, isAISpeaking && styles.actionButtonActive]}
                onPress={() => {
                  setIsAISpeaking(!isAISpeaking);
                  if (isAISpeaking) Speech.stop();
                }}
              >
                <Ionicons 
                  name={isAISpeaking ? "volume-high" : "volume-medium-outline"} 
                  size={22} 
                  color={isAISpeaking ? "#ffffff" : "#4b5563"} 
                />
              </TouchableOpacity> */}

              <TouchableOpacity 
                style={styles.sendButton}
                onPress={sendMessage}
                disabled={!input.trim() && attachments.length === 0}
              >
                <LinearGradient
                  colors={['#3b82f6', '#2563eb']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.sendGradient}
                >
                  <Ionicons name="send" size={18} color="#ffffff" />
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </BlurView>

          {/* Menu d'attachement */}
          {menuAnimation.value > 0 && (
            <Animated.View style={[styles.attachmentMenu, menuStyle]}>
              <BlurView intensity={80} tint="light" style={styles.attachmentMenuBlur}>
                <TouchableOpacity 
                  style={styles.attachmentMenuItem}
                  onPress={async () => {
                    const result = await ImagePicker.launchImageLibraryAsync({
                      mediaTypes: ['images'],
                      allowsEditing: true,
                      quality: 1,
                    });
                    if (!result.canceled) {
                      setAttachments([...attachments, {
                        type: 'image',
                        uri: result.assets[0].uri,
                        name: result.assets[0].fileName || 'Image'
                      }]);
                    }
                    menuAnimation.value = withSpring(0);
                  }}
                >
                  <Ionicons name="image-outline" size={24} color="#3b82f6" />
                  <Text style={styles.attachmentMenuItemText}>Image</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={styles.attachmentMenuItem}
                  onPress={async () => {
                    const result = await DocumentPicker.getDocumentAsync({
                      type: "*/*",
                    });
                    if (!result.canceled && result.assets[0]) {
                      setAttachments([...attachments, {
                        type: 'file',
                        uri: result.assets[0].uri,
                        name: result.assets[0].name
                      }]);
                    }
                    menuAnimation.value = withSpring(0);
                  }}
                >
                  <Ionicons name="document-outline" size={24} color="#3b82f6" />
                  <Text style={styles.attachmentMenuItemText}>Document</Text>
                </TouchableOpacity>
              </BlurView>
            </Animated.View>
          )}
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
    paddingTop: 25,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(229,231,235,0.5)',
    zIndex: 10,
  },

  menuButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },

  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  headerBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },

  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },

  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },

  keyboardAvoidingView: {
    position: 'absolute',
    bottom: TAB_BAR_HEIGHT,
    left: 0,
    right: 0,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },

  modalContent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: '80%',
    backgroundColor: '#ffffff',
    borderTopRightRadius: 24,
    borderBottomRightRadius: 24,
    overflow: 'hidden',
  },

  modalGradient: {
    flex: 1,
    padding: 20,
  },

  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },

  modalTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
  },

  modalClose: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },

  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 16,
    marginBottom: 8,
    backgroundColor: '#f9fafb',
  },

  historyItemActive: {
    backgroundColor: '#3b82f6',
  },

  historyItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },

  historyIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#dbeafe',
    alignItems: 'center',
    justifyContent: 'center',
  },

  historyIconActive: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },

  historyInfo: {
    flex: 1,
  },

  historyTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 2,
  },

  historyTitleActive: {
    color: '#ffffff',
  },

  historyDate: {
    fontSize: 12,
    color: '#6b7280',
  },

  historyDelete: {
    padding: 8,
  },

  newConversationButton: {
    marginTop: 20,
    borderRadius: 16,
    overflow: 'hidden',
  },

  newConversationGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    gap: 8,
  },

  newConversationText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },

  messagesContainer: {
    flex: 1,
    marginBottom: TAB_BAR_HEIGHT + 70,
  },

  messagesContent: {
    padding: 20,
  },

  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    minHeight: height * 0.6,
  },

  emptyIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },

  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
  },

  emptyText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    paddingHorizontal: 40,
    lineHeight: 20,
  },

  messageRow: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 12,
  },

  userRow: {
    justifyContent: 'flex-end',
  },

  aiRow: {
    justifyContent: 'flex-start',
  },

  aiAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-end',
    marginBottom: 4,
  },

  messageBubble: {
    maxWidth: '75%',
    padding: 12,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },

  userBubble: {
    backgroundColor: '#3b82f6',
    borderBottomRightRadius: 4,
  },

  aiBubble: {
    backgroundColor: '#ffffff',
    borderBottomLeftRadius: 4,
  },

  typingBubble: {
    padding: 16,
  },

  typingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },

  typingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#3b82f6',
    opacity: 0.5,
  },

  typingDotDelay: {
    opacity: 0.7,
  },

  typingDotDelay2: {
    opacity: 1,
  },

  messageText: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 4,
  },

  userText: {
    color: '#ffffff',
  },

  aiText: {
    color: '#111827',
  },

  messageTime: {
    fontSize: 10,
    alignSelf: 'flex-end',
  },

  userTime: {
    color: 'rgba(255,255,255,0.7)',
  },

  aiTime: {
    color: '#9ca3af',
  },

  attachmentsContainer: {
    position: 'absolute',
    left: 16,
    right: 16,
    paddingHorizontal: 16,
    paddingBottom: 8,
    zIndex: 20,
  },

  attachmentItem: {
    width: 70,
    height: 70,
    marginRight: 8,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.8)',
  },

  attachmentThumb: {
    width: '100%',
    height: '100%',
  },

  attachmentThumbFile: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f3f4f6',
  },

  removeAttachment: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#ffffff',
    borderRadius: 11,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },

  attachmentPreview: {
    marginBottom: 8,
  },

  attachmentImage: {
    width: '100%',
    height: 150,
    borderRadius: 12,
    marginBottom: 8,
  },

  attachmentFile: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.8)',
  },

  attachmentFileName: {
    fontSize: 14,
    color: '#374151',
    flex: 1,
  },

  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(229,231,235,0.5)',
    backgroundColor: 'rgba(255,255,255,0.95)',
    marginHorizontal: 8,
    marginBottom: 8,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 5,
  },

  attachButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },

  input: {
    flex: 1,
    marginHorizontal: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    maxHeight: 100,
    backgroundColor: '#f3f4f6',
    borderRadius: 20,
    fontSize: 14,
  },

  inputActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },

  actionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },

  actionButtonActive: {
    backgroundColor: '#3b82f6',
  },

  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
  },

  sendGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  attachmentMenu: {
    position: 'absolute',
    bottom: 80,
    left: 20,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },

  attachmentMenuBlur: {
    padding: 8,
  },

  attachmentMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 12,
  },

  attachmentMenuItemText: {
    fontSize: 16,
    color: '#374151',
  },
});

export default AIChatScreen;