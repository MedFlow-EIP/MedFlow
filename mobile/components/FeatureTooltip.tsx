import React, { useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import type { ThemeColors } from '../theme/colors';

const { width } = Dimensions.get('window');

interface FeatureTooltipProps {
  title: string;
  description: string;
  visible: boolean;
  onClose: () => void;
}

export function FeatureTooltip({ title, description, visible, onClose }: FeatureTooltipProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  if (!visible) return null;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.tooltip}>
          <View style={styles.tooltipHeader}>
            <Ionicons name="sparkles" size={24} color={colors.warning} />
            <Text style={styles.tooltipTitle}>Nouveauté !</Text>
          </View>
          
          <Text style={styles.tooltipSubtitle}>{title}</Text>
          <Text style={styles.tooltipDescription}>{description}</Text>
          
          <TouchableOpacity onPress={onClose} style={styles.gotItButton}>
            <Text style={styles.gotItText}>J'ai compris</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    tooltip: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 20,
      width: width * 0.8,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 8,
      elevation: 5,
    },
    tooltipHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
    },
    tooltipTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.textPrimary,
      marginLeft: 8,
    },
    tooltipSubtitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.textPrimary,
      marginBottom: 8,
    },
    tooltipDescription: {
      fontSize: 14,
      color: colors.textSecondary,
      lineHeight: 20,
      marginBottom: 20,
    },
    gotItButton: {
      backgroundColor: colors.primary,
      paddingVertical: 12,
      borderRadius: 12,
      alignItems: 'center',
    },
    gotItText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.textInverse,
    },
  });
}