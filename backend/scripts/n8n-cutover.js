'use strict';

/**
 * n8n cutover script — archives all existing workflows in the inflx18
 * project and imports the 6 v2 marketing-engine workflows from n8n/v2/.
 *
 * Operations:
 *   1. List every workflow currently in the project
 *   2. For each one not already prefixed [ARCHIVED:
 *        - Deactivate (if active)
 *        - Rename to "[ARCHIVED YYYY-MM-DD] {original_name}"
 *   3. For each n8n/v2/*.json:
 *        - POST /api/v1/workflows to create
 *        - Capture new ID
 *   4. For each newly imported workflow:
 *        - POST /api/v1/workflows/{id}/activate
 *   5. Print summary
 *
 * Usage:
 *   node scripts/n8n-cutover.js              # actually run
 *   node scripts/n8n-cutover.js --dry-run    # show plan, no API writes
 *
 * Reads N8N_API_KEY from the .env file (same as the rest of the project).
 * Base URL is hardcoded to inflx18.app.n8n.cloud.
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const BASE = 'https://inflx18.app.n8n.cloud/api/v1';
const API_KEY = process.env.N8N_API_KEY;

if (!API_KEY) {
  console.error('✗ N8N_API_KEY not set in backend/.env');
  process.exit(1);
}

const DRY_RUN = process.argv.includes('--dry-run');
const TODAY = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
const ARCHIVE_PREFIX = `[ARCHIVED ${TODAY}] `;

const V2_DIR = path.join(__dirname, '../../n8n/v2');
// Import order: leaf workflows first so inter-workflow webhooks can resolve
const V2_FILES = [
  'A6_v2.json',
  'A5_v2.json',
  'A5b_v2.json',
  'A25_v2.json',
  'A3_v2.json',
  'A2_v2.json',
];

const headers = {
  'X-N8N-API-KEY': API_KEY,
  'Content-Type': 'application/json',
  'accept': 'application/json',
};

async function api(method, urlPath, body) {
  const url = BASE + urlPath;
  const opts = { method, headers };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const r = await fetch(url, opts);
  const text = await r.text();
  let parsed;
  try { parsed = text ? JSON.parse(text) : null; } catch { parsed = text; }
  if (!r.ok) {
    const err = new Error(`${method} ${urlPath} → ${r.status}: ${text.slice(0, 300)}`);
    err.status = r.status;
    err.body = parsed;
    throw err;
  }
  return parsed;
}

async function listAllWorkflows() {
  const all = [];
  let cursor = null;
  do {
    const q = cursor ? `?limit=100&cursor=${encodeURIComponent(cursor)}` : '?limit=100';
    const r = await api('GET', `/workflows${q}`);
    all.push(...(r.data || []));
    cursor = r.nextCursor || null;
  } while (cursor);
  return all;
}

async function archiveWorkflow(wf) {
  if (DRY_RUN) {
    console.log(`  [dry-run] would archive: "${wf.name}" (active=${wf.active})`);
    return { ok: true, dryRun: true };
  }
  // 1. Deactivate
  if (wf.active) {
    try {
      await api('POST', `/workflows/${wf.id}/deactivate`);
    } catch (e) {
      console.log(`    ✗ deactivate failed: ${e.message}`);
      return { ok: false, error: e.message };
    }
  }
  // 2. Rename. The PATCH endpoint requires the full body shape — at minimum
  //    name + nodes + connections + settings. So fetch first, modify, PUT.
  let full;
  try {
    full = await api('GET', `/workflows/${wf.id}`);
  } catch (e) {
    console.log(`    ✗ fetch full workflow failed: ${e.message}`);
    return { ok: false, error: e.message };
  }
  // Build update payload — only fields n8n accepts on PUT.
  // n8n public API rejects `binaryMode` and other "additional properties"
  // in `settings`, so whitelist to the documented schema.
  const newName = ARCHIVE_PREFIX + full.name;
  const payload = {
    name: newName,
    nodes: full.nodes,
    connections: full.connections,
    settings: sanitizeSettings(full.settings),
  };
  try {
    await api('PUT', `/workflows/${wf.id}`, payload);
    return { ok: true, newName };
  } catch (e) {
    // If PUT fails, just leave it deactivated. The deactivation is the
    // important part — the rename is a nice-to-have label.
    console.log(`    ⚠ rename failed (deactivation succeeded): ${e.message}`);
    return { ok: true, renameFailed: true };
  }
}

// n8n public API allows these settings properties on POST / PUT.
// Anything else (e.g. binaryMode) is rejected as "additional properties".
const ALLOWED_SETTINGS_KEYS = new Set([
  'executionOrder',
  'saveExecutionProgress',
  'saveManualExecutions',
  'saveDataErrorExecution',
  'saveDataSuccessExecution',
  'executionTimeout',
  'errorWorkflow',
  'timezone',
]);

function sanitizeSettings(raw) {
  const out = {};
  for (const [k, v] of Object.entries(raw || {})) {
    if (ALLOWED_SETTINGS_KEYS.has(k)) out[k] = v;
  }
  if (!out.executionOrder) out.executionOrder = 'v1';
  return out;
}

function cleanWorkflowForImport(raw) {
  // n8n POST /workflows accepts:
  //   { name, nodes, connections, settings, staticData? }
  // Strip everything else that might cause schema rejections.
  return {
    name: raw.name,
    nodes: raw.nodes,
    connections: raw.connections,
    settings: sanitizeSettings(raw.settings),
  };
}

async function importWorkflow(filename, existingNames) {
  const filePath = path.join(V2_DIR, filename);
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const payload = cleanWorkflowForImport(raw);
  if (existingNames && existingNames.has(payload.name)) {
    return { ok: true, skipped: true, reason: 'already_exists', name: payload.name };
  }
  if (DRY_RUN) {
    console.log(`  [dry-run] would import: "${payload.name}" (${payload.nodes.length} nodes)`);
    return { ok: true, dryRun: true, name: payload.name };
  }
  try {
    const created = await api('POST', '/workflows', payload);
    return { ok: true, id: created.id, name: created.name };
  } catch (e) {
    return { ok: false, error: e.message, name: payload.name };
  }
}

async function activateWorkflow(id, name) {
  if (DRY_RUN) {
    console.log(`  [dry-run] would activate: "${name}" (${id})`);
    return { ok: true, dryRun: true };
  }
  try {
    await api('POST', `/workflows/${id}/activate`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

(async () => {
  console.log(`\nn8n cutover — ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
  console.log(`Target: ${BASE}\n`);

  // ── Step 1: List ─────────────────────────────────────────────────────────
  console.log('Step 1: Listing existing workflows…');
  const existing = await listAllWorkflows();
  console.log(`  → ${existing.length} workflow(s) found`);
  const toArchive = existing.filter(w => !w.name.startsWith('[ARCHIVED'));
  const alreadyArchived = existing.length - toArchive.length;
  console.log(`  → ${toArchive.length} to archive, ${alreadyArchived} already archived`);

  // ── Step 2: Archive ──────────────────────────────────────────────────────
  console.log(`\nStep 2: Archiving ${toArchive.length} workflow(s)…`);
  const archiveResults = { ok: 0, failed: 0, renameFailed: 0 };
  for (const wf of toArchive) {
    process.stdout.write(`  · ${wf.name.padEnd(60).slice(0, 60)} `);
    const r = await archiveWorkflow(wf);
    if (r.ok) {
      archiveResults.ok++;
      if (r.renameFailed) archiveResults.renameFailed++;
      console.log(r.dryRun ? '[would archive]' : (r.renameFailed ? '⚠ deactivated, rename failed' : '✓'));
    } else {
      archiveResults.failed++;
      console.log(`✗ ${r.error}`);
    }
  }

  // ── Step 3: Import v2 ────────────────────────────────────────────────────
  // Refresh existing names so we don't double-import if rerunning.
  const refreshed = await listAllWorkflows();
  const existingNames = new Set(refreshed.map(w => w.name));
  // Also track already-imported v2 workflows so we can include them in
  // the "to activate" list.
  const alreadyImportedV2 = refreshed.filter(w => !w.name.startsWith('[ARCHIVED'));

  console.log(`\nStep 3: Importing 6 v2 workflows…`);
  const imported = []; // { file, id, name }
  for (const f of V2_FILES) {
    process.stdout.write(`  · ${f.padEnd(20)} `);
    const r = await importWorkflow(f, existingNames);
    if (r.ok && r.skipped) {
      const existing = refreshed.find(w => w.name === r.name);
      if (existing) imported.push({ file: f, id: existing.id, name: existing.name, alreadyExisted: true });
      console.log(`↷ already exists (id ${existing?.id})`);
    } else if (r.ok) {
      console.log(r.dryRun ? `[would import "${r.name}"]` : `✓ imported as ID ${r.id}`);
      if (!r.dryRun) imported.push({ file: f, id: r.id, name: r.name });
    } else {
      console.log(`✗ ${r.error}`);
    }
  }

  // ── Step 4: Activate ─────────────────────────────────────────────────────
  console.log(`\nStep 4: Activating ${imported.length} imported workflow(s)…`);
  const activateResults = { ok: 0, failed: 0 };
  for (const w of imported) {
    process.stdout.write(`  · ${w.name.padEnd(50).slice(0, 50)} `);
    const r = await activateWorkflow(w.id, w.name);
    if (r.ok) {
      activateResults.ok++;
      console.log('✓ active');
    } else {
      activateResults.failed++;
      console.log(`✗ ${r.error}`);
    }
  }

  // ── Step 5: Verify ───────────────────────────────────────────────────────
  if (!DRY_RUN) {
    console.log(`\nStep 5: Verifying final state…`);
    const final = await listAllWorkflows();
    const v2Active = final.filter(w => !w.name.startsWith('[ARCHIVED') && w.active);
    const v2Inactive = final.filter(w => !w.name.startsWith('[ARCHIVED') && !w.active);
    const archived = final.filter(w => w.name.startsWith('[ARCHIVED'));
    console.log(`  → Active (non-archived): ${v2Active.length}`);
    v2Active.forEach(w => console.log(`     ON   ${w.name}`));
    if (v2Inactive.length > 0) {
      console.log(`  → Inactive (non-archived): ${v2Inactive.length}`);
      v2Inactive.forEach(w => console.log(`     off  ${w.name}`));
    }
    console.log(`  → Archived: ${archived.length}`);
  }

  // ── Summary ──────────────────────────────────────────────────────────────
  console.log(`\n── Summary ──`);
  console.log(`  Archived: ${archiveResults.ok}/${toArchive.length} ${archiveResults.renameFailed > 0 ? `(${archiveResults.renameFailed} rename failed but deactivated)` : ''}`);
  console.log(`  Imported: ${imported.length}/${V2_FILES.length}`);
  console.log(`  Activated: ${activateResults.ok}/${imported.length}`);
  console.log('');
})().catch(e => {
  console.error('\n✗ Fatal:', e.message);
  process.exit(1);
});
