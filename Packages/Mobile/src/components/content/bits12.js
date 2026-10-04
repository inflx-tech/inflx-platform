/**
 * Item 12 — the pieces the content screens are built from.
 * Contract: features/item12-content · mockups C1–C16 · prompt §8
 *
 *   FeeCard12   her fee and its three payments: a filled dot for paid, an amber ring for next,
 *               an empty ring for later — the step line's vocabulary (prompt §8). Her fee alone
 *               (Q1); the campaign fee is its own line, on the brand's card only.
 *   FileTile12  square-ish, rounded; a photo shows itself, a video shows a play mark and its
 *               duration badge — over the picture taken from it when it has one (shopper-walk-fixes
 *               W15: VideoFace12, hasCover12, sendCover12); an upload in flight shows its percentage.
 *   CountChip12 "n of m" — grey while short, green when met.
 *   RoundPill12 "ROUND 1 OF 2", "· LAST", "ROUNDS USED" (Q8), item 6's pill look.
 *   QuoteBox12, History12, LinkLine12, Record12, Line12.
 *
 * No native module here: images are core <Image>, and a posted link opens with Linking (item 11's
 * way). A FILE no longer does: one tap on a FileTile12 opens it inside the app, in MediaViewer12
 * (ui-walk-fixes board H) — the tile only reports the press, the screen opens the viewer.
 *
 * ui-walk-fixes board J (frames J1–J7) adds the link she pastes after posting:
 *   LinkBox12   the one self-saving link box, used by her content screen and by both link
 *               places on Going live. "Saving…" at its right end, the tick beside it when INFLX
 *               has the link, the red line under it when the link is refused.
 *   useSaves12  the screen's one line of saves: every link and caption is sent through it, one
 *               at a time and in order, so an older answer can never undo a newer one.
 */
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, Image, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { settingsTokens as T, fonts } from '../../theme/tokens';
import { FieldError } from '../settings/primitives';
import { Row10 } from '../shoot/bits10';
import { makeVideoPicture } from '../../utils/videoPrep';
import { C12, rupees5, duration12, day10, COVER_MAX_12, COVER_PUT_MS_12 } from './copy12';

/* ── the fee card ─────────────────────────────────────────────────────────── */

export function FeeCard12({ money, side, testID }) {
  if (!money) return null;
  // Item 17: a payment INFLX returned to the brand (status 'refunded') will never be made — it is
  // shown as returned, and is never the "next" one.
  const gone = (t) => !!(t && t.status === 'refunded');
  const rows = [
    { key: 't1', label: C12.fee.onSigning, t: money.t1, when: money.t1 && money.t1.paidAt ? C12.fee.paid(money.t1.paidAt) : '' },
    { key: 't2', label: C12.fee.contentLive, t: money.t2, when: gone(money.t2) ? C12.fee.returned : money.t2 && money.t2.paidAt ? C12.fee.paid(money.t2.paidAt) : C12.fee.whenTheyConfirm },
    { key: 't3', label: C12.fee.afterDays(money.waitDays || 7), t: money.t3, when: gone(money.t3) ? C12.fee.returned : money.t3 && money.t3.paidAt ? C12.fee.paid(money.t3.paidAt) : C12.fee.thenComplete },
  ];
  const nextKey = (rows.find((r) => !(r.t && (r.t.paidAt || gone(r.t)))) || {}).key;
  const allPaid = !nextKey;
  return (
    <View style={f.card} testID={testID || 'fee-card'}>
      <Text style={f.title}>{C12.fee.title(money.fee)}</Text>
      {rows.map((r) => {
        const paid = !!(r.t && r.t.paidAt);
        const state = paid ? 'paid' : r.key === nextKey ? 'next' : 'later';
        return (
          <View key={r.key} style={f.row} testID={`fee-${r.key}-${state}`}>
            <View style={[f.dot, state === 'paid' ? f.dotPaid : state === 'next' ? f.dotNext : f.dotLater]}>
              {paid ? <Icon name="check" size={9} color="#FFFFFF" /> : null}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={f.label}>{r.label}</Text>
              {r.when ? <Text style={f.when}>{r.when}</Text> : null}
            </View>
            <Text style={[f.amount, !paid && { color: T.ink2 }]}>{rupees5(r.t ? r.t.amount : 0)}</Text>
          </View>
        );
      })}
      {side === 'brand' && money.campaignFee ? (
        <Text style={f.feeLine} testID="campaign-fee-line">{allPaid ? C12.fee.campaignFeeDone(money.campaignFee) : C12.fee.campaignFeeWaiting(money.campaignFee)}</Text>
      ) : null}
    </View>
  );
}

