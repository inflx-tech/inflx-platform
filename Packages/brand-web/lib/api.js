'use client';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/v1').replace(/\/+$/, '');
export { API_BASE };

export function getToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('inflx_token');
}

export function getStoredUser() {
  if (typeof window === 'undefined') return null;
  try { return JSON.parse(localStorage.getItem('inflx_user') || 'null'); } catch { return null; }
}

export function clearSession(reason) {
  if (typeof window !== 'undefined') {
    // Diagnostic — keeps showing up in past sessions where admins were
    // mysteriously kicked to /login. The 'reason' arg names the failing
    // request so we can pin down which endpoint triggered the cascade.
    console.error('[INFLX] clearSession invoked', reason ? `(reason: ${reason})` : '');
    localStorage.removeItem('inflx_token');
    localStorage.removeItem('inflx_user');
    document.cookie = 'inflx_token=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
    window.location.href = '/login';
  }
}

let isRefreshing = false;
let refreshPromise = null;

// Exposed (re-exported below as `tryRefreshToken`) so the dashboard layout
// can fire a proactive refresh on cold start. Prevents the visible 401 →
// retry blink and ensures the next data fetch lands with a fresh token.
async function tryRefreshToken() {
  if (isRefreshing) return refreshPromise;
  isRefreshing = true;
  refreshPromise = (async () => {
    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        credentials: 'include', // sends httpOnly refresh_token cookie
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) return false;
      const data = await res.json();
      if (data.success && data.data?.access_token) {
        localStorage.setItem('inflx_token', data.data.access_token);
        document.cookie = `inflx_token=${data.data.access_token}; path=/; max-age=900; SameSite=Strict`;
        return true;
      }
      return false;
    } catch { return false; }
    finally { isRefreshing = false; refreshPromise = null; }
  })();
  return refreshPromise;
}

async function request(method, path, body) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, { method, headers, credentials: 'include', body: body ? JSON.stringify(body) : undefined });
  } catch {
    return { ok: false, success: false, error: { code: 'NETWORK_ERROR', message: 'Cannot connect to server.' } };
  }
  // On 401, try refreshing the token once before clearing session.
  // Important: we only force-logout if the refresh ITSELF failed (refresh
  // token is dead/missing). A 401 on a single endpoint while the refresh
  // path still works means the access token rotated successfully and the
  // retry below will resolve it — no logout needed.
  if (res.status === 401 && token) {
    console.warn(`[INFLX] 401 from ${method} ${path} — attempting token refresh`);
    const refreshed = await tryRefreshToken();
    if (refreshed) {
      const newToken = getToken();
      const retryHeaders = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${newToken}` };
      try {
        res = await fetch(`${API_BASE}${path}`, { method, headers: retryHeaders, credentials: 'include', body: body ? JSON.stringify(body) : undefined });
        // If the retry STILL 401s, the access token is genuinely refused
        // for this endpoint (role mismatch, etc.) — surface it but don't
        // wipe the whole session.
        if (res.status === 401) {
          console.warn(`[INFLX] retry of ${method} ${path} also 401'd — leaving session intact, returning UNAUTHORIZED`);
          return { ok: false, success: false, error: { code: 'UNAUTHORIZED', message: 'Not authorised for this resource' } };
        }
      } catch {
        return { ok: false, success: false, error: { code: 'NETWORK_ERROR', message: 'Cannot connect to server.' } };
      }
    } else {
      clearSession(`refresh failed during ${method} ${path}`);
      return { ok: false, success: false, error: { code: 'UNAUTHORIZED' } };
    }
  }
  try {
    const json = await res.json();
    // Normalize: expose `.ok` as alias for `.success`
    if (json.success !== undefined) json.ok = json.success;
    return json;
  } catch { return { ok: false, success: false, error: { code: 'PARSE_ERROR' } }; }
}

export const api = {
  get: (p) => request('GET', p, null),
  post: (p, b) => request('POST', p, b),
  patch: (p, b) => request('PATCH', p, b),
  delete: (p) => request('DELETE', p, null),
};

