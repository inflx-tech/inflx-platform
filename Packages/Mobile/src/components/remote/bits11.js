/**
 * Item 11 — the pieces the Remote screens are built from, and nothing else.
 * Contract: features/item11-remote · mockups R1–R16 · gap report §11.2
 *
 * WHAT IS NOT HERE, ON PURPOSE. The gate card, the step line, the solid-ink live card, the
 * Delayed chip and the four state boxes are ITEM 10's (components/shoot/bits10.js) and are
 * imported by the screens unchanged. Item 11 draws the same shoot; a second gate card would be
 * a second answer to the same question.
 *
 * COLOUR, from §8 of the gap-check prompt:
 *   Return  → the waiting-blue family        Gift → the done-violet family
 *   missing / damaged → the red family, on the check control ONLY
 *   Delayed and overdue → the yourMove-amber family
 *   tracking numbers → the mono font
 */
import React from 'react';
import { View, Text, Pressable, TextInput, Image, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { settingsTokens as T, fonts } from '../../theme/tokens';
import { C11, rupees5, day10, TRACK_STEPS, trackIndex, BOXES11 } from './copy11';

/* ── Return / Gift ──────────────────────────────────────────────────────── */

/** The tag on a line (R5, R8). Return is waiting-blue; Gift is done-violet. */
export function DispositionTag11({ value, testID }) {
  const isReturn = value === 'return';
  // §8: Return in the waiting-blue family, Gift in the done-violet one.
  const c = isReturn ? T.state.waiting : T.state.completed;
  return (
    <View style={[s.tag, { backgroundColor: c.bg }]} testID={testID || `tag-${value}`}>
      <Text style={[s.tagText, { color: c.fg }]}>{isReturn ? C11.creator.tagReturn : C11.creator.tagGift}</Text>
    </View>
  );
}

/** The switch on R5. Two words, one of them chosen — never a checkbox nobody can read. */
export function ReturnGiftSwitch11({ value, onChange, disabled, testID }) {
  return (
    <View style={s.switch} testID={testID || 'return-gift'}>
      {['return', 'gift'].map((k) => {
        const on = value === k;
        const c = k === 'return' ? T.state.waiting : T.state.completed;
        return (
          <Pressable
            key={k}
            onPress={() => !disabled && onChange(k)}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityState={{ selected: !!on, disabled: !!disabled }}
            testID={`${testID || 'return-gift'}-${k}`}
            style={[s.switchHalf, on && { backgroundColor: c.bg }, disabled && { opacity: 0.45 }]}
          >
            <Text style={[s.switchText, { color: on ? c.fg : T.ink3 }]}>
              {k === 'return' ? C11.creator.tagReturn : C11.creator.tagGift}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/* ── the quantity stepper (R5) ──────────────────────────────────────────── */

/** 1–5, and it says why when it stops. */
export function QtyStepper11({ value, onChange, max = 5, disabled, testID }) {
  const step = (d) => {
    const next = Math.min(max, Math.max(1, Number(value || 1) + d));
    if (next !== value) onChange(next);
  };
  return (
    <View style={s.qty} testID={testID || 'qty'}>
      <Pressable onPress={() => !disabled && step(-1)} disabled={disabled || value <= 1}
        accessibilityLabel="One fewer" testID={`${testID || 'qty'}-minus`}
        style={[s.qtyBtn, (disabled || value <= 1) && { opacity: 0.35 }]}>
        <Icon name="minus" size={15} color={T.ink} />
      </Pressable>
      <Text style={s.qtyValue} testID={`${testID || 'qty'}-value`}>{value}</Text>
      <Pressable onPress={() => !disabled && step(1)} disabled={disabled || value >= max}
        accessibilityLabel="One more" testID={`${testID || 'qty'}-plus`}
        style={[s.qtyBtn, (disabled || value >= max) && { opacity: 0.35 }]}>
        <Icon name="plus" size={15} color={T.ink} />
      </Pressable>
    </View>
  );
}

/* ── a product row on R5 ────────────────────────────────────────────────── */

export function ProductRow11({ product, line, onChange, onRemove, disabled, testID }) {
  const picked = !!line;
  const variants = product.variants || [];
  return (
    <View style={[s.row, picked && s.rowPicked]} testID={testID || `product-${product.id}`}>
      <View style={s.rowTop}>
        {product.image
          ? <Image source={{ uri: product.image }} style={s.thumb} />
          : <View style={[s.thumb, s.thumbEmpty]}><Icon name="hanger" size={18} color={T.ink3} /></View>}
        <View style={{ flex: 1 }}>
          <Text style={s.rowName} numberOfLines={2}>{product.name}</Text>
          {product.price != null ? <Text style={s.rowPrice}>{rupees5(product.price)}</Text> : null}
        </View>
        <Pressable
          onPress={() => (picked ? onRemove() : onChange({ variantId: variants.length ? null : null, quantity: 1, disposition: 'gift' }))}
          disabled={disabled}
          accessibilityRole="button"
          testID={`${testID || `product-${product.id}`}-toggle`}
          style={[s.pick, picked && s.pickOn, disabled && { opacity: 0.4 }]}
        >
          <Icon name={picked ? 'check' : 'plus'} size={16} color={picked ? '#FFFFFF' : T.ink} />
        </Pressable>
      </View>

      {picked ? (
        <View style={s.rowBody}>
          {variants.length ? (
            <View style={s.variants}>
              {variants.map((v) => {
                const on = line.variantId === v.id;
                return (
                  <Pressable key={v.id} onPress={() => onChange({ ...line, variantId: v.id })}
                    accessibilityState={{ selected: !!on }}
                    testID={`variant-${v.id}`}
                    style={[s.variant, on && s.variantOn]}>
                    <Text style={[s.variantText, on && { color: '#FFFFFF' }]}>{v.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}
          <View style={s.rowControls}>
            <QtyStepper11 value={line.quantity} onChange={(q) => onChange({ ...line, quantity: q })}
              disabled={disabled} testID={`qty-${product.id}`} />
            <ReturnGiftSwitch11 value={line.disposition} onChange={(d) => onChange({ ...line, disposition: d })}
              disabled={disabled} testID={`disp-${product.id}`} />
          </View>
        </View>
      ) : null}
    </View>
  );
}

/* ── her locked address (R5) ────────────────────────────────────────────── */

export function AddressCard11({ address, brandName, testID }) {
  if (!address) return null;
  return (
    <View style={s.card} testID={testID || 'address-card'}>
      <View style={s.cardHead}>
        <Text style={s.cardTitle}>{address.name}</Text>
        <View style={s.lockChip}><Text style={s.lockText}>{C11.brand.addressLocked}</Text></View>
      </View>
      <Text style={s.cardLine}>{address.street}</Text>
      <Text style={s.cardLine}>{[address.city, address.state, address.pincode].filter(Boolean).join(', ')}</Text>
      {address.phone ? <Text style={s.cardLine}>{address.phone}</Text> : null}
      {address.note ? <Text style={s.cardNote}>{address.note}</Text> : null}
      {address.sizes ? (
        <View style={s.sizes} testID="her-sizes">
          <Text style={s.sizesLabel}>{C11.brand.herSizes}</Text>
          <Text style={s.sizesValue}>{address.sizes}</Text>
        </View>
      ) : null}
    </View>
  );
}

/* ── the tracking step line (R8) ────────────────────────────────────────── */

export function TrackingSteps11({ parcel, cityName, testID }) {
  const at = trackIndex(parcel);
  const labels = TRACK_STEPS.map((l, i) => (i === 2 && cityName ? `In ${cityName}` : l));
  return (
    <View style={s.track} testID={testID || 'tracking'}>
      {labels.map((l, i) => (
        <View key={l} style={s.trackStep} testID={`track-${i}-${i <= at ? 'done' : 'later'}`}>
          <View style={[s.trackDot, i <= at ? s.trackDone : s.trackLater]}>
            {i <= at ? <Icon name="check" size={8} color="#FFFFFF" /> : null}
          </View>
          <Text style={[s.trackLabel, i > at && { color: T.ink3 }]} numberOfLines={1}>{l}</Text>
        </View>
      ))}
    </View>
  );
}

/** The live card, solid ink with white text — item 10's TimeCard10, said for a parcel. */
export function TrackingCard11({ parcel, testID }) {
  if (!parcel || !parcel.tracking) return null;
  const head = parcel.deliveredAt ? 'Delivered'
    : parcel.outForDeliveryAt ? 'Out for delivery today'
      : parcel.collectedAt ? 'With the courier'
        : 'Booked';
  return (
    <View style={s.live} testID={testID || 'tracking-card'}>
      <Text style={s.liveHead}>{head}</Text>
      <Text style={s.liveTracking} testID="tracking-number">{parcel.tracking}</Text>
      {parcel.courier ? <Text style={s.liveSub}>{parcel.courier}</Text> : null}
    </View>
  );
}

/* ── the three-way check (R9) ───────────────────────────────────────────── */

/**
 * Received / Missing / Damaged. The red family appears HERE and nowhere else on the screen
 * (§8) — a parcel with a missing item is not an error state, it is a fact she is recording,
 * and her shoot carries on either way.
 */
export function ThreeWayCheck11({ value, note, onChange, onNote, disabled, testID }) {
  const OPTIONS = [
    { k: 'received', label: C11.creator.received, tone: T.state.active },
    // §8: the red family appears on THIS control and nowhere else on the screen.
    { k: 'missing',  label: C11.creator.missing,  tone: T.state.declined },
    { k: 'damaged',  label: C11.creator.damaged,  tone: T.state.declined },
  ];
  return (
    <View testID={testID || 'check'}>
      <View style={s.threeWay}>
        {OPTIONS.map((o) => {
          const on = value === o.k;
          return (
            <Pressable key={o.k} onPress={() => !disabled && onChange(o.k)} disabled={disabled}
              accessibilityRole="button" accessibilityState={{ selected: !!on, disabled: !!disabled }}
              testID={`${testID || 'check'}-${o.k}`}
              style={[s.threeWayBtn, on && { backgroundColor: o.tone.bg, borderColor: o.tone.fg }, disabled && { opacity: 0.45 }]}>
              <Text style={[s.threeWayText, on && { color: o.tone.fg }]}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>
      {value && value !== 'received' ? (
        <TextInput
          value={note || ''}
          onChangeText={onNote}
          editable={!disabled}
          placeholder={C11.creator.notePlaceholder}
          placeholderTextColor={T.ink3}
          maxLength={300}
          multiline
          style={s.noteInput}
          testID={`${testID || 'check'}-note`}
        />
      ) : null}
    </View>
  );
}

/* ── the money card (R6) ────────────────────────────────────────────────── */

export function MoneyCard11({ quote, creatorName, testID }) {
  if (!quote) return null;
  return (
    <View style={s.money} testID={testID || 'money-card'}>
      <Row label={C11.brand.shippingTo(creatorName)} value={rupees5(quote.outbound)} testID="money-outbound" />
      {quote.returnHold > 0
        ? <Row label={C11.brand.returnLocked(quote.returnCount)} value={rupees5(quote.returnHold)} testID="money-hold" />
        : null}
      <View style={s.moneyRule} />
      <Row label={C11.brand.fromWallet} value={rupees5(quote.total)} strong testID="money-total" />
      <Text style={s.moneyNote}>{C11.brand.gstLine}</Text>
      <View style={s.moneyRule} />
      <Row label={C11.brand.availableLine} value={rupees5(quote.available)} testID="money-available" />
      {quote.lockedFee > 0
        ? <Text style={s.moneyNote}>{C11.brand.feeNeverUsed(quote.lockedFee, creatorName)}</Text>
        : null}
    </View>
  );
}

function Row({ label, value, strong, testID }) {
  return (
    <View style={s.moneyRow} testID={testID}>
      <Text style={[s.moneyLabel, strong && { fontFamily: fonts.sansBold, color: T.ink }]} numberOfLines={2}>{label}</Text>
      <Text style={[s.moneyValue, strong && { fontFamily: fonts.sansBold }]}>{value}</Text>
    </View>
  );
}

/* ── the box presets (R6) ───────────────────────────────────────────────── */

export function BoxPicker11({ value, onChange, dims, onDims, testID }) {
  return (
    <View testID={testID || 'box'}>
      <View style={s.boxes}>
        {BOXES11.map((b) => {
          const on = value === b.key;
          return (
            <Pressable key={b.key} onPress={() => onChange(b.key)}
              accessibilityRole="button" accessibilityState={{ selected: !!on }}
              testID={`box-${b.key}`}
              style={[s.box, on && s.boxOn]}>
              <Text style={[s.boxLabel, on && { color: '#FFFFFF' }]}>{b.label}</Text>
              <Text style={[s.boxDims, on && { color: 'rgba(255,255,255,0.75)' }]}>{b.dims}</Text>
            </Pressable>
          );
        })}
      </View>
      {value === 'other' ? (
        <View style={s.dims} testID="box-dims">
          {['l', 'w', 'h'].map((k) => (
            <TextInput key={k} value={String(dims?.[k] ?? '')} onChangeText={(v) => onDims({ ...dims, [k]: v })}
              keyboardType="numeric" placeholder={k.toUpperCase()} placeholderTextColor={T.ink3}
              style={s.dimInput} testID={`dim-${k}`} />
          ))}
          <Text style={s.dimUnit}>cm</Text>
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  tag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, alignSelf: 'flex-start' },
  tagText: { fontFamily: fonts.sansBold, fontSize: 10.5 },

  switch: { flexDirection: 'row', borderWidth: 1, borderColor: T.border, borderRadius: 9, overflow: 'hidden' },
  switchHalf: { paddingHorizontal: 12, paddingVertical: 7 },
  switchText: { fontFamily: fonts.sansBold, fontSize: 11.5 },

  qty: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: T.border, borderRadius: 9 },
  qtyBtn: { paddingHorizontal: 10, paddingVertical: 6 },
  qtyValue: { fontFamily: fonts.sansBold, fontSize: 13, color: T.ink, minWidth: 18, textAlign: 'center' },

  row: { borderWidth: 1, borderColor: T.border, borderRadius: 12, padding: 12, marginBottom: 10 },
  rowPicked: { borderColor: T.ink },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  thumb: { width: 44, height: 44, borderRadius: 8, backgroundColor: T.surface },
  thumbEmpty: { alignItems: 'center', justifyContent: 'center' },
  rowName: { fontFamily: fonts.sansBold, fontSize: 13, color: T.ink },
  rowPrice: { fontFamily: fonts.sansRegular, fontSize: 11.5, color: T.ink2, marginTop: 2 },
  pick: { width: 30, height: 30, borderRadius: 8, borderWidth: 1, borderColor: T.border, alignItems: 'center', justifyContent: 'center' },
  pickOn: { backgroundColor: T.ink, borderColor: T.ink },
  rowBody: { marginTop: 10, gap: 10 },
  rowControls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  variants: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  variant: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 7, borderWidth: 1, borderColor: T.border },
  variantOn: { backgroundColor: T.ink, borderColor: T.ink },
  variantText: { fontFamily: fonts.sansBold, fontSize: 11, color: T.ink },

  card: { borderWidth: 1, borderColor: T.border, borderRadius: 12, padding: 14, marginBottom: 14 },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { fontFamily: fonts.sansBold, fontSize: 14, color: T.ink },
  lockChip: { backgroundColor: T.surface, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  lockText: { fontFamily: fonts.sansBold, fontSize: 10, color: T.ink2 },
  cardLine: { fontFamily: fonts.sansRegular, fontSize: 12.5, color: T.ink2, marginTop: 3 },
  cardNote: { fontFamily: fonts.sansRegular, fontSize: 12, color: T.ink3, marginTop: 6, fontStyle: 'italic' },
  sizes: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: T.border },
  sizesLabel: { fontFamily: fonts.sansBold, fontSize: 10.5, color: T.ink3, textTransform: 'uppercase', letterSpacing: 0.4 },
  sizesValue: { fontFamily: fonts.sansBold, fontSize: 13, color: T.ink, marginTop: 3 },

  track: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 12 },
  trackStep: { flex: 1, alignItems: 'center' },
  trackDot: { width: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginBottom: 5 },
  trackDone: { backgroundColor: T.state.active.fg },
  trackLater: { borderWidth: 1.5, borderColor: T.border },
  trackLabel: { fontFamily: fonts.sansBold, fontSize: 9.5, color: T.ink2, textAlign: 'center' },

  live: { backgroundColor: T.ink, borderRadius: 12, padding: 16, marginBottom: 14 },
  liveHead: { fontFamily: fonts.sansBold, fontSize: 12, color: 'rgba(255,255,255,0.72)' },
  liveTracking: { fontFamily: fonts.monoBold, fontSize: 18, color: '#FFFFFF', marginTop: 4, letterSpacing: 0.5 },
  liveSub: { fontFamily: fonts.sansRegular, fontSize: 12, color: 'rgba(255,255,255,0.72)', marginTop: 4 },

  threeWay: { flexDirection: 'row', gap: 7 },
  threeWayBtn: { flex: 1, paddingVertical: 9, borderRadius: 9, borderWidth: 1, borderColor: T.border, alignItems: 'center' },
  threeWayText: { fontFamily: fonts.sansBold, fontSize: 11.5, color: T.ink2 },
  noteInput: { borderWidth: 1, borderColor: T.border, borderRadius: 9, padding: 10, marginTop: 8, minHeight: 58,
    fontFamily: fonts.sansRegular, fontSize: 12.5, color: T.ink, textAlignVertical: 'top' },

  money: { borderWidth: 1, borderColor: T.border, borderRadius: 12, padding: 14, marginBottom: 14 },
  moneyRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 6 },
  moneyLabel: { flex: 1, fontFamily: fonts.sansRegular, fontSize: 12.5, color: T.ink2 },
  moneyValue: { fontFamily: fonts.sansRegular, fontSize: 13, color: T.ink },
  moneyRule: { height: 1, backgroundColor: T.border, marginVertical: 8 },
  moneyNote: { fontFamily: fonts.sansRegular, fontSize: 11.5, color: T.ink3, marginTop: 4, lineHeight: 16 },

  boxes: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  box: { flexGrow: 1, minWidth: '47%', borderWidth: 1, borderColor: T.border, borderRadius: 10, padding: 10 },
  boxOn: { backgroundColor: T.ink, borderColor: T.ink },
  boxLabel: { fontFamily: fonts.sansBold, fontSize: 12.5, color: T.ink },
  boxDims: { fontFamily: fonts.sansRegular, fontSize: 11, color: T.ink3, marginTop: 2 },
  dims: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 8 },
  dimInput: { flex: 1, borderWidth: 1, borderColor: T.border, borderRadius: 9, padding: 9,
    fontFamily: fonts.sansRegular, fontSize: 13, color: T.ink, textAlign: 'center' },
  dimUnit: { fontFamily: fonts.sansRegular, fontSize: 12, color: T.ink3 },
});

export { s as bits11Styles };
