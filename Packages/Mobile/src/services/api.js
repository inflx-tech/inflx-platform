import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../config/api';

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
}

// Single in-flight refresh promise so concurrent 401s don't trigger
// multiple parallel /auth/refresh calls. All callers await the same one.
let _refreshInFlight = null;

async function tryRefreshAccessToken() {
  if (_refreshInFlight) return _refreshInFlight;
  _refreshInFlight = (async () => {
    try {
      const rt = await getRefreshToken();
      if (!rt) return null;
      const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: rt }),
      });
      if (!res.ok) return null;
      const json = await res.json().catch(() => null);
      const newAccess  = json?.data?.access_token;
      const newRefresh = json?.data?.refresh_token;
      if (!newAccess) return null;
      await AsyncStorage.setItem('inflx_token', newAccess);
      // Backend rotates the refresh token on every refresh call. Persist the
      // new one so the 30-day clock resets — this is what keeps users
      // logged in indefinitely as long as they open the app at least once
      // every 30 days.
      if (newRefresh) {
        await AsyncStorage.setItem('inflx_refresh_token', newRefresh);
      }
      return newAccess;
    } catch {
      return null;
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

async function request(method, path, body) {
  // Skip refresh dance for the refresh endpoint itself.
  const isRefreshCall = path === '/auth/refresh';
  let token = await getToken();

  try {
    let res = await fetchOnce(method, path, body, token);

    // Silent retry: on 401, try to refresh once and retry the original call.
    // Only if BOTH the original call AND the refresh fail do we tell the user.
    if (res.status === 401 && !isRefreshCall) {
      const newToken = await tryRefreshAccessToken();
      if (newToken) {
        res = await fetchOnce(method, path, body, newToken);
      }
      if (res.status === 401) {
        // Both attempts failed — refresh token is also invalid/expired.
        await clearSession();
        return { success: false, error: { code: 'UNAUTHORIZED', message: 'Session expired. Please log in again.' } };
      }
    }

    const text = await res.text();
    try {
      return JSON.parse(text);
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
};

export const brandApi = {
  getMe: () => api.get('/brands/me'),
  updateMe: (data) => api.patch('/brands/me', data),
  // Store preview — brand sees their store as customers see it
  getMyStorePreview: () => api.get('/brands/me/store-preview'),
  getWallet: () => api.get('/brands/me/wallet'),
  createTopup: (amount) => api.post('/brands/me/wallet/topup', { amount }),
  verifyTopup: (data) => api.post('/brands/me/wallet/topup/verify', data),
  getWalletTransactions: () => api.get('/brands/me/wallet/transactions'),
  getCampaigns: () => api.get('/campaigns'),
  getCampaign: (id) => api.get(`/campaigns/${id}`),
  getCampaignLive: (id) => api.get(`/campaigns/${id}/live`),
  cancelCampaign: (id) => api.post(`/campaigns/${id}/cancel`),
  deleteCampaign: (id) => api.delete(`/campaigns/${id}`),
  reviewDeliverable: (id, data) => api.post(`/deliverables/${id}/review`, data),
  confirmLive: (id) => api.post(`/deliverables/${id}/confirm-live`),
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
  listInboxDeliverables: (status = 'submitted') => api.get(`/brands/me/deliverables?status=${status}`),
  listInboxFailures:     () => api.get('/brands/me/failures'),
  listInboxApplications: () => api.get('/brands/me/applications'),
  // Open-group application review (brand picks from applicants)
  approveApplication:    (campaignId, ciId) => api.post(`/campaigns/${campaignId}/influencers/${ciId}/approve-application`),
  rejectApplication:     (campaignId, ciId) => api.post(`/campaigns/${campaignId}/influencers/${ciId}/reject-application`),
  getNotifications: () => api.get('/notifications'),
  markAllNotificationsRead: () => api.post('/notifications/read-all'),
  // Enquiry leads (follower-submitted enquiries, attributed to influencers)
  getEnquiries: (params) => api.get(`/brands/me/enquiries${params ? '?' + new URLSearchParams(params) : ''}`),
  updateEnquiry: (id, data) => api.patch(`/brands/me/enquiries/${id}`, data),
  // Conversions — all follower transactions across every campaign (paginated,
  // filterable by type / campaign_id / influencer_id / status).
  listTransactions: (params) => api.get(`/brands/me/transactions${params ? '?' + new URLSearchParams(params) : ''}`),
  // Influencer discovery + invite (H.5)
  searchInfluencers: (params) => api.get(`/influencers/search${params ? '?' + new URLSearchParams(params) : ''}`),
  getInfluencer:     (id) => api.get(`/influencers/${id}`),
  inviteInfluencer:  (campaignId, setId, data) => api.post(`/campaigns/${campaignId}/sets/${setId}/invite`, data),
  getCampaignSets:   (campaignId) => api.get(`/campaigns/${campaignId}/sets`),

  // Production Coordination (Phase P) — brand side
  getProduction:               (contractId) => api.get(`/contracts/${contractId}/production`),
  getProductionDateRange:      (contractId) => api.get(`/contracts/${contractId}/production/date-range`),
  initialiseProduction:        (contractId, mode) => api.post(`/contracts/${contractId}/production/initialise`, { mode }),
  setProductionVisitDetails:   (contractId, data) => api.post(`/contracts/${contractId}/production/visit-details`, data),
  acceptProduction:            (eventId)         => api.post(`/production-events/${eventId}/accept`),
  counterProposeProduction:    (eventId, data)   => api.post(`/production-events/${eventId}/counter-propose`, data),
  flipProductionToRemote:      (eventId, data)   => api.post(`/production-events/${eventId}/flip-to-remote`, data || {}),
  dispatchProduction:          (eventId, data) => api.post(`/production-events/${eventId}/dispatch`, data),
  completeProduction:          (eventId, data) => api.post(`/production-events/${eventId}/complete`, data),

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
};

// Agency app (Contract 3b) — drives the Contract 3a backend.
export const agencyApi = {
  register: (data) => api.post('/agencies/register', data),
  getMe: () => api.get('/agencies/me'),
  updateMe: (data) => api.patch('/agencies/me', data),
  withdraw: (data) => api.post('/agencies/me/withdraw', data),
  getWithdrawals: () => api.get('/agencies/me/withdrawals'),
  redeemReferral: (code) => api.post('/referrals/redeem', { code }),
};

export const influencerApi = {
  register: (data) => api.post('/influencers/register', data),
  getMe: () => api.get('/influencers/me'),
  updateMe: (data) => api.patch('/influencers/me', data),
  getEarnings: () => api.get('/influencers/me/earnings'),
  getReferralInfo: () => api.get('/influencers/me/referral'),
  getOffers: (status) => api.get(`/offers/inbox${status ? `?status=${status}` : ''}`),
  getOfferDetail: (id) => api.get(`/offers/${id}`),
  acceptOffer: (id) => api.post(`/offers/${id}/accept`),
  declineOffer: (id, data) => api.post(`/offers/${id}/decline`, data),
  negotiateOffer: (id, data) => api.post(`/offers/${id}/negotiate`, data),
  getNegotiation: (id) => api.get(`/negotiations/${id}`),
  getNegotiationByCampaignInfluencer: (ciId) => api.get(`/negotiations/by-ci/${ciId}`),
  submitNegotiationTurn: (id, data) => api.post(`/negotiations/${id}/respond`, data),
  getDeliverable: (id) => api.get(`/deliverables/${id}`),
  getDeliverables: () => api.get('/campaigns'),  // via campaign list
  getUploadUrl: (id, data) => api.post(`/deliverables/${id}/upload-url`, data),
  getMediaUrl: (id) => api.get(`/deliverables/${id}/media-url`),
  refreshStats: (id) => api.post(`/deliverables/${id}/refresh-stats`),
  getContractWithDeliverables: (campaignInfluencerId) => api.get(`/contracts/${campaignInfluencerId}`),
  submitDeliverable: (id, data) => api.post(`/deliverables/${id}/submit`, data),
  submitLive: (id, data) => api.post(`/deliverables/${id}/submit-live`, data),
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
  completeProduction:           (eventId, data)   => api.post(`/production-events/${eventId}/complete`, data),
  flipProductionToRemote:       (eventId, data)   => api.post(`/production-events/${eventId}/flip-to-remote`, data || {}),

  // Proposals (Phase Q)
  discoverBrands:           (search) => api.get(`/influencers/me/discover-brands${search ? `?search=${encodeURIComponent(search)}` : ''}`),
  getBrandProposalCriteria: (brandId) => api.get(`/brands/${brandId}/proposal-criteria`),
  createProposal:           (data) => api.post('/influencers/me/proposals', data),
  listMyProposals:          (status) => api.get(`/influencers/me/proposals${status ? `?status=${status}` : ''}`),
  getMyProposal:            (id) => api.get(`/influencers/me/proposals/${id}`),
  withdrawProposal:         (id) => api.post(`/influencers/me/proposals/${id}/withdraw`),
  respondCounter:           (id, action) => api.post(`/influencers/me/proposals/${id}/respond-counter`, { action }),

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

// ─── INFLX Meals (customer side) ────────────────────────────────────────────
export const mealsApi = {
  // C0 — in-store Offers tab (public)
  getStore: (brandId) => api.get(`/meals/store/${brandId}`),
  // C1–C3 — chat → clarify → offers + AI recommendation
  chat: (body) => api.post('/meals/chat', body),
  // C4 — lock + pay before cutoff
  pay: (mealOfferId) => api.post('/meals/orders', { meal_offer_id: mealOfferId }),
  // C5 — track
  getOrder: (id) => api.get(`/meals/orders/${id}`),
};

export const followerApi = {
  // Profile
  getMe: () => api.get('/followers/me'),
  updateMe: (data) => api.patch('/followers/me', data),

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
  getOffersSections: (loc = null) => {
    const p = [];
    if (loc?.latitude) p.push(`lat=${loc.latitude}`, `lng=${loc.longitude}`);
    const qs = p.length ? `?${p.join('&')}` : '';
    return api.get(`/follower/section/offers${qs}`);
  },

  // Listing Engine — new endpoints
  getStories: () => api.get('/follower/stories'),
  getCategories: () => api.get('/follower/categories'),
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

  // Fashion-2 — Creator lookbooks (public viewing on follower side)
  getCreatorLookbooks: (handle) => api.get(`/store/${handle}/lookbooks`),
  getLookbook: (handle, id) => api.get(`/store/${handle}/lookbooks/${id}`),

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
  createOrder: (data) => api.post('/follower/orders', data),
  verifyOrder: (data) => api.post('/follower/orders/verify', data),
  getOrder: (id) => api.get(`/follower/orders/${id}`),
  getOrders: () => api.get('/follower/orders'),

  // Addresses
  getAddresses: () => api.get('/followers/addresses'),
  addAddress: (data) => api.post('/followers/addresses', data),

  // Enquiry
  submitEnquiry: (data) => api.post('/follower/enquiry', data),

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

  // Path C-2 — follower wallet
  getWallet: () => api.get('/follower/wallet'),
  getWalletTransactions: () => api.get('/follower/wallet/transactions'),

  // Path C-3 — working search
  search: (q, opts = {}) => {
    const p = [`q=${encodeURIComponent(q)}`, `super=${opts.super || 'eat'}`];
    if (opts.veg) p.push('veg=1');
    return api.get(`/follower/search?${p.join('&')}`);
  },
};
