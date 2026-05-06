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
    // Date-range pre-bookings (car_rental today; hotels/function_hall later).
    // Body shape: { offer_id?, campaign_id, set_id, campaign_influencer_id,
    //               pickup_date, return_date, duration_days, pickup_type }
    prebookDateRange: (data) => client.post('/follower/prebook-daterange', data),
    prebookDateRangeVerify: (data) => client.post('/follower/prebook-daterange/verify', data),
    createOrder: (data) => client.post('/follower/orders', data),
    verifyOrder: (data) => client.post('/follower/orders/verify', data),
    getOrder: (id) => client.get(`/follower/orders/${id}`),
    getOrders: () => client.get('/follower/orders'),
    submitEnquiry: (data) => client.post('/follower/enquiry', data),
  };
}
