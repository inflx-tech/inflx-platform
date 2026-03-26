'use client';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/v1';

function getToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('inflx_token');
}

function clearSession() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('inflx_token');
    localStorage.removeItem('inflx_user');
    window.location.href = '/login';
  }
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
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    return { success: false, error: { code: 'NETWORK_ERROR', message: 'Cannot connect to server.' } };
  }

  if (res.status === 401) { clearSession(); return { success: false, error: { code: 'UNAUTHORIZED', message: 'Session expired.' } }; }

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
  verifyOtp: (phone, otp) => api.post('/auth/verify-otp', { phone, otp }),
};

// Admin
export const adminApi = {
  getStats: () => api.get('/admin/stats'),
  getBrandQueue: () => api.get('/admin/queue/brands'),
  getInfluencerQueue: () => api.get('/admin/queue/influencers'),
  updateBrandStatus: (id, data) => api.patch(`/admin/brands/${id}/status`, data),
  updateInfluencerStatus: (id, data) => api.patch(`/admin/influencers/${id}/status`, data),
  getBrandById: (id) => api.get(`/brands/${id}`),
  getInfluencerById: (id) => api.get(`/influencers/${id}`),
  getEscrow: (status) => api.get(`/admin/escrow?status=${status || 'all'}`),
  releaseEscrow: (id, reason) => api.post(`/admin/escrow/${id}/release`, { override_reason: reason }),
  getAdminUsers: () => api.get('/admin/users'),
};

export function getStoredUser() {
  if (typeof window === 'undefined') return null;
  try { return JSON.parse(localStorage.getItem('inflx_user') || 'null'); } catch { return null; }
}
