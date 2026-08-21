'use strict';

/**
 * wipe-test-world.js — Stage 0, job B. Removes the dummy world from production.
 * Contract: features/stage-0-clear-the-decks
 *
 *   node scripts/wipe-test-world.js                 # dry run — counts only, deletes nothing
 *   node scripts/wipe-test-world.js --backup-only   # write the backup, delete nothing
 *   node scripts/wipe-test-world.js --execute       # back up, then delete
 *
 * THREE SAFEGUARDS, because this cannot be undone from the application:
 *
 *  1. It refuses to run if any money has ever moved. Verified 2026-08-20 that no
 *     wallet has ever held a rupee, but that is a fact about today, not a licence
 *     for tomorrow. The check runs every time.
 *
 *  2. It writes a full backup of every row it is about to delete BEFORE deleting
 *     anything, and stops if the backup cannot be written.
 *
 *  3. It deletes row by row, child before parent, and NEVER uses TRUNCATE CASCADE.
 *     A cascade here would silently take subscription_tiers with it — a known trap
 *     in this database, recorded after the test harness hit exactly that.
 *
 * KEEP_PHONES survive untouched: accounts the founder has identified as real.
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.prod-backup') });

// Accounts to preserve, from the founder's answer on the inventory.
//
//   +917569690534  Kartikeya — an employee. Confirmed real by the founder 2026-08-20.
//   +919391663469  registered the same day and never finished ("Pending (3469)").
//                  Kept too, deliberately: keeping a stale row costs nothing and is
//                  undone in seconds, while deleting a colleague's account cannot be
//                  undone at all. The founder can drop it whenever he confirms.
//   +918712700775  "Sitaram Kumar Bodempudi", brand "Hotel Village", joined 30 Mar.
//                  A real-looking number with a real-sounding business, flagged in the
//                  inventory and never explicitly ruled on. Kept on the same reasoning
//                  as 3469 — a stale row is undone in seconds, a real brand's account
//                  is not. Say the word and it goes.
const KEEP_PHONES = [
  '+917569690534',
  '+919391663469',
  '+918712700775',
];

// Tables that hang directly off a kept user and must be preserved WITH them.
// Without this the user row survives but its profile does not, and the account
// lands back on the registration form as though it were new — which is not what
// "keep this account" means.
const KEEP_WITH_USER = ['brands', 'influencers', 'followers', 'agencies'];

// Tables that must SURVIVE: platform configuration and Postgres/Supabase internals.
// Everything else that depends on a user account is derived from the database's own
// foreign keys at run time — see buildDeleteOrder(). Two hand-written lists were
// tried first and both rolled back on production: the first ordered
// follower_transactions before follower_orders, the second simply did not know
// creator_experiences existed. A list maintained by hand will always drift behind
// the schema; one derived from the schema cannot.
const KEEP_TABLES = new Set([
  'subscription_tiers', 'category_nodes', 'follower_app_config',
  'handshake_settings', 'test_phone_numbers', 'schema_migrations',
  'world_rules', 'sections', 'section_config', 'discover_layouts',
  'experience_templates', 'tag_vocabulary', 'meals_dictionary',
  // Commercial configuration — priced plans, fee bands, payment setup. These sit
  // downstream of a brand in the foreign-key graph, so the derivation sweeps them
  // up, but they are settings the platform runs on, not anybody's test data.
  'subscription_prices', 'tier_features', 'features', 'escrow_fee_tiers',
  'payment_config', 'categories',
  // The prospect pipeline. Founder's decision 2026-08-20: admin keeps gathering
  // scraped Instagram creators as a list to convert, but they must never appear in
  // brand search — a brand starting a collaboration with someone who has never
  // heard of INFLX is the first action in the product leading nowhere.
  //
  // The creator INFORMATION stays. What came out of their accounts does not:
  // posts, caption analysis, performance numbers and collaboration history are all
  // still in the delete set, deliberately.
  //
  // Safe to keep: creator_profiles points at users and influencers with ON DELETE
  // SET NULL, so wiping the accounts empties the pointer instead of taking the
  // prospect with it. Verified against production 2026-08-20.
  'creator_profiles',
]);

/**
 * Every table that transitively depends on public.users, ordered children-first.
 *
 * Cascading foreign keys are kept in the graph for REACHABILITY (a cascade child is
 * still user data and still needs backing up) but ignored for ORDERING, since the
 * parent delete removes them anyway.
 */
