import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Text } from 'react-native';
import { colors, darkColors } from '../theme/tokens';

// V2 screens (dark theme, products-first)
import HomeScreenV2 from '../screens/follower/HomeScreenV2';
import FindScreen from '../screens/follower/FindScreen';
import CategoryListScreen from '../screens/follower/CategoryListScreen';

// Existing screens
import DealsScreen from '../screens/follower/DealsScreen';
import SavedScreen from '../screens/follower/SavedScreen';
import MeScreen from '../screens/follower/MeScreen';
import InfluencerStoreScreen from '../screens/follower/InfluencerStoreScreen';
import BrandStoreScreen from '../screens/follower/BrandStoreScreen';
import FollowedInfluencersScreen from '../screens/follower/FollowedInfluencersScreen';

// Car rental specific screens
import CarDetailScreen from '../screens/follower/CarDetailScreen';
import CarBookingScreen from '../screens/follower/CarBookingScreen';

// Auth gate for payments
import FollowerLoginScreen from '../screens/follower/FollowerLoginScreen';

// Existing transaction flow screens
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

// Shared screens used across multiple stacks
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
    <Stack.Screen name="Find" component={FindScreen} />
    <Stack.Screen name="CategoryList" component={CategoryListScreen} />
    <Stack.Screen name="CarDetail" component={CarDetailScreen} />
    <Stack.Screen name="CarBooking" component={CarBookingScreen} />
    <Stack.Screen name="FollowerLogin" component={FollowerLoginScreen} />
  </>
);

function HomeStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Home" component={HomeScreenV2} />
      {SHARED_SCREENS(Stack)}
    </Stack.Navigator>
  );
}

function FindStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="FindHome" component={FindScreen} />
      <Stack.Screen name="CategoryList" component={CategoryListScreen} />
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

function MyStuffStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MyStuffHome" component={SavedScreen} />
      <Stack.Screen name="OrderHistory" component={OrderHistoryScreen} />
      <Stack.Screen name="OrderDetail" component={OrderDetailScreen} />
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
        tabBarActiveTintColor: darkColors.amber,
        tabBarInactiveTintColor: darkColors.textMuted,
        tabBarStyle: {
          borderTopColor: darkColors.border,
          backgroundColor: darkColors.card,
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
        name="MyStuffTab"
        component={MyStuffStack}
        options={{
          tabBarLabel: 'My Stuff',
          tabBarIcon: ({ focused }) => (
            <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.5 }}>📋</Text>
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
