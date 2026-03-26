/**
 * Auth API functions
 * These are called with an API client instance
 */

export function createAuthApi(client) {
  return {
    sendOtp: (phone) => client.post('/auth/send-otp', { phone }),
    verifyOtp: (phone, otp) => client.post('/auth/verify-otp', { phone, otp }),
    refresh: () => client.post('/auth/refresh'),
    logout: () => client.post('/auth/logout'),
  };
}
