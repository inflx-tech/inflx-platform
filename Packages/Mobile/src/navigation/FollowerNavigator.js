import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Text } from 'react-native';
import { colors } from '../theme/tokens';

import FeedScreen from '../screens/follower/FeedScreen';
import StoreScreen from '../screens/follower/StoreScreen';
import PayAtStoreScreen from '../screens/follower/PayAtStoreScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function HomeStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Feed" component={FeedScreen} />
      <Stack.Screen name="Store" component={StoreScreen} />
      <Stack.Screen name="PayAtStore" component={PayAtStoreScreen} />
      <Stack.Screen name="PreBook" component={PayAtStoreScreen} />
      <Stack.Screen name="ProductDetail" component={StoreScreen} />
      <Stack.Screen name="Enquiry" component={StoreScreen} />
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
      <Tab.Screen name="HomeTab" component={HomeStack} options={{ tabBarLabel: 'Home', tabBarIcon: () => <Text style={{ fontSize: 20 }}>🏠</Text> }} />
    </Tab.Navigator>
  );
}
