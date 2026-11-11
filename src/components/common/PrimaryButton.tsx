import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  StyleProp,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { Colors, Typography, Spacing, BorderRadius } from '../../theme';

interface PrimaryButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'critical' | 'primary' | 'secondary' | 'outline' | 'safe';
  size?: 'large' | 'medium' | 'small';
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: TextStyle;
  accessibilityLabel?: string;
  accessibilityHint?: string;
}

export const PrimaryButton: React.FC<PrimaryButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'large',
  disabled = false,
  loading = false,
  style,
  textStyle,
  accessibilityLabel,
  accessibilityHint,
}) => {
  const getButtonStyles = () => {
    switch (variant) {
      case 'critical':
        return {
          container: styles.criticalBtn,
          text: styles.criticalText,
        };
      case 'safe':
        return {
          container: styles.safeBtn,
          text: styles.safeText,
        };
      case 'secondary':
        return {
          container: styles.secondaryBtn,
          text: styles.secondaryText,
        };
      case 'outline':
        return {
          container: styles.outlineBtn,
          text: styles.outlineText,
        };
      case 'primary':
      default:
        return {
          container: styles.primaryBtn,
          text: styles.primaryText,
        };
    }
  };

  const config = getButtonStyles();

  return (
    <TouchableOpacity
      activeOpacity={0.75}
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        styles.baseButton,
        size === 'large' ? styles.largeBtn : size === 'small' ? styles.smallBtn : styles.mediumBtn,
        config.container,
        disabled && styles.disabledBtn,
        style,
      ]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || title}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: disabled || loading }}
    >
      {loading ? (
        <ActivityIndicator color={Colors.textPrimary} size="small" />
      ) : (
        <Text
          style={[
            size === 'large' ? Typography.buttonLarge : Typography.buttonMedium,
            config.text,
            disabled && styles.disabledText,
            textStyle,
          ]}
        >
          {title}
        </Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  baseButton: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.md,
    flexDirection: 'row',
  },
  largeBtn: {
    minHeight: 56,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md + 2,
  },
  mediumBtn: {
    minHeight: 48,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm + 2,
  },
  smallBtn: {
    minHeight: 38,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
  },
  primaryBtn: {
    backgroundColor: Colors.accent,
  },
  primaryText: {
    color: '#FFFFFF',
  },
  criticalBtn: {
    backgroundColor: Colors.critical,
    borderWidth: 2,
    borderColor: '#FFA4A4',
    shadowColor: Colors.critical,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  criticalText: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
  safeBtn: {
    backgroundColor: Colors.safe,
    borderWidth: 1,
    borderColor: Colors.safeLight,
  },
  safeText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  secondaryBtn: {
    backgroundColor: Colors.cardBackgroundElevated,
    borderWidth: 1,
    borderColor: Colors.cardBorderActive,
  },
  secondaryText: {
    color: Colors.textPrimary,
  },
  outlineBtn: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: Colors.cardBorderActive,
  },
  outlineText: {
    color: Colors.textPrimary,
  },
  disabledBtn: {
    opacity: 0.5,
    backgroundColor: Colors.textDisabled,
  },
  disabledText: {
    color: Colors.textMuted,
  },
});
