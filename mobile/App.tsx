import React, { useMemo } from 'react';
import { DarkTheme, DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppNavigator } from './components/navigation/AppNavigator';
import { ThemeProvider, useTheme } from './theme/ThemeContext';
import { TutorialProvider } from './context/TutorialContext';
import { navigationRef } from './navigationRef';
import { AppDialogHost } from './components/ui/AppDialogHost';

/** Navigation et barre d'état aux couleurs du thème (sinon fond blanc
 * pendant les transitions et icônes noires sur fond sombre). */
function ThemedApp() {
  const { colors, isDark } = useTheme();
  const navigationTheme = useMemo(() => {
    const base = isDark ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: colors.primary,
        background: colors.background,
        card: colors.surface,
        text: colors.textPrimary,
        border: colors.border,
      },
    };
  }, [colors, isDark]);

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <NavigationContainer ref={navigationRef} theme={navigationTheme}>
        <AppNavigator />
      </NavigationContainer>
      <AppDialogHost />
    </>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <TutorialProvider>
            <ThemedApp />
          </TutorialProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
