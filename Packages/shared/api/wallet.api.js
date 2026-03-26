export function createWalletApi(client) {
  return {
    getBalance: () => client.get('/brands/me/wallet'),
    createTopup: (amount) => client.post('/brands/me/wallet/topup', { amount }),
    verifyTopup: (data) => client.post('/brands/me/wallet/topup/verify', data),
    getEscrow: () => client.get('/brands/me/escrow'),
  };
}
