/**
 * A creator's video, made smaller on her phone before it is uploaded (rules v1.7 §4.7): about 720p at
 * about 2 Mbps, so a 30-second clip is roughly 7–8 MB instead of 40–60 MB. Shoppers' videos then
 * start faster and cost less data.
 *
 * Needs the compressor inside the app build (the new APK). On an older build, or if shrinking fails,
 * the original file is uploaded exactly as before — never a lost post.
 */
import { NativeModules } from 'react-native';

export const TARGET = { maxSize: 1280, bitrate: 2000000 };

export function hasCompressor() {
  return !!(NativeModules && NativeModules.Compressor);
}

/** { uri, size, mime, shrunk } for the file to upload. */
export async function prepareVideo(asset, { onProgress } = {}) {
  const original = { uri: asset.uri, size: asset.fileSize, mime: asset.type || 'video/mp4', shrunk: false };
  if (!hasCompressor()) return original;
  try {
    const { Video, getFileSize } = require('react-native-compressor');
    const uri = await Video.compress(asset.uri, { compressionMethod: 'manual', maxSize: TARGET.maxSize, bitrate: TARGET.bitrate }, onProgress);
    const size = Number(await getFileSize(uri));
    if (!uri || !Number.isFinite(size) || size <= 0) return original;
    // Keep the original when shrinking didn't help (already small).
    if (asset.fileSize && size >= asset.fileSize) return original;
    return { uri, size, mime: 'video/mp4', shrunk: true };
  } catch (_) {
    return original;
  }
}

/** A picture too heavy for its limit is made again no larger than this, at this quality. */
export const PICTURE = { maxSize: 1280, quality: 0.8 };

/**
 * shopper-walk-fixes (W15 · frames B1, C1–C3) — a picture taken from a video, on her phone, so
 * every small tile and row that stands for the video can show it instead of a black box.
 *
 * `{ uri, size, mime: 'image/jpeg' }`, or null. Null is an answer, never an error:
 * an older app build (no compressor inside), a video the phone cannot read, a picture still over
 * `maxBytes` — the caller uploads the video exactly as before and it simply has no picture.
 * Nothing here may ever stop a video being uploaded, so nothing here throws.
 *
 * `size` is the FILE's real length, read back with getFileSize. On Android the thumbnail call's
 * own `size` is the picture's size in memory (width × height × 4), not the JPEG's — and the upload
 * link is signed for an exact length, so that number would have storage refuse the file.
 *
 * `maxBytes` is the server's limit for where the picture is going. A frame of a 4K video is over
 * it; that one is made again at 1280 with the same module's image call, and dropped if it is
 * still too heavy.
 */
export async function makeVideoPicture(videoUri, { maxBytes } = {}) {
  if (!videoUri || !hasCompressor()) return null;
  try {
    const lib = require('react-native-compressor');
    if (typeof lib.createVideoThumbnail !== 'function' || typeof lib.getFileSize !== 'function') return null;
    const made = await lib.createVideoThumbnail(videoUri);
    let uri = made && made.path;
    if (!uri) return null;
    let size = Number(await lib.getFileSize(uri));
    if (maxBytes && size > maxBytes && lib.Image && typeof lib.Image.compress === 'function') {
      uri = await lib.Image.compress(uri, { compressionMethod: 'manual', maxWidth: PICTURE.maxSize, maxHeight: PICTURE.maxSize, quality: PICTURE.quality, output: 'jpg' });
      size = uri ? Number(await lib.getFileSize(uri)) : NaN;
    }
    if (!uri || !Number.isInteger(size) || size <= 0 || (maxBytes && size > maxBytes)) return null;
    return { uri, size, mime: 'image/jpeg' };
  } catch (_) {
    return null;
  }
}
