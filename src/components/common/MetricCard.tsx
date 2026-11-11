import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Colors, Typography, Spacing, BorderRadius } from '../../theme';

interface MetricCardProps {
  value: string | number;
  label: string;
  sublabel?: string;
  icon?: string;
  isAlert?: boolean;
  onPress?: () => void;
}

const MetricCardComponent: React.FC<MetricCardProps> = ({
  value,
  label,
  sublabel,
  icon,
  isAlert = false,
  onPress,
}) => {
  const content = (
    <View
      style={[
        styles.card,
        isAlert && styles.alertCard,
      ]}
      accessibilityRole="text"
      accessibilityLabel={`${label}: ${value}`}
    >
      <View style={styles.topRow}>
        {icon && <Text style={styles.icon}>{icon}</Text>}
        {sublabel && <Text style={styles.sublabel}>{sublabel}</Text>}
      </View>

      <Text
        style={[
          styles.value,
          isAlert && styles.alertValue,
        ]}
        numberOfLines={1}
      >
        {value}
      </Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity
        activeOpacity={0.75}
        onPress={onPress}
        style={styles.touchable}
        accessibilityRole="button"
      >
        {content}
      </TouchableOpacity>
    );
  }

  return <View style={styles.touchable}>{content}</View>;
};

const styles = StyleSheet.create({
  touchable: {
    flex: 1,
    minWidth: '46%',
    margin: Spacing.xs,
  },
  card: {
    backgroundColor: Colors.cardBackground,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    minHeight: 104,
    justifyContent: 'space-between',
  },
  alertCard: {
    backgroundColor: Colors.criticalBg,
    borderColor: Colors.criticalBorder,
    borderWidth: 1.5,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  icon: {
    fontSize: 20,
  },
  sublabel: {
    ...Typography.caption,
    fontSize: 9,
    color: Colors.textMuted,
  },
  value: {
    ...Typography.h1,
    fontSize: 26,
    color: Colors.textPrimary,
    marginVertical: 2,
  },
  alertValue: {
    color: Colors.criticalLight,
    fontWeight: '900',
  },
  label: {
    ...Typography.caption,
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: '700',
  },
});

export const MetricCard = React.memo(MetricCardComponent);

