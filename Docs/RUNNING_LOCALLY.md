# Running INFLX Locally — Complete Guide

## Prerequisites

- Node.js 18+
- PostgreSQL (via Supabase or local)
- Android Studio (for mobile emulator)
- pnpm

---

## 1. Clone and install root deps

```bash
cd INFLX
pnpm install
```

---

## 2. Set up backend environment

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env` with your values:

```env
# ── Required ──────────────────────────────────
DATABASE_URL=postgresql://...        # Supabase connection string
JWT_SECRET=your-secret-here
JWT_EXPIRY=15m
REFRESH_TOKEN_EXPIRY=30d
ENCRYPTION_KEY=<64 hex chars>        # node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# ── Optional (defaults shown) ────────────────
PORT=3001
OTP_MOCK=true                        # Use 000000 for all OTPs in dev
RAZORPAY_MOCK=true                   # Use test mode payments
APIFY_MOCK=true                      # Mock Instagram scraping
FCM_MOCK=true                        # Log pushes instead of sending
ENABLE_CRONS=false                   # Set true to enable background jobs
```

---

## 3. Run database migrations and seed

```bash
# Apply schema
psql $DATABASE_URL < backend/migrations/001_initial_schema.sql

# Seed test accounts
cd backend
node scripts/seed.js
```

---

## 4. Start all services

### Option A: Start everything at once

```bash
# From root directory
pnpm run dev:all
```

This starts:
- Backend API on `http://localhost:3001`
- Admin web on `http://localhost:3003`
- Brand web on `http://localhost:3002`

### Option B: Start individually

```bash
# Backend
pnpm run dev:backend

# Admin web
pnpm run dev:admin

# Brand web
pnpm run dev:brand
```

---

## 5. Run Android emulator

See `docs/ANDROID_SETUP.md` for full emulator setup instructions.

```bash
# Start Metro bundler
pnpm run dev:mobile

# In a separate terminal, run on emulator
pnpm run dev:android
```

---

## 6. Verify everything is working

1. **Backend**: `curl http://localhost:3001/v1/admin/stats` — should return stats (with admin JWT)
2. **Admin web**: Open `http://localhost:3003` — redirects to login
3. **Brand web**: Open `http://localhost:3002` — redirects to login
4. **Mobile**: App opens on emulator

---

## Quick dev login flow

All OTPs are `000000` in dev mode (`OTP_MOCK=true`).

See `docs/TEST_ACCOUNTS.md` for test phone numbers.
