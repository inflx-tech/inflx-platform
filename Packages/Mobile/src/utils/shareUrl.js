import { Share, Alert } from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';

// Universal share links (contract: universal-share-links). One canonical scheme
// for every shareable target; optional creator/attribution context (handle + 4
// ids) is preserved so a share FROM a creator store still attributes.
//   influencer store → inflx.in/s/:handle
//   brand store      → inflx.in/b/:brand_id
//   product          → inflx.in/p/:product_id
//   offer            → inflx.in/o/:offer_id
const SHARE_BASE = 'https://inflx.in';

export function buildShareUrl(target = {}) {
  const { type, id, handle, cid, sid, oid, iid } = target;
  const q = [];
  if (cid) q.push(`cid=${encodeURIComponent(cid)}`);
  if (sid) q.push(`sid=${encodeURIComponent(sid)}`);
  if (oid) q.push(`oid=${encodeURIComponent(oid)}`);
  if (iid) q.push(`iid=${encodeURIComponent(iid)}`);
  const qs = q.length ? `?${q.join('&')}` : '';
  let path = '';
  switch (type) {
    case 'influencer': path = `/s/${encodeURIComponent(handle || id || '')}`; break;
    case 'brand':      path = `/b/${encodeURIComponent(id || '')}`; break;
    case 'product':    path = `/p/${encodeURIComponent(id || '')}`; break;
    case 'offer':      path = `/o/${encodeURIComponent(id || '')}`; break;
    default:           return null;
  }
  return `${SHARE_BASE}${path}${qs}`;
}

// Open the native share sheet (falls through silently if dismissed).
export async function shareTarget(target, message) {
  const url = buildShareUrl(target);
  if (!url) return;
  try {
    await Share.share({ message: message ? `${message}\n${url}` : url, url });
  } catch (_) { /* user dismissed */ }
}

// Copy the link to the clipboard with a confirmation toast.
export function copyShareLink(target) {
  const url = buildShareUrl(target);
  if (!url) return null;
  Clipboard.setString(url);
  Alert.alert('Link copied', 'Share it anywhere — it opens this in INFLX.');
  return url;
}
