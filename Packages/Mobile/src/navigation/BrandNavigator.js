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
// collab-part2 — the pre-campaign handshake, brand side.
import BrandRequestComposerScreen from '../screens/brand/BrandRequestComposerScreen';
import BrandCollabRequestsScreen from '../screens/brand/BrandCollabRequestsScreen';
import BrandActionRequiredScreen from '../screens/brand/BrandActionRequiredScreen';
import BrandStorePreviewScreen from '../screens/brand/BrandStorePreviewScreen';
// Stage 1 — everything that happens before a campaign exists.
import BrandCreatorsScreen from '../screens/brand/BrandCreatorsScreen';
import BrandFindCreatorsScreen from '../screens/brand/BrandFindCreatorsScreen';
import BrandGroupsScreen from '../screens/brand/BrandGroupsScreen';
import BrandGroupDetailScreen from '../screens/brand/BrandGroupDetailScreen';
import BrandPlacePickerScreen from '../screens/brand/BrandPlacePickerScreen';
import BrandAskManyScreen from '../screens/brand/BrandAskManyScreen';
import BrandDiaryScreen from '../screens/brand/BrandDiaryScreen';
import ContractPdfScreen from '../screens/influencer/ContractPdfScreen';
// Parity pack (contract: features/brand-mobile-parity-pack)
import BrandOrdersScreen from '../screens/brand/BrandOrdersScreen';
import BrandBookingsScreen from '../screens/brand/BrandBookingsScreen';
import BrandOffersLibraryScreen from '../screens/brand/BrandOffersLibraryScreen';
import BrandSettingsHubScreen from '../screens/brand/BrandSettingsHubScreen';
import BrandInfluencerAnalyticsScreen from '../screens/brand/BrandInfluencerAnalyticsScreen';
import LegalListScreen from '../screens/legal/LegalListScreen';
import LegalDocumentScreen from '../screens/legal/LegalDocumentScreen';

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
      {/* collab-part2 — the pre-campaign handshake, brand side. */}
      <Stack.Screen name="BrandRequestComposer" component={BrandRequestComposerScreen} />
      <Stack.Screen name="BrandCollabRequests" component={BrandCollabRequestsScreen} />
      <Stack.Screen name="BrandStorePreview"      component={BrandStorePreviewScreen} />
      <Stack.Screen name="ContractPdf"            component={ContractPdfScreen} />
      <Stack.Screen name="BrandOrders"            component={BrandOrdersScreen} />
      <Stack.Screen name="BrandBookings"          component={BrandBookingsScreen} />
      <Stack.Screen name="BrandOffersLibrary"     component={BrandOffersLibraryScreen} />
      <Stack.Screen name="BrandInfluencerAnalytics" component={BrandInfluencerAnalyticsScreen} />
    </Stack.Navigator>
  );
}

/**
 * Stage 1 — the Creators tab. Everything before a campaign exists: searching, saved
 * groups, asking one or many, and every conversation in both directions.
 *
 * Route names here are deliberately distinct from the copies inside HomeStack. The
 * same name in DIFFERENT stacks is fine and is already the pattern in this app
 * (CampaignDetail lives in two, ContractPdf in three). What crashes on a device — and
 * passes every bundle check first — is two screens sharing a name INSIDE one stack.
 */
function CreatorsStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="CreatorsHome" component={BrandCreatorsScreen} />
      {/* Stage 1 — the rebuilt search: three filters, each over a picker. The old
          browse screen stays reachable from Home. */}
      <Stack.Screen name="BrandFindCreators" component={BrandFindCreatorsScreen} />
      <Stack.Screen name="BrandInfluencerBrowse" component={BrandInfluencerBrowseScreen} />
      <Stack.Screen name="BrandInfluencerProfile" component={BrandInfluencerProfileScreen} />
      <Stack.Screen name="BrandRequestComposer" component={BrandRequestComposerScreen} />
      <Stack.Screen name="BrandCollabRequests" component={BrandCollabRequestsScreen} />
      <Stack.Screen name="ProposalInbox" component={BrandProposalInboxScreen} />
      <Stack.Screen name="BrandGroups" component={BrandGroupsScreen} />
      <Stack.Screen name="BrandGroupDetail" component={BrandGroupDetailScreen} />
      <Stack.Screen name="BrandPlacePicker" component={BrandPlacePickerScreen} />
      <Stack.Screen name="BrandAskMany" component={BrandAskManyScreen} />
      <Stack.Screen name="BrandDiary" component={BrandDiaryScreen} />
      <Stack.Screen name="BrandNegotiation" component={BrandNegotiationScreen} />
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
      {/* Stage 1 — Alerts lives here now. Same screen, same route name it always had. */}
      <Stack.Screen name="Notifications" component={BrandNotificationsScreen} />
      <Stack.Screen name="MediaGallery" component={BrandMediaGalleryScreen} />
      <Stack.Screen name="ContractPdf" component={ContractPdfScreen} />
      <Stack.Screen name="ProposalInbox" component={BrandProposalInboxScreen} />
      <Stack.Screen name="BrandSettingsHub" component={BrandSettingsHubScreen} />
      {/* Legal — brands get the brand document set. */}
      <Stack.Screen name="LegalList" component={LegalListScreen} initialParams={{ audience: 'brand' }} />
      <Stack.Screen name="LegalDocument" component={LegalDocumentScreen} />
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
      <Tab.Screen name="Creators"  component={CreatorsStack}            options={tabIcon('account-multiple-outline', 'Creators')} />
      <Tab.Screen name="Campaigns" component={CampaignsStack}           options={tabIcon('bullhorn-outline', 'Campaigns')} />
      <Tab.Screen name="Wallet"    component={BrandWalletScreen}        options={tabIcon('wallet-outline', 'Wallet')} />
      {/* Stage 1 — Alerts gives up its tab to Creators and moves under Profile. A tab
          is somewhere you go on purpose; a feed you check when a badge appears is not.
          The screen is unchanged and still reachable — only its home moved. */}
      <Tab.Screen name="Profile"   component={ProfileStack}             options={tabIcon('account-outline', 'Profile')} />
    </Tab.Navigator>
  );
}
