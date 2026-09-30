/**
 * Ordering's shared parts (shopper-ordering · board O1, P1–P3, D4, O6): the bag icon with its count,
 * colour and size choices, the product pop-up, the size sheet, the sticky bar, price rows.
 *
 * Prices on these parts always come from the server's answer (R5); the phone only shows them.
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, TouchableOpacity, Image, Modal, ScrollView, Pressable, StyleSheet, Dimensions, Linking,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { settingsTokens as T, fonts } from '../../theme/tokens';
import { inr } from './copyShop';
import { CO } from './copyOrder';
import { subscribeBagCount, BAG_MAX_QTY } from './bag';

export const K = { ...T, ink: '#1A1A17', ok: '#1A7A3D', okSoft: '#E4F5EA', warn: '#6B5A00', warnSoft: '#FFF3C4' };
const W = Dimensions.get('window').width;

/** The screen's navigation without requiring a navigator (guarded for tests and stray renders). */
export function useNavSafe() {
  let nav = null;
  try {
    const RN = require('@react-navigation/native');
    if (RN && typeof RN.useNavigation === 'function') nav = RN.useNavigation(); // eslint-disable-line react-hooks/rules-of-hooks
  } catch { nav = null; }
  return nav;
}

/* ───────────────────────────────────────────── the bag icon (O2: on every screen's top bar) */

export function BagButton({ dark }) {
  const nav = useNavSafe();
  const [n, setN] = useState(0);
  useEffect(() => subscribeBagCount(setN), []);
  return (
    <TouchableOpacity onPress={() => nav && nav.navigate('Bag')} style={[b.ic, dark && b.icDark]} accessibilityLabel={`Bag, ${n} items`} testID="open-bag">
      <Icon name="shopping-outline" size={19} color={dark ? '#fff' : K.ink} />
      {n > 0 ? <View style={b.badge}><Text style={b.badgeText} testID="bag-count">{n > 99 ? '99' : n}</Text></View> : null}
    </TouchableOpacity>
  );
}

/* ───────────────────────────────────────────── colour and size */

/** The colours and sizes of a product from the deal page's data: [{ colour, sizes:[{ size, left, sold_out }] }]. */
export function hasChoices(product) {
  return !!(product && Array.isArray(product.colours) && product.colours.some((c) => (c.sizes || []).length));
}

