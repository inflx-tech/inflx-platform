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
import BrandConversionsScreen from '../screens/brand/BrandConversionsScreen';
import BrandInfluencerProfileScreen from '../screens/brand/BrandInfluencerProfileScreen';
// collab-part2 — the pre-campaign handshake, brand side.
import BrandRequestComposerScreen from '../screens/brand/BrandRequestComposerScreen';
import BrandCollabRequestsScreen from '../screens/brand/BrandCollabRequestsScreen';
import BrandActionRequiredScreen from '../screens/brand/BrandActionRequiredScreen';
import BrandStorePreviewScreen from '../screens/brand/BrandStorePreviewScreen';
// Stage 1 — everything that happens before a campaign exists.
import BrandCreatorsScreen from '../screens/brand/BrandCreatorsScreen';
import BrandFindCreatorsScreen from '../screens/brand/BrandFindCreatorsScreen';
import BrandProductPickerScreen from '../screens/brand/BrandProductPickerScreen';
// Stage 2 — building a campaign from the phone.
// Contract: features/stage-2-build-a-campaign-from-the-phone
import BrandCampaignCreateScreen from '../screens/brand/BrandCampaignCreateScreen';
import BrandCampaignBuilderScreen from '../screens/brand/BrandCampaignBuilderScreen';
import BrandSetWizardScreen from '../screens/brand/BrandSetWizardScreen';
import BrandAllocationScreen from '../screens/brand/BrandAllocationScreen';
import CreatorTermsScreen from '../screens/brand/CreatorTermsScreen';
import BrandBasketPreviewScreen from '../screens/brand/BrandBasketPreviewScreen';
import BrandCampaignReviewScreen from '../screens/brand/BrandCampaignReviewScreen';
import BrandAgreementDetailScreen from '../screens/brand/BrandAgreementDetailScreen';
// Stage 3 — level 4 of the ladder: one creator, her six steps.
import BrandCreatorSpineScreen from '../screens/brand/BrandCreatorSpineScreen';
// Stage 3 — the needs-you tree the app has been fetching and discarding since Stage 0.
// Contract: features/stage-3-watch-the-work-happen
import { useNeedsYou } from '../utils/brandNeedsYou';
import BrandCategoryPickerScreen from '../screens/brand/BrandCategoryPickerScreen';
import BrandGroupsScreen from '../screens/brand/BrandGroupsScreen';
import BrandGroupDetailScreen from '../screens/brand/BrandGroupDetailScreen';
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
import BrandShootScreen from '../screens/brand/BrandShootScreen';
import BrandShootsListScreen from '../screens/brand/BrandShootsListScreen';

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
      {/* Stage 4 — the shoot finally has a door. Registered in EVERY stack that carries
          BrandContract: a cross-stack navigate fails silently at runtime and passes every
          build check, which is how a button ends up doing nothing on a handset. */}
      <Stack.Screen name="BrandShoot" component={BrandShootScreen} />
      <Stack.Screen name="BrandShootsList" component={BrandShootsListScreen} />
      <Stack.Screen name="BrandConversions" component={BrandConversionsScreen} />
      <Stack.Screen name="BrandInfluencerProfile" component={BrandInfluencerProfileScreen} />
      {/* collab-part2 — the pre-campaign handshake, brand side. */}
      <Stack.Screen name="BrandRequestComposer" component={BrandRequestComposerScreen} />
      {/* Pick the exact products a creator would promote — item 8. */}
      <Stack.Screen name="BrandProductPicker" component={BrandProductPickerScreen} />
      {/* A real category from the listing tree, not typed — item 9. */}
      <Stack.Screen name="BrandCategoryPicker" component={BrandCategoryPickerScreen} />
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
      {/* Stage 1 — the rebuilt search: three filters, each over a picker.
          The old browse screen has been retired: nothing navigated to it except a
          Home tile and the group flow, and the group flow was pointed at it BY
          MISTAKE, which is how "add to group" came to open a screen that had never
          heard of groups. Two creator searches is how they drift apart. */}
      <Stack.Screen name="BrandFindCreators" component={BrandFindCreatorsScreen} />
      <Stack.Screen name="BrandInfluencerProfile" component={BrandInfluencerProfileScreen} />
      <Stack.Screen name="BrandRequestComposer" component={BrandRequestComposerScreen} />
      <Stack.Screen name="BrandCollabRequests" component={BrandCollabRequestsScreen} />
      <Stack.Screen name="ProposalInbox" component={BrandProposalInboxScreen} />
      <Stack.Screen name="BrandGroups" component={BrandGroupsScreen} />
      <Stack.Screen name="BrandGroupDetail" component={BrandGroupDetailScreen} />
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
      {/* Stage 2 — the campaign wizard. All in this stack, because a cross-stack
          navigate fails silently at runtime and passes every build check. */}
      <Stack.Screen name="BrandCampaignCreate" component={BrandCampaignCreateScreen} />
      <Stack.Screen name="BrandCampaignBuilder" component={BrandCampaignBuilderScreen} />
      <Stack.Screen name="BrandSetWizard" component={BrandSetWizardScreen} />
      <Stack.Screen name="BrandAllocation" component={BrandAllocationScreen} />
      <Stack.Screen name="CreatorTerms" component={CreatorTermsScreen} />
      <Stack.Screen name="BrandBasketPreview" component={BrandBasketPreviewScreen} />
      <Stack.Screen name="BrandCampaignReview" component={BrandCampaignReviewScreen} />
      <Stack.Screen name="BrandAgreementDetail" component={BrandAgreementDetailScreen} />
      <Stack.Screen name="BrandCreatorSpine" component={BrandCreatorSpineScreen} />
      <Stack.Screen name="BrandDiary" component={BrandDiaryScreen} />
      <Stack.Screen name="BrandCampaignInfluencersList" component={BrandCampaignInfluencersListScreen} />
      <Stack.Screen name="BrandCampaignSetsList" component={BrandCampaignSetsListScreen} />
      <Stack.Screen name="BrandCampaignReviewQueue" component={BrandCampaignReviewQueueScreen} />
      <Stack.Screen name="BrandNegotiation" component={BrandNegotiationScreen} />
      <Stack.Screen name="BrandContract" component={BrandContractScreen} />
      {/* Stage 4 — the shoot finally has a door. Registered in EVERY stack that carries
          BrandContract: a cross-stack navigate fails silently at runtime and passes every
          build check, which is how a button ends up doing nothing on a handset. */}
      <Stack.Screen name="BrandShoot" component={BrandShootScreen} />
      <Stack.Screen name="BrandShootsList" component={BrandShootsListScreen} />
      <Stack.Screen name="BrandConversions" component={BrandConversionsScreen} />
      <Stack.Screen name="BrandInfluencerProfile" component={BrandInfluencerProfileScreen} />
      <Stack.Screen name="ContractPdf" component={ContractPdfScreen} />
      {/* stage-a/b — registered here too (already lives in CreatorsStack), same reason
          as the comment above: BrandSetWizard's "find someone new" (StepCreators) needs
          it in ITS OWN stack so goBack() returns to the wizard, not to the Creators tab. */}
      <Stack.Screen name="BrandFindCreators" component={BrandFindCreatorsScreen} />
      <Stack.Screen name="BrandGroups" component={BrandGroupsScreen} />
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
      {/* ProposalInbox was registered here too, for the Profile row that has now gone.
          Nothing in this stack navigates to it — pitches are reached from Creators.
          A dead registration is the same two-of-one-thing fault in miniature. */}
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

