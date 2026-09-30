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
