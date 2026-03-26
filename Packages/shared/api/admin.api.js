export function createAdminApi(client) {
  return {
    getStats: () => client.get('/admin/stats'),

    // Approval queues
    getBrandQueue: () => client.get('/admin/queue/brands'),
    getInfluencerQueue: () => client.get('/admin/queue/influencers'),
    updateBrandStatus: (id, data) => client.patch(`/admin/brands/${id}/status`, data),
    updateInfluencerStatus: (id, data) => client.patch(`/admin/influencers/${id}/status`, data),

    // Brand profiles
    getBrandById: (id) => client.get(`/brands/${id}`),
    getInfluencerById: (id) => client.get(`/influencers/${id}`),

    // Escrow
    getEscrow: (params) => {
      const qs = params ? '?' + new URLSearchParams(params).toString() : '';
      return client.get(`/admin/escrow${qs}`);
    },
    releaseEscrow: (id, data) => client.post(`/admin/escrow/${id}/release`, data),

    // Users
    getAdminUsers: () => client.get('/admin/users'),
    createAdminUser: (data) => client.post('/admin/users', data),
  };
}
