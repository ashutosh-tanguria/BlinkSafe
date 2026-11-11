import React, { useEffect, useState, useRef } from 'react';
import { StatusBar, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { createNavigationContainerRef } from '@react-navigation/native';
import { AppNavigator } from './navigation/AppNavigator';
import { EmergencyOverlay } from './components/emergency/EmergencyOverlay';
import { alertManager } from './services/AlertManager';
import { bluetoothService } from './services/BluetoothService';
import { audioClassificationService } from './services/AudioClassificationService';
import { PermissionService } from './services/PermissionService';
import { NotificationService } from './services/NotificationService';
import { Alert } from './models/alert';
import { Colors } from './theme';

export const navigationRef = createNavigationContainerRef<any>();

export default function App() {
  const [criticalOverlayAlert, setCriticalOverlayAlert] = useState<Alert | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const initializeApp = async () => {
      // 1. Request/Verify permissions
      await PermissionService.requestSafetyPermissions();

      // 2. Initialize Core Services
      await alertManager.initialize();
      await bluetoothService.initialize();
      await audioClassificationService.initialize();

      // 3. Check for cold-start initial notification
      const initialNotif = await NotificationService.getInitialNotification();
      if (initialNotif && initialNotif.alertId) {
        setTimeout(() => {
          if (navigationRef.isReady()) {
            if (initialNotif.severity === 'critical') {
              navigationRef.navigate('Emergency', { alertId: initialNotif.alertId });
            } else {
              navigationRef.navigate('AlertDetail', { alertId: initialNotif.alertId });
            }
          }
        }, 500);
      }

      setIsReady(true);
    };

    initializeApp();

    // 4. Subscribe to new active alerts for in-app critical emergency overlay
    const unsubscribe = alertManager.subscribe((activeAlerts) => {
      const activeCritical = activeAlerts.find(
        a => a.severity === 'critical' && a.state === 'ACTIVE'
      );
      setCriticalOverlayAlert(activeCritical || null);
    });

    return () => unsubscribe();
  }, []);

  const handleOverlayAcknowledge = async (alertId: string) => {
    await alertManager.acknowledgeAlert(alertId);
    setCriticalOverlayAlert(null);
  };

  const handleOverlayViewRoute = (alert: Alert) => {
    setCriticalOverlayAlert(null);
    if (navigationRef.isReady()) {
      navigationRef.navigate('Evacuation', { alertId: alert.id, location: alert.location });
    }
  };

  return (
    <SafeAreaProvider style={styles.container}>
      <StatusBar
        barStyle="light-content"
        backgroundColor={Colors.background}
        translucent={false}
      />

      <AppNavigator navigationRef={navigationRef} />

      {/* Global In-App Emergency Overlay for Critical Events */}
      <EmergencyOverlay
        alert={criticalOverlayAlert}
        onAcknowledge={handleOverlayAcknowledge}
        onViewRoute={handleOverlayViewRoute}
        onDismiss={() => setCriticalOverlayAlert(null)}
      />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
});
