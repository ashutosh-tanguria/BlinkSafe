import { Alert, AlertState, Esp32EventPacket, AlertSeverity, AlertType } from '../models/alert';
import { StorageService } from './StorageService';
import { VibrationService } from './VibrationService';
import { NotificationService } from './NotificationService';
import { bluetoothService } from './BluetoothService';

type AlertChangeListener = (activeAlerts: Alert[], history: Alert[]) => void;

export class AlertManager {
  private activeAlerts: Alert[] = [];
  private alertHistory: Alert[] = [];
  private listeners: Set<AlertChangeListener> = new Set();
  private isInitialized = false;

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    // Load persisted state
    this.activeAlerts = await StorageService.getActiveAlerts();
    this.alertHistory = await StorageService.getAlertHistory();

    // Subscribe to incoming BLE / Hardware packets
    bluetoothService.subscribeEvents((packet: Esp32EventPacket) => {
      this.receiveEvent(packet);
    });

    this.isInitialized = true;
    this.notifyListeners();
  }

  /**
   * Central entrypoint for any new safety event packet (from BLE, AI, or Mock)
   */
  async receiveEvent(packet: Esp32EventPacket): Promise<Alert> {
    console.log('[AlertManager] Processing incoming event:', packet.id, packet.type, packet.severity);

    // Check if alert already exists in active alerts
    const existingIndex = this.activeAlerts.findIndex(a => a.id === packet.id);
    if (existingIndex >= 0) {
      return this.activeAlerts[existingIndex];
    }

    const title = packet.title || this.getDefaultTitleForType(packet.type);
    const message = packet.message || `Detected at ${packet.location} with ${(packet.confidence * 100).toFixed(0)}% confidence.`;

    const newAlert: Alert = {
      id: packet.id,
      type: packet.type,
      severity: packet.severity,
      title,
      message,
      location: packet.location,
      nodeId: packet.nodeId,
      deviceName: packet.deviceName,
      confidence: packet.confidence,
      state: 'ACTIVE',
      createdAt: packet.timestamp ? packet.timestamp * 1000 : Date.now(),
      evidence: packet.evidence || [],
      telemetry: packet.telemetry,
      evacuationSteps: packet.evacuationSteps,
      safeRouteAvailable: packet.safeRouteAvailable ?? (packet.type === 'fire' || packet.type === 'gas_leak'),
      wristbandAcked: false,
      ackSentToEsp: false,
    };

    // Add to active alerts (newest first)
    this.activeAlerts = [newAlert, ...this.activeAlerts];

    // Trigger Phone Vibration
    await VibrationService.triggerAlertVibration(newAlert.severity, newAlert.type);

    // Persist active alerts
    await StorageService.saveActiveAlerts(this.activeAlerts);

    this.notifyListeners();
    return newAlert;
  }

  /**
   * User acknowledges the alert.
   * NOTE: ACKNOWLEDGED does NOT mean hazard is gone!
   */
  async acknowledgeAlert(alertId: string): Promise<boolean> {
    const alertIndex = this.activeAlerts.findIndex(a => a.id === alertId);
    if (alertIndex === -1) return false;

    const currentAlert = this.activeAlerts[alertIndex];
    if (currentAlert.state === 'ACTIVE') {
      const updatedAlert: Alert = {
        ...currentAlert,
        state: 'ACKNOWLEDGED',
        acknowledgedAt: Date.now(),
      };

      this.activeAlerts[alertIndex] = updatedAlert;

      // Stop phone vibration upon acknowledgment
      await VibrationService.stop();

      // Send ACK back to Common ESP32 over BLE
      await bluetoothService.sendAcknowledgement(alertId);

      // Persist state
      await StorageService.saveActiveAlerts(this.activeAlerts);
      this.notifyListeners();
      return true;
    }

    return false;
  }

  /**
   * Once actual hazard is cleared, mark alert as RESOLVED and move to history.
   */
  async resolveAlert(alertId: string): Promise<boolean> {
    const alertIndex = this.activeAlerts.findIndex(a => a.id === alertId);
    if (alertIndex === -1) return false;

    const resolvedAlert: Alert = {
      ...this.activeAlerts[alertIndex],
      state: 'RESOLVED',
      resolvedAt: Date.now(),
    };

    // Remove from active alerts
    this.activeAlerts = this.activeAlerts.filter(a => a.id !== alertId);

    // Add to history
    this.alertHistory = [resolvedAlert, ...this.alertHistory];

    // Stop vibration if any
    await VibrationService.stop();

    // Cancel notification
    const numericId = alertId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    await NotificationService.cancelNotification(numericId);

    // Persist both
    await StorageService.saveActiveAlerts(this.activeAlerts);
    await StorageService.saveAlertHistory(this.alertHistory);

    this.notifyListeners();
    return true;
  }

  getActiveAlerts(): Alert[] {
    return this.activeAlerts;
  }

  getAlertHistory(): Alert[] {
    return this.alertHistory;
  }

  getAlertById(alertId: string): Alert | undefined {
    return (
      this.activeAlerts.find(a => a.id === alertId) ||
      this.alertHistory.find(a => a.id === alertId)
    );
  }

  getLatestCriticalAlert(): Alert | undefined {
    return this.activeAlerts.find(a => a.severity === 'critical');
  }

  async clearAllAlerts(): Promise<void> {
    this.activeAlerts = [];
    this.alertHistory = [];
    await VibrationService.stop();
    await NotificationService.cancelAllNotifications();
    await StorageService.clearAllStorage();
    this.notifyListeners();
  }

  subscribe(listener: AlertChangeListener): () => void {
    this.listeners.add(listener);
    listener(this.activeAlerts, this.alertHistory);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    this.listeners.forEach(fn => {
      try {
        fn(this.activeAlerts, this.alertHistory);
      } catch (e) {
        console.error('[AlertManager] Notification listener error:', e);
      }
    });
  }

  private getDefaultTitleForType(type: AlertType): string {
    switch (type) {
      case 'fire':
        return '🔥 FIRE DETECTED';
      case 'smoke':
        return '💨 SMOKE DETECTED';
      case 'gas_leak':
        return '🟡 GAS LEAK DETECTED';
      case 'co':
        return '⚠ CARBON MONOXIDE DETECTED';
      case 'human_distress':
        return '🚨 HUMAN DISTRESS DETECTED';
      case 'intrusion':
        return '🛡 INTRUSION DETECTED';
      case 'doorbell':
        return '🔔 DOORBELL';
      case 'knocking':
        return '✊ KNOCKING DETECTED';
      default:
        return '⚠ SAFETY ALERT';
    }
  }
}

export const alertManager = new AlertManager();