export const authApi = {
  sendOtp: (phone) => api.post('/auth/send-otp', { phone }),
  verifyOtp: (phone, otp, name) => api.post('/auth/verify-otp', { phone, otp, role: 'brand', ...(name && { name }) }),
  // Server-side revoke. Backend clears the HttpOnly refresh cookie and
  // marks the refresh token as used so it can't be replayed.
  logout: () => api.post('/auth/logout'),
};

// Re-export tryRefreshToken so the dashboard layout can call it on mount
// to proactively rotate the access token before any API request fires.
export { tryRefreshToken };

export const orderApi = {
  list: (params) => api.get(`/brands/me/orders${params ? '?' + new URLSearchParams(params) : ''}`),
  updateStatus: (id, data) => api.patch(`/brands/me/orders/${id}/status`, data),
};

export const brandApi = {
  register: (data) => api.post('/brands/register', data),
  getMe: () => api.get('/brands/me'),
  updateMe: (data) => api.patch('/brands/me', data),
  resubmit: (data) => api.post('/brands/resubmit', data),
  getEscrow: () => api.get('/brands/me/escrow'),
  getCampaignEscrow: (campaignId) => api.get(`/brands/me/campaigns/${campaignId}/escrow`),
  getEnquiries: (params) => api.get(`/brands/me/enquiries${params ? '?' + new URLSearchParams(params) : ''}`),
  updateEnquiry: (id, data) => api.patch(`/brands/me/enquiries/${id}`, data),
  // Generic GET (for listing engine and new endpoints)
  get: (path) => api.get(path),
  // Generic POST/PATCH
  post: (path, data) => api.post(path, data),
  patch: (path, data) => api.patch(path, data),
  // Category schema
  getSchema: () => api.get('/brands/me/schema'),
  // Master catalogue (car_rental + salon browse-and-activate)
  getMasterCatalogue: () => api.get('/brands/me/master-catalogue'),
  // Product catalogue — full CRUD
  getProducts: (params) => api.get(`/brands/me/products${params ? '?' + new URLSearchParams(params) : ''}`),
  createProduct: (data) => api.post('/brands/me/products', data),
  updateProduct: (id, data) => api.patch(`/brands/me/products/${id}`, data),
  deleteProduct: (id) => api.delete(`/brands/me/products/${id}`),
  // ── Offer Engine — reusable offer library (Sub-contract A backend) ─────────
  getOffers:   (params) => api.get(`/brands/me/offers${params ? '?' + new URLSearchParams(params) : ''}`),
  getOfferAttachments: (id) => api.get(`/brands/me/offers/${id}/attachments`),
  createOffer: (data) => api.post('/brands/me/offers', data),
  updateOffer: (id, data) => api.patch(`/brands/me/offers/${id}`, data),
  deleteOffer: (id) => api.delete(`/brands/me/offers/${id}`),
  // ── Subscription + billing (Phase A7-brand) ───────────────────────────────
  listSubscriptionTiers: () => api.get('/subscription-tiers'),
  getMySubscription:     () => api.get('/brands/me/subscription'),
  upgradeSubscription:   (tier_key, billing_period = 'monthly') =>
                           api.post('/brands/me/subscription/upgrade', { tier_key, billing_period }),
  getMyInvoices:         (params) => api.get(`/brands/me/billing/invoices${params ? '?' + new URLSearchParams(params) : ''}`),
  // Wave 4 — GST tax-invoice PDF (paid invoices only). Streaming URL with the
  // JWT in the query string so a plain <a>/new-tab can fetch the binary without
  // an Authorization header (same mechanism as contractApi.pdfUrl).
  invoicePdfUrl:         (id) => `${API_BASE}/brands/me/billing/invoices/${id}/pdf?download_token=${encodeURIComponent(getToken() || '')}`,
  // ── Wave 3 — commerce payout account (Razorpay Route) ─────────────────────
  getPayoutAccount:      () => api.get('/brands/me/payout-account'),
  createPayoutAccount:   (data = {}) => api.post('/brands/me/payout-account', data),
  // Phase A12.1.5 — pre-flight quota check used by entry buttons
  // (+ New campaign, + Add product, etc.) so the popup fires BEFORE the
  // brand fills out the form.
  quotaPreflight:        (action, params = {}) => {
    const q = new URLSearchParams({ action, ...params });
    return api.get(`/brands/me/quota-preflight?${q.toString()}`);
  },
};

