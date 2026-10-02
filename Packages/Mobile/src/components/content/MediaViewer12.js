/**
 * The file viewer — a content file opens INSIDE the app (ui-walk-fixes board H, frames H1–H8).
 * Contract: features/ui-walk-fixes · research/C10-content-opens-cloudflare.md
 *
 * One tap on a tile opens this on a black screen, on all four content screens (brand and creator,
 * Pay for Content and Pay for Sale / Hybrid). Until now the tile opened a small menu and "View"
 * handed the file to the phone's browser on a Cloudflare address.
 *
 *   · It is a Modal, never a navigation route (no Stack.Screen to register twice).
 *   · A FRESH private link is fetched every time it opens and for every file stepped to — the
 *     tile's thumbnail link is never reused (both live 5 minutes).
 *   · Photo or video is decided by what the SERVER says the file is (kind / mime); the tile's own
 *     kind is only the fallback.
 *   · Photo: core Image, shown whole, resizeMethod="resize" (a 10 MB photo can draw blank
 *     without it). Works on every app build. A photo IS kept on the phone: core Image is the
 *     phone's standard picture component, and it keeps a copy of what it draws in the app's own
 *     private picture cache (not the gallery; other apps cannot read it) — exactly as the small
 *     tiles have done since item 12. The installed React Native has no JS switch to turn that off;
 *     it needs native code, so it is on the next app-build list (spec U26). Never say, here or to
 *     a creator, that a photo is not stored on the brand's phone.
 *   · Video: react-native-video with the player's own control bar, loaded lazily behind the
 *     runtime check (utils/videoPlayer.js). No VIDEO is cached on the phone — a creator's private,
 *     unapproved video must not be stored on the brand's phone (rule U8, which is about videos).
 *   · When the 5-minute link dies mid-play (a seek, a replay, a dropped connection) the player
 *     reports an error. A fresh link is fetched and handed to THE SAME player, which carries on
 *     from the second she is at — the second the PLAYER says, because after a drag on a dead link
 *     that is where she dragged to, and no progress report ever carried it. The player is not
 *     taken off the screen for this: it may be in its own full-screen mode, and it starts at the
 *     right second instead of jumping there from 0:00.
 *   · Sound on / off is the viewer's own small button in the top bar: the player's bar (6.4.5)
 *     has pause, the times and the progress line, but no sound button.
 *   · The player's bar also has a full-screen button that cannot be hidden. Its full-screen layer
 *     is not put away by the player when the player leaves the screen, so `Player` below does it.
 *   · An app build without the player (installed before 30 Sep 2026) says so and offers
 *     "Open in browser" — videos only; photos are unaffected.
 *   · The phone's Back button closes it (onRequestClose); closing unmounts the player, so nothing
 *     keeps playing behind the screen.
 *
 * What sits under the file is the caller's decision, not this component's:
 *   onAddNote  the brand's Pay for Content review, while it can still ask for changes (H6)
 *   onRemove   the creator, while she is still editing (H7)
 *   neither    everything else — the file and nothing else (the brand's Pay for Sale / Hybrid
 *              review, a package that is with the brand, a Story screenshot)
 *
 * Props
 *   open       null (closed) or { label, files: [{ id, kind? }], index }
 *   fetchUrl   (fileId) => the API's answer: { success, data: { view: { url, kind, mime } } }
 *   onClose    close it
 *   noteOf     (file) => the note to show in amber above the button, if any
 *   onAddNote  (file) => …   ·   onRemove  (file) => …
 *   held       true while something of the caller's is open on top (the note box): a video waits
 */
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Image, Modal, TouchableOpacity, ActivityIndicator, StyleSheet, Linking } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { settingsTokens as T, fonts } from '../../theme/tokens';
import { hasPlayer, getPlayer } from '../../utils/videoPlayer';
import { PrimaryButton, DangerButton, ButtonSlot } from '../settings/primitives';
import { C12 } from './copy12';

