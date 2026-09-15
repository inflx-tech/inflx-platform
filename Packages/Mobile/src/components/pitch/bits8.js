/**
 * Item 8 — the four pieces the pitch screens add, and nothing more.
 *
 *   PitchCard8      one pitch, on either side's list (T5, T13)
 *   CooldownBox8    a pause with a date on it — never a refusal (T8, T13, T14)
 *   ProvenanceTag8  "PITCH · Tanvi came to you on 9 Sep" (T11)
 *   MiniStat8       her three numbers, a dash where nothing is measured (T5, T6)
 *
 * Everything else these screens are built from already exists: the thread is
 * item 6's, the terms card is item 7's, the chips and the deliverables editor
 * are item 5's. Four new components is the whole of item 8's new furniture.
 * Contract: features/item8-pitch · mockups T1–T14
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { settingsTokens as T, fonts } from '../../theme/tokens';
import { Chip5 } from '../invitations/bits5';
import { C8, aimLabel8, modeLabel8, first } from './copy8';

/** The chip tone each of T13/T14's states wears. */
const GROUP_CHIP = {
  waiting: { label: C8.mine.chipSent, tone: 'waiting' },
  talking: { label: C8.mine.chipTalking, tone: 'yourMove' },
  agreed: { label: C8.mine.chipAgreed, tone: 'active' },
  rejected: { label: C8.mine.chipRejected, tone: 'declined' },
  withdrawn: { label: C8.mine.chipWithdrawn, tone: 'ended' },
  noReply: { label: C8.mine.chipClosed, tone: 'ended' },
  datePassed: { label: C8.mine.chipClosed, tone: 'ended' },
};

/**
 * Her three numbers, side by side. A number nobody has measured shows an em
 * dash — never a zero, which would read as "she has no audience" rather than
 * "we haven't looked yet" (item 3b's rule, kept here).
 */
export function MiniStat8({ numbers, testID }) {
  const n = numbers || {};
  const cell = (label, value, suffix) => (
    <View style={b.statCell} key={label}>
      <Text style={b.statValue} testID={`${testID || 'ministat'}-${label.toLowerCase()}`}>
        {value == null ? C8.brand.notMeasured : `${compact(value)}${suffix || ''}`}
      </Text>
      <Text style={b.statLabel}>{label}</Text>
    </View>
  );
  return (
    <View style={b.stat} testID={testID || 'ministat'}>
      {cell(C8.brand.instagram, n.instagramFollowers)}
      {cell(C8.brand.youtube, n.youtubeSubscribers)}
      {cell(C8.brand.engagement, n.engagement, '%')}
    </View>
  );
}

/**
 * One pitch on a list. `side` decides whose words it uses: the brand sees the
 * creator and her numbers (T5), she sees the brand and her deadline (T13).
 * Every sentence on it — the deadline line, the ending, the cooldown — comes
 * from the server already written, so the two never drift.
 */
export function PitchCard8({ card, side = 'creator', onPress, testID }) {
  if (!card) return null;
  const who = side === 'brand' ? card.creator : card.brand;
  const chip = side === 'brand'
    ? (card.negotiation && card.negotiation.open
      ? { label: card.negotiation.whoseMove === 'brand' ? C8.brand.yourMove : C8.brand.waiting, tone: card.negotiation.whoseMove === 'brand' ? 'yourMove' : 'waiting' }
      : { label: C8.brand.yourMove, tone: 'yourMove' })
    : (GROUP_CHIP[card.group] || GROUP_CHIP.waiting);

  return (
    <TouchableOpacity
      style={b.card}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={0.8}
      testID={testID || `pitch-card-${card.id}`}
    >
      <View style={b.top}>
        {side === 'brand' && card.unread ? <View style={b.dot} testID="pitch-unread" /> : null}
        <View style={b.who}>
          <Text style={b.name} numberOfLines={1}>{who ? who.name : ''}</Text>
          <Text style={b.sub} numberOfLines={1}>
            {side === 'brand'
              ? [who && who.niche, who && who.city, card.agedDays].filter(Boolean).join(' · ')
              : [card.aimLabel, card.termsLine].filter(Boolean).join(' · ')}
          </Text>
        </View>
        <Chip5 label={chip.label} tone={chip.tone} testID={`pitch-chip-${card.id}`} />
      </View>

      {side === 'brand' ? <MiniStat8 numbers={card.numbers} testID={`ministat-${card.id}`} /> : null}

      {side === 'brand' ? (
        <View style={b.tags}>
          {[card.aimLabel, card.termsLine, card.proposedGoLiveDate ? `Posts ${shortish(card.proposedGoLiveDate)}` : null, card.modeLabel]
            .filter(Boolean)
            .map((t) => <Text key={t} style={b.tag}>{t}</Text>)}
        </View>
      ) : null}

      {/* The one sentence this state has to say, whichever state it is. */}
      {card.line ? (
        <View style={[b.line, card.group === 'agreed' ? b.lineOk : null]} testID={`pitch-line-${card.id}`}>
          <Text style={[b.lineText, card.group === 'agreed' ? b.lineTextOk : null]}>{card.line}</Text>
        </View>
      ) : null}
      {side === 'brand' && card.replyBy ? (
        <View style={b.line}><Text style={b.lineText}>{card.replyBy}</Text></View>
      ) : null}
      {card.cooldownLine ? <CooldownBox8 text={card.cooldownLine} testID={`pitch-cooldown-${card.id}`} /> : null}
    </TouchableOpacity>
  );
}

