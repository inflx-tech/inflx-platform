export function createInfluencerApi(client) {
  return {
    search: (params) => {
      const qs = params ? '?' + new URLSearchParams(params).toString() : '';
      return client.get(`/influencers/search${qs}`);
    },
    getMe: () => client.get('/influencers/me'),
    updateMe: (data) => client.patch('/influencers/me', data),
    getEarnings: () => client.get('/influencers/me/earnings'),
    getCommissions: (params) => {
      const qs = params ? '?' + new URLSearchParams(params).toString() : '';
      return client.get(`/influencers/me/commissions${qs}`);
    },
    withdraw: (data) => client.post('/influencers/me/withdraw', data),
    getWithdrawals: () => client.get('/influencers/me/withdrawals'),
    retryWithdrawal: (id) => client.post(`/influencers/me/withdrawals/${id}/retry`),
    getById: (id) => client.get(`/influencers/${id}`),
    // Item 2 — invitation settings + blocked brands (rules v1.10 §8A)
    getInvitationSettings: () => client.get('/influencers/me/invitation-settings'),
    putInvitationSettings: (data) => client.put('/influencers/me/invitation-settings', data),
    listBlockedBrands: () => client.get('/influencers/me/blocked-brands'),
    blockBrand: (brandId) => client.post('/influencers/me/blocked-brands', { brandId }),
    unblockBrand: (brandId) => client.delete(`/influencers/me/blocked-brands/${brandId}`),
  };
}
