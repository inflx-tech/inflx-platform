'use strict';

/**
 * razorpay-service.test.js — regression guard for
 * features/backend-defect-proration-createorder-unexported/.
 *
 * The mid-cycle proration upgrade (Growth → Pro, live mode) returned
 * PAYMENT_PROVIDER_UNAVAILABLE because razorpay.service defined createOrder
 * but never EXPORTED it — so subscription.controller's
 * `razorpayService.createOrder(...)` (line 379) was `undefined` and threw a
 * TypeError that got masked as a 502. These tests pin the export + behaviour
 * so the regression cannot return.
 *
 * The official `razorpay` SDK is mocked, so no network/keys are needed.
 */

const mockOrdersCreate = jest.fn();
const mockSubsCreate   = jest.fn();

// Mock BEFORE requiring the service — razorpay.service lazy-requires the SDK
// inside _getClient(), so the mock is picked up on first call.
jest.mock('razorpay', () =>
  jest.fn().mockImplementation(() => ({
    orders:        { create: mockOrdersCreate },
    subscriptions: { create: mockSubsCreate, fetch: jest.fn(), cancel: jest.fn() },
  })),
);

const razorpay = require('../src/services/razorpay.service');

describe('razorpay.service exports (regression: createOrder must be exported)', () => {
  test('all four wrapper functions are exported', () => {
    expect(typeof razorpay.createSubscription).toBe('function');
    expect(typeof razorpay.createOrder).toBe('function');       // the regression
    expect(typeof razorpay.fetchSubscription).toBe('function');
    expect(typeof razorpay.cancelSubscription).toBe('function');
  });
});

describe('razorpay.service.createOrder', () => {
  beforeEach(() => { mockOrdersCreate.mockReset(); });

  test('calls orders.create with rounded paise + returns the mapped shape', async () => {
    mockOrdersCreate.mockResolvedValue({
      id: 'order_test_1', amount: 294882, currency: 'INR', status: 'created',
    });

    const res = await razorpay.createOrder({
      amount: 294881.6,                 // fractional paise → must be rounded
      receipt: 'prorate_abc',
      notes: { type: 'proration', brand_id: 'b1' },
    });

    expect(mockOrdersCreate).toHaveBeenCalledTimes(1);
    const arg = mockOrdersCreate.mock.calls[0][0];
    expect(arg.amount).toBe(294882);    // Math.round
    expect(arg.currency).toBe('INR');
    expect(arg.receipt).toBe('prorate_abc');
    expect(arg.notes).toEqual({ type: 'proration', brand_id: 'b1' });

    expect(res).toEqual({
      id: 'order_test_1', amount: 294882, currency: 'INR', status: 'created',
    });
  });

  test('throws when amount is missing / below 1 paise (no SDK call)', async () => {
    await expect(razorpay.createOrder({ amount: 0 })).rejects.toThrow(/amount/);
    expect(mockOrdersCreate).not.toHaveBeenCalled();
  });
});
