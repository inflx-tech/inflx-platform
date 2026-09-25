'use strict';

/**
 * Item 12, Phase 2b — storage and uploads, proved on their own.
 * Contract: features/item12-content · gap report §6 · approval §2.1, §2.6, §3.8 · checks 3, 25, 41, 45, 46
 *
 * Runs in R2_MOCK, whose content route behaves like R2's presigned URL: the signature, the
 * expiry, the EXACT signed length and type, streamed to a private folder. The real-R2 half of
 * check 45 — a 200 MB MP4 from a real phone — is the founder's device run (approval §1.2).
 */

const fs = require('fs');
const http = require('http');
const { Readable } = require('stream');
const { query, api, app, request } = require('./helpers/item3');
const w10 = require('./helpers/item10');
const w12 = require('./helpers/item12');
const { createAdminUser } = require('./helpers/factories');
const storage = require('../src/services/contentStorage.service');
const content = require('../src/services/content.service');
const { MSG } = require('../src/services/contentCopy');

const MB = 1024 * 1024;
const JPG = { rowKey: 'reel', kind: 'photo', mime: 'image/jpeg', sizeBytes: 3000 };
const MP4 = (sizeBytes) => ({ rowKey: 'reel', kind: 'video', mime: 'video/mp4', sizeBytes, durationS: 28 });

/** The app on a real port, so a PUT can stream like a phone's does. */
let server; let base;
beforeAll(async () => {
  server = http.createServer(app);
  await new Promise((r) => server.listen(0, r));
  base = `http://127.0.0.1:${server.address().port}`;
});
afterAll(async () => { await new Promise((r) => server.close(r)); });

/** PUT `n` bytes to a signed URL, streamed in 1 MB chunks (never a 200 MB buffer). */
function put(url, n, { type, declaredLength = n, sendBytes = n } = {}) {
  const u = new URL(url);
  const path = `${u.pathname}${u.search}`;
  return new Promise((resolve, reject) => {
    const req = http.request(`${base}${path}`, {
      method: 'PUT', headers: { 'Content-Type': type, 'Content-Length': declaredLength },
    }, (res) => { let body = ''; res.on('data', (d) => { body += d; }); res.on('end', () => resolve({ status: res.statusCode, body })); });
    req.on('error', (e) => resolve({ status: 0, body: e.message }));
    const chunk = Buffer.alloc(MB, 7);
    let left = sendBytes;
    Readable.from((function* gen() { while (left > 0) { const k = Math.min(left, MB); left -= k; yield k === MB ? chunk : chunk.subarray(0, k); } })())
      .pipe(req);
    void reject;
  });
}
const get = (url) => new Promise((resolve) => {
  const u = new URL(url);
  http.get(`${base}${u.pathname}${u.search}`, (res) => { const bufs = []; res.on('data', (d) => bufs.push(d)); res.on('end', () => resolve({ status: res.statusCode, type: res.headers['content-type'], bytes: Buffer.concat(bufs).length })); });
});

const ask = (w, body) => api.post(`${w12.C(w)}/files/upload-url`, w.cr.token, body);
const confirm = (w, id) => api.post(`${w12.C(w)}/files/${id}/confirm`, w.cr.token, {});

/** Ask, upload for real, confirm. */
async function uploaded(w, body = JPG) {
  const a = await ask(w, body);
  expect(a.status).toBe(200);
  const up = a.body.data.upload;
  const r = await put(up.url, body.sizeBytes, { type: body.mime });
  expect(r.status).toBe(200);
  const c = await confirm(w, up.fileId);
  expect(c.status).toBe(200);
  return c.body.data.file;
}

/* ──────────────────────────────────────────── 3. the limits, declared (check 3) */

