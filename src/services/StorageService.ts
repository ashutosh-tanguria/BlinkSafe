import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from '../models/alert';
import { SystemDevicesState } from '../models/device';

const STORAGE_KEYS = {
  ACTIVE_ALERTS: '@blinksafe_active_alerts',
  ALERT_HISTORY: '@blinksafe_alert_history',
  DEVICES_STATE: '@blinksafe_devices_state',
  USER_SETTINGS: '@blinksafe_user_settings',
};

export interface UserSettings {
  vibrationIntensity: 'low' | 'medium' | 'high';
  criticalVibrationStrong: boolean;
  visualAlertPreferences: boolean;
  notificationsEnabled: boolean;
  criticalAlertsEnabled: boolean;
  importantAlertsEnabled: boolean;
  informationalAlertsEnabled: boolean;
  isMockHardwareMode: boolean;
}

export const DEFAULT_USER_SETTINGS: UserSettings = {
  vibrationIntensity: 'high',
  criticalVibrationStrong: true,
  visualAlertPreferences: true,
  notificationsEnabled: true,
  criticalAlertsEnabled: true,
  importantAlertsEnabled: true,
  informationalAlertsEnabled: true,
  isMockHardwareMode: true,
};

export const StorageService = {
  async getActiveAlerts(): Promise<Alert[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.ACTIVE_ALERTS);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error('[StorageService] Error loading active alerts:', e);
      return [];
    }
  },

  async saveActiveAlerts(alerts: Alert[]): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.ACTIVE_ALERTS, JSON.stringify(alerts));
    } catch (e) {
      console.error('[StorageService] Error saving active alerts:', e);
    }
  },

  async getAlertHistory(): Promise<Alert[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.ALERT_HISTORY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error('[StorageService] Error loading alert history:', e);
      return [];
    }
  },

  async saveAlertHistory(history: Alert[]): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.ALERT_HISTORY, JSON.stringify(history));
    } catch (e) {
      console.error('[StorageService] Error saving alert history:', e);
    }
  },

  async getUserSettings(): Promise<UserSettings> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.USER_SETTINGS);
      return data ? { ...DEFAULT_USER_SETTINGS, ...JSON.parse(data) } : DEFAULT_USER_SETTINGS;
    } catch (e) {
      console.error('[StorageService] Error loading user settings:', e);
      return DEFAULT_USER_SETTINGS;
    }
  },

  async saveUserSettings(settings: UserSettings): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.USER_SETTINGS, JSON.stringify(settings));
    } catch (e) {
      console.error('[StorageService] Error saving user settings:', e);
    }
  },

  async getDevicesState(): Promise<SystemDevicesState | null> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.DEVICES_STATE);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      console.error('[StorageService] Error loading devices state:', e);
      return null;
    }
  },

  async saveDevicesState(state: SystemDevicesState): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.DEVICES_STATE, JSON.stringify(state));
    } catch (e) {
      console.error('[StorageService] Error saving devices state:', e);
    }
  },

  async clearAllStorage(): Promise<void> {
    try {
      await AsyncStorage.multiRemove([
        STORAGE_KEYS.ACTIVE_ALERTS,
        STORAGE_KEYS.ALERT_HISTORY,
      ]);
    } catch (e) {
      console.error('[StorageService] Error clearing storage:', e);
    }
  },
};
