'use strict';

/**
 * followerAppConfig.service.js — the shopper app's settings row (video autoplay and sound, COD),
 * read by the app at launch and by checkout; changed from admin → Follower App without an update.
 * Moved out of the retired followerPosts.service (follower-app-v2, 29 Sep 2026).
 */

const db = require('../config/db');

async function get() {
  const { rows } = await db.query(`SELECT config FROM follower_app_config WHERE id = 1`);
  return rows[0] ? rows[0].config : {};
}

async function update(patch) {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) throw new Error('config patch must be an object');
  const { rows } = await db.query(
    `UPDATE follower_app_config SET config = config || $1::jsonb, updated_at = now() WHERE id = 1 RETURNING config`,
    [JSON.stringify(patch)]);
  return rows[0] ? rows[0].config : {};
}

module.exports = { get, update };
