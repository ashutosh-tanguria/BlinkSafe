import { NativeBle, bleEventEmitter, BleConnectionStatus } from '../native/BlinkSafeNative';
import { Esp32EventPacket, SensorTelemetry } from '../models/alert';
import { SystemDevicesState, ConnectionStatus, DiscoveredBleDevice } from '../models/device';
import { MOCK_DEVICES_INITIAL } from '../mock/mockHardware';
import { StorageService } from './StorageService';

type BleEventListener = (packet: Esp32EventPacket) => void;
type ConnectionStateListener = (status: ConnectionStatus, rssi: number, deviceName?: string) => void;
type DiscoveredDevicesListener = (devices: DiscoveredBleDevice[]) => void;
type TelemetryListener = (telemetry: SensorTelemetry) => void;

export class BluetoothService {
  private eventListeners: Set<BleEventListener> = new Set();
  private stateListeners: Set<ConnectionStateListener> = new Set();
  private discoveredListeners: Set<DiscoveredDevicesListener> = new Set();
  private telemetryListeners: Set<TelemetryListener> = new Set();

  private isMockMode: boolean = false;
  private connectionStatus: ConnectionStatus = 'DISCONNECTED';
  private currentRssi: number = 0;
  private connectedDeviceName: string = 'No Device Connected';
  private devicesState: SystemDevicesState = {
    commonNode: {
      id: 'ESP32_CENTRAL',
      name: 'No Device Connected',
      type: 'ESP32_HUB',
      connectionType: 'BLE',
      status: 'DISCONNECTED',
      macAddress: '',
      signalStrengthRssi: 0,
      firmwareVersion: '',
      lastSeen: 0,
    },
    wristband: {
      id: 'WB_RF_01',
      name: 'BlinkSafe Wristband',
      type: 'WRISTBAND',
      connectionType: 'RF',
      viaNode: '',
      status: 'OFFLINE',
      batteryPercentage: 0,
      vibrationStatus: 'idle',
      lastAckReceivedAt: 0,
    },
    sensorNodes: [],
  };
  private discoveredDevices: Map<string, DiscoveredBleDevice> = new Map();
  private latestTelemetry: SensorTelemetry = {
    mq2: { ppm: 140, status: 'normal' },
    mq135: { ppm: 210, airQuality: 'good' },
    ir: { flameDetected: false },
    mic: { dbLevel: 38, sirenDetected: false },
    pir: { motionDetected: false },
    lastUpdated: Date.now(),
  };

  async initialize(): Promise<void> {
    const settings = await StorageService.getUserSettings();
    this.isMockMode = settings.isMockHardwareMode;

    // Start background BLE foreground service
    await NativeBle.startService();

    // Check actual initial status from native
    const nativeStatus = await NativeBle.getConnectionStatus();
    if (nativeStatus) {
      const isConnected = nativeStatus.state === 'CONNECTED';
      this.connectionStatus = isConnected ? 'CONNECTED' :
        nativeStatus.state === 'CONNECTING' ? 'CONNECTING' : 'DISCONNECTED';
      this.currentRssi = isConnected ? (nativeStatus.rssi || 0) : 0;
      if (isConnected && nativeStatus.deviceAddress) {
        this.devicesState.commonNode.macAddress = nativeStatus.deviceAddress;
        this.connectedDeviceName = nativeStatus.deviceName || 'ESP32 Hub';
        this.devicesState.commonNode.name = this.connectedDeviceName;
        this.devicesState.commonNode.status = 'CONNECTED';
      } else {
        this.connectedDeviceName = 'No Device Connected';
        this.devicesState.commonNode.name = 'No Device Connected';
        this.devicesState.commonNode.macAddress = '';
        this.devicesState.commonNode.status = 'DISCONNECTED';
      }
    }

    // Listen to native BLE events
    if (bleEventEmitter) {
      bleEventEmitter.addListener('onSafetyEventReceived', (data: { eventJson: string }) => {
        try {
          const packet: Esp32EventPacket = JSON.parse(data.eventJson);
          if (packet.telemetry) {
            this.updateTelemetry(packet.telemetry);
          } else if (packet.evidence) {
            this.extractTelemetryFromEvidence(packet.evidence);
          }
          if (packet.deviceName) {
            this.connectedDeviceName = packet.deviceName;
            this.devicesState.commonNode.name = packet.deviceName;
          }
          this.notifyEventSubscribers(packet);
        } catch (e) {
          console.error('[BluetoothService] Failed to parse safety event from native:', e);
        }
      });

      bleEventEmitter.addListener('onBleStateChanged', (data: { state: string; rssi: number; deviceAddress?: string; deviceName?: string }) => {
        const mappedStatus: ConnectionStatus =
          data.state === 'CONNECTED' ? 'CONNECTED' :
          data.state === 'CONNECTING' ? 'CONNECTING' : 'DISCONNECTED';
        
        this.connectionStatus = mappedStatus;
        this.currentRssi = mappedStatus === 'CONNECTED' ? (data.rssi || -60) : 0;
        if (mappedStatus === 'CONNECTED') {
          this.connectedDeviceName = data.deviceName || 'ESP32 Hub';
          this.devicesState.commonNode.name = this.connectedDeviceName;
          if (data.deviceAddress) {
            this.devicesState.commonNode.macAddress = data.deviceAddress;
          }
        } else if (mappedStatus === 'DISCONNECTED') {
          this.connectedDeviceName = 'No Device Connected';
          this.devicesState.commonNode.name = 'No Device Connected';
          this.devicesState.commonNode.macAddress = '';
        }
        this.devicesState.commonNode.status = mappedStatus;
        this.devicesState.commonNode.signalStrengthRssi = this.currentRssi;
        this.notifyStateSubscribers(mappedStatus, this.currentRssi, this.connectedDeviceName);
      });

      bleEventEmitter.addListener('onDeviceDiscovered', (device: DiscoveredBleDevice) => {
        if (!device || !device.address) return;
        this.discoveredDevices.set(device.address, device);
        this.notifyDiscoveredSubscribers(Array.from(this.discoveredDevices.values()));
      });
    }
  }

