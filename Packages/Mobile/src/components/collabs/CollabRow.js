import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { ig, IG_TONE } from '../../theme/ig';
import { fmtRupees } from '../../theme/tokens';

/* One Collabs feed row (IG-clean). features/collabs-list.
   Presentation only — stage/turn are derived in utils/collabStages. */

const TERMINAL_LABEL = {
  declined: 'Declined', expired: 'Expired', rejected_by_brand: 'Not selected',
  slots_filled: 'Slots filled', cancelled: 'Cancelled', walked_away: 'Closed', closed: 'Closed',
};

function prettify(s) {
  return String(s || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export function badgeFor(c) {
  const s = String(c.status || '').toLowerCase();
  if (TERMINAL_LABEL[s]) return { label: TERMINAL_LABEL[s], tone: 'closed' };
  switch (c.stage) {
    case 'invites':     return { label: 'New invite', tone: 'you' };
    case 'applied':     return { label: 'Applied', tone: 'brand' };
    case 'negotiating': return c.turn === 'you' ? { label: 'Your turn', tone: 'nego' } : { label: 'Waiting', tone: 'brand' };
    case 'to_sign':     return { label: 'To sign', tone: 'you' };
    case 'active':      return { label: 'Active', tone: c.turn === 'you' ? 'you' : 'brand' };
    case 'tracking':    return { label: 'Tracking', tone: 'done' };
    case 'completed':   return { label: 'Completed', tone: 'done' };
    default:            return { label: prettify(c.status) || '—', tone: 'neutral' };
  }
}

function hintFor(c) {
  switch (c.stage) {
    case 'invites':     return { text: 'Tap to accept, negotiate or pass', go: 'View' };
    case 'applied':     return { text: 'Brand is choosing creators', wait: true };
    case 'negotiating': return c.turn === 'you' ? { text: 'Your move on the offer', go: 'Open' } : { text: 'Waiting for brand reply', wait: true };
    case 'to_sign':     return { text: 'Contract ready for you', go: 'Review & sign' };
    case 'active':      return c.turn === 'you' ? { text: 'Content to deliver', go: 'Open' } : { text: 'With brand for review', wait: true };
    case 'tracking':    return { text: 'Live — tracking performance', go: 'View' };
    case 'completed':   return { text: 'Completed', go: 'Earnings' };
    default:            return { text: c.declined_reason ? `Reason: ${prettify(c.declined_reason)}` : 'Archived', wait: true };
  }
}

function expiryLabel(iso) {
  if (!iso) return null;
  const hrs = Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 3600000));
  if (hrs <= 0) return null;
  return hrs < 24 ? `${hrs}h` : `${Math.ceil(hrs / 24)}d`;
}

export default function CollabRow({ collab, onPress }) {
  const badge = badgeFor(collab);
  const tone = IG_TONE[badge.tone] || IG_TONE.neutral;
  const hint = hintFor(collab);
  const actionable = collab.turn === 'you' && !hint.wait;

  const expires = collab.stage === 'invites' ? expiryLabel(collab.offer_expires_at) : null;
  const showDelivered = (collab.stage === 'active' || collab.stage === 'tracking') && collab.deliverable_count > 0;

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
          <Text style={styles.statL}>Fee</Text>
          <Text style={styles.statV}>{fmtRupees(collab.fee)}</Text>
        </View>
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
