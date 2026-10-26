import React, { useEffect, useState } from 'react';
import { View, AppState } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { getFocusedRouteNameFromRoute } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { settingsTokens as T, fonts } from '../theme/tokens';
import { TopInsetProvider } from '../hooks/useTopInset';

import BrandProfileScreen from '../screens/brand/BrandProfileScreen';
import LegalListScreen from '../screens/legal/LegalListScreen';
import LegalDocumentScreen from '../screens/legal/LegalDocumentScreen';
// Item 2 — pitch settings, blocked creators. Contract: features/item2-pitch-invitation-settings
import BrandPitchSettingsScreen from '../screens/brand/BrandPitchSettingsScreen';
import BrandBlockedCreatorsScreen from '../screens/brand/BrandBlockedCreatorsScreen';
// Item 20 — the creators linked to this brand. Contract: features/item20-own-brand
import BrandLinkedCreatorsScreen from '../screens/brand/BrandLinkedCreatorsScreen';
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
// Item 17 — the Wallet: locked money, sales money, withdraw, withdrawals, history, details.
import BrandWalletLockedScreen, { BrandWalletCollabScreen } from '../screens/brand/BrandWalletLockedScreen';
import BrandWalletSalesScreen, { BrandWalletSaleScreen } from '../screens/brand/BrandWalletSalesScreen';
import WithdrawScreen from '../screens/wallet/WithdrawScreen';
import WithdrawalsScreen from '../screens/wallet/WithdrawalsScreen';
import WalletHistoryScreen from '../screens/wallet/WalletHistoryScreen';
import WalletDetailsScreen from '../screens/wallet/WalletDetailsScreen';
import BrandCampaignDetailScreen from '../screens/brand/BrandCampaignDetailScreen';
import BrandSetDetailScreen from '../screens/brand/BrandSetDetailScreen';
// post-links-codes (L7, L8): the posts made for a set, and one post's channel breakdown (L6).
import BrandSetPostsScreen from '../screens/brand/BrandSetPostsScreen';
import BrandPostStatsScreen from '../screens/create/PostStatsScreen';
// post-engagement-stats (B5): the comments on a post made for its set, read only. Contract: features/post-engagement-stats
import BrandPostCommentsScreen from '../screens/create/PostCommentsScreen';
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
// Item 12 — the brand's content step. Contract: features/item12-content
import BrandContentScreen from '../screens/brand/BrandContentScreen';
import BrandSaleLiveScreen from '../screens/brand/BrandSaleLiveScreen';
import ShootThreadScreen from '../screens/shared/ShootThreadScreen';
import ShootCounterScreen from '../screens/shared/ShootCounterScreen';
// Item 19 — Home: its two full lists and the brand's notices. Contract: features/item19-home
import HomeListScreen from '../screens/home/HomeListScreen';
import BrandNotificationsScreen from '../screens/home/BrandNotificationsScreen';
import { getHomeCount, subscribeHomeCount, refreshHomeCount } from '../services/homeCount';

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
// Item 19 — the Home tab is a stack now: Home, "Needs you, all", "Waiting on others, all", notices.
const HomeStack = createNativeStackNavigator();
const noHeader = { headerShown: false };

function HomeStackScreen() {
  return (
    <HomeStack.Navigator screenOptions={noHeader}>
      <HomeStack.Screen name="BrandHome" component={PendingHomeScreen} initialParams={{ kind: 'brandHome', tabTitle: 'Home' }} />
      <HomeStack.Screen name="BrandNeedsYou" component={HomeListScreen} initialParams={{ side: 'brand', list: 'needs' }} />
      <HomeStack.Screen name="BrandWaiting" component={HomeListScreen} initialParams={{ side: 'brand', list: 'waiting' }} />
      <HomeStack.Screen name="BrandNotifications" component={BrandNotificationsScreen} />
    </HomeStack.Navigator>
  );
}

