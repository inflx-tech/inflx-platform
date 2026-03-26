export function createCampaignApi(client) {
  return {
    list: (params) => {
      const qs = params ? '?' + new URLSearchParams(params).toString() : '';
      return client.get(`/campaigns${qs}`);
    },
    create: (data) => client.post('/campaigns', data),
    get: (id) => client.get(`/campaigns/${id}`),
    update: (id, data) => client.patch(`/campaigns/${id}`, data),
    delete: (id) => client.delete(`/campaigns/${id}`),
    publish: (id) => client.post(`/campaigns/${id}/publish`),
    getLive: (id) => client.get(`/campaigns/${id}/live`),

    // Sets
    createSet: (campaignId, data) => client.post(`/campaigns/${campaignId}/sets`, data),
    getSets: (campaignId) => client.get(`/campaigns/${campaignId}/sets`),
    updateSet: (campaignId, setId, data) => client.patch(`/campaigns/${campaignId}/sets/${setId}`, data),

    // Offers within sets
    createOffer: (campaignId, setId, data) => client.post(`/campaigns/${campaignId}/sets/${setId}/offers`, data),
    getOffers: (campaignId, setId) => client.get(`/campaigns/${campaignId}/sets/${setId}/offers`),

    // Invite influencer
    inviteInfluencer: (campaignId, setId, data) => client.post(`/campaigns/${campaignId}/sets/${setId}/invite`, data),

    // Analytics
    getEngagement: (campaignId) => client.get(`/brands/me/campaigns/${campaignId}/engagement`),
    getConversions: (campaignId) => client.get(`/brands/me/campaigns/${campaignId}/conversions`),
  };
}
