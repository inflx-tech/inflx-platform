/**
 * The bag (shopper-ordering · rules 6.6, 5.2). One bag for everything (R3); every item remembers
 * the post it came from (R1). A guest's bag lives on the phone; once signed in it lives on her
 * account (GET/PUT /follower/bag), and at sign-in the phone bag joins it (O8).
 *
 * A line: { ref, post_id, product_id, gift_item_id, colour, size, qty, role, ticked, price_seen }.
 * No prices are kept here: the server prices the bag every time it is shown (R5).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { followerApi } from '../../services/api';
import { isSignedIn } from './shopStore';

const KEY = 'inflx_bag_v1';
const MAX_QTY = 5;
const listeners = new Set();
let lastCount = 0;

const keyOf = (l) => [l.post_id, l.product_id || '', l.gift_item_id || '', (l.colour || '').toLowerCase(), (l.size || '').toLowerCase(), l.role || 'buy'].join('|');
let refSeq = 0;
const newRef = () => `b${Date.now().toString(36)}${(refSeq += 1)}`;

function clean(lines) {
  return (lines || []).map((l) => ({
    ref: l.ref || l.id || newRef(), post_id: l.post_id, product_id: l.product_id || null, gift_item_id: l.gift_item_id || null,
    colour: l.colour || null, size: l.size || null, qty: Math.min(MAX_QTY, Math.max(1, Number(l.qty) || 1)),
    role: l.role || 'buy', ticked: l.ticked !== false, price_seen: l.price_seen == null ? null : Number(l.price_seen),
  }));
}

/** Same post + product + colour + size + role adds quantity, up to 5 (6.6). */
export function mergeLines(lines) {
  const out = [];
  const at = new Map();
  for (const l of clean(lines)) {
    const k = keyOf(l);
    if (at.has(k)) { const m = out[at.get(k)]; m.qty = Math.min(MAX_QTY, m.qty + l.qty); continue; }
    at.set(k, out.length); out.push(l);
  }
  return out;
}

function tell(lines) {
  lastCount = lines.reduce((s, l) => s + (l.role === 'gift' ? 0 : l.qty), 0);
  for (const fn of listeners) { try { fn(lastCount); } catch { /* a closed screen */ } }
}

async function readLocal() {
  try { const raw = await AsyncStorage.getItem(KEY); return raw ? clean(JSON.parse(raw)) : []; } catch { return []; }
}
async function writeLocal(lines) {
  try { await AsyncStorage.setItem(KEY, JSON.stringify(lines)); } catch { /* storage full: kept in memory for now */ }
}

/** Her bag's lines, wherever it lives. */
export async function loadBag() {
  if (await isSignedIn()) {
    const r = await followerApi.getBag();
    const lines = r && r.success ? clean(r.data.lines) : [];
    tell(lines);
    return lines;
  }
  const lines = await readLocal();
  tell(lines);
  return lines;
}

/** Replaces the whole bag. Returns the lines as saved. */
export async function saveBag(lines) {
  const merged = mergeLines(lines);
  if (await isSignedIn()) {
    const r = await followerApi.putBag(merged);
    if (!r || !r.success) throw new Error((r && r.error && r.error.message) || "Couldn't update your bag");
    const saved = clean(r.data.lines);
    tell(saved);
    return saved;
  }
  await writeLocal(merged);
  tell(merged);
  return merged;
}

/** Adds lines (Add to bag, a deal's review). */
export async function addToBag(lines) {
  const mine = await loadBag();
  return saveBag([...mine, ...lines]);
}

/** A deal edited again replaces that post's lines (Edit deal, D11). */
export async function replacePost(postId, lines) {
  const mine = await loadBag();
  return saveBag([...mine.filter((l) => l.post_id !== postId), ...lines]);
}

/** Sign-in (O8): the phone bag joins her account, then leaves the phone. */
export async function mergeBagAfterSignIn() {
  const local = await readLocal();
  if (!local.length) return;
  const r = await followerApi.mergeBag(local);
  if (r && r.success) { await writeLocal([]); tell(clean(r.data.lines)); }
}

/** The bag icon's count; calls back now and on every change. */
export function subscribeBagCount(fn) {
  listeners.add(fn);
  fn(lastCount);
  return () => listeners.delete(fn);
}

export const BAG_MAX_QTY = MAX_QTY;