/* ── files ────────────────────────────────────────────────────────────────── */

/**
 * shopper-walk-fixes (W15 · frames B1, C1–C3) — what stands for a VIDEO wherever a small picture
 * of one is drawn: the picture taken from it, a play mark over it, and its length when given.
 * A video with no picture (uploaded before 4 Oct 2026, or from an app build that cannot make one)
 * is the dark tile with the same play mark — never an empty box, and the same dark tile is what
 * shows while the picture is on its way or if it will not draw.
 *
 * It FILLS the box it is put in: the caller's box gives the size, the corners and
 * `overflow: 'hidden'`. It takes no touches — the box around it does.
 *
 *   url        the PICTURE's address (never the video's)        durationS  seconds, or null
 *   mark       the play mark's size: 22 on a tile, 14 on a post row's small picture
 */
export function VideoFace12({ url, durationS, mark = 22, testID }) {
  // Over a picture the mark sits on a soft dark disc, so it reads on a pale frame too.
  const disc = Math.round(mark * 1.6);
  return (
    <View style={t.face} pointerEvents="none" testID={testID || 'video-face'}>
      {url ? <Image source={{ uri: url }} style={t.img} resizeMode="cover" testID="video-picture" /> : null}
      <View style={url ? [t.markDisc, { width: disc, height: disc, borderRadius: disc / 2 }] : null} testID="play-mark">
        <Icon name="play" size={mark} color="#FFFFFF" />
      </View>
      {durationS != null ? (
        <View style={t.badge} testID="duration-badge"><Text style={t.badgeText}>{duration12(durationS)}</Text></View>
      ) : null}
    </View>
  );
}

/** A shared video that has a picture taken from it — the tile asks for that picture, never for the video. */
export const hasCover12 = (file) => !!(file && file.kind === 'video' && file.hasCover);

/**
 * `url` is always a PICTURE: the photo itself, or — for a video with `hasCover` — the picture taken
 * from it (asked for with `?cover=1`). A video's own address is never drawn here.
 */
export function FileTile12({ file, url, progress, note, onPress, testID }) {
  const video = file ? file.kind === 'video' : false;
  const uploading = progress != null;
  return (
    <TouchableOpacity style={[t.tile, video && t.tileVideo]} onPress={onPress} disabled={!onPress || uploading}
      activeOpacity={0.8} accessibilityRole="button" testID={testID || (file ? `file-${file.id}` : 'file-uploading')}>
      {!video && url ? <Image source={{ uri: url }} style={t.img} resizeMode="cover" /> : null}
      {video ? <VideoFace12 url={hasCover12(file) ? url : null} durationS={file.durationS} /> : null}
      {!video && !url && !uploading ? <Icon name="image-outline" size={20} color={T.ink3} /> : null}
      {uploading ? (
        <View style={t.progress} testID="upload-progress"><Text style={t.progressText}>{C12.uploading(progress)}</Text></View>
      ) : null}
      {note ? <View style={t.noteDot} testID="note-dot" /> : null}
    </TouchableOpacity>
  );
}

