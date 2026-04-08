import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { logger } from './logger';

// Configure how notifications appear when the app is foregrounded
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

const MEAL_TIMES = {
  breakfast: { hour: 7,  minute: 30 },
  lunch:     { hour: 12, minute: 0  },
  dinner:    { hour: 18, minute: 0  },
  snack:     { hour: 15, minute: 0  },
};

// Android requires a notification channel before any notification can be scheduled.
// Safe to call multiple times — expo-notifications is idempotent.
export async function setupNotificationChannel() {
  if (Platform.OS !== 'android') return;
  try {
    await Notifications.setNotificationChannelAsync('meal-reminders', {
      name: 'Meal Reminders',
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: null,
    });
  } catch (err) {
    logger.error('notifications.setupChannel.error', { error: err.message });
  }
}

export async function requestNotificationPermission() {
  try {
    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
  } catch {
    return false;
  }
}

/**
 * Schedule a local reminder for a planned meal.
 * Fires on plannedDate at the appropriate meal-type time.
 * Returns the notification identifier (or null if skipped/failed).
 */
export async function scheduleMealReminder({ recipeTitle, plannedDate, mealType }) {
  try {
    const time = MEAL_TIMES[mealType] ?? MEAL_TIMES.dinner;
    const triggerDate = new Date(plannedDate + 'T12:00:00');
    triggerDate.setHours(time.hour, time.minute, 0, 0);

    // Don't schedule for times already in the past
    if (triggerDate <= new Date()) return null;

    const granted = await requestNotificationPermission();
    if (!granted) return null;

    const mealEmoji = { breakfast: '🌅', lunch: '☀️', dinner: '🌙', snack: '🍎' }[mealType] ?? '🍽️';
    const mealLabel = mealType.charAt(0).toUpperCase() + mealType.slice(1);

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: `${mealEmoji} ${mealLabel} time`,
        body: `You planned: ${recipeTitle}`,
        sound: false,
        data: { plannedDate, mealType },
      },
      // Expo SDK 54: trigger requires explicit 'type' field. Android also needs channelId.
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: triggerDate,
        ...(Platform.OS === 'android' ? { channelId: 'meal-reminders' } : {}),
      },
    });

    logger.info('notifications.scheduleMealReminder', { id, mealType, plannedDate });
    return id;
  } catch (err) {
    // Non-fatal — notifications are a nice-to-have
    logger.error('notifications.scheduleMealReminder.error', { error: err.message });
    return null;
  }
}

export async function cancelNotification(id) {
  if (!id) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch {
    // ignore
  }
}
