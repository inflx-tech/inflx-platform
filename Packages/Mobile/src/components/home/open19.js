/**
 * Item 19 — where a Home row, a notice or a section heading opens (board item19-home-v3).
 *
 * The server names a destination in words (`open.screen`: 'agreement', 'thread', 'remote' …);
 * this file turns it into the screen that already exists, in the tab that owns it, with the
 * params that screen already takes. Nothing here is a new screen.
 *
 * Every jump goes INTO ANOTHER TAB'S STACK, so it asks for that tab's main page underneath
 * (`initial: false`, the rule in navigation/BrandNavigator.js isTabRoot): the screen is pushed,
 * has no bottom tabs, and Back works.
 *
 * BACK RETURNS TO HOME. Left alone, Back from a pushed screen lands on that tab's main page —
 * Campaigns, say — and a person working down their list would have to find Home again each
 * time. `jumpFromHome` watches the tab navigator: once the tab it opened is back on its main
 * page, it returns to the Home tab. It lets go the moment the person goes anywhere else.
 * Contract: features/item19-home
 */
import { openWebDashboard } from '../../utils/openWebDashboard';
import { influencerApi } from '../../services/api';

/** The website page that packs and ships orders (the phone has no orders screen — H5). */
export const ORDERS_WEB_PATH = '/dashboard/fulfillment';

const ids = (o) => ({ campaignId: o.campaignId, setId: o.setId, ciId: o.ciId });

/** A brand row's destination: { tab, screen, params } | { web } | null. */
export function brandTarget(open) {
  if (!open) return null;
  const C = 'CampaignsTab';
  switch (open.screen) {
    case 'agreement': return { tab: C, screen: 'BrandAgreement', params: { ...ids(open), preview: false } };
    case 'agreementPreview': return { tab: C, screen: 'BrandAgreement', params: { ...ids(open), preview: true } };
    case 'thread': return { tab: C, screen: 'BrandThread', params: ids(open) };
    case 'set': return { tab: C, screen: 'BrandSetDetail', params: { campaignId: open.campaignId, setId: open.setId } };
    case 'shoot': return { tab: C, screen: 'BrandShoot', params: ids(open) };
    case 'remote': return { tab: C, screen: 'BrandRemote', params: ids(open) };
    case 'content': return { tab: C, screen: 'BrandContent', params: ids(open) };
    case 'goingLive': return { tab: C, screen: 'BrandSaleLive', params: ids(open) };
    case 'pool': return { tab: C, screen: 'BrandPool', params: {} };
    case 'campaign': return { tab: C, screen: 'BrandCampaignDetail', params: { campaignId: open.campaignId } };
    case 'pitches': return { tab: 'CreatorsTab', screen: 'BrandPitches', params: {} };
    case 'pitch': return { tab: 'CreatorsTab', screen: 'BrandPitch', params: { pitchId: open.pitchId } };
    case 'withdrawals': return { tab: 'WalletTab', screen: 'BrandWithdrawals', params: {} };
    case 'walletDetails': return { tab: 'WalletTab', screen: 'BrandWalletDetails', params: {} };
    case 'wallet': return { tab: 'WalletTab' };
    case 'ordersWeb': return { web: ORDERS_WEB_PATH };
    default: return null;
  }
}

