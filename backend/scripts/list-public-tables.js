'use strict';

/**
 * Inventory script: list every table in the public schema with its row count.
 * Read-only. No DDL, no data changes.
 *
 * Used to identify which tables hold ingest-only data (safe to TRUNCATE for
 * test resets) vs which tables hold real product data (must NEVER be touched).
 */

const { Client } = require('pg');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../.env') });

(async () => {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  // pg_class.reltuples is fast but estimated; for a small DB an exact count
  // is fine. We do exact counts so no surprises before a truncate decision.
  const { rows: tables } = await client.query(
    `SELECT tablename
       FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY tablename`
  );

  const results = [];
  for (const t of tables) {
    try {
      const { rows } = await client.query(
        `SELECT COUNT(*)::bigint AS c FROM "${t.tablename}"`
      );
      results.push({ table: t.tablename, rows: Number(rows[0].c) });
    } catch (e) {
      results.push({ table: t.tablename, rows: `ERROR: ${e.message}` });
    }
  }

  console.log(`\nPublic schema — ${results.length} tables\n`);
  console.log('  rows  | table');
  console.log('  ------|------------------------------------------------');
  for (const r of results) {
    const rowStr = String(r.rows).padStart(6);
    console.log(`  ${rowStr}| ${r.table}`);
  }

  // Tables with FK pointing at creator_profiles or posts — these are the
  // ingest-derived tables that would cascade on TRUNCATE.
  const { rows: fks } = await client.query(`
    SELECT
      tc.table_name AS dependent_table,
      kcu.column_name AS dependent_column,
      ccu.table_name AS referenced_table
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
     AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = tc.constraint_name
     AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND ccu.table_schema = 'public'
      AND ccu.table_name IN ('creator_profiles', 'posts')
    ORDER BY ccu.table_name, tc.table_name
  `);
  console.log('\nForeign keys pointing at creator_profiles / posts:');
  if (fks.length === 0) {
    console.log('  (none — only creator_profiles + posts hold ingest data)');
  } else {
    for (const fk of fks) {
      console.log(`  ${fk.dependent_table}.${fk.dependent_column} → ${fk.referenced_table}`);
    }
  }

  await client.end();
  console.log();
})().catch((e) => { console.error(e); process.exit(1); });
