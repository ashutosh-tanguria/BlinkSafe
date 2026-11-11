import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Colors, Typography, Spacing, BorderRadius } from '../theme';
import { Header } from '../components/common/Header';
import { SystemDevicesState, ConnectionStatus, DiscoveredBleDevice } from '../models/device';
import { bluetoothService } from '../services/BluetoothService';
import { SimulateModal } from '../components/common/SimulateModal';
import { PermissionService } from '../services/PermissionService';

export const DevicesScreen: React.FC = () => {
  const [devicesState, setDevicesState] = useState<SystemDevicesState>(
    bluetoothService.getDevicesState()
  );
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('DISCONNECTED');
  const [connectedName, setConnectedName] = useState<string>('BlinkSafe Hub');
  const [rssi, setRssi] = useState<number>(-65);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [discoveredDevices, setDiscoveredDevices] = useState<DiscoveredBleDevice[]>([]);
  const [connectingAddress, setConnectingAddress] = useState<string | null>(null);
  const [showSimModal, setShowSimModal] = useState<boolean>(false);

  useEffect(() => {
    const unsubscribeState = bluetoothService.subscribeState((status, signal, name) => {
      setConnectionStatus(status);
      setRssi(signal);
      if (name) setConnectedName(name);
      setDevicesState(bluetoothService.getDevicesState());
    });

    const unsubscribeDiscovered = bluetoothService.subscribeDiscoveredDevices((devices) => {
      setDiscoveredDevices([...devices]);
    });

    const conn = bluetoothService.getConnectionState();
    setConnectionStatus(conn.status);
    setRssi(conn.rssi);
    setConnectedName(conn.deviceName);

    return () => {
      unsubscribeState();
      unsubscribeDiscovered();
    };
  }, []);

  const handleStartScan = async () => {
    try {
      await PermissionService.requestSafetyPermissions();
    } catch (e) {
      console.warn('Permission error:', e);
    }
    setIsScanning(true);
    await bluetoothService.startScanning();
    setTimeout(() => {
      setIsScanning(false);
    }, 10000);
  };

  const handleConnect = async (device: DiscoveredBleDevice) => {
    setConnectingAddress(device.address);
    await bluetoothService.connectToDevice(device.address, device.name);
    setConnectingAddress(null);
  };

  const handleDisconnect = async () => {
    await bluetoothService.disconnect();
  };

  const isConnected = connectionStatus === 'CONNECTED';

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header
        title="Hardware & Bluetooth"
        isOnline={isConnected}
        showSimulateButton={false}
      />

      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {/* Active Bluetooth Connection Status Card */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ACTIVE BLUETOOTH CONNECTION</Text>
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.iconTitleRow}>
                <View style={styles.iconWrap}>
                  <Text style={styles.icon}>📡</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.deviceName}>{connectedName}</Text>
                  <Text style={styles.deviceSub}>
                    {isConnected
                      ? `Protocol: BLE GATT • ${devicesState.commonNode.macAddress || 'Connected'}`
                      : 'Bluetooth LE Standby • Tap scan to discover nodes'}
                  </Text>
                </View>
              </View>

              <View
                style={[
                  styles.statusBadge,
                  isConnected
                    ? styles.badgeOnline
                    : connectionStatus === 'CONNECTING'
                    ? styles.badgeConnecting
                    : styles.badgeOffline,
                ]}
              >
                <Text style={styles.badgeText}>
                  {isConnected
                    ? '● CONNECTED'
                    : connectionStatus === 'CONNECTING'
                    ? '● CONNECTING'
                    : '● DISCONNECTED'}
                </Text>
              </View>
            </View>

            <View style={styles.statsRow}>
              <View style={styles.statCol}>
                <Text style={styles.statLabel}>SIGNAL STRENGTH</Text>
                <Text style={styles.statValue}>
                  {isConnected ? `${rssi} dBm` : 'N/A'}
                </Text>
              </View>
              <View style={styles.statCol}>
                <Text style={styles.statLabel}>ROLE</Text>
                <Text style={styles.statValue}>Central Hub Node</Text>
              </View>
              <View style={styles.statCol}>
                <Text style={styles.statLabel}>CHANNELS</Text>
                <Text style={styles.statValue}>BLE / ESP-NOW</Text>
              </View>
            </View>

            {isConnected && (
              <TouchableOpacity
                style={styles.disconnectBtn}
                onPress={handleDisconnect}
              >
                <Text style={styles.disconnectBtnText}>Disconnect Bluetooth</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Scan for Bluetooth Devices Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>DISCOVER BLUETOOTH NODES</Text>
            {isScanning && <ActivityIndicator size="small" color={Colors.primary} />}
          </View>

          <TouchableOpacity
            style={[styles.scanBtn, isScanning && styles.scanBtnActive]}
            onPress={handleStartScan}
            disabled={isScanning}
          >
            <Text style={styles.scanBtnText}>
              {isScanning ? 'Scanning for ESP32 Nodes...' : '🔍 Scan for Nearby Bluetooth Nodes'}
            </Text>
          </TouchableOpacity>

          {/* Discovered List */}
          {discoveredDevices.length > 0 && (
            <View style={styles.discoveredContainer}>
              {discoveredDevices.map((dev) => {
                const isThisConnected =
                  isConnected &&
                  (dev.address === devicesState.commonNode.macAddress ||
                    dev.name === connectedName);
                const isConnectingThis = connectingAddress === dev.address;

                return (
                  <View key={dev.address} style={styles.discoveredCard}>
                    <View style={styles.discoveredLeft}>
                      <Text style={styles.discoveredIcon}>📻</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.discoveredName}>{dev.name}</Text>
                        <Text style={styles.discoveredSub}>
                          {dev.address} • {dev.rssi} dBm
                        </Text>
                      </View>
                    </View>

                    <TouchableOpacity
                      style={[
                        styles.deviceActionBtn,
                        isThisConnected ? styles.actionBtnConnected : styles.actionBtnConnect,
                      ]}
                      onPress={() => (isThisConnected ? handleDisconnect() : handleConnect(dev))}
                      disabled={isConnectingThis}
                    >
                      {isConnectingThis ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <Text style={styles.deviceActionBtnText}>
                          {isThisConnected ? 'Disconnect' : 'Connect'}
                        </Text>
                      )}
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* Multi-Bulb Nodes List (Only shown if real nodes reported) */}
        {devicesState.sensorNodes && devicesState.sensorNodes.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>BULB & SENSOR NODES (ESP-NOW MESH)</Text>
            {devicesState.sensorNodes.map((node) => (
              <View key={node.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={styles.iconTitleRow}>
                    <View style={[styles.iconWrap, { backgroundColor: '#1E293B' }]}>
                      <Text style={styles.icon}>💡</Text>
                    </View>
                    <View>
                      <Text style={styles.deviceName}>{node.name}</Text>
                      <Text style={styles.deviceSub}>
                        {node.location} • Link: ESP-NOW (2.4GHz)
                      </Text>
                    </View>
                  </View>
                  <View style={[styles.statusBadge, styles.badgeOnline]}>
                    <Text style={styles.badgeText}>● ONLINE</Text>
                  </View>
                </View>

                <View style={styles.sensorPillsWrap}>
                  {node.sensors.map((sensor) => (
                    <View key={sensor} style={styles.sensorPill}>
                      <Text style={styles.sensorPillText}>✓ {sensor}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ))}
          </View>
        ) : null}

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
    backgroundColor: '#0F1218',
  },
  container: {
    flex: 1,
    paddingHorizontal: Spacing.md,
  },
  section: {
    marginTop: Spacing.md,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  sectionTitle: {
    ...Typography.caption,
    fontSize: 10,
    color: '#94A3B8',
    letterSpacing: 1.2,
    fontWeight: '700',
    marginBottom: Spacing.xs,
  },
  card: {
    backgroundColor: '#181C24',
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: '#262D3D',
    marginBottom: Spacing.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  iconTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#262D3D',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  icon: {
    fontSize: 20,
  },
  deviceName: {
    ...Typography.bodyLarge,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  deviceSub: {
    ...Typography.bodySmall,
    color: '#94A3B8',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
  },
  badgeOnline: {
    backgroundColor: '#14532D',
  },
  badgeConnecting: {
    backgroundColor: '#78350F',
  },
  badgeOffline: {
    backgroundColor: '#7F1D1D',
  },
  badgeText: {
    ...Typography.caption,
    fontSize: 9,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Spacing.xs,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: '#262D3D',
  },
  statCol: {
    flex: 1,
  },
  statLabel: {
    ...Typography.caption,
    fontSize: 9,
    color: '#64748B',
    fontWeight: '700',
  },
  statValue: {
    ...Typography.bodySmall,
    color: '#E2E8F0',
    fontWeight: '700',
    marginTop: 2,
  },
  disconnectBtn: {
    marginTop: Spacing.md,
    backgroundColor: '#2A1212',
    borderWidth: 1,
    borderColor: '#7F1D1D',
    borderRadius: BorderRadius.md,
    paddingVertical: 8,
    alignItems: 'center',
  },
  disconnectBtnText: {
    color: '#F87171',
    fontWeight: '600',
    fontSize: 12,
  },
  scanBtn: {
    backgroundColor: '#2563EB',
    borderRadius: BorderRadius.md,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  scanBtnActive: {
    backgroundColor: '#1D4ED8',
  },
  scanBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  discoveredContainer: {
    marginTop: Spacing.xs,
    gap: Spacing.xs,
  },
  discoveredCard: {
    backgroundColor: '#181C24',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#262D3D',
  },
  discoveredLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: Spacing.sm,
  },
  discoveredIcon: {
    fontSize: 20,
    marginRight: Spacing.sm,
  },
  discoveredName: {
    ...Typography.bodyMedium,
    color: '#F8FAFC',
    fontWeight: '700',
  },
  discoveredSub: {
    ...Typography.bodySmall,
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 2,
  },
  deviceActionBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: BorderRadius.sm,
    minWidth: 80,
    alignItems: 'center',
  },
  actionBtnConnect: {
    backgroundColor: '#10B981',
  },
  actionBtnConnected: {
    backgroundColor: '#374151',
  },
  deviceActionBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
  },
  sensorPillsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginTop: Spacing.sm,
  },
  sensorPill: {
    backgroundColor: '#1F2937',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: '#374151',
  },
  sensorPillText: {
    ...Typography.caption,
    fontSize: 11,
    color: '#9CA3AF',
  },
});
