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
// Item 4 — the Campaigns tab. Contract: features/item4-campaigns-sets
import BrandCampaignsScreen from '../screens/brand/BrandCampaignsScreen';
import BrandCampaignNewScreen from '../screens/brand/BrandCampaignNewScreen';
import BrandSetEditScreen from '../screens/brand/BrandSetEditScreen';
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

// The pitch thread and counter are one screen each, serving both sides. The
// brand's side is the same component with `side` fixed — not a second copy.
const BrandPitchThreadScreen = (props) => <PitchThreadScreen {...props} side="brand" />;
const BrandPitchCounterScreen = (props) => <PitchCounterScreen {...props} route={{ ...props.route, params: { ...(props.route && props.route.params), side: 'brand' } }} />;

const Tab = createBottomTabNavigator();
const CreatorsStack = createNativeStackNavigator();
const ProfileStack = createNativeStackNavigator();
const CampaignsStack = createNativeStackNavigator();
const noHeader = { headerShown: false };

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
      <Tab.Screen name="CampaignsTab" component={CampaignsStackScreen} options={{ title: 'Campaigns' }} />
      <Tab.Screen name="CreatorsTab" component={CreatorsStackScreen} options={{ title: 'Creators' }} />
      <Tab.Screen name="WalletTab" component={ComingSoonScreen} initialParams={{ kind: 'brandWallet', tabTitle: 'Wallet' }} options={{ title: 'Wallet' }} />
      <Tab.Screen name="ProfileTab" component={ProfileStackScreen} options={{ title: 'Profile' }} />
    </Tab.Navigator>
  );
}
