import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert as NativeAlert,
} from 'react-native';
import { Colors, Typography, Spacing, BorderRadius } from '../../theme';
import { PrimaryButton } from './PrimaryButton';
import { MOCK_SAFETY_SCENARIOS } from '../../mock/mockHardware';
import { bluetoothService } from '../../services/BluetoothService';
import { alertManager } from '../../services/AlertManager';
import { audioClassificationService } from '../../services/AudioClassificationService';

interface SimulateModalProps {
  visible: boolean;
  onClose: () => void;
}

export const SimulateModal: React.FC<SimulateModalProps> = ({ visible, onClose }) => {
  const [isScheduling, setIsScheduling] = useState(false);

  const handleSimulate = async (scenarioKey: keyof typeof MOCK_SAFETY_SCENARIOS) => {
    const packet = MOCK_SAFETY_SCENARIOS[scenarioKey]();
    await bluetoothService.simulateHardwareEvent(packet);
    onClose();
  };

  const handleSimulateAiDistress = async () => {
    const packet = await audioClassificationService.classifyAudio('Human distress');
    if (packet) {
      await alertManager.receiveEvent(packet);
    }
    onClose();
  };

  const handleBackgroundTest = async (delaySec = 5) => {
    setIsScheduling(true);
    const packet = MOCK_SAFETY_SCENARIOS.FIRE_KITCHEN();
    await bluetoothService.triggerBackgroundAlertTest(delaySec, packet);
    setIsScheduling(false);
    onClose();

    NativeAlert.alert(
      'Background Alert Scheduled',
      `Simulated Fire Alert will trigger in ${delaySec} seconds.\n\nNow press HOME or LOCK YOUR PHONE to test real background notification & vibration!`,
      [{ text: 'OK' }]
    );
  };

  const handleClearAll = async () => {
    await alertManager.clearAllAlerts();
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.content}>
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Hardware & AI Simulation</Text>
              <Text style={styles.subtitle}>
                Test safety events, notifications, and background vibration
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtn}
              accessibilityLabel="Close simulation modal"
            >
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
            {/* Background Test Section */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTag}>BACKGROUND RELIABILITY TEST</Text>
              </View>
              <Text style={styles.sectionDesc}>
                Tests Android native foreground service & notifications when app is minimized or phone is locked:
              </Text>
              <View style={styles.bgTestRow}>
                <PrimaryButton
                  title="TEST BG ALERT (5 SEC)"
                  variant="critical"
                  size="medium"
                  onPress={() => handleBackgroundTest(5)}
                  loading={isScheduling}
                  style={styles.bgBtn}
                />
              </View>
            </View>

            {/* Instant Scenarios */}
            <Text style={styles.groupLabel}>INSTANT SENSOR SCENARIOS</Text>

            <TouchableOpacity
              style={[styles.scenarioCard, { borderColor: Colors.criticalBorder }]}
              onPress={() => handleSimulate('FIRE_KITCHEN')}
            >
              <Text style={styles.scenarioIcon}>🔥</Text>
              <View style={styles.scenarioInfo}>
                <Text style={styles.scenarioTitle}>Simulate Fire</Text>
                <Text style={styles.scenarioSub}>Kitchen • MQ-2 820ppm • Critical</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.scenarioCard, { borderColor: Colors.warningBorder }]}
              onPress={() => handleSimulate('GAS_LEAK_KITCHEN')}
            >
              <Text style={styles.scenarioIcon}>🟡</Text>
              <View style={styles.scenarioInfo}>
                <Text style={styles.scenarioTitle}>Simulate Gas Leak</Text>
                <Text style={styles.scenarioSub}>Kitchen • MQ-2 & MQ-135 • Critical</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.scenarioCard, { borderColor: Colors.highPriorityBorder }]}
              onPress={() => handleSimulate('HUMAN_DISTRESS_BEDROOM')}
            >
              <Text style={styles.scenarioIcon}>🚨</Text>
              <View style={styles.scenarioInfo}>
                <Text style={styles.scenarioTitle}>Simulate Human Distress</Text>
                <Text style={styles.scenarioSub}>Bedroom • Vocal "Help!" / Screaming</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.scenarioCard, { borderColor: Colors.highPriorityBorder }]}
              onPress={() => handleSimulate('INTRUSION_LIVING_ROOM')}
            >
              <Text style={styles.scenarioIcon}>🛡</Text>
              <View style={styles.scenarioInfo}>
                <Text style={styles.scenarioTitle}>Simulate Intrusion</Text>
                <Text style={styles.scenarioSub}>Living Room • Motion & Sound</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.scenarioCard, { borderColor: Colors.informationalBorder }]}
              onPress={() => handleSimulate('DOORBELL_ENTRANCE')}
            >
              <Text style={styles.scenarioIcon}>🔔</Text>
              <View style={styles.scenarioInfo}>
                <Text style={styles.scenarioTitle}>Simulate Doorbell</Text>
                <Text style={styles.scenarioSub}>Main Entrance • Informational</Text>
              </View>
            </TouchableOpacity>

            {/* Edge AI Acoustic */}
            <Text style={styles.groupLabel}>EDGE AI AUDIO CLASSIFICATION</Text>
            <TouchableOpacity
              style={[styles.scenarioCard, { borderColor: Colors.accent }]}
              onPress={handleSimulateAiDistress}
            >
              <Text style={styles.scenarioIcon}>🧠</Text>
              <View style={styles.scenarioInfo}>
                <Text style={styles.scenarioTitle}>YAMNet Acoustic AI Pipeline</Text>
                <Text style={styles.scenarioSub}>Classify live acoustic distress vocalization</Text>
              </View>
            </TouchableOpacity>

            {/* Clear All */}
            <View style={styles.clearContainer}>
              <PrimaryButton
                title="CLEAR ALL ALERTS & HISTORY"
                variant="outline"
                size="medium"
                onPress={handleClearAll}
              />
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'flex-end',
  },
  content: {
    backgroundColor: Colors.backgroundSecondary,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    maxHeight: '85%',
    paddingBottom: Spacing.xl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorder,
  },
  title: {
    ...Typography.h2,
    color: Colors.textPrimary,
  },
  subtitle: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.cardBackgroundElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  body: {
    padding: Spacing.lg,
  },
  sectionCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.criticalBorder,
    marginBottom: Spacing.lg,
  },
  sectionHeader: {
    marginBottom: Spacing.xs,
  },
  sectionTag: {
    ...Typography.caption,
    color: Colors.criticalLight,
    fontWeight: '900',
  },
  sectionDesc: {
    ...Typography.bodyMedium,
    color: Colors.textSecondary,
    marginVertical: Spacing.xs,
  },
  bgTestRow: {
    marginTop: Spacing.sm,
  },
  bgBtn: {
    width: '100%',
  },
  groupLabel: {
    ...Typography.caption,
    color: Colors.textMuted,
    marginBottom: Spacing.sm,
    letterSpacing: 1,
  },
  scenarioCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardBackground,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
  },
  scenarioIcon: {
    fontSize: 24,
    marginRight: Spacing.md,
  },
  scenarioInfo: {
    flex: 1,
  },
  scenarioTitle: {
    ...Typography.h4,
    color: Colors.textPrimary,
  },
  scenarioSub: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  clearContainer: {
    marginTop: Spacing.md,
    marginBottom: Spacing.xxl,
  },
});
