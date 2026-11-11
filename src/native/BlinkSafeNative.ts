import { NativeModules, NativeEventEmitter, Platform, Vibration } from 'react-native';

const { BlinkSafeBleModule, BlinkSafeNotificationModule, BlinkSafeVibrationModule } = NativeModules;

export interface BleConnectionStatus {
  isBluetoothEnabled?: boolean;
  isServiceRunning: boolean;
  state: 'CONNECTED' | 'CONNECTING' | 'DISCONNECTED' | 'READY';
  deviceAddress: string | null;
  deviceName?: string | null;
  rssi: number;
}

export interface InitialNotificationData {
  alertId: string;
  severity: string;
  location: string;
  payload: string;
  uri?: string;
}

// Native event emitter
export const bleEventEmitter = BlinkSafeBleModule
  ? new NativeEventEmitter(BlinkSafeBleModule)
  : null;

export const NativeBle = {
  isAvailable: !!BlinkSafeBleModule && Platform.OS === 'android',

  async startService(): Promise<boolean> {
    if (this.isAvailable) {
      try {
        return await BlinkSafeBleModule.startBleService();
      } catch (e) {
        console.warn('[NativeBle] startService error:', e);
      }
    }
    return true;
  },

  async stopService(): Promise<boolean> {
    if (this.isAvailable) {
      try {
        return await BlinkSafeBleModule.stopBleService();
      } catch (e) {
        console.warn('[NativeBle] stopService error:', e);
      }
    }
    return true;
  },

  async getConnectionStatus(): Promise<BleConnectionStatus> {
    if (this.isAvailable) {
      try {
        return await BlinkSafeBleModule.getConnectionStatus();
      } catch (e) {
        console.warn('[NativeBle] getConnectionStatus error:', e);
      }
    }
    return {
      isServiceRunning: true,
      state: 'CONNECTED',
      deviceAddress: 'ESP32_HUB_01:4B:91',
      rssi: -65,
    };
  },

  async simulateHardwareEvent(eventJson: string): Promise<boolean> {
    if (this.isAvailable) {
      try {
        return await BlinkSafeBleModule.simulateHardwareEvent(eventJson);
      } catch (e) {
        console.warn('[NativeBle] simulateHardwareEvent error:', e);
      }
    }
    return true;
  },

  async triggerBackgroundAlertTest(delaySeconds: number, eventJson: string): Promise<boolean> {
    if (this.isAvailable) {
      try {
        return await BlinkSafeBleModule.triggerBackgroundAlertTest(delaySeconds, eventJson);
      } catch (e) {
        console.warn('[NativeBle] triggerBackgroundAlertTest error:', e);
      }
    }
    return true;
  },

  async startScan(): Promise<boolean> {
    if (this.isAvailable) {
      try {
        return await BlinkSafeBleModule.startScan();
      } catch (e) {
        console.warn('[NativeBle] startScan error:', e);
      }
    }
    return true;
  },

  async stopScan(): Promise<boolean> {
    if (this.isAvailable) {
      try {
        return await BlinkSafeBleModule.stopScan();
      } catch (e) {
        console.warn('[NativeBle] stopScan error:', e);
      }
    }
    return true;
  },

  async connectDevice(address: string, name?: string): Promise<boolean> {
    if (this.isAvailable) {
      try {
        return await BlinkSafeBleModule.connectDevice(address, name || null);
      } catch (e) {
        console.warn('[NativeBle] connectDevice error:', e);
      }
    }
    return true;
  },

  async disconnectDevice(): Promise<boolean> {
    if (this.isAvailable) {
      try {
        return await BlinkSafeBleModule.disconnectDevice();
      } catch (e) {
        console.warn('[NativeBle] disconnectDevice error:', e);
      }
    }
    return true;
  },

  async sendAcknowledgement(alertId: string): Promise<boolean> {
    if (this.isAvailable) {
      try {
        return await BlinkSafeBleModule.sendAcknowledgement(alertId);
      } catch (e) {
        console.warn('[NativeBle] sendAcknowledgement error:', e);
      }
    }
    return true;
  },
};

export const NativeNotification = {
  isAvailable: !!BlinkSafeNotificationModule && Platform.OS === 'android',

  async areNotificationsEnabled(): Promise<boolean> {
    if (this.isAvailable) {
      try {
        return await BlinkSafeNotificationModule.areNotificationsEnabled();
      } catch (e) {
        console.warn('[NativeNotification] areNotificationsEnabled error:', e);
      }
    }
    return true;
  },

  async cancelNotification(notificationId: number): Promise<boolean> {
    if (this.isAvailable) {
      try {
        return await BlinkSafeNotificationModule.cancelNotification(notificationId);
      } catch (e) {
        console.warn('[NativeNotification] cancelNotification error:', e);
      }
    }
    return true;
  },

  async cancelAllNotifications(): Promise<boolean> {
    if (this.isAvailable) {
      try {
        return await BlinkSafeNotificationModule.cancelAllNotifications();
      } catch (e) {
        console.warn('[NativeNotification] cancelAllNotifications error:', e);
      }
    }
    return true;
  },

  async getInitialNotification(): Promise<InitialNotificationData | null> {
    if (this.isAvailable) {
      try {
        return await BlinkSafeNotificationModule.getInitialNotification();
      } catch (e) {
        console.warn('[NativeNotification] getInitialNotification error:', e);
      }
    }
    return null;
  },
};

export const NativeVibration = {
  isAvailable: !!BlinkSafeVibrationModule && Platform.OS === 'android',

  async vibratePattern(patternType: 'critical' | 'human_distress' | 'high' | 'important' | 'informational' | 'test', repeat = false): Promise<boolean> {
    if (this.isAvailable) {
      try {
        return await BlinkSafeVibrationModule.vibratePattern(patternType, repeat);
      } catch (e) {
        console.warn('[NativeVibration] vibratePattern error:', e);
      }
    }
    // Fallback to standard React Native vibration
    const timings = patternType === 'critical' ? [0, 500, 200, 500, 200, 800] : [0, 250, 150, 250];
    Vibration.vibrate(timings, repeat);
    return true;
  },

  async stop(): Promise<boolean> {
    if (this.isAvailable) {
      try {
        return await BlinkSafeVibrationModule.stopVibration();
      } catch (e) {
        console.warn('[NativeVibration] stop error:', e);
      }
    }
    Vibration.cancel();
    return true;
  },
};
