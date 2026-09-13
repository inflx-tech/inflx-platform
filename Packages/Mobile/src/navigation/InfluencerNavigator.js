import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import ProfileScreen from '../screens/influencer/ProfileScreen';
import LegalListScreen from '../screens/legal/LegalListScreen';
import LegalDocumentScreen from '../screens/legal/LegalDocumentScreen';
// Item 2 — invitation settings, blocked brands. Contract: features/item2-pitch-invitation-settings
import InvitationSettingsScreen from '../screens/influencer/InvitationSettingsScreen';
import BlockedBrandsScreen from '../screens/influencer/BlockedBrandsScreen';
import BrandOverviewScreen from '../screens/influencer/BrandOverviewScreen';
// Item 3 — the five-tab shell, Collabs, Find brands, the profile screens and Payment & tax.
// Contract: features/item3-discovery-profiles-groups
import ComingSoonScreen from '../components/shell/ComingSoonScreen';
import CollabsScreen from '../screens/influencer/CollabsScreen';
import FindBrandsScreen from '../screens/influencer/FindBrandsScreen';
import ProfileInfoScreen from '../screens/influencer/ProfileInfoScreen';
import NicheLanguagesScreen from '../screens/influencer/NicheLanguagesScreen';
import PaymentTaxScreen from '../screens/influencer/PaymentTaxScreen';
import BrandProductsScreen from '../screens/shared/BrandProductsScreen';
import ProductDetailScreen from '../screens/shared/ProductDetailScreen';
// Item 3b — Your numbers (R4/R5) and the platform detail (S2/S3 with the R4 banner).
// Contract: features/item3b-social-numbers
import YourNumbersScreen from '../screens/influencer/YourNumbersScreen';
import SocialDetailScreen from '../screens/shared/SocialDetailScreen';
// Item 5 — invitations. Contract: features/item5-invitations
import InvitationScreen from '../screens/influencer/InvitationScreen';
import CounterSoonScreen from '../screens/influencer/CounterSoonScreen';
import { tabScreenOptions } from './BrandNavigator';

const Tab = createBottomTabNavigator();
const CollabsStack = createNativeStackNavigator();
const ProfileStack = createNativeStackNavigator();
const noHeader = { headerShown: false };

function CollabsStackScreen() {
  return (
    <CollabsStack.Navigator screenOptions={noHeader}>
      <CollabsStack.Screen name="Collabs" component={CollabsScreen} />
      <CollabsStack.Screen name="FindBrands" component={FindBrandsScreen} />
      <CollabsStack.Screen name="BrandOverview" component={BrandOverviewScreen} />
      <CollabsStack.Screen name="BrandProducts" component={BrandProductsScreen} />
      <CollabsStack.Screen name="ProductDetail" component={ProductDetailScreen} />
      {/* Item 5 — the invitation and the item 6 placeholder behind Counter. Contract: features/item5-invitations */}
      <CollabsStack.Screen name="Invitation" component={InvitationScreen} />
      <CollabsStack.Screen name="CounterSoon" component={CounterSoonScreen} />
    </CollabsStack.Navigator>
  );
}

function ProfileStackScreen() {
  return (
    <ProfileStack.Navigator screenOptions={noHeader}>
      <ProfileStack.Screen name="ProfileMain" component={ProfileScreen} />
      <ProfileStack.Screen name="ProfileInfo" component={ProfileInfoScreen} />
      <ProfileStack.Screen name="NicheLanguages" component={NicheLanguagesScreen} />
      <ProfileStack.Screen name="PaymentTax" component={PaymentTaxScreen} />
      <ProfileStack.Screen name="YourNumbers" component={YourNumbersScreen} />
      <ProfileStack.Screen name="SocialDetail" component={SocialDetailScreen} />
      {/* Item 2 */}
      <ProfileStack.Screen name="InvitationSettings" component={InvitationSettingsScreen} />
      <ProfileStack.Screen name="BlockedBrands" component={BlockedBrandsScreen} />
      {/* Legal — creators get the creator document set. */}
      <ProfileStack.Screen name="LegalList" component={LegalListScreen} initialParams={{ audience: 'creator' }} />
      <ProfileStack.Screen name="LegalDocument" component={LegalDocumentScreen} />
    </ProfileStack.Navigator>
  );
}

export default function InfluencerNavigator() {
  return (
    <Tab.Navigator initialRouteName="CollabsTab" screenOptions={tabScreenOptions}>
      <Tab.Screen name="HomeTab" component={ComingSoonScreen} initialParams={{ kind: 'creatorHome', tabTitle: 'Home' }} options={{ title: 'Home' }} />
      <Tab.Screen name="CollabsTab" component={CollabsStackScreen} options={{ title: 'Collabs' }} />
      <Tab.Screen name="CreateTab" component={ComingSoonScreen} initialParams={{ kind: 'creatorCreate', tabTitle: 'Create' }} options={{ title: 'Create' }} />
      <Tab.Screen name="WalletTab" component={ComingSoonScreen} initialParams={{ kind: 'creatorWallet', tabTitle: 'Wallet' }} options={{ title: 'Wallet' }} />
      <Tab.Screen name="ProfileTab" component={ProfileStackScreen} options={{ title: 'Profile' }} />
    </Tab.Navigator>
  );
}
