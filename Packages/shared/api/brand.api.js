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
    resubmit: (data) => client.post('/brands/resubmit', data),
    getEnquiries: (params) => {
      const qs = params ? '?' + new URLSearchParams(params).toString() : '';
      return client.get(`/brands/me/enquiries${qs}`);
    },
    updateEnquiry: (id, data) => client.patch(`/brands/me/enquiries/${id}`, data),
  };
}
