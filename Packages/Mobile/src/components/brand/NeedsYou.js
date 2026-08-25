import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { ig } from '../../theme/ig';

/**
 * NeedsYou.js — the pieces every rung of the ladder shows, written once.
 * Contract: features/stage-3-watch-the-work-happen (slices 3–4)
 * Board: 04-preview/mockups/stage3-screens.html panels ② ③ ④ ⑤
 *
 * Four levels show the same three things — a count, what that count is made of, and where a
 * collaboration has got to. Written separately on each screen they would drift, and this is
 * the one place where drift is the actual failure: FINAL 4's rule is that a badge equals
 * exactly what is underneath it, so two screens disagreeing about a number breaks the whole
 * idea. One component, four callers.
 */

/**
 * The six steps, in the words both apps use. These come from collabStep.service on the
 * server, which is where the NUMBER is decided — this is only how it is spelled.
 * The creator's app shows the same six; when a brand rings her and says "we're stuck on
 * step 3", both phones got that 3 from the same place.
 */
export const STEP_LABELS = {
  1: 'Terms agreed',
  2: 'Signing',
  3: 'The shoot',
  4: 'Shop posts',
  5: 'Going live',
  6: 'Complete',
};

/** The same six, from the creator's side. Same numbers, her wording. */
export const STEP_LABELS_CREATOR = {
  1: 'Terms agreed',
  2: 'Sign the contract',
  3: 'The shoot',
  4: 'Your shop posts',
  5: 'Go live on Instagram',
  6: 'Complete',
};

/**
 * Whose move it is, said in words rather than a colour. 'nobody' is a real answer and not a
 * gap — a shoot with no slot proposed is genuinely nobody's turn yet, and saying so beats
 * an empty space that reads as missing data.
 */
export function turnLabel(turn, { asBrand = true } = {}) {
  if (turn === 'brand')   return asBrand ? 'YOUR TURN' : 'WAITING ON THEM';
  if (turn === 'creator') return asBrand ? 'WAITING ON HER' : 'YOUR TURN';
  return 'NOBODY’S TURN YET';
}

export function turnTone(turn, { asBrand = true } = {}) {
  const mine = asBrand ? 'brand' : 'creator';
  if (turn === mine) return { fg: ig.yInk, dot: ig.y };
  if (turn === 'nobody' || !turn) return { fg: ig.mut, dot: ig.mut2 };
  return { fg: ig.blue, dot: ig.blue };
}

/** The count pill. Renders nothing at 0 — an absence reads as calm, a zero as a state. */
export function NeedBadge({ n, style }) {
  const v = Number(n || 0);
  if (v <= 0) return null;
  return (
    <View style={[s.badge, style]}>
      <Text style={s.badgeTxt}>{v}</Text>
    </View>
  );
}

/**
 * The six mini-bars. Green behind, black on the current step, hollow ahead — how far along
 * without opening it. `step` is 1..6 from the server.
 */
export function StepBars({ step, label = true, tone }) {
  const cur = Number(step || 0);
  return (
    <View style={s.bars}>
      {[1, 2, 3, 4, 5, 6].map(i => (
        <View
          key={i}
          style={[
            s.bar,
            i < cur && s.barDone,
            i === cur && (tone ? { backgroundColor: tone } : s.barNow),
          ]}
        />
      ))}
      {label && cur > 0 && <Text style={s.barsLbl}>STEP {cur} OF 6</Text>}
    </View>
  );
}

/**
 * What is owed AT THIS LEVEL — the part of a badge that belongs to no creator.
 *
 * It sits ABOVE the children on every screen, deliberately. If a campaign shows 3 and its
 * sets show 1 and 1, the missing 1 is the campaign's own and must be findable here rather
 * than left as a number that does not add up. Numbers that do not reconcile are how people
 * stop believing badges.
 *
 * Renders nothing when there is nothing owed — never an empty heading, which reads as a
 * loading failure.
 */
export function OwedItems({ items, title = 'Needs you here', onPressItem }) {
  const list = Array.isArray(items) ? items : [];
  if (!list.length) return null;

  return (
    <View style={s.owed}>
      <View style={s.owedHd}>
        <Text style={s.owedT}>{title}</Text>
        <Text style={s.owedN}>{list.length}</Text>
      </View>
      {list.map((it, i) => {
        const body = (
          <View style={s.item} key={it.code + i}>
            <Icon name={ICONS[it.code] || 'alert-circle-outline'} size={16} color={ig.red} />
            <Text style={s.itemTxt}>{it.message}</Text>
            {!!onPressItem && <Icon name="chevron-right" size={16} color={ig.mut2} />}
          </View>
        );
        return onPressItem
          ? <TouchableOpacity key={it.code + i} activeOpacity={0.7} onPress={() => onPressItem(it)}>{body}</TouchableOpacity>
          : body;
      })}
    </View>
  );
}

const ICONS = {
  NO_ALLOCATION:   'basket-off-outline',
  NOTHING_TO_BUY:  'store-off-outline',
  EMPTY_SET:       'account-off-outline',
  OFFER_EXPIRING:  'tag-off-outline',
  WALLET_SHORT:    'wallet-outline',
  NEVER_PUBLISHED: 'send-outline',
  QUIET_SALES:     'chart-line-variant',
};

/**
 * Said once, on every screen that could show a stale number. A badge of 0 must mean
 * "nothing is owed", never "we could not ask" — a brand told zero stops looking.
 */
export function StaleNote({ failed }) {
  if (!failed) return null;
  return (
    <View style={s.stale}>
      <Icon name="cloud-off-outline" size={14} color={ig.mut} />
      <Text style={s.staleTxt}>
        These numbers are the last we could fetch. Pull down to try again.
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  badge: { backgroundColor: ig.text, borderRadius: 100, minWidth: 20, paddingHorizontal: 6, paddingVertical: 2, alignItems: 'center' },
  badgeTxt: { fontSize: 10.5, fontWeight: '800', color: ig.bg },

  bars: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 6 },
  bar: { width: 15, height: 5, borderRadius: 3, backgroundColor: ig.lineSoft },
  barDone: { backgroundColor: ig.green },
  barNow: { backgroundColor: ig.text },
  barsLbl: { fontSize: 9, fontWeight: '800', color: ig.mut, marginLeft: 4, letterSpacing: 0.2 },

  owed: { marginHorizontal: 14, marginTop: 12, borderWidth: 1, borderColor: '#F0C4BA', backgroundColor: ig.redBg, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  owedHd: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  owedT: { fontSize: 9.5, fontWeight: '800', letterSpacing: 0.5, color: ig.red, textTransform: 'uppercase' },
  owedN: { fontSize: 11, fontWeight: '800', color: ig.red },
  item: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingVertical: 5 },
  itemTxt: { flex: 1, fontSize: 11.5, fontWeight: '700', color: ig.red, lineHeight: 16 },

  stale: { flexDirection: 'row', alignItems: 'center', gap: 7, marginHorizontal: 14, marginTop: 10, paddingHorizontal: 11, paddingVertical: 8, backgroundColor: ig.bgSoft, borderRadius: 9 },
  staleTxt: { flex: 1, fontSize: 10.5, fontWeight: '700', color: ig.mut, lineHeight: 15 },
});
