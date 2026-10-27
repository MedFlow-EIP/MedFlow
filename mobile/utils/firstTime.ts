import AsyncStorage from '@react-native-async-storage/async-storage';

const FIRST_TIME_KEY = '@medflow_first_time';

export async function isFirstTimeUser(): Promise<boolean> {
  try {
    const value = await AsyncStorage.getItem(FIRST_TIME_KEY);
    return value === null;
  } catch (error) {
    console.error('Erreur AsyncStorage:', error);
    return true;
  }
}

export async function markTutorialCompleted(): Promise<void> {
  try {
    await AsyncStorage.setItem(FIRST_TIME_KEY, 'completed');
  } catch (error) {
    console.error('Erreur AsyncStorage:', error);
  }
}

export async function resetTutorial(): Promise<void> {
  try {
    await AsyncStorage.removeItem(FIRST_TIME_KEY);
  } catch (error) {
    console.error('Erreur AsyncStorage:', error);
  }
}