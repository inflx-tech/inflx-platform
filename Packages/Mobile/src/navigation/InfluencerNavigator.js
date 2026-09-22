import React from 'react';
import { View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import ProfileScreen from '../screens/influencer/ProfileScreen';
import LegalListScreen from '../screens/legal/LegalListScreen';
import LegalDocumentScreen from '../screens/legal/LegalDocumentScreen';
// Item 2 — invitation settings, blocked brands. Contract: features/item2-pitch-invitation-settings
import InvitationSettingsScreen from '../screens/influencer/InvitationSettingsScreen';
import BlockedBrandsScreen from '../screens/influencer/BlockedBrandsScreen';
import BrandOverviewScreen from '../screens/influencer/BrandOverviewScreen';
// Item 3 — the five-tab shell, Collabs, Find brands and the profile screens.
// Contract: features/item3-discovery-profiles-groups
import ComingSoonScreen from '../components/shell/ComingSoonScreen';
// features/registration-and-profile — a pending creator is inside the app now: the Home tab is
// the pending home until approval, the sheet host shows ACCOUNT_PENDING on any gated action,
// and Payment & tax left the profile for the Wallet tab (UPI / bank / PAN).
import PendingHomeScreen from '../components/shell/PendingHomeScreen';
import PendingSheetHost from '../components/shell/PendingSheetHost';
// The tab lock: Collabs and Create are locked until approval (the press raises the sheet), and
// a pending creator opens on Home, never on a locked tab's content.
import { lockedTabListeners, initialTabFor } from './lockedTab';
import { getAccountStatus } from '../services/accountStatus';
// features/creator-wallet-and-first-payment — a stand-in wallet, so money that already exists is visible.
import CreatorWalletScreen from '../screens/influencer/CreatorWalletScreen';
import PayoutDetailScreen from '../screens/influencer/PayoutDetailScreen';
import CollabsScreen from '../screens/influencer/CollabsScreen';
import FindBrandsScreen from '../screens/influencer/FindBrandsScreen';
import ProfileInfoScreen from '../screens/influencer/ProfileInfoScreen';
import ChangeNumberScreen from '../screens/shared/ChangeNumberScreen';
import NicheLanguagesScreen from '../screens/influencer/NicheLanguagesScreen';
import BrandProductsScreen from '../screens/shared/BrandProductsScreen';
import ProductDetailScreen from '../screens/shared/ProductDetailScreen';
// Item 3b — Your numbers (R4/R5) and the platform detail (S2/S3 with the R4 banner).
// Contract: features/item3b-social-numbers
import YourNumbersScreen from '../screens/influencer/YourNumbersScreen';
import SocialDetailScreen from '../screens/shared/SocialDetailScreen';
// Item 5 — invitations. Contract: features/item5-invitations
import InvitationScreen from '../screens/influencer/InvitationScreen';
// Item 6 — countering, the request to move, and the thread. Contract: features/item6-negotiation
import CounterScreen from '../screens/influencer/CounterScreen';
import MoveRequestScreen from '../screens/influencer/MoveRequestScreen';
import ThreadScreen from '../screens/influencer/ThreadScreen';
// Item 7 — reading and signing the agreement. Contract: features/item7-agreement
import AgreementScreen from '../screens/influencer/AgreementScreen';
// Item 8 — her pitch: the form, her list, one pitch, and the thread it can become.
// Contract: features/item8-pitch
import PitchFormScreen from '../screens/influencer/PitchFormScreen';
import MyPitchesScreen from '../screens/influencer/MyPitchesScreen';
import MyPitchScreen from '../screens/influencer/MyPitchScreen';
import PitchThreadScreen from '../screens/shared/PitchThreadScreen';
import PitchCounterScreen from '../screens/shared/PitchCounterScreen';
// Item 10 — her store visit, and the time thread on item 6's engine.
// Contract: features/item10-store-visit
import ShootScreen from '../screens/influencer/ShootScreen';
// Item 11 — the Remote shoot: her address, the parcel, the check, the return.
import RemoteShootScreen from '../screens/influencer/RemoteShootScreen';
import RemoteAddressScreen from '../screens/influencer/RemoteAddressScreen';
import ShootThreadScreen from '../screens/shared/ShootThreadScreen';
import ShootCounterScreen from '../screens/shared/ShootCounterScreen';
import { tabScreenOptions } from './BrandNavigator';

const Tab = createBottomTabNavigator();
const CollabsStack = createNativeStackNavigator();
const ProfileStack = createNativeStackNavigator();
const WalletStack = createNativeStackNavigator();
const noHeader = { headerShown: false };

// features/registration-and-profile C7 — the Wallet tab is a stack now, so a payout detail
// (UPI, bank account, PAN) pushes over it.
function WalletStackScreen() {
  return (
    <WalletStack.Navigator screenOptions={noHeader}>
      <WalletStack.Screen name="CreatorWallet" component={CreatorWalletScreen} />
      <WalletStack.Screen name="PayoutDetail" component={PayoutDetailScreen} />
    </WalletStack.Navigator>
  );
}

function CollabsStackScreen() {
  return (
    <CollabsStack.Navigator screenOptions={noHeader}>
      <CollabsStack.Screen name="Collabs" component={CollabsScreen} />
      <CollabsStack.Screen name="FindBrands" component={FindBrandsScreen} />
      <CollabsStack.Screen name="BrandOverview" component={BrandOverviewScreen} />
      <CollabsStack.Screen name="BrandProducts" component={BrandProductsScreen} />
      <CollabsStack.Screen name="ProductDetail" component={ProductDetailScreen} />
      {/* Item 5 — the invitation. Contract: features/item5-invitations */}
      <CollabsStack.Screen name="Invitation" component={InvitationScreen} />
      {/* Item 6 — the counter, the move request and the thread. Contract: features/item6-negotiation */}
      <CollabsStack.Screen name="Counter" component={CounterScreen} />
      <CollabsStack.Screen name="MoveRequest" component={MoveRequestScreen} />
      <CollabsStack.Screen name="Thread" component={ThreadScreen} />
      <CollabsStack.Screen name="Agreement" component={AgreementScreen} />
      {/* Item 8 — the pitch. The thread is item 6’s screen on a pitch anchor. */}
      <CollabsStack.Screen name="PitchForm" component={PitchFormScreen} />
      <CollabsStack.Screen name="MyPitches" component={MyPitchesScreen} />
      <CollabsStack.Screen name="MyPitch" component={MyPitchScreen} />
      <CollabsStack.Screen name="PitchThread" component={PitchThreadScreen} />
      <CollabsStack.Screen name="PitchCounter" component={PitchCounterScreen} />
      {/* Item 10 — the store visit. Contract: features/item10-store-visit */}
      <CollabsStack.Screen name="Shoot" component={ShootScreen} />
      <CollabsStack.Screen name="ShootThread" component={ShootThreadScreen} />
      <CollabsStack.Screen name="ShootCounter" component={ShootCounterScreen} />
      {/* Item 11 — the Remote shoot. Contract: features/item11-remote */}
      <CollabsStack.Screen name="MyRemote" component={RemoteShootScreen} />
      <CollabsStack.Screen name="RemoteAddress" component={RemoteAddressScreen} />
    </CollabsStack.Navigator>
  );
}

function ProfileStackScreen() {
  return (
    <ProfileStack.Navigator screenOptions={noHeader}>
      <ProfileStack.Screen name="ProfileMain" component={ProfileScreen} />
      <ProfileStack.Screen name="ProfileInfo" component={ProfileInfoScreen} />
      <ProfileStack.Screen name="ChangeNumber" component={ChangeNumberScreen} initialParams={{ role: 'influencer', returnTo: 'ProfileInfo' }} />
      <ProfileStack.Screen name="NicheLanguages" component={NicheLanguagesScreen} />
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
  // Read once, at mount: initialRouteName only matters the first time the navigator renders.
  // The lock itself reads the live status on every press (lockedTab.js).
  const initialRouteName = initialTabFor(getAccountStatus(), 'CollabsTab');
  return (
    <View style={{ flex: 1 }}>
      <Tab.Navigator initialRouteName={initialRouteName} screenOptions={tabScreenOptions}>
        <Tab.Screen name="HomeTab" component={PendingHomeScreen} initialParams={{ kind: 'creatorHome', tabTitle: 'Home' }} options={{ title: 'Home' }} />
        <Tab.Screen name="CollabsTab" component={CollabsStackScreen} options={{ title: 'Collabs' }} listeners={lockedTabListeners()} />
        <Tab.Screen name="CreateTab" component={ComingSoonScreen} initialParams={{ kind: 'creatorCreate', tabTitle: 'Create' }} options={{ title: 'Create' }} listeners={lockedTabListeners()} />
        <Tab.Screen name="WalletTab" component={WalletStackScreen} options={{ title: 'Wallet' }} />
        <Tab.Screen name="ProfileTab" component={ProfileStackScreen} options={{ title: 'Profile' }} />
      </Tab.Navigator>
      <PendingSheetHost />
    </View>
  );
}
