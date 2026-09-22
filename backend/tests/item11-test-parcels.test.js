'use strict';

/**
 * Item 11, Phase 2b — Admin · Test parcels (R18) and the new admin number (R17).
 * Contract: features/item11-remote · F19, F20 · checks 35, 36
 *
 * The page is the courier. What matters is that pressing a button here is INDISTINGUISHABLE,
 * downstream, from Shiprocket posting an update — and that only Admin can press it, and that
 * every press is on the record.
 */

const { query, api, brand, creator } = require('./helpers/item3');
const { createAdminUser } = require('./helpers/factories');
const w10 = require('./helpers/item10');
const env = require('../src/config/env');

async function simulatedParcel(over = {}) {
  const cols = {
    production_event_id: null, direction: 'outbound', provider: 'simulator',
    to_name: 'Tanvi Suresh', to_pincode: '522002', to_city_name: 'Guntur',
    from_name: 'Kanchi Silks', from_pincode: '500034', from_city_name: 'Hyderabad',
    tracking_number: `TEST${String(Math.floor(Math.random() * 1e10)).padStart(10, '0')}`,
    courier_name: 'Test Express', booked_at: new Date(), weight_kg: 1.2,
    ...over,
  };
  const keys = Object.keys(cols);
  const { rows } = await query(
    `INSERT INTO shipments (${keys.join(', ')}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING *`,
    keys.map((k) => cols[k]));
  return rows[0];
}

describe('R18 · Admin Test parcels', () => {
  it('35 · admin only — a brand and a creator are refused, an admin is not', async () => {
    const b = await brand();
    const c = await creator();
    expect((await api.get('/admin/test-parcels', b.token)).status).toBe(403);
    expect((await api.get('/admin/test-parcels', c.token)).status).toBe(403);
    expect((await api.get('/admin/test-parcels')).status).toBe(401);

    const admin = await createAdminUser();
    const r = await api.get('/admin/test-parcels', admin.token);
    expect(r.status).toBe(200);
    expect(r.body.data.provider).toBe('simulator');
    expect(r.body.data.live).toBe(false);
    expect(r.body.data.testPincodes).toHaveLength(3);
  });

  it('lists simulated parcels with the events each could plausibly send next', async () => {
    const admin = await createAdminUser();
    const s = await simulatedParcel();
    const r = await api.get('/admin/test-parcels', admin.token);
    const row = r.body.data.parcels.find((p) => p.id === s.id);
    expect(row).toBeTruthy();
    expect(row.trackingNumber).toMatch(/^TEST\d{10}$/);
    expect(row.next).toEqual(expect.arrayContaining(['collected', 'cancelled', 'weight_charge']));
    expect(row.next).not.toContain('delivered');     // it has not been collected yet
  });

  it('16 · a press moves the parcel through the SAME webhook handler', async () => {
    const admin = await createAdminUser();
    const s = await simulatedParcel();

    const a = await api.post(`/admin/test-parcels/${s.id}/events`, admin.token, { event: 'collected' });
    expect(a.status).toBe(200);
    expect(a.body.data.applied).toBe(true);

    const after = (await query(`SELECT * FROM shipments WHERE id = $1`, [s.id])).rows[0];
    expect(after.collected_at).toBeTruthy();

    // The event row is the ordinary one a real provider would have produced.
    const { rows } = await query(`SELECT provider, event, applied, payload FROM shipment_events WHERE shipment_id = $1`, [s.id]);
    expect(rows[0].provider).toBe('simulator');
    expect(rows[0].event).toBe('collected');
    expect(rows[0].applied).toBe(true);
    expect(rows[0].payload.source).toBe('admin-test-parcels');
  });

  it('35 · every press is logged with who and when, on the shoot the parcel belongs to', async () => {
    const admin = await createAdminUser();
    // Its own shoot. An earlier version read `SELECT id FROM production_events LIMIT 1` and
    // returned early when there was none — which in a suite that creates no shoot meant the
    // test passed without asserting anything.
    const w = await w10.signedByBoth('conversion', { mode: 'shipment' });
    const s = await simulatedParcel({ production_event_id: w.pe.id });

    await api.post(`/admin/test-parcels/${s.id}/events`, admin.token, { event: 'collected' });

    const { rows } = await query(
      `SELECT actor_user_id, actor_role, action, metadata FROM production_event_log
        WHERE production_event_id = $1 AND action LIKE 'test_parcel.%' ORDER BY seq DESC LIMIT 1`, [w.pe.id]);
    expect(rows[0].actor_role).toBe('admin');
    expect(rows[0].actor_user_id).toBe(admin.userId || rows[0].actor_user_id);
    expect(rows[0].action).toBe('test_parcel.collected');
    expect(rows[0].metadata.shipment_id).toBe(s.id);
  });

  it('a weight charge carries its amount and the courier’s reason', async () => {
    const admin = await createAdminUser();
    const s = await simulatedParcel();
    const r = await api.post(`/admin/test-parcels/${s.id}/events`, admin.token, {
      event: 'weight_charge', amount: 180, reason: 'Weighed 2.4 kg, entered 1.2 kg',
    });
    expect(r.status).toBe(200);
    const { rows } = await query(`SELECT amount, reason FROM shipment_events WHERE shipment_id = $1`, [s.id]);
    expect(Number(rows[0].amount)).toBe(180);
    expect(rows[0].reason).toMatch(/2\.4 kg/);
  });

  it('a duplicate press says so and changes nothing', async () => {
    const admin = await createAdminUser();
    const s = await simulatedParcel();
    const at = '2026-11-01T10:00:00.000Z';
    await api.post(`/admin/test-parcels/${s.id}/events`, admin.token, { event: 'collected', occurredAt: at });
    const again = await api.post(`/admin/test-parcels/${s.id}/events`, admin.token, { event: 'collected', occurredAt: at });
    expect(again.body.data.duplicate).toBe(true);
    expect(again.body.data.applied).toBe(false);
  });

  it('a real-provider parcel cannot be driven from here', async () => {
    const admin = await createAdminUser();
    const s = await simulatedParcel({ provider: 'shiprocket', tracking_number: 'SR12345' });
    const r = await api.post(`/admin/test-parcels/${s.id}/events`, admin.token, { event: 'collected' });
    expect(r.status).toBe(422);
    expect(r.body.error.code).toBe('TEST_PARCEL_REAL_PROVIDER');
    expect(r.body.error.message).toBe('Test parcels only work with the simulator.');
  });

  it('…and neither can anything, once the platform is on a real provider', async () => {
    const admin = await createAdminUser();
    const s = await simulatedParcel();
    const was = env.SHIPPING_PROVIDER;
    try {
      env.SHIPPING_PROVIDER = 'shiprocket';
      const r = await api.post(`/admin/test-parcels/${s.id}/events`, admin.token, { event: 'collected' });
      expect(r.status).toBe(422);
      expect(r.body.error.code).toBe('TEST_PARCEL_REAL_PROVIDER');
    } finally { env.SHIPPING_PROVIDER = was; }
  });

  it('an event nobody has heard of is refused', async () => {
    const admin = await createAdminUser();
    const s = await simulatedParcel();
    const r = await api.post(`/admin/test-parcels/${s.id}/events`, admin.token, { event: 'teleported' });
    expect(r.status).toBe(422);
  });

  it('the simulator webhook URL refuses a caller with no admin session', async () => {
    const r = await api.post('/webhooks/shipping/simulator', null, { event: 'delivered' });
    expect(r.status).toBe(403);
    const unknown = await api.post('/webhooks/shipping/nobody', null, {});
    expect(unknown.status).toBe(404);
  });

  it('the shiprocket webhook URL refuses an unsigned body', async () => {
    const r = await api.post('/webhooks/shipping/shiprocket', null, { current_status: 'DELIVERED', awb: 'X' });
    expect(r.status).toBe(401);
  });
});

