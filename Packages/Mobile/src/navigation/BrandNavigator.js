import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { settingsTokens as T, fonts } from '../theme/tokens';

import BrandProfileScreen from '../screens/brand/BrandProfileScreen';
import LegalListScreen from '../screens/legal/LegalListScreen';
import LegalDocumentScreen from '../screens/legal/LegalDocumentScreen';
// Item 2 — pitch settings, blocked creators. Contract: features/item2-pitch-invitation-settings
import BrandPitchSettingsScreen from '../screens/brand/BrandPitchSettingsScreen';
import BrandBlockedCreatorsScreen from '../screens/brand/BrandBlockedCreatorsScreen';
import BrandCreatorProfileScreen from '../screens/brand/BrandCreatorProfileScreen';
// Item 3 — the five-tab shell, discovery, groups, profile screens and the brand overview.
// Contract: features/item3-discovery-profiles-groups
import ComingSoonScreen from '../components/shell/ComingSoonScreen';
import BrandCreatorsScreen from '../screens/brand/BrandCreatorsScreen';
import BrandGroupDetailScreen from '../screens/brand/BrandGroupDetailScreen';
import BrandGroupAddCreatorsScreen from '../screens/brand/BrandGroupAddCreatorsScreen';
import BrandBusinessDetailsScreen from '../screens/brand/BrandBusinessDetailsScreen';
import BrandSubCategoriesScreen from '../screens/brand/BrandSubCategoriesScreen';
import BrandBranchesScreen from '../screens/brand/BrandBranchesScreen';
import BrandBranchEditScreen from '../screens/brand/BrandBranchEditScreen';
import BrandLinksScreen from '../screens/brand/BrandLinksScreen';
import BrandOwnOverviewScreen from '../screens/brand/BrandOwnOverviewScreen';
import BrandProductsScreen from '../screens/shared/BrandProductsScreen';
import ProductDetailScreen from '../screens/shared/ProductDetailScreen';
// Item 3b — S2/S3 platform detail. Contract: features/item3b-social-numbers
import SocialDetailScreen from '../screens/shared/SocialDetailScreen';

const Tab = createBottomTabNavigator();
const CreatorsStack = createNativeStackNavigator();
const ProfileStack = createNativeStackNavigator();
const noHeader = { headerShown: false };

function CreatorsStackScreen() {
  return (
    <CreatorsStack.Navigator screenOptions={noHeader}>
      <CreatorsStack.Screen name="BrandCreators" component={BrandCreatorsScreen} />
      <CreatorsStack.Screen name="BrandCreatorProfile" component={BrandCreatorProfileScreen} />
      <CreatorsStack.Screen name="BrandGroupDetail" component={BrandGroupDetailScreen} />
      <CreatorsStack.Screen name="BrandGroupAddCreators" component={BrandGroupAddCreatorsScreen} />
      <CreatorsStack.Screen name="SocialDetail" component={SocialDetailScreen} />
    </CreatorsStack.Navigator>
  );
}

function ProfileStackScreen() {
  return (
    <ProfileStack.Navigator screenOptions={noHeader}>
      <ProfileStack.Screen name="BrandProfile" component={BrandProfileScreen} />
      <ProfileStack.Screen name="BrandBusinessDetails" component={BrandBusinessDetailsScreen} />
      <ProfileStack.Screen name="BrandSubCategories" component={BrandSubCategoriesScreen} />
      <ProfileStack.Screen name="BrandBranches" component={BrandBranchesScreen} />
      <ProfileStack.Screen name="BrandBranchEdit" component={BrandBranchEditScreen} />
      <ProfileStack.Screen name="BrandLinks" component={BrandLinksScreen} />
      <ProfileStack.Screen name="BrandOwnOverview" component={BrandOwnOverviewScreen} />
      <ProfileStack.Screen name="BrandProducts" component={BrandProductsScreen} />
      <ProfileStack.Screen name="ProductDetail" component={ProductDetailScreen} />
      {/* Item 2 */}
      <ProfileStack.Screen name="BrandPitchSettings" component={BrandPitchSettingsScreen} />
      <ProfileStack.Screen name="BrandBlockedCreators" component={BrandBlockedCreatorsScreen} />
      {/* Legal — brands get the brand document set. */}
      <ProfileStack.Screen name="LegalList" component={LegalListScreen} initialParams={{ audience: 'brand' }} />
      <ProfileStack.Screen name="LegalDocument" component={LegalDocumentScreen} />
    </ProfileStack.Navigator>
  );
}

// Shared by both apps' tab bars (the creator app imports tabScreenOptions).
const ICONS = {
  HomeTab: 'home-outline', CampaignsTab: 'bullhorn-outline', CreatorsTab: 'account-multiple-outline',
  CollabsTab: 'handshake-outline', CreateTab: 'plus-box-outline', WalletTab: 'wallet-outline', ProfileTab: 'account-outline',
};

export const tabScreenOptions = ({ route }) => ({
  headerShown: false,
  tabBarActiveTintColor: T.ink,
  tabBarInactiveTintColor: T.ink3,
  tabBarStyle: { backgroundColor: T.bg, borderTopColor: T.border, borderTopWidth: 1, height: 62, paddingBottom: 8, paddingTop: 6 },
  tabBarLabelStyle: { fontFamily: fonts.sansSemiBold, fontSize: 11 },
  tabBarIcon: ({ color, size }) => <Icon name={ICONS[route.name] || 'circle-outline'} size={size} color={color} />,
});

export default function BrandNavigator() {
  return (
    <Tab.Navigator initialRouteName="CreatorsTab" screenOptions={tabScreenOptions}>
      <Tab.Screen name="HomeTab" component={ComingSoonScreen} initialParams={{ kind: 'brandHome', tabTitle: 'Home' }} options={{ title: 'Home' }} />
      <Tab.Screen name="CampaignsTab" component={ComingSoonScreen} initialParams={{ kind: 'brandCampaigns', tabTitle: 'Campaigns' }} options={{ title: 'Campaigns' }} />
      <Tab.Screen name="CreatorsTab" component={CreatorsStackScreen} options={{ title: 'Creators' }} />
      <Tab.Screen name="WalletTab" component={ComingSoonScreen} initialParams={{ kind: 'brandWallet', tabTitle: 'Wallet' }} options={{ title: 'Wallet' }} />
      <Tab.Screen name="ProfileTab" component={ProfileStackScreen} options={{ title: 'Profile' }} />
    </Tab.Navigator>
  );
}
