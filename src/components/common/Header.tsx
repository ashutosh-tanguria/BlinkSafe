import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Colors, Typography, Spacing, BorderRadius } from '../../theme';

interface HeaderProps {
  title?: string;
  isOnline?: boolean;
  onNotificationPress?: () => void;
  onSimulationPress?: () => void;
  showSimulateButton?: boolean;
}

const HeaderComponent: React.FC<HeaderProps> = ({
  title = 'BlinkSafe',
  isOnline = true,
  onNotificationPress,
  onSimulationPress,
  showSimulateButton = false,
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.titleRow}>
        <View style={styles.logoBadge}>
          <Text style={styles.logoText}>⚡</Text>
        </View>
        <View>
          <Text style={styles.title} accessibilityRole="header">
            {title}
          </Text>
          <View style={styles.statusPill}>
            <View
              style={[
                styles.statusDot,
                { backgroundColor: isOnline ? Colors.statusOnline : Colors.statusOffline },
              ]}
            />
            <Text style={styles.statusText}>
              {isOnline ? 'SYSTEM ONLINE' : 'SYSTEM OFFLINE'}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.actionRow}>
        {showSimulateButton && onSimulationPress && (
          <TouchableOpacity
            style={styles.simButton}
            onPress={onSimulationPress}
            accessibilityLabel="Open Simulation Demo Menu"
            accessibilityRole="button"
          >
            <Text style={styles.simButtonText}>SIMULATE</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorder,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoBadge: {
    width: 42,
    height: 42,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.criticalBg,
    borderWidth: 1.5,
    borderColor: Colors.criticalBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  logoText: {
    fontSize: 22,
  },
  title: {
    ...Typography.h2,
    color: Colors.textPrimary,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    ...Typography.caption,
    fontSize: 10,
    color: Colors.textSecondary,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  simButton: {
    backgroundColor: Colors.cardBackgroundElevated,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 3,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.warning,
  },
  simButtonText: {
    ...Typography.caption,
    color: Colors.warning,
    fontSize: 10,
    fontWeight: '800',
  },
});

export const Header = React.memo(HeaderComponent);

