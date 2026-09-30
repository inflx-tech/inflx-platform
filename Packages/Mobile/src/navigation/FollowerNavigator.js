import React from 'react';
import { View, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useNavigationState } from '@react-navigation/native';
import { settingsTokens as T, fonts } from '../theme/tokens';
import { CS } from '../components/shop/copyShop';

import HomeScreen from '../screens/shop/HomeScreen';
import DiscoverScreen from '../screens/shop/DiscoverScreen';
import PlayScreen from '../screens/shop/PlayScreen';
import SavedScreen from '../screens/shop/SavedScreen';
import ProfileScreen from '../screens/shop/ProfileScreen';
import WelcomeScreen from '../screens/shop/WelcomeScreen';
import PostScreen from '../screens/shop/PostScreen';
import CommentsScreen from '../screens/shop/CommentsScreen';
import CreatorStoreScreen from '../screens/shop/CreatorStoreScreen';
import CollectionScreen from '../screens/shop/CollectionScreen';
import BrandStoreScreen from '../screens/shop/BrandStoreScreen';
import BrandOffersScreen from '../screens/shop/BrandOffersScreen';
import OfferPostsScreen from '../screens/shop/OfferPostsScreen';
import SearchScreen from '../screens/shop/SearchScreen';
import EditProfileScreen from '../screens/follower/EditProfileScreen';
import FollowerLoginScreen from '../screens/follower/FollowerLoginScreen';
import LegalListScreen from '../screens/legal/LegalListScreen';
import LegalDocumentScreen from '../screens/legal/LegalDocumentScreen';
import DealScreen from '../screens/shop/order/DealScreen';
import DealReviewScreen from '../screens/shop/order/DealReviewScreen';
import BagScreen from '../screens/shop/order/BagScreen';
import AddressesScreen from '../screens/shop/order/AddressesScreen';
import AddressFormScreen from '../screens/shop/order/AddressFormScreen';
import CheckoutScreen from '../screens/shop/order/CheckoutScreen';
import OrderPlacedScreen from '../screens/shop/order/OrderPlacedScreen';
import OrdersScreen from '../screens/shop/order/OrdersScreen';
import OrderDetailScreen from '../screens/shop/order/OrderDetailScreen';
import CancelScreen from '../screens/shop/order/CancelScreen';

/**
 * The shopper app (follower-app-v2 · boards F1–F13 · rules v1.7 §5.1).
 * Bottom bar: Home · Discover · ▶ Play · Saved · Profile. Search sits top-right on every screen.
 * The bag sits in the top bar next to search (shopper-ordering, 6.6); Discover shows "Coming soon" (5.13).
 * Replaces the profile-only navigator of 10 Sep (features/profile-only-apps).
 */
const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// Plain icons, black and white (mono rule): outline when not selected, filled when selected.
const ICON = {
  HomeTab: ['home-outline', 'home'], DiscoverTab: ['compass-outline', 'compass'],
  SavedTab: ['bookmark-outline', 'bookmark'], ProfileTab: ['account-outline', 'account'],
};

// The bar is dark while Play is the open tab, so every icon follows the OPEN tab (not its own name).
function TabIcon({ name, focused }) {
  const dark = useNavigationState((st2) => (st2 && st2.routes ? st2.routes[st2.index].name === 'PlayTab' : false));
  if (name === 'PlayTab') {
    return <View style={[st.play, dark && { backgroundColor: '#fff' }]}><Icon name="play" size={20} color={dark ? '#111' : '#fff'} /></View>;
  }
  return <Icon name={ICON[name][focused ? 1 : 0]} size={22} color={focused ? (dark ? '#fff' : T.ink) : (dark ? '#888' : T.ink3)} />;
}

function Tabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => {
        const dark = route.name === 'PlayTab';
        return {
          headerShown: false,
          tabBarActiveTintColor: dark ? '#fff' : T.ink,
          tabBarInactiveTintColor: dark ? '#888' : T.ink3,
          tabBarStyle: dark ? st.barDark : st.bar,
          tabBarLabelStyle: st.label,
          tabBarIcon: ({ focused }) => <TabIcon name={route.name} focused={focused} />,
          tabBarTestID: `tab-${route.name}`,
        };
      }}>
      <Tab.Screen name="HomeTab" component={HomeScreen} options={{ tabBarLabel: CS.home }} />
      <Tab.Screen name="DiscoverTab" component={DiscoverScreen} options={{ tabBarLabel: CS.discover }} />
      <Tab.Screen name="PlayTab" component={PlayScreen} options={{ tabBarLabel: CS.play }} />
      <Tab.Screen name="SavedTab" component={SavedScreen} options={{ tabBarLabel: CS.saved }} />
      <Tab.Screen name="ProfileTab" component={ProfileScreen} options={{ tabBarLabel: CS.profile }} />
    </Tab.Navigator>
  );
}

export default function FollowerNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Tabs" component={Tabs} />
      <Stack.Screen name="Welcome" component={WelcomeScreen} options={{ presentation: 'modal' }} />
      <Stack.Screen name="Post" component={PostScreen} />
      <Stack.Screen name="Comments" component={CommentsScreen} options={{ presentation: 'modal' }} />
      <Stack.Screen name="CreatorStore" component={CreatorStoreScreen} />
      <Stack.Screen name="Collection" component={CollectionScreen} />
      <Stack.Screen name="BrandStore" component={BrandStoreScreen} />
      <Stack.Screen name="BrandOffers" component={BrandOffersScreen} />
      <Stack.Screen name="OfferPosts" component={OfferPostsScreen} />
      <Stack.Screen name="Search" component={SearchScreen} />
      <Stack.Screen name="EditProfile" component={EditProfileScreen} />
      <Stack.Screen name="FollowerLogin" component={FollowerLoginScreen} />
      {/* Legal — shoppers get the shopper document set. */}
      <Stack.Screen name="LegalList" component={LegalListScreen} initialParams={{ audience: 'shopper' }} />
      <Stack.Screen name="LegalDocument" component={LegalDocumentScreen} />
      {/* Ordering (shopper-ordering · board O1–O17, D1, P/B/V/K/G, D4, D11) */}
      <Stack.Screen name="Deal" component={DealScreen} />
      <Stack.Screen name="DealReview" component={DealReviewScreen} />
      <Stack.Screen name="Bag" component={BagScreen} />
      <Stack.Screen name="Addresses" component={AddressesScreen} />
      <Stack.Screen name="AddressForm" component={AddressFormScreen} />
      <Stack.Screen name="Checkout" component={CheckoutScreen} />
      <Stack.Screen name="OrderPlaced" component={OrderPlacedScreen} options={{ gestureEnabled: false }} />
      <Stack.Screen name="Orders" component={OrdersScreen} />
      <Stack.Screen name="OrderDetail" component={OrderDetailScreen} />
      <Stack.Screen name="CancelItem" component={CancelScreen} />
    </Stack.Navigator>
  );
}

const st = StyleSheet.create({
  bar: { backgroundColor: '#fff', borderTopColor: T.border, height: 60, paddingBottom: 8, paddingTop: 6 },
  barDark: { backgroundColor: '#111', borderTopColor: '#222', height: 60, paddingBottom: 8, paddingTop: 6 },
  label: { fontFamily: fonts.sansBold, fontSize: 10 },
  play: { width: 36, height: 36, borderRadius: 18, backgroundColor: T.ink, alignItems: 'center', justifyContent: 'center', marginTop: -6 },
});