/** A dead link is renewed this many times in a row without the video moving before we give up. */
const MAX_RENEWALS = 2;
/** How long the player is given to say where it is; after that, the last second it reported. */
const ASK_MS = 800;

/**
 * Put the player's own full-screen layer away. It belongs to the player's view, and
 * react-native-video 6.4.5 does not dismiss it when that view is dropped: it would stay up, black,
 * over everything, with the next video playing unseen behind it. Does nothing when the player is
 * not in full screen, or is already gone.
 */
function leaveFullScreen(ref) {
  try {
    if (ref.current && typeof ref.current.setFullScreen === 'function') ref.current.setFullScreen(false);
  } catch (_) { /* its view has already gone */ }
}

/**
 * The video player on the screen. Whatever takes it off — a step to another file, "Couldn't load",
 * closing the viewer, the whole screen going away — its full-screen layer goes first. (A layout
 * effect's cleanup runs before the player's own ref is let go, so the player can still be told.)
 */
function Player({ Video, playerRef, ...props }) {
  useLayoutEffect(() => () => leaveFullScreen(playerRef), [playerRef]);
  return <Video ref={playerRef} {...props} />;
}

/** Photo or video — the server's word first, the tile's only when the server did not say. */
function kindOf(view, file) {
  const kind = view && view.kind;
  const mime = String((view && view.mime) || '').toLowerCase();
  if (kind === 'video' || mime.startsWith('video/')) return 'video';
  if (kind === 'photo' || mime.startsWith('image/')) return 'photo';
  return file && file.kind === 'video' ? 'video' : 'photo';
}

/** The boards' button on black: clear, white label, a soft white outline. */
function OnBlackButton({ label, icon, onPress, block, testID }) {
  return (
    <TouchableOpacity style={[s.onBlack, block && s.onBlackBlock]} onPress={onPress} activeOpacity={0.8}
      accessibilityRole="button" testID={testID}>
      {icon ? <Icon name={icon} size={16} color="#FFFFFF" style={s.onBlackIcon} /> : null}
      <Text style={s.onBlackText}>{label}</Text>
    </TouchableOpacity>
  );
}

function Arrow({ side, off, onPress }) {
  const prev = side === 'prev';
  return (
    <View style={[s.navWrap, prev ? s.navPrev : s.navNext]} pointerEvents="box-none">
      <TouchableOpacity style={[s.nav, off && s.navOff]} onPress={onPress} disabled={!!off} hitSlop={HIT}
        accessibilityRole="button" accessibilityLabel={prev ? C12.viewer.previous : C12.viewer.next}
        accessibilityState={{ disabled: !!off }} testID={prev ? 'viewer-prev' : 'viewer-next'}>
        <Icon name={prev ? 'chevron-left' : 'chevron-right'} size={20} color="#FFFFFF" />
      </TouchableOpacity>
    </View>
  );
}