// ─── INFLX Meals (admin platform settings) ──────────────────────────────────
export const mealsAdminApi = {
  getSettings: () => api.get('/admin/meals/settings'),
  putSettings: (data) => request('PUT', '/admin/meals/settings', data),
};

// ─── INFLX Meals (restaurant side) ──────────────────────────────────────────
export const mealsApi = {
  getConfig: () => api.get('/meals/config'),
  saveConfig: (data) => api.post('/meals/config', data) /* PUT */,
  putConfig: (data) => request('PUT', '/meals/config', data),
  listSlots: () => api.get('/meals/slots'),
  createSlot: (data) => api.post('/meals/slots', data),
  listOfferRules: (params) => api.get(`/meals/offer-rules${params ? '?' + new URLSearchParams(params) : ''}`),
  createOfferRule: (data) => api.post('/meals/offer-rules', data),
  suggestOffers: () => api.post('/meals/offer-rules/suggest'),
  restaurantChat: (body) => api.post('/meals/restaurant-chat', body),
  modifyOfferChat: (id, message) => api.post(`/meals/offer-rules/${id}/modify-chat`, { message }),
  updateOfferRule: (id, data) => api.patch(`/meals/offer-rules/${id}`, data),
  getMenuCosts: () => api.get('/meals/menu-costs'),
  upsertMenuCost: (data) => request('PUT', '/meals/menu-costs', data),
  getDashboard: (params) => api.get(`/meals/dashboard${params ? '?' + new URLSearchParams(params) : ''}`),
  deliverOrder: (id) => api.post(`/meals/orders/${id}/deliver`),
};

export const walletApi = {
  getBalance: () => api.get('/brands/me/wallet'),
  createTopup: (amount) => api.post('/brands/me/wallet/topup', { amount }),
  verifyTopup: (data) => api.post('/brands/me/wallet/topup/verify', data),
  getTransactions: (params) => api.get(`/brands/me/wallet/transactions${params ? '?' + new URLSearchParams(params) : ''}`),
  requestWithdrawal: (data) => api.post('/brands/me/wallet/withdraw', data),
  getWithdrawals: () => api.get('/brands/me/wallet/withdrawals'),
};

export const campaignApi = {
  list: () => api.get('/campaigns'),
  create: (data) => api.post('/campaigns', data),
  get: (id) => api.get(`/campaigns/${id}`),
  update: (id, data) => api.patch(`/campaigns/${id}`, data),
  delete: (id) => api.delete(`/campaigns/${id}`),
  publish: (id) => api.post(`/campaigns/${id}/publish`),
  cancel: (id) => api.post(`/campaigns/${id}/cancel`),
  cancelInfluencer: (cid, ciid) => api.post(`/campaigns/${cid}/influencers/${ciid}/cancel`),
  getLive: (id) => api.get(`/campaigns/${id}/live`),
  // Sets
  getSets: (cid) => api.get(`/campaigns/${cid}/sets`),
  createSet: (cid, data) => api.post(`/campaigns/${cid}/sets`, data),
  updateSet: (cid, sid, data) => api.patch(`/campaigns/${cid}/sets/${sid}`, data),
  deleteSet: (cid, sid) => api.delete(`/campaigns/${cid}/sets/${sid}`),
  duplicateSet: (cid, sid) => api.post(`/campaigns/${cid}/sets/${sid}/duplicate`),
  // Offers (legacy)
  createOffer: (cid, sid, data) => api.post(`/campaigns/${cid}/sets/${sid}/offers`, data),
  // Invite / update influencer assignment
  inviteInfluencer: (cid, sid, data) => api.post(`/campaigns/${cid}/sets/${sid}/invite`, data),
  updateInfluencer: (cid, sid, ciId, data) => api.patch(`/campaigns/${cid}/sets/${sid}/influencers/${ciId}`, data),
  // Search
  searchInfluencers: (cid, params) => api.get(`/campaigns/${cid}/influencer-search${params ? '?' + new URLSearchParams(params) : ''}`),
  getOpenGroupMatches: (cid, si, params) => api.get(`/campaigns/${cid}/sets/${si}/open-group-matches${params ? '?' + params : ''}`),
  // Analytics
  getEngagement: (id) => api.get(`/brands/me/campaigns/${id}/engagement`),
  getConversions: (id) => api.get(`/brands/me/campaigns/${id}/conversions`),
};

