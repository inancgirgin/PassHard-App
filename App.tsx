// App.tsx
import 'react-native-get-random-values'; // EN TEPEDE
import React, { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as ScreenCapture from 'expo-screen-capture'; // Ekran görüntüsü koruması
import { useAuthStore } from './src/store/authStore';

import LoginScreen from './src/Screens/LoginScreen';
import VaultListScreen from './src/Screens/VaultListScreen';
import AddEditScreen from './src/Screens/AddEditScreen';
import AddFolderScreen from './src/Screens/AddFolderScreen';
import TrashScreen from './src/Screens/TrashScreen';
import TrashedFolderContentScreen from './src/Screens/TrashedFolderContentScreen'; // Eklendi

const Stack = createNativeStackNavigator();

export default function App() {
  const appState = useRef(AppState.currentState);
  const lastBackgroundTime = useRef<number | null>(null); // Arka plana atılma zamanı
  const clearKey = useAuthStore((state) => state.clearKey);
  const navigationRef = useNavigationContainerRef(); // Navigasyonu dışarıdan yönetmek için

  useEffect(() => {
    // 1. GÜVENLİK: Ekran Görüntüsü almayı engelle
    const protectScreen = async () => {
      await ScreenCapture.preventScreenCaptureAsync();
    };
    protectScreen();

    // 2. GÜVENLİK: Uygulama arka plana atılınca kilitleme mantığı
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      // Uygulama AKTİF hale geldiğinde
      if (nextAppState === 'active') {
        if (lastBackgroundTime.current) {
          const timeDiff = Date.now() - lastBackgroundTime.current;

          if (timeDiff > 30000) { // 30 saniye
            clearKey();
            if (navigationRef.isReady()) {
              navigationRef.reset({
                index: 0,
                routes: [{ name: 'Login' }],
              });
            }
          }
          lastBackgroundTime.current = null; // Süreyi sıfırla
        }
      }
      // Uygulama ARKA PLANA veya INACTIVE duruma geçtiğinde
      else if (nextAppState === 'background' || nextAppState === 'inactive') {
        lastBackgroundTime.current = Date.now();
      }

      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, []);

  return (
    <NavigationContainer ref={navigationRef}>

      <Stack.Navigator
        id="RootStack"
        initialRouteName="Login"
        screenOptions={{ headerShown: false }}
      >
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="VaultList" component={VaultListScreen} />
        <Stack.Screen name="AddEdit" component={AddEditScreen} options={{ presentation: 'modal' }} />
        <Stack.Screen name="AddFolder" component={AddFolderScreen} options={{ presentation: 'modal' }} />
        <Stack.Screen name="Trash" component={TrashScreen} options={{ presentation: 'modal' }} />
        <Stack.Screen name="TrashedFolderContent" component={TrashedFolderContentScreen} options={{ presentation: 'modal' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}