/**
 * shopper-walk-fixes (W15) — the picture her phone takes from a video she has just shared with the
 * brand (Going live path 2, Pay for Content): made on the phone, then cover-url → PUT → cover.
 *
 * It runs AFTER the video is uploaded and confirmed, so nothing here may undo that or put a red
 * line on her row: a phone that cannot make the picture, a refusal, a lost signal — each ends
 * quietly with `false`, and the video keeps its dark tile. It never throws. The picture's own
 * upload is given 30 seconds, not the video's 45 minutes: it is small, and her row waits for it.
 *
 *   api   the creator's calls (contentCoverUrl, contentConfirmCover)   put   uploadContentFile
 */
export async function sendCover12({ api, put, ciId, fileId, uri }) {
  try {
    const picture = await makeVideoPicture(uri, { maxBytes: COVER_MAX_12 });
    if (!picture) return false;
    const asked = await api.contentCoverUrl(ciId, fileId, picture.size);
    if (!asked || !asked.success) return false;
    await put(asked.data.upload, picture.uri, { timeoutMs: COVER_PUT_MS_12 });
    const done = await api.contentConfirmCover(ciId, fileId);
    return !!(done && done.success);
  } catch (_) {
    return false;
  }
}

export function AddTile12({ onPress, disabled, testID }) {
  return (
    <TouchableOpacity style={[t.tile, t.add, disabled && { opacity: 0.4 }]} onPress={onPress} disabled={!!disabled}
      accessibilityRole="button" accessibilityState={{ disabled: !!disabled }} testID={testID || 'add-tile'}>
      <Icon name="plus" size={22} color={T.ink2} />
      <Text style={t.addText}>{C12.add}</Text>
    </TouchableOpacity>
  );
}

/**
 * `text` (shopper-walk-fixes, frame C2) — the caller's own words in place of "n of m": Going live
 * says "1 file" / "No file yet" on a row she is filling. Green when met, grey when short, as ever.
 */
export function CountChip12({ have, need, text, testID }) {
  const met = have >= need;
  const c = met ? T.state.active : T.state.ended;
  return (
    <View style={[t.chip, { backgroundColor: c.bg }]} testID={testID || `count-${met ? 'met' : 'short'}`}>
      <Text style={[t.chipText, { color: c.fg }]}>{text != null ? text : C12.countOf(have, need)}</Text>
    </View>
  );
}

/** A deliverable row's header: its name and its count. */
export function RowHead12({ row, have, testID }) {
  return (
    <View style={t.rowHead} testID={testID || `row-${row.key}`}>
      <Text style={t.rowLabel}>{row.label}</Text>
      <CountChip12 have={have} need={row.count} testID={`count-${row.key}`} />
    </View>
  );
}

/** A note pinned to a file, in the amber family (C8). */
export function NoteLine12({ text, testID }) {
  if (!text) return null;
  const c = T.state.yourMove;
  return <Text style={[t.note, { color: c.fg, backgroundColor: c.bg }]} testID={testID || 'file-note'}>{text}</Text>;
}

/* ── the review ───────────────────────────────────────────────────────────── */

export function RoundPill12({ round, testID }) {
  if (!round) return null;
  const text = round.used ? C12.roundsUsedPill : round.isLast ? C12.roundPillLast(round.current, round.allowed) : C12.roundPill(round.current, round.allowed);
  return <View style={t.pill} testID={testID || 'round-pill'}><Text style={t.pillText}>{text}</Text></View>;
}

/** Their words, quoted, in the amber family (C8). */
export function QuoteBox12({ text, testID }) {
  if (!text) return null;
  const c = T.state.yourMove;
  return (
    <View style={[t.quote, { backgroundColor: c.bg, borderLeftColor: c.fg }]} testID={testID || 'quote'}>
      <Text style={[t.quoteText, { color: c.fg }]}>{`"${text}"`}</Text>
    </View>
  );
}

