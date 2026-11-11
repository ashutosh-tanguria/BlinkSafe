import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Alert } from '../../models/alert';
import { Colors, Typography, Spacing, BorderRadius } from '../../theme';
import { StatusBadge } from './StatusBadge';
import { PrimaryButton } from './PrimaryButton';

interface AlertCardProps {
  alert: Alert;
  onPress?: () => void;
  onAcknowledge?: (id: string) => void;
  onResolve?: (id: string) => void;
  onViewRoute?: (alert: Alert) => void;
  showActions?: boolean;
}

const AlertCardComponent: React.FC<AlertCardProps> = ({
  alert,
  onPress,
  onAcknowledge,
  onResolve,
  onViewRoute,
  showActions = true,
}) => {
  const isCritical = alert.severity === 'critical';
  const isActive = alert.state === 'ACTIVE';
  const isAcknowledged = alert.state === 'ACKNOWLEDGED';
  const isResolved = alert.state === 'RESOLVED';

  const formatElapsedTime = (timestamp: number) => {
    const diffSeconds = Math.floor((Date.now() - timestamp) / 1000);
    if (diffSeconds < 60) return `${Math.max(1, diffSeconds)} sec ago`;
    const diffMinutes = Math.floor(diffSeconds / 60);
    if (diffMinutes < 60) return `${diffMinutes} min ago`;
    const diffHours = Math.floor(diffMinutes / 60);
    return `${diffHours} hr ago`;
  };

  const getBorderColor = () => {
    if (isActive) {
      if (isCritical) return Colors.critical;
      if (alert.severity === 'high') return Colors.highPriority;
      if (alert.severity === 'important') return Colors.warning;
      return Colors.informational;
    }
    if (isAcknowledged) return Colors.warningDark;
    return Colors.cardBorder;
  };

  const getBackgroundColor = () => {
    if (isActive && isCritical) return Colors.criticalBg;
    if (isActive && alert.severity === 'high') return Colors.highPriorityBg;
    return Colors.cardBackground;
  };

  return (
    <View
      style={[
        styles.card,
        {
          borderColor: getBorderColor(),
          backgroundColor: getBackgroundColor(),
          borderLeftWidth: isActive ? 5 : 1,
        },
      ]}
    >
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${alert.title} in ${alert.location}, severity ${alert.severity}, status ${alert.state}`}
      >
        {/* Top Header Row */}
        <View style={styles.headerRow}>
          <View style={styles.titleLocationBlock}>
            <Text style={styles.alertTitle} numberOfLines={1}>
              {alert.title}
            </Text>
            <Text style={styles.locationText}>
              📍 {alert.location} • <Text style={styles.timeText}>{formatElapsedTime(alert.createdAt)}</Text>
            </Text>
          </View>
          <StatusBadge severity={alert.severity} />
        </View>

        {/* Message and Confidence */}
        <Text style={styles.messageText}>{alert.message}</Text>

        {/* State Pill */}
        <View style={styles.stateRow}>
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
          <Text style={styles.confidenceText}>
            Confidence: {(alert.confidence * 100).toFixed(0)}%
          </Text>
        </View>
      </TouchableOpacity>

      {/* Action Buttons (Separated from parent touchable to guarantee clicks) */}
      {showActions && !isResolved && (
        <View style={styles.actionsContainer}>
          {isActive && onAcknowledge && (
            <PrimaryButton
              title="⚡ ACKNOWLEDGE & MUTE"
              variant={isCritical ? 'critical' : 'primary'}
              size="medium"
              onPress={() => onAcknowledge(alert.id)}
              style={styles.actionBtn}
              accessibilityLabel={`Acknowledge ${alert.title}`}
            />
          )}

          {isAcknowledged && onResolve && (
            <PrimaryButton
              title="✓ MARK AS RESOLVED"
              variant="safe"
              size="medium"
              onPress={() => onResolve(alert.id)}
              style={styles.actionBtn}
              accessibilityLabel={`Mark ${alert.title} as resolved`}
            />
          )}

          {alert.safeRouteAvailable && onViewRoute && (
            <PrimaryButton
              title="EVACUATION PATH →"
              variant="outline"
              size="medium"
              onPress={() => onViewRoute(alert)}
              style={styles.actionBtn}
              accessibilityLabel="View evacuation safe route"
            />
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.xs,
  },
  titleLocationBlock: {
    flex: 1,
    paddingRight: Spacing.sm,
  },
  alertTitle: {
    ...Typography.h3,
    color: Colors.textPrimary,
  },
  locationText: {
    ...Typography.bodyMedium,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  timeText: {
    color: Colors.textMuted,
    fontSize: 12,
  },
  messageText: {
    ...Typography.bodyMedium,
    color: '#CBD5E1',
    marginVertical: Spacing.sm,
  },
  stateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  statePill: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.sm,
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
    fontSize: 10,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  confidenceText: {
    ...Typography.caption,
    fontSize: 11,
    color: Colors.textSecondary,
  },
  actionsContainer: {
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.cardBorder,
    flexDirection: 'column',
    gap: Spacing.sm,
  },
  actionBtn: {
    width: '100%',
  },
});

export const AlertCard = React.memo(AlertCardComponent);