  setMockMode(enabled: boolean): void {
    this.isMockMode = enabled;
  }

  isMockEnabled(): boolean {
    return this.isMockMode;
  }

  getConnectionState(): { status: ConnectionStatus; rssi: number; isMock: boolean; deviceName: string } {
    return {
      status: this.connectionStatus,
      rssi: this.currentRssi,
      isMock: this.isMockMode,
      deviceName: this.connectedDeviceName,
    };
  }

  getDevicesState(): SystemDevicesState {
    return this.devicesState;
  }

  getLatestTelemetry(): SensorTelemetry {
    return this.latestTelemetry;
  }

  async startScanning(): Promise<boolean> {
    this.discoveredDevices.clear();
    this.notifyDiscoveredSubscribers([]);
    return await NativeBle.startScan();
  }

  async stopScanning(): Promise<boolean> {
    return await NativeBle.stopScan();
  }

  async connectToDevice(address: string, name?: string): Promise<boolean> {
    this.connectionStatus = 'CONNECTING';
    this.connectedDeviceName = name || 'BlinkSafe Hub';
    this.devicesState.commonNode.status = 'CONNECTING';
    this.devicesState.commonNode.name = this.connectedDeviceName;
    this.devicesState.commonNode.macAddress = address;
    this.notifyStateSubscribers('CONNECTING', this.currentRssi, this.connectedDeviceName);

    const success = await NativeBle.connectDevice(address, name);
    if (success) {
      this.connectionStatus = 'CONNECTED';
      this.devicesState.commonNode.status = 'CONNECTED';
      this.notifyStateSubscribers('CONNECTED', this.currentRssi, this.connectedDeviceName);
      await StorageService.saveDevicesState(this.devicesState);
    }
    return success;
  }

  async scan(): Promise<boolean> {
    return this.startScanning();
  }

  async connect(): Promise<boolean> {
    return this.connectToDevice(this.devicesState.commonNode.macAddress || '4C:75:25:CB:3A:90', this.connectedDeviceName);
  }

  async disconnect(): Promise<boolean> {
    await NativeBle.disconnectDevice();
    this.connectionStatus = 'DISCONNECTED';
    this.devicesState.commonNode.status = 'DISCONNECTED';
    this.devicesState.commonNode.signalStrengthRssi = 0;
    this.notifyStateSubscribers('DISCONNECTED', 0, this.connectedDeviceName);
    await StorageService.saveDevicesState(this.devicesState);
    return true;
  }

  updateTelemetry(telemetry: Partial<SensorTelemetry>): void {
    this.latestTelemetry = {
      ...this.latestTelemetry,
      ...telemetry,
      lastUpdated: Date.now(),
    };
    this.telemetryListeners.forEach(fn => {
      try {
        fn(this.latestTelemetry);
      } catch (e) {
        console.error('[BluetoothService] Telemetry listener error:', e);
      }
    });
  }