describe('item 12 · every file limit, on the server (check 3)', () => {
  it('type, size and kind are refused before anything is signed — each with its sentence', async () => {
    const w = await w12.shotDone('engagement');
    const cases = [
      [{ ...JPG, mime: 'image/gif' },                   'FILE_WRONG_TYPE',      MSG.FILE_WRONG_TYPE],
      [{ ...JPG, kind: 'video' },                       'FILE_WRONG_TYPE',      MSG.FILE_WRONG_TYPE],
      [{ ...MP4(1000), mime: 'video/quicktime' },       'FILE_WRONG_TYPE',      MSG.FILE_WRONG_TYPE],
      [{ ...JPG, sizeBytes: 10 * MB + 1 },              'FILE_TOO_LARGE_PHOTO', MSG.FILE_TOO_LARGE_PHOTO],
      [MP4(200 * MB + 1),                               'FILE_TOO_LARGE_VIDEO', MSG.FILE_TOO_LARGE_VIDEO],
      [{ ...JPG, rowKey: 'youtube_video' },             'UNKNOWN_ROW',          MSG.UNKNOWN_ROW],
    ];
    for (const [body, code, message] of cases) {
      const r = await ask(w, body);
      expect(`${JSON.stringify(body)} → ${r.status} ${r.body.error && r.body.error.code}`).toBe(`${JSON.stringify(body)} → 422 ${code}`);
      expect(r.body.error.message).toBe(message);
    }
    const { rows: [n] } = await query(`SELECT count(*)::int n FROM content_files f JOIN collab_content c ON c.id = f.content_id WHERE c.campaign_influencer_id = $1`, [w.ciId]);
    expect(n.n).toBe(0);
  });

  it('exactly 10 MB and exactly 200 MB are allowed; the 11th file in a row is refused', async () => {
    const w = await w12.shotDone('engagement');
    expect((await ask(w, { ...JPG, sizeBytes: 10 * MB })).status).toBe(200);
    expect((await ask(w, MP4(200 * MB))).status).toBe(200);
    for (let i = 0; i < 8; i += 1) expect((await ask(w, JPG)).status).toBe(200);
    const r = await ask(w, JPG);
    expect(r.body.error).toMatchObject({ code: 'ROW_FULL', message: MSG.ROW_FULL });
  });

  it('only the creator uploads; the brand, another creator and a stranger meet 404/403', async () => {
    const w = await w12.shotDone('engagement');
    const other = await w12.shotDone('engagement');
    const byOther = await api.post(`${w12.C(w)}/files/upload-url`, other.cr.token, JPG);
    expect(byOther.status).toBe(404);
    const byBrand = await api.post(`${w12.C(w)}/files/upload-url`, w.b.token, JPG);
    expect(byBrand.status).toBe(403);   // role guard: a brand token never reaches a creator route
  });

  it('the shoot not done refuses an upload; the first upload after it creates the step, once', async () => {
    const w = await w10.signedByBoth('engagement');
    const r = await ask(w, JPG);
    expect(r.body.error).toMatchObject({ code: 'SHOOT_NOT_DONE', message: MSG.SHOOT_NOT_DONE });
    const { rows: [n0] } = await query(`SELECT count(*)::int n FROM collab_content WHERE campaign_influencer_id = $1`, [w.ciId]);
    expect(n0.n).toBe(0);                                     // nothing created before the shoot
    await w12.markShootDone(w);
    await ask(w, JPG); await ask(w, JPG);
    const { rows: [n1] } = await query(`SELECT count(*)::int n FROM collab_content WHERE campaign_influencer_id = $1`, [w.ciId]);
    expect(n1.n).toBe(1);
  });
});

/* ──────────────────────────────────────────── 45. the signed PUT, and what landed */

