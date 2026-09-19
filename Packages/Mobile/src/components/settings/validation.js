/**
 * Item 2 — client-side validation, same rules and same messages as the server (prompt §4).
 * Pure functions, unit-tested. The server is still the gate; this only keeps Save grey and
 * puts the message under the field before a round trip.
 * Contract: features/item2-pitch-invitation-settings
 */

import { MSG } from './copy';

const isBlank = (v) => v == null || v === '';
const isWhole = (v) => /^\d+$/.test(String(v).trim());

/** Brand pitch settings → { field: message } */
export function validateBrandSettings(s) {
  const e = {};
  if (!s.acceptedAims || s.acceptedAims.length === 0) e.acceptedAims = MSG.AIMS_BRAND;
  if (!s.acceptedModes || s.acceptedModes.length === 0) e.acceptedModes = MSG.MODES;
  if (!isBlank(s.minFollowersInstagram) && !isWhole(s.minFollowersInstagram)) e.minFollowersInstagram = MSG.WHOLE_NUMBER;
  if (!isBlank(s.minFollowersYoutube) && !isWhole(s.minFollowersYoutube)) e.minFollowersYoutube = MSG.WHOLE_NUMBER;
  if (!isBlank(s.minEngagementRate)) {
    const str = String(s.minEngagementRate).trim();
    const n = Number(str);
    const oneDecimal = /^\d+(\.\d)?$/.test(str);
    if (!Number.isFinite(n) || n < 0 || n > 100 || !oneDecimal) e.minEngagementRate = MSG.RATE_RANGE;
  }
  return e;
}

/** Creator invitation settings → { field: message }; commission rows keyed "commission:<aim>:<cat>". */
export function validateCreatorSettings(s) {
  const e = {};
  if (!s.acceptedAims || s.acceptedAims.length === 0) e.acceptedAims = MSG.AIMS_CREATOR;
  if (!s.acceptedModes || s.acceptedModes.length === 0) e.acceptedModes = MSG.MODES;
  // creator-distance-and-visit-preference: an empty visit list means "anywhere" now, so Store
  // Visit with no cities is a valid, saveable choice. (MSG.VISIT_CITIES stays for a server echo.)
  if (!isBlank(s.minFeeEngagement) && !isWhole(s.minFeeEngagement)) e.minFeeEngagement = MSG.WHOLE_RUPEES;
  if (!isBlank(s.minFeeHybrid) && !isWhole(s.minFeeHybrid)) e.minFeeHybrid = MSG.WHOLE_RUPEES;
  for (const [key, val] of Object.entries(s.commissions || {})) {
    if (isBlank(val)) continue;
    const n = Number(String(val).trim());
    if (!Number.isFinite(n) || n < 1 || n > 100) e[`commission:${key}`] = MSG.COMMISSION;
  }
  return e;
}

/** Which commission rows apply right now: only selected Aims, only selected categories (or ALL). */
export function visibleCommissionKeys(acceptedAims, brandCategoryCodes) {
  const aims = ['conversion', 'hybrid'].filter(a => (acceptedAims || []).includes(a));
  const cats = brandCategoryCodes && brandCategoryCodes.length ? brandCategoryCodes : ['ALL'];
  const keys = [];
  for (const a of aims) for (const c of cats) keys.push(`${a}:${c}`);
  return keys;
}

/** "Content ₹8,000 · Sale 12% · Hybrid ₹5,000 + 10%" — several industry rates show lowest–highest. */
export function minimumsSummary(settings, groupIndian) {
  const parts = [];
  const aims = settings.acceptedAims || [];
  const cats = settings.brandCategoryCodes && settings.brandCategoryCodes.length ? settings.brandCategoryCodes : ['ALL'];
  const range = (aim) => {
    const rows = (settings.minCommissions || []).filter(r => r.aim === aim && cats.includes(r.categoryCode) && r.pct != null);
    if (!rows.length) return null;
    const vals = rows.map(r => Number(r.pct));
    const lo = Math.min(...vals), hi = Math.max(...vals);
    return lo === hi ? `${lo}%` : `${lo}–${hi}%`;
  };
  if (aims.includes('engagement') && settings.minFeeEngagement != null) parts.push(`Content ₹${groupIndian(settings.minFeeEngagement)}`);
  if (aims.includes('conversion')) { const r = range('conversion'); if (r) parts.push(`Sale ${r}`); }
  if (aims.includes('hybrid')) {
    const fee = settings.minFeeHybrid != null ? `₹${groupIndian(settings.minFeeHybrid)}` : null;
    const r = range('hybrid');
    if (fee || r) parts.push(`Hybrid ${[fee, r].filter(Boolean).join(' + ')}`);
  }
  return parts.length ? parts.join(' · ') : 'None';
}
