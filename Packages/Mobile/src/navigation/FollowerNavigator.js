import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { creatorVibe as C, fonts } from '../theme/tokens';

// V2 screens (products-first)
// Follower v2 — main home (world switcher)
import HomeScreen from '../screens/follower/HomeScreen';
import FindScreen from '../screens/follower/FindScreen';
import CategoryListScreen from '../screens/follower/CategoryListScreen';

// Wave 4 — dining redesign (replaces CategoryListScreen for eat)
import DishGroupResultScreen from '../screens/follower/DishGroupResultScreen';
import BookingConfirmedScreen from '../screens/follower/BookingConfirmedScreen';
import DiningSearchScreen from '../screens/follower/DiningSearchScreen';

// Existing screens
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
import OrderHistoryScreen from '../screens/follower/OrderHistoryScreen';
import AddressScreen from '../screens/follower/AddressScreen';
import LocationSearchScreen from '../screens/follower/LocationSearchScreen';
// Follower v2 (L1) — white/yellow location entry gateway
import LocationEntryScreen from '../screens/follower/LocationEntryScreen';
// Follower v2 (Wave B) — map pin picker (native, APK-gated; OTA-safe fallback)
import MapPinScreen from '../screens/follower/MapPinScreen';
// Follower v2 — address-details form (after the map pin)
import AddressDetailsScreen from '../screens/follower/AddressDetailsScreen';
// Fashion-1b — returns
import MyReturnsScreen from '../screens/follower/MyReturnsScreen';

// Post/Concept Stage A — the new Posts pillar (replaces the Reels placeholder
// on the center tab; the full new shell arrives with Stage B/C).
import PostsFeedScreen from '../screens/follower/PostsFeedScreen';
import PostViewerScreen from '../screens/follower/PostViewerScreen';
import PostProductScreen from '../screens/follower/PostProductScreen';
// Flow 52.7 — Creator-scoped category screen (mockup 4a)
import CreatorCategoryScreen from '../screens/follower/CreatorCategoryScreen';
// merch-engine — shared "View all" full-list results screen
import SectionResultsScreen from '../screens/follower/SectionResultsScreen';
// listing-category-browser (Type-1) — sidebar + product grid + facet filters
import CategoryBrowserScreen from '../screens/follower/CategoryBrowserScreen';
import FollowerPageScreen from '../screens/follower/FollowerPageScreen';
// Slice 1 (features/follower-profile-repairs) — saved posts become findable
// and a follower can finally correct their own name.
import SavedPostsScreen from '../screens/follower/SavedPostsScreen';
import EditProfileScreen from '../screens/follower/EditProfileScreen';
// Stage C2 — product wishlist + collections
import WishlistScreen from '../screens/follower/WishlistScreen';
// Stage C3 — Review Order (address · payment method · bill) before payment
import ReviewOrderScreen from '../screens/follower/ReviewOrderScreen';
// Stage B3 — concept-filtered posts (Discover banner landing)
import ConceptPostsScreen from '../screens/follower/ConceptPostsScreen';
import LegalListScreen from '../screens/legal/LegalListScreen';
import LegalDocumentScreen from '../screens/legal/LegalDocumentScreen';

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
    <Stack.Screen name="Address" component={AddressScreen} />
    <Stack.Screen name="LocationSearch" component={LocationSearchScreen} />
    <Stack.Screen name="LocationEntry" component={LocationEntryScreen} />
    <Stack.Screen name="MapPinPicker" component={MapPinScreen} />
    <Stack.Screen name="AddressDetails" component={AddressDetailsScreen} />
    <Stack.Screen name="Find" component={FindScreen} />
    <Stack.Screen name="CategoryList" component={CategoryListScreen} />
    <Stack.Screen name="CreatorCategory" component={CreatorCategoryScreen} />
    <Stack.Screen name="SectionResults" component={SectionResultsScreen} />
    {/* listing-category-browser (Type-1): tap a category → sidebar + grid + filters */}
    <Stack.Screen name="CategoryBrowser" component={CategoryBrowserScreen} />
    {/* App Builder E — an admin-created GLOBAL custom page (tap-destination ③) */}
    <Stack.Screen name="FollowerPage" component={FollowerPageScreen} />
    {/* Food World 3C-1 — dish-group craving → nearby restaurants result */}
    <Stack.Screen name="DishGroupResult" component={DishGroupResultScreen} />
    <Stack.Screen name="BookingConfirmed" component={BookingConfirmedScreen} />
    <Stack.Screen name="DiningSearch" component={DiningSearchScreen} />
    <Stack.Screen name="CarDetail" component={CarDetailScreen} />
    <Stack.Screen name="CarBooking" component={CarBookingScreen} />
    <Stack.Screen name="FollowerLogin" component={FollowerLoginScreen} />
    {/* Fashion-1b */}
    <Stack.Screen name="MyReturns" component={MyReturnsScreen} />
    {/* Stage C2 — wishlist + the post-PDP it opens (PostProduct lives HERE,
        not in PostsStack, so every stack that can reach Wishlist/Bag can open
        it without a duplicate route name — see the crash note above Orders). */}
    <Stack.Screen name="Wishlist" component={WishlistScreen} />
    <Stack.Screen name="PostProduct" component={PostProductScreen} />
    {/* Stage C3 — the Review Order step between Bag and payment */}
    <Stack.Screen name="ReviewOrder" component={ReviewOrderScreen} />
    {/* Stage B3 — a Discover banner's landing page (concept-filtered posts) */}
    <Stack.Screen name="ConceptPosts" component={ConceptPostsScreen} />
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

