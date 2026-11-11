import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
} from 'react-native';
import { Colors, Typography, Spacing, BorderRadius } from '../theme';
import { PrimaryButton } from '../components/common/PrimaryButton';
import { alertManager } from '../services/AlertManager';

interface EvacuationScreenProps {
  route: any;
  navigation: any;
}

export const EvacuationScreen: React.FC<EvacuationScreenProps> = ({ route, navigation }) => {
  const alertId = route.params?.alertId;
  const activeAlert = alertManager.getActiveAlerts().find(a => a.id === alertId);
  const hazardLocation = route.params?.location || activeAlert?.location || 'Kitchen';
  const evacuationSteps = activeAlert?.evacuationSteps || [
    `1. Hazard confirmed in ${hazardLocation}. Do NOT proceed through this zone.`,
    '2. Keep low to the floor if smoke is detected.',
    '3. Follow the green lighted pathway towards Exit Staircase B.',
    '4. Once outside, remain at designated assembly point.'
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.headerBar}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          accessibilityLabel="Back to alert"
        >
          <Text style={styles.backBtnText}>← BACK</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>SAFE EVACUATION ROUTE</Text>
        <View style={{ width: 48 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Main Instruction Card */}
        <View style={styles.instructionBanner}>
          <Text style={styles.instructionTag}>PRIMARY EVACUATION INSTRUCTION</Text>
          <Text style={styles.exitInstruction}>EXIT THROUGH STAIRCASE B</Text>
          <Text style={styles.subInstruction}>
            Hazard confirmed in <Text style={styles.dangerText}>{hazardLocation.toUpperCase()}</Text>. Keep low if smoke is present and proceed along the green corridor.
          </Text>
        </View>

        {/* ESP32 Real-Time Pathway Steps */}
        <View style={styles.pathwayCard}>
          <Text style={styles.pathwayTag}>ESP32 DIRECTED PATHWAY STEPS</Text>
          {evacuationSteps.map((step, idx) => (
            <View key={idx} style={styles.stepRow}>
              <View style={styles.stepDot}>
                <Text style={styles.stepDotText}>{idx + 1}</Text>
              </View>
              <Text style={styles.stepText}>{step}</Text>
            </View>
          ))}
        </View>


        {/* Static Visual Floorplan Diagram */}
        <View style={styles.mapCard}>
          <Text style={styles.mapTitle}>FLOOR PLAN ROUTE MAP</Text>

          {/* Diagram Layout */}
          <View style={styles.floorPlanContainer}>
            {/* Danger Zone: Kitchen */}
            <View style={styles.dangerZone}>
              <Text style={styles.zoneIcon}>🔥</Text>
              <Text style={styles.dangerZoneText}>DANGER ZONE</Text>
              <Text style={styles.zoneSubText}>{hazardLocation}</Text>
            </View>

            {/* Blocked Path Arrow */}
            <View style={styles.blockedConnector}>
              <Text style={styles.blockedText}>⛔ BLOCKED ROUTE</Text>
            </View>

            {/* Current Position Marker */}
            <View style={styles.currentPositionNode}>
              <View style={styles.userPulseDot} />
              <Text style={styles.nodeTitle}>YOU ARE HERE</Text>
              <Text style={styles.nodeSub}>Bedroom Corridor</Text>
            </View>

            {/* Safe Path Arrow */}
            <View style={styles.safePathConnector}>
              <Text style={styles.safePathArrow}>↓ SAFE PATH (GREEN) ↓</Text>
            </View>

            {/* Intermediate: Hallway */}
            <View style={styles.safeHallwayNode}>
              <Text style={styles.hallwayTitle}>HALLWAY EAST</Text>
              <Text style={styles.hallwaySub}>Clear of smoke & obstruction</Text>
            </View>

            {/* Safe Path Arrow */}
            <View style={styles.safePathConnector}>
              <Text style={styles.safePathArrow}>↓ SAFE PATH ↓</Text>
            </View>

            {/* Staircase & Final Exit */}
            <View style={styles.exitNode}>
              <Text style={styles.exitIcon}>🚪</Text>
              <Text style={styles.exitNodeTitle}>STAIRCASE B → MAIN EXIT</Text>
              <Text style={styles.exitNodeSub}>Primary Fire Exit • Ground Level Access</Text>
            </View>
          </View>

          {/* Legend */}
          <View style={styles.legendRow}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#3B82F6' }]} />
              <Text style={styles.legendText}>Current Location</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: Colors.safe }]} />
              <Text style={styles.legendText}>Safe Path</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: Colors.critical }]} />
              <Text style={styles.legendText}>Hazard Zone</Text>
            </View>
          </View>
        </View>

        {/* Guidance Checklist */}
        <View style={styles.checklistCard}>
          <Text style={styles.checklistHeader}>EMERGENCY PROTOCOL</Text>

          <View style={styles.protocolItem}>
            <Text style={styles.protocolNum}>1</Text>
            <Text style={styles.protocolText}>Do not use elevators. Always use Staircase B.</Text>
          </View>

          <View style={styles.protocolItem}>
            <Text style={styles.protocolNum}>2</Text>
            <Text style={styles.protocolText}>Keep doors closed behind you to slow fire spread.</Text>
          </View>

          <View style={styles.protocolItem}>
            <Text style={styles.protocolNum}>3</Text>
            <Text style={styles.protocolText}>Once outside, proceed to the designated assembly area.</Text>
          </View>
        </View>

        <View style={{ height: Spacing.xxl }} />
      </ScrollView>

      {/* Bottom Dismiss */}
      <View style={styles.bottomBar}>
        <PrimaryButton
          title="RETURN TO EMERGENCY DASHBOARD"
          variant="primary"
          size="large"
          onPress={() => navigation.goBack()}
        />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
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
  instructionBanner: {
    backgroundColor: Colors.safeBg,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 2,
    borderColor: Colors.safe,
    marginBottom: Spacing.md,
  },
  instructionTag: {
    ...Typography.caption,
    color: Colors.safeLight,
    fontWeight: '900',
  },
  exitInstruction: {
    ...Typography.h1,
    color: '#FFFFFF',
    marginVertical: Spacing.xs,
  },
  subInstruction: {
    ...Typography.bodyLarge,
    color: '#D1FAE5',
  },
  dangerText: {
    color: Colors.criticalLight,
    fontWeight: '800',
  },
  mapCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    marginBottom: Spacing.md,
  },
  mapTitle: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: Spacing.md,
  },
  floorPlanContainer: {
    backgroundColor: '#090D16',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.cardBorderActive,
    alignItems: 'center',
  },
  dangerZone: {
    backgroundColor: Colors.criticalBg,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    borderColor: Colors.criticalBorder,
    padding: Spacing.md,
    width: '90%',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  zoneIcon: {
    fontSize: 28,
  },
  dangerZoneText: {
    ...Typography.h4,
    color: Colors.criticalLight,
    fontWeight: '900',
  },
  zoneSubText: {
    ...Typography.caption,
    color: '#FCA5A5',
  },
  blockedConnector: {
    paddingVertical: Spacing.xs,
  },
  blockedText: {
    ...Typography.caption,
    color: Colors.criticalLight,
    fontSize: 10,
    fontWeight: '800',
  },
  currentPositionNode: {
    backgroundColor: '#1E293B',
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    borderColor: '#3B82F6',
    padding: Spacing.md,
    width: '90%',
    alignItems: 'center',
    marginVertical: Spacing.xs,
  },
  userPulseDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#3B82F6',
    marginBottom: 4,
  },
  nodeTitle: {
    ...Typography.h4,
    color: '#93C5FD',
    fontWeight: '900',
  },
  nodeSub: {
    ...Typography.caption,
    color: Colors.textSecondary,
  },
  safePathConnector: {
    paddingVertical: Spacing.xs,
  },
  safePathArrow: {
    ...Typography.caption,
    color: Colors.safeLight,
    fontWeight: '900',
    fontSize: 11,
  },
  safeHallwayNode: {
    backgroundColor: Colors.safeBg,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    borderColor: Colors.safe,
    padding: Spacing.md,
    width: '90%',
    alignItems: 'center',
  },
  hallwayTitle: {
    ...Typography.h4,
    color: Colors.safeLight,
    fontWeight: '800',
  },
  hallwaySub: {
    ...Typography.caption,
    color: '#A7F3D0',
  },
  exitNode: {
    backgroundColor: '#064E3B',
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    borderColor: Colors.safeLight,
    padding: Spacing.md,
    width: '90%',
    alignItems: 'center',
    marginTop: Spacing.xs,
  },
  exitIcon: {
    fontSize: 28,
    marginBottom: 2,
  },
  exitNodeTitle: {
    ...Typography.h3,
    color: '#FFFFFF',
    fontWeight: '900',
  },
  exitNodeSub: {
    ...Typography.caption,
    color: '#A7F3D0',
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: Spacing.md,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.cardBorder,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  legendText: {
    ...Typography.caption,
    fontSize: 10,
    color: Colors.textSecondary,
  },
  checklistCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    marginBottom: Spacing.lg,
  },
  checklistHeader: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: Spacing.sm,
  },
  protocolItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: Spacing.xs + 2,
  },
  protocolNum: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.cardBackgroundElevated,
    textAlign: 'center',
    lineHeight: 22,
    color: Colors.accent,
    fontWeight: '800',
    fontSize: 12,
    marginRight: Spacing.md,
  },
  protocolText: {
    ...Typography.bodyMedium,
    color: Colors.textPrimary,
    flex: 1,
  },
  bottomBar: {
    backgroundColor: Colors.cardBackground,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xl,
    borderTopWidth: 1,
    borderTopColor: Colors.cardBorder,
  },
  pathwayCard: {
    backgroundColor: '#181C24',
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: '#262D3D',
  },
  pathwayTag: {
    ...Typography.labelSmall,
    color: '#94A3B8',
    letterSpacing: 1.2,
    fontWeight: '700',
    marginBottom: Spacing.sm,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  stepDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.sm,
  },
  stepDotText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  stepText: {
    ...Typography.bodyMedium,
    color: '#F8FAFC',
    flex: 1,
    fontSize: 13,
  },
});

