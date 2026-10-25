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

// Session lifetime = the refresh token's 30 days, NOT the access token's 15
// minutes. The `inflx_token` cookie exists only so middleware.js can tell
// "has a session" before any JS runs — real auth is enforced by the API on
// every call, and an expired access token is transparently rotated by
// tryRefreshToken(). Writing a 15-minute cookie made the middleware gate
// expire long before the session did, which bounced people to /login on
// refresh while their refresh token was still perfectly valid.
//
// SameSite=Lax, not Strict: Strict withholds the cookie on inbound
// navigations from anywhere else (a link in email, WhatsApp, search
// results), so arriving that way looked logged-out even mid-session.
const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30d — matches the refresh token

// Single writer for this cookie. Two call sites previously wrote it with
// different max-age AND different SameSite; whichever ran last silently won.
export function setSessionCookie(token) {
  if (typeof document === 'undefined') return;
  const secure = typeof location !== 'undefined' && location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `inflx_token=${token}; path=/; max-age=${SESSION_MAX_AGE}; SameSite=Lax${secure}`;
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
        setSessionCookie(data.data.access_token);
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
  put: (p, b) => request('PUT', p, b),
  patch: (p, b) => request('PATCH', p, b),
  delete: (p) => request('DELETE', p, null),
};

// The old shopper app's admin wrappers (sections, custom pages, concepts, Discover layouts, admin
// collections, world rules, home verticals, the Section Library) went with the old app
// (follower-app-v2, 29 Sep 2026).

// Drill-down listing engine (contract: listing-drilldown-taxonomy-engine).
// Tree + per-leaf facets (public read) + drill-once batch-add (brand).
export const listingApi = {
  getTree: (vertical) => api.get(`/listing/tree?vertical=${encodeURIComponent(vertical)}`),
  getNodeFacets: (nodeId) => api.get(`/listing/nodes/${nodeId}/facets`),
  getBrands: (vertical, q) => api.get(`/listing/brands?vertical=${encodeURIComponent(vertical)}${q ? `&q=${encodeURIComponent(q)}` : ''}`),
  batchCreate: (payload) => api.post('/brands/me/products/batch', payload),
  // Bulk re-file products under another item type (contract:
  // listing-bulk-move-and-offer). Returns per-product moved/skipped outcomes —
  // callers must report the skipped ones, never assume a clean sweep.
  moveProducts: (productIds, targetNodeId) =>
    api.post('/brands/me/listing-products/move', { product_ids: productIds, target_node_id: targetNodeId }),
  // Ingest a pasted image URL into our R2 (contract: listing-image-urls).
  ingestImage: (url) => api.post('/listing/ingest-image', { url }),
  // Append cover photos to a product (post-import photo tray, multiple).
  setCoverPhotos: (productId, urls) => api.post(`/listing/products/${productId}/cover-photos`, { urls }),
  // Excel bulk add (contract: listing-excel-bulk). Template is a public GET;
  // import is a multipart POST (mirrors uploadFileToGallery's transport).
  templateUrl: (nodeId) => `${API_BASE}/listing/nodes/${nodeId}/template.xlsx`,
  importProducts: async (nodeId, file) => {
    const fd = new FormData();
    fd.append('file', file);
    const send = (tok) => fetch(`${API_BASE}/listing/nodes/${nodeId}/import`, {
      method: 'POST',
      headers: tok ? { Authorization: `Bearer ${tok}` } : {},
      credentials: 'include',
      body: fd,
    });
    try {
      let res = await send(getToken());
      // The 15-min access token may have expired while the page sat open —
      // refresh once and retry, mirroring api.request() (was: hard "Invalid or
      // expired token" on upload).
      if (res.status === 401 && (await tryRefreshToken())) {
        res = await send(getToken());
      }
      const json = await res.json().catch(() => ({}));
      return { ok: res.ok, status: res.status, data: json.data, error: json.error };
    } catch (e) {
      return { ok: false, error: { message: e.message } };
    }
  },
};

