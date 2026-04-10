import { Alert, Linking, Platform } from 'react-native';

/**
 * Payment service — handles Razorpay checkout + UPI deep linking.
 *
 * Two flows:
 * 1. Razorpay SDK (full checkout with cards, UPI, netbanking)
 * 2. UPI Intent (direct UPI app redirect for quick payments)
 */

// Razorpay test key — swap with live key in production
const RAZORPAY_KEY = 'rzp_test_placeholder'; // TODO: set from env/config

/**
 * Open Razorpay checkout.
 * @param {Object} options
 * @param {number} options.amount - Amount in paise
 * @param {string} options.orderId - Razorpay order_id from backend
 * @param {string} options.description - Payment description
 * @param {string} options.brandName - Business name
 * @param {Object} options.prefill - { name, email, contact }
 * @returns {Promise<{razorpay_payment_id, razorpay_order_id, razorpay_signature}>}
 */
export async function openRazorpayCheckout({ amount, orderId, description, brandName, prefill }) {
  try {
    const RazorpayCheckout = require('react-native-razorpay').default;
    const options = {
      description: description || 'INFLX Payment',
      image: 'https://inflx.in/logo.png',
      currency: 'INR',
      key: RAZORPAY_KEY,
      amount: amount, // paise
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
    if (error.code === 'PAYMENT_CANCELLED') {
      return null; // user cancelled
    }
    throw error;
  }
}

/**
 * Open UPI intent directly (bypasses Razorpay for quick UPI payments).
 * @param {number} amountRupees - Amount in rupees
 * @param {string} upiId - Merchant UPI ID (e.g., inflx@razorpay)
 * @param {string} merchantName - Display name
 * @param {string} transactionNote - Description
 */
export async function openUPIIntent(amountRupees, upiId, merchantName, transactionNote) {
  const url = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(merchantName)}&am=${amountRupees}&cu=INR&tn=${encodeURIComponent(transactionNote)}`;

  const supported = await Linking.canOpenURL(url);
  if (supported) {
    await Linking.openURL(url);
    return true;
  } else {
    Alert.alert('No UPI App', 'Please install a UPI app (Google Pay, PhonePe, Paytm) to make payments');
    return false;
  }
}

/**
 * Mock payment for development — simulates successful payment.
 */
export function mockPayment(orderId) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        razorpay_payment_id: `pay_mock_${Date.now()}`,
        razorpay_order_id: orderId,
        razorpay_signature: 'mock_signature',
      });
    }, 1500);
  });
}

/**
 * Process payment — tries Razorpay first, falls back to mock in dev.
 */
export async function processPayment({ amount, orderId, description, brandName, prefill }) {
  try {
    // Try Razorpay SDK
    const result = await openRazorpayCheckout({ amount, orderId, description, brandName, prefill });
    if (result) return result;
    return null; // cancelled
  } catch (e) {
    console.log('[Payment] Razorpay failed, using mock:', e.message);
    // Fall back to mock payment in dev
    return mockPayment(orderId);
  }
}