export const influencerApi = {
  // Brand search across the unified pool (scraped + onboarded creators).
  // Params (all optional):
  //   q, sort (rank|view_er|followers|active|growth|cheapest|most_collabs)
  //   city, niche, tier, languages, use_case   (comma-separated multi-selects)
  //   min_followers, max_followers, min_view_er, min_rate, max_rate, min_posts_per_week
  //   has_brand_collabs, is_inflx_verified, is_business  (boolean strings)
  //   brand_handle (creators who collabbed with @brand)
  //   page, limit
  search: (params) => api.get(`/influencers/search${params ? '?' + new URLSearchParams(params) : ''}`),
  // Market analytics — single aggregate response (all charts).
  // Optional scope: city, niche, tier (each comma-separated).
  analytics: (params) => api.get(`/influencers/analytics${params ? '?' + new URLSearchParams(params) : ''}`),
};

export const creatorInvitationApi = {
  create: (body) => api.post('/brands/me/creator-invitations', body),
  list: (status) => api.get(`/brands/me/creator-invitations${status ? `?status=${status}` : ''}`),
  withdraw: (id) => api.delete(`/brands/me/creator-invitations/${id}`),
};

export const proposalApi = {
  // Settings
  getSettings: () => api.get('/brands/me/proposal-settings'),
  updateSettings: (data) => api.patch('/brands/me/proposal-settings', data),
  // Inbox
  list: (status) => api.get(`/brands/me/proposals${status ? `?status=${status}` : ''}`),
  get: (id) => api.get(`/brands/me/proposals/${id}`),
  accept: (id) => api.post(`/brands/me/proposals/${id}/accept`),
  reject: (id, message) => api.post(`/brands/me/proposals/${id}/reject`, { message }),
  counter: (id, counterTerms, message) => api.post(`/brands/me/proposals/${id}/counter`, { counter_terms: counterTerms, message }),
  flag: (id, reason) => api.post(`/brands/me/proposals/${id}/flag`, { reason }),
};

export const productionApi = {
  // GET — both parties see their own contract's production event + log
  get: (contractId) => api.get(`/contracts/${contractId}/production`),
  // Valid date range for the visit (today+1 to posting_date−2 / content_end_date−3)
  getDateRange: (contractId) => api.get(`/contracts/${contractId}/production/date-range`),
  // Force-initialise the production event when it didn't auto-create (legacy)
  initialise: (contractId, mode) => api.post(`/contracts/${contractId}/production/initialise`, { mode }),
  // Brand sets / updates visit details (location-only or with slot)
  setVisitDetails: (contractId, data) => api.post(`/contracts/${contractId}/production/visit-details`, data),
  // Influencer-only: pick a slot when brand has set only the location
  proposeSlot: (eventId, data) => api.post(`/production-events/${eventId}/propose-slot`, data),
  // Accept proposed visit/shipment terms (whichever side didn't propose)
  accept: (eventId) => api.post(`/production-events/${eventId}/accept`),
  // Counter-propose a different slot/address (either party)
  counterPropose: (eventId, data) => api.post(`/production-events/${eventId}/counter-propose`, data),
  // Brand: package shipped (with AWB + courier)
  dispatch: (eventId, data) => api.post(`/production-events/${eventId}/dispatch`, data),
  // Influencer: package received
  confirmReceived: (eventId, data) => api.post(`/production-events/${eventId}/confirm-received`, data),
  // Mark visit done (either party)
  complete: (eventId, data) => api.post(`/production-events/${eventId}/complete`, data),
  // Mutual flip to remote — either side requests, the other confirms
  flipToRemote: (eventId, data) => api.post(`/production-events/${eventId}/flip-to-remote`, data || {}),
};