function WalletStackScreen() {
  return (
    <WalletStack.Navigator screenOptions={{ headerShown: false }}>
      <WalletStack.Screen name="BrandWallet" component={BrandWalletScreen} />
      <WalletStack.Screen name="BrandAddMoney" component={BrandAddMoneyScreen} />
      {/* features/registration-and-profile B8 — GST number and bank account live on the Wallet tab. */}
      <WalletStack.Screen name="BrandPayoutDetail" component={BrandPayoutDetailScreen} />
      {/* Item 17 — features/item17-wallet (board BW3–BW10). */}
      <WalletStack.Screen name="BrandWalletLocked" component={BrandWalletLockedScreen} />
      <WalletStack.Screen name="BrandWalletCollab" component={BrandWalletCollabScreen} />
      <WalletStack.Screen name="BrandWalletSales" component={BrandWalletSalesScreen} />
      <WalletStack.Screen name="BrandWalletSale" component={BrandWalletSaleScreen} />
      <WalletStack.Screen name="BrandWithdraw" component={WithdrawScreen} initialParams={{ side: 'brand' }} />
      <WalletStack.Screen name="BrandWithdrawals" component={WithdrawalsScreen} initialParams={{ side: 'brand' }} />
      <WalletStack.Screen name="BrandWalletHistory" component={WalletHistoryScreen} initialParams={{ side: 'brand' }} />
      <WalletStack.Screen name="BrandWalletDetails" component={WalletDetailsScreen} initialParams={{ side: 'brand' }} />
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
      <CampaignsStack.Screen name="BrandSetPosts" component={BrandSetPostsScreen} />
      <CampaignsStack.Screen name="BrandPostStats" component={BrandPostStatsScreen} />
      <CampaignsStack.Screen name="BrandPostComments" component={BrandPostCommentsScreen} />
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
      {/* Item 12 — the content step. */}
      <CampaignsStack.Screen name="BrandContent" component={BrandContentScreen} />
      {/* Item 14 — Pay for Sale going live, the brand's side. */}
      <CampaignsStack.Screen name="BrandSaleLive" component={BrandSaleLiveScreen} />
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
      {/* Item 20 */}
      <ProfileStack.Screen name="BrandLinkedCreators" component={BrandLinkedCreatorsScreen} />
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

// ui-walk-fixes D3 — the bottom tabs show on the five main pages and on no pushed screen.
// The bar as it is drawn on a main page, and the bar on every screen pushed over one.
export const TAB_BAR_STYLE = { backgroundColor: T.bg, borderTopColor: T.border, borderTopWidth: 1, height: 62, paddingBottom: 8, paddingTop: 6 };
export const TAB_BAR_HIDDEN = { display: 'none' };

export const tabScreenOptions = ({ route }) => ({
  headerShown: false,
  tabBarActiveTintColor: T.ink,
  tabBarInactiveTintColor: T.ink3,
  tabBarStyle: TAB_BAR_STYLE,
  // While the keypad is open the bar steps out of the way on the pages that keep it (board B5),
  // so a search box on a main page is not squeezed between the bar and the keypad. Both apps.
  tabBarHideOnKeyboard: true,
  tabBarLabelStyle: { fontFamily: fonts.sansSemiBold, fontSize: 11 },
  tabBarIcon: ({ color, size }) => <Icon name={ICONS[route.name] || 'circle-outline'} size={size} color={color} />,
});

// The nested stack's state for one tab. Production builds keep it on the route; development
// builds hide it there, so it is read from the tab navigator's own state as well.
function stackStateOf(route, navigation) {
  if (!route) return undefined;
  if (route.state) return route.state;
  try {
    const tabs = navigation && typeof navigation.getState === 'function' ? navigation.getState() : null;
    const mine = tabs && Array.isArray(tabs.routes) ? tabs.routes.find((r) => r.key === route.key) : null;
    return mine ? mine.state : undefined;
  } catch (_) {
    return undefined;
  }
}

/**
 * Is this tab showing a page that keeps the bottom tabs?
 *
 * `rootName` is the tab's main page — the first screen of its stack. A tab that is one plain
 * screen (Home) has nothing pushed over it: pass no rootName and it always keeps the bar.
 *
 *   · the main page is on top (or the stack has not rendered yet)      → the bar shows
 *   · any other screen is on top of at least one screen beneath it     → pushed: the bar is hidden
 *   · any other screen is the stack's ONLY screen                      → the bar shows
 *
 * The last line is a safety net, not a second rule. When a tab that has never been opened is
 * opened straight onto one of its inner screens, React Navigation makes that screen the stack's
 * first and only one: there is no main page beneath it. Every jump a screen makes into another
 * tab's inner screen therefore asks for the main page underneath — it passes `initial: false`
 * beside `screen` (the Wallet's collaboration row into the set, an accepted pitch into the pool,
 * Sale live into the post …) — so the inner screen is pushed, has no bar, and Back reaches the
 * main page. navigation/__tests__/tabBarRealNavigator.test.js fails on a jump that forgets it.
 *
 * One jump must NOT build the main page underneath: the pending account's Home card that opens
 * "Find brands" inside the Collabs tab, which is locked until approval. That screen is the only
 * one in its stack and keeps the bar, exactly as before; Back from it returns to Home.
 */
export function isTabRoot(route, rootName, navigation) {
  if (!rootName) return true;
  const focused = getFocusedRouteNameFromRoute(route || {});
  if (!focused || focused === rootName) return true;
  const st = stackStateOf(route, navigation);
  if (!st || !Array.isArray(st.routes)) return true;
  const index = typeof st.index === 'number' ? st.index : st.routes.length - 1;
  return index <= 0;
}

/**
 * The per-tab options, for both apps: the title, and the bar on the tab's main page only.
 * A per-screen tabBarStyle REPLACES the navigator's — so the whole 62-high style is given back
 * on the main page rather than left to merge. Usage: options = tabRootOptions(title, rootName).
 * (No JSX example here on purpose: duplicateScreens.test.js reads this file's screen tags.)
 */
export const tabRootOptions = (title, rootName) => ({ route, navigation } = {}) => ({
  title,
  tabBarStyle: isTabRoot(route, rootName, navigation) ? TAB_BAR_STYLE : TAB_BAR_HIDDEN,
});

/**
 * Item 19 (H6) — the number on the Home tab: how many things need you, from every tab.
 * Shared by both apps. The store is fed by Home's own read and refreshed here: when the navigator
 * mounts, when the app comes back to the front, and (throttled) when any tab is pressed.
 */
export const HOME_BADGE_STYLE = { backgroundColor: T.state.yourMove.fg, color: '#FFFFFF', fontFamily: fonts.sansBold, fontSize: 10 };
export const homeBadge = (n) => (n > 0 ? (n > 99 ? '99+' : n) : undefined);
export function useHomeTabCount(side) {
  const [needs, setNeeds] = useState(getHomeCount().needs);
  useEffect(() => {
    const off = subscribeHomeCount((c) => setNeeds(c.needs));
    refreshHomeCount(side, { force: true });
    const sub = AppState.addEventListener('change', (st) => { if (st === 'active') refreshHomeCount(side, { force: true }); });
    return () => { off(); if (sub && typeof sub.remove === 'function') sub.remove(); };
  }, [side]);
  return needs;
}
/** The Home tab's options: the usual per-tab ones, plus the count. */
export const homeTabOptions = (rootName, needs) => (p) => ({ ...tabRootOptions('Home', rootName)(p), tabBarBadge: homeBadge(needs), tabBarBadgeStyle: HOME_BADGE_STYLE });

// Each tab's main page — the first screen of its stack.
export const BRAND_TAB_ROOTS = {
  HomeTab: 'BrandHome', CampaignsTab: 'BrandCampaigns', CreatorsTab: 'BrandCreators', WalletTab: 'BrandWallet', ProfileTab: 'BrandProfile',
};

export default function BrandNavigator() {
  // Read once, at mount: initialRouteName only matters the first time the navigator renders.
  // The lock itself reads the live status on every press (lockedTab.js).
  // Item 19 (H3): an approved brand opens on Home (it used to open on Creators).
  const initialRouteName = initialTabFor(getAccountStatus(), 'HomeTab');
  const needs = useHomeTabCount('brand');
  // ui-walk-fixes D4 — TopInsetProvider is the one safe-area provider above every title of this
  // app: titles start at the phone's real top inset (useTopInset), from the first frame.
  return (
    <TopInsetProvider>
      <View style={{ flex: 1 }}>
        <Tab.Navigator initialRouteName={initialRouteName} screenOptions={tabScreenOptions} screenListeners={{ tabPress: () => { refreshHomeCount('brand'); } }}>
          <Tab.Screen name="HomeTab" component={HomeStackScreen} options={homeTabOptions(BRAND_TAB_ROOTS.HomeTab, needs)} />
          <Tab.Screen name="CampaignsTab" component={CampaignsStackScreen} options={tabRootOptions('Campaigns', BRAND_TAB_ROOTS.CampaignsTab)} listeners={lockedTabListeners()} />
          <Tab.Screen name="CreatorsTab" component={CreatorsStackScreen} options={tabRootOptions('Creators', BRAND_TAB_ROOTS.CreatorsTab)} listeners={lockedTabListeners()} />
          <Tab.Screen name="WalletTab" component={WalletStackScreen} options={tabRootOptions('Wallet', BRAND_TAB_ROOTS.WalletTab)} />
          <Tab.Screen name="ProfileTab" component={ProfileStackScreen} options={tabRootOptions('Profile', BRAND_TAB_ROOTS.ProfileTab)} />
        </Tab.Navigator>
        <PendingSheetHost />
      </View>
    </TopInsetProvider>
  );
}
