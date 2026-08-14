/**
 * deviceId.js — stable per-install identity + per-session identity.
 * Contract: features/follower-event-log/ (Slice 0)
 *
 * The behaviour log has to work for GUESTS, because browsing without an account
 * is the normal path in this app (follower-guest-first law). follower_id is
 * NULL for them, so device_id carries the identity instead.
 *
 * Known limit, accepted and documented rather than solved: a reinstall is a new
 * device_id, so that follower reads as a new person. Solving it would mean
 * fingerprinting, which is not worth it.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'inflx_device_id';

// RFC-4122 v4 shape from Math.random. This is an analytics correlator, not a
// security token — it never authorises anything, so a CSPRNG is not required.
function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : ((r & 0x3) | 0x8);
    return v.toString(16);
  });
}

let cachedDeviceId = null;
let sessionId = uuid();

export async function getDeviceId() {
  if (cachedDeviceId) return cachedDeviceId;
  try {
    let id = await AsyncStorage.getItem(KEY);
    if (!id) { id = uuid(); await AsyncStorage.setItem(KEY, id); }
    cachedDeviceId = id;
  } catch {
    // Storage unavailable — fall back to an in-memory id for this run rather
    // than losing the whole session's events.
    cachedDeviceId = uuid();
  }
  return cachedDeviceId;
}

export function getSessionId() { return sessionId; }

/** New session on each return to foreground, so "one session" means one visit. */
export function newSession() { sessionId = uuid(); }
