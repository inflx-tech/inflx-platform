import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../config/api';
import { setAccountStatus } from './accountStatus';

async function getToken() {
  try {
    return await AsyncStorage.getItem('inflx_token');
  } catch {
    return null;
  }
}

async function getRefreshToken() {
  try {
    return await AsyncStorage.getItem('inflx_refresh_token');
  } catch {
    return null;
  }
}

export async function clearSession() {
  await AsyncStorage.multiRemove(['inflx_token', 'inflx_refresh_token', 'inflx_user']);
  setAccountStatus(null);   // no session → no status; the next account's is read fresh
}

// Single in-flight refresh promise so concurrent 401s don't trigger
// multiple parallel /auth/refresh calls. All callers await the same one.
let _refreshInFlight = null;

// Tri-state result: { token } on success, { invalid: true } ONLY when the
// server definitively rejected the refresh token (401/403), and
// { transient: true } for everything else (no network, timeout, 5xx,
// unparseable body). Only `invalid` may log the user out — a transient
// failure used to fall through to clearSession() and wipe a perfectly
// valid session ("Session expired" on a network blip).
async function tryRefreshAccessToken() {
  if (_refreshInFlight) return _refreshInFlight;
  _refreshInFlight = (async () => {
    try {
      const rt = await getRefreshToken();
      if (!rt) return { invalid: true };
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 30000);
      let res;
      try {
        res = await fetch(`${API_BASE_URL}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: rt }),
          signal: controller.signal,
        });
      } catch {
        return { transient: true };
      } finally {
        clearTimeout(timer);
      }
      if (res.status === 401 || res.status === 403) return { invalid: true };
      if (!res.ok) return { transient: true };
      const json = await res.json().catch(() => null);
      const newAccess  = json?.data?.access_token;
      const newRefresh = json?.data?.refresh_token;
      if (!newAccess) return { transient: true };
      await AsyncStorage.setItem('inflx_token', newAccess);
      // Backend rotates the refresh token on every refresh call. Persist the
      // new one so the 30-day clock resets — this is what keeps users
      // logged in indefinitely as long as they open the app at least once
      // every 30 days.
      if (newRefresh) {
        await AsyncStorage.setItem('inflx_refresh_token', newRefresh);
      }
      return { token: newAccess };
    } catch {
      return { transient: true };
    } finally {
      _refreshInFlight = null;
    }
  })();
  return _refreshInFlight;
}

async function fetchOnce(method, path, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token && token.length > 0) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000); // 30s for Render cold starts
  try {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return res;
  } finally {
    clearTimeout(timeout);
  }
}

// Endpoints that ESTABLISH a session rather than consume one. A 401 from any
// of these is the server's business answer ("Invalid or expired OTP"), not a
// statement about the caller's stored session — so the refresh-and-clear dance
// below must never run on them. It used to: a mistyped or already-used OTP
// returned 401, the client "refreshed", retried, got 401 again and wiped the
// tokens the user had just been issued seconds earlier. The visible damage was
// a brand who signed in fine, reached the registration form with no session
// left, and was told "Please sign in to continue." on submit — leaving a users
// row with no matching brands row.
const SESSION_ESTABLISHING_PATHS = ['/auth/refresh', '/auth/send-otp', '/auth/verify-otp'];

// features/change-login-number — the four change-phone steps are authenticated, so an
// expired access token still gets the one silent refresh + retry above. But a 401 that
// survives the retry is the server's business answer ("Invalid or expired OTP", or
// CHANGE_EXPIRED after 15 minutes) — never a statement about the session. Clearing the
// tokens there would sign a person out for mistyping one code. These paths hand the
// server's words back to the screen instead.
const KEEP_SESSION_ON_401_PATHS = [
  '/auth/change-phone/start', '/auth/change-phone/verify-old', '/auth/change-phone/send-new', '/auth/change-phone/confirm',
];

// features/registration-and-profile — the account gate. A pending (or rejected) account is
// inside the app now, so every real action can answer 403 ACCOUNT_PENDING / ACCOUNT_REJECTED.
// Rather than each screen reading that error and drawing its own sheet, the client fires one
// event and the PendingSheetHost (mounted once per navigator) shows the words. Listeners
// receive { code, message }. Returns an unsubscribe.
const ACCOUNT_GATE_CODES = ['ACCOUNT_PENDING', 'ACCOUNT_REJECTED'];
const _accountGateListeners = new Set();
export function onAccountGate(fn) {
  _accountGateListeners.add(fn);
  return () => { _accountGateListeners.delete(fn); };
}
// Exported so the tab lock (navigation/lockedTab.js) and the pending home's locked tiles can
// raise the very same sheet, with the server's words, without a request having been made.
export function emitAccountGate(error) {
  for (const fn of [..._accountGateListeners]) {
    try { fn(error); } catch (_) { /* a listener must never break the request */ }
  }
}
function maybeEmitAccountGate(status, json) {
  if (status !== 403 || !json || json.success !== false) return;
  const code = json.error && json.error.code;
  if (ACCOUNT_GATE_CODES.includes(code)) emitAccountGate({ code, message: json.error.message });
}

// The account's status rides on GET /brands/me and GET /influencers/me as `user_status`. Every
// successful read refreshes the accountStatus store (so a submit or an admin approval is felt
// without a restart) and the stored user, so the next cold start opens on the right tab.
const ACCOUNT_STATUS_PATHS = ['/brands/me', '/influencers/me'];
function maybeRecordAccountStatus(method, path, json) {
  if (method !== 'GET' || !ACCOUNT_STATUS_PATHS.includes(path.split('?')[0])) return;
  if (!json || json.success !== true || !json.data || !json.data.user_status) return;
  const status = json.data.user_status;
  setAccountStatus(status);
  AsyncStorage.getItem('inflx_user').then((str) => {
    if (!str) return null;
    const user = JSON.parse(str);
    if (user.status === status) return null;
    return AsyncStorage.setItem('inflx_user', JSON.stringify({ ...user, status }));
  }).catch(() => {});
}

async function request(method, path, body) {
  // Skip the refresh dance for the endpoints that hand out sessions.
  const isSessionEstablishing = SESSION_ESTABLISHING_PATHS.includes(path.split('?')[0]);
  let token = await getToken();

  try {
    let res = await fetchOnce(method, path, body, token);

    // Silent retry: on 401, try to refresh once and retry the original call.
    // The session is cleared ONLY when the server definitively rejects the
    // refresh token — a transient refresh failure is retryable and must
    // never wipe locally-stored tokens that are still valid server-side.
    if (res.status === 401 && !isSessionEstablishing) {
      const refreshed = await tryRefreshAccessToken();
      if (refreshed.token) {
        res = await fetchOnce(method, path, body, refreshed.token);
      } else if (refreshed.transient) {
        return { success: false, error: { code: 'NETWORK_ERROR', message: 'Could not reach the server. Please try again.' } };
      }
      if (res.status === 401 && !KEEP_SESSION_ON_401_PATHS.includes(path.split('?')[0])) {
        // Definitive: refresh token invalid/expired, or retry still rejected.
        // Guests (no session at all) get a sign-in prompt, not "expired" —
        // the app is guest-first and this copy reads as a scary bug to them.
        const hadSession = !!token;
        await clearSession();
        return {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: hadSession ? 'Session expired. Please log in again.' : 'Please sign in to continue.',
          },
        };
      }
    }

    const text = await res.text();
    try {
      const json = JSON.parse(text);
      maybeEmitAccountGate(res.status, json);
      maybeRecordAccountStatus(method, path, json);
      return json;
    } catch (parseErr) {
      console.log('[API] Non-JSON response:', text.substring(0, 200));
      return { success: false, error: { code: 'PARSE_ERROR', message: `Server returned invalid response (HTTP ${res.status})` } };
    }
  } catch (e) {
    const msg = e?.name === 'AbortError'
      ? 'Request timed out. Server may be starting up — please retry in a moment.'
      : 'Cannot connect to server. Check your connection.';
    return { success: false, error: { code: 'NETWORK_ERROR', message: msg } };
  }
}

export const api = {
  get:    (path)       => request('GET', path, null),
  post:   (path, body) => request('POST', path, body),
  put:    (path, body) => request('PUT', path, body),
  patch:  (path, body) => request('PATCH', path, body),
  delete: (path)       => request('DELETE', path, null),
};

// API endpoint groups
export const authApi = {
  sendOtp: (phone) => api.post('/auth/send-otp', { phone }),
  verifyOtp: (phone, otp, role, name) =>
    api.post('/auth/verify-otp', { phone, otp, role, ...(name && { name }) }),
  logout: () => api.post('/auth/logout'),
  registerFcmToken: (token) => api.post('/auth/fcm-token', { token }),
  registerOneSignalPlayerId: (playerId) => api.post('/auth/onesignal-player-id', { player_id: playerId }),
  // features/change-login-number — four steps, old number first. The screen stores the fresh
  // pair `confirm` returns exactly as OTPScreen does after sign-in.
  changePhoneStart: () => api.post('/auth/change-phone/start'),
  changePhoneVerifyOld: (otp) => api.post('/auth/change-phone/verify-old', { otp }),
  changePhoneSendNew: (changeToken, newPhone) => api.post('/auth/change-phone/send-new', { change_token: changeToken, new_phone: newPhone }),
  changePhoneConfirm: (changeToken, otp) => api.post('/auth/change-phone/confirm', { change_token: changeToken, otp }),
};

export const brandApi = {
  register: (data) => api.post('/brands/register', data),
  getMe: () => api.get('/brands/me'),
  updateMe: (data) => api.patch('/brands/me', data),

  // Item 2 — Pitch settings (rules v1.10 §8A). Contract: features/item2-pitch-invitation-settings
  getPitchSettings:     () => api.get('/brands/me/pitch-settings'),
  putPitchSettings:     (data) => api.put('/brands/me/pitch-settings', data),
  listBlockedCreators:  () => api.get('/brands/me/blocked-creators'),
  blockCreator:         (influencerId) => api.post('/brands/me/blocked-creators', { influencerId }),
  unblockCreator:       (influencerId) => api.delete(`/brands/me/blocked-creators/${influencerId}`),
  // X4 / P1–P4 — a creator's profile as a brand sees it (carries inviteSummary + item-3 extras).
  getCreatorProfile:    (influencerId) => api.get(`/influencers/${influencerId}`),
  // Item 3b — S2/S3: every number for one platform. Contract: features/item3b-social-numbers
  getCreatorSocial:     (influencerId, platform) => api.get(`/influencers/${influencerId}/social/${platform}`),

  // Item 3 — Discover, Worked with, groups, branches, logo. Contract: features/item3-discovery-profiles-groups
  discoverCreators:     (params) => api.get(`/brands/me/discover-creators${q(params)}`),
  workedWith:           (params) => api.get(`/brands/me/worked-with${q(params)}`),
  listGroups:           () => api.get('/brands/me/influencer-groups'),
  getGroup:             (id, params) => api.get(`/brands/me/influencer-groups/${id}${q(params)}`),
  createGroup:          (name, influencerIds) => api.post('/brands/me/influencer-groups', influencerIds ? { name, influencer_ids: influencerIds } : { name }),
  renameGroup:          (id, name) => api.patch(`/brands/me/influencer-groups/${id}`, { name }),
  deleteGroup:          (id) => api.delete(`/brands/me/influencer-groups/${id}`),
  addGroupMembers:      (id, influencerIds) => api.post(`/brands/me/influencer-groups/${id}/members`, { influencer_ids: influencerIds }),
  removeGroupMember:    (id, influencerId) => api.delete(`/brands/me/influencer-groups/${id}/members/${influencerId}`),
  groupsForCreator:     (influencerId) => api.get(`/brands/me/influencer-groups/for-creator/${influencerId}`),
  setGroupsForCreator:  (influencerId, groupIds) => api.put(`/brands/me/influencer-groups/for-creator/${influencerId}`, { groupIds }),
  listBranches:         () => api.get('/brands/me/branches'),
  createBranch:         (data) => api.post('/brands/me/branches', data),
  updateBranch:         (id, data) => api.put(`/brands/me/branches/${id}`, data),
  makeMainBranch:       (id) => api.post(`/brands/me/branches/${id}/make-main`),
  removeBranch:         (id) => api.delete(`/brands/me/branches/${id}`),
  // Logo: media-asset upload (tag 'logo'), then save the asset id on the profile.
  getLogoUploadUrl:     (file_name, file_type, file_size_bytes) => api.post('/brands/me/media-assets/upload-url', { file_name, file_type, file_size_bytes }),
  createLogoAsset:      (data) => api.post('/brands/me/media-assets', data),
  getBrandProducts:     (brandId, params) => api.get(`/brands/${brandId}/products${q(params)}`),
  getBrandProduct:      (brandId, productId) => api.get(`/brands/${brandId}/products/${productId}`),
  getOwnOverview:       (brandId) => api.get(`/brands/${brandId}/public`),
  // A rejected brand asking to be looked at again. RejectedScreen has always called
  // this and it has never existed here, so its one button threw before any request
  // left the phone and the spinner never stopped. The server route has been live all
  // along (POST /brands/resubmit) — only this line was missing.
  resubmit: (data) => api.post('/brands/resubmit', data),
  // features/registration-and-profile — the account reaches the admin queue when the brand
  // submits it. 422 PROFILE_INCOMPLETE names what is missing; from rejected this IS the resubmit.
  submitForReview: () => api.post('/brands/me/submit-for-review'),
  // Docs/THE_CUT.md pass 1 — the pre-campaign handshake bindings are removed with
  // its screens. The server still answers these routes; disconnecting it is pass 3.

  /* ── Stage 1 — the retired handshake's "ask everyone matching a filter". The group
     methods that used to be duplicated here are the item 3 ones above (item 5 cleanup:
     the later copies silently won and dropped createGroup's no-members form). */
  askMany:  (filters, terms, message) =>
    api.post('/brands/me/collab-requests', { filters, terms, message }),

  // ── Item 5 · choosing creators, terms and invitations ────────────────────
  // Contract: features/item5-invitations. All new endpoints; another brand's set is 404.
  pickable:          (campaignId, setId, params) => api.get(`/campaigns/${campaignId}/sets/${setId}/pickable${q(params || {})}`),
  groupCheck:        (campaignId, setId, groupId) => api.get(`/campaigns/${campaignId}/sets/${setId}/group-check/${groupId}`),
  checkEligibility:  (campaignId, setId, creators) => api.post(`/campaigns/${campaignId}/sets/${setId}/eligibility`, { creators }),
  sendInvitations:   (campaignId, setId, body) => api.post(`/campaigns/${campaignId}/sets/${setId}/invitations`, body),
  // creator-terms-v2 — what the brand can give a creator for this set (T2, T3, T4)
  offerChoices:      (campaignId, setId) => api.get(`/campaigns/${campaignId}/sets/${setId}/offer-choices`),
  productsWithoutOffersForSet: (campaignId, setId, params) => api.get(`/campaigns/${campaignId}/sets/${setId}/products-without-offers${params && Object.keys(params).length ? '?' + Object.entries(params).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&') : ''}`),
  invitationDetail:  (campaignId, setId, ciId) => api.get(`/campaigns/${campaignId}/sets/${setId}/invitations/${ciId}`),
  withdrawInvitation: (campaignId, setId, ciId) => api.post(`/campaigns/${campaignId}/sets/${setId}/invitations/${ciId}/withdraw`),
  removeInvitation:  (campaignId, setId, ciId) => api.post(`/campaigns/${campaignId}/sets/${setId}/invitations/${ciId}/remove`),

  // ── Item 6 · negotiation, the move request and the pool ───────────────────
  // Contract: features/item6-negotiation. All new; another brand's set is 404.
  brandThread:       (campaignId, setId, ciId) => api.get(`/campaigns/${campaignId}/sets/${setId}/invitations/${ciId}/thread`),
  brandAcceptCounter: (campaignId, setId, ciId) => api.post(`/campaigns/${campaignId}/sets/${setId}/invitations/${ciId}/thread/accept`),
  brandCounter:      (campaignId, setId, ciId, body) => api.post(`/campaigns/${campaignId}/sets/${setId}/invitations/${ciId}/thread/counter`, body),
  brandDeclineCounter: (campaignId, setId, ciId, body) => api.post(`/campaigns/${campaignId}/sets/${setId}/invitations/${ciId}/thread/decline`, body),
  answerMoveRequest: (campaignId, setId, ciId, answer) => api.post(`/campaigns/${campaignId}/sets/${setId}/invitations/${ciId}/move-answer`, { answer }),
  getPool:           (params) => api.get(`/brands/me/pool${q(params || {})}`),
  poolSetDefaults:   (entryIds) => api.post('/brands/me/pool/set-defaults', { entryIds }),
  removeFromPool:    (entryId) => api.delete(`/brands/me/pool/${entryId}`),

  // ── Item 7 · the agreement and the two signatures ─────────────────────────
  // Contract: features/item7-agreement. All new; another brand's set is 404.
  agreementPreview:  (campaignId, setId, ciId) => api.get(`/campaigns/${campaignId}/sets/${setId}/invitations/${ciId}/agreement/preview`),
  sendAgreement:     (campaignId, setId, ciId) => api.post(`/campaigns/${campaignId}/sets/${setId}/invitations/${ciId}/agreement/send`),
  getAgreement:      (campaignId, setId, ciId) => api.get(`/campaigns/${campaignId}/sets/${setId}/invitations/${ciId}/agreement`),
  agreementCost:     (campaignId, setId, ciId) => api.get(`/campaigns/${campaignId}/sets/${setId}/invitations/${ciId}/agreement/cost`),
  signAgreement:     (campaignId, setId, ciId, body) => api.post(`/campaigns/${campaignId}/sets/${setId}/invitations/${ciId}/agreement/sign`, body),
  withdrawAgreement: (campaignId, setId, ciId) => api.post(`/campaigns/${campaignId}/sets/${setId}/invitations/${ciId}/agreement/withdraw`),
  agreementDocument: (ciId) => api.get(`/agreements/${ciId}/document`),
  standardTerms:     (version) => api.get(version ? `/standard-terms/${version}` : '/standard-terms'),

  // ── Item 10 · the store visit. Contract: features/item10-store-visit ──────
  // Under item 7's paths. Every one is behind the §10 gate on the server. There
  // is no decline on the time thread — the route does not exist.
  getShoot:          (campaignId, setId, ciId) => api.get(`/campaigns/${campaignId}/sets/${setId}/invitations/${ciId}/shoot`),
  sendShootPlan:     (campaignId, setId, ciId, body) => api.post(`/campaigns/${campaignId}/sets/${setId}/invitations/${ciId}/shoot/plan`, body),
  counterShootTime:  (campaignId, setId, ciId, body) => api.post(`/campaigns/${campaignId}/sets/${setId}/invitations/${ciId}/shoot/thread/counter`, body),
  acceptShootTime:   (campaignId, setId, ciId) => api.post(`/campaigns/${campaignId}/sets/${setId}/invitations/${ciId}/shoot/thread/accept`),
  moveShoot:         (campaignId, setId, ciId, body) => api.post(`/campaigns/${campaignId}/sets/${setId}/invitations/${ciId}/shoot/move`, body),
  confirmShoot:      (campaignId, setId, ciId) => api.post(`/campaigns/${campaignId}/sets/${setId}/invitations/${ciId}/shoot/confirm`),

  // ── Item 11 · the Remote shoot, the brand's side. Contract: features/item11-remote ──
  // Every one is behind the §10 gate AND the mode check on the server. There is no decline
  // and no counter — a Remote shoot has nothing to negotiate; those routes do not exist.
  remote:            (c, s2, ciId) => api.get(`/campaigns/${c}/sets/${s2}/invitations/${ciId}/remote`),
  remoteProducts:    (c, s2, ciId, q) => api.get(`/campaigns/${c}/sets/${s2}/invitations/${ciId}/remote/products${q ? `?q=${encodeURIComponent(q)}` : ''}`),
  remoteSaveLines:   (c, s2, ciId, body) => api.put(`/campaigns/${c}/sets/${s2}/invitations/${ciId}/remote/lines`, body),
  remoteQuote:       (c, s2, ciId, body) => api.post(`/campaigns/${c}/sets/${s2}/invitations/${ciId}/remote/quote`, body),
  remoteBook:        (c, s2, ciId, body) => api.post(`/campaigns/${c}/sets/${s2}/invitations/${ciId}/remote/book`, body),
  remoteLabel:       (c, s2, ciId) => api.get(`/campaigns/${c}/sets/${s2}/invitations/${ciId}/remote/label`),
  remoteCancel:      (c, s2, ciId) => api.post(`/campaigns/${c}/sets/${s2}/invitations/${ciId}/remote/cancel`),
  remoteRebook:      (c, s2, ciId, body) => api.post(`/campaigns/${c}/sets/${s2}/invitations/${ciId}/remote/rebook`, body),
  remoteReport:      (c, s2, ciId, body) => api.post(`/campaigns/${c}/sets/${s2}/invitations/${ciId}/remote/report`, body),
  remoteAcknowledge: (c, s2, ciId) => api.post(`/campaigns/${c}/sets/${s2}/invitations/${ciId}/remote/acknowledge`),
  remoteGift:        (c, s2, ciId, lineId) => api.post(`/campaigns/${c}/sets/${s2}/invitations/${ciId}/remote/lines/${lineId}/gift`),
  remoteConfirmReturn: (c, s2, ciId, body) => api.post(`/campaigns/${c}/sets/${s2}/invitations/${ciId}/remote/return/confirm`, body),

  // ── Item 12 · the content step, the brand's side. Contract: features/item12-content ──
  content:           (c, s2, ciId) => api.get(`/campaigns/${c}/sets/${s2}/invitations/${ciId}/content`),
  contentApprove:    (c, s2, ciId, round) => api.post(`/campaigns/${c}/sets/${s2}/invitations/${ciId}/content/approve`, { round }),
  contentChanges:    (c, s2, ciId, body) => api.post(`/campaigns/${c}/sets/${s2}/invitations/${ciId}/content/changes`, body),
  contentConfirmLive: (c, s2, ciId, amount) => api.post(`/campaigns/${c}/sets/${s2}/invitations/${ciId}/content/confirm-live`, { amount }),
  contentReport:     (c, s2, ciId, body) => api.post(`/campaigns/${c}/sets/${s2}/invitations/${ciId}/content/report`, body),
  contentFileUrl:    (c, s2, ciId, fileId) => api.get(`/campaigns/${c}/sets/${s2}/invitations/${ciId}/content/files/${fileId}/url`),

  // ── Item 8 · the pitches a brand receives. Contract: features/item8-pitch ─
  // Accepting creates a pool entry and nothing else, which is why there is no
  // campaign or set in any of these paths.
  pitchInbox:       () => api.get('/brands/me/pitches'),
  pitch:            (id) => api.get(`/brands/me/pitches/${id}`),
  acceptPitch:      (id) => api.post(`/brands/me/pitches/${id}/accept`),
  rejectPitch:      (id, body) => api.post(`/brands/me/pitches/${id}/reject`, body),
  pitchThread:      (id) => api.get(`/brands/me/pitches/${id}/thread`),
  counterPitch:     (id, body) => api.post(`/brands/me/pitches/${id}/thread/counter`, body),

  // Places to search in — state, then city, each with a real count of creators who
  // are actually there. Only ever offers somewhere someone is.
  listCreatorLocations: () => api.get('/influencers/locations'),

  // Stage 1 — the negotiation history, the same page the creator reads.
  getRequestDiary:  (id) => api.get(`/collab-diary/request/${id}`),
  getPitchDiary:    (id) => api.get(`/collab-diary/proposal/${id}`),
  // Store preview — brand sees their store as customers see it
  getMyStorePreview: () => api.get('/brands/me/store-preview'),
  getWallet: () => api.get('/brands/me/wallet'),
  createTopup: (amount) => api.post('/brands/me/wallet/topup', { amount }),
  verifyTopup: (data) => api.post('/brands/me/wallet/topup/verify', data),
  getWalletTransactions: () => api.get('/brands/me/wallet/transactions'),
  // ── Item 4 · the Campaigns tab (campaigns and sets) ────────────────────────
  // Contract: features/item4-campaigns-sets. Read endpoints are new (another brand's campaign
  // is 404); create/update/delete/duplicate are the existing routes with the item 4 rules.
  campaignsSummary: (params) => api.get(`/campaigns/summary${q(params || {})}`),
  campaignSummary: (id) => api.get(`/campaigns/${id}/summary`),
  setSummary: (cid, sid) => api.get(`/campaigns/${cid}/sets/${sid}/summary`),
  duplicateSet: (cid, sid, data) => api.post(`/campaigns/${cid}/sets/${sid}/duplicate`, data),
  getCampaigns: () => api.get('/campaigns'),
  getCampaign: (id) => api.get(`/campaigns/${id}`),
  getCampaignLive: (id) => api.get(`/campaigns/${id}/live`),

  // ── Stage 2 · building a campaign from the phone ───────────────────────────
  // Contract: features/stage-2-build-a-campaign-from-the-phone
  // Every endpoint below already existed on the server — the app could list, publish and
  // end a campaign but had no way to CREATE one, so the Campaigns tab ended in a link
  // that opened the web dashboard. These are the five thin methods that were missing.
  //
  // stage-a — createCampaign takes a name and an optional note (brief) now; start_date is
  // no longer asked for on this screen. The server still accepts one from an older client.
  // createCampaign takes a name and a start date and NOTHING else. The server ignores any
  // budget or end date sent to it and derives both from the sets (Part 5), so sending
  // them would be a lie the screen tells itself.
  createCampaign: (data) => api.post('/campaigns', data),
  updateCampaign: (id, data) => api.patch(`/campaigns/${id}`, data),
  // set_budget is OMITTED for a paid set built on the phone: the server derives it from
  // the sum of that set's agreed fees and keeps it in step with every later invite.
  createCampaignSet: (campaignId, data) => api.post(`/campaigns/${campaignId}/sets`, data),
  updateCampaignSet: (campaignId, setId, data) => api.patch(`/campaigns/${campaignId}/sets/${setId}`, data),
  deleteCampaignSet: (campaignId, setId) => api.delete(`/campaigns/${campaignId}/sets/${setId}`),

  // What the Review screen shows BEFORE the brand presses Publish. The same evaluation
  // publish enforces, so the screen can never offer a button the server refuses.
  getPublishCheck: (id) => api.get(`/campaigns/${id}/publish-check`),
  // "What a shopper pays" — runs the shopping app's own offer resolver, so the preview
  // cannot disagree with the till.
  previewBasket: (data) => api.post('/campaigns/preview-basket', data),

  publishCampaign: (id) => api.post(`/campaigns/${id}/publish`),
  cancelCampaign: (id) => api.post(`/campaigns/${id}/cancel`),
  // collab-part5 — the deliberate finish (completes, not aborts). The only way to close
  // an open-ended sales campaign; refuses while a creator is owed money or awaits review.
  endCampaign: (id) => api.post(`/campaigns/${id}/end`),
  deleteCampaign: (id) => api.delete(`/campaigns/${id}`),
  // Item 12 (approval Q2, Q3): the deliverable review / confirm-live wrappers and `complete` are
  // gone with their retired routes. Content is reviewed and confirmed through content* below.
  getNegotiation: (id) => api.get(`/negotiations/${id}`),
  getNegotiationByCampaignInfluencer: (ciId) => api.get(`/negotiations/by-ci/${ciId}`),
  submitNegotiationTurn: (id, data) => api.post(`/negotiations/${id}/respond`, data),
  getCampaignEscrow: (campaignId) => api.get(`/brands/me/campaigns/${campaignId}/escrow`),
  // New: campaign-level rollups for the brand mobile detail screen
  getCampaignEngagement: (campaignId) => api.get(`/brands/me/campaigns/${campaignId}/engagement`),
  getCampaignConversions: (campaignId) => api.get(`/brands/me/campaigns/${campaignId}/conversions`),
  getCampaignAllProducts: (campaignId) => api.get(`/campaigns/${campaignId}/products`),
  cancelInfluencer: (campaignId, ciId) => api.post(`/campaigns/${campaignId}/influencers/${ciId}/cancel`),
  // Contracts (brand side)
  getContract:       (campaignInfluencerId) => api.get(`/contracts/${campaignInfluencerId}`),
  brandSign:         (id) => api.post(`/contracts/${id}/brand-sign`),
  approveContract:   (id, data) => api.post(`/contracts/${id}/approve`, data),
  getContractPdfUrl: (id) => api.get(`/contracts/${id}/pdf-url`),
  regenerateContractPdf: (id) => api.post(`/contracts/${id}/regenerate-pdf`),
  retryContractCreate:   (ciId) => api.post(`/contracts/by-ci/${ciId}/retry`),
  // Mass counter-sign and pending-contracts inbox feed
  listPendingContracts:  () => api.get('/contracts/brand/pending'),
  bulkSignContracts:     (ids) => api.post('/contracts/bulk-sign', { ids }),
  // Action-Required inbox feeds (one summary + 5 list endpoints)
  getInboxSummary:       () => api.get('/brands/me/inbox-summary'),
  listInboxNegotiations: (status = 'awaiting_brand') => api.get(`/brands/me/negotiations?status=${status}`),
  listInboxFailures:     () => api.get('/brands/me/failures'),
  listInboxApplications: () => api.get('/brands/me/applications'),
  // Open-group application review (brand picks from applicants)
  approveApplication:    (campaignId, ciId) => api.post(`/campaigns/${campaignId}/influencers/${ciId}/approve-application`),
  rejectApplication:     (campaignId, ciId) => api.post(`/campaigns/${campaignId}/influencers/${ciId}/reject-application`),
  getNotifications: () => api.get('/notifications'),
  markAllNotificationsRead: () => api.post('/notifications/read-all'),
  // Conversions — all follower transactions across every campaign (paginated,
  // filterable by type / campaign_id / influencer_id / status).
  listTransactions: (params) => api.get(`/brands/me/transactions${params ? '?' + new URLSearchParams(params) : ''}`),
  // Influencer discovery + invite (H.5)
  searchInfluencers: (params) => api.get(`/influencers/search${params ? '?' + new URLSearchParams(params) : ''}`),
  getInfluencer:     (id) => api.get(`/influencers/${id}`),
  inviteInfluencer:  (campaignId, setId, data) => api.post(`/campaigns/${campaignId}/sets/${setId}/invite`, data),
  getCampaignSets:   (campaignId) => api.get(`/campaigns/${campaignId}/sets`),
  // stage-a — the deferred pool (SB-24 "Moved out"). Migration 167.
  getDeferredCreators: (campaignId) => api.get(`/campaigns/${campaignId}/deferred`),

  // Production Coordination (Phase P) — brand side
  getProduction:               (contractId) => api.get(`/contracts/${contractId}/production`),
  getProductionDateRange:      (contractId) => api.get(`/contracts/${contractId}/production/date-range`),
  initialiseProduction:        (contractId, mode) => api.post(`/contracts/${contractId}/production/initialise`, { mode }),
  setProductionVisitDetails:   (contractId, data) => api.post(`/contracts/${contractId}/production/visit-details`, data),
  acceptProduction:            (eventId)         => api.post(`/production-events/${eventId}/accept`),
  counterProposeProduction:    (eventId, data)   => api.post(`/production-events/${eventId}/counter-propose`, data),
  flipProductionToRemote:      (eventId, data)   => api.post(`/production-events/${eventId}/flip-to-remote`, data || {}),
  dispatchProduction:          (eventId, data) => api.post(`/production-events/${eventId}/dispatch`, data),

  // stage-4 — the parcel. Before this a shipment knew it was sent and had no idea what was
  // in it, so "3 sarees" lived in a free-text note and nothing could reconcile it with what
  // she confirmed or what she later tagged in a post.
  getParcel:                   (eventId)         => api.get(`/production-events/${eventId}/items`),
  // stage-4 — every shoot across every campaign. The per-campaign roster answers the wrong
  // question: what is waiting on a brand is spread over whatever campaigns are running.
  listShoots:                  ()                => api.get('/brands/me/shoots'),
  addParcelItems:              (eventId, data)   => api.post(`/production-events/${eventId}/items`, data),
  removeParcelItem:            (eventId, itemId) => api.delete(`/production-events/${eventId}/items/${itemId}`),
  dropParcelItem:              (eventId, itemId) => api.post(`/production-events/${eventId}/items/${itemId}/drop`),

  // Proposals (Phase Q) — brand side
  getProposalSettings:    () => api.get('/brands/me/proposal-settings'),
  updateProposalSettings: (data) => api.patch('/brands/me/proposal-settings', data),
  listProposals:          (status) => api.get(`/brands/me/proposals${status ? `?status=${status}` : ''}`),
  getProposal:            (id) => api.get(`/brands/me/proposals/${id}`),
  acceptProposal:         (id) => api.post(`/brands/me/proposals/${id}/accept`),
  rejectProposal:         (id, message) => api.post(`/brands/me/proposals/${id}/reject`, { message }),
  counterProposal:        (id, terms, message) => api.post(`/brands/me/proposals/${id}/counter`, { counter_terms: terms, message }),

  // Media Gallery — brand asset library
  listMediaAssets:        (tag)   => api.get(`/brands/me/media-assets${tag ? `?tag=${encodeURIComponent(tag)}` : ''}`),
  getMediaUsage:          ()      => api.get('/brands/me/media-assets/usage'),
  getMediaUploadUrl:      (data)  => api.post('/brands/me/media-assets/upload-url', data),
  createMediaAsset:       (data)  => api.post('/brands/me/media-assets', data),
  getMediaDownloadUrl:    (id)    => api.get(`/brands/me/media-assets/${id}/download-url`),
  updateMediaAsset:       (id, d) => api.patch(`/brands/me/media-assets/${id}`, d),
  deleteMediaAsset:       (id)    => api.delete(`/brands/me/media-assets/${id}`),
  // Reference Links — URLs with no file storage
  listReferenceLinks:     ()      => api.get('/brands/me/reference-links'),
  createReferenceLink:    (data)  => api.post('/brands/me/reference-links', data),
  updateReferenceLink:    (id, d) => api.patch(`/brands/me/reference-links/${id}`, d),
  deleteReferenceLink:    (id)    => api.delete(`/brands/me/reference-links/${id}`),
  // Aggregate contracts
  listBrandContracts:     ()      => api.get('/brands/me/contracts'),

  // ── Brand mobile parity pack (contract: features/brand-mobile-parity-pack) ──
  // Bookings inbox
  listBookings:   (status) => api.get(`/brands/me/bookings${status ? `?status=${status}` : ''}`),
  confirmBooking: (id) => api.post(`/brands/me/bookings/${id}/confirm`),
  rejectBooking:  (id) => api.post(`/brands/me/bookings/${id}/reject`),
  // Offer library
  getOffers:           () => api.get('/brands/me/offers'),
  createOffer:         (data) => api.post('/brands/me/offers', data),
  updateOffer:         (id, data) => api.patch(`/brands/me/offers/${id}`, data),
  deleteOffer:         (id) => api.delete(`/brands/me/offers/${id}`),
  getOfferAttachments: (id) => api.get(`/brands/me/offers/${id}/attachments`),
  listProducts:        () => api.get('/brands/me/products'),
  // The brand's own slice of the listing tree, so a collaboration names a REAL category
  // instead of free text. Contract: features/collab-terms-by-aim (item 9)
  getListingTree:      () => api.get('/brands/me/listing-tree'),
  // Billing + subscription + payouts
  listInvoices:          () => api.get('/brands/me/billing/invoices?limit=100'),
  getSubscription:       () => api.get('/brands/me/subscription'),
  listSubscriptionTiers: () => api.get('/subscription-tiers'),
  getPayoutAccount:      () => api.get('/brands/me/payout-account'),
  createPayoutAccount:   () => api.post('/brands/me/payout-account'),
  // Influencer market analytics (read-only)
  getInfluencerAnalytics: (params) => api.get(`/influencers/analytics${params ? '?' + new URLSearchParams(params) : ''}`),
};

// Docs/THE_CUT.md pass 1 — agencyApi removed with the agency app. The server side
// (/agencies/*) is untouched and still answers; disconnecting it is pass 3, once
// nothing has been asking for a while. Production held zero agency accounts.

export const influencerApi = {
  register: (data) => api.post('/influencers/register', data),

  // Item 2 — Invitation settings (rules v1.10 §8A). Contract: features/item2-pitch-invitation-settings
  getInvitationSettings: () => api.get('/influencers/me/invitation-settings'),
  putInvitationSettings: (data) => api.put('/influencers/me/invitation-settings', data),
  // Item 3b — Your numbers (R3/R4/R5). Contract: features/item3b-social-numbers
  getMySocial:           () => api.get('/influencers/me/social'),
  getMySocialDetail:     (platform) => api.get(`/influencers/me/social/${platform}`),
  checkSocialAgain:      (platform) => api.post(`/influencers/me/social/${platform}/check-again`),
  listBlockedBrands:     () => api.get('/influencers/me/blocked-brands'),
  blockBrand:            (brandId) => api.post('/influencers/me/blocked-brands', { brandId }),
  unblockBrand:          (brandId) => api.delete(`/influencers/me/blocked-brands/${brandId}`),
  // X1/X2 / O1–O3 — a brand's overview as a creator sees it (carries pitchSummary + products).
  getBrandOverview:      (brandId) => api.get(`/brands/${brandId}/public`),
  // Item 3 — Find brands, brand products. Contract: features/item3-discovery-profiles-groups
  findBrands:            (params) => api.get(`/influencers/me/find-brands${q(params)}`),
  getBrandProducts:      (brandId, params) => api.get(`/brands/${brandId}/products${q(params)}`),
  getBrandProduct:       (brandId, productId) => api.get(`/brands/${brandId}/products/${productId}`),
  // B4 — My Store arranger
  getDiscoverLayout: () => api.get('/influencers/me/discover-layout'),
  putDiscoverLayout: (rows) => api.put('/influencers/me/discover-layout', { rows_json: rows }),
  getDiscoverOptions: () => api.get('/influencers/me/discover-options'),
  getMe: () => api.get('/influencers/me'),
  updateMe: (data) => api.patch('/influencers/me', data),
  // features/registration-and-profile — see brandApi.submitForReview.
  submitForReview: () => api.post('/influencers/me/submit-for-review'),
  // Her own photo — ask for a short-lived link, PUT the file, then save the key.
  // Contract: features/creator-photo-and-reach
  getProfileImageUploadUrl: (body) => api.post('/influencers/me/profile-image/upload-url', body),
  getEarnings: () => api.get('/influencers/me/earnings'),
  // Creator posts (Post/Concept P2) — the Post Composer + My Posts
  getListingTree: (vertical = 'fashion') => api.get(`/listing/tree?vertical=${encodeURIComponent(vertical)}`),
  getPostScope: () => api.get('/influencers/me/post-scope'),
  postPicker: (data) => api.post('/influencers/me/posts/picker', data),
  getPostUploadUrl: (data) => api.post('/influencers/me/posts/upload-url', data),
  createPost: (data) => api.post('/influencers/me/posts', data),
  getMyPosts: (status) => api.get(`/influencers/me/posts${status ? `?status=${status}` : ''}`),
  // ── Item 5 · my invitations (I11–I15). Contract: features/item5-invitations ──
  myInvitations:     (tab) => api.get(`/influencers/me/invitations${tab ? `?tab=${encodeURIComponent(tab)}` : ''}`),
  myInvitation:      (id) => api.get(`/influencers/me/invitations/${id}`),
  // creator-terms-v2 — what she can sell, read-only (C2) and one offer (C3)
  mySell:            (ciId) => api.get(`/influencers/me/invitations/${ciId}/sell`),
  myOffer:           (ciId, offerId) => api.get(`/influencers/me/invitations/${ciId}/offers/${offerId}`),
  acceptInvitation:  (id) => api.post(`/influencers/me/invitations/${id}/accept`),
  declineInvitation: (id, body) => api.post(`/influencers/me/invitations/${id}/decline`, body),
  // ── Item 6 · countering, the move request and the pool. Contract: features/item6-negotiation ──
  myThread:            (id) => api.get(`/influencers/me/invitations/${id}/thread`),
  counterInvitation:   (id, body) => api.post(`/influencers/me/invitations/${id}/counter`, body),
  requestMove:         (id, body) => api.post(`/influencers/me/invitations/${id}/move-request`, body),
  acceptCounter:       (id) => api.post(`/influencers/me/invitations/${id}/thread/accept`),
  declineCounter:      (id, body) => api.post(`/influencers/me/invitations/${id}/thread/decline`, body),
  myPool:              () => api.get('/influencers/me/pool'),
  leavePool:           (entryId) => api.delete(`/influencers/me/pool/${entryId}`),
  // ── Item 7 · the agreement. Contract: features/item7-agreement ────────────
  myAgreement:         (id) => api.get(`/influencers/me/invitations/${id}/agreement`),
  signMyAgreement:     (id, body) => api.post(`/influencers/me/invitations/${id}/agreement/sign`, body),
  declineMyAgreement:  (id, body) => api.post(`/influencers/me/invitations/${id}/agreement/decline`, body),
  myAgreementDocument: (id) => api.get(`/agreements/${id}/document`),
  standardTerms:       (version) => api.get(version ? `/standard-terms/${version}` : '/standard-terms'),

  // ── Item 10 · her store visit. Contract: features/item10-store-visit ──────
  myShoot:            (id) => api.get(`/influencers/me/invitations/${id}/shoot`),
  acceptMyShootTime:  (id) => api.post(`/influencers/me/invitations/${id}/shoot/accept`),
  counterMyShootTime: (id, body) => api.post(`/influencers/me/invitations/${id}/shoot/thread/counter`, body),
  acceptMyShootCounter: (id) => api.post(`/influencers/me/invitations/${id}/shoot/thread/accept`),
  moveMyShoot:        (id, body) => api.post(`/influencers/me/invitations/${id}/shoot/move`, body),
  markAttended:       (id) => api.post(`/influencers/me/invitations/${id}/shoot/attended`),

  // ── Item 11 · the Remote shoot, her side. Contract: features/item11-remote ──
  // SHE MOVES FIRST: until the address is sent the brand has nothing to do (rules §11.2).
  myRemote:           (id) => api.get(`/influencers/me/invitations/${id}/remote`),
  myRemoteCoverage:   (id, pincode) => api.post(`/influencers/me/invitations/${id}/remote/coverage`, { pincode }),
  myRemoteAddress:    (id, body) => api.post(`/influencers/me/invitations/${id}/remote/address`, body),
  myRemoteCorrect:    (id, body) => api.post(`/influencers/me/invitations/${id}/remote/address/correct`, body),
  myRemoteCheck:      (id, body) => api.post(`/influencers/me/invitations/${id}/remote/check`, body),
  myRemoteDone:       (id) => api.post(`/influencers/me/invitations/${id}/remote/done`),
  myRemoteBookReturn: (id, body) => api.post(`/influencers/me/invitations/${id}/remote/return/book`, body),
  myRemoteSelfSent:   (id, body) => api.post(`/influencers/me/invitations/${id}/remote/return/sent`, body),

  // ── Item 12 · the content step, her side. Contract: features/item12-content ──
  // Files go STRAIGHT to storage (uploadContentFile below); these four only ask, confirm,
  // remove and view. Every one is behind the content gate on the server.
  myContent:          (id) => api.get(`/influencers/me/invitations/${id}/content`),
  contentCaption:     (id, rowKey, caption) => api.put(`/influencers/me/invitations/${id}/content/rows/${rowKey}/caption`, { caption }),
  contentSubmit:      (id, round) => api.post(`/influencers/me/invitations/${id}/content/submit`, { round }),
  contentSetProof:    (id, rowKey, slot, body) => api.put(`/influencers/me/invitations/${id}/content/proofs/${rowKey}/${slot}`, body),
  contentClearProof:  (id, rowKey, slot) => api.delete(`/influencers/me/invitations/${id}/content/proofs/${rowKey}/${slot}`),
  contentPosted:      (id) => api.post(`/influencers/me/invitations/${id}/content/posted`),
  contentReport:      (id, body) => api.post(`/influencers/me/invitations/${id}/content/report`, body),
  contentUploadUrl:   (id, body) => api.post(`/influencers/me/invitations/${id}/content/files/upload-url`, body),
  contentConfirmFile: (id, fileId) => api.post(`/influencers/me/invitations/${id}/content/files/${fileId}/confirm`),
  contentRemoveFile:  (id, fileId) => api.delete(`/influencers/me/invitations/${id}/content/files/${fileId}`),
  contentFileUrl:     (id, fileId) => api.get(`/influencers/me/invitations/${id}/content/files/${fileId}/url`),
  // Phase 2b — the device proof. 404 unless the server's CONTENT_UPLOAD_PROBE switch is on.
  uploadProbeStatus:  () => api.get('/influencers/me/upload-probe'),
  uploadProbeUrl:     (body) => api.post('/influencers/me/upload-probe/url', body),
  uploadProbeConfirm: (body) => api.post('/influencers/me/upload-probe/confirm', body),

  // ── Item 8 · her pitch. Contract: features/item8-pitch ────────────────────
  // The thread is item 6's engine on a different anchor, so these four mirror
  // the invitation ones exactly.
  pitchForm:        (brandId) => api.get(`/influencers/me/pitches/form/${brandId}`),
  myPitches:        () => api.get('/influencers/me/pitches'),
  sendPitch:        (body) => api.post('/influencers/me/pitches', body),
  myPitch:          (id) => api.get(`/influencers/me/pitches/${id}`),
  withdrawPitch:    (id) => api.post(`/influencers/me/pitches/${id}/withdraw`),
  myPitchThread:    (id) => api.get(`/influencers/me/pitches/${id}/thread`),
  counterMyPitch:   (id, body) => api.post(`/influencers/me/pitches/${id}/thread/counter`, body),
  acceptMyPitch:    (id) => api.post(`/influencers/me/pitches/${id}/thread/accept`),
  declineMyPitch:   (id, body) => api.post(`/influencers/me/pitches/${id}/thread/decline`, body),
  getOffers: (status) => api.get(`/offers/inbox${status ? `?status=${status}` : ''}`),
  getOfferDetail: (id) => api.get(`/offers/${id}`),
  acceptOffer: (id) => api.post(`/offers/${id}/accept`),
  declineOffer: (id, data) => api.post(`/offers/${id}/decline`, data),
  // stage-a — a reservation about the set's fixed day/shoot, not a decline. Migration 167.
  deferOffer: (id, data) => api.post(`/offers/${id}/defer`, data),
  negotiateOffer: (id, data) => api.post(`/offers/${id}/negotiate`, data),
  getNegotiation: (id) => api.get(`/negotiations/${id}`),
  getNegotiationByCampaignInfluencer: (ciId) => api.get(`/negotiations/by-ci/${ciId}`),
  submitNegotiationTurn: (id, data) => api.post(`/negotiations/${id}/respond`, data),
  getDeliverables: () => api.get('/campaigns'),  // via campaign list
  refreshStats: (id) => api.post(`/deliverables/${id}/refresh-stats`),
  getContractWithDeliverables: (campaignInfluencerId) => api.get(`/contracts/${campaignInfluencerId}`),
  getContract: (id) => api.get(`/contracts/${id}`),
  signContract: (id, data) => api.post(`/contracts/${id}/sign`, data),
  getContractPdfUrl: (id) => api.get(`/contracts/${id}/pdf-url`),
  getMyCampaigns: (status) => api.get(`/influencers/me/campaigns${status ? `?status=${status}` : ''}`),
  getMyCampaignDetail: (ciId) => api.get(`/influencers/me/campaigns/${ciId}`),
  getCommissions: () => api.get('/influencers/me/commissions'),
  getCampaignEarnings: () => api.get('/influencers/me/commissions/by-campaign'),
  getCampaignCommissionDetail: (ciId) => api.get(`/influencers/me/commissions/campaign/${ciId}`),
  withdraw: (data) => api.post('/influencers/me/withdraw', data),
  getWithdrawals: () => api.get('/influencers/me/withdrawals'),
  retryWithdrawal: (id) => api.post(`/influencers/me/withdrawals/${id}/retry`),
  getTdsCertificateUrl: (fy) => `${API_BASE_URL}/influencers/me/tds-certificate${fy ? `?fy=${fy}` : ''}`,
  getNotifications: () => api.get('/notifications'),
  markAllNotificationsRead: () => api.post('/notifications/read-all'),
  getBrandPublicProfile: (brandId) => api.get(`/brands/${brandId}/public`),
  listMyContracts: () => api.get('/influencers/me/contracts'),

  // Production Coordination (Phase P) — influencer side
  getProduction:                (contractId) => api.get(`/contracts/${contractId}/production`),
  getProductionDateRange:       (contractId) => api.get(`/contracts/${contractId}/production/date-range`),
  proposeProductionSlot:        (eventId, data)   => api.post(`/production-events/${eventId}/propose-slot`, data),
  acceptProduction:             (eventId)         => api.post(`/production-events/${eventId}/accept`),
  counterProposeProduction:     (eventId, data)   => api.post(`/production-events/${eventId}/counter-propose`, data),
  confirmProductionReceived:    (eventId, data)   => api.post(`/production-events/${eventId}/confirm-received`, data),

  // stage-4 — she reads the parcel so she can confirm it item by item. Read-only on her side:
  // what is in the box is the brand's statement, and her answer is a separate verb.
  getParcel:                    (eventId)         => api.get(`/production-events/${eventId}/items`),
  flipProductionToRemote:       (eventId, data)   => api.post(`/production-events/${eventId}/flip-to-remote`, data || {}),

  // Proposals (Phase Q)
  // collab-part6 §6.2 — industry and city were always in the response and never
  // filterable, so a creator looking for fashion brands in their city had to scroll.
  discoverBrands: (search, category, city) => {
    const qs = [];
    if (search) qs.push(`search=${encodeURIComponent(search)}`);
    if (category) qs.push(`category=${encodeURIComponent(category)}`);
    if (city) qs.push(`city=${encodeURIComponent(city)}`);
    return api.get(`/influencers/me/discover-brands${qs.length ? `?${qs.join('&')}` : ''}`);
  },
  getBrandProposalCriteria: (brandId) => api.get(`/brands/${brandId}/proposal-criteria`),
  createProposal:           (data) => api.post('/influencers/me/proposals', data),
  listMyProposals:          (status) => api.get(`/influencers/me/proposals${status ? `?status=${status}` : ''}`),
  getMyProposal:            (id) => api.get(`/influencers/me/proposals/${id}`),
  withdrawProposal:         (id) => api.post(`/influencers/me/proposals/${id}/withdraw`),
  respondCounter:           (id, action) => api.post(`/influencers/me/proposals/${id}/respond-counter`, { action }),

  // collab-part2 — the pre-campaign handshake, creator side. Brands can now ask YOU;
  // these are the inbox, the responses, the mute/bar, and your agreements.
  // Stage 0 built this; Stage 1 is the first thing to read it. One count, computed on
  // the server, so her badge and the brand's can never disagree about the same work.
  getNeedsYou:            () => api.get('/influencers/me/needs-you'),
  // Stage 1 — the negotiation history, the same page both sides see.
  getRequestDiary:        (id) => api.get(`/collab-diary/request/${id}`),
  getPitchDiary:          (id) => api.get(`/collab-diary/proposal/${id}`),
  // Stage 1 — her counter on her OWN pitch. The route shipped long ago and no client
  // has ever called it, so her only replies were accept or walk away.
  counterMyProposal:      (id, terms, message) => api.post(`/influencers/me/proposals/${id}/counter`, { counter_terms: terms, message }),

  // Store preview — see what followers see
  getMyStorePreview: () => api.get('/influencers/me/store-preview'),

  // Store stocking — shelve products from contracted brands (contract-gated server-side)
  getStockable:    () => api.get('/influencers/me/store/stockable'),
  getMyStoreItems: () => api.get('/influencers/me/store/items'),
  stockItem:       (data) => api.post('/influencers/me/store/items', data),
  unstockItem:     (id) => api.delete(`/influencers/me/store/items/${id}`),

  // Transaction feed — see all follower purchases
  getMyTransactions: (page = 1, campaignId = null) => {
    const p = [`page=${page}`];
    if (campaignId) p.push(`campaign_id=${campaignId}`);
    return api.get(`/influencers/me/transactions?${p.join('&')}`);
  },

  // Product notes — publish products to influencer store
  getCampaignProducts: (campaignId) => api.get(`/influencers/me/campaigns/${campaignId}/products`),
  upsertProductNote: (data) => api.post('/influencers/me/product-notes', data),
  getProductNotes: (campaignId) => api.get(`/influencers/me/product-notes/${campaignId}`),
  deleteProductNote: (noteId) => api.delete(`/influencers/me/product-notes/${noteId}`),
};

/**
 * Upload a file to the backend (mock mode) or R2 (production).
 * Returns { success, key } on success.
 */
export async function uploadFile(uploadUrl, method, fileUri, filename, contentType, key, onProgress) {
  const token = await getToken();

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    if (onProgress) {
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) onProgress(e.loaded / e.total);
      });
    }

    xhr.addEventListener('load', () => {
      try {
        const json = JSON.parse(xhr.responseText);
        resolve(json);
      } catch {
        resolve({ success: xhr.status >= 200 && xhr.status < 300, key });
      }
    });

    xhr.addEventListener('error', () => {
      reject(new Error('Upload failed — network error'));
    });

    xhr.addEventListener('timeout', () => {
      reject(new Error('Upload timed out'));
    });

    xhr.timeout = 300000; // 5 min for large videos

    if (method === 'POST') {
      // Mock mode: multipart form-data to our backend
      xhr.open('POST', uploadUrl);
      if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);

      const formData = new FormData();
      formData.append('key', key);
      formData.append('file', {
        uri: fileUri,
        type: contentType,
        name: filename,
      });
      xhr.send(formData);
    } else {
      // Production: PUT raw body to R2 presigned URL
      xhr.open('PUT', uploadUrl);
      xhr.setRequestHeader('Content-Type', contentType);
      // For presigned URLs, we need to send the raw file
      fetch(fileUri)
        .then(r => r.blob())
        .then(blob => xhr.send(blob))
        .catch(reject);
    }
  });
}


