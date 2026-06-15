'use strict';

/**
 * collectionLibrary.service.js — Collections (Phase 4a). Layer 5.
 * Contract: features/merch-engine-p4a-collections-engine.
 *
 * A Collection = { name, image_url, ordered section_ids[] } — a named group of
 * Section-Library sections. The engine expands a placed collection into a titled
 * header + each member section rendered as a shelf (context-stacked, reusing the
 * Phase-3 evaluator). This module owns CRUD + validation + getForRender (engine read).
 */

const db = require('../config/db');

function validateCollection({ name, section_ids, business_type, image_url } = {}) {
  const out = {};
  const nm = String(name == null ? '' : name).trim();
  if (!nm) throw new Error('name is required');
  out.name = nm;
  if (section_ids !== undefined) {
    if (!Array.isArray(section_ids)) throw new Error('section_ids must be an array');
    const ids = section_ids.map(x => String(x || '').trim()).filter(Boolean);
    out.section_ids = ids; // order preserved, dupes allowed-then-deduped below
    const seen = new Set();
    out.section_ids = ids.filter(id => (seen.has(id) ? false : (seen.add(id), true)));
  }
  if (business_type !== undefined) out.business_type = business_type ? String(business_type).trim() : null;
  if (image_url !== undefined) out.image_url = image_url ? String(image_url).trim() : null;
  return out;
}

const COLS = `id, business_type, name, image_url, section_ids, status, created_at, updated_at`;

async function listCollections() {
  const { rows } = await db.query(`SELECT ${COLS} FROM collection_library ORDER BY name ASC`);
  return rows;
}

async function getCollection(id) {
  const { rows } = await db.query(`SELECT ${COLS} FROM collection_library WHERE id = $1`, [id]);
  return rows[0] || null;
}

async function createCollection(input) {
  const v = validateCollection(input);
  const { rows } = await db.query(
    `INSERT INTO collection_library (name, business_type, image_url, section_ids)
     VALUES ($1,$2,$3,$4) RETURNING ${COLS}`,
    [v.name, v.business_type || null, v.image_url || null, v.section_ids || []]
  );
  return rows[0];
}

function dedupeIds(arr) {
  const seen = new Set();
  return arr.map(x => String(x || '').trim()).filter(Boolean).filter(i => (seen.has(i) ? false : (seen.add(i), true)));
}

async function updateCollection(id, input) {
  const sets = [];
  const params = [id];
  if (input.name !== undefined) {
    const nm = String(input.name || '').trim();
    if (!nm) throw new Error('name cannot be empty');
    params.push(nm); sets.push(`name = $${params.length}`);
  }
  if (input.business_type !== undefined) { params.push(input.business_type ? String(input.business_type).trim() : null); sets.push(`business_type = $${params.length}`); }
  if (input.image_url !== undefined) { params.push(input.image_url ? String(input.image_url).trim() : null); sets.push(`image_url = $${params.length}`); }
  if (input.section_ids !== undefined) {
    if (!Array.isArray(input.section_ids)) throw new Error('section_ids must be an array');
    params.push(dedupeIds(input.section_ids)); sets.push(`section_ids = $${params.length}`);
  }
  if (input.status !== undefined) {
    if (!['active', 'hidden'].includes(input.status)) throw new Error('bad status');
    params.push(input.status); sets.push(`status = $${params.length}`);
  }
  if (!sets.length) throw new Error('no fields to update');
  sets.push('updated_at = now()');
  const { rows } = await db.query(
    `UPDATE collection_library SET ${sets.join(', ')} WHERE id = $1 RETURNING ${COLS}`,
    params
  );
  return rows[0] || null;
}

// Engine read: the header meta + active member sections in the stored order.
async function getForRender(id) {
  const { rows } = await db.query(
    `SELECT name, image_url, section_ids FROM collection_library WHERE id = $1 AND status = 'active'`,
    [id]
  );
  if (!rows[0]) return null;
  const ids = Array.isArray(rows[0].section_ids) ? rows[0].section_ids : [];
  if (!ids.length) return { name: rows[0].name, image_url: rows[0].image_url, sections: [] };
  const { rows: secs } = await db.query(
    `SELECT id, name FROM section_library WHERE id = ANY($1) AND status = 'active'`,
    [ids]
  );
  const byId = new Map(secs.map(s => [s.id, s]));
  const ordered = ids.map(i => byId.get(i)).filter(Boolean); // preserve order, drop hidden/missing
  return { name: rows[0].name, image_url: rows[0].image_url, sections: ordered };
}

module.exports = {
  validateCollection,
  listCollections,
  getCollection,
  createCollection,
  updateCollection,
  getForRender,
};
