# 02 — Workflow: Checkout flow

1. Cart → CHECKOUT → `OnlineOrderScreen` step 1 (Shipping): pick/add address →
   CONTINUE TO PAYMENT.
2. Step 2 (Payment): Razorpay method confirm → CONTINUE TO REVIEW.
3. Step 3 (Review): items + via-@creator + Subtotal/Shipping/Creator discount/Total +
   address → PLACE ORDER.
4. PLACE ORDER → `createOrder` (4-ID payload) → Razorpay secure sheet → `verifyOrder`.
5. Backend writes the order + `follower_transactions` (4 IDs) + influencer commission
   to `pending_balance`; 30-day cron releases to wallet.
6. → OrderConfirmation (✓ + Order # + Paid + VIEW ORDER → OrderDetail).

Restaurant cart path: same real `createOrder`→`processPayment`(live Razorpay)→verify.
