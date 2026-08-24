import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { ig, IG_TONE } from '../../theme/ig';
import { fmtRupees } from '../../theme/tokens';
// One description of what a collaboration pays, shared with the detail screen so the list
// and the page it opens can never disagree. Contract: features/collab-terms-by-aim
import { describePay } from '../../utils/collabPay';

/* One Collabs feed row (IG-clean). features/collabs-list.
   Presentation only — stage/turn are derived in utils/collabStages. */

const TERMINAL_LABEL = {
  declined: 'Declined', expired: 'Expired', rejected_by_brand: 'Not selected',
  slots_filled: 'Slots filled', cancelled: 'Cancelled', walked_away: 'Closed', closed: 'Closed',
};

function prettify(s) {
  return String(s || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * Stage 1 rebuilt the stages as invitations · pitches · to_sign · shoot · content · done.
 * This switch was never updated, so EVERY row fell through to the default and read
 * "Archived" — including an invitation nobody had answered yet. Three more things broke
 * silently with it: the hint, the expiry countdown and the delivered count, all of which
 * tested a stage name that no longer exists.
 * Contract: features/collab-terms-by-aim
 */
export function badgeFor(c) {
  const s = String(c.status || '').toLowerCase();
  if (TERMINAL_LABEL[s]) return { label: TERMINAL_LABEL[s], tone: 'closed' };
  const settled = s === 'agreed' || s === 'accepted';

  switch (c.stage) {
    case 'invitations':
      if (settled) return { label: 'Agreed', tone: 'done' };
      return c.turn === 'you' ? { label: 'Your turn', tone: 'you' }
           : c.turn === 'brand' ? { label: 'Waiting on them', tone: 'brand' }
           : { label: prettify(s) || 'Invitation', tone: 'neutral' };
    case 'pitches':
      if (settled) return { label: 'Accepted', tone: 'done' };
      return c.turn === 'you' ? { label: 'Your turn', tone: 'you' }
           : { label: 'Sent', tone: 'brand' };
    case 'to_sign':  return { label: 'To sign', tone: 'you' };
    case 'shoot':    return { label: 'Shoot', tone: c.turn === 'you' ? 'you' : 'brand' };
    case 'content':  return c.turn === 'you' ? { label: 'Your turn', tone: 'you' }
                                             : { label: 'With brand', tone: 'brand' };
    case 'done':     return { label: 'Done', tone: 'done' };
    default:         return { label: prettify(s) || '—', tone: 'neutral' };
  }
}

/** What she should do about it — the line that decides whether she opens the row. */
function hintFor(c) {
  const s = String(c.status || '').toLowerCase();
  if (TERMINAL_LABEL[s]) {
    return { text: c.declined_reason ? `Reason: ${prettify(c.declined_reason)}` : TERMINAL_LABEL[s], wait: true };
  }
  const settled = s === 'agreed' || s === 'accepted';

  switch (c.stage) {
    case 'invitations':
      if (settled) return { text: 'Terms agreed — waiting for the campaign', wait: true };
      return c.turn === 'you' ? { text: 'Tap to accept, counter or pass', go: 'Open' }
           : { text: 'Waiting for the brand to reply', wait: true };
    case 'pitches':
      if (settled) return { text: 'They accepted — waiting for the campaign', wait: true };
      return c.turn === 'you' ? { text: 'They countered — your move', go: 'Open' }
           : { text: 'Waiting for the brand to decide', wait: true };
    case 'to_sign':  return { text: 'Contract ready for you', go: 'Review & sign' };
    case 'shoot':    return { text: 'Arrange the shoot', go: 'Open' };
    case 'content':  return c.turn === 'you' ? { text: 'Content to deliver', go: 'Open' }
                                             : { text: 'With the brand for review', wait: true };
    case 'done':     return { text: 'Finished', wait: true };
    default:         return { text: prettify(s) || '—', wait: true };
  }
}

/** "15 Sep" — a date she can read, not an ISO string. */
function fmtDay(v) {
  const d = new Date(String(v).slice(0, 10));
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function expiryLabel(iso) {
  if (!iso) return null;
  const hrs = Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 3600000));
  if (hrs <= 0) return null;
  return hrs < 24 ? `${hrs}h` : `${Math.ceil(hrs / 24)}d`;
}

export default function CollabRow({ collab, onPress }) {
  const pay = describePay(collab);
  const badge = badgeFor(collab);
  const tone = IG_TONE[badge.tone] || IG_TONE.neutral;
  const hint = hintFor(collab);
  const actionable = collab.turn === 'you' && !hint.wait;

  // The date she is actually committing to. It sits in the settled terms and was never
  // surfaced on the list, so the deadline only appeared once she opened the row.
  const rawPostBy = collab.raw?.counter_terms_json?.time?.post_by
    || collab.raw?.terms_json?.time?.post_by
    || collab.raw?.counter_terms?.time?.post_by
    || collab.posting_date
    || null;
  const postBy = rawPostBy ? fmtDay(rawPostBy) : null;

  const openStage = collab.stage === 'invitations' || collab.stage === 'pitches';
  const expires = openStage ? expiryLabel(collab.offer_expires_at || collab.expires_at) : null;
  const showDelivered = (collab.stage === 'content' || collab.stage === 'shoot' || collab.stage === 'done')
    && collab.deliverable_count > 0;

  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.65}>
      {actionable && <View style={styles.rail} />}
      <View style={styles.head}>
        <View style={styles.headL}>
          <Text style={styles.brand} numberOfLines={1}>{collab.brand_name}</Text>
          <Text style={styles.camp} numberOfLines={1}>{collab.campaign_name}</Text>
        </View>
        <View style={styles.badge}>
          <View style={[styles.dot, { backgroundColor: tone.dot }]} />
          <Text style={[styles.badgeTxt, { color: tone.fg }]}>{badge.label}</Text>
        </View>
      </View>

      <View style={styles.stats}>
        <View style={styles.stat}>
          <Text style={styles.statL}>{pay.label}</Text>
          <Text style={styles.statV}>{pay.value}</Text>
        </View>
        {postBy && (
          <View style={styles.stat}>
            <Text style={styles.statL}>Post by</Text>
            <Text style={styles.statV}>{postBy}</Text>
          </View>
        )}
        {expires != null && (
          <View style={styles.stat}>
            <Text style={styles.statL}>Expires</Text>
            <Text style={[styles.statV, { color: ig.red }]}>{expires}</Text>
          </View>
        )}
        {showDelivered && (
          <View style={styles.stat}>
            <Text style={styles.statL}>Delivered</Text>
            <Text style={styles.statV}>{collab.approved_count}/{collab.deliverable_count}</Text>
          </View>
        )}
      </View>

      <View style={styles.foot}>
        <Text style={[styles.hint, hint.wait && styles.hintWait]} numberOfLines={1}>{hint.text}</Text>
        {hint.go ? <Text style={styles.go}>{hint.go} ›</Text> : null}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: { paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: ig.lineSoft, backgroundColor: ig.bg },
  rail: { position: 'absolute', left: 0, top: 14, bottom: 14, width: 3, backgroundColor: ig.y, borderRadius: 2 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 },
  headL: { flex: 1, minWidth: 0 },
  brand: { fontSize: 15, fontWeight: '700', color: ig.text },
  camp: { fontSize: 11.5, color: ig.mut, marginTop: 2 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  badgeTxt: { fontSize: 11, fontWeight: '700' },
  stats: { flexDirection: 'row', gap: 22, marginTop: 11 },
  stat: {},
  statL: { fontSize: 9.5, fontWeight: '600', letterSpacing: 0.3, textTransform: 'uppercase', color: ig.mut },
  statV: { fontSize: 14, fontWeight: '700', color: ig.text, marginTop: 2 },
  foot: { flexDirection: 'row', alignItems: 'center', marginTop: 11 },
  hint: { flex: 1, fontSize: 12, color: ig.text2, fontWeight: '500' },
  hintWait: { color: ig.mut },
  go: { fontSize: 12, fontWeight: '700', color: ig.text, marginLeft: 8 },
});
