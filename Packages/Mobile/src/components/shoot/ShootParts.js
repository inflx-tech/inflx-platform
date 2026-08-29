import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Linking } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { ig } from '../../theme/ig';
import { shortDate, shortDateTime, windowReason, RECEIPT_LABEL } from '../../utils/shoot';

/**
 * ShootParts — the pieces both phones draw for a shoot.
 * Contract: features/stage-4-the-shoot (slice 3) · boards ③ ④ ⑤ ⑥
 *
 * Two apps render the same event. Anything shared lives here so a brand and a creator on the
 * phone cannot be shown two different accounts of one shoot — the fault that cost Stage 1 four
 * of its twenty-one bugs and Stage 3 a whole competing spine.
 */

// ─── The window ─────────────────────────────────────────────────────────────

/**
 * The legal date range, and WHY it is that range.
 *
 * The reason is the point. `getVisitDateRange` works back from the campaign's own dates, so
 * "you may pick any day up to 28 Aug" is a rule neither party set. The board names this the
 * likeliest wording failure in the stage: a window that looks arbitrary gets argued with.
 * `basis` comes from the server; the screen never does the arithmetic itself.
 */
export function WindowCard({ range }) {
  if (!range) return null;

  // ⚠️ THE WINDOW CAN BE EMPTY, AND IT IS ON REAL DATA. If the post is due in two days, a
  // visit that must finish two days before it has nowhere to go. Drawing "pick any day
  // between [blank] and [blank]" tells nobody that, and the fix is a human moving the posting
  // date. Contract: features/shoot-plan-you-can-actually-see
  if (range.impossible) {
    return (
      <View style={[s.card, s.cardBad]}>
        <Text style={s.labelBad}>No day works</Text>
        <Text style={s.why}>{range.reason}</Text>
      </View>
    );
  }

  const from = shortDate(range.earliest);
  const to   = shortDate(range.latest);
  // A date that will not parse is not a date. Better to say nothing than to draw an empty gap
  // between the word 'and' — which is exactly how the unwrapping bug looked on screen.
  if (!from || !to) return null;

  const why = windowReason(range);
  return (
    <View style={s.card}>
      <Text style={s.label}>Pick any day between</Text>
      <Text style={s.range}>
        {from}  <Text style={s.rangeDash}>and</Text>  {to}
      </Text>
      {!!why && <Text style={s.why}>{why}</Text>}
    </View>
  );
}

/** A proposed or countered slot, with who suggested it. */
export function SlotCard({ event, theirs, expectedTime }) {
  const at = event?.proposed_at || event?.visit_scheduled_at;
  if (!at) return null;
  return (
    <View style={s.card}>
      <Text style={s.label}>{theirs ? 'Their suggestion' : 'You suggested'}</Text>
      <Text style={s.slot}>{shortDate(at)}</Text>
      {!!expectedTime && (
        <>
          <Text style={[s.label, { marginTop: 10 }]}>Expected time</Text>
          <Text style={s.slotSub}>{expectedTime}</Text>
          {/* Stage 1 settled this: the store needs a guide, she is not on a clock. */}
          <Text style={s.why}>A guide for the store, not a deadline for you.</Text>
        </>
      )}
    </View>
  );
}

// ─── The place ──────────────────────────────────────────────────────────────