describe('item 12 · the upload goes straight to storage, and storage is believed only after head (check 45)', () => {
  it('a 200 MB MP4 streams through the signed PUT and is verified by head', async () => {
    const w = await w12.shotDone('engagement');
    const size = 200 * MB;
    const a = await ask(w, MP4(size));
    const up = a.body.data.upload;
    expect(up).toMatchObject({ method: 'PUT', headers: { 'Content-Type': 'video/mp4' } });
    expect(new URL(up.url).pathname).toMatch(/^\/v1\/content-mock\/collab-content\//);   // never /uploads
    const r = await put(up.url, size, { type: 'video/mp4' });
    expect(r.status).toBe(200);
    const c = await confirm(w, up.fileId);
    expect(c.status).toBe(200);
    expect(c.body.data.file).toMatchObject({ kind: 'video', sizeBytes: size, verified: true, durationS: 28 });
    const landed = await storage.head(storage.keyFor(w.ciId, up.fileId, 'video/mp4'));
    expect(landed).toEqual({ size, contentType: 'video/mp4' });
    await storage.remove(storage.keyFor(w.ciId, up.fileId, 'video/mp4'));   // 200 MB of scratch, gone
  }, 120000);

  it('storage itself refuses a body of a different length or type than the one signed', async () => {
    const w = await w12.shotDone('engagement');
    const up = (await ask(w, JPG)).body.data.upload;
    expect((await put(up.url, 3000, { type: 'image/png' })).status).toBe(403);                  // type
    expect((await put(up.url, 3001, { type: 'image/jpeg' })).status).toBe(403);                 // longer, declared
    expect((await put(up.url, 2999, { type: 'image/jpeg' })).status).toBe(403);                 // shorter, declared
    expect(await storage.head(storage.keyFor(w.ciId, up.fileId, 'image/jpeg'))).toBeNull();
  });

  it('a signed URL expires', async () => {
    const w = await w12.shotDone('engagement');
    const up = (await ask(w, JPG)).body.data.upload;
    const spy = jest.spyOn(Date, 'now').mockReturnValue(Date.now() + (storage.UPLOAD_EXPIRES_S + 5) * 1000);
    try {
      expect((await put(up.url, 3000, { type: 'image/jpeg' })).status).toBe(403);
    } finally { spy.mockRestore(); }
  });

  it('confirm before the upload landed is refused; a retry after it did is idempotent', async () => {
    const w = await w12.shotDone('engagement');
    const up = (await ask(w, JPG)).body.data.upload;
    const early = await confirm(w, up.fileId);
    expect(early.body.error).toMatchObject({ code: 'UPLOAD_MISSING', message: MSG.UPLOAD_MISSING });
    await put(up.url, 3000, { type: 'image/jpeg' });
    const c1 = await confirm(w, up.fileId);
    const c2 = await confirm(w, up.fileId);
    expect(c1.status).toBe(200); expect(c2.status).toBe(200);
    expect(c2.body.data.file.id).toBe(c1.body.data.file.id);
  });

  it('what landed differs from what was declared → deleted and refused (type, then size)', async () => {
    const w = await w12.shotDone('engagement');
    // Storage misbehaving is exactly what the head step exists for, so write past the signed URL.
    const plant = (key, bytes, type) => {
      const p = require('path').join(storage.MOCK_DIR, ...key.split('/'));
      fs.mkdirSync(require('path').dirname(p), { recursive: true });
      fs.writeFileSync(p, Buffer.alloc(bytes, 1));
      fs.writeFileSync(`${p}.meta.json`, JSON.stringify({ contentType: type }));
    };
    const a1 = (await ask(w, JPG)).body.data.upload;
    plant(storage.keyFor(w.ciId, a1.fileId, 'image/jpeg'), 3000, 'image/png');
    const r1 = await confirm(w, a1.fileId);
    expect(r1.body.error).toMatchObject({ code: 'FILE_WRONG_TYPE', message: MSG.FILE_WRONG_TYPE });

    const a2 = (await ask(w, { ...JPG, sizeBytes: 3000 })).body.data.upload;
    plant(storage.keyFor(w.ciId, a2.fileId, 'image/jpeg'), 11 * MB, 'image/jpeg');
    const r2 = await confirm(w, a2.fileId);
    expect(r2.body.error).toMatchObject({ code: 'FILE_TOO_LARGE_PHOTO', message: MSG.FILE_TOO_LARGE_PHOTO });

    for (const id of [a1.fileId, a2.fileId]) {
      expect(await storage.head(storage.keyFor(w.ciId, id, 'image/jpeg'))).toBeNull();          // object deleted
      const { rows: [f] } = await query(`SELECT deleted_at, verified_at FROM content_files WHERE id = $1`, [id]);
      expect(f.deleted_at).toBeTruthy(); expect(f.verified_at).toBeNull();
    }
  });
});

/* ──────────────────────────────────────────── 25, 26. who may see a file */

describe('item 12 · a file is served only to those it belongs to (checks 25, 26)', () => {
  it('her own file: yes, for 300 seconds; the brand: not until she sends it; everyone else: 404', async () => {
    const w = await w12.shotDone('engagement');
    const other = await w12.shotDone('engagement');
    const admin = await createAdminUser('superadmin');
    const f = await uploaded(w);

    const mine = await api.get(`${w12.C(w)}/files/${f.id}/url`, w.cr.token);
    expect(mine.status).toBe(200);
    const exp = new Date(mine.body.data.view.expiresAt).getTime() - Date.now();
    expect(exp).toBeGreaterThan(290000); expect(exp).toBeLessThanOrEqual(300000);
    expect(await get(mine.body.data.view.url)).toMatchObject({ status: 200, type: 'image/jpeg', bytes: 3000 });

    expect((await api.get(`${w12.B(w)}/files/${f.id}/url`, w.b.token)).status).toBe(404);          // not sent yet
    expect((await api.get(`${w12.C(other)}/files/${f.id}/url`, other.cr.token)).status).toBe(404); // another creator, her own path
    expect((await api.get(`${w12.C(w)}/files/${f.id}/url`, other.cr.token)).status).toBe(404);     // another creator, this path
    expect((await api.get(`${w12.B(w)}/files/${f.id}/url`, other.b.token)).status).toBe(404);      // another brand
    expect((await api.get(`${w12.B(other)}/files/${f.id}/url`, other.b.token)).status).toBe(404);
    expect((await api.get(`/admin/collabs/${w.ciId}/content/files/${f.id}/url`, admin.token)).status).toBe(404); // nothing reported

    // Sent in a round → the brand sees it.
    const cc = await content.contentRow(w.ciId);
    await query(`INSERT INTO content_rounds (content_id, round_no, submitted_by, package_json) VALUES ($1, 1, $2, $3)`,
      [cc.id, w.cr.userId, JSON.stringify({ rows: [{ key: 'reel', fileIds: [f.id] }] })]);
    expect((await api.get(`${w12.B(w)}/files/${f.id}/url`, w.b.token)).status).toBe(200);

    // Reported → Admin sees it.
    await query(`UPDATE collab_content SET brand_reported_at = now(), brand_reported_by = $2, brand_report_kind = 'posted_wrong' WHERE id = $1`, [cc.id, w.b.userId]);
    expect((await api.get(`/admin/collabs/${w.ciId}/content/files/${f.id}/url`, admin.token)).status).toBe(200);
  });

  it('a view URL expires', async () => {
    const w = await w12.shotDone('engagement');
    const f = await uploaded(w);
    const v = (await api.get(`${w12.C(w)}/files/${f.id}/url`, w.cr.token)).body.data.view;
    const spy = jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 301 * 1000);
    try { expect((await get(v.url)).status).toBe(403); } finally { spy.mockRestore(); }
  });

  it('a content file is never under the public /uploads folder', async () => {
    const w = await w12.shotDone('engagement');
    const f = await uploaded(w);
    const { rows: [row] } = await query(`SELECT storage_key FROM content_files WHERE id = $1`, [f.id]);
    const r = await request(app).get(`/uploads/${row.storage_key}`);   // the public static folder
    expect(r.status).toBe(404);
    expect(storage.MOCK_DIR).not.toBe(require('../src/services/storage.service').getUploadDir());
  });
});

