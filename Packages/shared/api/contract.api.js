export function createContractApi(client) {
  return {
    generate: (campaignInfluencerId) => client.post(`/contracts/${campaignInfluencerId}/generate`),
    sign: (id, data) => client.post(`/contracts/${id}/sign`, data),
    brandSign: (id, data) => client.post(`/contracts/${id}/brand-sign`, data),
    get: (id) => client.get(`/contracts/${id}`),
  };
}
