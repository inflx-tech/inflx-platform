import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { ig } from '../theme/ig';

import HomeScreen from '../screens/influencer/HomeScreen';
import CollabsListScreen from '../screens/influencer/CollabsListScreen';
import CollabDetailScreen from '../screens/influencer/CollabDetailScreen';
import CollabTrackingScreen from '../screens/influencer/CollabTrackingScreen';
import CreateScreen from '../screens/influencer/CreateScreen';
import EarningsScreen from '../screens/influencer/EarningsScreen';
import CommissionDetailScreen from '../screens/influencer/CommissionDetailScreen';
import ReferAndEarnScreen from '../screens/influencer/ReferAndEarnScreen';
import ProfileScreen from '../screens/influencer/ProfileScreen';
import NegotiationScreen from '../screens/influencer/NegotiationScreen';
import ContractScreen from '../screens/influencer/ContractScreen';
import ContractPdfScreen from '../screens/influencer/ContractPdfScreen';
import DeliverableScreen from '../screens/influencer/DeliverableScreen';
import DeliverableListScreen from '../screens/influencer/DeliverableListScreen';
// DeliverableDetail route resolves to the unified DeliverableScreen
// (features/deliverable-consolidation); the old DeliverableDetailScreen was
// deleted in features/cleanup-retired-screens.
import NotificationsScreen from '../screens/influencer/NotificationsScreen';
import BrandProfileScreen from '../screens/influencer/BrandProfileScreen';
import CampaignProductsScreen from '../screens/influencer/CampaignProductsScreen';
import TransactionFeedScreen from '../screens/influencer/TransactionFeedScreen';
import InfluencerContractsScreen from '../screens/influencer/InfluencerContractsScreen';
import ProposalsHubScreen from '../screens/influencer/ProposalsHubScreen';
import SendProposalScreen from '../screens/influencer/SendProposalScreen';
// collab-part2 — the pre-campaign handshake: incoming brand requests + preferences.
import CollabRequestDetailScreen from '../screens/influencer/CollabRequestDetailScreen';
import CollabPreferencesScreen from '../screens/influencer/CollabPreferencesScreen';
// Concept P0 (2026-07-23): ExperienceStudio / MyStore / StockStore DELETED.
// Concept P2: the Post Composer + My Posts replace the old studio.
import PostComposerScreen from '../screens/influencer/PostComposerScreen';
import MyStoreScreen from '../screens/influencer/MyStoreScreen';
import LegalListScreen from '../screens/legal/LegalListScreen';
import LegalDocumentScreen from '../screens/legal/LegalDocumentScreen';

const Tab = createBottomTabNavigator();
const HomeStack = createNativeStackNavigator();
const CollabsStack = createNativeStackNavigator();
const CreateStack = createNativeStackNavigator();
const EarningsStack = createNativeStackNavigator();
const ProfileStack = createNativeStackNavigator();

// Create tab (features/create-tab) — Posts promoted out of Home. CreateMain is
// the ledger + New Post CTA; PostComposer + My Posts live here.
function CreateStackNav() {
  return (
    <CreateStack.Navigator screenOptions={{ headerShown: false }}>
      <CreateStack.Screen name="CreateMain" component={CreateScreen} />
      <CreateStack.Screen name="PostComposer" component={PostComposerScreen} />
      {/* B4 — arrange their follower-facing store (sections/chips/concepts) */}
      <CreateStack.Screen name="MyStore" component={MyStoreScreen} />
    </CreateStack.Navigator>
  );
}

function ProfileStackNav() {
  return (
    <ProfileStack.Navigator screenOptions={{ headerShown: false }}>
      <ProfileStack.Screen name="ProfileMain" component={ProfileScreen} />
      <ProfileStack.Screen name="MyContracts" component={InfluencerContractsScreen} />
      <ProfileStack.Screen name="ContractPdf" component={ContractPdfScreen} />
      <ProfileStack.Screen name="ProposalsHub" component={ProposalsHubScreen} />
      <ProfileStack.Screen name="SendProposal" component={SendProposalScreen} />
      <ProfileStack.Screen name="CollabRequestDetail" component={CollabRequestDetailScreen} />
      <ProfileStack.Screen name="CollabPreferences" component={CollabPreferencesScreen} />
      {/* Legal — creators get the creator document set. */}
      <ProfileStack.Screen name="LegalList" component={LegalListScreen} initialParams={{ audience: 'creator' }} />
      <ProfileStack.Screen name="LegalDocument" component={LegalDocumentScreen} />
    </ProfileStack.Navigator>
  );
}

