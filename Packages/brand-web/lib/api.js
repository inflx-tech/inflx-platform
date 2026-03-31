'use client';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/v1').replace(/\/+$/, '');

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

async function request(method, path, body) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  } catch {
    return { ok: false, success: false, error: { code: 'NETWORK_ERROR', message: 'Cannot connect to server.' } };
  }
  if (res.status === 401 && token) { clearSession(); return { ok: false, success: false, error: { code: 'UNAUTHORIZED' } }; }
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
  getEnquiries: (params) => api.get(`/brands/me/enquiries${params ? '?' + new URLSearchParams(params) : ''}`),
  updateEnquiry: (id, data) => api.patch(`/brands/me/enquiries/${id}`, data),
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
  getLive: (id) => api.get(`/campaigns/${id}/live`),
  // Sets
  getSets: (cid) => api.get(`/campaigns/${cid}/sets`),
  createSet: (cid, data) => api.post(`/campaigns/${cid}/sets`, data),
  updateSet: (cid, sid, data) => api.patch(`/campaigns/${cid}/sets/${sid}`, data),
  deleteSet: (cid, sid) => api.delete(`/campaigns/${cid}/sets/${sid}`),
  duplicateSet: (cid, sid) => api.post(`/campaigns/${cid}/sets/${sid}/duplicate`),
  // Offers (legacy)
  createOffer: (cid, sid, data) => api.post(`/campaigns/${cid}/sets/${sid}/offers`, data),
  // Invite
  inviteInfluencer: (cid, sid, data) => api.post(`/campaigns/${cid}/sets/${sid}/invite`, data),
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
  review: (id, data) => api.post(`/deliverables/${id}/review`, data),
  confirmLive: (id) => api.post(`/deliverables/${id}/confirm-live`),
};

export const negotiationApi = {
  get: (id) => api.get(`/negotiations/${id}`),
  respond: (id, data) => api.post(`/negotiations/${id}/respond`, data),
};

export const contractApi = {
  get: (campaignInfluencerId) => api.get(`/contracts/${campaignInfluencerId}`),
  brandSign: (id) => api.post(`/contracts/${id}/brand-sign`),
};

export const notificationApi = {
  list: () => api.get('/notifications'),
  markAllRead: () => api.post('/notifications/read-all'),
};

// fmtMoney — for wallet balances stored in PAISE (÷100 before display)
export function fmtMoney(paise) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format((paise || 0) / 100);
}

// fmtRupees — for campaign budgets stored directly in RUPEES (no ÷100)
export function fmtRupees(rupees) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(rupees || 0);
}

export function fmtNum(n) {
  return new Intl.NumberFormat('en-IN').format(n || 0);
}