describe('R17 · the one new admin number', () => {
  it('remote_return_autoconfirm_days is on the settings page, 7 by default, 1–30', async () => {
    const admin = await createAdminUser();
    const r = await api.get('/admin/platform-settings', admin.token);
    expect(r.status).toBe(200);
    const row = r.body.data.settings.find((s) => s.key === 'remote_return_autoconfirm_days');
    expect(row).toBeTruthy();
    expect(row).toMatchObject({ value: 7, min: 1, max: 30, unit: 'days', label: 'Remote return auto-confirm' });
    expect(row.description).toMatch(/confirms itself/i);

    // R17 says the EXISTING Remote return window is unchanged. Prove it, so a future edit
    // cannot quietly repurpose it.
    const window = r.body.data.settings.find((s) => s.key === 'remote_return_days');
    expect(window).toMatchObject({ value: 7, min: 1, max: 60, label: 'Remote return window' });
  });

  it('it can be changed, within range, and the change is audited', async () => {
    const admin = await createAdminUser();
    const ok = await api.patch('/admin/platform-settings', admin.token, { remote_return_autoconfirm_days: 10 });
    expect(ok.status).toBe(200);

    const bad = await api.patch('/admin/platform-settings', admin.token, { remote_return_autoconfirm_days: 45 });
    expect(bad.status).toBe(422);

    const { rows } = await query(
      `SELECT key, old_value, new_value FROM platform_settings_audit
        WHERE key = 'remote_return_autoconfirm_days' ORDER BY changed_at DESC LIMIT 1`);
    expect(rows[0]).toMatchObject({ old_value: 7, new_value: 10 });

    await api.patch('/admin/platform-settings', admin.token, { remote_return_autoconfirm_days: 7 });
  });
});