export const mediaGalleryApi = {
  // Asset library
  list: (params) => api.get(`/brands/me/media-assets${params ? '?' + new URLSearchParams(params) : ''}`),
  uploadUrl: (data) => api.post('/brands/me/media-assets/upload-url', data),
  create: (data) => api.post('/brands/me/media-assets', data),
  getDownloadUrl: (id) => api.get(`/brands/me/media-assets/${id}/download-url`),
  update: (id, data) => api.patch(`/brands/me/media-assets/${id}`, data),
  delete: (id) => api.delete(`/brands/me/media-assets/${id}`),
  getUsage: () => api.get('/brands/me/media-assets/usage'),
  // Aggregate contracts (for gallery Contracts tab)
  listContracts: () => api.get('/brands/me/contracts'),
  // Signed URL for contract PDF (reuses existing endpoint)
  contractPdfUrl: (id) => api.get(`/contracts/${id}/pdf-url`),
};

export const referenceLinkApi = {
  list:    ()       => api.get('/brands/me/reference-links'),
  create:  (data)   => api.post('/brands/me/reference-links', data),
  update:  (id, d)  => api.patch(`/brands/me/reference-links/${id}`, d),
  delete:  (id)     => api.delete(`/brands/me/reference-links/${id}`),
};

/**
 * Upload a File to R2 using a presigned PUT URL + persist metadata.
 * Returns { asset } on success or { error } on failure.
 */
export async function uploadFileToGallery(file, { title, description, tags }) {
  if (!file) return { error: { message: 'No file provided' } };

  const presign = await mediaGalleryApi.uploadUrl({
    file_name: file.name,
    file_type: file.type || 'application/octet-stream',
    file_size_bytes: file.size,
  });
  if (!presign.success) return { error: presign.error || { message: 'Upload URL failed' } };

  const { url, method, key } = presign.data;

  try {
    if (method === 'PUT') {
      const putRes = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
        body: file,
      });
      if (!putRes.ok) return { error: { message: `R2 upload failed (${putRes.status})` } };
    } else {
      // Mock mode — multipart POST to backend
      const fd = new FormData();
      fd.append('file', file);
      fd.append('key', key);
      const token = getToken();
      const postRes = await fetch(url, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd,
      });
      if (!postRes.ok) return { error: { message: `Mock upload failed (${postRes.status})` } };
    }
  } catch (err) {
    return { error: { message: `Upload failed: ${err.message}` } };
  }

  const created = await mediaGalleryApi.create({
    title: title || file.name,
    description: description || null,
    file_r2_key: key,
    file_name: file.name,
    file_type: file.type || 'application/octet-stream',
    file_size_bytes: file.size,
    tags: tags || [],
  });
  if (!created.success) return { error: created.error || { message: 'Create failed' } };
  return { asset: created.data.asset };
}

export const deliverableApi = {
  get: (id) => api.get(`/deliverables/${id}`),
  getMediaUrl: (id) => api.get(`/deliverables/${id}/media-url`),
  review: (id, data) => api.post(`/deliverables/${id}/review`, data),
  confirmLive: (id) => api.post(`/deliverables/${id}/confirm-live`),
  refreshStats: (id) => api.post(`/deliverables/${id}/refresh-stats`),
};

export const negotiationApi = {
  get: (id) => api.get(`/negotiations/${id}`),
  getByCampaignInfluencer: (ciId) => api.get(`/negotiations/by-ci/${ciId}`),
  respond: (id, data) => api.post(`/negotiations/${id}/respond`, data),
};

