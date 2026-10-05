/**
 * The bag (shopper-ordering · rules 6.6, 5.2). One bag for everything (R3); every item remembers
 * the post it came from (R1). A guest's bag lives on the phone; once signed in it lives on her
 * account (GET/PUT /follower/bag), and at sign-in the phone bag joins it (O8).
 *
 * A line: { ref, post_id, product_id, gift_item_id, colour, size, qty, role, ticked, price_seen }.
 * No prices are kept here: the server prices the bag every time it is shown (R5).
 *
 * shopper-app-fixes · F9 — two things this file used to get wrong:
 *   · the bag icon had no number after the app was reopened, until she opened the bag: the count
 *     is now read once, when the first bag icon appears;
 *   · a bag that could not be read came back as an empty one, so the Bag said "Your bag is empty"
 *     and the next add saved over what she really had: a failed read is now an error
 *     (`loadBag` throws), and nothing is added or saved after it.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { followerApi } from '../../services/api';
import { isSignedIn } from './shopStore';
import { CO } from './copyOrder';

const KEY = 'inflx_bag_v1';
const MAX_QTY = 5;
const listeners = new Set();
let lastCount = 0;
let counted = false;      // the icons have been told her real count at least once since the app opened
let counting = false;     // that first read is on its way
let told = 0;             // goes up with every count told, so a slow first read never undoes a newer one

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

/**
 * Tells every bag icon the count. `quiet` is a count that was only read (the app just opened, the
 * Bag was opened): the icon shows the number without the mark that says something was just added
 * (S6). A save or a sign-in merge is not quiet.
 */
function tell(lines, quiet = false) {
  counted = true;
  told += 1;
  lastCount = lines.reduce((s, l) => s + (l.role === 'gift' ? 0 : l.qty), 0);
  for (const fn of listeners) { try { fn(lastCount, { quiet }); } catch { /* a closed screen */ } }
}

async function readLocal() {
  try { const raw = await AsyncStorage.getItem(KEY); return raw ? clean(JSON.parse(raw)) : []; } catch { return []; }
}
async function writeLocal(lines) {
  try { await AsyncStorage.setItem(KEY, JSON.stringify(lines)); } catch { /* storage full: kept in memory for now */ }
}

/**
 * Her bag's lines, wherever it lives, and whether they could be read: { ok, lines }. A signed-in
 * bag the server could not give is NOT an empty bag (F9). If that very request signed her out
 * (her session ended elsewhere), she is a guest now and her bag is the phone's — no error.
 */
async function readMine() {
  if (await isSignedIn()) {
    let r = null;
    try { r = await followerApi.getBag(); } catch { r = null; }
    if (r && r.success && r.data) return { ok: true, lines: clean(r.data.lines) };
    if (await isSignedIn()) return { ok: false, lines: [] };
  }
  return { ok: true, lines: await readLocal() };
}

/** Thrown when her bag could not be read. Callers show it; nothing is saved after it. */
function loadFailed() {
  const e = new Error(CO.bagLoadFailed);
  e.code = 'BAG_LOAD_FAILED';
  return e;
}

/** Her bag's lines, wherever it lives. Throws when they could not be read (never an empty bag). */
export async function loadBag() {
  const r = await readMine();
  if (!r.ok) throw loadFailed();
  tell(r.lines, true);          // read, not added: the icons get the number without the "just added" mark
  return r.lines;
}

/**
 * Reads her bag only to tell the bag icons its count. A read that fails leaves the count as it
 * was. Used once when the app opens (the first icon asks), and when she signs in or out.
 */
export async function refreshBagCount() {
  const before = told;
  try {
    const r = await readMine();
    if (r.ok && before === told) tell(r.lines, true);
    return r.ok;
  } catch { return false; }
}

/** F9: the count is read once when the app opens — the first bag icon on screen asks for it. */
function countOnce() {
  if (counted || counting) return;
  counting = true;
  refreshBagCount().then(() => { counting = false; }, () => { counting = false; });
}

/**
 * Her bag's lines, read without touching the bag icon's count (shopper-walk-fixes: "Products in
 * this post" reads them each time it opens, to say "✓ In your bag"). A read that fails here must
 * not blank the count on every screen, so nothing is told to the icons.
 */
export async function peekBag() {
  if (await isSignedIn()) {
    const r = await followerApi.getBag();
    return r && r.success ? clean(r.data.lines) : [];
  }
  return readLocal();
}

/** Replaces the whole bag. Returns the lines as saved. */
export async function saveBag(lines) {
  const merged = mergeLines(lines);
  if (await isSignedIn()) {
    const r = await followerApi.putBag(merged);
    if (!r || !r.success) throw new Error((r && r.error && r.error.message) || CO.bagNotSaved);
    const saved = clean(r.data.lines);
    tell(saved);
    return saved;
  }
  await writeLocal(merged);
  tell(merged);
  return merged;
}

/**
 * Adds lines (Add to bag, a deal's review). If her bag cannot be read first, this throws and
 * nothing is saved — adding to "an empty bag" that was only a failed read wiped what she had (F9).
 */
export async function addToBag(lines) {
  const mine = await loadBag();
  return saveBag([...mine, ...lines]);
}

/** A deal edited again replaces that post's lines (Edit deal, D11). Throws, saving nothing, like addToBag. */
export async function replacePost(postId, lines) {
  const mine = await loadBag();
  return saveBag([...mine.filter((l) => l.post_id !== postId), ...lines]);
}

/** Sign-in (O8): the phone bag joins her account, then leaves the phone. */
export async function mergeBagAfterSignIn() {
  const local = await readLocal();
  // Nothing on the phone to move: the icon still has to show what is in her account's bag (F9).
  if (!local.length) { await refreshBagCount(); return; }
  const r = await followerApi.mergeBag(local);
  if (r && r.success) { await writeLocal([]); tell(clean(r.data.lines)); }
}

/**
 * The bag icon's count; calls back now and on every change, as fn(count, { quiet }). The first
 * icon to ask after the app opens has the count read for everyone (F9).
 */
export function subscribeBagCount(fn) {
  listeners.add(fn);
  fn(lastCount, { quiet: true });
  countOnce();
  return () => listeners.delete(fn);
}

/** Tests only: the bag as it is when the app has just been opened. */
export function _resetBag() {
  listeners.clear();
  lastCount = 0; counted = false; counting = false; told += 1;
}

export const BAG_MAX_QTY = MAX_QTY;
