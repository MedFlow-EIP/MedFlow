import React, { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/ThemeContext';
import type { ThemeColors } from '../../theme/colors';
import { useScreenInsets } from '../navigation/constants';

/** Rapport largeur/hauteur tiré du viewBox (4:3 par défaut). */
export function svgAspectRatio(xml: string): number {
  const m = xml.match(/viewBox\s*=\s*["']\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)/i);
  const w = m ? parseFloat(m[1]) : 0;
  const h = m ? parseFloat(m[2]) : 0;
  return w > 0 && h > 0 ? w / h : 4 / 3;
}

class DiagramBoundary extends React.Component<{ fallback: React.ReactNode; children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/**
 * Schéma dessiné par l'assistant, sur fond blanc (les couleurs du SVG sont
 * pensées pour un fond clair). Toucher l'agrandit en plein écran.
 */
export function ChatDiagram({ xml, width }: { xml: string; width: number }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { top, bottom } = useScreenInsets();
  const window = useWindowDimensions();
  const [open, setOpen] = useState(false);
  const ratio = svgAspectRatio(xml);

  const fallback = (
    <View style={styles.fallback}>
      <Ionicons name="image-outline" size={18} color={colors.textSecondary} />
      <Text style={styles.fallbackText}>Schéma illisible</Text>
    </View>
  );

  return (
    <>
      <TouchableOpacity
        onPress={() => setOpen(true)}
        style={styles.frame}
        accessibilityRole="imagebutton"
        accessibilityLabel="Schéma de l'assistant, toucher pour agrandir"
      >
        <DiagramBoundary fallback={fallback}>
          <SvgXml xml={xml} width={width} height={width / ratio} />
        </DiagramBoundary>
        <View style={styles.zoomBadge}>
          <Ionicons name="expand-outline" size={14} color="#374151" />
        </View>
      </TouchableOpacity>

      <Modal visible={open} animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={[styles.full, { paddingTop: top, paddingBottom: bottom }]}>
          <View style={styles.fullHeader}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setOpen(false)}
              accessibilityRole="button"
              accessibilityLabel="Fermer le schéma"
            >
              <Ionicons name="close" size={24} color="#111827" />
            </TouchableOpacity>
          </View>
          {/* Défilement dans les deux sens : schéma affiché en grand. */}
          <ScrollView contentContainerStyle={styles.fullContent} maximumZoomScale={4} minimumZoomScale={1}>
            <ScrollView horizontal contentContainerStyle={styles.fullContent}>
              <Pressable onPress={() => setOpen(false)}>
                <DiagramBoundary fallback={fallback}>
                  <SvgXml xml={xml} width={window.width * 1.4} height={(window.width * 1.4) / ratio} />
                </DiagramBoundary>
              </Pressable>
            </ScrollView>
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    frame: {
      marginVertical: 8,
      padding: 8,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: '#ffffff',
      overflow: 'hidden',
    },
    zoomBadge: {
      position: 'absolute',
      right: 8,
      top: 8,
      width: 26,
      height: 26,
      borderRadius: 13,
      backgroundColor: '#f3f4f6',
      alignItems: 'center',
      justifyContent: 'center',
    },
    fallback: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      padding: 12,
    },
    fallbackText: {
      fontSize: 13,
      color: colors.textSecondary,
    },
    full: {
      flex: 1,
      backgroundColor: '#ffffff',
    },
    fullHeader: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      paddingHorizontal: 12,
    },
    closeButton: {
      width: 48,
      height: 48,
      alignItems: 'center',
      justifyContent: 'center',
    },
    fullContent: {
      flexGrow: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 12,
    },
  });
}
