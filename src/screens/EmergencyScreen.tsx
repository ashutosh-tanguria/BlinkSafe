import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  Animated,
  TouchableOpacity,
} from 'react-native';
import { Colors, Typography, Spacing, BorderRadius } from '../theme';
import { StatusBadge } from '../components/common/StatusBadge';
import { PrimaryButton } from '../components/common/PrimaryButton';
import { Alert } from '../models/alert';
import { alertManager } from '../services/AlertManager';

interface EmergencyScreenProps {
  route: any;
  navigation: any;
}

export const EmergencyScreen: React.FC<EmergencyScreenProps> = ({ route, navigation }) => {
  const alertId = route.params?.alertId;
  const [alert, setAlert] = useState<Alert | null>(null);
  const [pulseAnim] = useState(new Animated.Value(1));

  useEffect(() => {
    const updateAlert = () => {
      const found = alertId ? alertManager.getAlertById(alertId) : alertManager.getLatestCriticalAlert();
      setAlert(found || null);
    };

    updateAlert();
    const unsubscribe = alertManager.subscribe(() => updateAlert());
    return () => unsubscribe();
  }, [alertId]);

  useEffect(() => {
    if (alert && alert.state === 'ACTIVE') {
      const animation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.04,
            duration: 450,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 450,
            useNativeDriver: true,
          }),
        ])
      );
      animation.start();
      return () => animation.stop();
    }
  }, [alert, pulseAnim]);

  if (!alert) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No Active Critical Emergency</Text>
          <PrimaryButton
            title="RETURN TO HOME"
            variant="primary"
            onPress={() => navigation.navigate('HomeTab')}
            style={{ marginTop: Spacing.lg }}
          />
        </View>
      </SafeAreaView>
    );
  }

  const isActive = alert.state === 'ACTIVE';
  const isAcknowledged = alert.state === 'ACKNOWLEDGED';

  const handleAcknowledge = async () => {
    await alertManager.acknowledgeAlert(alert.id);
  };

  const handleResolve = async () => {
    await alertManager.resolveAlert(alert.id);
    navigation.navigate('HomeTab');
  };

  const handleViewSafeRoute = () => {
    navigation.navigate('Evacuation', { alertId: alert.id, location: alert.location });
  };

  const formatElapsed = (timestamp: number) => {
    const diff = Math.floor((Date.now() - timestamp) / 1000);
    return `Detected ${Math.max(1, diff)} seconds ago`;
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Top Fixed Sticky Navigation Bar */}
      <View style={styles.topNav}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          accessibilityLabel="Go back"
        >
          <Text style={styles.backBtnText}>← RETURN</Text>
        </TouchableOpacity>
        <Text style={styles.topNavTitle}>EMERGENCY PROTOCOL</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={true}
      >
        {/* 1. TOP EMERGENCY HERO - IMMEDIATELY VISIBLE & ACTIONABLE */}
        <Animated.View
          style={[
            styles.heroHeader,
            { transform: [{ scale: isActive ? pulseAnim : 1 }] },
          ]}
        >
          <View style={styles.heroTopRow}>
            <Text style={styles.emergencyIcon}>
              {alert.type === 'fire' ? '🔥' : alert.type === 'gas_leak' ? '🟡' : '🚨'}
            </Text>
            <View style={styles.badgeWrapper}>
              <StatusBadge severity={alert.severity} />
            </View>
          </View>

          <Text style={styles.heroTitle}>{alert.title}</Text>
          <Text style={styles.heroLocation}>LOCATION: {alert.location.toUpperCase()}</Text>
          <Text style={styles.heroElapsed}>{formatElapsed(alert.createdAt)}</Text>

          {/* 2. THE TOP PRIORITY ACTIONS - IMMEDIATELY UNDER ALERT INFO */}
          <View style={styles.immediateActionWrap}>
            {isActive ? (
              <PrimaryButton
                title="⚡ ACKNOWLEDGE & MUTE HAZARD"
                variant="critical"
                size="large"
                onPress={handleAcknowledge}
                style={styles.heroActionBtn}
                accessibilityLabel="Acknowledge critical hazard"
              />
            ) : (
              <View style={styles.ackNoticePill}>
                <Text style={styles.ackNoticeText}>
                  ✓ ACKNOWLEDGED (BLE ACK SENT TO ESP32)
                </Text>
              </View>
            )}

            {isActive && alert.safeRouteAvailable && (
              <PrimaryButton
                title="🏃 VIEW SAFE EVACUATION ROUTE →"
                variant="secondary"
                size="large"
                onPress={handleViewSafeRoute}
                style={styles.routeActionBtn}
                accessibilityLabel="Open evacuation floor plan"
              />
            )}

            {isAcknowledged && (
              <PrimaryButton
                title="✓ RESOLVE HAZARD (ALL CLEAR)"
                variant="safe"
                size="large"
                onPress={handleResolve}
                style={styles.resolveActionBtn}
                accessibilityLabel="Resolve and archive hazard"
              />
            )}
          </View>
        </Animated.View>

        {/* 3. DETAILS BODY (SCROLLABLE, NEVER HIDING) */}
        <View style={styles.bodyContent}>
          {/* Hardware Status Strip */}
          <View style={styles.statusStrip}>
            <View style={styles.statusCol}>
              <Text style={styles.stripLabel}>WRISTBAND</Text>
              <Text style={styles.stripValue}>RF CONNECTED</Text>
            </View>
            <View style={styles.stripDivider} />
            <View style={styles.statusCol}>
              <Text style={styles.stripLabel}>PHONE HAPTICS</Text>
              <Text
                style={[
                  styles.stripValue,
                  { color: isActive ? Colors.criticalLight : Colors.safeLight },
                ]}
              >
                {isActive ? 'VIBRATING' : 'MUTED'}
              </Text>
            </View>
          </View>

          {/* Hazard Message */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>HAZARD DESCRIPTION</Text>
            <Text style={styles.cardText}>{alert.message}</Text>
          </View>

          {/* Dynamic Evacuation Steps (if sent by ESP32) */}
          {alert.evacuationSteps && alert.evacuationSteps.length > 0 && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>ESP32 EVACUATION GUIDANCE</Text>
              {alert.evacuationSteps.map((step, idx) => (
                <View key={idx} style={styles.evacStepRow}>
                  <View style={styles.evacStepNumber}>
                    <Text style={styles.evacStepNumberText}>{idx + 1}</Text>
                  </View>
                  <Text style={styles.evacStepText}>{step}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Sensor Evidence Section (Clean wrap, no text collision!) */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>SENSOR EVIDENCE MATRIX</Text>
            {alert.evidence && alert.evidence.length > 0 ? (
              alert.evidence.map((item, idx) => (
                <View key={idx} style={styles.sensorItem}>
                  <View style={styles.sensorLeft}>
                    <Text style={styles.sensorName}>{item.sensorName}</Text>
                    {item.sensorId ? (
                      <Text style={styles.sensorId}>{item.sensorId}</Text>
                    ) : null}
                  </View>
                  <View style={styles.readingBadge}>
                    <Text style={styles.readingText}>{item.reading}</Text>
                  </View>
                </View>
              ))
            ) : (
              <View style={styles.sensorItem}>
                <View style={styles.sensorLeft}>
                  <Text style={styles.sensorName}>Acoustic/Environmental Sensors</Text>
                </View>
                <View style={styles.readingBadge}>
                  <Text style={styles.readingText}>Multi-modal Trigger</Text>
                </View>
              </View>
            )}
          </View>

          {/* Confidence Card */}
          <View style={styles.card}>
            <View style={styles.confRow}>
              <Text style={styles.cardTitle}>CONFIDENCE RATING</Text>
              <Text style={styles.confScore}>{(alert.confidence * 100).toFixed(0)}%</Text>
            </View>
            <View style={styles.meterTrack}>
              <View
                style={[
                  styles.meterFill,
                  { width: `${Math.min(100, alert.confidence * 100)}%` },
                ]}
              />
            </View>
          </View>

          {/* Secondary Action at bottom for convenience */}
          {isActive && (
            <PrimaryButton
              title="⚡ ACKNOWLEDGE & MUTE"
              variant="critical"
              size="large"
              onPress={handleAcknowledge}
              style={{ marginTop: Spacing.sm }}
            />
          )}

          <View style={{ height: 40 }} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#070B13',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  emptyText: {
    ...Typography.h2,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  heroHeader: {
    backgroundColor: Colors.criticalBg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.md,
    paddingHorizontal: Spacing.lg,
    alignItems: 'center',
    borderBottomWidth: 3,
    borderBottomColor: Colors.criticalBorder,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  backBtn: {
    alignSelf: 'flex-start',
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: BorderRadius.sm,
  },
  backBtnText: {
    ...Typography.caption,
    color: '#FFFFFF',
    fontWeight: '800',
  },
  emergencyIcon: {
    fontSize: 40,
  },
  heroTitle: {
    ...Typography.emergencyTitle,
    fontSize: 24,
    textAlign: 'center',
    marginTop: 4,
  },
  heroLocation: {
    ...Typography.h3,
    color: '#FECACA',
    marginTop: 2,
    fontSize: 15,
  },
  heroElapsed: {
    ...Typography.bodySmall,
    color: '#FCA5A5',
    marginTop: 2,
    fontSize: 12,
  },
  badgeWrapper: {
    marginLeft: Spacing.xs,
  },
  scrollArea: {
    flex: 1,
    backgroundColor: '#070B13',
  },
  scrollContent: {
    paddingBottom: 100,
  },
  bodyContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  statusStrip: {
    flexDirection: 'row',
    backgroundColor: Colors.cardBackgroundElevated,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  statusCol: {
    flex: 1,
  },
  stripLabel: {
    ...Typography.caption,
    fontSize: 10,
    color: Colors.textMuted,
  },
  stripValue: {
    ...Typography.h4,
    fontSize: 13,
    color: Colors.textPrimary,
    marginTop: 2,
  },
  stripDivider: {
    width: 1,
    backgroundColor: Colors.cardBorder,
    marginHorizontal: Spacing.md,
  },
  card: {
    backgroundColor: Colors.cardBackground,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  cardTitle: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: Spacing.sm,
  },
  cardText: {
    ...Typography.bodyLarge,
    color: Colors.textPrimary,
  },
  sensorItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorder,
    gap: Spacing.sm,
  },
  sensorLeft: {
    flex: 1,
    paddingRight: Spacing.xs,
  },
  sensorName: {
    ...Typography.h4,
    color: Colors.textPrimary,
    fontSize: 13,
  },
  sensorId: {
    ...Typography.caption,
    color: Colors.textMuted,
    fontSize: 10,
    marginTop: 2,
  },
  readingBadge: {
    backgroundColor: Colors.cardBackgroundElevated,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 5,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.criticalBorder,
    maxWidth: '52%',
    alignItems: 'flex-end',
  },
  readingText: {
    ...Typography.caption,
    color: Colors.criticalLight,
    fontWeight: '800',
    fontSize: 11,
    textAlign: 'right',
  },
  confRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  confScore: {
    ...Typography.h2,
    color: Colors.safeLight,
  },
  meterTrack: {
    height: 8,
    backgroundColor: Colors.cardBackgroundElevated,
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
    marginTop: Spacing.xs,
  },
  meterFill: {
    height: '100%',
    backgroundColor: Colors.safe,
    borderRadius: BorderRadius.full,
  },
  topNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: '#1E0A0A',
    borderBottomWidth: 1,
    borderBottomColor: '#450A0A',
  },
  topNavTitle: {
    ...Typography.caption,
    color: '#FCA5A5',
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  immediateActionWrap: {
    width: '100%',
    marginTop: Spacing.md,
    gap: Spacing.xs,
  },
  heroActionBtn: {
    width: '100%',
    backgroundColor: '#EF4444',
    borderWidth: 2,
    borderColor: '#FEE2E2',
  },
  routeActionBtn: {
    width: '100%',
    marginTop: Spacing.xs,
  },
  resolveActionBtn: {
    width: '100%',
    marginTop: Spacing.xs,
  },
  ackNoticePill: {
    backgroundColor: '#064E3B',
    paddingVertical: 10,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#10B981',
  },
  ackNoticeText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 12,
    letterSpacing: 0.5,
  },
  evacStepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  evacStepNumber: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.safe,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.sm,
  },
  evacStepNumberText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  evacStepText: {
    ...Typography.bodyMedium,
    color: Colors.textPrimary,
    flex: 1,
    fontSize: 13,
  },
  scrollActionSection: {
    marginTop: Spacing.md,
    marginBottom: Spacing.lg,
  },
  actionBtn: {
    width: '100%',
  },
});