/**
 * Item 12 (Phase 2b) — send one file STRAIGHT to storage with the URL the server signed.
 * Contract: features/item12-content · gap report §6 · approval §3.8, check 45
 *
 * Why not uploadFile above: it reads the whole file into memory as a Blob before sending, which
 * at 200 MB is an out-of-memory crash, and it stops at 5 minutes. Here the body is `{ uri }`:
 * React Native's own networking STREAMS it from disk (RequestBodyUtil → Okio), sends the file's
 * real length as Content-Length, and reports progress. No native module — OTA-safe.
 *
 * The URL signs Content-Length and Content-Type, so storage refuses anything but the exact file
 * the server approved. No Authorization header: the signature is the permission.
 *
 * @param {{url:string, method?:string, headers:Object}} upload — from contentUploadUrl
 * @param {string} fileUri — the picker's file:// copy
 * @returns {Promise<{ok:true}>} — rejects with .code UPLOAD_REJECTED | UPLOAD_NETWORK | UPLOAD_TIMEOUT
 */
export function uploadContentFile(upload, fileUri, { onProgress, timeoutMs = 45 * 60 * 1000 } = {}) {
  return new Promise((resolve, reject) => {
    const fail = (code, extra = {}) => reject(Object.assign(new Error(code), { code, ...extra }));
    const xhr = new XMLHttpRequest();
    xhr.open(upload.method || 'PUT', upload.url);
    const headers = upload.headers || {};
    Object.keys(headers).forEach((k) => xhr.setRequestHeader(k, headers[k]));
    xhr.timeout = timeoutMs;
    if (onProgress && xhr.upload) {
      xhr.upload.onprogress = (e) => { if (e && e.lengthComputable && e.total) onProgress(e.loaded / e.total); };
    }
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300
      ? resolve({ ok: true })
      : fail('UPLOAD_REJECTED', { status: xhr.status, body: String(xhr.responseText || '').slice(0, 500) }));
    xhr.onerror = () => fail('UPLOAD_NETWORK');
    xhr.ontimeout = () => fail('UPLOAD_TIMEOUT');
    xhr.send({ uri: fileUri, type: headers['Content-Type'], name: 'upload' });
  });
}

