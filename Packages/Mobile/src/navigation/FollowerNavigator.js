import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { creatorVibe as C, fonts } from '../theme/tokens';

// V2 screens (products-first)
import HomeScreenV2 from '../screens/follower/HomeScreenV2';
import FindScreen from '../screens/follower/FindScreen';
import CategoryListScreen from '../screens/follower/CategoryListScreen';

// Wave 4 — dining redesign (replaces CategoryListScreen for eat)
import DiningHomeScreen from '../screens/follower/DiningHomeScreen';
import DiningBrowseScreen from '../screens/follower/DiningBrowseScreen';
import BookingConfirmedScreen from '../screens/follower/BookingConfirmedScreen';
import FollowerWalletScreen from '../screens/follower/FollowerWalletScreen';
import RestaurantCartScreen from '../screens/follower/RestaurantCartScreen';
import DiningSearchScreen from '../screens/follower/DiningSearchScreen';

// Existing screens
import DealsScreen from '../screens/follower/DealsScreen';
import SavedScreen from '../screens/follower/SavedScreen';
import MeScreen from '../screens/follower/MeScreen';
import InfluencerStoreScreen from '../screens/follower/InfluencerStoreScreen';
import BrandStoreScreen from '../screens/follower/BrandStoreScreen';
import FollowedInfluencersScreen from '../screens/follower/FollowedInfluencersScreen';
import MealsChatScreen from '../screens/follower/MealsChatScreen';

// Car rental specific screens
import CarDetailScreen from '../screens/follower/CarDetailScreen';
import CarBookingScreen from '../screens/follower/CarBookingScreen';

// Auth gate for payments
import FollowerLoginScreen from '../screens/follower/FollowerLoginScreen';

// Existing transaction flow screens
import PayAtStoreScreen from '../screens/follower/PayAtStoreScreen';
import PreBookScreen from '../screens/follower/PreBookScreen';
import OnlineOrderScreen from '../screens/follower/OnlineOrderScreen';
import OrderConfirmationScreen from '../screens/follower/OrderConfirmationScreen';
import CartScreen from '../screens/follower/CartScreen';
import ProductDetailScreen from '../screens/follower/ProductDetailScreen';
import OrderDetailScreen from '../screens/follower/OrderDetailScreen';
import EnquiryScreen from '../screens/follower/EnquiryScreen';
import OrderHistoryScreen from '../screens/follower/OrderHistoryScreen';
import AddressScreen from '../screens/follower/AddressScreen';
import LocationSearchScreen from '../screens/follower/LocationSearchScreen';
// Fashion-1b + Fashion-2 — returns + lookbooks
import MyReturnsScreen from '../screens/follower/MyReturnsScreen';
import LookbookDetailScreen from '../screens/follower/LookbookDetailScreen';

// Flow 52.0 — Creator Vibe: Reels center tab (placeholder until 52.8 backend)
import ReelsScreen from '../screens/follower/ReelsScreen';
// Flow 52.7 — Creator-scoped category screen (mockup 4a)
import CreatorCategoryScreen from '../screens/follower/CreatorCategoryScreen';
// merch-engine — shared "View all" full-list results screen
import SectionResultsScreen from '../screens/follower/SectionResultsScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

// Shared screens used across multiple stacks
const SHARED_SCREENS = (Stack) => (
  <>
    <Stack.Screen name="InfluencerStore" component={InfluencerStoreScreen} />
    <Stack.Screen name="BrandStore" component={BrandStoreScreen} />
    <Stack.Screen name="MealsChat" component={MealsChatScreen} />
    <Stack.Screen name="ProductDetail" component={ProductDetailScreen} />
    <Stack.Screen name="PayAtStore" component={PayAtStoreScreen} />
    <Stack.Screen name="PreBook" component={PreBookScreen} />
    <Stack.Screen name="OnlineOrder" component={OnlineOrderScreen} />
    <Stack.Screen name="Cart" component={CartScreen} />
    <Stack.Screen name="OrderConfirmation" component={OrderConfirmationScreen} />
    <Stack.Screen name="OrderDetail" component={OrderDetailScreen} />
    <Stack.Screen name="Enquiry" component={EnquiryScreen} />
    <Stack.Screen name="Address" component={AddressScreen} />
    <Stack.Screen name="LocationSearch" component={LocationSearchScreen} />
    <Stack.Screen name="Find" component={FindScreen} />
    <Stack.Screen name="CategoryList" component={CategoryListScreen} />
    <Stack.Screen name="CreatorCategory" component={CreatorCategoryScreen} />
    <Stack.Screen name="SectionResults" component={SectionResultsScreen} />
    {/* Wave 4 — restaurant discovery surface (only routed to from the 'eat'
        category tile on HomeScreenV2; other categories keep CategoryList). */}
    <Stack.Screen name="DiningHome" component={DiningHomeScreen} />
    <Stack.Screen name="DiningBrowse" component={DiningBrowseScreen} />
    <Stack.Screen name="BookingConfirmed" component={BookingConfirmedScreen} />
    <Stack.Screen name="FollowerWallet" component={FollowerWalletScreen} />
    <Stack.Screen name="RestaurantCart" component={RestaurantCartScreen} />
    <Stack.Screen name="DiningSearch" component={DiningSearchScreen} />
    <Stack.Screen name="CarDetail" component={CarDetailScreen} />
    <Stack.Screen name="CarBooking" component={CarBookingScreen} />
    <Stack.Screen name="FollowerLogin" component={FollowerLoginScreen} />
    {/* Fashion-1b + Fashion-2 */}
    <Stack.Screen name="MyReturns" component={MyReturnsScreen} />
    <Stack.Screen name="LookbookDetail" component={LookbookDetailScreen} />
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

// 🏷️ Offers — platform-wide creator-backed deals (was the DEALS tab).
function OffersStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="OffersHome" component={DealsScreen} />
      {SHARED_SCREENS(Stack)}
    </Stack.Navigator>
  );
}