/* ──────────────────────────────────────────── 46. the Story screenshot */

describe('item 12 · a Story screenshot is a file like any other (check 46)', () => {
  it('only a photo, only on a Story row, only after approval, served only through G12', async () => {
    const w = await w12.shotDone('engagement');   // reel × 1, story × 2
    const shot = { rowKey: 'story', kind: 'photo', mime: 'image/png', sizeBytes: 4000, purpose: 'story_proof' };
    expect((await ask(w, shot)).body.error).toMatchObject({ code: 'NOT_APPROVED' });
    await ask(w, JPG);   // creates the step
    await query(`UPDATE collab_content SET approved_at = now(), approved_round = 1 WHERE campaign_influencer_id = $1`, [w.ciId]);
    expect((await ask(w, { ...shot, rowKey: 'reel' })).body.error).toMatchObject({ code: 'LINK_ONLY', message: MSG.LINK_ONLY });
    expect((await ask(w, { ...shot, kind: 'video', mime: 'video/mp4' })).body.error).toMatchObject({ code: 'FILE_WRONG_TYPE' });
    expect((await ask(w, { ...shot, sizeBytes: 10 * MB + 1 })).body.error).toMatchObject({ code: 'FILE_TOO_LARGE_PHOTO' });
    const f = await uploaded(w, shot);
    expect(f).toMatchObject({ purpose: 'story_proof', kind: 'photo' });
    // The brand sees it only once she says she posted.
    expect((await api.get(`${w12.B(w)}/files/${f.id}/url`, w.b.token)).status).toBe(404);
    await query(`UPDATE collab_content SET posted_at = now() WHERE campaign_influencer_id = $1`, [w.ciId]);
    expect((await api.get(`${w12.B(w)}/files/${f.id}/url`, w.b.token)).status).toBe(200);
    // And one screenshot per unit of the count: a third on a story × 2 row is refused.
    await query(`UPDATE collab_content SET posted_at = NULL WHERE campaign_influencer_id = $1`, [w.ciId]);
    await uploaded(w, shot);
    expect((await ask(w, shot)).body.error).toMatchObject({ code: 'ROW_FULL' });
  });
});