export function AddressCard({ name, address, contact, phone }) {
  if (!address) return null;
  const maps = () =>
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`)
      .catch(() => {});
  return (
    <View style={s.card}>
      {!!name && <Text style={s.placeName}>{name}</Text>}
      <Text style={s.place}>{address}</Text>
      {!!contact && (
        <Text style={s.contact}>
          Contact · {contact}{phone ? ` · ${phone}` : ''}
        </Text>
      )}
      <TouchableOpacity style={s.mapBtn} onPress={maps} activeOpacity={0.75}>
        <Icon name="map-marker-outline" size={13} color={ig.text} />
        <Text style={s.mapT}>Open in Maps</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── The parcel ─────────────────────────────────────────────────────────────

/**
 * One item in the box.
 *
 * `onVerdict` present = she is answering. Absent = the brand is reading her answers back.
 * A dropped item is shown struck through rather than removed: a box that quietly loses a row
 * is a box nobody can reconcile against what was actually posted.
 */
export function ParcelItem({ item, onVerdict, onDrop, onRemove }) {
  const v = item.receipt_status;
  const dropped = !!item.dropped_at;
  return (
    <View style={[s.item, dropped && s.itemDropped]}>
      {item.image_url
        ? <Image source={{ uri: item.image_url }} style={s.thumb} />
        : <View style={[s.thumb, s.thumbBlank]}><Icon name="package-variant" size={15} color={ig.mut} /></View>}

      <View style={{ flex: 1 }}>
        <Text style={[s.itemName, dropped && s.strike]} numberOfLines={1}>
          {item.name_at_dispatch || 'Item'}
        </Text>
        <Text style={s.itemMeta}>
          {[item.sku_at_dispatch, item.price_at_dispatch ? `₹${Number(item.price_at_dispatch).toLocaleString('en-IN')}` : null,
            `QTY ${item.quantity || 1}`].filter(Boolean).join(' · ')}
        </Text>

        {dropped && <Text style={s.droppedT}>Dropped — not coming</Text>}

        {!dropped && !onVerdict && !!v && (
          <Text style={[s.verdict, v !== 'received' && s.verdictBad]}>{RECEIPT_LABEL[v]}</Text>
        )}

        {!dropped && !!onVerdict && (
          <View style={s.verdictRow}>
            {['received', 'missing', 'damaged'].map(k => (
              <TouchableOpacity
                key={k}
                style={[s.chip, v === k && (k === 'received' ? s.chipOn : s.chipBad)]}
                onPress={() => onVerdict(k)}
                activeOpacity={0.8}
              >
                <Text style={[s.chipT, v === k && (k === 'received' ? s.chipOnT : s.chipBadT)]}>
                  {RECEIPT_LABEL[k]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {!!onRemove && !dropped && (
        <TouchableOpacity onPress={onRemove} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Icon name="close" size={16} color={ig.mut} />
        </TouchableOpacity>
      )}
      {!!onDrop && !dropped && (
        <TouchableOpacity style={s.dropBtn} onPress={onDrop} activeOpacity={0.8}>
          <Text style={s.dropT}>Drop it</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

/**
 * What she is told when something did not arrive.
 *
 * The board calls this the sentence the whole slice turns on. A shortfall is the brand's
 * problem: she does not chase it, she does not explain it, and it does not touch her shoot,
 * her posts or her fee. If she does not BELIEVE that, she messages the brand anyway and the
 * screen has failed — so it is said plainly and only once.
 */
export function ShortfallNote({ count, brandName }) {
  if (!count) return null;
  return (
    <View style={s.short}>
      <Text style={s.shortT}>
        {count === 1 ? '1 item is missing.' : `${count} items are missing.`}{' '}
        <Text style={s.shortB}>You don’t have to chase it.</Text>
      </Text>
      <Text style={s.shortS}>
        We’ve told {brandName || 'the brand'} already. Shoot what arrived — nothing about your fee,
        your posts or your deadline changes.
      </Text>
    </View>
  );
}

// ─── Small shared bits ──────────────────────────────────────────────────────

export function TurnLine({ turn, mine }) {
  if (!turn?.line) return null;
  return (
    <View style={[s.turn, mine && s.turnMine]}>
      <Text style={[s.turnT, mine && s.turnMineT]}>{mine ? 'YOUR MOVE' : 'WAITING'}</Text>
      <Text style={s.turnL}>{turn.line}</Text>
    </View>
  );
}

export function Btn({ label, onPress, tone = 'sec', disabled, sub }) {
  return (
    <TouchableOpacity
      style={[s.btn, tone === 'pri' ? s.btnPri : tone === 'ghost' ? s.btnGhost : s.btnSec, disabled && s.btnOff]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.85}
    >
      <Text style={[s.btnT, tone === 'pri' ? s.btnPriT : s.btnSecT]}>{label}</Text>
      {!!sub && <Text style={s.btnSub}>{sub}</Text>}
    </TouchableOpacity>
  );
}

/** A note where a button would be, so a missing action never reads as a broken screen. */
export function WhyNote({ children }) {
  return (
    <View style={s.whyNote}><Text style={s.whyNoteT}>{children}</Text></View>
  );
}

export function Delivered({ at }) {
  const when = shortDateTime(at);
  if (!when) return null;
  return <Text style={s.delivered}>Delivered {when}</Text>;
}

const s = StyleSheet.create({
  card: { borderWidth: 1, borderColor: ig.lineSoft, borderRadius: 12, padding: 13, marginBottom: 10 },
  label: { fontSize: 9.5, fontWeight: '800', color: ig.mut, letterSpacing: 0.5, textTransform: 'uppercase' },
  // An impossible window is a problem to fix, not a range to read. It gets the palette's
  // warning tone so it does not look like an ordinary card that happens to be empty.
  cardBad: { borderColor: ig.red, backgroundColor: ig.redBg },
  labelBad: { fontSize: 9.5, fontWeight: '800', color: ig.red, letterSpacing: 0.5, textTransform: 'uppercase' },
  range: { fontSize: 15.5, fontWeight: '800', color: ig.text, marginTop: 6 },
  rangeDash: { fontSize: 11, fontWeight: '700', color: ig.mut },
  why: { fontSize: 11, color: ig.mut, fontWeight: '650', marginTop: 6, lineHeight: 16 },
  slot: { fontSize: 17, fontWeight: '800', color: ig.text, marginTop: 5 },
  slotSub: { fontSize: 13.5, fontWeight: '800', color: ig.text, marginTop: 3 },

  placeName: { fontSize: 13, fontWeight: '800', color: ig.text },
  place: { fontSize: 11.5, fontWeight: '700', color: ig.mut, marginTop: 3, lineHeight: 17, letterSpacing: 0.3 },
  contact: { fontSize: 11, fontWeight: '700', color: ig.mut, marginTop: 6 },
  mapBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 10, alignSelf: 'flex-start', borderWidth: 1, borderColor: ig.line, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  mapT: { fontSize: 11.5, fontWeight: '800', color: ig.text },

  item: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: ig.lineSoft },
  itemDropped: { opacity: 0.55 },
  thumb: { width: 42, height: 42, borderRadius: 7, backgroundColor: ig.bgSoft },
  thumbBlank: { alignItems: 'center', justifyContent: 'center' },
  itemName: { fontSize: 12.5, fontWeight: '800', color: ig.text },
  strike: { textDecorationLine: 'line-through' },
  itemMeta: { fontSize: 10, fontWeight: '700', color: ig.mut, marginTop: 2, letterSpacing: 0.3 },
  droppedT: { fontSize: 10, fontWeight: '800', color: ig.mut, marginTop: 4, letterSpacing: 0.3 },
  verdict: { fontSize: 10, fontWeight: '800', color: ig.green, marginTop: 5, letterSpacing: 0.3 },
  verdictBad: { color: ig.red },

  verdictRow: { flexDirection: 'row', gap: 6, marginTop: 8 },
  chip: { borderWidth: 1, borderColor: ig.line, borderRadius: 7, paddingHorizontal: 9, paddingVertical: 5 },
  chipOn: { backgroundColor: ig.greenBg, borderColor: ig.green },
  chipBad: { backgroundColor: ig.redBg, borderColor: ig.red },
  chipT: { fontSize: 10.5, fontWeight: '800', color: ig.mut },
  chipOnT: { color: ig.green },
  chipBadT: { color: ig.red },

  dropBtn: { borderWidth: 1, borderColor: ig.line, borderRadius: 7, paddingHorizontal: 9, paddingVertical: 5 },
  dropT: { fontSize: 10.5, fontWeight: '800', color: ig.text },

  short: { backgroundColor: ig.redBg, borderRadius: 11, padding: 12, marginTop: 10 },
  shortT: { fontSize: 12, fontWeight: '700', color: ig.red, lineHeight: 18 },
  shortB: { fontWeight: '800' },
  shortS: { fontSize: 11, fontWeight: '650', color: ig.red, marginTop: 5, lineHeight: 16, opacity: 0.9 },

  turn: { borderRadius: 10, padding: 11, marginBottom: 12, backgroundColor: ig.bgSoft },
  turnMine: { backgroundColor: ig.yBg },
  turnT: { fontSize: 9, fontWeight: '800', letterSpacing: 0.6, color: ig.mut },
  turnMineT: { color: ig.yInk },
  turnL: { fontSize: 12.5, fontWeight: '700', color: ig.text, marginTop: 3, lineHeight: 18 },

  btn: { borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginTop: 9 },
  btnPri: { backgroundColor: ig.text },
  btnSec: { borderWidth: 1, borderColor: ig.line },
  btnGhost: {},
  btnOff: { opacity: 0.4 },
  btnT: { fontSize: 12.5, fontWeight: '800' },
  btnPriT: { color: ig.bg },
  btnSecT: { color: ig.text },
  btnSub: { fontSize: 10, fontWeight: '700', color: ig.mut, marginTop: 2 },

  whyNote: { backgroundColor: ig.bgSoft, borderRadius: 10, padding: 12, marginTop: 10 },
  whyNoteT: { fontSize: 11.5, fontWeight: '650', color: ig.mut, lineHeight: 17 },

  delivered: { fontSize: 11, fontWeight: '700', color: ig.mut, marginTop: 3 },
});
