import React, { useEffect, useMemo, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/ThemeContext';
import type { ThemeColors } from '../../theme/colors';
import { AppAlertButton, AppAlertRequest, registerAppAlertHost } from '../../utils/appAlert';

/** Affiche les dialogues demandés via appAlert(), un à la fois. À monter une seule fois, dans App.tsx. */
export function AppDialogHost() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [queue, setQueue] = useState<AppAlertRequest[]>([]);

  useEffect(() => registerAppAlertHost((request) => setQueue((q) => [...q, request])), []);

  const current = queue[0];
  if (!current) return null;

  const destructive = current.buttons.some((b) => b.style === 'destructive');
  const cancelButton = current.buttons.find((b) => b.style === 'cancel');

  const close = (button?: AppAlertButton) => {
    setQueue((q) => q.slice(1));
    // Après la fermeture, pour qu'un éventuel nouveau dialogue s'affiche proprement.
    if (button?.onPress) setTimeout(button.onPress, 0);
  };

  // Ordre : annuler à gauche, action principale à droite.
  const ordered = [...current.buttons].sort((a, b) => (a.style === 'cancel' ? -1 : b.style === 'cancel' ? 1 : 0));
  const stacked = ordered.length > 2;

  return (
    <Modal transparent visible animationType="fade" onRequestClose={() => close(cancelButton)}>
      <View style={styles.overlay}>
        {/* Toucher le fond = annuler, seulement s'il existe un bouton d'annulation. */}
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={cancelButton ? () => close(cancelButton) : undefined}
          accessible={false}
        />
        <View style={styles.card} accessibilityViewIsModal accessibilityRole="alert">
          <View style={[styles.icon, { backgroundColor: destructive ? colors.tintDanger : colors.tintPrimary }]}>
            <Ionicons
              name={destructive ? 'alert-circle-outline' : 'information-circle-outline'}
              size={28}
              color={destructive ? colors.dangerText : colors.primaryDark}
            />
          </View>
          <Text style={styles.title}>{current.title}</Text>
          {!!current.message && <Text style={styles.message}>{current.message}</Text>}

          <View style={[styles.buttons, stacked && styles.buttonsStacked]}>
            {ordered.map((button) => {
              const isCancel = button.style === 'cancel';
              const isDestructive = button.style === 'destructive';
              return (
                <TouchableOpacity
                  key={button.text}
                  style={[
                    styles.button,
                    !stacked && styles.buttonFlex,
                    isCancel
                      ? styles.buttonSecondary
                      : { backgroundColor: isDestructive ? colors.danger : colors.action },
                  ]}
                  onPress={() => close(button)}
                  accessibilityRole="button"
                >
                  <Text
                    style={[
                      styles.buttonText,
                      { color: isCancel ? colors.textPrimary : isDestructive ? '#ffffff' : colors.onAction },
                    ]}
                  >
                    {button.text}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    },
    card: {
      width: '100%',
      maxWidth: 360,
      alignItems: 'center',
      gap: 10,
      padding: 24,
      borderRadius: 24,
      backgroundColor: colors.surface,
    },
    icon: {
      width: 56,
      height: 56,
      borderRadius: 28,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 4,
    },
    title: {
      fontSize: 19,
      fontWeight: '700',
      color: colors.textPrimary,
      textAlign: 'center',
    },
    message: {
      fontSize: 15,
      lineHeight: 22,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    buttons: {
      alignSelf: 'stretch',
      flexDirection: 'row',
      gap: 10,
      marginTop: 12,
    },
    buttonsStacked: {
      flexDirection: 'column',
    },
    button: {
      minHeight: 50,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 12,
    },
    buttonFlex: {
      flex: 1,
    },
    buttonSecondary: {
      backgroundColor: colors.surfaceAlt,
    },
    buttonText: {
      fontSize: 16,
      fontWeight: '600',
    },
  });
}
