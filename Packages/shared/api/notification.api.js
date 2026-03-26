export function createNotificationApi(client) {
  return {
    list: () => client.get('/notifications'),
    markAllRead: () => client.post('/notifications/read-all'),
  };
}
