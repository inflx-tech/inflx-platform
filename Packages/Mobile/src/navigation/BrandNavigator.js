import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, View } from 'react-native';
import { colors } from '../theme/tokens';

function PlaceholderScreen({ title }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
      <Text style={{ fontSize: 16, color: colors.t2 }}>{title}</Text>
      <Text style={{ fontSize: 12, color: colors.t3, marginTop: 8 }}>Use brand web at localhost:3002</Text>
    </View>
  );
}

const Tab = createBottomTabNavigator();

export default function BrandNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.navy,
        tabBarInactiveTintColor: colors.t3,
        tabBarStyle: { borderTopColor: colors.border, backgroundColor: colors.white },
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600' },
      }}
    >
      <Tab.Screen name="Home" options={{ tabBarLabel: 'Home', tabBarIcon: () => <Text style={{ fontSize: 20 }}>🏠</Text> }}>
        {() => <PlaceholderScreen title="Brand Home" />}
      </Tab.Screen>
      <Tab.Screen name="Campaigns" options={{ tabBarLabel: 'Campaigns', tabBarIcon: () => <Text style={{ fontSize: 20 }}>📣</Text> }}>
        {() => <PlaceholderScreen title="Campaigns" />}
      </Tab.Screen>
      <Tab.Screen name="Wallet" options={{ tabBarLabel: 'Wallet', tabBarIcon: () => <Text style={{ fontSize: 20 }}>💰</Text> }}>
        {() => <PlaceholderScreen title="Wallet" />}
      </Tab.Screen>
    </Tab.Navigator>
  );
}
