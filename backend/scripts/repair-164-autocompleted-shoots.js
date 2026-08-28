'use strict';

/**
 * Repair the one production_event created by the bug.
 * Contract: features/shoot-starts-where-the-agreement-left-it
 *
 * Asha M. · "New test campaign 1234" · Label Fern.
 *   agreement mode  = 'visit'                both sides agreed a store visit
 *   contract        = production_mode NULL   never carried across
 *   event           = remote / completed     invented, and finished before it began
 *
 * The code fix stops this happening again. It does not un-happen for a row that already exists,
 * and this is the row the founder is testing on.
 *
 * Only touches rows the bug could have produced: mode='remote' AND status='completed' AND the
 * agreement says something other than remote AND nobody has marked it done. A genuinely finished
 * remote shoot has an influencer_completed_at and is skipped.
 *
 * --dry rolls back.
 */

const { Client } = require('pg');
const path = require('path');
const DRY = process.argv.includes('--dry');
require('dotenv').config({ path: path.join(__dirname, '../.env.prod-backup') });

const FIND = `
  SELECT pe.id, pe.mode, pe.status, pe.brand_completed_at, pe.influencer_completed_at,
         con.id AS contract_id, con.production_mode,
         ag.terms_json->>'mode' AS agreed_mode,
         u.name AS creator, cp.name AS campaign
    FROM production_events pe
    JOIN contracts con ON con.id = pe.contract_id
    JOIN campaign_influencers ci ON ci.id = con.campaign_influencer_id
    JOIN campaign_sets cs ON cs.id = ci.set_id
    JOIN campaigns cp ON cp.id = cs.campaign_id
    JOIN influencers i ON i.id = ci.influencer_id
    JOIN users u ON u.id = i.user_id
    LEFT JOIN collab_agreements ag ON ag.id = ci.agreement_id
   WHERE pe.mode = 'remote'
     AND pe.status = 'completed'
     AND ag.terms_json->>'mode' IN ('visit', 'shipment')
     -- ⚠️ NOT "influencer_completed_at IS NULL". Migration 164 backfilled every completed row,
     -- including this one, so the timestamps no longer distinguish a real completion from an
     -- invented one. The audit log does: the only entry is
     --     system | completed | Remote mode auto-completed
     -- Nobody did anything. That is the signature, and it cannot be faked by a backfill.
     AND EXISTS (SELECT 1 FROM production_event_log l
                  WHERE l.production_event_id = pe.id
                    AND l.action = 'completed' AND l.actor_role = 'system')
     AND NOT EXISTS (SELECT 1 FROM production_event_log l2
                      WHERE l2.production_event_id = pe.id
                        AND l2.actor_role <> 'system')`;

(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();

  const { rows } = await c.query(FIND);
  if (!rows.length) { console.log('nothing to repair'); await c.end(); return; }

  console.log(`${rows.length} event(s) the bug created:`);
  for (const r of rows) {
    console.log(`  ${r.creator} · ${r.campaign}`);
    console.log(`     now  mode=${r.mode} status=${r.status}  contract.production_mode=${r.production_mode}`);
    console.log(`     agreed mode = ${r.agreed_mode}  ->  will become mode=${r.agreed_mode} status=proposed`);
  }

  await c.query('BEGIN');
  for (const r of rows) {
    await c.query(`UPDATE contracts SET production_mode = $2 WHERE id = $1`, [r.contract_id, r.agreed_mode]);
    await c.query(
      `UPDATE production_events
          SET mode = $2, status = 'proposed',
              visit_completed_at = NULL,
              brand_completed_at = NULL,
              influencer_completed_at = NULL,
              updated_at = NOW()
        WHERE id = $1`,
      [r.id, r.agreed_mode]
    );
  }

  const { rows: after } = await c.query(
    `SELECT pe.mode, pe.status, con.production_mode
       FROM production_events pe JOIN contracts con ON con.id = pe.contract_id
      WHERE pe.id = ANY($1::uuid[])`, [rows.map(r => r.id)]);
  console.log('\nafter:');
  after.forEach(a => console.log(`  mode=${a.mode} status=${a.status} contract.production_mode=${a.production_mode}`));

  // Nothing else may have moved.
  const { rows: guard } = await c.query(`
    SELECT count(*)::int AS total,
           count(*) FILTER (WHERE status = 'completed')::int AS completed
      FROM production_events`);
  console.log(`\nall events: total=${guard[0].total} completed=${guard[0].completed}`);

  if (DRY) { await c.query('ROLLBACK'); console.log('\nROLLED BACK — nothing changed.'); }
  else     { await c.query('COMMIT');   console.log('\nCOMMITTED.'); }
  await c.end();
})().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