export const contractApi = {
  get: (campaignInfluencerId) => api.get(`/contracts/${campaignInfluencerId}`),
  brandSign: (id) => api.post(`/contracts/${id}/brand-sign`),
  bulkSign: (ids) => api.post(`/contracts/bulk-sign`, { ids }),
  listPending: () => api.get(`/contracts/brand/pending`),
  approve: (id, body) => api.post(`/contracts/${id}/approve`, body),
  regeneratePdf: (id) => api.post(`/contracts/${id}/regenerate-pdf`),
  retryCreate: (ciId) => api.post(`/contracts/by-ci/${ciId}/retry`),
  // Preferred: fetch a short-lived presigned R2 URL that works in iframes,
  // downloads, and Google Docs Viewer without any Authorization header.
  getPdfUrl: (id) => api.get(`/contracts/${id}/pdf-url`),
  // Legacy streaming URL kept as a fallback (JWT via query string).
  pdfUrl: (id) => `${API_BASE}/contracts/${id}/pdf?download_token=${encodeURIComponent(getToken() || '')}`,
};

export const brandInboxApi = {
  summary:        ()      => api.get('/brands/me/inbox-summary'),
  negotiations:   (status = 'awaiting_brand') => api.get(`/brands/me/negotiations?status=${status}`),
  deliverables:   (status = 'submitted')      => api.get(`/brands/me/deliverables?status=${status}`),
  applications:   ()      => api.get('/brands/me/applications'),
};

export const applicationApi = {
  approve: (campaignId, ciId) => api.post(`/campaigns/${campaignId}/influencers/${ciId}/approve-application`),
  reject:  (campaignId, ciId) => api.post(`/campaigns/${campaignId}/influencers/${ciId}/reject-application`),
};

export const notificationApi = {
  list: () => api.get('/notifications'),
  markAllRead: () => api.post('/notifications/read-all'),
};

