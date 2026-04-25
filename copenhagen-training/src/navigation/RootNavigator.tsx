import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Text } from 'react-native';
import { colors } from '../theme';

import DashboardScreen from '../screens/DashboardScreen';
import MPSessionsScreen from '../screens/MPSessionsScreen';
import MPSessionDetailScreen from '../screens/MPSessionDetailScreen';
import LongRunsScreen from '../screens/LongRunsScreen';
import LongRunDetailScreen from '../screens/LongRunDetailScreen';
import BlockOverviewScreen from '../screens/BlockOverviewScreen';

export type MPStackParamList = {
  MPList: undefined;
  MPDetail: { activityId: string; activityName: string };
};

export type LongRunStackParamList = {
  LRList: undefined;
  LRDetail: { activityId: string; activityName: string };
};

const Tab = createBottomTabNavigator();
const MPStack = createNativeStackNavigator<MPStackParamList>();
const LRStack = createNativeStackNavigator<LongRunStackParamList>();

const screenOptions = {
  headerStyle: { backgroundColor: colors.card },
  headerTintColor: colors.text,
  headerTitleStyle: { color: colors.text, fontSize: 16 },
};

function MPNavigator() {
  return (
    <MPStack.Navigator screenOptions={screenOptions}>
      <MPStack.Screen name="MPList" component={MPSessionsScreen} options={{ title: 'MP Sessions' }} />
      <MPStack.Screen name="MPDetail" component={MPSessionDetailScreen} options={({ route }) => ({ title: route.params.activityName })} />
    </MPStack.Navigator>
  );
}

function LongRunNavigator() {
  return (
    <LRStack.Navigator screenOptions={screenOptions}>
      <LRStack.Screen name="LRList" component={LongRunsScreen} options={{ title: 'Long Runs' }} />
      <LRStack.Screen name="LRDetail" component={LongRunDetailScreen} options={({ route }) => ({ title: route.params.activityName })} />
    </LRStack.Navigator>
  );
}

function TabIcon({ label, focused }: { label: string; focused: boolean }) {
  return (
    <Text style={{ fontSize: 11, color: focused ? colors.accent : colors.textSecondary, marginTop: 2 }}>
      {label}
    </Text>
  );
}

export default function RootNavigator() {
  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.border },
          tabBarActiveTintColor: colors.accent,
          tabBarInactiveTintColor: colors.textSecondary,
          tabBarShowLabel: true,
          tabBarLabelStyle: { fontSize: 11 },
        }}
      >
        <Tab.Screen
          name="Dashboard"
          component={DashboardScreen}
          options={{
            headerShown: true,
            headerStyle: { backgroundColor: colors.card },
            headerTintColor: colors.text,
            title: 'Copenhagen Training',
            tabBarLabel: 'Home',
            tabBarIcon: ({ focused }) => <TabIcon label="⌂" focused={focused} />,
          }}
        />
        <Tab.Screen
          name="MPSessions"
          component={MPNavigator}
          options={{
            title: 'MP Sessions',
            tabBarLabel: 'MP',
            tabBarIcon: ({ focused }) => <TabIcon label="⚡" focused={focused} />,
          }}
        />
        <Tab.Screen
          name="LongRuns"
          component={LongRunNavigator}
          options={{
            title: 'Long Runs',
            tabBarLabel: 'Long',
            tabBarIcon: ({ focused }) => <TabIcon label="◎" focused={focused} />,
          }}
        />
        <Tab.Screen
          name="BlockOverview"
          component={BlockOverviewScreen}
          options={{
            headerShown: true,
            headerStyle: { backgroundColor: colors.card },
            headerTintColor: colors.text,
            title: 'Block Overview',
            tabBarLabel: 'Block',
            tabBarIcon: ({ focused }) => <TabIcon label="▦" focused={focused} />,
          }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