/** Earlier rounds, with what each asked for (C9, C14). */
export function History12({ rounds, testID }) {
  const asked = (rounds || []).filter((r) => r.verdict === 'changes');
  if (!asked.length) return null;
  return (
    <View style={t.history} testID={testID || 'round-history'}>
      {asked.map((r) => <Text key={r.no} style={t.historyLine} testID={`history-${r.no}`}>{C12.historyLine(r.no, r.verdictAt, r.reason)}</Text>)}
    </View>
  );
}

/* ── posting ──────────────────────────────────────────────────────────────── */

/** A link as the boards draw it: "instagram.com/reel/C8xK2…". */
export function shortLink12(url) {
  const shown = String(url || '').replace(/^https?:\/\/(www\.|m\.)?/, '').replace(/\/$/, '');
  return shown.length > 28 ? `${shown.slice(0, 26)}…` : shown;
}

/** A link that opens (C11): "instagram.com/reel/C8xK2…". */
export function LinkLine12({ url, testID }) {
  if (!url) return null;
  return (
    <TouchableOpacity onPress={() => Linking.openURL(url).catch(() => {})} accessibilityRole="link" testID={testID || 'proof-link'}>
      <Text style={t.link} numberOfLines={1}>{shortLink12(url)}</Text>
    </TouchableOpacity>
  );
}

/* ── the link she pastes (ui-walk-fixes board J) ──────────────────────────── */

/**
 * D5 — a link typed or pasted without "https://" in front gets it before it is sent. Nothing
 * else is touched: whether it is a link to the right place stays the server's call (its list of
 * hosts is not copied here), so anything that already names how it opens ("http://…") goes as is.
 */
export function withHttps12(raw) {
  const text = String(raw || '').trim();
  if (!text) return '';
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(text) ? text : `https://${text}`;
}

/** How long she has to stop typing before a link saves itself (frame J2: "about 0.7 s"). */
export const SAVE_PAUSE_12 = 700;

/** Answers that say nothing about the link itself — the same text may be sent again. */
const NO_VERDICT = ['NETWORK_ERROR', 'PARSE_ERROR', 'INTERNAL_ERROR', 'RATE_LIMITED', 'UNAUTHORIZED'];

/**
 * The screen's one line of saves (research C11, FIX FINAL 2).
 *
 * Every save on the screen, and every other call that answers with the whole content (`run`),
 * goes out one at a time and in the order it was asked for. So answers arrive in order, the one
 * applied last is always the newest, and a late answer can never blank a box saved after it.
 *
 *   change(key, text, cfg)  she typed or pasted. cfg = { server, send, clean, auto }:
 *                             server  what INFLX has for this box now ('' when nothing)
 *                             send    (value) => the call that saves it
 *                             clean   (text) => the value to send (the link box adds https://)
 *                             auto    saves by itself: at once on a paste (the text jumps in one
 *                                     change), otherwise SAVE_PAUSE_12 after she stops typing
 *   commit(key)             save it now — the keypad's Done key, leaving the box. Android reports
 *                           one leaving twice (end-editing, then blur) and a Done as all three:
 *                           while the save one of them started is on its way with the very text
 *                           the box still holds, the others send nothing more
 *   flush()                 save everything still only on her phone and wait for every answer;
 *                           resolves to { unsaved(key) } — true while INFLX does not have it
 *   run(call)               put any other call in the same line; resolves to its answer
 *   forget(key)             the box is gone (its row was taken out): her unsaved text, its red
 *                           line and everything remembered about it go, so nothing leaks into a
 *                           row that is later handed the same key. Call it INSIDE the `run` call
 *                           that takes the row out, so no save of that key can be on its way
 *   text / busy             key → her unsaved text / true while its save waits or is on its way
 *   errorOf(key)            the red line for that box, or null. It is held back while she is
 *                           still typing: an answer about text she has since changed says nothing
 *   refused(key)            true when INFLX itself refused what is in the box (not a lost signal)
 *
 * The box's text is let go only when the answer is about exactly what it still holds, the same
 * value is never sent twice running, and whatever is unsaved when she leaves the screen is sent.
 * "INFLX already has this" is believed only while the content on the screen and the last save
 * from that box agree; when the content changed by another road, her text is sent again.
 */
