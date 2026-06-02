'use client';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/v1').replace(/\/+$/, '');

function getToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('inflx_token');
}

function clearSession() {
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
        credentials: 'include',
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
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      credentials: 'include',
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    return { success: false, error: { code: 'NETWORK_ERROR', message: 'Cannot connect to server.' } };
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
        return { success: false, error: { code: 'NETWORK_ERROR', message: 'Cannot connect to server.' } };
      }
    } else {
      clearSession();
      return { success: false, error: { code: 'UNAUTHORIZED', message: 'Session expired.' } };
    }
  }

  try { return await res.json(); } catch { return { success: false, error: { code: 'PARSE_ERROR', message: 'Invalid server response.' } }; }
}

export const api = {
  get:    (path)        => request('GET', path, null),
  post:   (path, body)  => request('POST', path, body),
  put:    (path, body)  => request('PUT', path, body),
  patch:  (path, body)  => request('PATCH', path, body),
  delete: (path)        => request('DELETE', path, null),
};

// Auth
export const authApi = {
  sendOtp: (phone) => api.post('/auth/send-otp', { phone }),
  verifyOtp: (phone, otp) => api.post('/auth/verify-otp', { phone, otp, role: 'admin' }),
  // Server-side revoke. Backend clears the HttpOnly refresh cookie so
  // a stolen cookie can't be replayed.
  logout: () => api.post('/auth/logout'),
};

// Re-exported so the dashboard layout can fire a proactive refresh on
// cold start, before any data fetch races against an expired token.
export { tryRefreshToken };

// Admin
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

  // L2 Campaign Protection Fee tiers
  listEscrowFeeTiers:   () => api.get('/admin/escrow-fee-tiers'),
  createEscrowFeeTier:  (data) => api.post('/admin/escrow-fee-tiers', data),
  updateEscrowFeeTier:  (tierKey, data) => api.patch(`/admin/escrow-fee-tiers/${encodeURIComponent(tierKey)}`, data),
  deleteEscrowFeeTier:  (tierKey) => api.delete(`/admin/escrow-fee-tiers/${encodeURIComponent(tierKey)}`),
  setBrandEscrowFeeOverride: (brandId, pct) =>
    api.patch(`/admin/brands/${brandId}/escrow-fee-override`, { escrow_fee_override_pct: pct }),
  rescrapeInfluencer: (id) => api.post(`/influencers/${id}/rescrape`),
  getAnalytics: (days = 30) => api.get(`/admin/analytics?days=${days}`),
  getProductionQueue: () => api.get('/admin/production/queue'),
  getWithdrawals: (status, search, page) => api.get(`/admin/withdrawals?status=${status || 'all'}&search=${encodeURIComponent(search || '')}&page=${page || 1}`),
  processWithdrawal: (id, action, reason) => api.post(`/admin/withdrawals/${id}/process`, { action, reason }),
  // Master dishes — admin CRUD for the restaurant dish catalogue
  listMasterDishes: (cuisine, section, search, page) =>
    api.get(`/admin/master-dishes?cuisine=${encodeURIComponent(cuisine || '')}&section=${encodeURIComponent(section || '')}&search=${encodeURIComponent(search || '')}&page=${page || 1}`),
  listCuisines:       () => api.get('/admin/master-dishes/cuisines'),
  createMasterDish:   (data) => api.post('/admin/master-dishes', data),
  updateMasterDish:   (id, data) => api.patch(`/admin/master-dishes/${id}`, data),
  deleteMasterDish:   (id) => api.delete(`/admin/master-dishes/${id}`),

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
  // Triage list
  listLeads: (params = {}) => {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') q.set(k, v); });
    return api.get(`/admin/marketing/leads?${q.toString()}`);
  },
  // Detail
  getLeadDetail: (type, id) => api.get(`/admin/marketing/leads/${type}/${id}`),
  // Intake
  intakeLead: (payload) => api.post('/admin/marketing/leads/intake', payload),
  intakeLeadBulk: (rows) => api.post('/admin/marketing/leads/intake/bulk', { rows }),
  // Activity + status
  logActivity: (type, id, payload) => api.post(`/admin/marketing/leads/${type}/${id}/activity`, payload),
  updateStatus: (type, id, payload) => api.patch(`/admin/marketing/leads/${type}/${id}/status`, payload),
  // Inbox / funnel
  getInbox: () => api.get('/admin/marketing/inbox'),
  getFunnel: () => api.get('/admin/marketing/funnel'),
  // Settings
  getSettings: () => api.get('/admin/marketing/settings'),
  updateSettings: (data) => api.patch('/admin/marketing/settings', data),
};

// Referral admin API (Contract 2 — /admin/referrals/*)
export const referralApi = {
  getSettings:    () => api.get('/admin/referrals/settings'),
  updateSettings: (data) => api.patch('/admin/referrals/settings', data),
  listEdges: (params = {}) => {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') q.set(k, v); });
    return api.get(`/admin/referrals/edges?${q.toString()}`);
  },
  createEdge: (data) => api.post('/admin/referrals/edges', data),
  updateEdge: (id, data) => api.patch(`/admin/referrals/edges/${id}`, data),
  listLedger: (params = {}) => {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') q.set(k, v); });
    return api.get(`/admin/referrals/ledger?${q.toString()}`);
  },
  getSummary: () => api.get('/admin/referrals/summary'),
  // Agencies directory + approval (referral-agency-admin)
  listAgencies: (params = {}) => {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') q.set(k, v); });
    return api.get(`/admin/agencies?${q.toString()}`);
  },
  updateAgencyStatus: (id, data) => api.patch(`/admin/agencies/${id}/status`, data),
};

// Section Manager admin API (Creator Vibe Phase B — /admin/sections/*)
export const sectionApi = {
  getSections: (screen, scopeType = 'global', scopeValue = '') => {
    const q = new URLSearchParams({ scope_type: scopeType });
    if (scopeValue) q.set('scope_value', scopeValue);
    return api.get(`/admin/sections/${screen}?${q.toString()}`);
  },
  saveSections: (screen, payload) => api.put(`/admin/sections/${screen}`, payload),
  deleteSection: (id) => api.delete(`/admin/sections/id/${id}`),
};

export function getStoredUser() {
  if (typeof window === 'undefined') return null;
  try { return JSON.parse(localStorage.getItem('inflx_user') || 'null'); } catch { return null; }
}
