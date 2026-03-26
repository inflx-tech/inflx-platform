import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../config/api';

async function getToken() {
  try {
    return await AsyncStorage.getItem('inflx_token');
  } catch {
    return null;
  }
}

export async function clearSession() {
  await AsyncStorage.multiRemove(['inflx_token', 'inflx_user']);
}

async function request(method, path, body) {
  const token = await getToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  try {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.status === 401) {
      await clearSession();
      return { success: false, error: { code: 'UNAUTHORIZED', message: 'Session expired. Please log in again.' } };
    }
    return await res.json();
  } catch (e) {
    return { success: false, error: { code: 'NETWORK_ERROR', message: 'Cannot connect to server. Check your connection.' } };
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
  verifyOtp: (phone, otp) => api.post('/auth/verify-otp', { phone, otp }),
  logout: () => api.post('/auth/logout'),
};

export const brandApi = {
  getMe: () => api.get('/brands/me'),
  getWallet: () => api.get('/brands/me/wallet'),
  createTopup: (amount) => api.post('/brands/me/wallet/topup', { amount }),
  getCampaigns: () => api.get('/campaigns'),
  getCampaign: (id) => api.get(`/campaigns/${id}`),
  getCampaignLive: (id) => api.get(`/campaigns/${id}/live`),
  reviewDeliverable: (id, data) => api.post(`/deliverables/${id}/review`, data),
  confirmLive: (id) => api.post(`/deliverables/${id}/confirm-live`),
  getNegotiation: (id) => api.get(`/negotiations/${id}`),
  submitNegotiationTurn: (id, data) => api.post(`/negotiations/${id}/turn`, data),
  getNotifications: () => api.get('/notifications'),
  markAllNotificationsRead: () => api.post('/notifications/read-all'),
};

export const influencerApi = {
  getMe: () => api.get('/influencers/me'),
  getEarnings: () => api.get('/influencers/me/earnings'),
  getOffers: () => api.get('/offers/inbox'),
  acceptOffer: (id) => api.post(`/offers/${id}/accept`),
  declineOffer: (id) => api.post(`/offers/${id}/decline`),
  getNegotiation: (id) => api.get(`/negotiations/${id}`),
  submitNegotiationTurn: (id, data) => api.post(`/negotiations/${id}/turn`, data),
  getDeliverables: () => api.get('/campaigns'),  // via campaign list
  submitDeliverable: (id, data) => api.post(`/deliverables/${id}/submit`, data),
  submitLive: (id, data) => api.post(`/deliverables/${id}/submit-live`, data),
  getContract: (id) => api.get(`/contracts/${id}`),
  signContract: (id, data) => api.post(`/contracts/${id}/sign`, data),
  getCommissions: () => api.get('/influencers/me/commissions'),
  withdraw: (data) => api.post('/influencers/me/withdraw', data),
  getWithdrawals: () => api.get('/influencers/me/withdrawals'),
  retryWithdrawal: (id) => api.post(`/influencers/me/withdrawals/${id}/retry`),
};

export const followerApi = {
  getMe: () => api.get('/followers/me'),
  getFeed: () => api.get('/followers/me/feed'),
  getStore: (handle) => api.get(`/store/${handle}`),
  getStoreProducts: (handle) => api.get(`/store/${handle}/products`),
  follow: (id) => api.post(`/followers/${id}/follow`),
  unfollow: (id) => api.delete(`/followers/${id}/unfollow`),
  payAtStore: (data) => api.post('/follower/pay-at-store', data),
  prebook: (data) => api.post('/follower/prebook', data),
  createOrder: (data) => api.post('/follower/orders', data),
  getOrder: (id) => api.get(`/follower/orders/${id}`),
  submitEnquiry: (data) => api.post('/follower/enquiry', data),
};
