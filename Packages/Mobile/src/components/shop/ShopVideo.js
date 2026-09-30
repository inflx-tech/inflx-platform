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
 */
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Image, TouchableOpacity, UIManager, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { track } from '../../services/events';
import { CS } from './copyShop';
import { fonts } from '../../theme/tokens';

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
/** Tests only. */
export function _setPlayerForTests(v) { VideoModule = v; }

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

export default function ShopVideo({ post, height, active = false, muted: mutedIn = true, surface = 'home', compact, onSoundChange, soundToggle }) {
  const poster = (post.products && post.products[0] && post.products[0].image_url) || null;
  const media = (post.media || [])[0];
  const [paused, setPaused] = useState(false);          // her own tap-to-pause
  const [muted, setMuted] = useState(mutedIn);
  const watched = useRef({ ms: 0, from: null, duration: null, ended: false, stallAt: null });

  useEffect(() => { setMuted(mutedIn); }, [mutedIn]);

  const playing = active && !paused;
  // When it stops playing (scrolled away, paused, screen left), say how long she watched.
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
  const Video = VideoModule;

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

  return (
    <View style={{ height, backgroundColor: '#111' }} testID={`video-${post.id}`}>
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
      <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={tapPause} testID={`video-tap-${post.id}`}>
        {paused ? <View style={[st.center, { flex: 1 }]}><View style={st.playMark}><Icon name="play" size={24} color="#fff" /></View></View> : null}
      </TouchableOpacity>
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
