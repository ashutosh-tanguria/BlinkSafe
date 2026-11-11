import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
} from 'react-native';
import { Colors, Typography, Spacing, BorderRadius } from '../theme';
import { Header } from '../components/common/Header';
import { AlertCard } from '../components/common/AlertCard';
import { Alert, AlertSeverity } from '../models/alert';
import { alertManager } from '../services/AlertManager';
import { SimulateModal } from '../components/common/SimulateModal';

interface AlertsScreenProps {
  navigation: any;
}

export const AlertsScreen: React.FC<AlertsScreenProps> = ({ navigation }) => {
  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');
  const [activeAlerts, setActiveAlerts] = useState<Alert[]>([]);
  const [alertHistory, setAlertHistory] = useState<Alert[]>([]);
  const [severityFilter, setSeverityFilter] = useState<AlertSeverity | 'all'>('all');
  const [showSimModal, setShowSimModal] = useState<boolean>(false);

  useEffect(() => {
    const unsubscribe = alertManager.subscribe((active, history) => {
      setActiveAlerts(active);
      setAlertHistory(history);
    });
    return () => unsubscribe();
  }, []);

  const handleAcknowledge = useCallback(async (id: string) => {
    await alertManager.acknowledgeAlert(id);
  }, []);

  const handleResolve = useCallback(async (id: string) => {
    await alertManager.resolveAlert(id);
  }, []);

  const handleViewRoute = useCallback((alert: Alert) => {
    navigation.navigate('Evacuation', { alertId: alert.id, location: alert.location });
  }, [navigation]);

  const handleAlertPress = useCallback((alert: Alert) => {
    if (alert.severity === 'critical') {
      navigation.navigate('Emergency', { alertId: alert.id });
    } else {
      navigation.navigate('AlertDetail', { alertId: alert.id });
    }
  }, [navigation]);

  const currentList = activeTab === 'active' ? activeAlerts : alertHistory;
  const filteredList = useMemo(() => {
    return severityFilter === 'all'
      ? currentList
      : currentList.filter(a => a.severity === severityFilter);
  }, [currentList, severityFilter]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header
        title="Alerts Center"
        showSimulateButton={true}
        onSimulationPress={() => setShowSimModal(true)}
      />

      {/* Tabs Header: ACTIVE vs HISTORY */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'active' && styles.tabBtnActive]}
          onPress={() => setActiveTab('active')}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'active' }}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === 'active' && styles.tabTextActive,
            ]}
          >
            ACTIVE HAZARDS ({activeAlerts.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'history' && styles.tabBtnActive]}
          onPress={() => setActiveTab('history')}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'history' }}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === 'history' && styles.tabTextActive,
            ]}
          >
            ALERT HISTORY ({alertHistory.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Filter Chips */}
      <View style={styles.filterRow}>
        {(['all', 'critical', 'high', 'important', 'informational'] as const).map(filter => (
          <TouchableOpacity
            key={filter}
            style={[
              styles.filterChip,
              severityFilter === filter && styles.filterChipActive,
            ]}
            onPress={() => setSeverityFilter(filter)}
          >
            <Text
              style={[
                styles.filterText,
                severityFilter === filter && styles.filterTextActive,
              ]}
            >
              {filter.toUpperCase()}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        style={styles.listContainer}
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        {filteredList.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>
              {activeTab === 'active' ? '🛡' : '📋'}
            </Text>
            <Text style={styles.emptyTitle}>
              {activeTab === 'active'
                ? 'No Active Safety Hazards'
                : 'No Past Alert History'}
            </Text>
            <Text style={styles.emptySub}>
              {activeTab === 'active'
                ? 'All sensor nodes report nominal environmental conditions.'
                : 'Resolved safety events and past alerts will appear here.'}
            </Text>
          </View>
        ) : (
          filteredList.map(alert => (
            <AlertCard
              key={alert.id}
              alert={alert}
              onPress={() => handleAlertPress(alert)}
              onAcknowledge={handleAcknowledge}
              onResolve={handleResolve}
              onViewRoute={handleViewRoute}
            />
          ))
        )}

        <View style={{ height: Spacing.xxl }} />
      </ScrollView>

      <SimulateModal
        visible={showSimModal}
        onClose={() => setShowSimModal(false)}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.cardBackgroundElevated,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    borderRadius: BorderRadius.md,
    padding: 3,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: Spacing.sm + 2,
    alignItems: 'center',
    borderRadius: BorderRadius.sm,
  },
  tabBtnActive: {
    backgroundColor: Colors.cardBackground,
    borderWidth: 1,
    borderColor: Colors.cardBorderActive,
  },
  tabText: {
    ...Typography.caption,
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: '700',
  },
  tabTextActive: {
    color: Colors.textPrimary,
    fontWeight: '800',
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    gap: Spacing.xs,
  },
  filterChip: {
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.cardBackground,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  filterChipActive: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  filterText: {
    ...Typography.caption,
    fontSize: 10,
    color: Colors.textSecondary,
  },
  filterTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  listContainer: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xxxl,
    paddingHorizontal: Spacing.xl,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: Spacing.md,
  },
  emptyTitle: {
    ...Typography.h3,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  emptySub: {
    ...Typography.bodyMedium,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: Spacing.xs,
  },
});
