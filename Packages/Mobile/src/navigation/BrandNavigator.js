import React from 'react';
import { View } from 'react-native';
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
// features/registration-and-profile — a pending brand is inside the app now: the Home tab is
// the pending home until approval (then the ComingSoon placeholder as before), and the sheet
// host shows the server's ACCOUNT_PENDING words on any gated action.
import PendingHomeScreen from '../components/shell/PendingHomeScreen';
import PendingSheetHost from '../components/shell/PendingSheetHost';
// The tab lock: Campaigns and Creators are locked until approval (the press raises the sheet),
// and a pending brand opens on Home, never on a locked tab's content.
import { lockedTabListeners, initialTabFor } from './lockedTab';
import { getAccountStatus } from '../services/accountStatus';
import BrandCreatorsScreen from '../screens/brand/BrandCreatorsScreen';
import BrandGroupDetailScreen from '../screens/brand/BrandGroupDetailScreen';
import BrandGroupAddCreatorsScreen from '../screens/brand/BrandGroupAddCreatorsScreen';
import BrandBusinessDetailsScreen from '../screens/brand/BrandBusinessDetailsScreen';
import ChangeNumberScreen from '../screens/shared/ChangeNumberScreen';
import BrandSubCategoriesScreen from '../screens/brand/BrandSubCategoriesScreen';
import BrandBranchesScreen from '../screens/brand/BrandBranchesScreen';
import BrandBranchEditScreen from '../screens/brand/BrandBranchEditScreen';
import BrandLinksScreen from '../screens/brand/BrandLinksScreen';
import BrandOwnOverviewScreen from '../screens/brand/BrandOwnOverviewScreen';
import BrandProductsScreen from '../screens/shared/BrandProductsScreen';
import ProductDetailScreen from '../screens/shared/ProductDetailScreen';
// Item 3b — S2/S3 platform detail. Contract: features/item3b-social-numbers
import SocialDetailScreen from '../screens/shared/SocialDetailScreen';
// Item 4 — the Campaigns tab. Contract: features/item4-campaigns-sets
import BrandCampaignsScreen from '../screens/brand/BrandCampaignsScreen';
import BrandCampaignNewScreen from '../screens/brand/BrandCampaignNewScreen';
import BrandSetEditScreen from '../screens/brand/BrandSetEditScreen';
// features/brand-wallet-on-the-phone — the money a brand needs before she can sign.
import BrandWalletScreen from '../screens/brand/BrandWalletScreen';
import BrandAddMoneyScreen from '../screens/brand/BrandAddMoneyScreen';
import BrandPayoutDetailScreen from '../screens/brand/BrandPayoutDetailScreen';
import BrandCampaignDetailScreen from '../screens/brand/BrandCampaignDetailScreen';
import BrandSetDetailScreen from '../screens/brand/BrandSetDetailScreen';
// Item 5 — the set's creator picker, the group check, terms per creator, review and send.
import BrandSetPickCreatorsScreen from '../screens/brand/BrandSetPickCreatorsScreen';
import BrandGroupInviteCheckScreen from '../screens/brand/BrandGroupInviteCheckScreen';
import BrandCreatorTermsScreen from '../screens/brand/BrandCreatorTermsScreen';
import BrandReviewSendScreen from '../screens/brand/BrandReviewSendScreen';
// Item 6 — the negotiation thread and the pool. Contract: features/item6-negotiation
import BrandThreadScreen from '../screens/brand/BrandThreadScreen';
import BrandPoolScreen from '../screens/brand/BrandPoolScreen';
// Item 7 — the agreement and the two signatures. Contract: features/item7-agreement
import BrandAgreementScreen from '../screens/brand/BrandAgreementScreen';
// Item 8 — the pitches a brand receives, and the thread one can become.
// Contract: features/item8-pitch
import BrandPitchesScreen from '../screens/brand/BrandPitchesScreen';
import BrandPitchScreen from '../screens/brand/BrandPitchScreen';
import PitchThreadScreen from '../screens/shared/PitchThreadScreen';
import PitchCounterScreen from '../screens/shared/PitchCounterScreen';
// Item 10 — the store visit: the plan, the time thread, the visit itself.
// Contract: features/item10-store-visit
import BrandShootScreen from '../screens/brand/BrandShootScreen';
import BrandShootPlanScreen from '../screens/brand/BrandShootPlanScreen';
// Item 11 — the Remote shoot: the products, the parcel, the return.
import BrandRemoteScreen from '../screens/brand/BrandRemoteScreen';
import BrandRemoteProductsScreen from '../screens/brand/BrandRemoteProductsScreen';
import BrandRemoteBookScreen from '../screens/brand/BrandRemoteBookScreen';
import ShootThreadScreen from '../screens/shared/ShootThreadScreen';
import ShootCounterScreen from '../screens/shared/ShootCounterScreen';

