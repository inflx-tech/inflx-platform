/**
 * A post's video (follower-app-v2 · rules v1.7 §4.7, §5.14).
 *
 *   New app build (the player is inside): plays from INFLX storage with a 200 MB cache on the phone;
 *     plays only while on screen (`active`), muted in the feed, with her sound setting in Play; the
 *     next videos render paused, so they start loading before she swipes (preload).
 *   Older app build: the product photo with "Update INFLX to play videos". The same JS runs on both,
 *     so the check is made at runtime and the player module is loaded only when it exists.
 *
 * Recorded (5.14): 'watch' (seconds watched when it stops), 'complete', 'replay', 'pause',
 * 'sound_on' / 'sound_off', and 'buffer' for every pause to load (the Cloudflare Stream signal).
 *
 * shopper-walk-fixes:
 *   V1  In a feed the video never takes the tap: the card under it opens the video full screen.
 *       A pause layer used to lie over the player on every screen and swallowed that tap (only on
 *       phones that have the player, which is why jest never saw it). Tap-to-pause is now asked
 *       for (`tapToPause`), and only Play asks.
 *   V3  The still that stands for a video is a picture taken from the video itself
 *       (`media[0].cover_url`); only when there is none, the first product's photo as before.
 *
 * shopper-video-pauses-for-popup — `held`: the products of this post (or the sign-in prompt) are
 * open over the video. It stops, sound and picture, and carries on from the same place when they
 * close. It is not `active = false`: that means "scrolled away" and forgets her own tap-pause, so a
 * video she had paused herself would start playing when she closed the products.
 */
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { track } from '../../services/events';
import { CS } from './copyShop';
import { fonts } from '../../theme/tokens';
import { hasPlayer, getPlayer } from '../../utils/videoPlayer';

// The runtime check lives in utils/videoPlayer.js since ui-walk-fixes (board H), so the brand and
// creator file viewer can ask the same question without importing shopper code. It is ONE check
// with ONE answer; this file still hands out `hasPlayer` and the test seam, as it always did.
export { hasPlayer, _setPlayerForTests } from '../../utils/videoPlayer';

/** The picture that stands for a video post (V3): its own, else the first product's photo. */
export function videoStill(post) {
  const media = post && post.media && post.media[0];
  if (media && media.cover_url) return media.cover_url;
  return (post && post.products && post.products[0] && post.products[0].image_url) || null;
}

function Placeholder({ poster, height, compact }) {
  return (
    <View style={[{ height, backgroundColor: '#3B3A35' }, st.center]} testID="video-placeholder">
      {poster ? <Image source={{ uri: poster }} style={[StyleSheet.absoluteFill, { opacity: 0.45 }]} resizeMode="cover" /> : null}
      <View style={st.playMark}><Icon name="play" size={24} color="#fff" /></View>
      {!compact ? (
        <View style={{ alignItems: 'center', marginTop: 10, paddingHorizontal: 24 }}>
          <Text style={st.vidTitle}>{CS.videoNeedsUpdate}</Text>
          <Text style={st.vidSub}>{CS.videoNeedsUpdateSub}</Text>
        </View>
      ) : null}
    </View>
  );
}

export default function ShopVideo({ post, height, active = false, held = false, muted: mutedIn = true, surface = 'home', compact, onSoundChange, soundToggle, tapToPause = false }) {
  const poster = videoStill(post);
  const media = (post.media || [])[0];
  const [paused, setPaused] = useState(false);          // her own tap-to-pause
  const [muted, setMuted] = useState(mutedIn);
  const watched = useRef({ ms: 0, from: null, duration: null, ended: false, stallAt: null });

  useEffect(() => { setMuted(mutedIn); }, [mutedIn]);

  const playing = active && !paused && !held;
  // When it stops playing (scrolled away, paused, covered, screen left), say how long she watched.
  useEffect(() => {
    const w = watched.current;
    if (playing) { w.from = Date.now(); return undefined; }
    if (w.from) {
      w.ms += Date.now() - w.from; w.from = null;
      if (w.ms >= 1000) track('watch', post.id, surface, { dwell_ms: w.ms, meta: { of_s: w.duration } });
      w.ms = 0;
    }
    return undefined;
  }, [playing, post.id, surface]);
  useEffect(() => () => {
    const w = watched.current;
    if (w.from) { const ms = w.ms + Date.now() - w.from; if (ms >= 1000) track('watch', post.id, surface, { dwell_ms: ms, meta: { of_s: w.duration } }); }
  }, [post.id, surface]);
  useEffect(() => { if (!active) setPaused(false); }, [active]);

  if (!media || !hasPlayer()) return <Placeholder poster={poster} height={height} compact={compact} />;
  const Video = getPlayer();

  function tapPause() {
    const next = !paused;
    setPaused(next);
    if (next) track('pause', post.id, surface);
  }
  function tapSound() {
    const next = !muted;
    setMuted(next);
    track(next ? 'sound_off' : 'sound_on', post.id, surface);
    if (onSoundChange) onSoundChange(!next);
  }

  // In a feed nothing here may take a touch (V1): the whole block is transparent to touches, so
  // the tap lands on the card and the card opens Play. Play asks for the pause layer and the
  // sound button, and there the block takes touches as before.
  const takesTouches = tapToPause || !!soundToggle;
  return (
    <View style={{ height, backgroundColor: '#111' }} testID={`video-${post.id}`} pointerEvents={takesTouches ? 'auto' : 'none'}>
      <Video
        source={{ uri: media.url }}
        style={StyleSheet.absoluteFill}
        resizeMode="cover"
        poster={poster || undefined}
        posterResizeMode="cover"
        paused={!playing}
        muted={muted}
        repeat
        playInBackground={false}
        playWhenInactive={false}
        bufferConfig={{ minBufferMs: 2500, maxBufferMs: 15000, bufferForPlaybackMs: 1000, bufferForPlaybackAfterRebufferMs: 2000, cacheSizeMB: 200 }}
        onLoad={(e) => { watched.current.duration = e && e.duration ? Math.round(e.duration) : null; }}
        onBuffer={({ isBuffering }) => {
          const w = watched.current;
          if (isBuffering && playing) w.stallAt = Date.now();
          else if (!isBuffering && w.stallAt) {
            const ms = Date.now() - w.stallAt; w.stallAt = null;
            if (ms >= 300) track('buffer', post.id, surface, { dwell_ms: ms });
          }
        }}
        onEnd={() => {
          const w = watched.current;
          track(w.ended ? 'replay' : 'complete', post.id, surface);
          w.ended = true;
        }}
        testID={`player-${post.id}`}
      />
      {tapToPause ? (
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={tapPause} testID={`video-tap-${post.id}`}>
          {paused ? <View style={[st.center, { flex: 1 }]}><View style={st.playMark}><Icon name="play" size={24} color="#fff" /></View></View> : null}
        </TouchableOpacity>
      ) : null}
      {soundToggle ? (
        <TouchableOpacity style={st.sound} onPress={tapSound} testID={`video-sound-${post.id}`} accessibilityLabel={muted ? 'Sound off' : 'Sound on'}>
          <Icon name={muted ? 'volume-off' : 'volume-high'} size={18} color="#fff" />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const st = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  playMark: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
  vidTitle: { color: '#fff', fontFamily: fonts.sansBold, fontSize: 13, textAlign: 'center' },
  vidSub: { color: 'rgba(255,255,255,0.8)', fontFamily: fonts.sansRegular, fontSize: 11.5, textAlign: 'center', marginTop: 2 },
  sound: { position: 'absolute', top: 12, right: 12, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
});