/**
 * A pause with a date on it. Deliberately not the refusal red: a cooldown ends,
 * and the sentence inside always says when.
 */
export function CooldownBox8({ text, testID }) {
  if (!text) return null;
  return (
    <View style={b.cool} testID={testID || 'cooldown-box'}>
      <Text style={b.coolText}>{text}</Text>
    </View>
  );
}

/**
 * T11 — why this creator is in the pool. A move request and a pitch sit in the
 * same list, and the brand should be able to tell at a glance which one came
 * knocking.
 */
export function ProvenanceTag8({ entry, testID }) {
  if (!entry || !entry.fromPitchId) return null;
  return (
    <View style={b.prov} testID={testID || `pool-provenance-${entry.id}`}>
      <Text style={b.provTag}>{C8.pool.tag}</Text>
      <Text style={b.provText} numberOfLines={1}>
        {C8.pool.cameToYou(entry.creatorName || entry.name, entry.agreedAt || entry.createdAt)}
      </Text>
    </View>
  );
}

/** 48200 → "48.2K". Whole numbers under a thousand stay as they are. */
function compact(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return C8.brand.notMeasured;
  if (v >= 10000000) return `${trim(v / 10000000)}Cr`;
  if (v >= 100000) return `${trim(v / 100000)}L`;
  if (v >= 1000) return `${trim(v / 1000)}K`;
  return `${trim(v)}`;
}
const trim = (x) => String(Math.round(x * 10) / 10);
/** '2026-10-28' → '28 Oct'. */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function shortish(day) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(day || ''));
  return m ? `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]}` : String(day || '');
}

export const b = StyleSheet.create({
  card: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: T.border, borderRadius: 12, padding: 12, gap: 9, marginBottom: 9 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: T.state.yourMove.fg },
  who: { flex: 1, minWidth: 0 },
  name: { fontFamily: fonts.sansSemiBold, fontSize: 14, color: T.ink },
  sub: { fontFamily: fonts.sansRegular, fontSize: 11, color: T.ink3, marginTop: 2 },

  stat: { flexDirection: 'row', backgroundColor: T.surface, borderRadius: 9, paddingVertical: 8 },
  statCell: { flex: 1, alignItems: 'center' },
  statValue: { fontFamily: fonts.sansSemiBold, fontSize: 14, color: T.ink },
  statLabel: { fontFamily: fonts.sansRegular, fontSize: 10, color: T.ink3, marginTop: 1 },

  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: { fontFamily: fonts.sansMedium, fontSize: 11, color: T.ink2, backgroundColor: T.surface, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },

  line: { backgroundColor: T.surface, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 },
  lineOk: { backgroundColor: T.state.active.bg },
  lineText: { fontFamily: fonts.sansRegular, fontSize: 12, color: T.ink2, lineHeight: 17 },
  lineTextOk: { color: T.state.active.fg },

  cool: { backgroundColor: T.state.waiting.bg, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 },
  coolText: { fontFamily: fonts.sansRegular, fontSize: 12, color: T.state.waiting.fg, lineHeight: 17 },

  prov: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  provTag: { fontFamily: fonts.sansSemiBold, fontSize: 9, letterSpacing: 0.7, color: T.ink2, backgroundColor: T.surface, borderRadius: 5, paddingHorizontal: 6, paddingVertical: 3 },
  provText: { fontFamily: fonts.sansRegular, fontSize: 11, color: T.ink3, flex: 1 },
});
