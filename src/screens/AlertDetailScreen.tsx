import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
} from 'react-native';
import { Colors, Typography, Spacing, BorderRadius } from '../theme';
import { StatusBadge } from '../components/common/StatusBadge';
import { PrimaryButton } from '../components/common/PrimaryButton';
import { Alert } from '../models/alert';
import { alertManager } from '../services/AlertManager';

interface AlertDetailScreenProps {
  route: any;
  navigation: any;
}

export const AlertDetailScreen: React.FC<AlertDetailScreenProps> = ({ route, navigation }) => {
  const alertId = route.params?.alertId;
  const [alert, setAlert] = useState<Alert | null>(null);

  useEffect(() => {
    const loadAlert = () => {
      const found = alertManager.getAlertById(alertId);
      setAlert(found || null);
    };
    loadAlert();
    const unsubscribe = alertManager.subscribe(() => loadAlert());
    return () => unsubscribe();
  }, [alertId]);

  if (!alert) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Alert Not Found</Text>
          <PrimaryButton
            title="GO BACK"
            variant="primary"
            onPress={() => navigation.goBack()}
            style={{ marginTop: Spacing.md }}
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
    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.headerBar}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          accessibilityLabel="Back"
        >
          <Text style={styles.backBtnText}>← BACK</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>ALERT DETAILS</Text>
        <View style={{ width: 48 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Title Header Card */}
        <View style={styles.headerCard}>
          <View style={styles.topRow}>
            <Text style={styles.alertTitle}>{alert.title}</Text>
            <StatusBadge severity={alert.severity} />
          </View>

            <Text style={styles.locationText}>📍 {alert.location} • Reporting Node: {alert.deviceName || alert.nodeId}</Text>
            <Text style={styles.messageText}>{alert.message}</Text>

            <View style={styles.statusPillRow}>
              <View
                style={[
                  styles.statePill,
                  isActive
                    ? styles.stateActive
                    : isAcknowledged
                    ? styles.stateAck
                    : styles.stateResolved,
                ]}
              >
                <Text style={styles.stateText}>
                  {isActive ? '● ACTIVE HAZARD' : isAcknowledged ? '✓ ACKNOWLEDGED' : '✓ RESOLVED'}
                </Text>
              </View>
            </View>

            {/* Immediate Action in Header Card */}
            {isActive && (
              <PrimaryButton
                title="⚡ ACKNOWLEDGE ALERT & MUTE"
                variant="critical"
                size="medium"
                onPress={handleAcknowledge}
                style={{ marginTop: Spacing.md }}
              />
            )}
            {isAcknowledged && (
              <View style={styles.ackNoticePill}>
                <Text style={styles.ackNoticeText}>✓ ACKNOWLEDGED (BLE ACK SENT TO ESP32)</Text>
              </View>
            )}
          </View>

        {/* Audit Log / Timestamps */}
        <View style={styles.card}>
          <Text style={styles.cardHeaderTitle}>INCIDENT TIMELINE</Text>

          <View style={styles.timelineRow}>
            <Text style={styles.timelineLabel}>Triggered</Text>
            <Text style={styles.timelineValue}>
              {new Date(alert.createdAt).toLocaleString()}
            </Text>
          </View>

          {alert.acknowledgedAt && (
            <View style={styles.timelineRow}>
              <Text style={styles.timelineLabel}>Acknowledged</Text>
              <Text style={styles.timelineValue}>
                {new Date(alert.acknowledgedAt).toLocaleString()}
              </Text>
            </View>
          )}

          {alert.resolvedAt && (
            <View style={styles.timelineRow}>
              <Text style={styles.timelineLabel}>Resolved</Text>
              <Text style={styles.timelineValue}>
                {new Date(alert.resolvedAt).toLocaleString()}
              </Text>
            </View>
          )}

          <View style={styles.timelineRow}>
            <Text style={styles.timelineLabel}>Reporting Node</Text>
            <Text style={styles.timelineValue}>{alert.nodeId}</Text>
          </View>
        </View>

        {/* Sensor Evidence Matrix */}
        <View style={styles.card}>
          <Text style={styles.cardHeaderTitle}>SENSOR READINGS</Text>
          {alert.evidence && alert.evidence.length > 0 ? (
            alert.evidence.map((ev, idx) => (
              <View key={idx} style={styles.sensorItem}>
                <Text style={styles.sensorName}>{ev.sensorName}</Text>
                <Text style={styles.sensorReading}>{ev.reading}</Text>
              </View>
            ))
          ) : (
            <Text style={styles.noEvidenceText}>Sensor telemetry not available for this event.</Text>
          )}
        </View>

        <View style={{ height: Spacing.xxl }} />
      </ScrollView>

      {/* Action Footer */}
      {alert.state !== 'RESOLVED' && (
        <View style={styles.bottomBar}>
          {isActive && (
            <PrimaryButton
              title="ACKNOWLEDGE ALERT"
              variant="primary"
              size="large"
              onPress={handleAcknowledge}
            />
          )}

          {isAcknowledged && (
            <PrimaryButton
              title="MARK AS RESOLVED"
              variant="safe"
              size="large"
              onPress={handleResolve}
            />
          )}
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
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
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.backgroundSecondary,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorder,
  },
  backBtn: {
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    backgroundColor: Colors.cardBackgroundElevated,
    borderRadius: BorderRadius.sm,
  },
  backBtnText: {
    ...Typography.caption,
    color: Colors.textPrimary,
    fontWeight: '800',
  },
  headerTitle: {
    ...Typography.h3,
    color: Colors.textPrimary,
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  headerCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    marginBottom: Spacing.md,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.xs,
  },
  alertTitle: {
    ...Typography.h2,
    color: Colors.textPrimary,
    flex: 1,
    paddingRight: Spacing.sm,
  },
  locationText: {
    ...Typography.h4,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
  },
  messageText: {
    ...Typography.bodyLarge,
    color: '#CBD5E1',
    lineHeight: 22,
  },
  statusPillRow: {
    marginTop: Spacing.md,
  },
  statePill: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
    alignSelf: 'flex-start',
  },
  stateActive: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderWidth: 1,
    borderColor: Colors.critical,
  },
  stateAck: {
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    borderWidth: 1,
    borderColor: Colors.warning,
  },
  stateResolved: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderWidth: 1,
    borderColor: Colors.safe,
  },
  stateText: {
    ...Typography.caption,
    fontSize: 11,
    fontWeight: '900',
    color: Colors.textPrimary,
  },
  card: {
    backgroundColor: Colors.cardBackground,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  cardHeaderTitle: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: Spacing.sm,
  },
  timelineRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.xs + 2,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorder,
  },
  timelineLabel: {
    ...Typography.bodyMedium,
    color: Colors.textSecondary,
  },
  timelineValue: {
    ...Typography.bodyMedium,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  sensorItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorder,
  },
  sensorName: {
    ...Typography.bodyMedium,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  sensorReading: {
    ...Typography.caption,
    color: Colors.criticalLight,
    fontWeight: '700',
  },
  noEvidenceText: {
    ...Typography.bodyMedium,
    color: Colors.textMuted,
  },
  bottomBar: {
    backgroundColor: Colors.cardBackground,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: 48,
    borderTopWidth: 1,
    borderTopColor: Colors.cardBorder,
  },
  ackNoticePill: {
    backgroundColor: '#064E3B',
    paddingVertical: 10,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#10B981',
    marginTop: Spacing.md,
  },
  ackNoticeText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 12,
    letterSpacing: 0.5,
  },
});

