/**
 * wishlist — token-aware facade over the product wishlist (Stage C2).
 * Screens call these; the facade decides guest (device-local) vs server.
 * Guest-first law: hearts work logged out; local data syncs to the account
 * the first time the list is loaded with a session present.
 *
 * A small in-memory Set of wished product_ids backs the instant heart state
 * on PDP/sheet cards; it hydrates on first use and stays in step with every
 * toggle in this JS session.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { followerApi } from './api';
import {
  getGuestWishlist, guestAdd, guestRemove,
  guestCreateCollection, guestRenameCollection, guestDeleteCollection,
  guestAssign, syncGuestWishlist,
} from '../utils/guestWishlist';

let _ids = null; // Set<product_id> | null (not hydrated yet)

async function authed() {
  try { return !!(await AsyncStorage.getItem('inflx_token')); } catch { return false; }
}

export async function loadWishlist() {
  if (await authed()) {
    // Adopt anything hearted as a guest, then serve the live-join truth.
    await syncGuestWishlist().catch(() => {});
    const res = await followerApi.getWishlist().catch(() => null);
    if (res?.success) {
      _ids = new Set((res.data.items || []).map((i) => i.product_id));
      return { ...res.data, guest: false };
    }
  }
  const data = await getGuestWishlist();
  _ids = new Set(data.items.map((i) => i.product_id));
  return { ...data, guest: true };
}

export async function isWished(productId) {
  if (!_ids) await loadWishlist();
  return _ids.has(productId);
}

/** product = card snapshot {product_id, name, price, offer_price?, image_url,
 * brand_id, brand_name} — only stored for guests. Returns new wished state. */
export async function toggleWish(product) {
  const id = product.product_id;
  if (!_ids) await loadWishlist();
  const has = _ids.has(id);
  if (await authed()) {
    if (has) await followerApi.wishlistRemove(id);
    else await followerApi.wishlistAdd(id);
  } else if (has) {
    await guestRemove(id);
  } else {
    await guestAdd(product);
  }
  if (has) _ids.delete(id); else _ids.add(id);
  return !has;
}

/** Idempotent add — used by the bag's "Move to Wishlist" (never toggles off). */
export async function ensureWish(product) {
  if (!_ids) await loadWishlist();
  if (_ids.has(product.product_id)) return true;
  return toggleWish(product);
}

export async function removeWish(productId) {
  if (await authed()) await followerApi.wishlistRemove(productId);
  else await guestRemove(productId);
  if (_ids) _ids.delete(productId);
}

export async function createCollection(name) {
  if (await authed()) {
    const res = await followerApi.wishlistCreateCollection(name);
    return res?.data?.collection || null;
  }
  return guestCreateCollection(name);
}

export async function renameCollection(id, name) {
  if (await authed()) await followerApi.wishlistRenameCollection(id, name);
  else await guestRenameCollection(id, name);
}

export async function deleteCollection(id) {
  if (await authed()) await followerApi.wishlistDeleteCollection(id);
  else await guestDeleteCollection(id);
}

export async function assignToCollection(productId, collectionId, on) {
  if (await authed()) {
    if (on) await followerApi.wishlistAssign(collectionId, productId);
    else await followerApi.wishlistUnassign(collectionId, productId);
  } else {
    await guestAssign(productId, collectionId, on);
  }
}
