/**
 * guestWishlist — the wishlist obeys the guest-first law (same as addresses):
 * hearts work logged out, saved on the device, synced to the account at the
 * one login moment. Shapes mirror the server payloads so WishlistScreen
 * renders both sources identically.
 *
 * Guest cards carry a snapshot (name/price/image) ONLY because there is no
 * account to join live data through yet; the moment the list syncs, the
 * server's live-join truth takes over (board rule: never stale copies for
 * logged-in users).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { followerApi } from '../services/api';

const ITEMS_KEY = 'inflx_guest_wishlist';
const COLLS_KEY = 'inflx_guest_wishlist_collections';

async function readJson(key) {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function getGuestWishlist() {
  const [items, collections] = await Promise.all([readJson(ITEMS_KEY), readJson(COLLS_KEY)]);
  return {
    items,
    collections: collections.map((c) => ({
      ...c,
      item_count: items.filter((i) => (i.collection_ids || []).includes(c.id)).length,
    })),
  };
}

export async function guestHas(productId) {
  const items = await readJson(ITEMS_KEY);
  return items.some((i) => i.product_id === productId);
}

export async function guestAdd(product) {
  const items = await readJson(ITEMS_KEY);
  if (!items.some((i) => i.product_id === product.product_id)) {
    items.unshift({ ...product, collection_ids: [], available: true, guest: true });
    await AsyncStorage.setItem(ITEMS_KEY, JSON.stringify(items));
  }
  return items;
}

export async function guestRemove(productId) {
  const items = (await readJson(ITEMS_KEY)).filter((i) => i.product_id !== productId);
  await AsyncStorage.setItem(ITEMS_KEY, JSON.stringify(items));
  return items;
}

export async function guestCreateCollection(name) {
  const colls = await readJson(COLLS_KEY);
  const found = colls.find((c) => c.name.toLowerCase() === name.toLowerCase());
  if (found) return found;
  const coll = { id: `guest-${Date.now()}-${Math.floor(Math.random() * 1e6)}`, name };
  colls.push(coll);
  await AsyncStorage.setItem(COLLS_KEY, JSON.stringify(colls));
  return coll;
}

export async function guestRenameCollection(id, name) {
  const colls = await readJson(COLLS_KEY);
  const next = colls.map((c) => (c.id === id ? { ...c, name } : c));
  await AsyncStorage.setItem(COLLS_KEY, JSON.stringify(next));
}

export async function guestDeleteCollection(id) {
  const colls = (await readJson(COLLS_KEY)).filter((c) => c.id !== id);
  await AsyncStorage.setItem(COLLS_KEY, JSON.stringify(colls));
  const items = (await readJson(ITEMS_KEY)).map((i) => ({
    ...i,
    collection_ids: (i.collection_ids || []).filter((cid) => cid !== id),
  }));
  await AsyncStorage.setItem(ITEMS_KEY, JSON.stringify(items));
}

export async function guestAssign(productId, collectionId, on) {
  const items = (await readJson(ITEMS_KEY)).map((i) => {
    if (i.product_id !== productId) return i;
    const set = new Set(i.collection_ids || []);
    if (on) set.add(collectionId); else set.delete(collectionId);
    return { ...i, collection_ids: [...set] };
  });
  await AsyncStorage.setItem(ITEMS_KEY, JSON.stringify(items));
}

/** After login: recreate collections, push items, re-link. Synced local data
 * is cleared; anything that fails stays local for the next attempt. */
export async function syncGuestWishlist() {
  const [items, colls] = await Promise.all([readJson(ITEMS_KEY), readJson(COLLS_KEY)]);
  if (!items.length && !colls.length) return false;

  const collMap = {}; // guest collection id -> server id
  const collsLeft = [];
  for (const c of colls) {
    const res = await followerApi.wishlistCreateCollection?.(c.name).catch(() => null);
    if (res?.success && res.data?.collection?.id) collMap[c.id] = res.data.collection.id;
    else collsLeft.push(c);
  }

  const itemsLeft = [];
  for (const i of items) {
    const res = await followerApi.wishlistAdd?.(i.product_id).catch(() => null);
    if (!res?.success) { itemsLeft.push(i); continue; }
    for (const gid of i.collection_ids || []) {
      const sid = collMap[gid];
      if (sid) await followerApi.wishlistAssign?.(sid, i.product_id).catch(() => {});
    }
  }

  await AsyncStorage.setItem(ITEMS_KEY, JSON.stringify(itemsLeft));
  await AsyncStorage.setItem(COLLS_KEY, JSON.stringify(collsLeft));
  return true;
}
