import { test, expect, request as pwRequest } from '@playwright/test';

/**
 * WORKFLOW: B1b — extended API invariants (L1).
 * Contract: features/api-invariants-extended/ (locked 2026-05-18).
 *
 * Widens B1's deterministic net: RBAC breadth (incl. a mutation),
 * auth-contract breadth, and the 404 JSON-envelope contract.
 * Deterministic, vs live backend, no DB seed. Honest reporting.
 */

const BASE = (process.env.QA_API_BASE || 'https://inflx-platform.onrender.com/v1').replace(/\/+$/, '');

// fresh, unique, valid E.164 (/^\+91[6-9]\d{9}$/): +91 9 + 9 digits
const freshPhone = () =>
  `+919${String(Date.now()).slice(-6)}${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`;

test.describe('WORKFLOW: B1b extended API invariants', () => {
  // ── W4 RBAC breadth ──
  const RBAC = [
    { method: 'get', path: '/admin/stats' },
    { method: 'get', path: '/admin/queue/influencers' },
    { method: 'get', path: '/admin/brands?status=all' },
    { method: 'patch', path: '/admin/brands/qa-nonexistent/status', data: { status: 'approved' } },
  ] as const;

  for (const ep of RBAC) {
    test(`W4 — ${ep.method.toUpperCase()} ${ep.path} rejects unauthenticated`, async () => {
      const ctx = await pwRequest.newContext();
      const res =
        ep.method === 'get'
          ? await ctx.get(`${BASE}${ep.path}`, { timeout: 60_000 })
          : await ctx.patch(`${BASE}${ep.path}`, { data: (ep as any).data, timeout: 60_000 });
      const status = res.status();
      const body: any = await res.json().catch(() => null);

      expect([401, 403], `${ep.path} unauth → ${status} ${JSON.stringify(body)}`).toContain(status);
      expect(body?.success).toBe(false);
      expect(['UNAUTHORIZED', 'FORBIDDEN']).toContain(body?.error?.code);
      await ctx.dispose();
    });
  }

  // ── W5 Auth-contract breadth ──
  test('W5a — verify-otp on a fresh phone without role → 422 VALIDATION_ERROR (field role)', async () => {
    const ctx = await pwRequest.newContext();
    const phone = freshPhone();
    let sent = false;
    for (let i = 0; i < 3 && !sent; i++) {
      const s = await ctx.post(`${BASE}/auth/send-otp`, { data: { phone }, timeout: 60_000 }).catch(() => null);
      sent = !!s && s.ok();
      if (!sent) await new Promise((r) => setTimeout(r, 4000));
    }
    expect(sent, 'send-otp must succeed to reach the verify-otp role check').toBe(true);

    const v = await ctx.post(`${BASE}/auth/verify-otp`, {
      data: { phone, otp: '000000' },
      timeout: 60_000,
    });
    const body: any = await v.json().catch(() => null);
    expect(v.status(), `verify-otp no-role → ${v.status()} ${JSON.stringify(body)}`).toBe(422);
    expect(body?.error?.code).toBe('VALIDATION_ERROR');
    expect(body?.error?.field).toBe('role');
    await ctx.dispose();
  });

  test('W5b — verify-otp with an invalid role → 422 VALIDATION_ERROR', async () => {
    const ctx = await pwRequest.newContext();
    const phone = freshPhone();
    let sent = false;
    for (let i = 0; i < 3 && !sent; i++) {
      const s = await ctx.post(`${BASE}/auth/send-otp`, { data: { phone }, timeout: 60_000 }).catch(() => null);
      sent = !!s && s.ok();
      if (!sent) await new Promise((r) => setTimeout(r, 4000));
    }
    expect(sent).toBe(true);

    const v = await ctx.post(`${BASE}/auth/verify-otp`, {
      data: { phone, otp: '000000', role: 'wizard' },
      timeout: 60_000,
    });
    const body: any = await v.json().catch(() => null);
    expect(v.status(), `verify-otp invalid-role → ${v.status()} ${JSON.stringify(body)}`).toBe(422);
    expect(body?.error?.code).toBe('VALIDATION_ERROR');
    await ctx.dispose();
  });

  test('W5c — POST /auth/refresh with no cookie → clean 4xx, not 5xx', async () => {
    const ctx = await pwRequest.newContext();
    const res = await ctx.post(`${BASE}/auth/refresh`, { timeout: 60_000 });
    const status = res.status();
    const body: any = await res.json().catch(() => null);
    expect(status, `refresh no-cookie → ${status}`).toBeGreaterThanOrEqual(400);
    expect(status, `refresh no-cookie → ${status} (server error)`).toBeLessThan(500);
    expect(body?.success).toBe(false);
    await ctx.dispose();
  });

  // ── W6 Not-found contract ──
  test('W6 — unknown route → 404 JSON envelope (not HTML, not 5xx)', async () => {
    const ctx = await pwRequest.newContext();
    const res = await ctx.get(`${BASE}/this-route-does-not-exist-${Date.now()}`, { timeout: 60_000 });
    const status = res.status();
    const body: any = await res.json().catch(() => null);
    expect(status, `unknown route → ${status}`).toBe(404);
    expect(body, 'expected a JSON error envelope, not HTML/empty').not.toBeNull();
    expect(body?.success).toBe(false);
    expect(typeof body?.error?.code, `expected error.code, got ${JSON.stringify(body?.error)}`).toBe('string');
    await ctx.dispose();
  });
});
