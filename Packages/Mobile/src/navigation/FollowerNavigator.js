import React from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
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

/**
 * The shopper app (follower-app-v2 · boards F1–F13 · rules v1.7 §5.1).
 * Bottom bar: Home · Discover · ▶ Play · Saved · Profile. Search sits top-right on every screen.
 * The bag joins the top bar with checkout (5.1); Discover shows "Coming soon" (5.13).
 * Replaces the profile-only navigator of 10 Sep (features/profile-only-apps).
 */
const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const ICON = { HomeTab: '⌂', DiscoverTab: '◎', PlayTab: '▶', SavedTab: '🔖', ProfileTab: '☺' };

function TabIcon({ name, focused, dark }) {
  if (name === 'PlayTab') {
    return <View style={[st.play, dark && { backgroundColor: '#fff' }]}><Text style={[st.playText, dark && { color: '#111' }]}>▶</Text></View>;
  }
  return <Text style={[st.icon, { color: focused ? (dark ? '#fff' : T.ink) : (dark ? '#888' : T.ink3) }]}>{ICON[name]}</Text>;
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
          tabBarIcon: ({ focused }) => <TabIcon name={route.name} focused={focused} dark={dark} />,
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
    </Stack.Navigator>
  );
}

const st = StyleSheet.create({
  bar: { backgroundColor: '#fff', borderTopColor: T.border, height: 60, paddingBottom: 8, paddingTop: 6 },
  barDark: { backgroundColor: '#111', borderTopColor: '#222', height: 60, paddingBottom: 8, paddingTop: 6 },
  label: { fontFamily: fonts.sansBold, fontSize: 10 },
  icon: { fontSize: 17, lineHeight: 20 },
  play: { width: 34, height: 34, borderRadius: 17, backgroundColor: T.ink, alignItems: 'center', justifyContent: 'center', marginTop: -8 },
  playText: { color: '#fff', fontSize: 13 },
});
