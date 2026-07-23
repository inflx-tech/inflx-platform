import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { brandPalette as P, fonts } from '../theme/tokens';

import HomeScreen from '../screens/influencer/HomeScreen';
import OfferListScreen from '../screens/influencer/OfferListScreen';
import EarningsScreen from '../screens/influencer/EarningsScreen';
import CommissionDetailScreen from '../screens/influencer/CommissionDetailScreen';
import ReferAndEarnScreen from '../screens/influencer/ReferAndEarnScreen';
import ProfileScreen from '../screens/influencer/ProfileScreen';
import NegotiationScreen from '../screens/influencer/NegotiationScreen';
import ContractScreen from '../screens/influencer/ContractScreen';
import ContractPdfScreen from '../screens/influencer/ContractPdfScreen';
import DeliverableScreen from '../screens/influencer/DeliverableScreen';
import DeliverableListScreen from '../screens/influencer/DeliverableListScreen';
import DeliverableDetailScreen from '../screens/influencer/DeliverableDetailScreen';
import NotificationsScreen from '../screens/influencer/NotificationsScreen';
import MyCampaignsScreen from '../screens/influencer/MyCampaignsScreen';
import CampaignDetailScreen from '../screens/influencer/CampaignDetailScreen';
import CampaignCompletionScreen from '../screens/influencer/CampaignCompletionScreen';
import BrandProfileScreen from '../screens/influencer/BrandProfileScreen';
import CampaignProductsScreen from '../screens/influencer/CampaignProductsScreen';
import TransactionFeedScreen from '../screens/influencer/TransactionFeedScreen';
import InfluencerContractsScreen from '../screens/influencer/InfluencerContractsScreen';
import ProposalsHubScreen from '../screens/influencer/ProposalsHubScreen';
import SendProposalScreen from '../screens/influencer/SendProposalScreen';
// Concept P0 (2026-07-23): ExperienceStudio / MyStore / StockStore DELETED.
// Concept P2: the Post Composer + My Posts replace the old studio.
import PostComposerScreen from '../screens/influencer/PostComposerScreen';
import MyPostsScreen from '../screens/influencer/MyPostsScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();
const HomeStack = createNativeStackNavigator();
const CampaignsStack = createNativeStackNavigator();
const EarningsStack = createNativeStackNavigator();
const ProfileStack = createNativeStackNavigator();

function ProfileStackNav() {
  return (
    <ProfileStack.Navigator screenOptions={{ headerShown: false }}>
      <ProfileStack.Screen name="ProfileMain" component={ProfileScreen} />
      <ProfileStack.Screen name="MyContracts" component={InfluencerContractsScreen} />
      <ProfileStack.Screen name="ContractPdf" component={ContractPdfScreen} />
      <ProfileStack.Screen name="ProposalsHub" component={ProposalsHubScreen} />
      <ProfileStack.Screen name="SendProposal" component={SendProposalScreen} />
    </ProfileStack.Navigator>
  );
}

function HomeStackNav() {
  return (
    <HomeStack.Navigator screenOptions={{ headerShown: false }}>
      <HomeStack.Screen name="HomeMain" component={HomeScreen} />
      <HomeStack.Screen name="PostComposer" component={PostComposerScreen} />
      <HomeStack.Screen name="MyPosts" component={MyPostsScreen} />
      <HomeStack.Screen name="Notifications" component={NotificationsScreen} />
      <HomeStack.Screen name="CampaignDetail" component={CampaignDetailScreen} />
      <HomeStack.Screen name="CampaignCompletion" component={CampaignCompletionScreen} />
      <HomeStack.Screen name="Contract" component={ContractScreen} />
      <HomeStack.Screen name="ContractPdf" component={ContractPdfScreen} />
      <HomeStack.Screen name="Deliverable" component={DeliverableScreen} />
      <HomeStack.Screen name="DeliverableList" component={DeliverableListScreen} />
      <HomeStack.Screen name="DeliverableDetail" component={DeliverableDetailScreen} />
      <HomeStack.Screen name="BrandProfile" component={BrandProfileScreen} />
      <HomeStack.Screen name="CampaignProducts" component={CampaignProductsScreen} />
      <HomeStack.Screen name="TransactionFeed" component={TransactionFeedScreen} />
      <HomeStack.Screen name="Negotiation" component={NegotiationScreen} />
    </HomeStack.Navigator>
  );
}

