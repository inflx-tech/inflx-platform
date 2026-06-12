'use strict';

/**
 * imageIngest.service.js — fetch a brand-supplied image URL and store a copy in
 * our own R2, returning a stable /v1/media/assets/:id URL (contract:
 * listing-image-urls). A pasted link is ingested ONCE so listings can't break
 * when the source link rots — mirrors the codebase's existing IG-cache choice.
 *
 * SECURITY: brands paste arbitrary URLs, so this is the SSRF trust boundary the
 * imageProxy (trusted-IG) path never had. Defence in depth:
 *   - http/https only
 *   - DNS-resolve the host and reject private/loopback/link-local/CGNAT/
 *     multicast addresses (v4, v6, v4-mapped)
 *   - re-validate on EVERY redirect hop (a 302 → 169.254.169.254 is the classic
 *     bypass), max 3 hops
 *   - require an image/* content-type; 5 MB + 15 s caps
 */

const net = require('net');
const dns = require('dns').promises;
const crypto = require('crypto');
const db = require('../config/db');
const env = require('../config/env');
const storage = require('./storage.service');

const FETCH_TIMEOUT_MS = 15000;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const USER_AGENT = 'Mozilla/5.0 (compatible; InflxBot/1.0; +https://inflx.in)';
const EXT_BY_TYPE = { 'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'image/avif': 'avif' };

function isPrivateIp(ip) {
  if (net.isIPv4(ip)) {
    const p = ip.split('.').map(Number);
    if (p[0] === 0 || p[0] === 10 || p[0] === 127) return true;
    if (p[0] === 169 && p[1] === 254) return true;            // link-local
    if (p[0] === 172 && p[1] >= 16 && p[1] <= 31) return true;
    if (p[0] === 192 && p[1] === 168) return true;
    if (p[0] === 100 && p[1] >= 64 && p[1] <= 127) return true; // CGNAT
    if (p[0] >= 224) return true;                              // multicast/reserved
    return false;
  }
  if (net.isIPv6(ip)) {
    const x = ip.toLowerCase();
    if (x === '::1' || x === '::') return true;
    if (x.startsWith('fe80')) return true;                    // link-local
    if (x.startsWith('fc') || x.startsWith('fd')) return true; // unique-local
    if (x.startsWith('ff')) return true;                      // multicast
    if (x.startsWith('::ffff:')) return isPrivateIp(x.slice(7)); // v4-mapped
    return false;
  }
  return true; // unparseable → block
}

async function assertSafeUrl(raw) {
  let u;
  try { u = new URL(raw); } catch { throw new Error('invalid_url'); }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('bad_scheme');
  const host = u.hostname.replace(/^\[|\]$/g, '');
  if (net.isIP(host)) { if (isPrivateIp(host)) throw new Error('private_ip'); return; }
  let addrs;
  try { addrs = await dns.lookup(host, { all: true }); } catch { throw new Error('dns_failed'); }
  if (!addrs.length) throw new Error('dns_failed');
  for (const a of addrs) if (isPrivateIp(a.address)) throw new Error('private_ip');
}

async function _safeFetch(url, hops = 0) {
  if (hops > 3) throw new Error('too_many_redirects');
  await assertSafeUrl(url);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'image/avif,image/webp,image/jpeg,image/png,image/*,*/*;q=0.8' },
      signal: controller.signal, redirect: 'manual',
    });
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get('location');
      if (!loc) throw new Error('bad_redirect');
      const next = new URL(loc, url).toString();
      clearTimeout(timer);
      return _safeFetch(next, hops + 1);   // re-validate the redirect target
    }
    if (!res.ok) throw new Error('unreachable');
    const ct = (res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    if (!ct.startsWith('image/')) throw new Error('not_image');
    const len = parseInt(res.headers.get('content-length') || '0', 10);
    if (len > MAX_IMAGE_BYTES) throw new Error('too_large');
    const ab = await res.arrayBuffer();
    if (ab.byteLength > MAX_IMAGE_BYTES) throw new Error('too_large');
    if (ab.byteLength === 0) throw new Error('empty');
    return { buf: Buffer.from(ab), contentType: ct };
  } finally {
    clearTimeout(timer);
  }
}

function publicBase() {
  return (process.env.RENDER_EXTERNAL_URL || `http://localhost:${env.PORT}`).replace(/\/+$/, '');
}

/**
 * Ingest one URL → R2 → brand_media_assets row → stable served URL.
 * Throws a typed Error (message = bad_scheme|private_ip|not_image|unreachable|
 * too_large|invalid_url|dns_failed|too_many_redirects) on any failure.
 */
async function ingestImageFromUrl({ brandId, url, title }) {
  if (!brandId) throw new Error('no_brand');
  const { buf, contentType } = await _safeFetch(String(url || '').trim());
  const ext = EXT_BY_TYPE[contentType] || 'jpg';
  const key = `brands/${brandId}/assets/listing-${crypto.randomUUID()}.${ext}`;
  await storage.putBuffer(key, buf, contentType);
  const { rows } = await db.query(
    `INSERT INTO brand_media_assets
       (brand_id, title, description, file_r2_key, file_name, file_type, file_size_bytes, tags)
     VALUES ($1,$2,NULL,$3,$4,$5,$6,$7) RETURNING id`,
    [brandId, String(title || 'Listing image').slice(0, 200), key, key.split('/').pop(), contentType, buf.length, ['listing']]
  );
  return `${publicBase()}/v1/media/assets/${rows[0].id}`;
}

module.exports = { ingestImageFromUrl, assertSafeUrl, isPrivateIp };
