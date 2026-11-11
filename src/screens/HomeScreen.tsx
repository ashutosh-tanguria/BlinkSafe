import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { Colors, Typography, Spacing, BorderRadius } from '../theme';
import { Header } from '../components/common/Header';
import { MetricCard } from '../components/common/MetricCard';
import { AlertCard } from '../components/common/AlertCard';
import { PrimaryButton } from '../components/common/PrimaryButton';
import { SimulateModal } from '../components/common/SimulateModal';
import { Alert, SensorTelemetry } from '../models/alert';
import { ConnectionStatus } from '../models/device';
import { alertManager } from '../services/AlertManager';
import { bluetoothService } from '../services/BluetoothService';

interface HomeScreenProps {
  navigation: any;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({ navigation }) => {
  const [activeAlerts, setActiveAlerts] = useState<Alert[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('CONNECTED');
  const [rssi, setRssi] = useState<number>(-58);
  const [deviceName, setDeviceName] = useState<string>('Common ESP32 Hub');
  const [telemetry, setTelemetry] = useState<SensorTelemetry>(bluetoothService.getLatestTelemetry());
  const [showSimModal, setShowSimModal] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  useEffect(() => {
    const unsubscribeAlerts = alertManager.subscribe((active) => {
      setActiveAlerts(active);
    });

    const unsubscribeBt = bluetoothService.subscribeState((status, signal, name) => {
      setConnectionStatus(status);
      setRssi(signal);
      if (name) setDeviceName(name);
    });

    const unsubscribeTelemetry = bluetoothService.subscribeTelemetry((data) => {
      setTelemetry({ ...data });
    });

    const connState = bluetoothService.getConnectionState();
    setConnectionStatus(connState.status);
    setRssi(connState.rssi);
    setDeviceName(connState.deviceName);

    return () => {
      unsubscribeAlerts();
      unsubscribeBt();
      unsubscribeTelemetry();
    };
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await bluetoothService.scan();
    setRefreshing(false);
  }, []);

  const isOnline = connectionStatus === 'CONNECTED';
  const hasAnyAlert = activeAlerts.length > 0;
  const latestActive = activeAlerts[0];

  const handleAcknowledge = useCallback(async (id: string) => {
    await alertManager.acknowledgeAlert(id);
  }, []);

  const handleResolve = useCallback(async (id: string) => {
    await alertManager.resolveAlert(id);
  }, []);

  const handleViewRoute = useCallback((alert: Alert) => {
    navigation.navigate('Evacuation', { alertId: alert.id, location: alert.location });
  }, [navigation]);

  const handleAlertCardPress = useCallback((alert: Alert) => {
    if (alert.severity === 'critical') {
      navigation.navigate('Emergency', { alertId: alert.id });
    } else {
      navigation.navigate('AlertDetail', { alertId: alert.id });
    }
  }, [navigation]);

  const mq2Status = telemetry.mq2?.status || 'normal';
  const mq135Status = telemetry.mq135?.airQuality || 'good';
  const irFlame = telemetry.ir?.flameDetected || false;
  const micSiren = telemetry.mic?.sirenDetected || false;
  const pirMotion = telemetry.pir?.motionDetected || false;

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header
        title="BlinkSafe"
        isOnline={isOnline}
        showSimulateButton={false}
      />

      <ScrollView
        style={styles.container}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.accent}
          />
        }
      >
        {/* 1. Classic System Status Hero Banner */}
        <View
          style={[
            styles.heroBanner,
            !isOnline
              ? styles.heroDisconnected
              : hasAnyAlert
              ? styles.heroEmergency
              : styles.heroNormal,
          ]}
        >
          <View style={styles.heroHeaderRow}>
            <Text style={styles.heroTag}>SYSTEM STATUS</Text>
            <View
              style={[
                styles.livePill,
                {
                  backgroundColor: !isOnline
                    ? Colors.critical
                    : hasAnyAlert
                    ? Colors.critical
                    : Colors.safe,
                },
              ]}
            >
              <Text style={styles.liveText}>
                {!isOnline ? 'OFFLINE' : hasAnyAlert ? 'HAZARD ACTIVE' : 'MONITORING'}
              </Text>
            </View>
          </View>