export function useSaves12({ onContent, failed }) {
  const [text, setText] = useState({});
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState({});
  const live = useRef(null);
  if (!live.current) {
    live.current = { text: {}, errors: {}, cfg: {}, timers: {}, queued: {}, waiting: {}, have: {}, refusal: {}, leaving: {}, chain: Promise.resolve(), ahead: 0, alive: true, onContent, failed, api: null };
  }
  const L = live.current;
  L.onContent = onContent;
  L.failed = failed;

  if (!L.api) {
    const put = (key, value) => {
      const next = { ...L.text };
      if (value == null) delete next[key]; else next[key] = value;
      L.text = next;
      if (L.alive) setText(next);
    };
    const say = (key, message, judged) => {
      const now = L.errors[key];
      if (!message && !now) return;
      if (message && now && now.message === message && now.judged === !!judged) return;
      const next = { ...L.errors };
      if (message) next[key] = { message, judged: !!judged }; else delete next[key];
      L.errors = next;
      if (L.alive) setErrors(next);
    };
    const mark = (key, by) => {
      const n = Math.max(0, (L.waiting[key] || 0) + by);
      L.waiting[key] = n;
      if (L.alive) setBusy((b) => (!!b[key] === n > 0 ? b : { ...b, [key]: n > 0 }));
    };
    const stopTimer = (key) => { if (L.timers[key]) { clearTimeout(L.timers[key]); delete L.timers[key]; } };

    /**
     * What INFLX has for this box — only when the phone can be sure of it. Two things say: the
     * content the screen is showing (cfg.server, read afresh every time she types) and the last
     * save INFLX accepted from this box (L.have). They part when the content changed by another
     * road — on Going live a row she takes out is deleted with its caption and the next row is
     * handed the SAME key — and for the instant between an answer and the screen drawing it.
     * When they part neither is believed (`undefined`), so her text is sent, never wiped.
     */
    const held = (key) => {
      const shown = (L.cfg[key] && L.cfg[key].server) || '';
      return key in L.have && L.have[key] !== shown ? undefined : shown;
    };
    /** What INFLX has already answered needs no call. True when there is nothing to send. */
    const settled = (key) => {
      const raw = L.text[key];
      const cfg = L.cfg[key];
      if (raw == null || !cfg) return true;
      const value = cfg.clean ? cfg.clean(raw) : raw;
      if (value === held(key)) { put(key, null); say(key, null); return true; }         // INFLX has exactly this
      const no = L.refusal[key];                // the same as the last one sent, against the same content
      if (no && no.value === value && no.shown === (cfg.server || '')) { say(key, no.message, true); return true; }
      return false;
    };
    const save = async (key, left) => {
      L.queued[key] = false;
      if (settled(key)) return;
      const raw = L.text[key];
      const cfg = L.cfg[key];
      const value = cfg.clean ? cfg.clean(raw) : raw;
      let r = null;
      // A save started by her leaving the box says so while it is on its way (see commit).
      if (left) L.leaving[key] = raw;
      try { r = await cfg.send(value); } catch (e) { r = null; }
      if (left && L.leaving[key] === raw) delete L.leaving[key];
      const same = L.text[key] === raw;                                                 // has she typed since it went?
      if (r && r.success) {
        L.have[key] = value;
        delete L.refusal[key];
        if (same) { put(key, null); say(key, null); }
        if (L.alive && r.data && r.data.content) L.onContent(r.data.content);
        return;
      }
      const message = (r && r.error && r.error.message) || L.failed;
      const judged = !!(r && r.error && r.error.code && !NO_VERDICT.includes(r.error.code));
      if (judged) L.refusal[key] = { value, message, shown: cfg.server || '' };
      if (same) say(key, message, judged);
    };
    /** The line itself: with nothing ahead of it the work starts now, otherwise when everything asked before it has answered. */
    const inTurn = (work) => {
      let answer;
      if (L.ahead === 0) {
        try { answer = Promise.resolve(work()); } catch (e) { answer = Promise.reject(e); }
      } else answer = L.chain.then(work);
      L.ahead += 1;
      const over = () => { L.ahead -= 1; };
      L.chain = answer.then(over, over);
      return answer;
    };
    const enqueue = (key, left) => {
      if (L.queued[key]) return;                // one already waiting reads her text when its turn comes
      if (!L.waiting[key] && settled(key)) return;   // nothing of this box is on its way: answer it here
      L.queued[key] = true;
      mark(key, 1);
      inTurn(() => save(key, left)).then(() => mark(key, -1), () => mark(key, -1));
    };

    L.api = {
      change(key, value, cfg) {
        L.cfg[key] = cfg;
        const server = cfg.server || '';
        const before = L.text[key] != null ? L.text[key] : server;
        put(key, value);
        say(key, null);                         // the red line waits while she is still typing
        stopTimer(key);
        if (!cfg.auto) return;
        if (value.length - before.length > 1) enqueue(key);
        else L.timers[key] = setTimeout(() => { delete L.timers[key]; enqueue(key); }, SAVE_PAUSE_12);
      },
      commit(key) {
        stopTimer(key);
        if (L.text[key] == null) return;
        // One leaving of the box reaches here two or three times on Android (Done, end-editing,
        // blur). The first has this very text on its way; queueing another behind it would send
        // the same link a second time whenever the first got no answer. Send it once.
        if (L.leaving[key] != null && L.leaving[key] === L.text[key]) return;
        enqueue(key, true);
      },
      async flush() {
        for (const key of Object.keys(L.text)) { stopTimer(key); enqueue(key); }
        let seen;
        do { seen = L.chain; await seen; } while (seen !== L.chain);       // eslint-disable-line no-await-in-loop
        const left = L.text; const wrong = L.errors;
        return { unsaved: (key) => left[key] != null || !!wrong[key] };
      },
      forget(key) {
        stopTimer(key);
        if (L.text[key] != null) put(key, null);
        say(key, null);
        delete L.cfg[key];
        delete L.have[key];
        delete L.refusal[key];
        delete L.leaving[key];
      },
      run: inTurn,
    };
  }

  // Leaving the screen: whatever is still only on her phone is sent; the answers are not waited for.
  useEffect(() => {
    L.alive = true;
    return () => {
      L.alive = false;
      L.api.flush();
    };
  }, [L]);

  return {
    ...L.api, text, busy,
    errorOf: (key) => (errors[key] ? errors[key].message : null),
    refused: (key) => !!(errors[key] && errors[key].judged),
  };
}

