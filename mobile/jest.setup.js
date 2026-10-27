// Safe areas : sans SafeAreaProvider dans les tests, on utilise le mock officiel (insets à 0).
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);

// Analytique : appels réseau sans effet visible, neutralisés partout.
jest.mock('./utils/analytics', () => ({ logEvent: jest.fn(), logScreenView: jest.fn() }));
