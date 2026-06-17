# 02 — Workflow: Cart (functional)

1. Follower on a Product Detail page → taps **Add to Cart** (online_order CTA).
   - Size required first (existing guard). Item + variant + 4-ID tracking + offer +
     creator handle pushed to `CartContext` (cross-brand → confirm replace).
2. **Cart** opens: item rows (image · name · variant · brand · "via @creator" · qty
   stepper · price · remove), Cart Summary (Subtotal / Shipping / Creator discount /
   Total estimate), **CHECKOUT**.
3. CHECKOUT → **OnlineOrderScreen** (existing): pick/add delivery address → live
   Razorpay → `createOrder` → `verifyOrder`.
4. Backend writes the order + `follower_transactions` (4 IDs) + credits the
   influencer's commission to `pending_balance`; 30-day cron releases to wallet.
5. Success → OrderDetail (status/tracking).

Cart persists across app restarts (AsyncStorage). Restaurant cart path unchanged.
