import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

export function AddScreen({ navigation }: any) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Que veux-tu faire ?</Text>

      <TouchableOpacity style={styles.optionButton} onPress={() => navigation.navigate('UploadCourse')}>
        <Text style={styles.optionText}>📤 Uploader un cours</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    backgroundColor: '#f8fafc' 
  },
  title: { 
    fontSize: 24, 
    fontWeight: 'bold', 
    marginBottom: 40 
  },
  optionButton: {
    width: '70%',
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#3b82f6',
    marginVertical: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionText: 
  { color: '#fff', 
    fontSize: 18, 
    fontWeight: '600' 
  },
});