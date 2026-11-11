import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  Switch,
  TouchableOpacity,
  Alert as NativeAlert,
} from 'react-native';
import { Colors, Typography, Spacing, BorderRadius } from '../theme';
import { Header } from '../components/common/Header';
import { PrimaryButton } from '../components/common/PrimaryButton';
import { StorageService, UserSettings, DEFAULT_USER_SETTINGS } from '../services/StorageService';
import { VibrationService } from '../services/VibrationService';
import { bluetoothService } from '../services/BluetoothService';
import { alertManager } from '../services/AlertManager';
import { MOCK_SAFETY_SCENARIOS } from '../mock/mockHardware';

export const SettingsScreen: React.FC = () => {
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_USER_SETTINGS);
  const [isBgTesting, setIsBgTesting] = useState(false);

  useEffect(() => {
    const loadSettings = async () => {
      const saved = await StorageService.getUserSettings();
      setSettings(saved);
    };
    loadSettings();
  }, []);

  const updateSetting = async <K extends keyof UserSettings>(
    key: K,
    value: UserSettings[K]
  ) => {
    const updated = { ...settings, [key]: value };
    setSettings(updated);
    await StorageService.saveUserSettings(updated);

    if (key === 'isMockHardwareMode') {
      bluetoothService.setMockMode(value as boolean);
    }
  };

  const handleTestVibration = async () => {
    await VibrationService.vibrateTest();
  };

  const handleTestAlert = async () => {
    const sampleEvent = MOCK_SAFETY_SCENARIOS.FIRE_KITCHEN();
    await alertManager.receiveEvent(sampleEvent);
  };

  const handleBackgroundAlertTest = async () => {
    setIsBgTesting(true);
    const packet = MOCK_SAFETY_SCENARIOS.FIRE_KITCHEN();
    await bluetoothService.triggerBackgroundAlertTest(5, packet);
    setIsBgTesting(false);

    NativeAlert.alert(
      'Background Test Scheduled',
      'A critical fire alert will trigger from the Android background service in 5 seconds.\n\nPress HOME or LOCK YOUR PHONE right now to verify the notification heads-up banner and vibration pattern.',
      [{ text: 'OK' }]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header title="Settings" showSimulateButton={false} />

      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {/* Accessibility Section */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>ACCESSIBILITY PREFERENCES</Text>
          <View style={styles.card}>
            <View style={styles.settingRow}>
              <View style={styles.settingTextCol}>
                <Text style={styles.settingTitle}>Vibration Intensity</Text>
                <Text style={styles.settingSub}>Haptic strength for tactile phone alerts</Text>
              </View>
              <View style={styles.intensityPill}>
                <Text style={styles.intensityText}>HIGH (MAX)</Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.settingRow}>
              <View style={styles.settingTextCol}>
                <Text style={styles.settingTitle}>Critical Alert Vibration</Text>
                <Text style={styles.settingSub}>Strong repeating pulse pattern</Text>
              </View>
              <Switch
                value={settings.criticalVibrationStrong}
                onValueChange={v => updateSetting('criticalVibrationStrong', v)}
                trackColor={{ false: Colors.cardBorder, true: Colors.critical }}
                thumbColor="#FFFFFF"
              />
            </View>

            <View style={styles.divider} />

            <View style={styles.settingRow}>
              <View style={styles.settingTextCol}>
                <Text style={styles.settingTitle}>Visual Alert Overlay</Text>
                <Text style={styles.settingSub}>Immediate full-screen pulse for deaf users</Text>
              </View>
              <Switch
                value={settings.visualAlertPreferences}
                onValueChange={v => updateSetting('visualAlertPreferences', v)}
                trackColor={{ false: Colors.cardBorder, true: Colors.safe }}
                thumbColor="#FFFFFF"
              />
            </View>
          </View>
        </View>

        {/* Alert Preferences */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>ALERT CATEGORIES</Text>
          <View style={styles.card}>
            <View style={styles.settingRow}>
              <View style={styles.settingTextCol}>
                <Text style={styles.settingTitle}>Critical Alerts (Fire / Gas / CO)</Text>
                <Text style={styles.settingSub}>Maximum priority heads-up & sirens</Text>
              </View>
              <Switch
                value={settings.criticalAlertsEnabled}
                onValueChange={v => updateSetting('criticalAlertsEnabled', v)}
                trackColor={{ false: Colors.cardBorder, true: Colors.critical }}
                thumbColor="#FFFFFF"
              />
            </View>

            <View style={styles.divider} />

            <View style={styles.settingRow}>
              <View style={styles.settingTextCol}>
                <Text style={styles.settingTitle}>Important Alerts (Distress / Intrusion)</Text>
                <Text style={styles.settingSub}>Acoustic crying, shouting, entry alerts</Text>
              </View>
              <Switch
                value={settings.importantAlertsEnabled}
                onValueChange={v => updateSetting('importantAlertsEnabled', v)}
                trackColor={{ false: Colors.cardBorder, true: Colors.warning }}
                thumbColor="#FFFFFF"
              />
            </View>

            <View style={styles.divider} />

            <View style={styles.settingRow}>
              <View style={styles.settingTextCol}>
                <Text style={styles.settingTitle}>Informational Alerts (Doorbell)</Text>
                <Text style={styles.settingSub}>Visitors and ambient sound notifications</Text>
              </View>
              <Switch
                value={settings.informationalAlertsEnabled}
                onValueChange={v => updateSetting('informationalAlertsEnabled', v)}
                trackColor={{ false: Colors.cardBorder, true: Colors.informational }}
                thumbColor="#FFFFFF"
              />
            </View>
          </View>
        </View>

        {/* Hardware & Diagnostics */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>SYSTEM DIAGNOSTICS & VERIFICATION</Text>
          <View style={styles.card}>
            <View style={styles.settingRow}>
              <View style={styles.settingTextCol}>
                <Text style={styles.settingTitle}>Mock Hardware Simulation Mode</Text>
                <Text style={styles.settingSub}>Run complete app logic without physical ESP32</Text>
              </View>
              <Switch
                value={settings.isMockHardwareMode}
                onValueChange={v => updateSetting('isMockHardwareMode', v)}
                trackColor={{ false: Colors.cardBorder, true: Colors.accent }}
                thumbColor="#FFFFFF"
              />
            </View>

            <View style={styles.divider} />

            <View style={styles.btnGrid}>
              <PrimaryButton
                title="TEST PHONE VIBRATION"
                variant="secondary"
                size="small"
                onPress={handleTestVibration}
                style={styles.diagBtn}
              />
              <PrimaryButton
                title="TRIGGER SAMPLE ALERT"
                variant="secondary"
                size="small"
                onPress={handleTestAlert}
                style={styles.diagBtn}
              />
            </View>

            <View style={{ marginTop: Spacing.sm }}>
              <PrimaryButton
                title="TEST BACKGROUND ALERT (5S DELAY)"
                variant="critical"
                size="medium"
                loading={isBgTesting}
                onPress={handleBackgroundAlertTest}
                style={{ width: '100%' }}
              />
            </View>
          </View>
        </View>

        {/* About BlinkSafe */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>ABOUT BLINKSAFE</Text>
          <View style={styles.card}>
            <Text style={styles.aboutTitle}>BlinkSafe Safety Hub</Text>
            <Text style={styles.aboutVersion}>Version 1.0.0 (Production Build)</Text>
            <Text style={styles.aboutText}>
              BlinkSafe is an accessibility-first safety system engineered for deaf and vulnerable individuals. It maintains continuous local background BLE monitoring with the Common ESP32 hub, bypassing external internet dependency for critical life-safety alerts.
            </Text>
          </View>
        </View>

        <View style={{ height: Spacing.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  container: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
  },
  section: {
    marginTop: Spacing.md,
  },
  sectionHeader: {
    ...Typography.caption,
    fontSize: 12,
    letterSpacing: 1.2,
    color: Colors.textSecondary,
    fontWeight: '800',
    marginBottom: Spacing.xs,
  },
  card: {
    backgroundColor: Colors.cardBackground,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.xs + 2,
  },
  settingTextCol: {
    flex: 1,
    paddingRight: Spacing.md,
  },
  settingTitle: {
    ...Typography.h4,
    color: Colors.textPrimary,
    fontSize: 14,
  },
  settingSub: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  intensityPill: {
    backgroundColor: Colors.cardBackgroundElevated,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.cardBorderActive,
  },
  intensityText: {
    ...Typography.caption,
    color: Colors.accent,
    fontWeight: '900',
    fontSize: 10,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.cardBorder,
    marginVertical: Spacing.sm,
  },
  btnGrid: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  diagBtn: {
    flex: 1,
  },
  aboutTitle: {
    ...Typography.h3,
    color: Colors.textPrimary,
  },
  aboutVersion: {
    ...Typography.caption,
    color: Colors.textMuted,
    marginVertical: 2,
  },
  aboutText: {
    ...Typography.bodyMedium,
    color: Colors.textSecondary,
    marginTop: Spacing.sm,
    lineHeight: 20,
  },
});
