/**
 * Item 6 — the pieces the thread and the pool are built from: the round pill, the state box, a
 * change line (old struck → new bold), a turn card (mine grey, theirs outlined), the locked
 * "can't be changed" card, and a pool row.
 * Contract: features/item6-negotiation · mockups N2–N21 · prompt §8
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { settingsTokens as T, fonts } from '../../theme/tokens';
import { Avatar } from '../../screens/brand/BrandBlockedCreatorsScreen';
import { CheckboxRow } from '../discovery/bits';
import { Chip5 } from '../invitations/bits5';
import { C6, TERM_LABEL, aimLabel6, modeLabel6, longDate6, stampDate6, first } from './copy6';

/** "ROUND 1 OF 2", mono and uppercase on a grey surface. */
export function RoundPill6({ round, of, last, testID }) {
  return (
    <View style={b.pill} testID={testID || 'round-pill'}>
      <Text style={b.pillText}>{last ? C6.counter.roundLast(round, of) : C6.counter.round(round, of)}</Text>
    </View>
  );
}

/** The box at the top of a thread: waiting (blue), your move (amber), the last-round warning. */
export function StateBox6({ tone = 'wait', text, testID }) {
  const c = tone === 'move' ? T.state.yourMove : tone === 'active' ? T.state.active : tone === 'ended' ? T.state.ended : T.state.waiting;
  if (!text) return null;
  return (
    <View style={[b.state, { backgroundColor: c.bg }]} testID={testID || `state-${tone}`}>
      <Text style={[b.stateText, { color: c.fg }]}>{text}</Text>
    </View>
  );
}

/** "Commission  10% → 13%" — the old value struck through, the new one bold. */
export function ChangeLine6({ label, from, to, testID }) {
  return (
    <View style={b.change} testID={testID}>
      <Text style={b.changeLabel}>{label}</Text>
      <View style={b.changeVals}>
        {from != null && from !== to ? <Text style={b.from}>{from}</Text> : null}
        {from != null && from !== to ? <Text style={b.arrow}>→</Text> : null}
        <Text style={b.to}>{to}</Text>
      </View>
    </View>
  );
}

/** A plain value row inside a turn card (the original invitation shows values, not changes). */
export function ValueLine6({ label, value }) {
  return (
    <View style={b.change}>
      <Text style={b.changeLabel}>{label}</Text>
      <View style={b.changeVals}><Text style={b.to}>{value}</Text></View>
    </View>
  );
}

/**
 * One turn. `turn` is the server's shape: { by, mine, at, kind, changes[], terms, note,
 * declineReasonLabel, declineNote }. `who` is the heading line.
 */
export function TurnCard6({ turn, who, avatarName, avatarUrl, children, testID }) {
  return (
    <View style={[b.turn, turn.mine ? b.turnMine : b.turnTheirs]} testID={testID || `turn-${turn.id}`}>
      <View style={b.turnHead}>
        <Avatar name={avatarName || who} url={avatarUrl} size={26} />
        <Text style={b.turnWho} numberOfLines={1}>{who}</Text>
        <Text style={b.turnWhen}>{stampDate6(turn.at)}</Text>
      </View>
      {children || (turn.changes || []).map(ch => (
        <ChangeLine6 key={ch.term} label={TERM_LABEL[ch.term] || ch.term} from={ch.from} to={ch.to} testID={`change-${ch.term}`} />
      ))}
      {turn.kind === 'decline' && (turn.declineReasonLabel || turn.declineNote) ? (
        <Text style={b.declined}>{[turn.declineReasonLabel, turn.declineNote ? `“${turn.declineNote}”` : null].filter(Boolean).join(' · ')}</Text>
      ) : null}
      {turn.note ? <Text style={b.note}>“{turn.note}”</Text> : null}
    </View>
  );
}

/** The set's own terms, "Can't be changed" (N2's locked card). */
export function LockedTermsCard6({ set, scopeWords, testID }) {
  const rows = [
    [C6.counter.rows.aim, aimLabel6(set.goal)],
    [C6.counter.rows.posts, longDate6(set.postingDate)],
    [C6.counter.rows.mode, [modeLabel6(set.shootMode), set.cityName].filter(Boolean).join(' · ')],
    ...(scopeWords ? [[C6.counter.rows.sell, scopeWords]] : []),
  ];
  return (
    <View style={b.locked} testID={testID || 'locked-terms'}>
      <Text style={b.lockedTitle}>🔒 {C6.counter.locked}</Text>
      {rows.map(([k, v]) => (
        <View key={k} style={b.kv}><Text style={b.k}>{k}</Text><Text style={b.v}>{v}</Text></View>
      ))}
    </View>
  );
}

