import { createNavigationContainerRef } from '@react-navigation/native';
import type { RootStackParamList } from './components/navigation/AppNavigator';

export const navigationRef = createNavigationContainerRef<RootStackParamList>();