/**
 * The link box (J1–J7). One line: she pastes, it saves — no "Save" button anywhere. The box
 * shows the full link while she is in it and the short form once INFLX has it.
 *
 * The short form is only ever DRAWN — it is never the box's text. What the box holds is always
 * the real link (or what she has typed); while she is not in it, that text is made invisible and
 * the short form is laid over it. A keystroke that lands before the box has swapped back to the
 * full link therefore edits the real link, and can never save "instagram.com/reel/C8xK2ab…" —
 * dots and all — as the link.
 *
 *   saves   the screen's useSaves12()        id     this box's key in it
 *   url     the link INFLX has, or null      send   (value) => the call that saves ('' clears it)
 */
export function LinkBox12({ saves, id, url, send, placeholder, style, testID }) {
  const [inside, setInside] = useState(false);
  const mine = saves.text[id];
  const server = url || '';
  const error = saves.errorOf(id);
  const saving = !!saves.busy[id];
  const saved = !!server && mine == null && !saving && !error;
  // The short form is on show: she is not in the box and it holds exactly what INFLX has. (Never
  // beside "Saving…": the short form is laid over the whole box, the word sits at its right end.)
  const short = !inside && mine == null && !!server && !saving;
  const cfg = { server, send, clean: withHttps12, auto: true };
  return (
    <View style={style} testID={`${testID}-box`}>
      <View style={k.row}>
        <View style={[k.field, error ? k.fieldError : null]}>
          <TextInput style={[k.input, short ? k.inputUnder : null]} value={mine != null ? mine : server} placeholder={placeholder}
            placeholderTextColor={T.ink3} autoCapitalize="none" autoCorrect={false} keyboardType="url" returnKeyType="done"
            onFocus={() => setInside(true)} onChangeText={(v) => saves.change(id, v, cfg)}
            onSubmitEditing={() => saves.commit(id)} onEndEditing={() => saves.commit(id)}
            onBlur={() => { setInside(false); saves.commit(id); }} testID={testID} />
          {short ? (
            <View style={k.shortWrap} pointerEvents="none">
              {/* A screen reader reads the box itself (the whole link); this drawing of it is skipped. */}
              <Text style={k.short} numberOfLines={1} importantForAccessibility="no" testID={`${testID}-short`}>{shortLink12(server)}</Text>
            </View>
          ) : null}
          {saving ? <Text style={k.saving} testID={`${testID}-saving`}>{C12.saving}</Text> : null}
        </View>
        {saved ? <View testID={`${testID}-saved`}><Icon name="check" size={18} color={T.ink} /></View> : null}
      </View>
      <FieldError text={error} />
    </View>
  );
}

