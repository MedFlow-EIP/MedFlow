import React, { useMemo, useState } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Text,
  Dimensions,
  Animated,
  Easing,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useTheme } from '../theme/ThemeContext';
import type { ThemeColors } from '../theme/colors';

const { width, height } = Dimensions.get('window');

interface FloatingActionButtonProps {
  onUploadPDF: () => void;
  onVoiceChat: () => void;
}

export function FloatingActionButton({ onUploadPDF, onVoiceChat }: FloatingActionButtonProps) {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [isOpen, setIsOpen] = useState(false);
  const [animation] = useState(new Animated.Value(0));

  const toggleMenu = () => {
    if (isOpen) {
      Animated.timing(animation, {
        toValue: 0,
        duration: 200,
        easing: Easing.ease,
        useNativeDriver: true,
      }).start(() => setIsOpen(false));
    } else {
      setIsOpen(true);
      Animated.timing(animation, {
        toValue: 1,
        duration: 200,
        easing: Easing.ease,
        useNativeDriver: true,
      }).start();
    }
  };

  const uploadOpacity = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  const voiceOpacity = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  const uploadTranslateY = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -80],
  });

  const voiceTranslateY = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -160],
  });

  return (
    <>
      <Modal
        visible={isOpen}
        transparent
        animationType="fade"
        onRequestClose={toggleMenu}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={toggleMenu}
        >
          <BlurView intensity={80} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill}>
            <View style={styles.modalContent}>
              <Animated.View
                style={[
                  styles.optionContainer,
                  {
                    opacity: voiceOpacity,
                    transform: [{ translateY: voiceTranslateY }],
                  },
                ]}
              >
                <TouchableOpacity
                  style={[styles.optionButton, styles.voiceOption]}
                  onPress={() => {
                    toggleMenu();
                    onVoiceChat();
                  }}
                >
                  <Ionicons name="mic-outline" size={24} color="#ffffff" />
                  <Text style={styles.optionText}>Parler à l'IA</Text>
                </TouchableOpacity>
              </Animated.View>

              <Animated.View
                style={[
                  styles.optionContainer,
                  {
                    opacity: uploadOpacity,
                    transform: [{ translateY: uploadTranslateY }],
                  },
                ]}
              >
                <TouchableOpacity
                  style={[styles.optionButton, styles.uploadOption]}
                  onPress={() => {
                    toggleMenu();
                    onUploadPDF();
                  }}
                >
                  <Ionicons name="document-outline" size={24} color="#ffffff" />
                  <Text style={styles.optionText}>Upload PDF</Text>
                </TouchableOpacity>
              </Animated.View>
            </View>
          </BlurView>
        </TouchableOpacity>
      </Modal>

      <TouchableOpacity
        style={styles.fab}
        onPress={toggleMenu}
        activeOpacity={0.8}
      >
        <Animated.View
          style={[
            styles.fabIcon,
            {
              transform: [
                {
                  rotate: animation.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0deg', '45deg'],
                  }),
                },
              ],
            },
          ]}
        >
          <Ionicons name="add" size={32} color="#ffffff" />
        </Animated.View>
      </TouchableOpacity>
    </>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    fab: {
      position: 'absolute',
      right: 20,
      bottom: 90,
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
      elevation: 8,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      zIndex: 1000,
    },
    fabIcon: {
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalOverlay: {
      flex: 1,
      justifyContent: 'flex-end',
    },
    modalContent: {
      flex: 1,
      justifyContent: 'flex-end',
      paddingBottom: 90,
      paddingRight: 20,
      alignItems: 'flex-end',
    },
    optionContainer: {
      marginBottom: 16,
      alignItems: 'flex-end',
    },
    optionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderRadius: 30,
      elevation: 4,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 4,
    },
    uploadOption: {
      backgroundColor: colors.success,
    },
    voiceOption: {
      backgroundColor: colors.secondary,
    },
    optionText: {
      color: '#ffffff',
      fontSize: 16,
      fontWeight: '600',
      marginLeft: 8,
    },
  });
}