// 🛍️ Orders — order/booking history (was MY STUFF; Saved moves to Profile).
// NOTE: do NOT register "OrderDetail" here — SHARED_SCREENS already provides it.
// A duplicate route name in a native-stack navigator corrupts react-native-screens'
// native container and hard-crashes (uncatchable) the instant this stack mounts —
// this was the long-standing "INFLX keeps stopping" crash on the Orders tab.
function OrdersStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="OrdersHome" component={OrderHistoryScreen} />
      <Stack.Screen name="OrderHistory" component={OrderHistoryScreen} />
      {SHARED_SCREENS(Stack)}
    </Stack.Navigator>
  );
}

// 👤 Profile — account + wallet + saved (was ME). 'SavedList' now resolves
// (MeScreen's "Saved Offers" row pointed at it; previously undefined here).
function ProfileStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ProfileHome" component={MeScreen} />
      <Stack.Screen name="SavedList" component={SavedScreen} />
      <Stack.Screen name="OrderHistory" component={OrderHistoryScreen} />
      <Stack.Screen name="OrderDetail" component={OrderDetailScreen} />
      <Stack.Screen name="Address" component={AddressScreen} />
      <Stack.Screen name="FollowedInfluencers" component={FollowedInfluencersScreen} />
      <Stack.Screen name="InfluencerStore" component={InfluencerStoreScreen} />
      <Stack.Screen name="FollowerWallet" component={FollowerWalletScreen} />
    </Stack.Navigator>
  );
}

// 🎬 Reels center button — elevated terracotta FAB (custom tabBarButton).
function ReelsTabButton({ onPress, accessibilityState }) {
  const focused = accessibilityState?.selected;
  return (
    <View style={navStyles.reelsWrap} pointerEvents="box-none">
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel="Reels"
        style={[navStyles.reelsBtn, focused && navStyles.reelsBtnActive]}
      >
        <Icon name="movie-open" size={24} color={C.ink} />
        <Text style={navStyles.reelsLabel}>Reels</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function FollowerNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: C.brown,
        tabBarInactiveTintColor: C.muted,
        tabBarStyle: {
          borderTopColor: C.line,
          backgroundColor: C.card,
          paddingTop: 6,
          height: 62,
        },
        tabBarLabelStyle: { fontSize: 9, fontWeight: '800', fontFamily: fonts.monoBold, marginBottom: 6, letterSpacing: 0.2 },
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeStack}
        options={{
          tabBarLabel: 'HOME',
          tabBarIcon: ({ focused, color }) => (
            <Icon name={focused ? 'home-variant' : 'home-variant-outline'} size={22} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="OffersTab"
        component={OffersStack}
        options={{
          tabBarLabel: 'OFFERS',
          tabBarIcon: ({ focused, color }) => (
            <Icon name={focused ? 'tag' : 'tag-outline'} size={22} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="ReelsTab"
        component={ReelsScreen}
        options={{
          tabBarLabel: '',
          tabBarButton: (props) => <ReelsTabButton {...props} />,
        }}
      />
      <Tab.Screen
        name="OrdersTab"
        component={OrdersStack}
        options={{
          tabBarLabel: 'ORDERS',
          tabBarIcon: ({ focused, color }) => (
            <Icon name={focused ? 'shopping' : 'shopping-outline'} size={22} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ProfileStack}
        options={{
          tabBarLabel: 'PROFILE',
          tabBarIcon: ({ focused, color }) => (
            <Icon name={focused ? 'account' : 'account-outline'} size={22} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

const navStyles = StyleSheet.create({
  reelsWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reelsBtn: {
    width: 56,
    height: 56,
    borderRadius: 18,
    marginTop: -22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.brown,
    shadowColor: C.brownDark,
    shadowOpacity: 0.45,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  reelsBtnActive: {
    backgroundColor: C.brownDark,
  },
  reelsLabel: {
    color: C.ink,
    fontSize: 8,
    fontWeight: '800',
    fontFamily: fonts.monoBold,
    marginTop: 1,
    letterSpacing: 0.3,
  },
});
