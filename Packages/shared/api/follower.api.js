export function createFollowerApi(client) {
  return {
    register: (data) => client.post('/followers/register', data),
    getMe: () => client.get('/followers/me'),
    addAddress: (data) => client.post('/followers/me/addresses', data),
    getAddresses: () => client.get('/followers/me/addresses'),
    follow: (influencerId) => client.post(`/followers/${influencerId}/follow`),
    unfollow: (influencerId) => client.delete(`/followers/${influencerId}/unfollow`),
    getFeed: () => client.get('/followers/me/feed'),

    // Store
    getStore: (handle) => client.get(`/store/${handle}`),
    getStoreProducts: (handle) => client.get(`/store/${handle}/products`),

    // Transactions
    payAtStore: (data) => client.post('/follower/pay-at-store', data),
    prebook: (data) => client.post('/follower/prebook', data),
    createOrder: (data) => client.post('/follower/orders', data),
    getOrder: (id) => client.get(`/follower/orders/${id}`),
    getOrders: () => client.get('/follower/orders'),
    submitEnquiry: (data) => client.post('/follower/enquiry', data),
  };
}
