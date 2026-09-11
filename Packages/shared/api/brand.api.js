export function createBrandApi(client) {
  return {
    register: (data) => client.post('/brands/register', data),
    getMe: () => client.get('/brands/me'),
    updateMe: (data) => client.patch('/brands/me', data),
    // Item 2 — pitch settings + blocked creators (rules v1.10 §8A)
    getPitchSettings: () => client.get('/brands/me/pitch-settings'),
    putPitchSettings: (data) => client.put('/brands/me/pitch-settings', data),
    listBlockedCreators: () => client.get('/brands/me/blocked-creators'),
    blockCreator: (influencerId) => client.post('/brands/me/blocked-creators', { influencerId }),
    unblockCreator: (influencerId) => client.delete(`/brands/me/blocked-creators/${influencerId}`),
    // Item 3 — discovery, groups, branches (rules v1.11 §5A)
    discoverCreators: (qs) => client.get(`/brands/me/discover-creators${qs ? '?' + qs : ''}`),
    workedWith: (qs) => client.get(`/brands/me/worked-with${qs ? '?' + qs : ''}`),
    getGroup: (id) => client.get(`/brands/me/influencer-groups/${id}`),
    groupsForCreator: (influencerId) => client.get(`/brands/me/influencer-groups/for-creator/${influencerId}`),
    setGroupsForCreator: (influencerId, groupIds) => client.put(`/brands/me/influencer-groups/for-creator/${influencerId}`, { groupIds }),
    listBranches: () => client.get('/brands/me/branches'),
    createBranch: (data) => client.post('/brands/me/branches', data),
    updateBranch: (id, data) => client.put(`/brands/me/branches/${id}`, data),
    makeMainBranch: (id) => client.post(`/brands/me/branches/${id}/make-main`),
    removeBranch: (id) => client.delete(`/brands/me/branches/${id}`),
    resubmit: (data) => client.post('/brands/resubmit', data),
    getEnquiries: (params) => {
      const qs = params ? '?' + new URLSearchParams(params).toString() : '';
      return client.get(`/brands/me/enquiries${qs}`);
    },
    updateEnquiry: (id, data) => client.patch(`/brands/me/enquiries/${id}`, data),
  };
}