/* ── the record (C13) ─────────────────────────────────────────────────────── */

export function Record12({ c, testID }) {
  if (!c) return null;
  return (
    <View style={f.card} testID={testID || 'record-card'}>
      <Text style={f.title}>{C12.theRecord}</Text>
      <Row10 label={C12.rec.shoot} value={c.mode === 'visit' ? C12.steps.visited(day10(c.shootDoneAt)) : C12.steps.done(day10(c.shootDoneAt))} />
      <Row10 label={C12.rec.approved} value={c.approvedAt ? C12.rec.approvedValue(c.approvedAt, c.changesAsked) : null} />
      <Row10 label={C12.rec.posted} value={c.postedAt ? C12.rec.postedValue(c.postedAt, c.proofCount) : null} />
      <Row10 label={C12.rec.confirmed} value={c.liveConfirmedAt ? day10(c.liveConfirmedAt) : null} />
      <Row10 label={C12.rec.paid} value={c.completedAt ? day10(c.completedAt) : null} />
    </View>
  );
}

/** A plain grey sentence. */
export function Line12({ text, testID }) {
  if (!text) return null;
  return <Text style={t.line} testID={testID}>{text}</Text>;
}

const f = StyleSheet.create({
  card: { borderRadius: 14, borderWidth: 1, borderColor: T.border, padding: 14, marginBottom: 12, backgroundColor: '#FFFFFF' },
  title: { fontFamily: fonts.sansBold, fontSize: 14.5, color: T.ink, marginBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 7 },
  dot: { width: 14, height: 14, borderRadius: 7, marginRight: 12, alignItems: 'center', justifyContent: 'center' },
  dotPaid: { backgroundColor: T.state.active.fg },
  dotNext: { borderWidth: 2.5, borderColor: T.state.yourMove.fg, backgroundColor: '#FFFFFF' },
  dotLater: { borderWidth: 1.5, borderColor: T.border, backgroundColor: '#FFFFFF' },
  label: { fontFamily: fonts.sansSemiBold, fontSize: 13, color: T.ink },
  when: { fontFamily: fonts.sansRegular, fontSize: 12, color: T.ink3, marginTop: 1 },
  amount: { fontFamily: fonts.sansBold, fontSize: 14, color: T.ink },
  feeLine: { fontFamily: fonts.sansRegular, fontSize: 12, color: T.ink3, marginTop: 8, lineHeight: 17 },
});

