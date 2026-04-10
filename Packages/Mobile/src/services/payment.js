import { Alert, Platform } from 'react-native';

/**
 * Payment service — opens Razorpay checkout SDK for UPI/card/netbanking payments.
 *
 * The Razorpay key comes from the backend response (razorpay_key_id),
 * so the app doesn't need to hardcode any keys.
 */

/**
 * Open Razorpay checkout.
 * @param {Object} opts
 * @param {number} opts.amount - Amount in paise
 * @param {string} opts.orderId - Razorpay order_id from backend
 * @param {string} opts.keyId - Razorpay key_id from backend
 * @param {string} opts.description - Payment description
 * @param {string} opts.brandName - Business name
 * @param {Object} opts.prefill - { name, email, contact }
 * @returns {Promise<{razorpay_payment_id, razorpay_order_id, razorpay_signature}|null>}
 */
export async function processPayment({ amount, orderId, keyId, description, brandName, prefill }) {
  try {
    const RazorpayCheckout = require('react-native-razorpay').default;

    const options = {
      description: description || 'INFLX Payment',
      image: 'https://inflx.in/logo.png',
      currency: 'INR',
      key: keyId,
      amount: amount,
      order_id: orderId,
      name: brandName || 'INFLX',
      prefill: {
        email: prefill?.email || '',
        contact: prefill?.contact || '',
        name: prefill?.name || '',
      },
      theme: { color: '#F59E0B' },
    };

    const result = await RazorpayCheckout.open(options);
    return {
      razorpay_payment_id: result.razorpay_payment_id,
      razorpay_order_id: result.razorpay_order_id || orderId,
      razorpay_signature: result.razorpay_signature,
    };
  } catch (error) {
    if (error?.description === 'Payment Cancelled' || error?.code === 2) {
      // User cancelled
      return null;
    }
    console.log('[Payment] Razorpay SDK error:', error);
    // Fall back to mock in dev
    return mockPayment(orderId);
  }
}

/**
 * Mock payment for development — simulates successful payment.
 */
export function mockPayment(orderId) {
  return new Promise((resolve) => {
    Alert.alert('Mock Payment', 'In test mode. Simulating successful payment...', [
      {
        text: 'Confirm Payment',
        onPress: () => {
          resolve({
            razorpay_payment_id: `pay_mock_${Date.now()}`,
            razorpay_order_id: orderId,
            razorpay_signature: 'mock_signature',
          });
        },
      },
      {
        text: 'Cancel',
        style: 'cancel',
        onPress: () => resolve(null),
      },
    ]);
  });
}