export function ChoicePicker({ product, value, onChange, testIDPrefix = 'pick' }) {
  const colours = (product && product.colours) || [];
  const withSizes = colours.filter((c) => (c.sizes || []).length);
  const colour = value.colour != null ? value.colour : (withSizes[0] ? withSizes[0].colour : null);
  const row = withSizes.find((c) => (c.colour || null) === (colour || null)) || withSizes[0];
  if (!withSizes.length) return null;
  return (
    <View>
      {withSizes.some((c) => c.colour) ? (
        <>
          <Text style={b.lab}>{CO.colour(colour || '')}</Text>
          <View style={b.wrap}>
            {withSizes.map((c) => (
              <TouchableOpacity key={c.colour || 'one'} onPress={() => onChange({ colour: c.colour, size: null })}
                style={[b.chip, (c.colour || null) === (colour || null) && b.chipOn]} testID={`${testIDPrefix}-colour-${c.colour}`}
                accessibilityState={{ selected: (c.colour || null) === (colour || null) }}>
                <Text style={[b.chipText, (c.colour || null) === (colour || null) && b.chipTextOn]}>{c.colour}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      ) : null}
      <View style={[b.rowBetween, { marginTop: 10 }]}>
        <Text style={b.lab}>{CO.size}</Text>
        {product.size_chart ? (
          <Text style={b.link} onPress={() => { if (/^https?:/.test(product.size_chart)) Linking.openURL(product.size_chart); }}>{CO.sizeChart}</Text>
        ) : null}
      </View>
      <View style={b.wrap}>
        {(row ? row.sizes : []).map((s) => {
          const on = value.size === s.size && (value.colour || colour) === colour;
          return (
            <TouchableOpacity key={s.size} disabled={s.sold_out} onPress={() => onChange({ colour, size: s.size })}
              style={[b.size, on && b.chipOn, s.sold_out && b.sizeOut]} testID={`${testIDPrefix}-size-${s.size}`}
              accessibilityState={{ selected: !!on, disabled: !!s.sold_out }}>
              <Text style={[b.chipText, on && b.chipTextOn, s.sold_out && b.outText]}>{s.size}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      {(() => {
        const s = row && row.sizes.find((x) => x.size === value.size);
        return s && s.left ? <Text style={b.left}>{CO.onlyLeft(s.left)}</Text> : null;
      })()}
    </View>
  );
}

export function QtyStepper({ value, onChange, max = BAG_MAX_QTY, testID = 'qty' }) {
  return (
    <View style={b.step}>
      <TouchableOpacity onPress={() => onChange(Math.max(1, value - 1))} disabled={value <= 1} style={b.stepBtn} testID={`${testID}-minus`}><Text style={b.stepSign}>−</Text></TouchableOpacity>
      <Text style={b.stepVal} testID={`${testID}-value`}>{value}</Text>
      <TouchableOpacity onPress={() => onChange(Math.min(max, value + 1))} disabled={value >= max} style={b.stepBtn} testID={`${testID}-plus`}><Text style={b.stepSign}>+</Text></TouchableOpacity>
    </View>
  );
}

/* ───────────────────────────────────────────── sheets */

export function Sheet({ visible, onClose, children, testID, tall }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={b.dim} onPress={onClose}>
        <Pressable style={[b.sheet, tall && { maxHeight: '92%' }]} onPress={() => {}} testID={testID}>
          <View style={b.grab} />
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function Photos({ images, height = 260 }) {
  const list = (images || []).filter(Boolean);
  const [i, setI] = useState(0);
  if (!list.length) return <View style={[b.photo, { height }]} />;
  return (
    <View>
      <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => setI(Math.round(e.nativeEvent.contentOffset.x / (W - 28)))}>
        {list.map((u) => <Image key={u} source={{ uri: u }} style={[b.photo, { width: W - 28, height }]} resizeMode="cover" />)}
      </ScrollView>
      {list.length > 1 ? <View style={b.pager}><Text style={b.pagerText}>{`${i + 1} / ${list.length}`}</Text></View> : null}
    </View>
  );
}

/**
 * The product pop-up (P2, V2, K2, K5, G4): photos, price, what picking it does in the deal, colours,
 * sizes with stock, size chart, details, quantity where it applies. Nothing is picked without its
 * colour and size (6.5).
 */
export function ProductPopup({ product, visible, onClose, effect, price, struck, allowQty, initial, primaryLabel, onPrimary, onRemove, header, testID = 'product-popup' }) {
  const [sel, setSel] = useState({ colour: null, size: null });
  const [qty, setQty] = useState(1);
  useEffect(() => {
    if (!visible) return;
    setSel({ colour: initial ? initial.colour : null, size: initial ? initial.size : null });
    setQty(initial && initial.qty ? initial.qty : 1);
  }, [visible, product && product.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const images = useMemo(() => {
    if (!product) return [];
    const c = (product.colours || []).find((x) => x.colour && x.colour === sel.colour);
    return c && c.images && c.images.length ? c.images : product.images;
  }, [product, sel.colour]);
  if (!product) return null;
  const needs = hasChoices(product);
  const ready = !needs || !!sel.size;
  return (
    <Sheet visible={visible} onClose={onClose} testID={testID} tall>
      <ScrollView style={{ maxHeight: 600 }} contentContainerStyle={{ paddingBottom: 8 }}>
        {header}
        <Photos images={images} />
        <View style={[b.rowBetween, { marginTop: 10 }]}>
          <Text style={b.pname} numberOfLines={2}>{product.name}</Text>
          <Text style={b.price}>{inr(price != null ? price : product.shopper_price != null ? product.shopper_price : product.price)}
            {struck ? <Text style={b.struck}>  {inr(struck)}</Text> : null}</Text>
        </View>
        {effect ? <View style={b.effect}><Text style={b.effectText}>{effect}</Text></View> : null}
        <ChoicePicker product={product} value={sel} onChange={setSel} testIDPrefix={testID} />
        {product.details ? <Text style={b.details}><Text style={{ fontFamily: fonts.sansBold }}>{CO.details} · </Text>{product.details}</Text> : null}
        {allowQty ? (
          <View style={[b.rowBetween, { marginTop: 12 }]}>
            <Text style={b.lab}>{CO.quantity}</Text>
            <QtyStepper value={qty} onChange={setQty} testID={`${testID}-qty`} />
          </View>
        ) : null}
      </ScrollView>
      <TouchableOpacity disabled={!ready} onPress={() => onPrimary({ colour: needs ? (sel.colour || firstColour(product)) : null, size: sel.size, qty })}
        style={[b.primary, !ready && b.primaryDis]} testID={`${testID}-primary`} accessibilityState={{ disabled: !ready }}>
        <Text style={[b.primaryText, !ready && { color: T.disabledText }]}>{ready ? primaryLabel(sel) : CO.chooseSize}</Text>
      </TouchableOpacity>
      {onRemove ? <Text style={b.remove} onPress={onRemove} testID={`${testID}-remove`}>{CO.remove}</Text> : null}
    </Sheet>
  );
}

function firstColour(product) {
  const c = (product.colours || []).find((x) => (x.sizes || []).length);
  return c ? c.colour : null;
}

/* ───────────────────────────────────────────── the sticky bar (P3, V1, K1, G1) */

export function StickyBar({ progress, next, amount, struck, count, label, onPress, disabled, testID = 'sticky' }) {
  return (
    <View style={b.bar} testID={testID}>
      {progress ? (
        <View style={b.prog}>
          <Text style={b.progText} testID={`${testID}-progress`}>{progress}</Text>
          {next ? <Text style={b.progNext} testID={`${testID}-next`}>{next}</Text> : null}
        </View>
      ) : null}
      <View style={b.rowBetween}>
        <Text style={b.mut}>{count}</Text>
        <Text style={b.amount} testID={`${testID}-amount`}>{amount != null ? inr(amount) : ''}{struck ? <Text style={b.struck}>  {inr(struck)}</Text> : null}</Text>
      </View>
      <TouchableOpacity onPress={onPress} disabled={disabled} style={[b.primary, disabled && b.primaryDis]} testID={`${testID}-button`} accessibilityState={{ disabled: !!disabled }}>
        <Text style={[b.primaryText, disabled && { color: T.disabledText }]}>{label}</Text>
      </TouchableOpacity>
    </View>
  );
}

/* ───────────────────────────────────────────── price rows (D4, O6, O11) */

export function MoneyRows({ normal, savings, delivery, codFee, total, giftValue }) {
  return (
    <View style={b.money}>
      {normal != null ? <Row l={CO.itemsNormal} v={inr(normal)} /> : null}
      {savings > 0 ? <Row l={CO.offerSavings} v={`− ${inr(savings)}`} tone="ok" /> : null}
      {giftValue > 0 ? <Row l={CO.gift} v={CO.freeWorth(inr(giftValue))} tone="ok" /> : null}
      {delivery != null ? <Row l={CO.delivery} v={delivery > 0 ? inr(delivery) : CO.freeDelivery} tone={delivery > 0 ? null : 'ok'} /> : null}
      {codFee > 0 ? <Row l={CO.codFee} v={inr(codFee)} /> : null}
      <View style={b.hr} />
      <Row l={CO.total} v={inr(total)} bold testID="money-total" />
    </View>
  );
}

function Row({ l, v, tone, bold, testID }) {
  return (
    <View style={b.mrow}>
      <Text style={[b.ml, bold && b.bold]}>{l}</Text>
      <Text style={[b.mv, bold && b.bold, tone === 'ok' && { color: K.ok }]} testID={testID}>{v}</Text>
    </View>
  );
}

export function Notes({ problems = [], notes = [] }) {
  if (!problems.length && !notes.length) return null;
  return (
    <View>
      {notes.map((n) => <Text key={n.code + n.text} style={b.note}>{n.text}</Text>)}
      {problems.map((p) => <Text key={p.code + p.text} style={b.problem}>{p.text}</Text>)}
    </View>
  );
}

/* ───────────────────────────────────────────── O1 · the size sheet for a simple post */

export function SizeSheet({ post, product, visible, onClose, onAdd, onBuyNow, busy }) {
  const [sel, setSel] = useState({ colour: null, size: null });
  useEffect(() => { if (visible) setSel({ colour: null, size: null }); }, [visible, product && product.id]);
  if (!product) return null;
  const needs = hasChoices(product);
  const ready = !needs || !!sel.size;
  const pick = () => ({ colour: needs ? (sel.colour || firstColour(product)) : null, size: sel.size });
  return (
    <Sheet visible={visible} onClose={onClose} testID="size-sheet">
      <View style={{ flexDirection: 'row', gap: 12, marginBottom: 10 }}>
        {product.image_url ? <Image source={{ uri: product.image_url }} style={b.thumb} /> : <View style={b.thumb} />}
        <View style={{ flex: 1 }}>
          <Text style={b.pname} numberOfLines={2}>{product.name}</Text>
          <Text style={b.price}>{inr(product.shopper_price)}{product.shopper_price < product.price ? <Text style={b.struck}>  {inr(product.price)}</Text> : null}</Text>
          {post && post.offer && post.offer.line ? <Text style={b.okLine}>{post.offer.line}{post.creator ? ` · from ${post.creator.name.split(' ')[0]}'s post` : ''}</Text> : null}
        </View>
      </View>
      <ChoicePicker product={product} value={sel} onChange={setSel} testIDPrefix="size-sheet" />
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
        <TouchableOpacity disabled={!ready || busy} onPress={() => onBuyNow(pick())} style={[b.secondary, { flex: 1 }, (!ready || busy) && b.primaryDis]} testID="size-sheet-buy">
          <Text style={b.secondaryText}>{CO.buyNow}</Text>
        </TouchableOpacity>
        <TouchableOpacity disabled={!ready || busy} onPress={() => onAdd(pick())} style={[b.primary, { flex: 1, marginTop: 0 }, (!ready || busy) && b.primaryDis]} testID="size-sheet-add">
          <Text style={[b.primaryText, (!ready || busy) && { color: T.disabledText }]}>{ready ? CO.addToBag : CO.chooseSize}</Text>
        </TouchableOpacity>
      </View>
    </Sheet>
  );
}

export const b = StyleSheet.create({
  ic: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F4F3EE', marginLeft: 6 },
  icDark: { backgroundColor: '#222' },
  badge: { position: 'absolute', top: -3, right: -3, minWidth: 17, height: 17, borderRadius: 9, backgroundColor: K.ink, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  badgeText: { fontFamily: fonts.sansBold, fontSize: 9.5, color: '#fff' },
  lab: { fontFamily: fonts.sansBold, fontSize: 12.5, color: K.ink, marginTop: 10, marginBottom: 6 },
  link: { fontFamily: fonts.sansBold, fontSize: 12, color: K.ink, textDecorationLine: 'underline', marginTop: 10 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 99, borderWidth: 1.5, borderColor: K.border, backgroundColor: '#fff' },
  chipOn: { borderColor: K.ink, backgroundColor: K.ink },
  chipText: { fontFamily: fonts.sansBold, fontSize: 12.5, color: K.ink },
  chipTextOn: { color: '#fff' },
  size: { minWidth: 46, paddingHorizontal: 10, height: 40, borderRadius: 10, borderWidth: 1.5, borderColor: K.border, alignItems: 'center', justifyContent: 'center' },
  sizeOut: { backgroundColor: '#F4F3EE', borderColor: '#EDEDE8' },
  outText: { color: T.disabledText, textDecorationLine: 'line-through' },
  left: { fontFamily: fonts.sansBold, fontSize: 11.5, color: '#B04600', marginTop: 6 },
  step: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: K.border, borderRadius: 10 },
  stepBtn: { width: 34, height: 32, alignItems: 'center', justifyContent: 'center' },
  stepSign: { fontFamily: fonts.sansBold, fontSize: 16, color: K.ink },
  stepVal: { fontFamily: fonts.sansBold, fontSize: 13.5, color: K.ink, minWidth: 18, textAlign: 'center' },
  dim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 14, paddingBottom: 22, maxHeight: '88%' },
  grab: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: '#DDDCD5', marginBottom: 10 },
  photo: { width: '100%', borderRadius: 14, backgroundColor: '#EDECE6' },
  pager: { position: 'absolute', top: 10, left: 10, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3 },
  pagerText: { fontFamily: fonts.sansBold, fontSize: 10.5, color: '#fff' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  pname: { fontFamily: fonts.sansBold, fontSize: 15, color: K.ink, flexShrink: 1 },
  price: { fontFamily: fonts.sansBold, fontSize: 15, color: K.ink },
  struck: { fontFamily: fonts.sansRegular, fontSize: 12, color: K.ink3, textDecorationLine: 'line-through' },
  effect: { backgroundColor: K.warnSoft, borderRadius: 10, padding: 9, marginTop: 8 },
  effectText: { fontFamily: fonts.sansBold, fontSize: 12, color: K.warn },
  details: { fontFamily: fonts.sansRegular, fontSize: 12, color: K.ink2, marginTop: 12, lineHeight: 17 },
  primary: { backgroundColor: T.primary, borderRadius: 14, height: 50, alignItems: 'center', justifyContent: 'center', marginTop: 12, paddingHorizontal: 12 },
  primaryDis: { backgroundColor: T.disabledBg },
  primaryText: { fontFamily: fonts.sansBold, fontSize: 14.5, color: T.onPrimary },
  secondary: { borderRadius: 14, height: 50, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: K.ink, backgroundColor: '#fff' },
  secondaryText: { fontFamily: fonts.sansBold, fontSize: 14.5, color: K.ink },
  remove: { fontFamily: fonts.sansBold, fontSize: 13, color: T.danger, textAlign: 'center', marginTop: 12 },
  bar: { borderTopWidth: 1, borderTopColor: K.border, backgroundColor: '#fff', paddingHorizontal: 14, paddingTop: 10, paddingBottom: 14 },
  prog: { backgroundColor: K.warnSoft, borderRadius: 10, padding: 9, marginBottom: 8 },
  progText: { fontFamily: fonts.sansBold, fontSize: 12.5, color: K.warn },
  progNext: { fontFamily: fonts.sansRegular, fontSize: 12, color: K.warn, marginTop: 2 },
  mut: { fontFamily: fonts.sansRegular, fontSize: 12.5, color: K.ink2 },
  amount: { fontFamily: fonts.sansBold, fontSize: 16, color: K.ink },
  money: { borderWidth: 1, borderColor: K.border, borderRadius: 14, padding: 12, marginTop: 12 },
  mrow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  ml: { fontFamily: fonts.sansRegular, fontSize: 13, color: K.ink2 },
  mv: { fontFamily: fonts.sansRegular, fontSize: 13, color: K.ink },
  bold: { fontFamily: fonts.sansBold, color: K.ink, fontSize: 14.5 },
  hr: { height: 1, backgroundColor: K.border, marginVertical: 6 },
  note: { fontFamily: fonts.sansBold, fontSize: 11.5, color: '#B04600', marginTop: 3 },
  problem: { fontFamily: fonts.sansBold, fontSize: 11.5, color: T.danger, marginTop: 3 },
  thumb: { width: 64, height: 80, borderRadius: 10, backgroundColor: '#EDECE6' },
  okLine: { fontFamily: fonts.sansBold, fontSize: 11.5, color: K.ok, marginTop: 4 },
});
