import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Typography, Spacing, BorderRadius } from '../../theme';
import { AlertSeverity } from '../../models/alert';

interface StatusBadgeProps {
  severity: AlertSeverity;
  showIcon?: boolean;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ severity, showIcon = true }) => {
  const getBadgeConfig = () => {
    switch (severity) {
      case 'critical':
        return {
          bg: Colors.criticalBg,
          border: Colors.criticalBorder,
          text: Colors.criticalLight,
          label: 'CRITICAL',
          icon: '⚠',
        };
      case 'high':
        return {
          bg: Colors.highPriorityBg,
          border: Colors.highPriorityBorder,
          text: Colors.highPriorityLight,
          label: 'HIGH PRIORITY',
          icon: '⚡',
        };
      case 'important':
        return {
          bg: Colors.warningBg,
          border: Colors.warningBorder,
          text: Colors.warningLight,
          label: 'IMPORTANT',
          icon: 'ℹ',
        };
      case 'informational':
      default:
        return {
          bg: Colors.informationalBg,
          border: Colors.informationalBorder,
          text: Colors.informationalLight,
          label: 'INFORMATIONAL',
          icon: '🔔',
        };
    }
  };

  const config = getBadgeConfig();

  return (
    <View
      style={[styles.badge, { backgroundColor: config.bg, borderColor: config.border }]}
      accessibilityLabel={`Severity: ${config.label}`}
    >
      {showIcon && <Text style={[styles.icon, { color: config.text }]}>{config.icon} </Text>}
      <Text style={[styles.label, { color: config.text }]}>{config.label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  icon: {
    fontSize: 11,
    fontWeight: '800',
  },
  label: {
    ...Typography.caption,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
});