/** Everything inside the Modal. Mounted when the viewer opens, gone when it closes. */
function ViewerBody({ open, fetchUrl, onClose, noteOf, onAddNote, onRemove, held }) {
  const files = open.files || [];
  const [idx, setIdx] = useState(() => Math.min(Math.max(0, Number(open.index) || 0), Math.max(0, files.length - 1)));
  const [media, setMedia] = useState({ phase: 'loading' });   // loading · ready { url, kind, startAt, gen } · error
  const [arrived, setArrived] = useState(false);              // the photo is drawn / the video is ready
  const [muted, setMuted] = useState(false);                  // her choice; it stays while she steps through the row
  const alive = useRef(true);
  const req = useRef(0);          // only the latest request may answer
  const shown = useRef(media);    // what `media` is now, for code that carries on after a wait
  const pos = useRef(0);          // the second the video has reached
  const resumedAt = useRef(0);    // where the last renewal picked up
  const fails = useRef(0);        // renewals in a row without the video moving
  const fetching = useRef(false); // a link is on its way — a second error from the old one is not a new failure
  const player = useRef(null);
  const fetchRef = useRef(fetchUrl);
  fetchRef.current = fetchUrl;
  const show = useCallback((m) => { shown.current = m; setMedia(m); }, []);

  const file = files[idx] || null;
  const fileId = file ? file.id : null;
  const kindHint = file ? file.kind : null;

  /**
   * Fetch a link made now and show the file from `startAt` seconds.
   * `keep` (a renewal): the player on the screen stays; only its link, and where it starts, change.
   */
  const load = useCallback(async (startAt = 0, keep = false) => {
    const mine = ++req.current;
    fetching.current = true;
    setArrived(false);
    if (!keep) show({ phase: 'loading' });
    let r = null;
    try { r = fileId ? await fetchRef.current(fileId) : null; } catch (_) { r = null; }
    if (!alive.current || mine !== req.current) return;
    fetching.current = false;
    const view = r && r.success && r.data ? r.data.view : null;
    if (!view || !view.url) { show({ phase: 'error' }); return; }
    // Two links made within the same second are the same address, and a player handed the address
    // it already has reloads nothing. Then, and only then, a renewal gets a new player (`gen`).
    const was = shown.current;
    const same = was.phase === 'ready' && was.url === view.url && was.startAt === startAt;
    resumedAt.current = startAt;
    pos.current = startAt;
    show({ phase: 'ready', url: view.url, kind: kindOf(view, { kind: kindHint }), startAt, gen: was.phase === 'ready' ? was.gen + (same ? 1 : 0) : 0 });
  }, [fileId, kindHint, show]);

  useEffect(() => () => { alive.current = false; }, []);
  // Opening, and every step to another file, starts from a fresh link at the beginning.
  useEffect(() => { pos.current = 0; resumedAt.current = 0; fails.current = 0; load(0); }, [load]);

  /**
   * The second the video is at, asked of the player itself. After a drag on a dead link the
   * player sits where she dragged to, and no progress report was ever sent from there (they stop
   * while it waits for data) — so the last reported second would be where she was BEFORE the drag.
   * A player that cannot say, or does not answer, falls back to that last reported second.
   */
  function whereItIs() {
    const last = pos.current;
    const from = (v) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : last);
    const p = player.current;
    if (!p || typeof p.getCurrentPosition !== 'function') return Promise.resolve(last);
    return new Promise((resolve) => {
      let done = false;
      const finish = (v) => { if (done) return; done = true; clearTimeout(timer); resolve(from(v)); };
      const timer = setTimeout(() => finish(null), ASK_MS);
      let asked = null;
      try { asked = p.getCurrentPosition(); } catch (_) { asked = null; }
      Promise.resolve(asked).then(finish, () => finish(null));
    });
  }

  /** The link died under a playing video: a fresh one for the same player, and on from the same second. */
  async function renew() {
    if (fetching.current) return;
    fails.current += 1;
    if (fails.current > MAX_RENEWALS) { show({ phase: 'error' }); return; }
    fetching.current = true;
    setArrived(false);                       // the spinner, at once
    const seen = req.current;
    const at = await whereItIs();
    if (!alive.current || seen !== req.current) return;   // she closed it, or stepped to another file, meanwhile
    load(at, true);
  }
  function retry() { fails.current = 0; load(pos.current); }
  function step(by) {
    const next = idx + by;
    if (next < 0 || next >= files.length) return;
    setIdx(next);
  }
  /** An app build without the player: the way it opened before this change, on a link made now. */
  async function openInBrowser() {
    let r = null;
    try { r = fileId ? await fetchRef.current(fileId) : null; } catch (_) { r = null; }
    if (!alive.current) return;
    const url = r && r.success && r.data && r.data.view ? r.data.view.url : null;
    if (!url) { show({ phase: 'error' }); return; }
    Linking.openURL(url).catch(() => {});
  }

  const ready = media.phase === 'ready';
  const video = ready && media.kind === 'video';
  const Video = video ? getPlayer() : null;
  const needsUpdate = video && !hasPlayer();
  const note = file && noteOf ? noteOf(file) : null;
  const many = files.length > 1;
  // Where it starts is part of the source, so a renewed video opens AT that second (it never
  // shows 0:00 first). The object changes only when the link or the second does.
  const url = ready ? media.url : null;
  const startAt = ready ? media.startAt : 0;
  const source = useMemo(
    () => (startAt > 0 ? { uri: url, startPosition: Math.round(startAt * 1000) } : { uri: url }),
    [url, startAt],
  );

  return (
    <View style={s.screen} testID="media-viewer">
      <View style={s.top}>
        <TouchableOpacity style={s.close} onPress={onClose} hitSlop={HIT} accessibilityRole="button"
          accessibilityLabel={C12.viewer.close} testID="viewer-close">
          <Icon name="close" size={20} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={s.title} numberOfLines={1} ellipsizeMode="middle" testID="viewer-title">
          {C12.viewer.title(open.label || '', files.length ? idx + 1 : 0, files.length)}
        </Text>
        {/* H2 — "sound". The player's bar has no such button, so it is the viewer's own; up here it
            cannot sit on top of the player's bar, and it does not hide when that bar does. */}
        {video && Video ? (
          <TouchableOpacity style={[s.close, s.sound]} onPress={() => setMuted((m) => !m)} hitSlop={HIT}
            accessibilityRole="button" accessibilityLabel={muted ? C12.viewer.soundOn : C12.viewer.soundOff} testID="viewer-sound">
            <Icon name={muted ? 'volume-off' : 'volume-high'} size={20} color="#FFFFFF" />
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={s.media}>
        {/* The phone's standard picture component: it keeps a copy of the photo in the app's own
            private picture cache (U26). Only the VIDEO below is never stored. */}
        {ready && media.kind === 'photo' ? (
          <Image source={{ uri: media.url }} style={s.fill} resizeMode="contain" resizeMethod="resize"
            onLoad={() => setArrived(true)} onError={() => show({ phase: 'error' })} testID="viewer-photo" />
        ) : null}

        {video && Video ? (
          // No bufferConfig / cacheSizeMB on purpose: a private VIDEO is never kept on the phone
          // (U8). That is true of videos only — a photo, above, stays in the app's picture cache (U26).
          // A renewed link is handed to the player that is already there (same `gen`, same player).
          // Another file is always another player: the screen is "loading" in between.
          <Player
            Video={Video}
            playerRef={player}
            key={media.gen}
            source={source}
            style={s.fill}
            resizeMode="contain"
            controls
            paused={!!held}
            muted={muted}
            repeat={false}
            playInBackground={false}
            playWhenInactive={false}
            onLoad={() => setArrived(true)}
            onProgress={(e) => {
              const at = e && typeof e.currentTime === 'number' ? e.currentTime : null;
              if (at == null) return;
              pos.current = at;
              if (at > resumedAt.current + 1) fails.current = 0;
            }}
            onEnd={() => { pos.current = 0; }}
            onError={renew}
            testID="viewer-video"
          />
        ) : null}

        {needsUpdate ? (
          <View style={s.panel} testID="viewer-needs-update">
            <Icon name="play" size={22} color="#FFFFFF" style={s.dimIcon} />
            <Text style={s.msg}>{C12.viewer.needsUpdate}</Text>
            <OnBlackButton label={C12.viewer.openInBrowser} icon="open-in-new" onPress={openInBrowser} testID="viewer-open-browser" />
          </View>
        ) : null}

        {media.phase === 'error' ? (
          <View style={s.center} testID="viewer-error">
            <Icon name="alert-circle-outline" size={22} color="#FFFFFF" style={s.dimIcon} />
            <Text style={s.msg}>{C12.viewer.couldntLoad}</Text>
            <View style={s.retry}><PrimaryButton label={C12.viewer.tryAgain} onPress={retry} testID="viewer-retry" /></View>
          </View>
        ) : null}

        {media.phase === 'loading' || (ready && !needsUpdate && !arrived) ? (
          <View style={s.spinner} pointerEvents="none" testID="viewer-loading">
            <ActivityIndicator size="large" color="#FFFFFF" />
          </View>
        ) : null}

        {many ? <Arrow side="prev" off={idx === 0} onPress={() => step(-1)} /> : null}
        {many ? <Arrow side="next" off={idx === files.length - 1} onPress={() => step(1)} /> : null}
      </View>

      {note || onAddNote || onRemove ? (
        <View style={s.actions} testID="viewer-actions">
          {note ? (
            <View style={s.note} testID="viewer-note">
              <Icon name="alert-circle-outline" size={14} color={T.state.yourMove.fg} style={s.noteIcon} />
              <Text style={s.noteText}>{note}</Text>
            </View>
          ) : null}
          {onAddNote && file ? <OnBlackButton block label={C12.addNote} onPress={() => onAddNote(file)} testID="viewer-add-note" /> : null}
          {onRemove && file ? <DangerButton outline label={C12.remove} onPress={() => onRemove(file)} testID="viewer-remove" /> : null}
        </View>
      ) : null}
    </View>
  );
}

export default function MediaViewer12({ open, fetchUrl, onClose, noteOf, onAddNote, onRemove, held }) {
  return (
    <Modal visible={!!open} animationType="fade" onRequestClose={onClose} hardwareAccelerated>
      {/* A pop-up is its own place: whatever bar the screen draws, these are plain buttons. */}
      <ButtonSlot.Provider value={null}>
        {open ? (
          <ViewerBody open={open} fetchUrl={fetchUrl} onClose={onClose} noteOf={noteOf}
            onAddNote={onAddNote} onRemove={onRemove} held={held} />
        ) : null}
      </ButtonSlot.Provider>
    </Modal>
  );
}

const HIT = { top: 8, bottom: 8, left: 8, right: 8 };

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0B0B0A' },
  top: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6 },
  close: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  sound: { marginRight: 0, marginLeft: 10 },
  title: { flex: 1, fontFamily: fonts.sansBold, fontSize: 14, color: '#FFFFFF' },
  media: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, paddingVertical: 8 },
  fill: { width: '100%', height: '100%' },
  spinner: { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  center: { alignItems: 'center', paddingHorizontal: 24 },
  dimIcon: { opacity: 0.8, marginBottom: 12 },
  msg: { fontFamily: fonts.sansBold, fontSize: 14.5, color: '#FFFFFF', textAlign: 'center', marginBottom: 12 },
  retry: { minWidth: 150 },
  panel: { alignSelf: 'stretch', alignItems: 'center', backgroundColor: '#1F1F1C', borderRadius: 14, paddingVertical: 24, paddingHorizontal: 16 },
  navWrap: { position: 'absolute', top: 0, bottom: 0, justifyContent: 'center' },
  navPrev: { left: 18 },
  navNext: { right: 18 },
  nav: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(11,11,10,0.62)', alignItems: 'center', justifyContent: 'center' },
  navOff: { opacity: 0.35 },
  actions: { paddingHorizontal: 14, paddingTop: 8, paddingBottom: 14, gap: 6 },
  note: { flexDirection: 'row', alignItems: 'flex-start', borderRadius: 8, paddingHorizontal: 9, paddingVertical: 6, backgroundColor: T.state.yourMove.bg },
  noteIcon: { marginTop: 2, marginRight: 6 },
  noteText: { flex: 1, fontFamily: fonts.sansSemiBold, fontSize: 12.5, lineHeight: 17, color: T.state.yourMove.fg },
  onBlack: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', minHeight: 44, borderRadius: 12, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.55)', paddingVertical: 11, paddingHorizontal: 18 },
  onBlackBlock: { alignSelf: 'stretch' },
  onBlackIcon: { marginRight: 8 },
  onBlackText: { fontFamily: fonts.sansSemiBold, fontSize: 15, color: '#FFFFFF' },
});