// Post/Concept Stage A — Posts pillar stack (feed → viewer → shared commerce).
function PostsStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="PostsFeed" component={PostsFeedScreen} />
      <Stack.Screen name="PostViewer" component={PostViewerScreen} />
      {SHARED_SCREENS(Stack)}
    </Stack.Navigator>
  );
}

// Offers tab removed 2026-06-23 (founder — not required in the follower app).

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
      <Stack.Screen name="FollowerLogin" component={FollowerLoginScreen} />
      {/* Returns row on MeScreen targets this; ProfileStack does not spread
          SHARED_SCREENS, so register it explicitly (no duplicate name here). */}
      <Stack.Screen name="MyReturns" component={MyReturnsScreen} />
      {/* Legal — registered ONLY here. ProfileStack does not spread
          SHARED_SCREENS, so one registration, no duplicate name (crash-class
          rule). Shoppers get the shopper document set. */}
      <Stack.Screen name="LegalList" component={LegalListScreen} initialParams={{ audience: 'shopper' }} />
      <Stack.Screen name="LegalDocument" component={LegalDocumentScreen} />
      {/* White sweep — Profile's Wishlist row + its shop-through path
          (Wishlist → PostProduct/Bag → Review → Confirmation). Explicit
          registrations, each name once in THIS stack (crash-class rule). */}
      <Stack.Screen name="Wishlist" component={WishlistScreen} />
      <Stack.Screen name="PostProduct" component={PostProductScreen} />
      <Stack.Screen name="Cart" component={CartScreen} />
      <Stack.Screen name="ReviewOrder" component={ReviewOrderScreen} />
      <Stack.Screen name="OrderConfirmation" component={OrderConfirmationScreen} />
      {/* Slice 1 (features/follower-profile-repairs) — Saved posts + Edit
          profile, and the viewer Saved posts opens. PostViewer is NOT in
          SHARED_SCREENS and ProfileStack does not spread it, so this is its
          only registration in this stack (duplicate route name in a native
          stack = uncatchable native crash on tab mount — the v93 incident). */}
      <Stack.Screen name="SavedPosts" component={SavedPostsScreen} />
      <Stack.Screen name="EditProfile" component={EditProfileScreen} />
      <Stack.Screen name="PostViewer" component={PostViewerScreen} />
    </Stack.Navigator>
  );
}

// (White sweep: the old center Posts FAB retired — Posts lives inside Home.)

// White sweep (features/follower-white-sweep): the app OPENS on Discover.
// HomeTab now renders the Discover|Posts|Videos surface (PostsStack); the old
// Creator-Vibe sections home + the center Posts FAB are retired from nav
// ("zero baggage" — files stay on disk until the cleanup contract). White-law
// tab bar: white surface, black active, grey inactive, hairline top.
export default function FollowerNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#111111',
        tabBarInactiveTintColor: '#9A9A9A',
        tabBarStyle: {
          borderTopColor: '#EEEEEE',
          borderTopWidth: 1,
          backgroundColor: '#FFFFFF',
          paddingTop: 6,
          height: 62,
        },
        tabBarLabelStyle: { fontSize: 10, fontWeight: '700', marginBottom: 6 },
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={PostsStack}
        options={{
          tabBarLabel: 'Home',
          tabBarIcon: ({ focused, color }) => (
            <Icon name={focused ? 'home-variant' : 'home-variant-outline'} size={22} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="OrdersTab"
        component={OrdersStack}
        options={{
          tabBarLabel: 'Orders',
          tabBarIcon: ({ focused, color }) => (
            <Icon name={focused ? 'shopping' : 'shopping-outline'} size={22} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ProfileStack}
        options={{
          tabBarLabel: 'Profile',
          tabBarIcon: ({ focused, color }) => (
            <Icon name={focused ? 'account' : 'account-outline'} size={22} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}
