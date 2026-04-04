import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { getSetting } from '../src/db/queries';
import { logger } from '../src/utils/logger';

export default function RootLayout() {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const seen = getSetting('hasSeenOnboarding');
      if (!seen) {
        // Small defer so the navigator is mounted before we redirect
        setTimeout(() => router.replace('/onboarding'), 0);
      }
    } catch (err) {
      logger.error('layout.onboardingCheck.error', { error: err.message });
    } finally {
      setReady(true);
    }
  }, []);

  if (!ready) {
    return <View style={{ flex: 1, backgroundColor: '#fff' }} />;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="dark" backgroundColor="#FFF8F0" translucent={false} />
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        <Stack.Screen
          name="recipe/editor"
          options={{ headerShown: false, presentation: 'modal' }}
        />
        <Stack.Screen name="recipe/[id]" options={{ headerShown: false }} />
        <Stack.Screen
          name="recipe/cooking"
          options={{ headerShown: false, presentation: 'fullScreenModal' }}
        />
      </Stack>
    </GestureHandlerRootView>
  );
}
