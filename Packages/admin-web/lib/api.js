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
  patch:  (path, body)  => request('PATCH', path, body),
  delete: (path)        => request('DELETE', path, null),
};

// Auth
export const authApi = {
  sendOtp: (phone) => api.post('/auth/send-otp', { phone }),
  verifyOtp: (phone, otp) => api.post('/auth/verify-otp', { phone, otp, role: 'admin' }),
};

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
  rescrapeInfluencer: (id) => api.post(`/influencers/${id}/rescrape`),
  getAnalytics: (days = 30) => api.get(`/admin/analytics?days=${days}`),
  getWithdrawals: (status, search, page) => api.get(`/admin/withdrawals?status=${status || 'all'}&search=${encodeURIComponent(search || '')}&page=${page || 1}`),
  processWithdrawal: (id, action, reason) => api.post(`/admin/withdrawals/${id}/process`, { action, reason }),
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

export function getStoredUser() {
  if (typeof window === 'undefined') return null;
  try { return JSON.parse(localStorage.getItem('inflx_user') || 'null'); } catch { return null; }
}
