# INFLX Test Accounts

All accounts use OTP **`000000`** in dev mode (`OTP_MOCK=true`).

---

## Admin Accounts

| Phone | Role | Admin Role | Purpose |
|-------|------|-----------|---------|
| +91 9000000001 | admin | superadmin | Full access — approve brands, manage escrow, all settings |
| +91 9000000002 | admin | reviewer | Approve/reject brands and influencers only |
| +91 9000000003 | admin | finance | Escrow management and payout queue |

**Login at**: `http://localhost:3003`

---

## Brand Accounts

| Phone | Status | Purpose |
|-------|--------|---------|
| +91 9000000010 | approved | Main test brand — Priya's Kitchen (restaurant, Mumbai) |
| +91 9000000011 | pending | Brand awaiting approval — use admin to approve |
| +91 9000000012 | rejected | Rejected brand — has rejection reason set |

**Login at**: `http://localhost:3002`

After login, brands with `pending` status see the waiting screen. Approve them using the admin dashboard at `localhost:3003 → Approvals`.

---

## Influencer Accounts

| Phone | Handle | Status | Followers |
|-------|--------|--------|-----------|
| +91 9000000020 | @ananya_foodie | approved | 45,000 |
| +91 9000000021 | @rahul_fitness | approved | 12,000 |
| +91 9000000022 | @priya_fashion | pending | 8,500 |

**Login in mobile app** (React Native) — role detected from JWT, routes to influencer tabs.

---

## Follower Accounts

| Phone | Status | Purpose |
|-------|--------|---------|
| +91 9000000030 | active | Registered follower with address |
| +91 9000000031 | active | Follower following @ananya_foodie |

**Login in mobile app** — routes to follower tabs.

---

## Resetting test data

```bash
cd backend && node src/db/seed.js
```

This drops all test data and recreates all 8 accounts with fresh state.

---

## Account states after seed

- Approved brands have ₹50,000 wallet balance
- Approved influencers have their Instagram stats scraped (mocked)
- One active campaign exists linking Brand 1 with Influencer 1
- Escrow entries exist in queued state for T3 testing