// The pitch thread and counter are one screen each, serving both sides. The
// brand's side is the same component with `side` fixed — not a second copy.
const BrandPitchThreadScreen = (props) => <PitchThreadScreen {...props} side="brand" />;
const BrandPitchCounterScreen = (props) => <PitchCounterScreen {...props} route={{ ...props.route, params: { ...(props.route && props.route.params), side: 'brand' } }} />;
// Item 10 — the same rule for the shoot's time thread and counter.
const BrandShootThreadScreen = (props) => <ShootThreadScreen {...props} side="brand" />;
const BrandShootCounterScreen = (props) => <ShootCounterScreen {...props} route={{ ...props.route, params: { ...(props.route && props.route.params), side: 'brand' } }} />;

const Tab = createBottomTabNavigator();
const CreatorsStack = createNativeStackNavigator();
const ProfileStack = createNativeStackNavigator();
const CampaignsStack = createNativeStackNavigator();
// features/brand-wallet-on-the-phone — the Wallet tab is a stack now, so Add money pushes over it.
const WalletStack = createNativeStackNavigator();
const noHeader = { headerShown: false };

function WalletStackScreen() {
  return (
    <WalletStack.Navigator screenOptions={{ headerShown: false }}>
      <WalletStack.Screen name="BrandWallet" component={BrandWalletScreen} />
      <WalletStack.Screen name="BrandAddMoney" component={BrandAddMoneyScreen} />
      {/* features/registration-and-profile B8 — GST number and bank account live on the Wallet tab. */}
      <WalletStack.Screen name="BrandPayoutDetail" component={BrandPayoutDetailScreen} />
    </WalletStack.Navigator>
  );
}

function CampaignsStackScreen() {
  return (
    <CampaignsStack.Navigator screenOptions={noHeader}>
      <CampaignsStack.Screen name="BrandCampaigns" component={BrandCampaignsScreen} />
      <CampaignsStack.Screen name="BrandCampaignNew" component={BrandCampaignNewScreen} />
      <CampaignsStack.Screen name="BrandSetEdit" component={BrandSetEditScreen} />
      <CampaignsStack.Screen name="BrandCampaignDetail" component={BrandCampaignDetailScreen} />
      <CampaignsStack.Screen name="BrandSetDetail" component={BrandSetDetailScreen} />
      {/* Item 5 — choosing creators, terms and invitations. Contract: features/item5-invitations */}
      <CampaignsStack.Screen name="BrandSetPickCreators" component={BrandSetPickCreatorsScreen} />
      <CampaignsStack.Screen name="BrandGroupInviteCheck" component={BrandGroupInviteCheckScreen} />
      <CampaignsStack.Screen name="BrandCreatorTerms" component={BrandCreatorTermsScreen} />
      <CampaignsStack.Screen name="BrandReviewSend" component={BrandReviewSendScreen} />
      {/* Item 6 — the conversation and the pool. Contract: features/item6-negotiation */}
      <CampaignsStack.Screen name="BrandThread" component={BrandThreadScreen} />
      <CampaignsStack.Screen name="BrandPool" component={BrandPoolScreen} />
      <CampaignsStack.Screen name="BrandAgreement" component={BrandAgreementScreen} />
      <CampaignsStack.Screen name="BrandAddMoney" component={BrandAddMoneyScreen} />
      {/* Item 10 — the store visit. Contract: features/item10-store-visit */}
      <CampaignsStack.Screen name="BrandShoot" component={BrandShootScreen} />
      <CampaignsStack.Screen name="BrandShootPlan" component={BrandShootPlanScreen} />
      <CampaignsStack.Screen name="BrandShootThread" component={BrandShootThreadScreen} />
      <CampaignsStack.Screen name="BrandShootCounter" component={BrandShootCounterScreen} />
      {/* Item 11 — the Remote shoot. Contract: features/item11-remote */}
      <CampaignsStack.Screen name="BrandRemote" component={BrandRemoteScreen} />
      <CampaignsStack.Screen name="BrandRemoteProducts" component={BrandRemoteProductsScreen} />
      <CampaignsStack.Screen name="BrandRemoteBook" component={BrandRemoteBookScreen} />
    </CampaignsStack.Navigator>
  );
}