/* ──────────────────────────────────────────── remove, freeze, sweep (check 41) */

describe('item 12 · removing, the freeze, and the sweep (checks 39, 41)', () => {
  it('removing an unsent file deletes it for good', async () => {
    const w = await w12.shotDone('engagement');
    const f = await uploaded(w);
    const r = await api.del(`${w12.C(w)}/files/${f.id}`, w.cr.token);
    expect(r.status).toBe(200);
    expect(await storage.head(storage.keyFor(w.ciId, f.id, 'image/jpeg'))).toBeNull();
  });

  it('a brand report freezes every file write with the one sentence', async () => {
    const w = await w12.shotDone('engagement');
    const f = await uploaded(w);
    await query(`UPDATE collab_content SET brand_reported_at = now(), brand_reported_by = $2, brand_report_kind = 'rounds_used' WHERE campaign_influencer_id = $1`, [w.ciId, w.b.userId]);
    for (const r of [await ask(w, JPG), await api.del(`${w12.C(w)}/files/${f.id}`, w.cr.token)]) {
      expect(r.body.error).toMatchObject({ code: 'REPORTED_HOLD', message: 'INFLX is looking at this. Nothing can change until they get back to you.' });
    }
  });

  it('41 · the sweep deletes an unconfirmed orphan after 24 hours, and never a file a round references', async () => {
    const w = await w12.shotDone('engagement');
    const orphan = (await ask(w, JPG)).body.data.upload;
    await put(orphan.url, 3000, { type: 'image/jpeg' });                       // landed, never confirmed
    const raced = (await ask(w, JPG)).body.data.upload;
    await put(raced.url, 3000, { type: 'image/jpeg' });                        // landed, never confirmed…
    const fresh = (await ask(w, JPG)).body.data.upload;                       // unconfirmed, but young
    const cc = await content.contentRow(w.ciId);
    await query(`INSERT INTO content_rounds (content_id, round_no, submitted_by, package_json) VALUES ($1, 1, $2, $3)`,
      [cc.id, w.cr.userId, JSON.stringify({ rows: [{ key: 'reel', fileIds: [raced.fileId] }] })]);   // …but sent (a race)
    await query(`UPDATE content_files SET uploaded_at = now() - interval '25 hours' WHERE id = ANY($1::uuid[])`, [[orphan.fileId, raced.fileId]]);

    expect(await content.sweep()).toEqual({ deleted: 1 });
    const state = async (id) => (await query(`SELECT deleted_at IS NOT NULL AS gone FROM content_files WHERE id = $1`, [id])).rows[0].gone;
    expect(await state(orphan.fileId)).toBe(true);
    expect(await storage.head(storage.keyFor(w.ciId, orphan.fileId, 'image/jpeg'))).toBeNull();
    expect(await state(raced.fileId)).toBe(false);
    expect(await storage.head(storage.keyFor(w.ciId, raced.fileId, 'image/jpeg'))).toEqual({ size: 3000, contentType: 'image/jpeg' });
    expect(await state(fresh.fileId)).toBe(false);
    expect(await content.sweep()).toEqual({ deleted: 0 });                     // idempotent
  });

  it('no upload, confirm, removal or view moves a rupee', async () => {
    const w = await w12.shotDone('engagement');
    const before = await w10.moneySnapshot(w);
    const f = await uploaded(w);
    await api.get(`${w12.C(w)}/files/${f.id}/url`, w.cr.token);
    await api.del(`${w12.C(w)}/files/${f.id}`, w.cr.token);
    expect(await w10.moneySnapshot(w)).toBe(before);
  });
});

