import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { ig } from '../../theme/ig';
import { shortDateTime } from '../../utils/shoot';

/**
 * ShootDiary — what happened here, oldest first.
 * Contract: features/stage-4-the-shoot (slice 7) · M-8 · board panel ③ "See what happened here"
 *
 * THE ONE THING THE SHOOT ALREADY DID BETTER THAN ANY OTHER STEP
 * `production_event_log` has recorded every action since long before this stage — proposals,
 * counters, flips, dispatches, receipts. It is the only step in the entire six-step spine that
 * keeps a diary. And `getLog` existed with **nothing calling it**, so none of it was ever
 * visible to either party.
 *
 * IDENTICAL ON BOTH SIDES, DELIBERATELY (M-8)
 * One component, one vocabulary, rendered from the same rows. If a brand and a creator argue
 * about what was agreed and when, they must be arguing over one record — not two renderings
 * that each side believes. That is why the labels live here and not in either screen.
 *
 * IT WILL LOOK NEARLY EMPTY AT FIRST, AND THAT IS HONEST
 * The practice world was seeded straight into its end state rather than driven through the
 * endpoints, so existing shoots have no history to show. Only actions taken from now on
 * appear. Inventing a plausible backstory for them would be worse than a short list.
 */

/** Every action the server writes. Read from production.service, not remembered. */
const ACTION_LABEL = {
  mode_set: 'Shoot set up',
  proposed: 'Waiting on details',
  visit_details_set: 'Visit details filled in',
  slot_proposed: 'A time was suggested',
  counter_proposed: 'Another time was suggested',
  rescheduled_by_brand: 'The brand moved the date',
  accepted: 'The time was accepted',
  remote_flip_requested: 'Asked to do it remotely',
  remote_flip_confirmed: 'Agreed to do it remotely',
  dispatched: 'The parcel went out',
  received: 'The parcel arrived',
  completed: 'The shoot was marked done',
  cancelled: 'The shoot was cancelled',
  // stage-4 additions
  parcel_packed: 'Products were put in the box',
  parcel_item_removed: 'An item was taken back out',
  receipt_recorded: 'She answered item by item',
  item_dropped: 'An item was dropped',
};

const WHO = { brand: 'Brand', influencer: 'Creator', admin: 'Our team', system: 'Automatic' };

export default function ShootDiary({ log, collapsedCount = 3 }) {
  const [open, setOpen] = useState(false);
  const rows = Array.isArray(log) ? log : [];

  if (rows.length === 0) {
    return (
      <View style={s.wrap}>
        <Text style={s.title}>What happened here</Text>
        <Text style={s.empty}>
          Nothing recorded yet. Every step from here — a time suggested, a parcel sent, an item
          flagged — is written down and shown to both of you.
        </Text>
      </View>
    );
  }

  const shown = open ? rows : rows.slice(-collapsedCount);

  return (
    <View style={s.wrap}>
      <Text style={s.title}>What happened here</Text>

      {!open && rows.length > collapsedCount && (
        <TouchableOpacity onPress={() => setOpen(true)} activeOpacity={0.75} style={s.more}>
          <Icon name="chevron-up" size={13} color={ig.mut} />
          <Text style={s.moreT}>
            {rows.length - collapsedCount} earlier {rows.length - collapsedCount === 1 ? 'entry' : 'entries'}
          </Text>
        </TouchableOpacity>
      )}

      {shown.map((r, i) => (
        <View key={r.id || i} style={s.row}>
          <View style={s.dot} />
          <View style={{ flex: 1 }}>
            <Text style={s.what}>{ACTION_LABEL[r.action] || r.action}</Text>
            <Text style={s.when}>
              {[WHO[r.actor_role] || r.actor_role, shortDateTime(r.created_at)].filter(Boolean).join(' · ')}
            </Text>
            {/* The note is whatever a person actually typed. Shown as written, never summarised. */}
            {!!r.notes && <Text style={s.note}>{r.notes}</Text>}
          </View>
        </View>
      ))}
    </View>
  );
}

export { ACTION_LABEL };

const s = StyleSheet.create({
  wrap: { borderWidth: 1, borderColor: ig.lineSoft, borderRadius: 12, padding: 13, marginTop: 4, marginBottom: 10 },
  title: { fontSize: 12.5, fontWeight: '800', color: ig.text, marginBottom: 8 },
  empty: { fontSize: 11.5, fontWeight: '650', color: ig.mut, lineHeight: 17 },
  more: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingBottom: 8 },
  moreT: { fontSize: 11, fontWeight: '700', color: ig.mut },
  row: { flexDirection: 'row', gap: 9, paddingVertical: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: ig.lineSoft, marginTop: 6 },
  what: { fontSize: 12, fontWeight: '800', color: ig.text },
  when: { fontSize: 10, fontWeight: '700', color: ig.mut, marginTop: 2, letterSpacing: 0.3 },
  note: { fontSize: 11, fontWeight: '650', color: ig.mut, marginTop: 3, lineHeight: 16 },
});
