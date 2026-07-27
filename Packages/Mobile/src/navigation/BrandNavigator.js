import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { ig } from '../theme/ig';

import BrandHomeScreen from '../screens/brand/BrandHomeScreen';
import BrandCampaignListScreen from '../screens/brand/BrandCampaignListScreen';
import BrandWalletScreen from '../screens/brand/BrandWalletScreen';
import BrandNotificationsScreen from '../screens/brand/BrandNotificationsScreen';
import BrandProfileScreen from '../screens/brand/BrandProfileScreen';
import BrandMediaGalleryScreen from '../screens/brand/BrandMediaGalleryScreen';
import BrandProposalInboxScreen from '../screens/brand/BrandProposalInboxScreen';
import BrandCampaignDetailScreen from '../screens/brand/BrandCampaignDetailScreen';
import BrandCampaignInfluencersListScreen from '../screens/brand/BrandCampaignInfluencersListScreen';
import BrandCampaignSetsListScreen from '../screens/brand/BrandCampaignSetsListScreen';
import BrandCampaignReviewQueueScreen from '../screens/brand/BrandCampaignReviewQueueScreen';
import BrandNegotiationScreen from '../screens/brand/BrandNegotiationScreen';
import BrandContractScreen from '../screens/brand/BrandContractScreen';
import BrandEnquiriesScreen from '../screens/brand/BrandEnquiriesScreen';
import BrandConversionsScreen from '../screens/brand/BrandConversionsScreen';
import BrandInfluencerBrowseScreen from '../screens/brand/BrandInfluencerBrowseScreen';
import BrandInfluencerProfileScreen from '../screens/brand/BrandInfluencerProfileScreen';
import BrandActionRequiredScreen from '../screens/brand/BrandActionRequiredScreen';
import BrandStorePreviewScreen from '../screens/brand/BrandStorePreviewScreen';
import ContractPdfScreen from '../screens/influencer/ContractPdfScreen';
// Parity pack (contract: features/brand-mobile-parity-pack)
import BrandOrdersScreen from '../screens/brand/BrandOrdersScreen';
import BrandBookingsScreen from '../screens/brand/BrandBookingsScreen';
import BrandMealsBoardScreen from '../screens/brand/BrandMealsBoardScreen';
import BrandOffersLibraryScreen from '../screens/brand/BrandOffersLibraryScreen';
import BrandSettingsHubScreen from '../screens/brand/BrandSettingsHubScreen';
import BrandInfluencerAnalyticsScreen from '../screens/brand/BrandInfluencerAnalyticsScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function HomeStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="BrandHome" component={BrandHomeScreen} />
      <Stack.Screen name="BrandActionRequired" component={BrandActionRequiredScreen} />
      <Stack.Screen name="CampaignDetail" component={BrandCampaignDetailScreen} />
      <Stack.Screen name="BrandCampaignInfluencersList" component={BrandCampaignInfluencersListScreen} />
      <Stack.Screen name="BrandCampaignSetsList" component={BrandCampaignSetsListScreen} />
      <Stack.Screen name="BrandCampaignReviewQueue" component={BrandCampaignReviewQueueScreen} />
      <Stack.Screen name="BrandNegotiation" component={BrandNegotiationScreen} />
      <Stack.Screen name="BrandContract" component={BrandContractScreen} />
      <Stack.Screen name="BrandEnquiries" component={BrandEnquiriesScreen} />
      <Stack.Screen name="BrandConversions" component={BrandConversionsScreen} />
      <Stack.Screen name="BrandInfluencerBrowse"  component={BrandInfluencerBrowseScreen} />
      <Stack.Screen name="BrandInfluencerProfile" component={BrandInfluencerProfileScreen} />
      <Stack.Screen name="BrandStorePreview"      component={BrandStorePreviewScreen} />
      <Stack.Screen name="ContractPdf"            component={ContractPdfScreen} />
      <Stack.Screen name="BrandOrders"            component={BrandOrdersScreen} />
      <Stack.Screen name="BrandBookings"          component={BrandBookingsScreen} />
      <Stack.Screen name="BrandMealsBoard"        component={BrandMealsBoardScreen} />
      <Stack.Screen name="BrandOffersLibrary"     component={BrandOffersLibraryScreen} />
      <Stack.Screen name="BrandInfluencerAnalytics" component={BrandInfluencerAnalyticsScreen} />
    </Stack.Navigator>
  );
}

function CampaignsStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="CampaignList" component={BrandCampaignListScreen} />
      <Stack.Screen name="CampaignDetail" component={BrandCampaignDetailScreen} />
      <Stack.Screen name="BrandCampaignInfluencersList" component={BrandCampaignInfluencersListScreen} />
      <Stack.Screen name="BrandCampaignSetsList" component={BrandCampaignSetsListScreen} />
      <Stack.Screen name="BrandCampaignReviewQueue" component={BrandCampaignReviewQueueScreen} />
      <Stack.Screen name="BrandNegotiation" component={BrandNegotiationScreen} />
      <Stack.Screen name="BrandContract" component={BrandContractScreen} />
      <Stack.Screen name="BrandConversions" component={BrandConversionsScreen} />
      <Stack.Screen name="BrandInfluencerProfile" component={BrandInfluencerProfileScreen} />
      <Stack.Screen name="ContractPdf" component={ContractPdfScreen} />
    </Stack.Navigator>
  );
}

function ProfileStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="BrandProfile" component={BrandProfileScreen} />
      <Stack.Screen name="Notifications" component={BrandNotificationsScreen} />
      <Stack.Screen name="MediaGallery" component={BrandMediaGalleryScreen} />
      <Stack.Screen name="ContractPdf" component={ContractPdfScreen} />
      <Stack.Screen name="ProposalInbox" component={BrandProposalInboxScreen} />
      <Stack.Screen name="BrandSettingsHub" component={BrandSettingsHubScreen} />
    </Stack.Navigator>
  );
}

// IG-clean tab bar (features/brand-mobile-shell) — real MCI vector icons that
// respond to active state, replacing static emoji <Text> that ignored it.
const tabIcon = (iconName, label) => ({
  tabBarLabel: label,
  tabBarIcon: ({ color, size }) => <Icon name={iconName} size={size ?? 24} color={color} />,
});

export default function BrandNavigator() {
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
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600', marginTop: 2 },
      }}
    >
      <Tab.Screen name="Home"      component={HomeStack}                options={tabIcon('home-outline', 'Home')} />
      <Tab.Screen name="Campaigns" component={CampaignsStack}           options={tabIcon('bullhorn-outline', 'Campaigns')} />
      <Tab.Screen name="Wallet"    component={BrandWalletScreen}        options={tabIcon('wallet-outline', 'Wallet')} />
      <Tab.Screen name="Alerts"    component={BrandNotificationsScreen} options={tabIcon('bell-outline', 'Alerts')} />
      <Tab.Screen name="Profile"   component={ProfileStack}             options={tabIcon('account-outline', 'Profile')} />
    </Tab.Navigator>
  );
}