/** A creator row's destination. `createPost` is worked out at the tap (it makes the post first). */
export function creatorTarget(open) {
  if (!open) return null;
  const C = 'CollabsTab';
  const ci = { ciId: open.ciId };
  switch (open.screen) {
    case 'invitation': return { tab: C, screen: 'Invitation', params: ci };
    case 'thread': return { tab: C, screen: 'Thread', params: ci };
    case 'agreement': return { tab: C, screen: 'Agreement', params: ci };
    case 'shoot': return { tab: C, screen: 'Shoot', params: ci };
    case 'shootThread': return { tab: C, screen: 'ShootThread', params: ci };
    case 'remote': return { tab: C, screen: 'MyRemote', params: ci };
    case 'remoteAddress': return { tab: C, screen: 'RemoteAddress', params: ci };
    case 'remoteAddressCorrect': return { tab: C, screen: 'RemoteAddress', params: { ...ci, correcting: true } };
    case 'content': return { tab: C, screen: 'Content', params: ci };
    case 'goingLive': return { tab: C, screen: 'SaleLive', params: ci };
    case 'sell': return { tab: C, screen: 'CreatorSell', params: ci };
    case 'pitchThread': return { tab: C, screen: 'PitchThread', params: { pitchId: open.pitchId } };
    case 'pitch': return { tab: C, screen: 'MyPitch', params: { pitchId: open.pitchId } };
    case 'collabs': return { tab: C };
    case 'postStatus': return { tab: 'CreateTab', screen: 'PostStatus', params: { postId: open.postId } };
    case 'createPost': return { create: open.ciId };
    case 'yourNumbers': return { tab: 'ProfileTab', screen: 'YourNumbers', params: {} };
    case 'invitationSettings': return { tab: 'ProfileTab', screen: 'InvitationSettings', params: {} };
    case 'walletDetails': return { tab: 'WalletTab', screen: 'CreatorWalletDetails', params: {} };
    case 'withdrawals': return { tab: 'WalletTab', screen: 'CreatorWithdrawals', params: {} };
    case 'wallet': return { tab: 'WalletTab' };
    default: return null;
  }
}

export const targetFor = (side, open) => (side === 'creator' ? creatorTarget(open) : brandTarget(open));

/* ───────────────────────────────────────────── Back returns to Home */

let _disarm = null;

/** The index of the screen on top of a tab's own stack, or null when it is not known yet. */
function nestedIndex(tabRoute) {
  const st = tabRoute && tabRoute.state;
  if (!st || !Array.isArray(st.routes)) return null;
  return typeof st.index === 'number' ? st.index : st.routes.length - 1;
}

/**
 * After a jump into `tabName`: once that tab has shown a pushed screen and is back on its main
 * page, go back to Home. Stops watching as soon as the person is on any other tab.
 */
export function armReturnHome(tabs, tabName) {
  if (_disarm) _disarm();
  if (!tabs || typeof tabs.addListener !== 'function' || typeof tabs.getState !== 'function') return;
  let sawPushed = false;
  let off = null;
  const stop = () => { if (off) off(); off = null; if (_disarm === stop) _disarm = null; };
  off = tabs.addListener('state', () => {
    let st;
    try { st = tabs.getState(); } catch (_) { return; }
    const focused = st && Array.isArray(st.routes) ? st.routes[st.index] : null;
    if (!focused) return;
    if (focused.name !== tabName) { stop(); return; }
    const idx = nestedIndex(focused);
    if (idx == null) return;
    if (idx > 0) { sawPushed = true; return; }
    if (sawPushed) { stop(); tabs.navigate('HomeTab'); }
  });
  _disarm = stop;
}
export function _disarmReturnHome() { if (_disarm) _disarm(); }

/** Open a destination from a Home screen. */
export function jumpFromHome(navigation, target) {
  if (!target) return false;
  if (target.web) { openWebDashboard(target.web); return true; }
  if (!target.tab) return false;
  // A section heading opens a tab's MAIN page, optionally on one of its segments. A main page has
  // nothing to be pushed over, so this is the one jump that carries no `initial: false`.
  if (!target.screen) {
    const main = target.root ? { screen: target.root, params: target.params || {} } : undefined;
    navigation.navigate(target.tab, main);
    return true;
  }
  const tabs = typeof navigation.getParent === 'function' ? navigation.getParent() : null;
  navigation.navigate(target.tab, { screen: target.screen, params: target.params || {}, initial: false });
  armReturnHome(tabs, target.tab);
  return true;
}

