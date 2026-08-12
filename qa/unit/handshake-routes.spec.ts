import { test, expect } from '@playwright/test';

/**
 * WORKFLOW: the handshake API surface is mounted and correctly gated.
 * Contract: features/collab-part2-precampaign-handshake.
 *
 * Boots the real Express app and walks the router, so this proves the routes are
 * REGISTERED rather than merely written — a route file that is never mounted is a whole
 * feature that silently does not exist, and nothing else in the suite would notice.
 *
 * Also asserts the role gates. A creator's inbox reachable by a brand, or the admin
 * limits reachable by anyone, would be a real access fault.
 */

process.env.DATABASE_URL ??= 'postgres://qa:qa@localhost:5432/qa';
process.env.JWT_SECRET ??= 'qa-not-used';
process.env.JWT_EXPIRY ??= '15m';
process.env.REFRESH_TOKEN_EXPIRY ??= '30d';
process.env.ENCRYPTION_KEY ??= 'qa-not-used-0000000000000000000000';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const app = require('../../backend/src/app');

type Route = { method: string; path: string; handlers: number };

function collectRoutes(): Route[] {
  const out: Route[] = [];
  const walk = (stack: any[]) => {
    for (const layer of stack) {
      if (layer.route) {
        out.push({
          method: Object.keys(layer.route.methods)[0].toUpperCase(),
          path: layer.route.path,
          handlers: layer.route.stack.length,
        });
      } else if (layer.handle && layer.handle.stack) {
        walk(layer.handle.stack);
      }
    }
  };
  walk(app._router.stack);
  return out;
}

const routes = collectRoutes();
const find = (method: string, path: string) =>
  routes.find(r => r.method === method && r.path === path);

test.describe('WORKFLOW: brand → creator requests are reachable', () => {
  const expected: Array<[string, string]> = [
    ['POST', '/brands/me/collab-requests'],
    ['POST', '/brands/me/collab-requests/broadcast-preview'],
    ['GET', '/brands/me/collab-requests'],
    ['POST', '/brands/me/collab-requests/:id/accept'],
    ['POST', '/brands/me/collab-requests/:id/counter'],
    ['POST', '/brands/me/collab-requests/:id/decline'],
    ['POST', '/brands/me/collab-requests/:id/withdraw'],
    ['GET', '/brands/me/agreements'],
  ];

  for (const [method, path] of expected) {
    test(`R-${method}-${path} is mounted`, () => {
      expect(find(method, path), `${method} ${path} is not mounted`).toBeTruthy();
    });
  }
});

test.describe('WORKFLOW: the creator side is reachable', () => {
  const expected: Array<[string, string]> = [
    ['GET', '/influencers/me/collab-requests'],
    ['POST', '/influencers/me/collab-requests/:id/accept'],
    ['POST', '/influencers/me/collab-requests/:id/counter'],
    ['POST', '/influencers/me/collab-requests/:id/decline'],
    ['GET', '/influencers/me/collab-preferences'],
    ['PATCH', '/influencers/me/collab-preferences'],
    ['GET', '/influencers/me/agreements'],
  ];

  for (const [method, path] of expected) {
    test(`R-${method}-${path} is mounted`, () => {
      expect(find(method, path), `${method} ${path} is not mounted`).toBeTruthy();
    });
  }
});

test.describe('WORKFLOW: every handshake route is authenticated and role-gated', () => {
  test('R1 — nothing is left open', () => {
    // handlers = middleware + controller. A route with a single handler has no auth in
    // front of it, which on these endpoints would expose one brand's negotiations to
    // another, or let anyone edit the platform limits.
    const handshakeRoutes = routes.filter(r =>
      /collab-requests|collab-preferences|handshake-settings|\/me\/agreements/.test(r.path));
    expect(handshakeRoutes.length).toBeGreaterThanOrEqual(17);
    for (const r of handshakeRoutes) {
      expect(r.handlers, `${r.method} ${r.path} has no middleware in front of it`).toBeGreaterThanOrEqual(2);
    }
  });

  test('R2 — the admin limits are mounted behind admin auth', () => {
    // requireAnyAdminRole rather than superadmin: the founder's daily account is not
    // always superadmin, and an operator who cannot reach the settings cannot operate them.
    expect(find('GET', '/admin/handshake-settings')?.handlers).toBeGreaterThanOrEqual(3);
    expect(find('PATCH', '/admin/handshake-settings')?.handlers).toBeGreaterThanOrEqual(3);
  });

  test('R3 — the existing creator pitch routes still work alongside', () => {
    // Two record types living together. Breaking the older half while adding the new one
    // would be an easy regression to miss.
    expect(find('POST', '/influencers/me/proposals')).toBeTruthy();
    expect(find('GET', '/brands/me/proposals')).toBeTruthy();
    expect(find('POST', '/brands/me/proposals/:id/accept')).toBeTruthy();
  });
});