/** N14 — one creator in the pool, selectable when her Aim matches the selection. */
export function PoolRow6({ entry, checked, disabled, onToggle, onMore, testID }) {
  const meta = C6.pool.row(aimLabel6(entry.goal), entry.termsLine, entry.daysLeft);
  return (
    <CheckboxRow checked={checked} disabled={disabled} onPress={() => onToggle && onToggle(entry)} testID={testID || `pool-${entry.entryId}`}>
      <View style={b.poolRow}>
        <Avatar name={entry.creator.name} url={entry.creator.avatarUrl} size={36} />
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={b.poolName} numberOfLines={1}>{entry.creator.name}</Text>
          <Text style={b.poolMeta} numberOfLines={1}>{meta}</Text>
        </View>
        {entry.closingSoon ? <Chip5 label={C6.pool.closingSoon(entry.daysLeft)} tone="yourMove" testID={`closing-${entry.entryId}`} /> : null}
        {onMore ? <TouchableOpacity onPress={() => onMore(entry)} style={b.more} accessibilityLabel="More" testID={`pool-more-${entry.entryId}`}><Text style={b.moreText}>⋯</Text></TouchableOpacity> : null}
      </View>
    </CheckboxRow>
  );
}

/** N21 — the ending, an eyebrow and a sentence. */
export function EndingCard6({ ending, testID }) {
  if (!ending || !ending.text) return null;
  const eyebrow = ending.outcome === 'agreed' ? C6.endings.agreed
    : ending.outcome === 'declined_by_creator' ? C6.endings.declinedByCreator
      : ending.outcome === 'declined_by_brand' ? C6.endings.declinedByBrand
        : ending.outcome === 'moved' ? C6.endings.moved : C6.endings.expired;
  const tone = ending.outcome === 'agreed' ? T.state.active : ending.outcome === 'moved' ? T.state.waiting : T.state.ended;
  return (
    <View style={[b.ending, { backgroundColor: tone.bg }]} testID={testID || `ending-${ending.outcome}`}>
      <Text style={[b.endingEyebrow, { color: tone.fg }]}>{eyebrow}</Text>
      <Text style={[b.endingText, { color: tone.fg }]}>{ending.text}</Text>
    </View>
  );
}

export const b = StyleSheet.create({
  pill: { alignSelf: 'flex-start', backgroundColor: T.surface, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, marginBottom: 10 },
  pillText: { fontFamily: fonts.monoMedium, fontSize: 10.5, color: T.ink2, letterSpacing: 0.8 },
  state: { borderRadius: 12, padding: 11, marginBottom: 12 },
  stateText: { fontFamily: fonts.sansSemiBold, fontSize: 12.5, lineHeight: 17 },
  change: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 5, gap: 10 },
  changeLabel: { fontFamily: fonts.sansRegular, fontSize: 12.5, color: T.ink2, flexShrink: 1 },
  changeVals: { flexDirection: 'row', alignItems: 'center', flexShrink: 1 },
  from: { fontFamily: fonts.sansRegular, fontSize: 12.5, color: T.ink3, textDecorationLine: 'line-through' },
  arrow: { fontFamily: fonts.sansRegular, fontSize: 12.5, color: T.ink3, marginHorizontal: 5 },
  to: { fontFamily: fonts.sansBold, fontSize: 13, color: T.ink, flexShrink: 1, textAlign: 'right' },
  turn: { borderRadius: 14, padding: 12, marginBottom: 10 },
  turnMine: { backgroundColor: T.surface },
  turnTheirs: { borderWidth: 1, borderColor: T.border, backgroundColor: T.bg },
  turnHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  turnWho: { flex: 1, fontFamily: fonts.sansBold, fontSize: 13, color: T.ink, marginLeft: 8 },
  turnWhen: { fontFamily: fonts.sansRegular, fontSize: 11.5, color: T.ink3 },
  note: { fontFamily: fonts.sansRegular, fontSize: 12.5, color: T.ink2, fontStyle: 'italic', marginTop: 6, lineHeight: 17 },
  declined: { fontFamily: fonts.sansSemiBold, fontSize: 12.5, color: T.state.declined.fg, marginTop: 4 },
  locked: { backgroundColor: T.surface, borderRadius: 14, padding: 12, marginBottom: 14 },
  lockedTitle: { fontFamily: fonts.sansBold, fontSize: 12.5, color: T.ink2, marginBottom: 4 },
  kv: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, gap: 10 },
  k: { fontFamily: fonts.sansRegular, fontSize: 13, color: T.ink2 },
  v: { fontFamily: fonts.sansBold, fontSize: 13, color: T.ink, textAlign: 'right', flexShrink: 1 },
  poolRow: { flexDirection: 'row', alignItems: 'center' },
  poolName: { fontFamily: fonts.sansSemiBold, fontSize: 14.5, color: T.ink },
  poolMeta: { fontFamily: fonts.sansRegular, fontSize: 12, color: T.ink3, marginTop: 2 },
  more: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  moreText: { fontFamily: fonts.sansBold, fontSize: 18, color: T.ink2 },
  ending: { borderRadius: 12, padding: 12, marginBottom: 12 },
  endingEyebrow: { fontFamily: fonts.sansBold, fontSize: 10.5, letterSpacing: 0.7, marginBottom: 4 },
  endingText: { fontFamily: fonts.sansSemiBold, fontSize: 13, lineHeight: 18 },
});