async function buildDeleteOrder(client) {
  const { rows: fks } = await client.query(`
    SELECT tc.table_name AS child, ccu.table_name AS parent, rc.delete_rule
      FROM information_schema.table_constraints tc
      JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
      JOIN information_schema.referential_constraints rc  ON rc.constraint_name  = tc.constraint_name
     WHERE tc.constraint_type = 'FOREIGN KEY'
       AND tc.table_schema = 'public' AND ccu.table_schema = 'public'`);

  // Reachability: which tables hang off users, directly or through others?
  const childrenOf = new Map();
  for (const f of fks) {
    if (f.child === f.parent) continue;
    if (!childrenOf.has(f.parent)) childrenOf.set(f.parent, new Set());
    childrenOf.get(f.parent).add(f.child);
  }
  const reachable = new Set(['users']);
  const queue = ['users'];
  while (queue.length) {
    for (const child of childrenOf.get(queue.pop()) || []) {
      if (!reachable.has(child)) { reachable.add(child); queue.push(child); }
    }
  }
  for (const t of KEEP_TABLES) reachable.delete(t);

  // Ordering: children before parents, over non-cascade edges only.
  const dependsOn = new Map([...reachable].map(t => [t, new Set()]));
  for (const f of fks) {
    if (f.delete_rule === 'CASCADE') continue;
    if (f.child === f.parent) continue;
    if (reachable.has(f.child) && reachable.has(f.parent)) dependsOn.get(f.child).add(f.parent);
  }
  const done = new Set(); const order = [];
  const visit = (t, stack = new Set()) => {
    if (done.has(t) || stack.has(t)) return;      // a cycle stops here rather than hanging
    stack.add(t);
    for (const p of dependsOn.get(t)) visit(p, stack);
    stack.delete(t); done.add(t); order.push(t);
  };
  for (const t of reachable) visit(t);
  return order.reverse();                          // parents last
}

// Configuration that must come through the wipe unchanged. Checked before and
// after, so the comparison is against reality rather than a hardcoded guess.
const CONFIG_TABLES = [
  ['subscription tiers',  'tiers'],
  ['product categories',  'categories'],
  ['app settings',        'app_config'],
  ['negotiation limits',  'handshake'],
  ['test-number list',    'test_numbers'],
];

// Counted one table at a time rather than as a single SELECT. A missing table in a
// combined query fails the whole statement at plan time — which is exactly what
// happened on the first production run, before migration 154 had been applied. The
// script stopped without deleting anything, which is the right failure, but a
// configuration table that simply does not exist yet should not stop a wipe at all.
const CONFIG_SOURCES = {
  tiers:        'subscription_tiers',
  categories:   'category_nodes',
  app_config:   'follower_app_config',
  handshake:    'handshake_settings',
  test_numbers: 'test_phone_numbers',
};

async function snapshotConfig(client) {
  const out = {};
  const { rows } = await client.query(`SELECT count(*)::int AS n FROM users`);
  out.users = rows[0].n;
  for (const [key, table] of Object.entries(CONFIG_SOURCES)) {
    out[key] = (await tableExists(client, table))
      ? (await client.query(`SELECT count(*)::int AS n FROM ${table}`)).rows[0].n
      : null;                                   // not present — nothing to protect
  }
  return out;
}

const MODE = process.argv.includes('--execute') ? 'execute'
           : process.argv.includes('--backup-only') ? 'backup'
           : 'dry-run';

async function tableExists(client, table) {
  const { rows } = await client.query(`SELECT to_regclass($1) AS t`, [`public.${table}`]);
  return rows[0].t !== null;
}