function OffersStack() {
  const OfferDetailScreen = require('../screens/influencer/OfferDetailScreen').default;
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="OfferList" component={OfferListScreen} />
      <Stack.Screen name="OfferDetail" component={OfferDetailScreen} />
      <Stack.Screen name="Negotiation" component={NegotiationScreen} />
      <Stack.Screen name="Contract" component={ContractScreen} />
      <Stack.Screen name="ContractPdf" component={ContractPdfScreen} />
      <Stack.Screen name="Deliverable" component={DeliverableScreen} />
      <Stack.Screen name="DeliverableList" component={DeliverableListScreen} />
      <Stack.Screen name="DeliverableDetail" component={DeliverableDetailScreen} />
      <Stack.Screen name="CampaignDetail" component={CampaignDetailScreen} />
      <Stack.Screen name="CampaignCompletion" component={CampaignCompletionScreen} />
      <Stack.Screen name="BrandProfile" component={BrandProfileScreen} />
    </Stack.Navigator>
  );
}

function CampaignsStackNav() {
  return (
    <CampaignsStack.Navigator screenOptions={{ headerShown: false }}>
      <CampaignsStack.Screen name="MyCampaignsList" component={MyCampaignsScreen} />
      <CampaignsStack.Screen name="CampaignDetail" component={CampaignDetailScreen} />
      <CampaignsStack.Screen name="CampaignCompletion" component={CampaignCompletionScreen} />
      <CampaignsStack.Screen name="Contract" component={ContractScreen} />
      <CampaignsStack.Screen name="ContractPdf" component={ContractPdfScreen} />
      <CampaignsStack.Screen name="Deliverable" component={DeliverableScreen} />
      <CampaignsStack.Screen name="DeliverableList" component={DeliverableListScreen} />
      <CampaignsStack.Screen name="DeliverableDetail" component={DeliverableDetailScreen} />
      <CampaignsStack.Screen name="BrandProfile" component={BrandProfileScreen} />
      <CampaignsStack.Screen name="Negotiation" component={NegotiationScreen} />
    </CampaignsStack.Navigator>
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

// Flow 28: real MaterialCommunityIcons via react-native-vector-icons.
// Native rebuild required (NATIVE_RUNTIME bumped 1→2 to enforce APK ↔ OTA pairing).
const tabIcon = (iconName) => ({ color, size }) => (
  <Icon name={iconName} size={size ?? 24} color={color} />
);

export default function InfluencerNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: P.yellow,
        tabBarInactiveTintColor: 'rgba(255,255,255,0.5)',
        tabBarStyle: {
          backgroundColor: P.ink,
          borderTopColor: 'rgba(255,255,255,0.08)',
          borderTopWidth: 1,
          height: 72,
          paddingTop: 8,
          paddingBottom: 8,
        },
        tabBarLabelStyle: {
          fontFamily: fonts.monoBold,
          fontSize: 9,
          fontWeight: '700',
          textTransform: 'uppercase',
          letterSpacing: 0.5,
          marginTop: 2,
        },
        tabBarIconStyle: { marginBottom: 0 },
      }}
    >
      <Tab.Screen name="Home"      component={HomeStackNav}      options={{ tabBarLabel: 'Home',      tabBarIcon: tabIcon('home-outline') }} />
      <Tab.Screen name="Offers"    component={OffersStack}        options={{ tabBarLabel: 'Offers',    tabBarIcon: tabIcon('email-outline') }} />
      <Tab.Screen name="Campaigns" component={CampaignsStackNav}   options={{ tabBarLabel: 'Campaigns', tabBarIcon: tabIcon('briefcase-outline') }} />
      <Tab.Screen name="Earnings"  component={EarningsStackNav}    options={{ tabBarLabel: 'Earnings',  tabBarIcon: tabIcon('currency-inr') }} />
      <Tab.Screen name="Profile"   component={ProfileStackNav}     options={{ tabBarLabel: 'Profile',   tabBarIcon: tabIcon('account-outline') }} />
    </Tab.Navigator>
  );
}