function HomeStackNav() {
  return (
    <HomeStack.Navigator screenOptions={{ headerShown: false }}>
      <HomeStack.Screen name="HomeMain" component={HomeScreen} />
      <HomeStack.Screen name="Notifications" component={NotificationsScreen} />
      <HomeStack.Screen name="Contract" component={ContractScreen} />
      <HomeStack.Screen name="ContractPdf" component={ContractPdfScreen} />
      <HomeStack.Screen name="Deliverable" component={DeliverableScreen} />
      <HomeStack.Screen name="DeliverableList" component={DeliverableListScreen} />
      <HomeStack.Screen name="DeliverableDetail" component={DeliverableScreen} />
      <HomeStack.Screen name="BrandProfile" component={BrandProfileScreen} />
      <HomeStack.Screen name="CampaignProducts" component={CampaignProductsScreen} />
      <HomeStack.Screen name="TransactionFeed" component={TransactionFeedScreen} />
      <HomeStack.Screen name="Negotiation" component={NegotiationScreen} />
    </HomeStack.Navigator>
  );
}

// ── Collabs stack (features/collabs-list + collab-detail). CollabsList → CollabDetail
// → the action sub-screens. The old Offers/Campaigns detail + list screens were retired
// in features/cleanup-retired-screens (all routes now resolve to the unified screens).
function CollabsStackNav() {
  return (
    <CollabsStack.Navigator screenOptions={{ headerShown: false }}>
      <CollabsStack.Screen name="CollabsList" component={CollabsListScreen} />
      <CollabsStack.Screen name="CollabDetail" component={CollabDetailScreen} />
      <CollabsStack.Screen name="CollabTracking" component={CollabTrackingScreen} />
      <CollabsStack.Screen name="Negotiation" component={NegotiationScreen} />
      <CollabsStack.Screen name="Contract" component={ContractScreen} />
      <CollabsStack.Screen name="ContractPdf" component={ContractPdfScreen} />
      <CollabsStack.Screen name="Deliverable" component={DeliverableScreen} />
      <CollabsStack.Screen name="DeliverableList" component={DeliverableListScreen} />
      <CollabsStack.Screen name="DeliverableDetail" component={DeliverableScreen} />
      <CollabsStack.Screen name="BrandProfile" component={BrandProfileScreen} />
      <CollabsStack.Screen name="CampaignProducts" component={CampaignProductsScreen} />
      <CollabsStack.Screen name="Notifications" component={NotificationsScreen} />
    </CollabsStack.Navigator>
  );
}

function EarningsStackNav() {
  return (
    <EarningsStack.Navigator screenOptions={{ headerShown: false }}>
      <EarningsStack.Screen name="EarningsMain" component={EarningsScreen} />
      <EarningsStack.Screen name="CommissionDetail" component={CommissionDetailScreen} />
      <EarningsStack.Screen name="ReferAndEarn" component={ReferAndEarnScreen} />
    </EarningsStack.Navigator>
  );
}

const tabIcon = (iconName) => ({ color, size }) => (
  <Icon name={iconName} size={size ?? 24} color={color} />
);

// IG-clean bottom bar: white surface, black active, grey inactive, hairline top.
export default function InfluencerNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: ig.text,
        tabBarInactiveTintColor: ig.mut2,
        tabBarStyle: {
          backgroundColor: ig.bg,
          borderTopColor: ig.line,
          borderTopWidth: 1,
          height: 72,
          paddingTop: 8,
          paddingBottom: 8,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
          marginTop: 2,
        },
        tabBarIconStyle: { marginBottom: 0 },
      }}
    >
      <Tab.Screen name="Home"     component={HomeStackNav}     options={{ tabBarLabel: 'Home',     tabBarIcon: tabIcon('home-outline') }} />
      <Tab.Screen name="Collabs"  component={CollabsStackNav}  options={{ tabBarLabel: 'Collabs',  tabBarIcon: tabIcon('briefcase-outline') }} />
      <Tab.Screen name="Create"   component={CreateStackNav}   options={{ tabBarLabel: 'Create',   tabBarIcon: tabIcon('plus-box-outline') }} />
      <Tab.Screen name="Earnings" component={EarningsStackNav} options={{ tabBarLabel: 'Earnings', tabBarIcon: tabIcon('currency-inr') }} />
      <Tab.Screen name="Profile"  component={ProfileStackNav}  options={{ tabBarLabel: 'Profile',  tabBarIcon: tabIcon('account-outline') }} />
    </Tab.Navigator>
  );
}