(async () => {
  // A local target (the test database) has no TLS; the hosted one requires it.
  // Being able to point this at the test database is what lets the destructive
  // path be proven before it is ever aimed at production.
  const url = process.env.DATABASE_URL;
  const isLocal = /localhost|127\.0\.0\.1/.test(url || '');
  const client = new Client({
    connectionString: url,
    ...(isLocal ? {} : { ssl: { rejectUnauthorized: false } }),
  });
  await client.connect();
  console.log(`target: ${isLocal ? 'LOCAL' : 'REMOTE'} — ${String(url).replace(/:[^:@]*@/, ':***@')}`);

  console.log(`\n=== wipe-test-world — mode: ${MODE.toUpperCase()} ===\n`);

  // ── Safeguard 1: refuse if money has ever moved ────────────────────────────
  const { rows: [money] } = await client.query(
    `SELECT
       (SELECT COALESCE(sum(wallet_balance),0) FROM brands)       AS bw,
       (SELECT COALESCE(sum(wallet_balance),0) FROM influencers)  AS cw,
       (SELECT COALESCE(sum(pending_balance),0) FROM influencers) AS cp,
       (SELECT count(*)::int FROM wallet_transactions)            AS wt,
       (SELECT count(*)::int FROM influencer_withdrawals)         AS wd`
  );
  if (Number(money.bw) > 0 || Number(money.cw) > 0 || Number(money.cp) > 0 ||
      money.wt > 0 || money.wd > 0) {
    console.error('REFUSING: real money is present on this platform.');
    console.error(`  brand wallets ₹${money.bw} · creator wallets ₹${money.cw} · pending ₹${money.cp}`);
    console.error(`  wallet movements ${money.wt} · withdrawals ${money.wd}`);
    console.error('\nEscalate to the founder. Do not wipe.\n');
    await client.end();
    process.exit(1);
  }
  console.log('Money check passed — nothing financial exists.\n');

  // Snapshot the configuration BEFORE touching anything, so the after-check can
  // prove this run did not take it.
  const configBefore = await snapshotConfig(client);

  // Resolve the kept accounts to ids up front, so their profile rows can be spared
  // alongside them rather than orphaning the login.
  let keptUserIds = [];
  if (KEEP_PHONES.length) {
    const { rows } = await client.query(
      `SELECT id, phone, role, name FROM users WHERE phone = ANY($1::text[])`, [KEEP_PHONES]
    );
    keptUserIds = rows.map(r => r.id);
    console.log(`Preserving ${rows.length} account(s):`);
    for (const r of rows) console.log(`  ${r.phone}  ${String(r.role).padEnd(11)} ${r.name}`);
    const missing = KEEP_PHONES.filter(p => !rows.some(r => r.phone === p));
    if (missing.length) console.log(`  (not found, nothing to preserve: ${missing.join(', ')})`);
    console.log('');
  }

  // The delete list and its order, straight from the live schema.
  const DELETE_ORDER = await buildDeleteOrder(client);
  console.log(`delete plan: ${DELETE_ORDER.length} tables, derived from the schema
`);

  // ── Safeguard 2: back up everything first ──────────────────────────────────
  const backup = { taken_at: new Date().toISOString(), keep_phones: KEEP_PHONES, tables: {} };
  let grandTotal = 0;

  for (const table of DELETE_ORDER) {
    if (!(await tableExists(client, table))) continue;
    const { rows } = await client.query(`SELECT * FROM ${table}`);
    backup.tables[table] = rows;
    if (rows.length) {
      console.log(`  ${table.padEnd(30)} ${String(rows.length).padStart(6)}`);
      grandTotal += rows.length;
    }
  }
  console.log(`  ${'TOTAL'.padEnd(30)} ${String(grandTotal).padStart(6)}\n`);

  if (MODE === 'dry-run') {
    console.log('Dry run — nothing was written and nothing was deleted.');
    console.log('Re-run with --backup-only, then --execute.\n');
    await client.end();
    return;
  }

  const backupDir = path.join(__dirname, '_backups');
  fs.mkdirSync(backupDir, { recursive: true });
  const backupPath = path.join(backupDir, `test-world-${Date.now()}.json`);
  fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2));

  const written = fs.statSync(backupPath).size;
  if (written < 1000) {
    console.error(`REFUSING: backup looks empty (${written} bytes). Nothing deleted.`);
    await client.end();
    process.exit(1);
  }
  console.log(`Backup written: ${backupPath} (${Math.round(written / 1024)} KB)\n`);

  if (MODE === 'backup') {
    console.log('Backup only — nothing deleted.\n');
    await client.end();
    return;
  }

  // ── Safeguard 3: delete in order, never a cascade ──────────────────────────
  console.log('Deleting…\n');
  await client.query('BEGIN');
  try {
    // A surviving account records WHICH ADMIN APPROVED IT, and every admin is about
    // to be deleted. That reference is NO ACTION, so it blocks the delete instead of
    // clearing itself — it is what rolled back the first two runs with a keep-list.
    // Clearing it costs nothing: the account stays approved, and who approved it in
    // the test era is not worth preserving an admin row for.
    // Whack-a-mole is the wrong tool here: brands.approved_by blocked one run and
    // payment_config.updated_by blocked the next. Find EVERY audit-style reference
    // that survives the wipe and points back at a user being deleted, and clear it.
    //
    // Only nullable columns are touched. A NOT NULL reference from a surviving row
    // would mean the row genuinely cannot outlive its user, and silently inventing a
    // value would be worse than stopping — so it is reported instead.
    const { rows: danglers } = await client.query(
      `SELECT tc.table_name AS tbl, kcu.column_name AS col, c.is_nullable
         FROM information_schema.table_constraints tc
         JOIN information_schema.key_column_usage kcu       ON kcu.constraint_name = tc.constraint_name
         JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
         JOIN information_schema.referential_constraints rc  ON rc.constraint_name  = tc.constraint_name
         JOIN information_schema.columns c
           ON c.table_name = tc.table_name AND c.column_name = kcu.column_name
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND ccu.table_name = 'users'
          AND rc.delete_rule IN ('NO ACTION', 'RESTRICT')
          AND tc.table_schema = 'public'`
    );

    const survives = (t) => !DELETE_ORDER.includes(t);
    for (const d of danglers.filter(d => survives(d.tbl))) {
      if (d.is_nullable !== 'YES') {
        throw new Error(
          `${d.tbl}.${d.col} points at a user being deleted and cannot be null. ` +
          `Add ${d.tbl} to the delete set or to KEEP_TABLES with a decision about this column.`
        );
      }
      const r = await client.query(`UPDATE ${d.tbl} SET ${d.col} = NULL WHERE ${d.col} IS NOT NULL`);
      if (r.rowCount) console.log(`  ${d.tbl}.${d.col}: cleared on ${r.rowCount} surviving row(s)`);
    }

    // Kept ACCOUNTS need the same treatment — their rows survive too.
    if (keptUserIds.length) {
      for (const d of danglers.filter(d => ['brands', 'influencers', 'agencies'].includes(d.tbl))) {
        const r = await client.query(
          `UPDATE ${d.tbl} SET ${d.col} = NULL
            WHERE user_id = ANY($1::uuid[]) AND ${d.col} IS NOT NULL`, [keptUserIds]
        );
        if (r.rowCount) console.log(`  ${d.tbl}.${d.col}: cleared on ${r.rowCount} kept account(s)`);
      }
    }

    for (const table of DELETE_ORDER) {
      if (!(await tableExists(client, table))) continue;

      // Three cases. The kept accounts keep their user row and their profile row;
      // everything else goes wholesale. Their campaigns, products and orders are
      // NOT spared — a kept account comes back clean, not with its old work.
      let sql = `DELETE FROM ${table}`;
      let params = [];

      if (keptUserIds.length && table === 'users') {
        sql = `DELETE FROM users WHERE id <> ALL($1::uuid[])`;
        params = [keptUserIds];
      } else if (keptUserIds.length && KEEP_WITH_USER.includes(table)) {
        sql = `DELETE FROM ${table} WHERE user_id <> ALL($1::uuid[])`;
        params = [keptUserIds];
      }

      const res = await client.query(sql, params);
      if (res.rowCount) console.log(`  ${table.padEnd(30)} ${String(res.rowCount).padStart(6)} removed`);
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(`\nFAILED — rolled back, nothing was deleted: ${err.message}`);
    console.error(`Your backup is still at ${backupPath}\n`);
    await client.end();
    process.exit(1);
  }

  // ── Read it back: accounts gone, configuration untouched ───────────────────
  // Compared against what was there BEFORE, not against hardcoded numbers. An
  // absolute expectation ("tiers should be 4") reports a catastrophe on any
  // database that legitimately has none, and says nothing at all about whether
  // THIS run destroyed them. Before-and-after is the only comparison that
  // actually catches the cascade trap this check exists for.
  const after = await snapshotConfig(client);
  console.log('\n=== after ===');
  console.log(`  accounts remaining     ${after.users}`);

  let configLost = false;
  for (const [label, key] of CONFIG_TABLES) {
    const was = configBefore[key];
    const now = after[key];
    if (was === null && now === null) {
      console.log(`  ${label.padEnd(22)}    -   not present`);
      continue;
    }
    const verdict = now === was ? 'untouched' : `*** WAS ${was}, NOW ${now} — DESTROYED ***`;
    if (now !== was) configLost = true;
    console.log(`  ${label.padEnd(22)} ${String(now).padStart(4)}   ${verdict}`);
  }
  if (configLost) {
    console.error('\n*** CONFIGURATION WAS DESTROYED. Restore from the backup. ***\n');
  }
  console.log(`\nBackup: ${backupPath}\n`);

  await client.end();
})().catch((err) => { console.error('FAILED:', err.message); process.exit(1); });
