'use strict';
/**
 * Open approved brands to creator pitches.
 * Contract: features/stage-1-find-each-other-and-agree
 *
 * The founder's decision of 15 August, given the go on 23 August 2026.
 *
 * This is the one OUTWARD-FACING change in Stage 1: some brands will first learn of it
 * when a pitch notification arrives. Every brand keeps its own switch and can close again,
 * so this is reversible per brand and wholesale.
 *
 * Only APPROVED brands are opened. A pending brand being pitched to would be a creator
 * spending one of her limited approaches on someone who cannot yet reply.
 *
 *   node scripts/open-brands-to-pitches.js            # show what would change
 *   node scripts/open-brands-to-pitches.js --apply
 *   node scripts/open-brands-to-pitches.js --close-all --apply   # full reverse
 */
const { Client } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.prod-backup') });

const APPLY = process.argv.includes('--apply');
const CLOSE = process.argv.includes('--close-all');

(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();

  const list = async () => (await c.query(
    `SELECT b.business_name, u.status, b.accepts_proposals
       FROM brands b JOIN users u ON u.id = b.user_id
      ORDER BY b.business_name`)).rows;

  console.log('BEFORE:'); console.table(await list());

  if (!APPLY) {
    const { rows: [n] } = await c.query(
      `SELECT count(*)::int c FROM brands b JOIN users u ON u.id=b.user_id
        WHERE u.status='approved' AND b.accepts_proposals = false`);
    console.log(`\nDRY RUN — ${n.c} approved brand(s) would be opened. Re-run with --apply.`);
    await c.end(); return;
  }

  const { rowCount } = await c.query(
    CLOSE
      ? `UPDATE brands SET accepts_proposals = false WHERE accepts_proposals = true`
      : `UPDATE brands b SET accepts_proposals = true
           FROM users u
          WHERE u.id = b.user_id AND u.status = 'approved' AND b.accepts_proposals = false`);

  console.log(`\n${CLOSE ? 'CLOSED' : 'OPENED'} ${rowCount} brand(s).`);
  console.log('AFTER:'); console.table(await list());
  await c.end();
})().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
