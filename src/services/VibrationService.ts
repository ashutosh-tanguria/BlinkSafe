import { NativeVibration } from '../native/BlinkSafeNative';
import { AlertSeverity, AlertType } from '../models/alert';

export const VibrationService = {
  async triggerAlertVibration(severity: AlertSeverity, type?: AlertType): Promise<void> {
    if (type === 'human_distress') {
      await NativeVibration.vibratePattern('human_distress', true);
      return;
    }

    switch (severity) {
      case 'critical':
        await NativeVibration.vibratePattern('critical', true);
        break;
      case 'high':
        await NativeVibration.vibratePattern('high', false);
        break;
      case 'important':
        await NativeVibration.vibratePattern('important', false);
        break;
      case 'informational':
      default:
        await NativeVibration.vibratePattern('informational', false);
        break;
    }
  },

  async vibrateCritical(): Promise<void> {
    await NativeVibration.vibratePattern('critical', true);
  },

  async vibrateHumanDistress(): Promise<void> {
    await NativeVibration.vibratePattern('human_distress', true);
  },

  async vibrateImportant(): Promise<void> {
    await NativeVibration.vibratePattern('important', false);
  },

  async vibrateInformational(): Promise<void> {
    await NativeVibration.vibratePattern('informational', false);
  },

  async vibrateTest(): Promise<void> {
    await NativeVibration.vibratePattern('test', false);
  },

  async stop(): Promise<void> {
    await NativeVibration.stop();
  },
};