// Item 2 — reference lists every picker reads (any signed-in role).
const q = (params = {}) => { const p = Object.entries(params).filter(([, v]) => v != null && v !== '' && !(Array.isArray(v) && v.length === 0)).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(Array.isArray(v) ? v.join(',') : v)}`); return p.length ? `?${p.join('&')}` : ''; };

export const referenceApi = {
  // features/registration-and-profile — Google Places left address entry. The brand and creator
  // apps pick State then City from the offered lists (six southern states, 146 cities). The
  // follower app's own place search lives on followerApi and is untouched.
  offeredStates:      () => api.get('/reference/states?offered=1'),
  citiesByIds:        (ids) => api.get(`/reference/cities${q({ ids })}`),
  creatorNiches:   () => api.get('/reference/creator-niches'),
  languages:       () => api.get('/reference/languages'),
  brandCategories: () => api.get('/reference/brand-categories'),
  states:          () => api.get('/reference/states'),
};

export const followerApi = {
  // Profile
  getMe: () => api.get('/followers/me'),
  updateMe: (data) => api.patch('/followers/me', data),

  // Stage B3 — resolved Discover payload (global | business | creator)
  getDiscover: (params = {}) => {
    const p = Object.entries(params).filter(([, v]) => v != null)
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`);
    return api.get(`/follower/discover${p.length ? `?${p.join('&')}` : ''}`);
  },
  // Creator posts (Post/Concept Stage A) — the new source of truth
  getPosts: (params = {}) => {
    const p = Object.entries(params).filter(([, v]) => v != null)
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`);
    return api.get(`/follower/posts${p.length ? `?${p.join('&')}` : ''}`);
  },
  getPost: (id) => api.get(`/follower/posts/${id}`),
  likePost: (id) => api.post(`/follower/posts/${id}/like`),
  unlikePost: (id) => api.delete(`/follower/posts/${id}/like`),
  savePost: (id) => api.post(`/follower/posts/${id}/save`),
  unsavePost: (id) => api.delete(`/follower/posts/${id}/save`),
  // Slice 1 (features/follower-profile-repairs) — post_saves had no reader:
  // a follower could save a post and never find it again.
  getSavedPosts: () => api.get('/follower/posts/saved'),
  // Slice 0 (features/follower-event-log) — batched behaviour log. Called only
  // by services/events.js; never awaited on a render path.
  postEvents: (body) => api.post('/follower/events', body),
  getAppConfig: () => api.get('/follower/app-config'),

  // P5 (section-analytics-city) — fire-and-forget engagement capture. Never
  // awaited by callers, never throws: a dead endpoint can't affect the UX.
  recordSectionEvent: (data) => { try { api.post('/follower/section-event', data).catch(() => {}); } catch (e) { /* never surfaces */ } },

  // Feed (legacy + new) — all accept optional lat/lng for distance
  getFeed: () => api.get('/followers/feed'),
  getHomeFeed: (page = 1, loc = null) => {
    const p = [`page=${page}`];
    if (loc?.latitude) p.push(`lat=${loc.latitude}`, `lng=${loc.longitude}`);
    return api.get(`/follower/home-feed?${p.join('&')}`);
  },
  getDeals: (category = 'all', page = 1, loc = null) => {
    const p = [`category=${category}`, `page=${page}`];
    if (loc?.latitude) p.push(`lat=${loc.latitude}`, `lng=${loc.longitude}`);
    return api.get(`/follower/deals?${p.join('&')}`);
  },

  // Section Engine — backend-driven { sections:[…] } feeds (Creator Vibe, Phase C).
  // Consumed by <SectionRenderer>; gated by config/featureFlags SECTION_ENGINE_HOME.
  getHomeSections: (loc = null) => {
    const p = [];
    if (loc?.latitude) p.push(`lat=${loc.latitude}`, `lng=${loc.longitude}`);
    const qs = p.length ? `?${p.join('&')}` : '';
    return api.get(`/follower/home${qs}`);
  },
  getCreatorSections: (handle) => api.get(`/follower/section/creator/${encodeURIComponent(handle)}`),
  getCreatorCategorySections: (handle, cat) =>
    api.get(`/follower/section/creator/${encodeURIComponent(handle)}/category/${encodeURIComponent(cat)}`),
  getCategorySections: (key, loc = null) => {
    const p = [];
    if (loc?.latitude) p.push(`lat=${loc.latitude}`, `lng=${loc.longitude}`);
    const qs = p.length ? `?${p.join('&')}` : '';
    return api.get(`/follower/section/category/${encodeURIComponent(key)}${qs}`);
  },
  // App Builder Phase 4 — the business page's admin-composed section stack.
  getBusinessSections: (brandId, loc = null) => {
    const p = [];
    if (loc?.latitude) p.push(`lat=${loc.latitude}`, `lng=${loc.longitude}`);
    const qs = p.length ? `?${p.join('&')}` : '';
    return api.get(`/follower/business/${encodeURIComponent(brandId)}/sections${qs}`);
  },
  getOffersSections: (loc = null) => {
    const p = [];
    if (loc?.latitude) p.push(`lat=${loc.latitude}`, `lng=${loc.longitude}`);
    const qs = p.length ? `?${p.join('&')}` : '';
    return api.get(`/follower/section/offers${qs}`);
  },
  // App Builder E — an admin-created GLOBAL custom page rendered as a section
  // stack. Returns { page:{label,title,subtitle}|null, sections:[…] }.
  getPageSections: (pageKey, loc = null) => {
    const p = [];
    if (loc?.latitude) p.push(`lat=${loc.latitude}`, `lng=${loc.longitude}`);
    const qs = p.length ? `?${p.join('&')}` : '';
    return api.get(`/follower/page/${encodeURIComponent(pageKey)}/sections${qs}`);
  },
  // Shared "View all" full list for one shelf's rule (merch-engine-results-view-all).
  getSectionResults: (opts = {}) => {
    const p = [];
    const add = (k, v) => { if (v != null && v !== '') p.push(`${k}=${encodeURIComponent(v)}`); };
    add('rule', opts.rule);
    add('item_type', opts.item_type);
    add('library_section_id', opts.library_section_id);
    if (opts.rule_json && typeof opts.rule_json === 'object') add('rule_json', JSON.stringify(opts.rule_json));
    add('category_key', opts.category_key);
    add('creator_handle', opts.creator_handle);
    add('brand_id', opts.brand_id);
    if (opts.lat != null) { add('lat', opts.lat); add('lng', opts.lng); }
    add('limit', opts.limit);
    return api.get(`/follower/section-results?${p.join('&')}`);
  },

  // Category browser (Type-1) — contract: listing-category-browser.
  // children = the sidebar rail; products = the grid + aggregated filter values.
  listingNodeChildren: (id) => api.get(`/listing/nodes/${encodeURIComponent(id)}/children`),
  listingNodeProducts: (id, opts = {}) => {
    const p = [];
    const add = (k, v) => { if (v != null && v !== '') p.push(`${k}=${encodeURIComponent(v)}`); };
    if (opts.filters) {
      for (const [k, vals] of Object.entries(opts.filters)) {
        if (Array.isArray(vals) && vals.length) add(`f_${k}`, vals.join(','));
      }
    }
    add('price_min', opts.price_min); add('price_max', opts.price_max);
    add('sort', opts.sort); add('page', opts.page); add('page_size', opts.page_size);
    add('q', opts.q);
    return api.get(`/listing/nodes/${encodeURIComponent(id)}/products${p.length ? `?${p.join('&')}` : ''}`);
  },
  listingTree: (vertical) => api.get(`/listing/tree?vertical=${encodeURIComponent(vertical)}`),
  // "You might also like" at checkout — same-category cross-sell, excluding cart items.
  getCartRecommendations: (productIds, limit = 8) =>
    api.get(`/follower/cart-recommendations?product_ids=${encodeURIComponent((productIds || []).join(','))}&limit=${limit}`),

  // Listing Engine — new endpoints
  getStories: () => api.get('/follower/stories'),
  getCategories: () => api.get('/follower/categories'),
  getVerticals: () => api.get('/follower/verticals'), // v2 home: world tabs + category rails
  getCategoryStores: (superCategory, opts = {}) => {
    const params = [];
    if (opts.sub_category) params.push(`sub_category=${opts.sub_category}`);
    if (opts.page) params.push(`page=${opts.page}`);
    if (opts.sort) params.push(`sort=${opts.sort}`);
    if (opts.lat) params.push(`lat=${opts.lat}`, `lng=${opts.lng}`);
    const qs = params.length ? `?${params.join('&')}` : '';
    return api.get(`/category/${superCategory}/stores${qs}`);
  },

  // Store
  getStore: (handle) => api.get(`/store/${handle}`),
  getStoreProducts: (handle, scope) => {
    // scope can be a string (legacy: treated as offerId) OR an object
    // { offerId, ciId }. Either offerId or ciId is required by the backend;
    // ciId is preferred for conversion campaigns which have no
    // campaign_offers row.
    const s = typeof scope === 'string' ? { offerId: scope } : (scope || {});
    const qs = [];
    if (s.offerId) qs.push(`offer_id=${s.offerId}`);
    if (s.ciId)    qs.push(`ci_id=${s.ciId}`);
    return api.get(`/store/${handle}/products${qs.length ? `?${qs.join('&')}` : ''}`);
  },
  // Library-offer detail (store-direct / showcase taps — no creator handle).
  // Contract: features/sprint1-offer-pipeline.
  getStoreOffer: (brandOfferId) => api.get(`/follower/store-offer/${brandOfferId}`),
  // Full single-product detail for the PDP (description, facets, images, variants).
  getProductDetail: (productId) => api.get(`/follower/products/${productId}`),

  // Food World 3C-1 — dish-group discovery. Rail tiles + tap → nearby restaurants
  // serving any dish in the group (mig 115; lat/lng optional → distance ranking).
  // Cleanup 2026-06-22 — craving rail driven by Home-Builder category tiles.
  // Restaurants serving a category tile (by name; reuses a same-named dish_group
  // for precise matching server-side, else keyword match).
  // Phase Salon-2 — accepts an optional viaInfluencerId so the response
  // embeds a `creator` object the BrandStoreScreen sticky header renders.
  getBrandStore: (brandId, viaInfluencerId = null) => {
    const qs = viaInfluencerId ? `?via=${encodeURIComponent(viaInfluencerId)}` : '';
    return api.get(`/business/${brandId}/store${qs}`);
  },

  // Location — store device/selected coords; returns reverse-geocoded { area_name }.
  updateLocation: (lat, lng) => api.post('/follower/location', { lat, lng }),
  // Public reverse-geocode for the location switcher's "current location" label.
  reverseGeocode: (lat, lng) => api.get(`/follower/reverse-geocode?lat=${lat}&lng=${lng}`),
  // Forward-geocode (verify/locate a typed address before saving it).
  geocodeAddress: (q) => api.get(`/follower/geocode?q=${encodeURIComponent(q)}`),
  // Places Autocomplete + Details (Swiggy-style area search).
  placesAutocomplete: (q, { session, lat, lng } = {}) => {
    const p = [`q=${encodeURIComponent(q)}`];
    if (session) p.push(`session=${encodeURIComponent(session)}`);
    if (lat != null && lng != null) p.push(`lat=${lat}`, `lng=${lng}`);
    return api.get(`/follower/places/autocomplete?${p.join('&')}`);
  },
  placeDetails: (placeId, session) =>
    api.get(`/follower/places/details?place_id=${encodeURIComponent(placeId)}${session ? `&session=${encodeURIComponent(session)}` : ''}`),

  // Follow
  follow: (id) => api.post('/followers/follows', { influencer_id: id }),
  unfollow: (id) => api.delete(`/followers/follows/${id}`),
  getFollowing: () => api.get('/follower/following'),

  // Saved offers
  saveOffer: (offer_id, influencer_id) => api.post('/follower/saved', { offer_id, influencer_id }),
  unsaveOffer: (offer_id) => api.delete(`/follower/saved/${offer_id}`),
  getSavedOffers: () => api.get('/follower/saved'),

  // Fashion-1 — Returns workflow (customer side)
  initiateReturn: (data) => api.post('/follower/returns', data),
  listMyReturns: () => api.get('/follower/returns'),
  getMyReturn: (id) => api.get(`/follower/returns/${id}`),


  // Transactions
  payAtStore: (data) => api.post('/follower/pay-at-store', data),
  verifyPayAtStore: (data) => api.post('/follower/pay-at-store/verify', data),
  // Offer Engine D3 — store-direct (brand-direct) buy: no influencer, no commission
  storeOfferPay: (data) => api.post('/follower/store-offer/pay', data),
  storeOfferVerify: (data) => api.post('/follower/store-offer/verify', data),
  prebook: (data) => api.post('/follower/prebook', data),
  prebookVerify: (data) => api.post('/follower/prebook/verify', data),
  getSlots: (productId, date) => api.get(`/follower/slots?offer_id=${encodeURIComponent(productId)}&date=${encodeURIComponent(date)}`),
  // Date-range pre-bookings (car_rental today; hotels/function_hall later).
  // Body shape: { offer_id?, campaign_id, set_id, campaign_influencer_id,
  //               pickup_date, return_date, duration_days, pickup_type }
  prebookDateRange: (data) => api.post('/follower/prebook-daterange', data),
  prebookDateRangeVerify: (data) => api.post('/follower/prebook-daterange/verify', data),
  // follower-creator-attribution Slice 2 — resolve a creator coupon code →
  // creator + allocated products (apply discount + attribution without a link).
  resolveCoupon: (code) => api.post('/follower/resolve-coupon', { code }),
  // Slice 5 (Way-4) — "click opens window": record an attribution touch when a
  // follower lands in a creator store via a tracked link.
  recordTouch: (data) => api.post('/follower/touch', data),
  // Offer cart preview (Phase 2) — real discount + free-item adjustments for a
  // cart BEFORE checkout (same engine as createOrder, no order created).
  previewCartOffer: (data) => api.post('/follower/cart/price', data),
  createOrder: (data) => api.post('/follower/orders', data),
  verifyOrder: (data) => api.post('/follower/orders/verify', data),
  getOrder: (id) => api.get(`/follower/orders/${id}`),
  getOrders: () => api.get('/follower/orders'),
  cancelOrder: (id) => api.post(`/follower/orders/${id}/cancel`),
  getActivity: () => api.get('/follower/activity'),

  // Addresses
  getAddresses: () => api.get('/followers/addresses'),
  addAddress: (data) => api.post('/followers/addresses', data),
  // Slice 1 — soft delete server-side; past orders keep their address.
  deleteAddress: (id) => api.delete(`/followers/addresses/${id}`),
  // Wishlist + collections (Stage C2)
  getWishlist: () => api.get('/followers/wishlist'),
  wishlistAdd: (productId) => api.post('/followers/wishlist/items', { product_id: productId }),
  wishlistRemove: (productId) => api.delete(`/followers/wishlist/items/${productId}`),
  wishlistCreateCollection: (name) => api.post('/followers/wishlist/collections', { name }),
  wishlistRenameCollection: (id, name) => api.patch(`/followers/wishlist/collections/${id}`, { name }),
  wishlistDeleteCollection: (id) => api.delete(`/followers/wishlist/collections/${id}`),
  wishlistAssign: (collectionId, productId) => api.post(`/followers/wishlist/collections/${collectionId}/items`, { product_id: productId }),
  wishlistUnassign: (collectionId, productId) => api.delete(`/followers/wishlist/collections/${collectionId}/items/${productId}`),


  // Wave 5 — Reviews + ratings
  getBrandReviews: (brandId, opts = {}) => {
    const q = [`brand_id=${encodeURIComponent(brandId)}`];
    if (opts.creatorOnly) q.push('creator_only=true');
    if (opts.page) q.push(`page=${opts.page}`);
    return api.get(`/follower/reviews?${q.join('&')}`);
  },
  postReview: (data) => api.post('/follower/reviews', data),
  getReviewable: () => api.get('/follower/me/reviewable'),

  // Wave 5C — creators eating now (DiningHome social-proof strip)
  getCreatorsEatingNow: () => api.get('/follower/creators-eating-now'),


  // Path C-3 — working search
  search: (q, opts = {}) => {
    const p = [`q=${encodeURIComponent(q)}`, `super=${opts.super || 'eat'}`];
    if (opts.veg) p.push('veg=1');
    return api.get(`/follower/search?${p.join('&')}`);
  },
};
