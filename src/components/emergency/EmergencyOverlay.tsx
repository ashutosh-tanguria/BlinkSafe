import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  ScrollView,
  Animated,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import { Alert } from '../../models/alert';
import { Colors, Typography, Spacing, BorderRadius } from '../../theme';
import { StatusBadge } from '../common/StatusBadge';

interface EmergencyOverlayProps {
  alert: Alert | null;
  onAcknowledge: (alertId: string) => void;
  onViewRoute: (alert: Alert) => void;
  onDismiss: () => void;
}

export const EmergencyOverlay: React.FC<EmergencyOverlayProps> = ({
  alert,
  onAcknowledge,
  onViewRoute,
  onDismiss,
}) => {
  const [pulseAnim] = useState(new Animated.Value(1));

  useEffect(() => {
    if (alert && alert.state === 'ACTIVE') {
      const animation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.04,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      );
      animation.start();
      return () => animation.stop();
    }
  }, [alert, pulseAnim]);

  if (!alert) return null;

  const isCritical = alert.severity === 'critical';
  const isActive = alert.state === 'ACTIVE';

  return (
    <Modal
      visible={!!alert}
      animationType="fade"
      transparent={false}
      statusBarTranslucent={true}
      onRequestClose={onDismiss}
    >
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Top Dismiss Button Bar */}
          <View style={styles.topBar}>
            <View style={styles.topLiveTag}>
              <View style={styles.liveDot} />
              <Text style={styles.liveTagText}>EMERGENCY SAFETY OVERLAY</Text>
            </View>
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={onDismiss}
              accessibilityLabel="Close overlay"
            >
              <Text style={styles.closeBtnText}>✕ CLOSE</Text>
            </TouchableOpacity>
          </View>

          {/* Urgent Hero Header */}
          <Animated.View
            style={[
              styles.emergencyHeader,
              { transform: [{ scale: isActive && isCritical ? pulseAnim : 1 }] },
            ]}
          >
            <Text style={styles.emergencyIcon}>
              {alert.type === 'fire' ? '🔥' : alert.type === 'gas_leak' ? '🟡' : '🚨'}
            </Text>
            <Text style={styles.emergencyTitle}>{alert.title}</Text>
            <Text style={styles.locationText}>
              NODE: {(alert.deviceName || alert.location || 'ESP32 CENTRAL HUB').toUpperCase()}
            </Text>
            <View style={styles.badgeWrap}>
              <StatusBadge severity={alert.severity} />
            </View>
          </Animated.View>

          {/* CRITICAL ACTIONS: PROMINENTLY AT THE TOP (ABOVE THE FOLD) */}
          <View style={styles.topActionsContainer}>
            {isActive ? (
              <TouchableOpacity
                style={styles.ackPrimaryBtn}
                onPress={() => onAcknowledge(alert.id)}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Acknowledge and mute emergency hazard"
              >
                <Text style={styles.ackBtnIcon}>⚡</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.ackBtnTitle}>ACKNOWLEDGE & MUTE HAZARD</Text>
                  <Text style={styles.ackBtnSubtitle}>
                    Mutes phone vibration & transmits BLE ACK to ESP32
                  </Text>
                </View>
              </TouchableOpacity>
            ) : (
              <View style={styles.ackedContainer}>
                <View style={styles.ackedBadge}>
                  <Text style={styles.ackedText}>✓ HAZARD ACKNOWLEDGED & MUTED</Text>
                  <Text style={styles.ackedSub}>BLE Confirmation sent to ESP32</Text>
                </View>
                <TouchableOpacity
                  style={styles.closeOverlayBtn}
                  onPress={onDismiss}
                  activeOpacity={0.8}
                >
                  <Text style={styles.closeOverlayText}>✕ DISMISS OVERLAY</Text>
                </TouchableOpacity>
              </View>
            )}

            {alert.safeRouteAvailable && (
              <TouchableOpacity
                style={styles.routePrimaryBtn}
                onPress={() => onViewRoute(alert)}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="View safe evacuation route"
              >
                <Text style={styles.routeBtnIcon}>🏃</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.routeBtnTitle}>VIEW SAFE EVACUATION ROUTE →</Text>
                  <Text style={styles.routeBtnSubtitle}>
                    AI evaluated hazard-free pathway
                  </Text>
                </View>
              </TouchableOpacity>
            )}
          </View>

          {/* Hardware Status Indicators */}
          <View style={styles.hardwareStatusBar}>
            <View style={styles.hwStatusItem}>
              <Text style={styles.hwIcon}>📡</Text>
              <View>
                <Text style={styles.hwLabel}>BLUETOOTH HUB</Text>
                <Text style={styles.hwValue}>
                  {alert.deviceName || 'ESP32 Hub'}
                </Text>
              </View>
            </View>

            <View style={styles.hwDivider} />

            <View style={styles.hwStatusItem}>
              <Text style={styles.hwIcon}>📳</Text>
              <View>
                <Text style={styles.hwLabel}>PHONE HAPTICS</Text>
                <Text
                  style={[
                    styles.hwValue,
                    { color: isActive ? Colors.criticalLight : Colors.safeLight },
                  ]}
                >
                  {isActive ? 'VIBRATING' : 'STOPPED'}
                </Text>
              </View>
            </View>
          </View>

          {/* Sensor Evidence Matrix */}
          <View style={styles.evidenceSection}>
            <Text style={styles.sectionHeaderTitle}>REAL SENSOR EVIDENCE TELEMETRY</Text>
            {alert.evidence && alert.evidence.length > 0 ? (
              alert.evidence.map((item, idx) => (
                <View key={idx} style={styles.evidenceCard}>
                  <View style={styles.evidenceRow}>
                    <Text style={styles.sensorName} numberOfLines={2}>
                      {item.sensorName}
                    </Text>
                    <View
                      style={[
                        styles.statusBadgeWrap,
                        item.status === 'critical'
                          ? styles.badgeBgCritical
                          : item.status === 'high' || item.status === 'elevated'
                          ? styles.badgeBgHigh
                          : styles.badgeBgNormal,
                      ]}
                    >
                      <Text
                        style={[
                          styles.sensorStatus,
                          item.status === 'critical'
                            ? styles.statusCritical
                            : item.status === 'high' || item.status === 'elevated'
                            ? styles.statusElevated
                            : styles.statusDetected,
                        ]}
                      >
                        {item.reading}
                      </Text>
                    </View>
                  </View>
                </View>
              ))
            ) : (
              <View style={styles.evidenceCard}>
                <Text style={styles.sensorName}>Acoustic / Environmental Sensors</Text>
                <Text style={styles.sensorStatus}>Triggered by Central ESP32 Node</Text>
              </View>
            )}
          </View>

          {/* AI Confidence Rating */}
          <View style={styles.confidenceCard}>
            <View style={styles.confRow}>
              <Text style={styles.confLabel}>CONFIDENCE RATING</Text>
              <Text style={styles.confValue}>{(alert.confidence * 100).toFixed(0)}%</Text>
            </View>
            <View style={styles.confTrack}>
              <View
                style={[
                  styles.confBar,
                  { width: `${Math.min(100, alert.confidence * 100)}%` },
                ]}
              />
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#070B13',
  },
  container: {
    flex: 1,
    backgroundColor: '#070B13',
  },
  scrollContent: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.xl,
    paddingBottom: 140, // Generous padding so nothing is ever blocked by Android nav buttons
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.xs,
  },
  topLiveTag: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
    marginRight: 6,
  },
  liveTagText: {
    ...Typography.caption,
    fontSize: 10,
    color: '#EF4444',
    fontWeight: '800',
    letterSpacing: 1,
  },
  closeBtn: {
    backgroundColor: '#1E293B',
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: '#334155',
  },
  closeBtnText: {
    ...Typography.caption,
    fontSize: 11,
    color: '#E2E8F0',
    fontWeight: '700',
  },
  emergencyHeader: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderRadius: BorderRadius.xl,
    borderWidth: 2,
    borderColor: '#EF4444',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  emergencyIcon: {
    fontSize: 44,
    marginBottom: 4,
  },
  emergencyTitle: {
    ...Typography.emergencyTitle,
    fontSize: 22,
    textAlign: 'center',
    color: '#FFFFFF',
    fontWeight: '900',
  },
  locationText: {
    ...Typography.h4,
    color: '#FCA5A5',
    marginTop: 4,
    fontWeight: '700',
    fontSize: 13,
  },
  badgeWrap: {
    marginTop: Spacing.sm,
  },
  topActionsContainer: {
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  ackPrimaryBtn: {
    backgroundColor: '#DC2626',
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#F87171',
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 8,
  },
  ackBtnIcon: {
    fontSize: 28,
    marginRight: Spacing.sm,
  },
  ackBtnTitle: {
    ...Typography.h4,
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 15,
  },
  ackBtnSubtitle: {
    ...Typography.caption,
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 11,
    marginTop: 2,
  },
  ackedContainer: {
    gap: Spacing.xs,
  },
  ackedBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderWidth: 1.5,
    borderColor: '#10B981',
    alignItems: 'center',
  },
  ackedText: {
    ...Typography.h4,
    color: '#34D399',
    fontWeight: '800',
    fontSize: 14,
  },
  ackedSub: {
    ...Typography.caption,
    color: '#A7F3D0',
    fontSize: 11,
    marginTop: 2,
  },
  closeOverlayBtn: {
    backgroundColor: '#1E293B',
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  closeOverlayText: {
    ...Typography.body,
    color: '#CBD5E1',
    fontWeight: '700',
    fontSize: 13,
  },
  routePrimaryBtn: {
    backgroundColor: '#059669',
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#34D399',
  },
  routeBtnIcon: {
    fontSize: 26,
    marginRight: Spacing.sm,
  },
  routeBtnTitle: {
    ...Typography.h4,
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
  routeBtnSubtitle: {
    ...Typography.caption,
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 11,
    marginTop: 2,
  },
  hardwareStatusBar: {
    flexDirection: 'row',
    backgroundColor: '#131823',
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: '#1E293B',
    marginBottom: Spacing.md,
  },
  hwStatusItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  hwIcon: {
    fontSize: 24,
    marginRight: Spacing.sm,
  },
  hwLabel: {
    ...Typography.caption,
    fontSize: 9,
    color: '#64748B',
    fontWeight: '700',
  },
  hwValue: {
    ...Typography.h4,
    fontSize: 13,
    color: '#F1F5F9',
    fontWeight: '700',
    marginTop: 1,
  },
  hwDivider: {
    width: 1,
    backgroundColor: '#1E293B',
    marginHorizontal: Spacing.sm,
  },
  evidenceSection: {
    marginBottom: Spacing.md,
  },
  sectionHeaderTitle: {
    ...Typography.caption,
    fontSize: 11,
    letterSpacing: 1.2,
    color: '#94A3B8',
    marginBottom: Spacing.sm,
    fontWeight: '800',
  },
  evidenceCard: {
    backgroundColor: '#131823',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.xs,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  evidenceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sensorName: {
    flex: 1,
    ...Typography.body,
    fontSize: 13,
    color: '#F1F5F9',
    fontWeight: '600',
    marginRight: Spacing.sm,
  },
  statusBadgeWrap: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    maxWidth: '55%',
  },
  badgeBgCritical: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderWidth: 1,
    borderColor: '#EF4444',
  },
  badgeBgHigh: {
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  badgeBgNormal: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    borderWidth: 1,
    borderColor: '#3B82F6',
  },
  sensorStatus: {
    ...Typography.caption,
    fontSize: 11,
    fontWeight: '700',
  },
  statusCritical: {
    color: '#FCA5A5',
  },
  statusElevated: {
    color: '#FDE68A',
  },
  statusDetected: {
    color: '#93C5FD',
  },
  confidenceCard: {
    backgroundColor: '#131823',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: '#1E293B',
    marginBottom: Spacing.lg,
  },
  confRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  confLabel: {
    ...Typography.caption,
    color: '#94A3B8',
    fontWeight: '700',
  },
  confValue: {
    ...Typography.h3,
    color: '#34D399',
    fontSize: 18,
    fontWeight: '900',
  },
  confTrack: {
    height: 8,
    backgroundColor: '#1E293B',
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
  },
  confBar: {
    height: '100%',
    backgroundColor: '#10B981',
    borderRadius: BorderRadius.full,
  },
});
