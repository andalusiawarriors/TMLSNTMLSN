import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

const REST_TIMER_NOTIFICATION_TYPE = 'rest-timer';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// Request notification permissions
export const registerForPushNotifications = async (): Promise<string | null> => {
  if (!Device.isDevice) {
    console.log('Must use physical device for Push Notifications');
    return null;
  }

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('Failed to get push token for push notification!');
      return null;
    }

    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    if (!projectId) {
      if (__DEV__) {
        console.log('No projectId – skipping push token (local notifications still work)');
      }
      return null;
    }

    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF0000',
      });
    }

    return token;
  } catch (error) {
    console.error('Error registering for push notifications:', error);
    return null;
  }
};

// Schedule a rest timer notification
export const scheduleRestTimerNotification = async (
  sessionId: string,
  exerciseName: string,
  setNumber: number,
  seconds: number
): Promise<string> => {
  try {
    await cancelRestTimerNotification(sessionId);
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Rest Time Up! 🔥',
        body: `Time for Set ${setNumber} of ${exerciseName}`,
        data: {
          type: REST_TIMER_NOTIFICATION_TYPE,
          sessionId,
        },
        sound: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds,
      },
    });
    return id;
  } catch (error) {
    console.error('Error scheduling rest timer notification:', error);
    throw error;
  }
};

export const cancelRestTimerNotification = async (sessionId: string): Promise<void> => {
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    const matching = scheduled.filter((notification) => {
      const data = notification.content.data as { type?: string; sessionId?: string } | undefined;
      return data?.type === REST_TIMER_NOTIFICATION_TYPE && data.sessionId === sessionId;
    });

    await Promise.all(
      matching.map((notification) =>
        Notifications.cancelScheduledNotificationAsync(notification.identifier)
      )
    );
  } catch (error) {
    console.error('Error canceling rest timer notification:', error);
  }
};

// Schedule streak "6 hours left" notification (immediate or in N seconds)
export const scheduleStreak6HourNotification = async (
  secondsFromNow?: number
): Promise<string | null> => {
  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Streak reminder 🔥',
        body: '6 hours left to keep your workout streak!',
        sound: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
      },
      trigger: secondsFromNow != null && secondsFromNow > 0
        ? {
            type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
            seconds: secondsFromNow,
          }
        : null, // immediate if 0 or undefined
    });
    return id;
  } catch (error) {
    console.error('Error scheduling streak notification:', error);
    return null;
  }
};

// Cancel a scheduled notification
export const cancelNotification = async (notificationId: string): Promise<void> => {
  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  } catch (error) {
    console.error('Error canceling notification:', error);
  }
};

// Send immediate notification (for testing)
export const sendImmediateNotification = async (
  title: string,
  body: string
): Promise<void> => {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: true,
      },
      trigger: null, // immediate
    });
  } catch (error) {
    console.error('Error sending immediate notification:', error);
  }
};

// Listen for notification responses (when user taps notification)
export const addNotificationResponseListener = (
  callback: (response: Notifications.NotificationResponse) => void
) => {
  return Notifications.addNotificationResponseReceivedListener(callback);
};

// Content notification helpers (Newsletter/YouTube)
export const scheduleContentNotification = async (
  type: 'newsletter' | 'youtube',
  title: string,
  url: string
): Promise<void> => {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: type === 'newsletter' ? '📧 New Newsletter!' : '🎥 New Video!',
        body: title,
        data: { url, type },
        sound: true,
      },
      trigger: null, // immediate
    });
  } catch (error) {
    console.error('Error scheduling content notification:', error);
  }
};
