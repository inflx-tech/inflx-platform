import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Text } from 'react-native';
import { colors } from '../theme/tokens';

import FeedScreen from '../screens/follower/FeedScreen';
import StoreScreen from '../screens/follower/StoreScreen';
import PayAtStoreScreen from '../screens/follower/PayAtStoreScreen';
import PreBookScreen from '../screens/follower/PreBookScreen';
import OnlineOrderScreen from '../screens/follower/OnlineOrderScreen';
import OrderDetailScreen from '../screens/follower/OrderDetailScreen';
import EnquiryScreen from '../screens/follower/EnquiryScreen';
import AddressScreen from '../screens/follower/AddressScreen';
import FollowerProfileScreen from '../screens/follower/FollowerProfileScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function HomeStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Feed" component={FeedScreen} />
      <Stack.Screen name="Store" component={StoreScreen} />
      <Stack.Screen name="PayAtStore" component={PayAtStoreScreen} />
      <Stack.Screen name="PreBook" component={PreBookScreen} />
      <Stack.Screen name="OnlineOrder" component={OnlineOrderScreen} />
      <Stack.Screen name="OrderDetail" component={OrderDetailScreen} />
      <Stack.Screen name="OrderHistory" component={OrderDetailScreen} />
      <Stack.Screen name="Enquiry" component={EnquiryScreen} />
      <Stack.Screen name="Address" component={AddressScreen} />
    </Stack.Navigator>
  );
}

export default function FollowerNavigator() {
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
      <Tab.Screen name="HomeTab" component={HomeStack} options={{ tabBarLabel: 'Discover', tabBarIcon: () => <Text style={{ fontSize: 20 }}>🏠</Text> }} />
      <Tab.Screen name="ProfileTab" component={FollowerProfileScreen} options={{ tabBarLabel: 'Profile', tabBarIcon: () => <Text style={{ fontSize: 20 }}>👤</Text> }} />
    </Tab.Navigator>
  );
}