function CreatorsStackScreen() {
  return (
    <CreatorsStack.Navigator screenOptions={noHeader}>
      <CreatorsStack.Screen name="BrandCreators" component={BrandCreatorsScreen} />
      <CreatorsStack.Screen name="BrandCreatorProfile" component={BrandCreatorProfileScreen} />
      <CreatorsStack.Screen name="BrandGroupDetail" component={BrandGroupDetailScreen} />
      <CreatorsStack.Screen name="BrandGroupAddCreators" component={BrandGroupAddCreatorsScreen} />
      <CreatorsStack.Screen name="SocialDetail" component={SocialDetailScreen} />
      {/* Item 8 — the pitches, on the Creators tab beside Discover and Groups. */}
      <CreatorsStack.Screen name="BrandPitches" component={BrandPitchesScreen} />
      <CreatorsStack.Screen name="BrandPitch" component={BrandPitchScreen} />
      <CreatorsStack.Screen name="BrandPitchThread" component={BrandPitchThreadScreen} />
      <CreatorsStack.Screen name="PitchCounter" component={BrandPitchCounterScreen} />
    </CreatorsStack.Navigator>
  );
}

function ProfileStackScreen() {
  return (
    <ProfileStack.Navigator screenOptions={noHeader}>
      <ProfileStack.Screen name="BrandProfile" component={BrandProfileScreen} />
      <ProfileStack.Screen name="BrandBusinessDetails" component={BrandBusinessDetailsScreen} />
      <ProfileStack.Screen name="ChangeNumber" component={ChangeNumberScreen} initialParams={{ role: 'brand', returnTo: 'BrandBusinessDetails' }} />
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
  // Read once, at mount: initialRouteName only matters the first time the navigator renders.
  // The lock itself reads the live status on every press (lockedTab.js).
  const initialRouteName = initialTabFor(getAccountStatus(), 'CreatorsTab');
  return (
    <View style={{ flex: 1 }}>
      <Tab.Navigator initialRouteName={initialRouteName} screenOptions={tabScreenOptions}>
        <Tab.Screen name="HomeTab" component={PendingHomeScreen} initialParams={{ kind: 'brandHome', tabTitle: 'Home' }} options={{ title: 'Home' }} />
        <Tab.Screen name="CampaignsTab" component={CampaignsStackScreen} options={{ title: 'Campaigns' }} listeners={lockedTabListeners()} />
        <Tab.Screen name="CreatorsTab" component={CreatorsStackScreen} options={{ title: 'Creators' }} listeners={lockedTabListeners()} />
        <Tab.Screen name="WalletTab" component={WalletStackScreen} options={{ title: 'Wallet' }} />
        <Tab.Screen name="ProfileTab" component={ProfileStackScreen} options={{ title: 'Profile' }} />
      </Tab.Navigator>
      <PendingSheetHost />
    </View>
  );
}
