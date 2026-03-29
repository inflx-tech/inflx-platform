import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Text } from 'react-native';
import { colors } from '../theme/tokens';

import BrandHomeScreen from '../screens/brand/BrandHomeScreen';
import BrandCampaignListScreen from '../screens/brand/BrandCampaignListScreen';
import BrandWalletScreen from '../screens/brand/BrandWalletScreen';
import BrandNotificationsScreen from '../screens/brand/BrandNotificationsScreen';
import BrandProfileScreen from '../screens/brand/BrandProfileScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function HomeStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="BrandHome" component={BrandHomeScreen} />
    </Stack.Navigator>
  );
}

function CampaignsStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="CampaignList" component={BrandCampaignListScreen} />
    </Stack.Navigator>
  );
}

function ProfileStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="BrandProfile" component={BrandProfileScreen} />
      <Stack.Screen name="Notifications" component={BrandNotificationsScreen} />
    </Stack.Navigator>
  );
}

const tabIcon = (icon, label) => ({
  tabBarLabel: label,
  tabBarIcon: () => <Text style={{ fontSize: 20 }}>{icon}</Text>,
});

export default function BrandNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.orange,
        tabBarInactiveTintColor: colors.t3,
        tabBarStyle: { borderTopColor: colors.border, backgroundColor: colors.white },
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600' },
      }}
    >
      <Tab.Screen name="Home" component={HomeStack} options={tabIcon('🏠', 'Home')} />
      <Tab.Screen name="Campaigns" component={CampaignsStack} options={tabIcon('📣', 'Campaigns')} />
      <Tab.Screen name="Wallet" component={BrandWalletScreen} options={tabIcon('💰', 'Wallet')} />
      <Tab.Screen name="Alerts" component={BrandNotificationsScreen} options={tabIcon('🔔', 'Alerts')} />
      <Tab.Screen name="Profile" component={ProfileStack} options={tabIcon('👤', 'Profile')} />
    </Tab.Navigator>
  );
}
