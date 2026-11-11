export type ConnectionStatus = 'CONNECTED' | 'CONNECTING' | 'DISCONNECTED';
export type DeviceOnlineStatus = 'ONLINE' | 'OFFLINE';

export interface CommonNodeDevice {
  id: string;
  name: string;
  type: 'ESP32_HUB';
  connectionType: 'BLE';
  status: ConnectionStatus;
  macAddress: string;
  signalStrengthRssi: number;
  firmwareVersion: string;
  lastSeen: number;
}

export interface WristbandDevice {
  id: string;
  name: string;
  type: 'WRISTBAND';
  connectionType: 'RF'; // Connects through Common Node using RF (no direct BLE)
  viaNode: string;
  status: DeviceOnlineStatus;
  batteryPercentage: number;
  vibrationStatus: 'idle' | 'vibrating';
  lastAckReceivedAt?: number;
}

export interface SensorNodeDevice {
  id: string;
  name: string;
  location: string;
  type: 'ESP32_SENSOR_NODE';
  connectionType: 'ESP_NOW';
  status: DeviceOnlineStatus;
  sensors: string[];
  batteryPercentage?: number;
  signalQuality: string;
  lastHeartbeat: number;
}

export interface DiscoveredBleDevice {
  name: string;
  address: string;
  rssi: number;
}

export interface SystemDevicesState {
  commonNode: CommonNodeDevice;
  wristband: WristbandDevice;
  sensorNodes: SensorNodeDevice[];
}