// ─── Admin endpoints ────────────────────────────────────────────────────────
// Used only by /admin/* pages. Keeping them on the same api client + auth
// pipeline so admins benefit from the same proactive-refresh and 401-retry
// machinery as brand users.
export const adminApi = {
  getStats: () => api.get('/admin/stats'),
  getBrands: (status, search, page) => api.get(`/admin/brands?status=${status || 'all'}&search=${encodeURIComponent(search || '')}&page=${page || 1}`),
  getBrandQueue: () => api.get('/admin/queue/brands'),
  getInfluencerQueue: () => api.get('/admin/queue/influencers'),
  updateBrandStatus: (id, data) => api.patch(`/admin/brands/${id}/status`, data),
  updateInfluencerStatus: (id, data) => api.patch(`/admin/influencers/${id}/status`, data),
  getBrandById: (id) => api.get(`/brands/${id}`),
  getInfluencerById: (id) => api.get(`/influencers/${id}`),
  getEscrow: (status) => api.get(`/admin/escrow?status=${status || 'all'}`),
  releaseEscrow: (id, reason) => api.post(`/admin/escrow/${id}/release`, { override_reason: reason }),
  getAdminUsers: () => api.get('/admin/users'),
  createAdminUser: (data) => api.post('/admin/users', data),
  getPaymentConfig: () => api.get('/admin/config/payments'),
  updatePaymentConfig: (data) => api.patch('/admin/config/payments', data),
  setBrandPlatformFee: (brandId, pct) => api.patch(`/admin/brands/${brandId}/platform-fee`, { platform_fee_pct: pct }),
  // Wave 1 — per-brand L3 commerce-commission override + per-influencer TDS controls
  setBrandCommerceCommissionOverride: (brandId, pct) =>
    api.patch(`/admin/brands/${brandId}/commerce-commission-override`, { commerce_commission_override_pct: pct }),
  setInfluencerTaxControls: (influencerId, tdsOverridePct, tdsExempt) =>
    api.patch(`/admin/influencers/${influencerId}/tax-controls`, { tds_override_pct: tdsOverridePct, tds_exempt: tdsExempt }),
  rescrapeInfluencer: (id) => api.post(`/influencers/${id}/rescrape`),
  getAnalytics: (days = 30) => api.get(`/admin/analytics?days=${days}`),
  getProductionQueue: () => api.get('/admin/production/queue'),
  getWithdrawals: (status, search, page) => api.get(`/admin/withdrawals?status=${status || 'all'}&search=${encodeURIComponent(search || '')}&page=${page || 1}`),
  processWithdrawal: (id, action, reason) => api.post(`/admin/withdrawals/${id}/process`, { action, reason }),
  getBrandWithdrawals: (status, search, page) => api.get(`/admin/brand-withdrawals?status=${status || 'all'}&search=${encodeURIComponent(search || '')}&page=${page || 1}`),
  processBrandWithdrawal: (id, action, reason) => api.post(`/admin/brand-withdrawals/${id}/process`, { action, reason }),
  // Wave 4 — monthly tax summary (GST / TCS / TDS) for filing
  getTaxSummary: (month) => api.get(`/admin/tax-summary${month ? `?month=${encodeURIComponent(month)}` : ''}`),
  // Master dishes — admin CRUD for the restaurant dish catalogue
  listMasterDishes: (cuisine, section, search, page) =>
    api.get(`/admin/master-dishes?cuisine=${encodeURIComponent(cuisine || '')}&section=${encodeURIComponent(section || '')}&search=${encodeURIComponent(search || '')}&page=${page || 1}`),
  listCuisines:       () => api.get('/admin/master-dishes/cuisines'),
  createMasterDish:   (data) => api.post('/admin/master-dishes', data),
  updateMasterDish:   (id, data) => api.patch(`/admin/master-dishes/${id}`, data),
  deleteMasterDish:   (id) => api.delete(`/admin/master-dishes/${id}`),

  // Creator verification queue (claimed → verified / rejected / reset).
  // Backed by /v1/admin/creator-verifications/* — admin queue surfaces
  // creator_profiles rows in 'claimed' state (either auto-claimed from a
  // 1-match at signup, or stub rows created when signup IG handle wasn't
  // in our scraped pool yet).
  listVerifications:   (status) => api.get(`/admin/creator-verifications${status ? `?status=${encodeURIComponent(status)}` : ''}`),
  verifyCreator:       (id)         => api.post(`/admin/creator-verifications/${id}/verify`),
  rejectCreator:       (id, reason) => api.post(`/admin/creator-verifications/${id}/reject`, { reason }),
  resetCreator:        (id)         => api.post(`/admin/creator-verifications/${id}/reset`),

  // Creator-invitations queue (brand-driven outreach to unclaimed creators).
  // When a brand picks an unverified creator in the campaign wizard the row
  // lands here for admin to run cold outreach ("brand X wants you, sign up").
  // Backed by /v1/admin/creator-invitations/*.
  listInvitations:        (status) => api.get(`/admin/creator-invitations${status ? `?status=${encodeURIComponent(status)}` : ''}`),
  markInvitationContacted: (id)    => api.post(`/admin/creator-invitations/${id}/contacted`),
  expireInvitation:       (id)     => api.post(`/admin/creator-invitations/${id}/expire`),

  // ─── Subscription tiers (L1) — Phase A7-admin ──────────────────────────────
  listSubscriptionTiers:    () => api.get('/admin/subscription-tiers'),
  createSubscriptionTier:   (data) => api.post('/admin/subscription-tiers', data),
  updateSubscriptionTier:   (tierKey, data) => api.patch(`/admin/subscription-tiers/${encodeURIComponent(tierKey)}`, data),

  // ─── Features catalog + tier_features + prices — Phase A10 ────────────────
  listFeatures:             () => api.get('/admin/features'),
  createFeature:            (data) => api.post('/admin/features', data),
  updateFeature:            (key, data) => api.patch(`/admin/features/${encodeURIComponent(key)}`, data),
  deleteFeature:            (key) => api.delete(`/admin/features/${encodeURIComponent(key)}`),

  listTierFeatures:         (tierKey) => api.get(`/admin/tiers/${encodeURIComponent(tierKey)}/features`),
  upsertTierFeatures:       (tierKey, items) => request('PUT', `/admin/tiers/${encodeURIComponent(tierKey)}/features`, { items }),

  // ─── Per-brand feature overrides — Phase A14 ──────────────────────────────
  listBrandOverrides:       (brandId) => api.get(`/admin/brands/${encodeURIComponent(brandId)}/overrides`),
  upsertBrandOverrides:     (brandId, items) => request('PUT', `/admin/brands/${encodeURIComponent(brandId)}/overrides`, { items }),

  listTierPrices:           (tierKey) => api.get(`/admin/tiers/${encodeURIComponent(tierKey)}/prices`),
  createTierPrice:          (tierKey, data) => api.post(`/admin/tiers/${encodeURIComponent(tierKey)}/prices`, data),
  updatePrice:              (priceId, data) => api.patch(`/admin/prices/${encodeURIComponent(priceId)}`, data),
  deletePrice:              (priceId) => api.delete(`/admin/prices/${encodeURIComponent(priceId)}`),

  // ─── Marketplace categories (L3) — Phase A7-admin ──────────────────────────
  listCategories:           () => api.get('/admin/categories'),
  createCategory:           (data) => api.post('/admin/categories', data),
  updateCategory:           (key, data) => api.patch(`/admin/categories/${encodeURIComponent(key)}`, data),
  deleteCategory:           (key) => api.delete(`/admin/categories/${encodeURIComponent(key)}`),

  // ─── Active subscriptions queue + invoice history — Phase A7-admin ─────────
  listActiveSubscriptions:  (params = {}) => {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') q.set(k, v); });
    return api.get(`/admin/subscriptions?${q.toString()}`);
  },
  listSubscriptionInvoices: (params = {}) => {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') q.set(k, v); });
    return api.get(`/admin/subscription-invoices?${q.toString()}`);
  },

  bulkUploadInfluencers: async (file) => {
    const token = getToken();
    const formData = new FormData();
    formData.append('file', file);
    let res;
    try {
      res = await fetch(`${API_BASE}/admin/influencers/bulk-upload`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
    } catch {
      return { success: false, error: { code: 'NETWORK_ERROR', message: 'Cannot connect to server.' } };
    }
    if (res.status === 401 && token) { clearSession(); return { success: false, error: { code: 'UNAUTHORIZED' } }; }
    try { return await res.json(); } catch { return { success: false, error: { code: 'PARSE_ERROR' } }; }
  },
};

// Marketing engine admin API (Phase 5 — /admin/marketing/*)
export const marketingApi = {
  listLeads: (params = {}) => {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') q.set(k, v); });
    return api.get(`/admin/marketing/leads?${q.toString()}`);
  },
  getLeadDetail: (type, id) => api.get(`/admin/marketing/leads/${type}/${id}`),
  intakeLead: (payload) => api.post('/admin/marketing/leads/intake', payload),
  intakeLeadBulk: (rows) => api.post('/admin/marketing/leads/intake/bulk', { rows }),
  logActivity: (type, id, payload) => api.post(`/admin/marketing/leads/${type}/${id}/activity`, payload),
  updateStatus: (type, id, payload) => api.patch(`/admin/marketing/leads/${type}/${id}/status`, payload),
  getInbox: () => api.get('/admin/marketing/inbox'),
  getFunnel: () => api.get('/admin/marketing/funnel'),
  getSettings: () => api.get('/admin/marketing/settings'),
  updateSettings: (data) => api.patch('/admin/marketing/settings', data),
  getFilterOptions: () => api.get('/admin/marketing/filter-options'),

  // Maintenance: re-cache all profile pictures to R2. Superadmin only.
  // Returns { ok, skipped, failed, by_type: { creator: {...}, brand: {...} } }
  backfillProfilePics: (payload = {}) => api.post('/admin/marketing/backfill-profile-pics', payload),
};

// (getStoredUser is already exported near the top of this file — duplicate
//  removed here to avoid the webpack "redefined" error.)

// Since migration 021 (paise→rupees) every monetary value is in rupees.
// fmtMoney stays as an alias to fmtRupees so we don't have to rename 46
// call sites. Prefer fmtRupees in new code.
export function fmtRupees(rupees) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(rupees || 0);
}
export const fmtMoney = fmtRupees;

export function fmtNum(n) {
  return new Intl.NumberFormat('en-IN').format(n || 0);
}
