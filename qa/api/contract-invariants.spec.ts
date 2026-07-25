import { test, expect, request as pwRequest } from '@playwright/test';

/**
 * WORKFLOW: B1 — API contract & permission invariants (L1).
 * Contract: features/api-contract-invariants/ (locked 2026-05-18).
 *
 * Deterministic, no DB seed, vs the live backend. Locks three
 * platform invariants at the API contract layer:
 *   W1 RBAC            — protected /admin/* not reachable unauth
 *   W2 Attribution     — follower txn refused without creator ids
 *   W3 Auth contract   — phone/otp validation is a typed 422
 *
 * Honest reporting: W2 needs OTP_MOCK=true; if follower auth can't
 * be obtained (OTP flipped / backend cold) W2 SKIPs with a reason —
 * a SKIP is not a pass. W1/W3 always run.
 */

const BASE = (process.env.QA_API_BASE || 'https://inflx-platform.onrender.com/v1').replace(/\/+$/, '');

test.describe('WORKFLOW: B1 API contract & permission invariants', () => {
  test('W1 — protected admin endpoint rejects unauthenticated requests', async () => {
    const ctx = await pwRequest.newContext({ timeout: 15_000 });
    const res = await ctx.get(`${BASE}/admin/queue/brands`, { timeout: 60_000 });
    const status = res.status();
    let body: any = null;
    try { body = await res.json(); } catch { /* non-json */ }

    expect([401, 403], `unauth /admin/queue/brands returned ${status}`).toContain(status);
    expect(body?.success).toBe(false);
    expect(['UNAUTHORIZED', 'FORBIDDEN']).toContain(body?.error?.code);
    await ctx.dispose();
  });

  test('W3 — auth contract: bad phone / missing otp → typed 422; valid phone → success', async () => {
    const ctx = await pwRequest.newContext({ timeout: 15_000 });

    // W3a — non-E.164 phone
    const a = await ctx.post(`${BASE}/auth/send-otp`, { data: { phone: '12345' }, timeout: 60_000 });
    const aJson: any = await a.json().catch(() => null);
    expect(a.status(), `send-otp bad phone returned ${a.status()}`).toBe(422);
    expect(aJson?.error?.code).toBe('VALIDATION_ERROR');
    expect(aJson?.error?.field).toBe('phone');

    // W3b — missing otp
    const b = await ctx.post(`${BASE}/auth/verify-otp`, { data: { phone: '+919876543210' }, timeout: 60_000 });
    const bJson: any = await b.json().catch(() => null);
    expect(b.status(), `verify-otp missing otp returned ${b.status()}`).toBe(422);
    expect(bJson?.error?.code).toBe('VALIDATION_ERROR');

    // W3c — control: valid E.164 → success (proves W3a fails on the rule)
    const c = await ctx.post(`${BASE}/auth/send-otp`, { data: { phone: '+919876543210' }, timeout: 60_000 });
    const cJson: any = await c.json().catch(() => null);
    expect(cJson?.success, `valid send-otp returned ${c.status()} ${JSON.stringify(cJson)}`).toBe(true);

    await ctx.dispose();
  });

  test('W2 — follower txn is refused without creator-attribution ids', async () => {
    const ctx = await pwRequest.newContext({ timeout: 15_000 });
    const phone = `+919${String(Date.now()).slice(-9)}`;

    // Auth a throwaway follower (OTP_MOCK=true → 000000), warm/retry Render.
    let token: string | null = null;
    for (let attempt = 1; attempt <= 3 && !token; attempt++) {
      await ctx.post(`${BASE}/auth/send-otp`, { data: { phone }, timeout: 60_000 }).catch(() => null);
      const v = await ctx
        .post(`${BASE}/auth/verify-otp`, {
          data: { phone, otp: '000000', role: 'follower', name: 'B1 Tester' },
          timeout: 60_000,
        })
        .catch(() => null);
      if (v && v.status() === 200) {
        const vj: any = await v.json().catch(() => null);
        token = vj?.data?.access_token || null;
      }
      if (!token && attempt < 3) await new Promise((r) => setTimeout(r, 4000));
    }

    if (!token) {
      test.skip(true, 'W2 needs follower auth (OTP_MOCK=true). Could not obtain a token — SKIP, not a pass. W1/W3 still asserted.');
    }

    // Transaction WITHOUT campaign_id / set_id / campaign_influencer_id
    const res = await ctx.post(`${BASE}/follower/pay-at-store`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { bill_amount: 100 },
      timeout: 60_000,
    });
    const status = res.status();
    const body: any = await res.json().catch(() => null);

    // Invariant: unattributed txn must be cleanly refused — a 4xx
    // client error, NOT accepted (200) and NOT a server crash (5xx).
    expect(status, `pay-at-store unattributed returned ${status} ${JSON.stringify(body)}`).toBeGreaterThanOrEqual(400);
    expect(status, `pay-at-store unattributed returned ${status} (server error)`).toBeLessThan(500);
    expect(body?.success).toBe(false);
    expect(typeof body?.error?.code, `expected an error code, got ${JSON.stringify(body?.error)}`).toBe('string');

    await ctx.dispose();
  });
});
