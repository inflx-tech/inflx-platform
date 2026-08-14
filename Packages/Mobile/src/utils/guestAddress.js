/**
 * guestAddress — the follower app is guest-first (founder ruling 2026-07-25):
 * browse, cart and ADDRESS all work without login; phone+OTP is asked once,
 * at Place Order. Until then addresses live here, on the device, shaped like
 * the server rows so every screen renders them identically.
 *
 * Sync contract: syncGuestAddresses() pushes local rows to the account and
 * returns { guestId: serverAddressRow } so a checkout that selected a guest
 * address can swap in the real address_id. Rows that fail to sync stay local
 * — nothing the user typed is ever dropped.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { followerApi } from '../services/api';

const KEY = 'inflx_guest_addresses';

export async function getGuestAddresses() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function addGuestAddress(addr) {
  const list = await getGuestAddresses();
  const entry = {
    ...addr,
    id: `guest-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
    guest: true,
  };
  list.unshift(entry);
  await AsyncStorage.setItem(KEY, JSON.stringify(list));
  return entry;
}

export function isGuestAddressId(id) {
  return typeof id === 'string' && id.startsWith('guest-');
}

/**
 * Slice 1 (features/follower-profile-repairs) — remove a device-local address.
 * Guest rows have never reached the server, so unlike the account path this is
 * a real delete: there is no past order that could be pointing at it.
 */
export async function removeGuestAddress(id) {
  const list = await getGuestAddresses();
  const next = list.filter(a => a.id !== id);
  await AsyncStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

export async function syncGuestAddresses() {
  const list = await getGuestAddresses();
  if (!list.length) return {};
  const map = {};
  const remaining = [];
  for (const a of list) {
    const { id, guest, ...body } = a;
    const res = await followerApi.addAddress?.(body).catch(() => null);
    if (res?.success && res.data?.address) map[id] = res.data.address;
    else remaining.push(a);
  }
  await AsyncStorage.setItem(KEY, JSON.stringify(remaining));
  return map;
}