/* ──────────────────────────────────────────── the device-proof harness (Phase 2b) */

describe('item 12 · the upload probe — the harness for the real-phone proof', () => {
  const on = () => { process.env.CONTENT_UPLOAD_PROBE = 'on'; };
  afterEach(() => { delete process.env.CONTENT_UPLOAD_PROBE; });

  it('is OFF by default: no row for the app, and every door is 404', async () => {
    const w = await w12.shotDone('engagement');
    expect((await api.get('/influencers/me/upload-probe', w.cr.token)).body.data).toEqual({ enabled: false });
    expect((await api.post('/influencers/me/upload-probe/url', w.cr.token, { mime: 'video/mp4', sizeBytes: 1000 })).status).toBe(404);
    expect((await api.post('/influencers/me/upload-probe/confirm', w.cr.token, { probeToken: 'x.y' })).status).toBe(404);
  });

  it('ON: the same signed PUT, measured by head, then deleted; a URL signed one byte short is refused by storage', async () => {
    on();
    const w = await w12.shotDone('engagement');
    const size = 5 * MB;
    const a = await api.post('/influencers/me/upload-probe/url', w.cr.token, { mime: 'video/mp4', sizeBytes: size });
    expect(a.status).toBe(200);
    expect((await put(a.body.data.upload.url, size, { type: 'video/mp4' })).status).toBe(200);
    const c = await api.post('/influencers/me/upload-probe/confirm', w.cr.token, { probeToken: a.body.data.probeToken });
    expect(c.body.data).toEqual({ declared: { size, contentType: 'video/mp4' }, landed: { size, contentType: 'video/mp4' }, match: true, deleted: true });

    const lie = await api.post('/influencers/me/upload-probe/url', w.cr.token, { mime: 'video/mp4', sizeBytes: size, lieAboutSize: true });
    expect((await put(lie.body.data.upload.url, size, { type: 'video/mp4' })).status).toBe(403);

    // Another creator cannot confirm (and so cannot delete) someone else's probe.
    const other = await w12.shotDone('engagement');
    expect((await api.post('/influencers/me/upload-probe/confirm', other.cr.token, { probeToken: lie.body.data.probeToken })).status).toBe(404);
  });
});
