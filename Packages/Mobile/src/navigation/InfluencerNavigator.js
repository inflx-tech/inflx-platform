import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Text } from 'react-native';
import { colors } from '../theme/tokens';

import HomeScreen from '../screens/influencer/HomeScreen';
import OfferListScreen from '../screens/influencer/OfferListScreen';
import EarningsScreen from '../screens/influencer/EarningsScreen';
import ProfileScreen from '../screens/influencer/ProfileScreen';
import NegotiationScreen from '../screens/influencer/NegotiationScreen';
import ContractScreen from '../screens/influencer/ContractScreen';
import DeliverableScreen from '../screens/influencer/DeliverableScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function OffersStack() {
  const OfferDetailScreen = require('../screens/influencer/OfferDetailScreen').default;
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="OfferList" component={OfferListScreen} />
      <Stack.Screen name="OfferDetail" component={OfferDetailScreen} />
      <Stack.Screen name="Negotiation" component={NegotiationScreen} />
      <Stack.Screen name="Contract" component={ContractScreen} />
      <Stack.Screen name="Deliverable" component={DeliverableScreen} />
    </Stack.Navigator>
  );
}

const tabIcon = (icon, label) => ({ tabBarLabel: label, tabBarIcon: () => <Text style={{ fontSize: 20 }}>{icon}</Text> });

export default function InfluencerNavigator() {
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
      <Tab.Screen name="Home" component={HomeScreen} options={tabIcon('🏠', 'Home')} />
      <Tab.Screen name="Offers" component={OffersStack} options={tabIcon('📩', 'Offers')} />
      <Tab.Screen name="Earnings" component={EarningsScreen} options={tabIcon('💰', 'Earnings')} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={tabIcon('👤', 'Profile')} />
    </Tab.Navigator>
  );
}
