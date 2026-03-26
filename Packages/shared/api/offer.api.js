export function createOfferApi(client) {
  return {
    getInbox: () => client.get('/offers/inbox'),
    accept: (offerId) => client.post(`/offers/${offerId}/accept`),
    decline: (offerId) => client.post(`/offers/${offerId}/decline`),
    getNegotiation: (negotiationId) => client.get(`/negotiations/${negotiationId}`),
    submitTurn: (negotiationId, data) => client.post(`/negotiations/${negotiationId}/turn`, data),
  };
}
