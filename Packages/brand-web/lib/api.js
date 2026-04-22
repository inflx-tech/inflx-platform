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

export function clearSession() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('inflx_token');
    localStorage.removeItem('inflx_user');
    document.cookie = 'inflx_token=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
    window.location.href = '/login';
  }
}

let isRefreshing = false;
let refreshPromise = null;

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
  // On 401, try refreshing the token once before clearing session
  if (res.status === 401 && token) {
    const refreshed = await tryRefreshToken();
    if (refreshed) {
      const newToken = getToken();
      const retryHeaders = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${newToken}` };
      try {
        res = await fetch(`${API_BASE}${path}`, { method, headers: retryHeaders, credentials: 'include', body: body ? JSON.stringify(body) : undefined });
      } catch {
        return { ok: false, success: false, error: { code: 'NETWORK_ERROR', message: 'Cannot connect to server.' } };
      }
    } else {
      clearSession();
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
};

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
};

export const walletApi = {
  getBalance: () => api.get('/brands/me/wallet'),
  createTopup: (amount) => api.post('/brands/me/wallet/topup', { amount }),
  verifyTopup: (data) => api.post('/brands/me/wallet/topup/verify', data),
  getTransactions: (params) => api.get(`/brands/me/wallet/transactions${params ? '?' + new URLSearchParams(params) : ''}`),
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
  search: (params) => api.get(`/influencers/search${params ? '?' + new URLSearchParams(params) : ''}`),
};

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
};

export const notificationApi = {
  list: () => api.get('/notifications'),
  markAllRead: () => api.post('/notifications/read-all'),
};

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
