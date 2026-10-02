/**
 * Is the video player inside this phone's app build?
 *
 * The same JS runs on every installed build (it arrives over the air), but the player
 * (react-native-video) is native: it is inside the builds made from 30 Sep 2026 and absent from
 * older ones. So the check is made at RUNTIME, once, and the player module is `require`d only when
 * its native view exists — never at the top of a file. An older build, and jest, never load it.
 *
 * One answer for the whole app: the shopper's post video (components/shop/ShopVideo.js, which
 * re-exports `hasPlayer` and the test seam) and the brand / creator file viewer
 * (components/content/MediaViewer12.js) both ask here.
 * Contract: features/follower-app-v2 (the check) · features/ui-walk-fixes board H (the move)
 */
import { UIManager } from 'react-native';

let VideoModule;

/** Whether this phone's app build has the video player (checked once). */
export function hasPlayer() {
  if (VideoModule !== undefined) return !!VideoModule;
  VideoModule = null;
  try {
    const cfg = UIManager.getViewManagerConfig ? UIManager.getViewManagerConfig('RCTVideo') : null;
    if (cfg) {
      const m = require('react-native-video');
      VideoModule = m.default || m.Video || null;
    }
  } catch (_) { VideoModule = null; }
  return !!VideoModule;
}

/** The player component itself, or null on a build without it. */
export function getPlayer() {
  return hasPlayer() ? VideoModule : null;
}

/** Tests only: a stand-in player, or null for "an older app build". */
export function _setPlayerForTests(v) { VideoModule = v; }
