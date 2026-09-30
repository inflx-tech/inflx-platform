/**
 * What the shopper app keeps on the phone (follower-app-v2 · rules v1.7 §5.2–5.4, §5.14).
 *
 *   guest follows and saves   kept here until sign-in, then moved to her account (merge)
 *   Welcome choices            Women/Men/Kids, styles, her city; sent with each feed request
 *   last Home visit            for the "new posts since your last visit" ring on the circles
 *   location                   the phone's current position, read when needed and held only in
 *                              memory for a few minutes. It is NEVER written to storage and the
 *                              server never stores it either (5.3).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PermissionsAndroid, Platform } from 'react-native';
import { followerApi } from '../../services/api';
import { getDeviceId } from '../../services/deviceId';

const KEY = 'inflx_shop_v2';
const EMPTY = { follows: [], savedPosts: [], savedProducts: [], shopFor: [], styles: [], cityId: null, cityName: null, welcomed: false, lastHome: null, useLocation: false };

let state = null;
const listeners = new Set();

async function load() {
  if (state) return state;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    state = raw ? { ...EMPTY, ...JSON.parse(raw) } : { ...EMPTY };
  } catch {
    state = { ...EMPTY };
  }
  return state;
}

async function write(patch) {
  const cur = await load();
  state = { ...cur, ...patch };
  try { await AsyncStorage.setItem(KEY, JSON.stringify(state)); } catch { /* storage full: keep in memory */ }
  for (const fn of [...listeners]) { try { fn(state); } catch { /* never break a screen */ } }
  return state;
}

export const shopStore = {
  get: load,
  set: write,
  subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  /** Tests only. */
  _reset() { state = null; listeners.clear(); },
};

export async function isSignedIn() {
  try {
    const [token, user] = await AsyncStorage.multiGet(['inflx_token', 'inflx_user']);
    if (!token[1] || !user[1]) return false;
    return JSON.parse(user[1]).role === 'follower';
  } catch {
    return false;
  }
}

/* ───────────────────────────────────────────── follows and saves (5.2) */

export async function toggleFollowLocal(influencerId, on) {
  const s = await load();
  const set = new Set(s.follows);
  if (on) set.add(influencerId); else set.delete(influencerId);
  return write({ follows: [...set] });
}

export async function toggleSavePostLocal(postId, on) {
  const s = await load();
  const list = s.savedPosts.filter((x) => x !== postId);
  return write({ savedPosts: on ? [postId, ...list] : list });
}

/** A saved product always remembers where it came from: a post, or a collection item. */
export async function toggleSaveProductLocal(item, on) {
  const s = await load();
  const list = s.savedProducts.filter((x) => x.product_id !== item.product_id);
  return write({ savedProducts: on ? [{ product_id: item.product_id, post_id: item.post_id || null, collection_item_id: item.collection_item_id || null }, ...list] : list });
}

/** Sign-in: move what the guest kept on the phone to her account, then forget it here. */
export async function mergeAfterSignIn() {
  const s = await load();
  const res = await followerApi.merge({ follows: s.follows, saved_posts: s.savedPosts, saved_products: s.savedProducts });
  if (res && res.success) await write({ follows: [], savedPosts: [], savedProducts: [] });
  const prefs = {};
  if (s.cityId) prefs.city_id = s.cityId;
  if (s.shopFor.length) prefs.shop_for = s.shopFor;
  if (s.styles.length) prefs.style_tag_ids = s.styles;
  if (s.welcomed) prefs.welcomed = true;
  if (Object.keys(prefs).length) await followerApi.setPreferences(prefs);
  return res;
}

/* ───────────────────────────────────────────── where she is (5.3) */

let lastFix = null;              // { lat, lng, at } — memory only
let noFixUntil = 0;              // no fix recently: don't make her wait again for a while
const FIX_FRESH_MS = 5 * 60 * 1000;
const FIX_WAIT_MS = 3000;        // never hold the feed longer than this for a location
const NO_FIX_PAUSE_MS = 2 * 60 * 1000;

export async function askLocationPermission() {
  if (Platform.OS !== 'android') return true;
  try {
    const r = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION);
    return r === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
}

async function hasLocationPermission() {
  if (Platform.OS !== 'android') return true;
  try { return await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION); } catch { return false; }
}

/** The phone's position now (or from the last few minutes), or null. Never stored. */
export async function currentPosition() {
  const s = await load();
  if (!s.useLocation) return null;
  if (lastFix && Date.now() - lastFix.at < FIX_FRESH_MS) return { lat: lastFix.lat, lng: lastFix.lng };
  if (Date.now() < noFixUntil) return null;       // her city is used meanwhile (5.3)
  if (!(await hasLocationPermission())) return null;
  let Geo;
  try { Geo = require('@react-native-community/geolocation'); Geo = Geo.default || Geo; } catch { return null; }
  return new Promise((resolve) => {
    let done = false;
    const finish = (v) => {
      if (done) return;
      done = true;
      if (!v) noFixUntil = Date.now() + NO_FIX_PAUSE_MS;
      resolve(v);
    };
    setTimeout(() => finish(null), FIX_WAIT_MS);
    try {
      Geo.getCurrentPosition(
        (p) => {
          lastFix = { lat: Math.round(p.coords.latitude * 1000) / 1000, lng: Math.round(p.coords.longitude * 1000) / 1000, at: Date.now() };
          finish({ lat: lastFix.lat, lng: lastFix.lng });
        },
        () => finish(null),
        { enableHighAccuracy: false, timeout: FIX_WAIT_MS, maximumAge: 10 * 60 * 1000 },
      );
    } catch {
      finish(null);
    }
  });
}

/** What every feed / circles request carries: her choices, her follows (guest) and where she is. */
export async function whoParams() {
  const s = await load();
  const pos = await currentPosition();
  return {
    shop_for: s.shopFor, styles: s.styles, city_id: s.cityId || undefined,
    follows: (await isSignedIn()) ? [] : s.follows,
    lat: pos ? pos.lat : undefined, lng: pos ? pos.lng : undefined,
  };
}

export async function ensureDeviceHeader() {
  const id = await getDeviceId();
  require('../../services/api').setDeviceHeader(id);
  return id;
}
