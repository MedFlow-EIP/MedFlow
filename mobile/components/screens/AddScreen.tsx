import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import type { ThemeColors } from '../../theme/colors';

export function AddScreen({ navigation }: any) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Que veux-tu faire ?</Text>

      <TouchableOpacity style={styles.optionButton} onPress={() => navigation.navigate('UploadCourse')}>
        <Text style={styles.optionText}>📤 Uploader un cours</Text>
      </TouchableOpacity>
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { 
      flex: 1, 
      justifyContent: 'center', 
      alignItems: 'center', 
      backgroundColor: colors.background,
    },
    title: { 
      fontSize: 24, 
      fontWeight: 'bold', 
      marginBottom: 40,
      color: colors.textPrimary,
    },
    optionButton: {
      width: '70%',
      padding: 16,
      borderRadius: 12,
      backgroundColor: colors.primary,
      marginVertical: 12,
      justifyContent: 'center',
      alignItems: 'center',
    },
    optionText: { 
      color: colors.textInverse, 
      fontSize: 18, 
      fontWeight: '600',
    },
  });
}