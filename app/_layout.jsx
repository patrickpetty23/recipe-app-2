import { useEffect, useState } from 'react';
import { View, Platform } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { getSetting, seedDemoData, updateRecipeImageUri } from '../src/db/queries';
import { generateRecipeThumbnail } from '../src/services/openai';
import { setupNotificationChannel } from '../src/utils/notifications';
import { logger } from '../src/utils/logger';

export default function RootLayout() {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Set up Android notification channel (no-op on iOS)
    setupNotificationChannel();

    try {
      // Seed demo data on first install, then fire thumbnail generation (non-blocking)
      try {
        const seeded = seedDemoData();
        if (Array.isArray(seeded) && seeded.length > 0) {
          // Fire hero image generation for each seed recipe (DALL-E, fire-and-forget)
          for (const { id, recipe } of seeded) {
            generateRecipeThumbnail(recipe.title, recipe.cuisine, recipe.ingredients)
              .then((url) => updateRecipeImageUri(id, url))
              .catch(() => {});
          }
        }
      } catch (e) { logger.error('layout.seed.error', { error: e.message }); }

      const seen = getSetting('hasSeenOnboarding');
      if (!seen) {
        setTimeout(() => router.replace('/onboarding'), 0);
      }
    } catch (err) {
      logger.error('layout.onboardingCheck.error', { error: err.message });
    } finally {
      setReady(true);
    }
  }, []);

  if (!ready) {
    return (
      <SafeAreaProvider>
        <View style={{ flex: 1, backgroundColor: '#FFF8F0' }} />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        {/* On iOS backgroundColor is ignored — status bar is always transparent.
            translucent is iOS-default behaviour; set it only on Android. */}
        <StatusBar
          style="dark"
          backgroundColor="#FFF8F0"
          translucent={Platform.OS === 'android' ? false : undefined}
        />
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="onboarding" options={{ headerShown: false }} />
          <Stack.Screen
            name="recipe/editor"
            options={{ headerShown: false, presentation: 'fullScreenModal' }}
          />
          <Stack.Screen name="recipe/[id]" options={{ headerShown: false }} />
          <Stack.Screen
            name="recipe/cooking"
            options={{ headerShown: false, presentation: 'fullScreenModal' }}
          />
        </Stack>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}
