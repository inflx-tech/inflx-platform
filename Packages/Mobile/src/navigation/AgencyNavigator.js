import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import AgencyHomeScreen from '../screens/agency/AgencyHomeScreen';
import AgencyWalletScreen from '../screens/agency/AgencyWalletScreen';
import AgencyProfileScreen from '../screens/agency/AgencyProfileScreen';

const Tab = createBottomTabNavigator();

const P = { ink: '#0A0A0A', muted3: '#A1A1AA', white: '#FFFFFF', border: '#E4E4E7' };

function icon(name) {
  return ({ color, size }) => <Icon name={name} color={color} size={size} />;
}

export default function AgencyNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: P.ink,
        tabBarInactiveTintColor: P.muted3,
        tabBarStyle: { backgroundColor: P.white, borderTopColor: P.border },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
      }}
    >
      <Tab.Screen name="AgencyHome" component={AgencyHomeScreen} options={{ title: 'Home', tabBarIcon: icon('home-variant') }} />
      <Tab.Screen name="AgencyWallet" component={AgencyWalletScreen} options={{ title: 'Wallet', tabBarIcon: icon('wallet') }} />
      <Tab.Screen name="AgencyProfile" component={AgencyProfileScreen} options={{ title: 'Profile', tabBarIcon: icon('account') }} />
    </Tab.Navigator>
  );
}