/**
 * Which role is this door? Derived from where the page is being served, because that
 * is the one thing the login screen always knows for certain.
 *
 *   admin.inflx.in  → admin      (and any admin.* host, plus /admin locally)
 *   anything else   → brand      (the brand workspace)
 *
 * The phone apps do the same thing a different way: each is its own build, and the
 * flavour is the answer.
 */
export function roleFromHost() {
  if (typeof window === 'undefined') return 'brand';
  const host = String(window.location.hostname || '').toLowerCase();
  const path = String(window.location.pathname || '').toLowerCase();
  if (host === 'admin.inflx.in' || host.startsWith('admin.')) return 'admin';
  // Local development serves both from one origin, so fall back to the path.
  if (path.startsWith('/admin')) return 'admin';
  return 'brand';
}

export const authApi = {
  sendOtp: (phone) => api.post('/auth/send-otp', { phone }),
  // Stage 0, job C — one number, many roles.
  //
  // The DOMAIN already knows who is arriving, so sign-in must never ask. The admin
  // dashboard is its own subdomain; everything else on this app is the brand
  // workspace. An earlier version sent a fallback and let the server ask "which of
  // your 3 accounts?" — which is a question the page had already answered by
  // existing at that address.
  //
  // Admin is lookup-only server-side: a number with no admin account is refused
  // here, never turned into one.
  verifyOtp: (phone, otp, name) =>
    api.post('/auth/verify-otp', { phone, otp, role: roleFromHost(), ...(name && { name }) }),
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
  // shopper-ordering: parcels with items and each item's three shares; cancel an item with a reason.
  parcels: (params) => api.get(`/brands/me/parcels${params ? '?' + new URLSearchParams(params) : ''}`),
  cancelLine: (lineId, data) => api.post(`/brands/me/orders/lines/${lineId}/cancel`, data),
  // shopper-deal-orders (R9): replacements INFLX approved — what goes out, what comes back; mark one sent, then delivered.
  replacements: () => api.get('/brands/me/replacements'),
  replacementStatus: (id, status) => api.patch(`/brands/me/replacements/${id}/status`, { status }),
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
  // Generic POST/PATCH/DELETE
  post: (path, data) => api.post(path, data),
  patch: (path, data) => api.patch(path, data),
  delete: (path) => api.delete(path),   // fixes drilldown remove ("brandApi.delete is not a function")
  // Category schema
  getSchema: () => api.get('/brands/me/schema'),
  // Master catalogue (car_rental + salon browse-and-activate)
  getMasterCatalogue: () => api.get('/brands/me/master-catalogue'),
  // Product catalogue — full CRUD
  getProducts: (params) => api.get(`/brands/me/products${params ? '?' + new URLSearchParams(params) : ''}`),
  createProduct: (data) => api.post('/brands/me/products', data),
  updateProduct: (id, data) => api.patch(`/brands/me/products/${id}`, data),
  deleteProduct: (id) => api.delete(`/brands/me/products/${id}`),
  // Reusable customisation templates (saved add-on / variation groups)
  getAddonTemplates: () => api.get('/brands/me/addon-templates'),
  saveAddonTemplate: (data) => api.post('/brands/me/addon-templates', data),
  deleteAddonTemplate: (id) => api.delete(`/brands/me/addon-templates/${id}`),
  // Tag picker options — fixed vocabulary for this brand's business (+ 'ALL')
  getTagOptions: () => api.get('/brands/me/tag-options'),
  // Complete category list (whole vertical taxonomy) for the offer builder's
  // Category scope — not limited to categories that currently have products.
  getOfferCategories: () => api.get('/brands/me/offer-categories'),
  // ── Offers (contract: features/offer-builder-v2, rules v1.4 §1) ────────────
  // Offers are built on product pools and locked by date. The bulk "Attach offer" is retired:
  // products join offers only through the pool builder, where the checks run.
  getOffers:   (params) => api.get(`/brands/me/offers?${new URLSearchParams({ engine: '2', ...(params || {}) })}`),
  getOffer:    (id) => api.get(`/brands/me/offers/${id}`),
  createOffer: (data) => api.post('/brands/me/offers', data),
  updateOffer: (id, data) => api.patch(`/brands/me/offers/${id}`, data),
  deleteOffer: (id) => api.delete(`/brands/me/offers/${id}`),
  addOfferSource:    (id, line) => api.post(`/brands/me/offers/${id}/sources`, line),
  removeOfferSource: (id, sourceId) => api.delete(`/brands/me/offers/${id}/sources/${sourceId}`),
  offerCandidates:   (id, params) => api.get(`/brands/me/offers/${id}/candidates?${new URLSearchParams(params || {})}`),
  offerFilterOptions: (nodeId) => api.get(`/brands/me/offers/filter-options?node=${encodeURIComponent(nodeId)}`),
  publishOffer:  (id, seenProductIds) => api.post(`/brands/me/offers/${id}/publish`, { seen_product_ids: seenProductIds }),
  endOffer:      (id) => api.post(`/brands/me/offers/${id}/end`, {}),
  offerRemovePreview: (id, productIds) => api.get(`/brands/me/offers/${id}/remove-preview?product_ids=${productIds.join(',')}`),
  removeOfferProducts: (id, productIds) => api.post(`/brands/me/offers/${id}/remove-products`, { product_ids: productIds }),
  addOfferProducts: (id, productIds) => api.post(`/brands/me/offers/${id}/add-products`, { product_ids: productIds }),
  productsWithoutOffers: (params) => api.get(`/brands/me/offers/products-without-offers?${new URLSearchParams(params || {})}`),
  productOffers:   () => api.get('/brands/me/offers/product-offers'),
  productOfferPanel: (productId) => api.get(`/brands/me/offers/product-offers/${productId}`),
  priceImpact:     (productId, price) => api.get(`/brands/me/offers/price-impact?product_id=${productId}&price=${encodeURIComponent(price)}`),
  getGiftItems:    () => api.get('/brands/me/gift-items'),
  createGiftItem:  (data) => api.post('/brands/me/gift-items', data),
  updateGiftItem:  (id, data) => api.patch(`/brands/me/gift-items/${id}`, data),
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
  // ── Returns visibility (G-4) — READ-ONLY for brands ───────────────────────
  // Brands see returns on their own transactions; admin actions them.
  // filter: 'open' | 'closed' | undefined (all).
  getReturns:            (filter) => api.get(`/brands/me/returns${filter ? `?filter=${encodeURIComponent(filter)}` : ''}`),
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



export const walletApi = {
  getBalance: () => api.get('/brands/me/wallet'),
  createTopup: (amount) => api.post('/brands/me/wallet/topup', { amount }),
  verifyTopup: (data) => api.post('/brands/me/wallet/topup/verify', data),
  getTransactions: (params) => api.get(`/brands/me/wallet/transactions${params ? '?' + new URLSearchParams(params) : ''}`),
  // Item 17 (features/item17-wallet; rules v1.31 §17A): a withdrawal is a request INFLX pays. It is
  // sent to the brand's one saved bank account; the body carries the amount and nothing else.
  requestWithdrawal: (amount) => api.post('/brands/me/wallet/withdraw', { amount }),
  getWithdrawals: () => api.get('/brands/me/wallet/withdrawals'),
  getWithdrawOptions: () => api.get('/brands/me/wallet/withdraw'),
  getLocked: () => api.get('/brands/me/wallet/locked'),
  getSales: (filter, offset) => api.get(`/brands/me/wallet/sales?limit=100&offset=${offset || 0}${filter && filter !== 'all' ? `&filter=${filter}` : ''}`),
  getHistory: (filter, offset) => api.get(`/brands/me/wallet/history?limit=50&offset=${offset || 0}${filter && filter !== 'all' ? `&filter=${filter}` : ''}`),
};

// Item 17 — Admin · Money, one section (board AM1–AM12). Every call needs the 'payouts' capability.
const qs = (o) => { const p = new URLSearchParams(); Object.entries(o || {}).forEach(([k, v]) => { if (v != null && v !== '' && v !== 'all') p.set(k, v); }); const s = p.toString(); return s ? `?${s}` : ''; };
export const moneyApi = {
  overview: () => api.get('/admin/money/overview'),
  withdrawals: (status) => api.get(`/admin/money/withdrawals${qs({ status })}`),
  withdrawal: (id) => api.get(`/admin/money/withdrawals/${id}`),
  markProcessed: (id, body) => api.post(`/admin/money/withdrawals/${id}/processed`, body),
  couldNotProcess: (id, body) => api.post(`/admin/money/withdrawals/${id}/could-not-process`, body),
  balances: (kind, q) => api.get(`/admin/money/balances${qs({ kind, q })}`),
  person: (kind, id, tab) => api.get(`/admin/money/balances/${kind}/${id}${qs({ tab })}`),
  sales: (filter) => api.get(`/admin/money/sales${qs({ filter, limit: 100 })}`),
  collaborations: (tab) => api.get(`/admin/money/collaborations${qs({ tab })}`),
  added: () => api.get('/admin/money/added?limit=100'),
  creditTopup: (orderId, body) => api.post(`/admin/money/added/${encodeURIComponent(orderId)}/credit`, body),
  movements: (q, group) => api.get(`/admin/money/movements${qs({ q, group, limit: 200 })}`),
  corrections: () => api.get('/admin/money/corrections'),
  releasePayment: (body) => api.post('/admin/money/corrections/release-payment', body),
  returnLocked: (body) => api.post('/admin/money/corrections/return-locked', body),
  correctBalance: (body) => api.post('/admin/money/corrections/correct-balance', body),
};

export const campaignApi = {
  list: () => api.get('/campaigns'),
  create: (data) => api.post('/campaigns', data),
  get: (id) => api.get(`/campaigns/${id}`),
  update: (id, data) => api.patch(`/campaigns/${id}`, data),
  delete: (id) => api.delete(`/campaigns/${id}`),
  publish: (id) => api.post(`/campaigns/${id}/publish`),
  cancel: (id) => api.post(`/campaigns/${id}/cancel`),
  // collab-part5 — the deliberate finish. Completes rather than aborts; the only way to
  // close an open-ended sales campaign, and refuses while a creator is owed money or has
  // work awaiting review.
  end: (id) => api.post(`/campaigns/${id}/end`),
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
  // post-performance-v2 (P7): the campaign's one "Update now" — every link read once; once a day; budget-gated.
  refreshEngagement: (id) => api.post(`/brands/me/campaigns/${id}/engagement/refresh`, {}),
  getConversions: (id) => api.get(`/brands/me/campaigns/${id}/conversions`),
  // Command Center Phase 2 — store-clicks rollup (per-influencer + per-set)
  getClicks: (id) => api.get(`/brands/me/campaigns/${id}/clicks`),
  // Command Center Phase 3 — per-creator date-change request/approve flow
  getDateChangeRequests: (id) => api.get(`/brands/me/campaigns/${id}/date-change-requests`),
  decideDateChange: (ciId, requestId, action) =>
    api.post(`/campaign-influencers/${ciId}/date-change/${requestId}/decision`, { action }),
  // Influencer-app create-request endpoint (brand-web doesn't call this; the
  // mobile influencer screen is a follow-up — kept here for completeness):
  // POST /campaign-influencers/:id/date-change { requested_start, requested_end, reason }
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
  // Distinct tagged states + their cities → { states: [{ state, creators, cities[] }] }.
  // Drives the State → City dropdowns on Discover.
  locations: () => api.get('/influencers/locations'),
  // Market analytics — single aggregate response (all charts).
  // Optional scope: city, niche, tier (each comma-separated).
  analytics: (params) => api.get(`/influencers/analytics${params ? '?' + new URLSearchParams(params) : ''}`),
};

// ─── Influencer groups (F-5) — server-persisted, brand-scoped ───────────────
// Replaces the old browser-localStorage groups in the campaign wizard. Each
// group response carries { id, name, member_count, influencer_ids[], members[] }
// where members[] = { id, full_name, instagram_handle } — the shape the wizard's
// addGroupToSet() expands into a set.
export const influencerGroupApi = {
  list:         ()             => api.get('/brands/me/influencer-groups'),
  create:       (data)         => api.post('/brands/me/influencer-groups', data),           // { name, influencer_ids? }
  rename:       (id, name)     => api.patch(`/brands/me/influencer-groups/${id}`, { name }),
  remove:       (id)           => api.delete(`/brands/me/influencer-groups/${id}`),
  addMembers:   (id, ids)      => api.post(`/brands/me/influencer-groups/${id}/members`, { influencer_ids: ids }),
  removeMember: (id, infId)    => api.delete(`/brands/me/influencer-groups/${id}/members/${infId}`),
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
  // Item 12 (approval Q3): `complete` is retired for both modes; the shoot is marked in the app.
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

// Admin uploads a free stock image for a master dish. Gets a presigned URL,
// PUTs the file to R2 (or mock-POST), and returns the PERMANENT public_url to
// store in master_dishes.default_image_url. No gallery row (stock is not a
// brand asset). Mirrors uploadFileToGallery's transport.
export async function uploadAdminStockImage(file, presignFn) {
  if (!file) return { error: { message: 'No file provided' } };
  // presignFn lets a caller use its OWN capability-scoped presign endpoint
  // (e.g. the App Builder passes sectionApi.stockUploadUrl so section admins
  // don't need the food 'master_data' capability). Defaults to master-dishes.
  const presign = await (presignFn || adminApi.stockUploadUrl)({
    file_name: file.name,
    file_type: file.type || 'application/octet-stream',
    file_size_bytes: file.size,
  });
  if (!(presign.success || presign.ok)) return { error: presign.error || { message: 'Upload URL failed' } };
  const { upload_url, method, key, public_url } = presign.data;
  try {
    if ((method || 'PUT') === 'PUT') {
      const putRes = await fetch(upload_url, {
        method: 'PUT',
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
        body: file,
      });
      if (!putRes.ok) return { error: { message: `R2 upload failed (${putRes.status})` } };
    } else {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('key', key);
      const token = getToken();
      const postRes = await fetch(upload_url, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd,
      });
      if (!postRes.ok) return { error: { message: `Mock upload failed (${postRes.status})` } };
    }
  } catch (err) {
    return { error: { message: `Upload failed: ${err.message}` } };
  }
  return { public_url };
}

// Item 12 (approval Q2): the content doors — read, media, review, confirm-live — are retired
// server-side. Content is sent, reviewed and confirmed in the app. post-performance-v2 (P11): the
// per-deliverable stats refresh is gone too; the campaign's numbers come from campaignApi.getEngagement.

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
  // Order Fulfillment Engine Unit 3 — platform order oversight.
  listOrders: (params) => api.get(`/admin/orders${params ? '?' + new URLSearchParams(params) : ''}`),
  getCommerceSummary: (days = 30) => api.get(`/admin/commerce-summary?days=${days}`),
  updateOrderStatus: (id, data) => api.patch(`/admin/orders/${id}/status`, data),
  getBrands: (status, search, page) => api.get(`/admin/brands?status=${status || 'all'}&search=${encodeURIComponent(search || '')}&page=${page || 1}`),
  // The creator list — same shape as getBrands so both pages behave identically.
  // Contract: features/admin-account-review (item 2)
  getInfluencers: (status, search, page) =>
    api.get(`/admin/influencers?status=${status || 'all'}&search=${encodeURIComponent(search || '')}&page=${page || 1}`),
  getBrandQueue: () => api.get('/admin/queue/brands'),
  getInfluencerQueue: () => api.get('/admin/queue/influencers'),
  updateBrandStatus: (id, data) => api.patch(`/admin/brands/${id}/status`, data),
  updateInfluencerStatus: (id, data) => api.patch(`/admin/influencers/${id}/status`, data),
  getBrandById: (id) => api.get(`/brands/${id}`),
  getInfluencerById: (id) => api.get(`/influencers/${id}`),
  // registration-and-profile §9A.3 — the "Other" niche queue: who typed what, map her to an
  // existing niche, or add a niche to the reference list (and map her in the same call).
  // Capability: approvals.
  listOtherNiches: () => api.get('/admin/niches/other'),
  mapOtherNiche:   (influencerId, data) => api.post(`/admin/niches/other/${encodeURIComponent(influencerId)}/map`, data),
  createNiche:     (data) => api.post('/admin/niches', data),
  getEscrow: (status) => api.get(`/admin/escrow?status=${status || 'all'}`),
  releaseEscrow: (id, reason) => api.post(`/admin/escrow/${id}/release`, { override_reason: reason }),
  getAdminUsers: () => api.get('/admin/users'),
  createAdminUser: (data) => api.post('/admin/users', data),
  getPaymentConfig: () => api.get('/admin/config/payments'),
  updatePaymentConfig: (data) => api.patch('/admin/config/payments', data),
  // Item 6 (N22) — the platform settings the collaboration rules depend on, with their audit.
  // Contract: features/item6-negotiation
  getPlatformSettings: () => api.get('/admin/platform-settings'),
  updatePlatformSettings: (data) => api.patch('/admin/platform-settings', data),
  // Item 7 — the versioned standard terms. Contract: features/item7-agreement
  getStandardTerms: () => api.get('/admin/standard-terms'),
  getStandardTermsVersion: (v) => api.get(`/admin/standard-terms/${encodeURIComponent(v)}`),
  publishStandardTerms: (data) => api.post('/admin/standard-terms', data),
  setBrandPlatformFee: (brandId, pct) => api.patch(`/admin/brands/${brandId}/platform-fee`, { platform_fee_pct: pct }),
  // Wave 1 — per-brand L3 commerce-commission override + per-influencer TDS controls
  setBrandCommerceCommissionOverride: (brandId, pct) =>
    api.patch(`/admin/brands/${brandId}/commerce-commission-override`, { commerce_commission_override_pct: pct }),
  setInfluencerTaxControls: (influencerId, tdsOverridePct, tdsExempt) =>
    api.patch(`/admin/influencers/${influencerId}/tax-controls`, { tds_override_pct: tdsOverridePct, tds_exempt: tdsExempt }),
  rescrapeInfluencer: (id) => api.post(`/influencers/${id}/rescrape`),
  // Item 3b — social numbers admin (handle checks, flags, measure now, costs). Contract: features/item3b-social-numbers
  socialHandleChecks:   ()           => api.get('/admin/social/handle-checks'),
  socialConfirmHandle:  (accountId)  => api.post(`/admin/social/accounts/${accountId}/confirm`),
  socialRejectHandle:   (accountId, reason) => api.post(`/admin/social/accounts/${accountId}/reject`, { reason }),
  socialMeasureNow:     (accountId)  => api.post(`/admin/social/accounts/${accountId}/measure-now`),
  socialFlags:          ()           => api.get('/admin/social/flags'),
  socialResolveFlag:    (flagId)     => api.post(`/admin/social/flags/${flagId}/resolve`),
  socialCosts:          (month)      => api.get(`/admin/social/costs${month ? `?month=${month}` : ''}`),
  getInfluencerSocial:  (id)         => api.get(`/admin/influencers/${id}/social`),
  getAnalytics: (days = 30) => api.get(`/admin/analytics?days=${days}`),
  getProductionQueue: () => api.get('/admin/production/queue'),
  // Item 11 — Test parcels (R18). Admin plays the courier while the Shiprocket account does
  // not exist; every press goes through the same webhook a real provider will reach.
  // Contract: features/item11-remote
  getTestParcels:         ()            => api.get('/admin/test-parcels'),
  getTestParcelEvents:    (id)          => api.get(`/admin/test-parcels/${id}/events`),
  injectTestParcelEvent:  (id, body)    => api.post(`/admin/test-parcels/${id}/events`, body),
  getWithdrawals: (status, search, page) => api.get(`/admin/withdrawals?status=${status || 'all'}&search=${encodeURIComponent(search || '')}&page=${page || 1}`),
  processWithdrawal: (id, action, reason) => api.post(`/admin/withdrawals/${id}/process`, { action, reason }),
  getBrandWithdrawals: (status, search, page) => api.get(`/admin/brand-withdrawals?status=${status || 'all'}&search=${encodeURIComponent(search || '')}&page=${page || 1}`),
  processBrandWithdrawal: (id, action, reason) => api.post(`/admin/brand-withdrawals/${id}/process`, { action, reason }),
  // ── Returns workflow (G-4) — admin queue + actions. Paths match
  //    returns.routes.js adminRouter (mounted at /admin). Gated server-side
  //    by requireAnyAdminRole.
  getReturns:        (status) => api.get(`/admin/returns${status ? `?status=${encodeURIComponent(status)}` : ''}`),
  approveReturn:     (id, refund_amount, admin_notes) => api.post(`/admin/returns/${id}/approve`, { refund_amount, admin_notes }),
  rejectReturn:      (id, admin_notes) => api.post(`/admin/returns/${id}/reject`, { admin_notes }),
  markReturnRefunded: (id, razorpay_refund_id) => api.post(`/admin/returns/${id}/mark-refunded`, { razorpay_refund_id }),
  // Wave 4 — monthly tax summary (GST / TCS / TDS) for filing
  getTaxSummary: (month) => api.get(`/admin/tax-summary${month ? `?month=${encodeURIComponent(month)}` : ''}`),
  // Master dishes — admin CRUD for the restaurant dish catalogue

  // Dish groups — food discovery tiles (Biryani, Paratha, Pizza...)
  getDishGroupMembers:(id) => api.get(`/admin/dish-groups/${id}/members`),
  suggestDishGroupMembers: (q) => api.get(`/admin/dish-groups/suggest?q=${encodeURIComponent(q || '')}`),

  // Creator Experience Engine (System B) wrappers REMOVED — Concept P0
  // (2026-07-23): backend routes deleted, pages deleted, tables ship empty.

  // ─── Shopper app config (video autoplay and sound, COD) ────────────────────
  getFollowerAppConfig:    () => api.get('/follower/app-config'),
  updateFollowerAppConfig: (patch) => api.patch('/admin/app-config', { config: patch }),

  // ─── Post moderation queue (Post/Concept P2, mig 140) ──────────────────────
  listPostQueue: (status) => api.get(`/admin/posts?status=${encodeURIComponent(status || 'submitted')}`),
  approvePost:   (id) => api.post(`/admin/posts/${encodeURIComponent(id)}/approve`, {}),
  rejectPost:    (id, reason) => api.post(`/admin/posts/${encodeURIComponent(id)}/reject`, { reason }),

  // ─── Shopper app (follower-app-v2): comment reports, the feed's readiness and preview ──
  listReportedComments: () => api.get('/admin/shopper/comments'),
  decideComment:        (id, decision) => api.post(`/admin/shopper/comments/${encodeURIComponent(id)}/decide`, { decision }),
  feedReadiness:        () => api.get('/admin/shopper/feed/readiness'),
  feedPreview:          (phone) => api.get(`/admin/shopper/feed/preview?phone=${encodeURIComponent(phone || '')}`),

  // Dish Review Queue (flywheel) — custom names sellers typed

  // ─── Tag vocabulary (merch-engine Phase 1a) ────────────────────────────────
  // Fixed tags brands pick from while listing; admin Collections rule on these.
  listTagVocabulary: (scope) => api.get(`/admin/tag-vocabulary${scope ? `?scope=${encodeURIComponent(scope)}` : ''}`),
  createTagVocab:    (data) => api.post('/admin/tag-vocabulary', data),
  updateTagVocab:    (id, data) => api.patch(`/admin/tag-vocabulary/${id}`, data),
  deleteTagVocab:    (id) => api.delete(`/admin/tag-vocabulary/${id}`),

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

  // ─── Admin capabilities / permissions model (B-2) ──────────────────────────
  // getMe drives nav scoping (caller's admin_role + capabilities + active);
  // getCapabilityCatalog feeds the user-management checkbox builder; the user
  // create/update calls are superadmin-only server-side.
  getMe:                 () => api.get('/admin/me'),
  getCapabilityCatalog:  () => api.get('/admin/capabilities'),
  updateAdminUser:       (id, data) => api.patch(`/admin/users/${encodeURIComponent(id)}`, data),
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
