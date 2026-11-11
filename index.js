if (typeof globalThis !== 'undefined' && typeof global === 'undefined') {
  globalThis.global = globalThis;
}

import { enableScreens } from 'react-native-screens';
enableScreens(true);

import { AppRegistry } from 'react-native';
import App from './src/App';
import { name as appName } from './app.json';

AppRegistry.registerComponent(appName, () => App);

