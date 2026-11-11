import { PermissionsAndroid, Platform } from 'react-native';

export interface PermissionStatus {
  bluetoothScan: boolean;
  bluetoothConnect: boolean;
  notifications: boolean;
  location: boolean;
  allGranted: boolean;
}

export const PermissionService = {
  async checkPermissions(): Promise<PermissionStatus> {
    if (Platform.OS !== 'android') {
      return {
        bluetoothScan: true,
        bluetoothConnect: true,
        notifications: true,
        location: true,
        allGranted: true,
      };
    }

    try {
      const apiLevel = Platform.Version;

      if (apiLevel >= 33) {
        const hasBtScan = await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN
        );
        const hasBtConnect = await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT
        );
        const hasNotif = await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
        );

        return {
          bluetoothScan: hasBtScan,
          bluetoothConnect: hasBtConnect,
          notifications: hasNotif,
          location: true,
          allGranted: hasBtScan && hasBtConnect && hasNotif,
        };
      } else if (apiLevel >= 31) {
        const hasBtScan = await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN
        );
        const hasBtConnect = await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT
        );
        const hasFineLoc = await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
        );

        return {
          bluetoothScan: hasBtScan,
          bluetoothConnect: hasBtConnect,
          notifications: true,
          location: hasFineLoc,
          allGranted: hasBtScan && hasBtConnect && hasFineLoc,
        };
      } else {
        const hasFineLoc = await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
        );

        return {
          bluetoothScan: true,
          bluetoothConnect: true,
          notifications: true,
          location: hasFineLoc,
          allGranted: hasFineLoc,
        };
      }
    } catch (e) {
      console.warn('[PermissionService] Check permissions error:', e);
      return {
        bluetoothScan: true,
        bluetoothConnect: true,
        notifications: true,
        location: true,
        allGranted: true,
      };
    }
  },

  async requestSafetyPermissions(): Promise<PermissionStatus> {
    if (Platform.OS !== 'android') {
      return {
        bluetoothScan: true,
        bluetoothConnect: true,
        notifications: true,
        location: true,
        allGranted: true,
      };
    }

    try {
      const apiLevel = Platform.Version;
      const permissionsToRequest: any[] = [];

      if (apiLevel >= 33) {
        permissionsToRequest.push(
          PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT
        );
      } else if (apiLevel >= 31) {
        permissionsToRequest.push(
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
        );
      } else {
        permissionsToRequest.push(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
        );
      }

      const results = await PermissionsAndroid.requestMultiple(permissionsToRequest);
      return await this.checkPermissions();
    } catch (e) {
      console.error('[PermissionService] Error requesting permissions:', e);
      return await this.checkPermissions();
    }
  },
};
