import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Text } from 'react-native';
import { colors } from '../theme/tokens';

// New screens
import HomeScreen from '../screens/follower/HomeScreen';
import DealsScreen from '../screens/follower/DealsScreen';
import SavedScreen from '../screens/follower/SavedScreen';
import MeScreen from '../screens/follower/MeScreen';
import InfluencerStoreScreen from '../screens/follower/InfluencerStoreScreen';
import BrandStoreScreen from '../screens/follower/BrandStoreScreen';
import FollowedInfluencersScreen from '../screens/follower/FollowedInfluencersScreen';

// Existing screens (transaction flows)
import PayAtStoreScreen from '../screens/follower/PayAtStoreScreen';
import PreBookScreen from '../screens/follower/PreBookScreen';
import OnlineOrderScreen from '../screens/follower/OnlineOrderScreen';
import ProductDetailScreen from '../screens/follower/ProductDetailScreen';
import OrderDetailScreen from '../screens/follower/OrderDetailScreen';
import EnquiryScreen from '../screens/follower/EnquiryScreen';
import OrderHistoryScreen from '../screens/follower/OrderHistoryScreen';
import AddressScreen from '../screens/follower/AddressScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

// Shared transaction screens used across multiple stacks
const SHARED_SCREENS = (Stack) => (
  <>
    <Stack.Screen name="InfluencerStore" component={InfluencerStoreScreen} />
    <Stack.Screen name="BrandStore" component={BrandStoreScreen} />
    <Stack.Screen name="ProductDetail" component={ProductDetailScreen} />
    <Stack.Screen name="PayAtStore" component={PayAtStoreScreen} />
    <Stack.Screen name="PreBook" component={PreBookScreen} />
    <Stack.Screen name="OnlineOrder" component={OnlineOrderScreen} />
    <Stack.Screen name="OrderDetail" component={OrderDetailScreen} />
    <Stack.Screen name="Enquiry" component={EnquiryScreen} />
    <Stack.Screen name="Address" component={AddressScreen} />
  </>
);

function HomeStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Home" component={HomeScreen} />
      {SHARED_SCREENS(Stack)}
    </Stack.Navigator>
  );
}

function DealsStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="DealsBrowse" component={DealsScreen} />
      {SHARED_SCREENS(Stack)}
    </Stack.Navigator>
  );
}

function OrdersStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="OrderHistory" component={OrderHistoryScreen} />
      <Stack.Screen name="OrderDetail" component={OrderDetailScreen} />
    </Stack.Navigator>
  );
}

function SavedStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="SavedList" component={SavedScreen} />
      {SHARED_SCREENS(Stack)}
    </Stack.Navigator>
  );
}

function MeStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MeHome" component={MeScreen} />
      <Stack.Screen name="OrderHistory" component={OrderHistoryScreen} />
      <Stack.Screen name="OrderDetail" component={OrderDetailScreen} />
      <Stack.Screen name="Address" component={AddressScreen} />
      <Stack.Screen name="FollowedInfluencers" component={FollowedInfluencersScreen} />
      <Stack.Screen name="InfluencerStore" component={InfluencerStoreScreen} />
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
        tabBarStyle: {
          borderTopColor: colors.border,
          backgroundColor: colors.white,
          paddingTop: 4,
          height: 60,
        },
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600', marginBottom: 4 },
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeStack}
        options={{
          tabBarLabel: 'Home',
          tabBarIcon: ({ focused }) => (
            <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.5 }}>🏠</Text>
          ),
        }}
      />
      <Tab.Screen
        name="DealsTab"
        component={DealsStack}
        options={{
          tabBarLabel: 'Deals',
          tabBarIcon: ({ focused }) => (
            <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.5 }}>🏷️</Text>
          ),
        }}
      />
      <Tab.Screen
        name="OrdersTab"
        component={OrdersStack}
        options={{
          tabBarLabel: 'Orders',
          tabBarIcon: ({ focused }) => (
            <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.5 }}>📦</Text>
          ),
        }}
      />
      <Tab.Screen
        name="SavedTab"
        component={SavedStack}
        options={{
          tabBarLabel: 'Saved',
          tabBarIcon: ({ focused }) => (
            <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.5 }}>🔖</Text>
          ),
        }}
      />
      <Tab.Screen
        name="MeTab"
        component={MeStack}
        options={{
          tabBarLabel: 'Me',
          tabBarIcon: ({ focused }) => (
            <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.5 }}>👤</Text>
          ),
        }}
      />
    </Tab.Navigator>
  );
}