  private extractTelemetryFromEvidence(evidence: any[]): void {
    const updated: Partial<SensorTelemetry> = {};
    for (const item of evidence) {
      const id = (item.sensorId || '').toUpperCase();
      if (id.includes('MQ-2') || id.includes('MQ2')) {
        updated.mq2 = {
          ppm: parseInt(item.reading, 10) || 580,
          status: item.status === 'critical' ? 'critical' : item.status === 'high' ? 'elevated' : 'normal',
        };
      } else if (id.includes('MQ-135') || id.includes('MQ135')) {
        updated.mq135 = {
          ppm: parseInt(item.reading, 10) || 350,
          airQuality: item.status === 'critical' ? 'hazardous' : 'moderate',
        };
      } else if (id.includes('IR') || id.includes('FLAME')) {
        updated.ir = {
          flameDetected: item.status === 'critical' || item.status === 'detected',
        };
      } else if (id.includes('MIC') || id.includes('SOUND')) {
        updated.mic = {
          dbLevel: parseInt(item.reading, 10) || 85,
          sirenDetected: item.status === 'critical' || item.status === 'detected',
        };
      } else if (id.includes('PIR') || id.includes('MOTION')) {
        updated.pir = {
          motionDetected: item.status === 'detected',
        };
      }
    }
    this.updateTelemetry(updated);
  }

  subscribeDiscoveredDevices(listener: DiscoveredDevicesListener): () => void {
    this.discoveredListeners.add(listener);
    listener(Array.from(this.discoveredDevices.values()));
    return () => this.discoveredListeners.delete(listener);
  }

  subscribeTelemetry(listener: TelemetryListener): () => void {
    this.telemetryListeners.add(listener);
    listener(this.latestTelemetry);
    return () => this.telemetryListeners.delete(listener);
  }


  async sendAcknowledgement(alertId: string): Promise<boolean> {
    console.log(`[BluetoothService] Dispatching ACK for alert ${alertId} over BLE to Common ESP32`);
    return await NativeBle.sendAcknowledgement(alertId);
  }

  async simulateHardwareEvent(packet: Esp32EventPacket): Promise<void> {
    const jsonStr = JSON.stringify(packet);
    // Send to Android Kotlin service so it executes real Android notification + vibration
    await NativeBle.simulateHardwareEvent(jsonStr);
    this.notifyEventSubscribers(packet);
  }

  async triggerBackgroundAlertTest(delaySeconds = 5, packet?: Esp32EventPacket): Promise<void> {
    const eventPacket = packet || {
      id: `EVT_BG_TEST_${Date.now()}`,
      type: 'fire' as const,
      severity: 'critical' as const,
      location: 'Kitchen',
      nodeId: 'NODE_01_KITCHEN',
      confidence: 0.96,
      timestamp: Math.floor(Date.now() / 1000),
      title: '🔥 FIRE DETECTED',
      message: 'Background Test: High heat & smoke signature received from Common ESP32.',
      safeRouteAvailable: true,
      evidence: [
        {
          sensorId: 'MQ-2',
          sensorName: 'MQ-2 Smoke Sensor',
          reading: '780 ppm (CRITICAL)',
          status: 'critical' as const,
        },
      ],
    };
    await NativeBle.triggerBackgroundAlertTest(delaySeconds, JSON.stringify(eventPacket));
  }

  subscribeEvents(listener: BleEventListener): () => void {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }

  subscribeState(listener: ConnectionStateListener): () => void {
    this.stateListeners.add(listener);
    return () => this.stateListeners.delete(listener);
  }

  private notifyEventSubscribers(packet: Esp32EventPacket): void {
    this.eventListeners.forEach(fn => {
      try {
        fn(packet);
      } catch (e) {
        console.error('[BluetoothService] Listener error:', e);
      }
    });
  }

  private notifyStateSubscribers(status: ConnectionStatus, rssi: number, deviceName?: string): void {
    this.stateListeners.forEach(fn => {
      try {
        fn(status, rssi, deviceName);
      } catch (e) {
        console.error('[BluetoothService] State listener error:', e);
      }
    });
  }

  private notifyDiscoveredSubscribers(devices: DiscoveredBleDevice[]): void {
    this.discoveredListeners.forEach(fn => {
      try {
        fn(devices);
      } catch (e) {
        console.error('[BluetoothService] Discovered listener error:', e);
      }
    });
  }
}

export const bluetoothService = new BluetoothService();
