/**
 * Item 12 — the pieces the content screens are built from.
 * Contract: features/item12-content · mockups C1–C16 · prompt §8
 *
 *   FeeCard12   her fee and its three payments: a filled dot for paid, an amber ring for next,
 *               an empty ring for later — the step line's vocabulary (prompt §8). Her fee alone
 *               (Q1); the campaign fee is its own line, on the brand's card only.
 *   FileTile12  square-ish, rounded; a photo shows itself, a video shows a play mark and its
 *               duration badge; an upload in flight shows its percentage.
 *   CountChip12 "n of m" — grey while short, green when met.
 *   RoundPill12 "ROUND 1 OF 2", "· LAST", "ROUNDS USED" (Q8), item 6's pill look.
 *   QuoteBox12, History12, LinkLine12, Record12, Line12.
 *
 * No native module: images are core <Image>, links and videos open with Linking (item 11's way).
 */
import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { settingsTokens as T, fonts } from '../../theme/tokens';
import { Row10 } from '../shoot/bits10';
import { C12, rupees5, duration12, day10 } from './copy12';

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

export function FileTile12({ file, url, progress, note, onPress, testID }) {
  const video = file ? file.kind === 'video' : false;
  const uploading = progress != null;
  return (
    <TouchableOpacity style={[t.tile, video && t.tileVideo]} onPress={onPress} disabled={!onPress || uploading}
      activeOpacity={0.8} accessibilityRole="button" testID={testID || (file ? `file-${file.id}` : 'file-uploading')}>
      {!video && url ? <Image source={{ uri: url }} style={t.img} resizeMode="cover" /> : null}
      {video ? <Icon name="play" size={22} color="#FFFFFF" /> : null}
      {!video && !url && !uploading ? <Icon name="image-outline" size={20} color={T.ink3} /> : null}
      {video && file.durationS != null ? (
        <View style={t.badge} testID="duration-badge"><Text style={t.badgeText}>{duration12(file.durationS)}</Text></View>
      ) : null}
      {uploading ? (
        <View style={t.progress} testID="upload-progress"><Text style={t.progressText}>{C12.uploading(progress)}</Text></View>
      ) : null}
      {note ? <View style={t.noteDot} testID="note-dot" /> : null}
    </TouchableOpacity>
  );
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

export function CountChip12({ have, need, testID }) {
  const met = have >= need;
  const c = met ? T.state.active : T.state.ended;
  return (
    <View style={[t.chip, { backgroundColor: c.bg }]} testID={testID || `count-${met ? 'met' : 'short'}`}>
      <Text style={[t.chipText, { color: c.fg }]}>{C12.countOf(have, need)}</Text>
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

/** A link that opens (C11): "instagram.com/reel/C8xK2…". */
export function LinkLine12({ url, testID }) {
  if (!url) return null;
  const shown = String(url).replace(/^https?:\/\/(www\.|m\.)?/, '').replace(/\/$/, '');
  return (
    <TouchableOpacity onPress={() => Linking.openURL(url).catch(() => {})} accessibilityRole="link" testID={testID || 'proof-link'}>
      <Text style={t.link} numberOfLines={1}>{shown.length > 28 ? `${shown.slice(0, 26)}…` : shown}</Text>
    </TouchableOpacity>
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
