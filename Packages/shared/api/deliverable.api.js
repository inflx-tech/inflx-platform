export function createDeliverableApi(client) {
  return {
    create: (data) => client.post('/deliverables', data),
    get: (id) => client.get(`/deliverables/${id}`),
    submit: (id, data) => client.post(`/deliverables/${id}/submit`, data),
    review: (id, data) => client.post(`/deliverables/${id}/review`, data),
    submitLive: (id, data) => client.post(`/deliverables/${id}/submit-live`, data),
    confirmLive: (id) => client.post(`/deliverables/${id}/confirm-live`),
  };
}
