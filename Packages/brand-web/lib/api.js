'use client';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/v1';

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
    return { success: false, error: { code: 'NETWORK_ERROR', message: 'Cannot connect to server.' } };
  }
  if (res.status === 401) { clearSession(); return { success: false, error: { code: 'UNAUTHORIZED' } }; }
  try { return await res.json(); } catch { return { success: false, error: { code: 'PARSE_ERROR' } }; }
}

export const api = {
  get: (p) => request('GET', p, null),
  post: (p, b) => request('POST', p, b),
  patch: (p, b) => request('PATCH', p, b),
  delete: (p) => request('DELETE', p, null),
};

export const authApi = {
  sendOtp: (phone) => api.post('/auth/send-otp', { phone }),
  verifyOtp: (phone, otp) => api.post('/auth/verify-otp', { phone, otp }),
};

export const brandApi = {
  getMe: () => api.get('/brands/me'),
  updateMe: (data) => api.patch('/brands/me', data),
  resubmit: (data) => api.post('/brands/resubmit', data),
  getEscrow: () => api.get('/brands/me/escrow'),
  getEnquiries: (params) => api.get(`/brands/me/enquiries${params ? '?' + new URLSearchParams(params) : ''}`),
  updateEnquiry: (id, data) => api.patch(`/brands/me/enquiries/${id}`, data),
};

export const walletApi = {
  getBalance: () => api.get('/brands/me/wallet'),
  createTopup: (amount) => api.post('/brands/me/wallet/topup', { amount }),
  verifyTopup: (data) => api.post('/brands/me/wallet/topup/verify', data),
};

export const campaignApi = {
  list: () => api.get('/campaigns'),
  create: (data) => api.post('/campaigns', data),
  get: (id) => api.get(`/campaigns/${id}`),
  update: (id, data) => api.patch(`/campaigns/${id}`, data),
  delete: (id) => api.delete(`/campaigns/${id}`),
  publish: (id) => api.post(`/campaigns/${id}/publish`),
  getLive: (id) => api.get(`/campaigns/${id}/live`),
  createSet: (cid, data) => api.post(`/campaigns/${cid}/sets`, data),
  getSets: (cid) => api.get(`/campaigns/${cid}/sets`),
  createOffer: (cid, sid, data) => api.post(`/campaigns/${cid}/sets/${sid}/offers`, data),
  getOffers: (cid, sid) => api.get(`/campaigns/${cid}/sets/${sid}/offers`),
  inviteInfluencer: (cid, sid, data) => api.post(`/campaigns/${cid}/sets/${sid}/invite`, data),
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

export const notificationApi = {
  list: () => api.get('/notifications'),
  markAllRead: () => api.post('/notifications/read-all'),
};

export function fmtMoney(paise) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format((paise || 0) / 100);
}

export function fmtNum(n) {
  return new Intl.NumberFormat('en-IN').format(n || 0);
}
