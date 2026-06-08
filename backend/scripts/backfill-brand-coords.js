'use strict';

/**
 * backfill-brand-coords.js — give existing brands canonical lat/lng so distance
 * ranking works. PRODUCTION-IMPACTING (writes brands): founder go.
 *
 * Two steps:
 *   (a) Copy legacy latitude/longitude → lat/lng where lat is null (free, no API).
 *   (b) For brands STILL missing lat that have a listing_data.google_maps_url,
 *       re-resolve via geocoding.service (short-link expand + coord regex +
 *       forward-geocode by name) and write lat/lng/locality/formatted_address.
 *
 * Prints a per-brand report (esp. low-confidence forward geocodes + brands with
 * no usable link) for the founder to verify/correct in admin.
 *
 * Dry-run by default (reports only). Pass --apply to write.
 *   ENV_FILE=.env.prod-backup node scripts/backfill-brand-coords.js          # dry-run
 *   ENV_FILE=.env.prod-backup node scripts/backfill-brand-coords.js --apply  # write
 *
 * Step (b) needs GOOGLE_GEOCODING_API_KEY in the env; without it, only step (a)
 * runs and the rest are reported as "needs key or manual coords".
 */
const path = require('path');
const envFile = process.env.ENV_FILE || '.env';
require('dotenv').config({ path: path.join(__dirname, '..', envFile) });

const { Client } = require('pg');
const geocoding = require('../src/services/geocoding.service'); // reads env AFTER dotenv

const APPLY = process.argv.includes('--apply');
const HAS_KEY = !!process.env.GOOGLE_GEOCODING_API_KEY;

(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  console.log(`[backfill] ${APPLY ? 'APPLY (writing)' : 'DRY-RUN (no writes)'} via ${envFile}; geocoding key: ${HAS_KEY ? 'present' : 'MISSING'}`);

  // (a) copy legacy latitude/longitude → canonical lat/lng
  const { rows: copyable } = await c.query(
    `SELECT id, business_name, latitude, longitude FROM brands
      WHERE lat IS NULL AND latitude IS NOT NULL AND longitude IS NOT NULL`
  );
  console.log(`\n[a] copy latitude→lat: ${copyable.length} brand(s)`);
  for (const b of copyable) {
    console.log(`   • ${b.business_name}: (${b.latitude}, ${b.longitude})`);
    if (APPLY) await c.query(`UPDATE brands SET lat=latitude, lng=longitude WHERE id=$1`, [b.id]);
  }

  // (b) geocode the rest (still missing lat) that have a maps URL
  const { rows: needGeo } = await c.query(
    `SELECT b.id, b.business_name, b.category, u.city AS user_city,
            b.listing_data->>'google_maps_url' AS gmu
       FROM brands b JOIN users u ON u.id = b.user_id
      WHERE b.lat IS NULL ${APPLY ? "AND TRUE" : "AND TRUE"}`
  );
  const stillMissing = needGeo.filter(b => b.id && !copyable.find(x => x.id === b.id));
  console.log(`\n[b] geocode remaining (lat still null): ${stillMissing.length} brand(s)`);
  const report = [];
  for (const b of stillMissing) {
    if (!HAS_KEY) { report.push({ brand: b.business_name, outcome: 'SKIPPED (no geocoding key)', gmu: b.gmu || null }); continue; }
    const r = await geocoding.resolveMapsUrl(b.gmu || null, { name: b.business_name, city: b.user_city });
    if (r && r.verified && r.lat != null && r.lng != null) {
      report.push({ brand: b.business_name, outcome: `RESOLVED (${r.source}${r.low_confidence ? ', LOW-CONFIDENCE — verify' : ''})`, coords: `${r.lat},${r.lng}`, area: r.locality || r.city || null });
      if (APPLY) await c.query(
        `UPDATE brands SET lat=$2, lng=$3, latitude=$2, longitude=$3,
           locality=COALESCE($4, locality), formatted_address=COALESCE($5, formatted_address) WHERE id=$1`,
        [b.id, r.lat, r.lng, r.locality || null, r.formatted_address || null]
      );
    } else {
      report.push({ brand: b.business_name, outcome: 'UNRESOLVED — needs manual coords', gmu: b.gmu || '(no link)' });
    }
  }
  report.forEach(r => console.log('   • ' + JSON.stringify(r)));

  // final state
  const { rows: final } = await c.query(`SELECT count(*)::int total, count(lat)::int with_lat FROM brands`);
  console.log(`\n[final] brands with canonical lat: ${final[0].with_lat}/${final[0].total}`);
  console.log(APPLY ? '[backfill] applied.' : '[backfill] DRY-RUN only — re-run with --apply to write.');
  await c.end();
})().catch((e) => { console.error('[backfill] FAILED:', e.message); process.exit(1); });
