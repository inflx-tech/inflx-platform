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
  };
}