export const t = StyleSheet.create({
  tile: { width: 76, height: 76, borderRadius: 12, backgroundColor: T.surface, borderWidth: 1, borderColor: T.border, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginRight: 8, marginBottom: 8 },
  tileVideo: { backgroundColor: T.ink, borderColor: T.ink },
  img: { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 },
  // A video's face: the dark tile, with the picture taken from it laid over when there is one.
  face: { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: T.ink },
  markDisc: { alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.45)' },
  badge: { position: 'absolute', right: 5, bottom: 5, borderRadius: 6, paddingHorizontal: 5, paddingVertical: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  badgeText: { fontFamily: fonts.sansBold, fontSize: 10, color: '#FFFFFF' },
  progress: { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, backgroundColor: 'rgba(255,255,255,0.85)', alignItems: 'center', justifyContent: 'center' },
  progressText: { fontFamily: fonts.sansBold, fontSize: 13, color: T.ink },
  noteDot: { position: 'absolute', left: 6, top: 6, width: 10, height: 10, borderRadius: 5, backgroundColor: T.state.yourMove.fg },
  add: { borderStyle: 'dashed', backgroundColor: '#FFFFFF' },
  addText: { fontFamily: fonts.sansBold, fontSize: 11, color: T.ink2, marginTop: 2 },
  chip: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
  chipText: { fontFamily: fonts.sansBold, fontSize: 11.5 },
  rowHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  rowLabel: { fontFamily: fonts.sansBold, fontSize: 14, color: T.ink },
  note: { fontFamily: fonts.sansSemiBold, fontSize: 12, lineHeight: 17, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5, marginBottom: 6 },
  pill: { alignSelf: 'flex-start', borderRadius: 6, backgroundColor: T.surface, borderWidth: 1, borderColor: T.border, paddingHorizontal: 8, paddingVertical: 3, marginBottom: 10 },
  pillText: { fontFamily: fonts.monoMedium || fonts.sansBold, fontSize: 10.5, color: T.ink2, letterSpacing: 0.6 },
  quote: { borderRadius: 10, borderLeftWidth: 3, padding: 12, marginBottom: 12 },
  quoteText: { fontFamily: fonts.sansSemiBold, fontSize: 13.5, lineHeight: 20 },
  history: { marginBottom: 12 },
  historyLine: { fontFamily: fonts.sansRegular, fontSize: 12, color: T.ink3, lineHeight: 18 },
  link: { fontFamily: fonts.sansSemiBold, fontSize: 13, color: T.state.waiting.fg, textDecorationLine: 'underline', paddingVertical: 4 },
  line: { fontFamily: fonts.sansRegular, fontSize: 13, color: T.ink2, lineHeight: 20, marginBottom: 12 },
});

/* The link box (board J): the box as the two screens drew it, with room at its right end. */
const k = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  field: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: T.border, borderRadius: 10, paddingHorizontal: 10 },
  fieldError: { borderColor: T.danger },
  input: { flex: 1, minWidth: 0, fontFamily: fonts.sansRegular, fontSize: 13.5, color: T.ink, paddingHorizontal: 0, paddingVertical: 9 },
  // Not in the box: the real link stays the box's text, unseen, under the short form drawn over it.
  inputUnder: { color: 'transparent' },
  shortWrap: { position: 'absolute', left: 10, right: 10, top: 0, bottom: 0, justifyContent: 'center' },
  short: { fontFamily: fonts.sansRegular, fontSize: 13.5, color: T.ink },
  saving: { fontFamily: fonts.sansSemiBold, fontSize: 11.5, color: T.ink3 },
});
