export type AlertSeverity = 'critical' | 'high' | 'important' | 'informational';

export type AlertType =
  | 'fire'
  | 'smoke'
  | 'gas_leak'
  | 'co'
  | 'human_distress'
  | 'intrusion'
  | 'doorbell'
  | 'knocking'
  | 'environmental_sound';

export type AlertState = 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED';

export interface SensorEvidenceItem {
  sensorId: string;
  sensorName: string;
  reading: string;
  status: 'normal' | 'elevated' | 'high' | 'critical' | 'detected';
}

export interface SensorTelemetry {
  mq2?: {
    ppm: number;
    status: 'normal' | 'elevated' | 'critical';
  };
  mq135?: {
    ppm: number;
    airQuality: 'good' | 'moderate' | 'poor' | 'hazardous';
  };
  ir?: {
    flameDetected: boolean;
  };
  mic?: {
    dbLevel: number;
    soundPattern?: string;
    sirenDetected: boolean;
  };
  pir?: {
    motionDetected: boolean;
  };
  lastUpdated: number;
}

export interface Esp32EventPacket {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  location: string;
  nodeId: string;
  deviceName?: string;
  confidence: number;
  timestamp: number;
  title?: string;
  message?: string;
  evidence?: SensorEvidenceItem[];
  telemetry?: SensorTelemetry;
  evacuationSteps?: string[];
  safeRouteAvailable?: boolean;
}

export interface Alert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  location: string;
  nodeId: string;
  deviceName?: string;
  confidence: number;
  state: AlertState;
  createdAt: number;
  acknowledgedAt?: number;
  resolvedAt?: number;
  evidence: SensorEvidenceItem[];
  telemetry?: SensorTelemetry;
  evacuationSteps?: string[];
  safeRouteAvailable: boolean;
  wristbandAcked?: boolean;
  ackSentToEsp?: boolean;
}

