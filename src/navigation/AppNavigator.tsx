import React from 'react';
import { Text, View } from 'react-native';
import { NavigationContainer, LinkingOptions } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Colors } from '../theme';

import { HomeScreen } from '../screens/HomeScreen';
import { AlertsScreen } from '../screens/AlertsScreen';
import { DevicesScreen } from '../screens/DevicesScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { EmergencyScreen } from '../screens/EmergencyScreen';
import { EvacuationScreen } from '../screens/EvacuationScreen';
import { AlertDetailScreen } from '../screens/AlertDetailScreen';

export type RootStackParamList = {
  MainTabs: undefined;
  Emergency: { alertId?: string };
  Evacuation: { alertId?: string; location?: string };
  AlertDetail: { alertId: string };
};

export type BottomTabParamList = {
  HomeTab: undefined;
  AlertsTab: undefined;
  DevicesTab: undefined;
  SettingsTab: undefined;
};

const Tab = createBottomTabNavigator<BottomTabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

function TabNavigator() {
  return (
    <Tab.Navigator
      detachInactiveScreens={false}
      screenOptions={{
        headerShown: false,
        lazy: false,
        freezeOnBlur: true,
        tabBarStyle: {
          backgroundColor: '#0B0F19',
          borderTopColor: '#1E293B',
          borderTopWidth: 1,
          height: 64,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarActiveTintColor: Colors.accent,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '700',
        },
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeScreen}
        options={{
          tabBarLabel: 'Home',
          tabBarIcon: ({ focused }) => (
            <Text style={{ fontSize: 20, color: focused ? Colors.accent : Colors.textMuted }}>
              🏠
            </Text>
          ),
        }}
      />
      <Tab.Screen
        name="AlertsTab"
        component={AlertsScreen}
        options={{
          tabBarLabel: 'Alerts',
          tabBarIcon: ({ focused }) => (
            <Text style={{ fontSize: 20, color: focused ? Colors.accent : Colors.textMuted }}>
              🚨
            </Text>
          ),
        }}
      />
      <Tab.Screen
        name="DevicesTab"
        component={DevicesScreen}
        options={{
          tabBarLabel: 'Devices',
          tabBarIcon: ({ focused }) => (
            <Text style={{ fontSize: 20, color: focused ? Colors.accent : Colors.textMuted }}>
              📡
            </Text>
          ),
        }}
      />
      <Tab.Screen
        name="SettingsTab"
        component={SettingsScreen}
        options={{
          tabBarLabel: 'Settings',
          tabBarIcon: ({ focused }) => (
            <Text style={{ fontSize: 20, color: focused ? Colors.accent : Colors.textMuted }}>
              ⚙
            </Text>
          ),
        }}
      />
    </Tab.Navigator>
  );
}

const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ['blinksafe://'],
  config: {
    screens: {
      MainTabs: {
        path: '',
        screens: {
          HomeTab: 'home',
          AlertsTab: 'alerts',
          DevicesTab: 'devices',
          SettingsTab: 'settings',
        },
      },
      Emergency: 'alert/:alertId',
      AlertDetail: 'detail/:alertId',
      Evacuation: 'evacuate/:alertId',
    },
  },
};

export function AppNavigator({ navigationRef }: { navigationRef: any }) {
  return (
    <NavigationContainer ref={navigationRef} linking={linking}>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: Colors.background },
          animation: 'fade',
        }}
      >
        <Stack.Screen name="MainTabs" component={TabNavigator} />
        <Stack.Screen
          name="Emergency"
          component={EmergencyScreen}
          options={{
            presentation: 'fullScreenModal',
            animation: 'slide_from_bottom',
          }}
        />
        <Stack.Screen
          name="Evacuation"
          component={EvacuationScreen}
          options={{
            animation: 'slide_from_right',
          }}
        />
        <Stack.Screen
          name="AlertDetail"
          component={AlertDetailScreen}
          options={{
            animation: 'slide_from_right',
          }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
