import { NativeNotification, InitialNotificationData } from '../native/BlinkSafeNative';

export const NotificationService = {
  async areNotificationsEnabled(): Promise<boolean> {
    return await NativeNotification.areNotificationsEnabled();
  },

  async cancelNotification(notificationId: number): Promise<void> {
    await NativeNotification.cancelNotification(notificationId);
  },

  async cancelAllNotifications(): Promise<void> {
    await NativeNotification.cancelAllNotifications();
  },

  async getInitialNotification(): Promise<InitialNotificationData | null> {
    return await NativeNotification.getInitialNotification();
  },
};