/** Open what a row is about. The creator's "Start" makes the post first, as the Create tab does. */
export async function openRow(navigation, side, row) {
  const target = targetFor(side, row && row.open);
  if (!target) return false;
  if (target.create) {
    const r = await influencerApi.createPost(target.create);
    if (!r || !r.success) return false;
    return jumpFromHome(navigation, { tab: 'CreateTab', screen: 'PostType', params: { postId: r.data.post.id } });
  }
  return jumpFromHome(navigation, target);
}

/* ───────────────────────────────────────────── notices */

/**
 * Where a notice goes, from the `screen` the server put on it. The same map serves both apps:
 * a brand is only ever sent brand codes, a creator creator codes.
 *   → a target for jumpFromHome, or null (the notice is information only).
 */
export function noticeTarget(n) {
  const d = (n && n.data_json) || {};
  const open = { campaignId: d.campaign_id, setId: d.set_id, ciId: d.campaign_influencer_id, pitchId: d.pitch_id, postId: d.post_id };
  const full = !!(open.campaignId && open.setId && open.ciId);
  switch (d.screen) {
    // ── the brand
    case 'set_detail': return open.campaignId && open.setId ? brandTarget({ ...open, screen: 'set' }) : null;
    case 'brand_thread': return full ? brandTarget({ ...open, screen: 'thread' }) : null;
    case 'brand_shoot': return full ? brandTarget({ ...open, screen: 'shoot' }) : null;
    case 'brand_remote': return full ? brandTarget({ ...open, screen: 'remote' }) : null;
    case 'brand_content': return full ? brandTarget({ ...open, screen: 'content' }) : null;
    case 'brand_going_live': return full ? brandTarget({ ...open, screen: 'goingLive' }) : null;
    case 'brand_pitch': return open.pitchId ? brandTarget({ ...open, screen: 'pitch' }) : null;
    case 'pool': return brandTarget({ screen: 'pool' });
    case 'campaign_detail': return open.campaignId ? brandTarget({ ...open, screen: 'campaign' }) : null;
    // item 20 — who is linked to this brand
    case 'linked_creators': return { tab: 'ProfileTab', screen: 'BrandLinkedCreators', params: {} };
    // ── the creator
    case 'post': return open.postId ? creatorTarget({ ...open, screen: 'postStatus' }) : null;
    case 'creator_offer': case 'creator_sell': return open.ciId ? creatorTarget({ ...open, screen: 'sell' }) : null;
    case 'invitation': return open.ciId ? creatorTarget({ ...open, screen: 'invitation' }) : null;
    case 'invitation_thread': return open.ciId ? creatorTarget({ ...open, screen: 'thread' }) : null;
    case 'my_going_live': return open.ciId ? creatorTarget({ ...open, screen: 'goingLive' }) : null;
    case 'my_content': return open.ciId ? creatorTarget({ ...open, screen: 'content' }) : null;
    case 'my_shoot': return open.ciId ? creatorTarget({ ...open, screen: 'shoot' }) : null;
    case 'my_remote': return open.ciId ? creatorTarget({ ...open, screen: 'remote' }) : null;
    case 'my_pitch': return open.pitchId ? creatorTarget({ ...open, screen: 'pitch' }) : null;
    case 'collabs': return creatorTarget({ screen: 'collabs' });
    // item 20 — the brand he runs
    case 'my_brand': return { tab: 'ProfileTab', screen: 'MyBrand', params: {} };
    // ── either
    case 'wallet': case 'earnings': case 'withdrawals': return { tab: 'WalletTab' };
    default: return null;
  }
}
/** An order notice has no phone screen: on the brand's list it opens the website's orders page. */
export function brandNoticeTarget(n) {
  const t = noticeTarget(n);
  if (t) return t;
  return n && typeof n.type === 'string' && /^brand_(new_order|order_|replace_|refund_|return_)/.test(n.type) ? { web: ORDERS_WEB_PATH } : null;
}
