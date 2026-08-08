import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AppNavigator } from './components/navigation/AppNavigator';
import { ThemeProvider } from './theme/ThemeContext';
import { TutorialProvider } from './context/TutorialContext';
import { navigationRef } from './navigationRef';

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <TutorialProvider>
          <NavigationContainer ref={navigationRef}>
            <AppNavigator />
          </NavigationContainer>
        </TutorialProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}