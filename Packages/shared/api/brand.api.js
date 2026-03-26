export function createBrandApi(client) {
  return {
    register: (data) => client.post('/brands/register', data),
    getMe: () => client.get('/brands/me'),
    updateMe: (data) => client.patch('/brands/me', data),
    resubmit: (data) => client.post('/brands/resubmit', data),
    getEnquiries: (params) => {
      const qs = params ? '?' + new URLSearchParams(params).toString() : '';
      return client.get(`/brands/me/enquiries${qs}`);
    },
    updateEnquiry: (id, data) => client.patch(`/brands/me/enquiries/${id}`, data),
  };
}