// Stage 3 — undefined hides the badge; 0 would draw an empty circle. An absence reads as
// calm, a zero reads as a state. Same rule the creator's navigator already follows.
const badge = (n) => ({
  tabBarBadge: Number(n) > 0 ? Number(n) : undefined,
  tabBarBadgeStyle: { backgroundColor: ig.text, color: ig.bg, fontSize: 10, fontWeight: '800' },
});

export default function BrandNavigator() {
  // Stage 3 — the tab badge. The number comes from the server (Stage 0), so the brand's
  // badge and the creator's can never disagree about the same work. Refreshed when the
  // app returns to the foreground rather than on a timer: a brand who has just dealt with
  // something should not keep seeing a badge for it.
  const { tree } = useNeedsYou();
  const campaignsBadge = Number(
    (tree?.campaigns || []).reduce((n, c) => n + Number(c.total || 0), 0)
  );
  const creatorsBadge = Number(tree?.creators_tab || 0);

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
      <Tab.Screen name="Creators"  component={CreatorsStack}            options={{ ...tabIcon('account-multiple-outline', 'Creators'), ...badge(creatorsBadge) }} />
      <Tab.Screen name="Campaigns" component={CampaignsStack}           options={{ ...tabIcon('bullhorn-outline', 'Campaigns'), ...badge(campaignsBadge) }} />
      <Tab.Screen name="Wallet"    component={BrandWalletScreen}        options={tabIcon('wallet-outline', 'Wallet')} />
      {/* Stage 1 — Alerts gives up its tab to Creators and moves under Profile. A tab
          is somewhere you go on purpose; a feed you check when a badge appears is not.
          The screen is unchanged and still reachable — only its home moved. */}
      <Tab.Screen name="Profile"   component={ProfileStack}             options={tabIcon('account-outline', 'Profile')} />
    </Tab.Navigator>
  );
}