          {!isOnline ? (
            <View style={styles.statusContent}>
              <Text style={styles.statusMainTitle}>COMMON NODE DISCONNECTED</Text>
              <Text style={styles.statusSub}>
                Local hardware BLE connectivity unavailable. Safety events cannot be received until reconnected.
              </Text>
              <TouchableOpacity
                style={styles.reconnectBtn}
                onPress={() => navigation.navigate('DevicesTab')}
              >
                <Text style={styles.reconnectBtnText}>ENABLE BLUETOOTH / PAIR HUB</Text>
              </TouchableOpacity>
            </View>
          ) : hasAnyAlert && latestActive ? (
            <View style={styles.statusContent}>
              <Text style={styles.statusEmergencyTitle}>
                ⚠ {latestActive.title?.toUpperCase() || 'HAZARD DETECTED'}
              </Text>
              <Text style={styles.statusSubEmergency}>
                Location: {latestActive.location} • Node: {latestActive.deviceName || latestActive.nodeId}
              </Text>

              {/* UNMISSABLE IMMEDIATE ACKNOWLEDGE BUTTON */}
              <View style={styles.emergencyHeroActions}>
                {latestActive.state === 'ACTIVE' ? (
                  <PrimaryButton
                    title="⚡ ACKNOWLEDGE & MUTE HAZARD"
                    variant="critical"
                    size="large"
                    onPress={() => handleAcknowledge(latestActive.id)}
                    style={styles.largeHeroAckBtn}
                  />
                ) : (
                  <View style={styles.heroAckedNotice}>
                    <Text style={styles.heroAckedNoticeText}>
                      ✓ ACKNOWLEDGED (BLE ACK SENT TO ESP32)
                    </Text>
                  </View>
                )}

                <TouchableOpacity
                  style={styles.heroDetailBtn}
                  onPress={() => handleAlertCardPress(latestActive)}
                >
                  <Text style={styles.heroDetailBtnText}>
                    OPEN EMERGENCY ACTIONS & MAP →
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.statusContent}>
              <Text style={styles.statusNormalTitle}>✓ All systems normal</Text>
              <Text style={styles.statusSub}>
                BlinkSafe background monitor active. Connected to {deviceName} ({rssi} dBm).
              </Text>
            </View>
          )}
        </View>

        {/* 2. Device & Bluetooth Hub Quick Status Card */}
        <TouchableOpacity
          style={styles.connectionCard}
          activeOpacity={0.8}
          onPress={() => navigation.navigate('DevicesTab')}
        >
          <View style={styles.connLeft}>
            <View
              style={[
                styles.statusDot,
                {
                  backgroundColor: isOnline
                    ? Colors.safe
                    : connectionStatus === 'CONNECTING'
                    ? Colors.warning
                    : Colors.critical,
                },
              ]}
            />
            <View>
              <Text style={styles.connDeviceName}>{deviceName}</Text>
              <Text style={styles.connSubText}>
                {isOnline
                  ? `BLE Connected • ${rssi} dBm • ESP-NOW Mesh Active`
                  : connectionStatus === 'CONNECTING'
                  ? 'Connecting to Bluetooth Hub...'
                  : 'Disconnected • Tap to Scan & Connect Nodes'}
              </Text>
            </View>
          </View>
          <View style={styles.connActionBadge}>
            <Text style={styles.connActionText}>{isOnline ? 'Manage' : 'Scan'}</Text>
          </View>
        </TouchableOpacity>

        {/* 3. The 4-Grid Key Metrics */}
        <View style={styles.metricsGrid}>
          <MetricCard
            value={activeAlerts.length}
            label="Active Alerts"
            sublabel="Real-time"
            icon="🚨"
            isAlert={activeAlerts.length > 0}
            onPress={() => navigation.navigate('AlertsTab')}
          />
          <MetricCard
            value={isOnline ? 1 : 0}
            label="Central Hub"
            sublabel={isOnline ? 'BLE Linked' : 'Offline'}
            icon="📡"
            onPress={() => navigation.navigate('DevicesTab')}
          />
          <MetricCard
            value="82%"
            label="Tactile Wristband"
            sublabel="RF Connected"
            icon="⌚"
            onPress={() => navigation.navigate('DevicesTab')}
          />
          <MetricCard
            value="ONLINE"
            label="AI Engine"
            sublabel="YAMNet Edge"
            icon="🧠"
            onPress={() => setShowSimModal(true)}
          />
        </View>

        {/* 4. Live Multi-Sensor Telemetry Grid (ESP32 Live Data) */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>LIVE HARDWARE SENSORS (ESP32 TELEMETRY)</Text>
          <Text style={styles.sectionSub}>Real-time sensor signals evaluated by Central Hub</Text>
        </View>

        <View style={styles.sensorGrid}>
          {/* MQ-2 Smoke & Combustible Gas */}
          <View style={[styles.sensorCard, mq2Status !== 'normal' && styles.sensorWarningCard]}>
            <View style={styles.sensorTopRow}>
              <Text style={styles.sensorIcon}>💨</Text>
              <View
                style={[
                  styles.sensorBadge,
                  mq2Status === 'critical'
                    ? styles.badgeRed
                    : mq2Status === 'elevated'
                    ? styles.badgeYellow
                    : styles.badgeGreen,
                ]}
              >
                <Text style={styles.sensorBadgeText}>{mq2Status.toUpperCase()}</Text>
              </View>
            </View>
            <Text style={styles.sensorName}>MQ-2 Smoke / Gas</Text>
            <Text style={styles.sensorValue}>{telemetry.mq2?.ppm || 140} ppm</Text>
            <Text style={styles.sensorDetail}>Combustible smoke level</Text>
          </View>

          {/* MQ-135 Air Quality */}
          <View style={[styles.sensorCard, mq135Status === 'hazardous' && styles.sensorWarningCard]}>
            <View style={styles.sensorTopRow}>
              <Text style={styles.sensorIcon}>🍃</Text>
              <View
                style={[
                  styles.sensorBadge,
                  mq135Status === 'hazardous'
                    ? styles.badgeRed
                    : mq135Status === 'poor'
                    ? styles.badgeYellow
                    : styles.badgeGreen,
                ]}
              >
                <Text style={styles.sensorBadgeText}>{mq135Status.toUpperCase()}</Text>
              </View>
            </View>
            <Text style={styles.sensorName}>MQ-135 Air Quality</Text>
            <Text style={styles.sensorValue}>{telemetry.mq135?.ppm || 210} ppm</Text>
            <Text style={styles.sensorDetail}>Toxic gases & CO2 purity</Text>
          </View>

          {/* IR Flame Sensor */}
          <View style={[styles.sensorCard, irFlame && styles.sensorDangerCard]}>
            <View style={styles.sensorTopRow}>
              <Text style={styles.sensorIcon}>🔥</Text>
              <View style={[styles.sensorBadge, irFlame ? styles.badgeRed : styles.badgeGreen]}>
                <Text style={styles.sensorBadgeText}>{irFlame ? 'FLAME' : 'SAFE'}</Text>
              </View>
            </View>
            <Text style={styles.sensorName}>IR Flame Optical</Text>
            <Text style={[styles.sensorValue, irFlame && { color: Colors.critical }]}>
              {irFlame ? 'Flame Detected!' : 'No Flame'}
            </Text>
            <Text style={styles.sensorDetail}>Infrared optical detection</Text>
          </View>

          {/* Mic Acoustic Sensor */}
          <View style={[styles.sensorCard, micSiren && styles.sensorDangerCard]}>
            <View style={styles.sensorTopRow}>
              <Text style={styles.sensorIcon}>🔊</Text>
              <View style={[styles.sensorBadge, micSiren ? styles.badgeRed : styles.badgeGreen]}>
                <Text style={styles.sensorBadgeText}>{micSiren ? 'ALARM' : 'NORMAL'}</Text>
              </View>
            </View>
            <Text style={styles.sensorName}>Mic Acoustic Sensor</Text>
            <Text style={styles.sensorValue}>{telemetry.mic?.dbLevel || 38} dB</Text>
            <Text style={styles.sensorDetail}>
              {micSiren ? 'Siren Frequency Matched' : 'Ambient Noise Level'}
            </Text>
          </View>

          {/* PIR Motion Sensor */}
          <View style={styles.sensorCardFull}>
            <View style={styles.sensorTopRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={styles.sensorIcon}>🚶</Text>
                <View style={{ marginLeft: Spacing.sm }}>
                  <Text style={styles.sensorName}>PIR Motion & Presence</Text>
                  <Text style={styles.sensorDetail}>Human activity & occupancy detection</Text>
                </View>
              </View>
              <View style={[styles.sensorBadge, pirMotion ? styles.badgeBlue : styles.badgeGreen]}>
                <Text style={styles.sensorBadgeText}>
                  {pirMotion ? 'MOTION DETECTED' : 'CLEAR'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* 5. Active Hazards List (with Unmissable ACK button) */}
        {activeAlerts.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>ACTIVE HAZARDS ({activeAlerts.length})</Text>
              <TouchableOpacity onPress={() => navigation.navigate('AlertsTab')}>
                <Text style={styles.viewAllText}>View All →</Text>
              </TouchableOpacity>
            </View>

            {activeAlerts.map((alert) => (
              <AlertCard
                key={alert.id}
                alert={alert}
                onPress={() => handleAlertCardPress(alert)}
                onAcknowledge={handleAcknowledge}
                onResolve={handleResolve}
                onViewRoute={handleViewRoute}
              />
            ))}
          </View>
        )}

        {/* 6. Recent Activity Feed Timeline */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>RECENT ACTIVITY FEED</Text>
          <View style={styles.timelineCard}>
            <View style={styles.activityItem}>
              <View style={styles.activityIconWrap}>
                <Text style={styles.activityIcon}>🔔</Text>
              </View>
              <View style={styles.activityDetails}>
                <Text style={styles.activityTitle}>Doorbell detected</Text>
                <Text style={styles.activityLocation}>Main Entrance • Contact Sensor</Text>
              </View>
              <Text style={styles.activityTime}>2 min ago</Text>
            </View>

            <View style={styles.timelineDivider} />

            <View style={styles.activityItem}>
              <View style={styles.activityIconWrap}>
                <Text style={styles.activityIcon}>🏃</Text>
              </View>
              <View style={styles.activityDetails}>
                <Text style={styles.activityTitle}>Motion detected</Text>
                <Text style={styles.activityLocation}>Living Room • PIR Node 01</Text>
              </View>
              <Text style={styles.activityTime}>8 min ago</Text>
            </View>

            <View style={styles.timelineDivider} />

            <View style={styles.activityItem}>
              <View style={styles.activityIconWrap}>
                <Text style={styles.activityIcon}>✊</Text>
              </View>
              <View style={styles.activityDetails}>
                <Text style={styles.activityTitle}>Knocking detected</Text>
                <Text style={styles.activityLocation}>Bedroom • INMP441 Acoustic</Text>
              </View>
              <Text style={styles.activityTime}>25 min ago</Text>
            </View>
          </View>
        </View>

        {/* 7. Quick Simulation Test Card */}
        <View style={styles.testSection}>
          <TouchableOpacity
            style={styles.testCard}
            onPress={() => setShowSimModal(true)}
          >
            <View style={styles.testCardInner}>
              <Text style={styles.testIcon}>⚡</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.testTitle}>Test Hardware & Signal Simulation</Text>
                <Text style={styles.testSub}>
                  Simulate ESP32 Fire, Gas, Smoke, or Distress packets & test ACK
                </Text>
              </View>
              <Text style={{ color: Colors.accent, fontWeight: '700' }}>TEST →</Text>
            </View>
          </TouchableOpacity>
        </View>

        <View style={{ height: Spacing.xxl }} />
      </ScrollView>

      {/* Simulation Bottom Sheet */}
      <SimulateModal
        visible={showSimModal}
        onClose={() => setShowSimModal(false)}
      />
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
  heroBanner: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    marginTop: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1.5,
  },
  heroNormal: {
    backgroundColor: Colors.cardBackground,
    borderColor: Colors.cardBorder,
  },
  heroEmergency: {
    backgroundColor: Colors.criticalBg,
    borderColor: Colors.criticalBorder,
    borderWidth: 2,
  },
  heroDisconnected: {
    backgroundColor: '#1E1010',
    borderColor: Colors.criticalDark,
  },
  heroHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  heroTag: {
    ...Typography.caption,
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  livePill: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
  },
  liveText: {
    ...Typography.caption,
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  statusContent: {
    marginTop: Spacing.xs,
  },
  statusNormalTitle: {
    ...Typography.h2,
    color: Colors.safeLight,
  },
  statusEmergencyTitle: {
    ...Typography.h2,
    color: Colors.criticalLight,
    fontWeight: '900',
    fontSize: 20,
  },
  statusMainTitle: {
    ...Typography.h3,
    color: Colors.criticalLight,
  },
  statusSub: {
    ...Typography.bodyMedium,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
    lineHeight: 18,
  },
  statusSubEmergency: {
    ...Typography.bodyMedium,
    color: '#FECACA',
    marginTop: Spacing.xs,
    fontWeight: '600',
  },
  emergencyHeroActions: {
    marginTop: Spacing.md,
    gap: Spacing.sm,
  },
  largeHeroAckBtn: {
    width: '100%',
  },
  heroAckedNotice: {
    backgroundColor: '#064E3B',
    paddingVertical: 12,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#10B981',
  },
  heroAckedNoticeText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 12,
    letterSpacing: 0.5,
  },
  heroDetailBtn: {
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    paddingVertical: 10,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.criticalBorder,
  },
  heroDetailBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
  },
  reconnectBtn: {
    marginTop: Spacing.md,
    backgroundColor: Colors.critical,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  reconnectBtnText: {
    ...Typography.bodySmall,
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 12,
  },
  connectionCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  connLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: Spacing.sm,
  },
  connDeviceName: {
    ...Typography.bodyLarge,
    color: Colors.textPrimary,
    fontWeight: '700',
  },
  connSubText: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  connActionBadge: {
    backgroundColor: Colors.cardBackgroundElevated,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.cardBorderActive,
  },
  connActionText: {
    ...Typography.bodySmall,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -Spacing.xs,
    marginBottom: Spacing.md,
  },
  sectionHeader: {
    marginTop: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  sectionTitle: {
    ...Typography.caption,
    fontSize: 12,
    letterSpacing: 1.2,
    color: Colors.textSecondary,
    fontWeight: '800',
  },
  sectionSub: {
    ...Typography.bodySmall,
    color: Colors.textMuted,
    fontSize: 11,
    marginTop: 2,
    marginBottom: Spacing.sm,
  },
  sensorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  sensorCard: {
    width: '48.5%',
    backgroundColor: Colors.cardBackground,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  sensorCardFull: {
    width: '100%',
    backgroundColor: Colors.cardBackground,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  sensorWarningCard: {
    borderColor: Colors.warning,
    backgroundColor: Colors.warningBg,
  },
  sensorDangerCard: {
    borderColor: Colors.critical,
    backgroundColor: Colors.criticalBg,
  },
  sensorTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  sensorIcon: {
    fontSize: 20,
  },
  sensorBadge: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
  },
  badgeGreen: {
    backgroundColor: '#14532D',
  },
  badgeYellow: {
    backgroundColor: '#78350F',
  },
  badgeRed: {
    backgroundColor: '#7F1D1D',
  },
  badgeBlue: {
    backgroundColor: '#1E3A8A',
  },
  sensorBadgeText: {
    color: '#F8FAFC',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  sensorName: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    fontWeight: '600',
    marginTop: 4,
  },
  sensorValue: {
    fontSize: 17,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginTop: 2,
  },
  sensorDetail: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
  section: {
    marginBottom: Spacing.lg,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  viewAllText: {
    ...Typography.bodySmall,
    color: Colors.accent,
    fontWeight: '700',
  },
  timelineCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  activityIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.cardBackgroundElevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  activityIcon: {
    fontSize: 18,
  },
  activityDetails: {
    flex: 1,
  },
  activityTitle: {
    ...Typography.h4,
    color: Colors.textPrimary,
    fontSize: 14,
  },
  activityLocation: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  activityTime: {
    ...Typography.caption,
    color: Colors.textMuted,
    fontSize: 10,
  },
  timelineDivider: {
    height: 1,
    backgroundColor: Colors.cardBorder,
    marginVertical: Spacing.xs,
  },
  testSection: {
    marginBottom: Spacing.md,
  },
  testCard: {
    backgroundColor: Colors.cardBackgroundElevated,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.cardBorderActive,
  },
  testCardInner: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  testIcon: {
    fontSize: 22,
    marginRight: Spacing.md,
  },
  testTitle: {
    ...Typography.bodyMedium,
    color: Colors.textPrimary,
    fontWeight: '700',
  },
  testSub: {
    ...Typography.bodySmall,
    color: Colors.textMuted,
    marginTop: 2,
  },
});

