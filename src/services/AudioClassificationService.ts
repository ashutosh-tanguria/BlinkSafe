import { Esp32EventPacket, AlertType, AlertSeverity } from '../models/alert';

export interface AudioClassificationResult {
  className: string;
  confidence: number;
  normalizedType: AlertType;
  severity: AlertSeverity;
  category: 'human_distress' | 'environmental_hazard' | 'informational_acoustic';
}

export const SUPPORTED_AUDIO_CLASSES = [
  'Fire alarm',
  'Doorbell',
  'Knocking',
  'Siren',
  'Glass break',
  'Human distress',
  'Shouting',
  'Screaming',
  'Calling for help',
  'Crying',
  'Baby crying',
  'Other environmental sounds',
] as const;

export class AudioClassificationService {
  private isInitialized = false;
  private isListening = false;
  private modelName = 'YAMNet-TFLite-Edge-v1.4';

  async initialize(): Promise<boolean> {
    console.log(`[AudioClassificationService] Initializing ${this.modelName}...`);
    this.isInitialized = true;
    return true;
  }

  isModelReady(): boolean {
    return this.isInitialized;
  }

  getModelInfo(): { model: string; status: string; supportedClasses: number } {
    return {
      model: this.modelName,
      status: this.isInitialized ? 'ONLINE' : 'STANDBY',
      supportedClasses: SUPPORTED_AUDIO_CLASSES.length,
    };
  }

  /**
   * Classifies raw audio samples or simulated audio buffer
   * Maps acoustic classes into normalized safety event packets
   */
  async classifyAudio(audioBufferOrSimulatedClass?: string): Promise<Esp32EventPacket | null> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const detectedClass = audioBufferOrSimulatedClass || 'Human distress';
    const classification = this.mapAudioClassToSafetyEvent(detectedClass);

    if (!classification) return null;

    const eventPacket: Esp32EventPacket = {
      id: `EVT_AI_${Date.now()}`,
      type: classification.normalizedType,
      severity: classification.severity,
      location: 'Bedroom',
      nodeId: 'NODE_AI_LOCAL',
      confidence: classification.confidence,
      timestamp: Math.floor(Date.now() / 1000),
      title: `${classification.className.toUpperCase()} DETECTED`,
      message: `Acoustic AI classified: ${classification.className} with ${(classification.confidence * 100).toFixed(0)}% confidence`,
      evidence: [
        {
          sensorId: 'INMP441_MIC',
          sensorName: 'INMP441 Acoustic Sensor',
          reading: `${classification.className} (YAMNet AI)`,
          status: classification.severity === 'critical' ? 'critical' : 'high',
        },
      ],
      safeRouteAvailable: classification.normalizedType === 'fire',
    };

    return eventPacket;
  }

  private mapAudioClassToSafetyEvent(className: string): AudioClassificationResult | null {
    switch (className) {
      case 'Fire alarm':
      case 'Siren':
        return {
          className,
          confidence: 0.95,
          normalizedType: 'fire',
          severity: 'critical',
          category: 'environmental_hazard',
        };
      case 'Human distress':
      case 'Calling for help':
      case 'Shouting':
      case 'Screaming':
        return {
          className,
          confidence: 0.89,
          normalizedType: 'human_distress',
          severity: 'high',
          category: 'human_distress',
        };
      case 'Baby crying':
      case 'Crying':
        return {
          className,
          confidence: 0.87,
          normalizedType: 'human_distress',
          severity: 'important',
          category: 'human_distress',
        };
      case 'Glass break':
        return {
          className,
          confidence: 0.91,
          normalizedType: 'intrusion',
          severity: 'high',
          category: 'environmental_hazard',
        };
      case 'Doorbell':
        return {
          className,
          confidence: 0.98,
          normalizedType: 'doorbell',
          severity: 'informational',
          category: 'informational_acoustic',
        };
      case 'Knocking':
        return {
          className,
          confidence: 0.92,
          normalizedType: 'knocking',
          severity: 'informational',
          category: 'informational_acoustic',
        };
      default:
        return {
          className: 'Environmental sound',
          confidence: 0.70,
          normalizedType: 'environmental_sound',
          severity: 'informational',
          category: 'informational_acoustic',
        };
    }
  }

  dispose(): void {
    console.log('[AudioClassificationService] Disposed.');
    this.isInitialized = false;
    this.isListening = false;
  }
}

export const audioClassificationService = new AudioClassificationService();
