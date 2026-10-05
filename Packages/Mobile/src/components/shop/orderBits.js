/**
 * Ordering's shared parts (shopper-ordering · board O1, P1–P3, D4, O6): the bag icon with its count,
 * colour and size choices, the product pop-up, the size sheet, the sticky bar, price rows.
 *
 * Prices on these parts always come from the server's answer (R5); the phone only shows them.
 *
 * shopper-walk-fixes (board S3–S7, V2, G1–G2) adds: the bag icon over a video or a photo, the
 * listing's details block, the second after Add to bag (one vibration, "Go to bag ›", then back
 * where she was), and which deals stay whole in the bag.
 *
 * shopper-app-fixes (F6, F9, F10) adds: `isSoldOut` and "Sold out in every size"; `priceFor` — the
 * chosen size's price, as the server sends it per size; the bag icon's count read when the app
 * opens, without the "just added" mark; an add that fails is said in the size sheet.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, Image, Modal, ScrollView, Pressable, StyleSheet, Dimensions, Linking, Vibration, ActivityIndicator,
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

const MARK_MS = 2500;      // how long the icon stays marked after the count went up (S6)

/**
 * The bag icon with its count, on every page she browses. In a top bar it is as it always was;
 * `overlay` puts it on a picture: 'dark' over a video (Play, V2), 'light' over a product photo (S3).
 * When the count goes up the icon is marked for a moment (S6), so she sees where her item went
 * on the page she is returned to.
 */
export function BagButton({ dark, overlay, style }) {
  const nav = useNavSafe();
  const [n, setN] = useState(0);
  const [up, setUp] = useState(false);
  const last = useRef(null);
  const timer = useRef(null);
  useEffect(() => {
    // `how.quiet`: the count was only read (the app just opened, F9) — a number, not "just added".
    const off = subscribeBagCount((v, how) => {
      if (!(how && how.quiet) && last.current !== null && v > last.current) {
        setUp(true);
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => { timer.current = null; setUp(false); }, MARK_MS);
      }
      last.current = v;
      setN(v);
    });
    return () => { off(); if (timer.current) clearTimeout(timer.current); timer.current = null; };
  }, []);
  const onDark = !!dark || overlay === 'dark';
  return (
    <TouchableOpacity onPress={() => nav && nav.navigate('Bag')} accessibilityLabel={`Bag, ${n} items`} testID="open-bag"
      style={[b.ic, dark && b.icDark, overlay === 'dark' && b.icOnVideo, overlay === 'light' && b.icOnPhoto, up && (onDark ? b.icUpDark : b.icUp), style]}>
      <Icon name="shopping-outline" size={19} color={onDark ? '#fff' : K.ink} />
      {n > 0 ? (
        <View style={[b.badge, overlay && b.badgeOver]}>
          <Text style={[b.badgeText, overlay && b.badgeOverText]} testID="bag-count">{n > 99 ? '99' : n}</Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

/* ───────────────────────────────────────────── the second after Add to bag (S5, S6, S7) */

export const ADDED_MS = 1100;

/**
 * Add to bag worked: one short vibration, and for about a second the main button is a black
 * "Go to bag ›". If she does nothing, `onReturn` runs — it closes what was opened for the add, so
 * she is exactly where she was. The timer never outlives the screen.
 *
 *   start()  the add succeeded            stop()   she chose something else; no return
 *   reset()  back to "Add to bag"
 */
export function useAdded(onReturn) {
  const [added, setAdded] = useState(false);
  const timer = useRef(null);
  const then = useRef(onReturn);
  then.current = onReturn;
  const stop = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }, []);
  useEffect(() => stop, [stop]);
  const start = useCallback(() => {
    try { Vibration.vibrate(40); } catch { /* no motor, or not allowed: the words still say it */ }
    setAdded(true);
    stop();
    timer.current = setTimeout(() => { timer.current = null; if (then.current) then.current(); }, ADDED_MS);
  }, [stop]);
  const reset = useCallback(() => { stop(); setAdded(false); }, [stop]);
  return { added, start, stop, reset };
}

/** "✓ Added to your bag", with the mark that says the phone just buzzed. */
export function AddedLine({ testID = 'added-line' }) {
  return (
    <View style={b.buzz} testID={testID}>
      <Icon name="vibrate" size={15} color={K.ink2} />
      <Text style={b.buzzText}>{CO.addedLine}</Text>
    </View>
  );
}

/**
 * The main button of an add. For the second after it worked it is a black "Go to bag ›"
 * (black = done, the mono rule); otherwise the yellow "Add to bag".
 */
export function AddToBagButton({ added, disabled, label = CO.addToBag, onAdd, onGoToBag, testID = 'add-to-bag', style }) {
  if (added) {
    return (
      <TouchableOpacity onPress={onGoToBag} style={[b.primary, b.go, style]} testID={`${testID}-go`} accessibilityRole="button">
        <Text style={[b.primaryText, b.goText]}>{CO.goToBagNow}</Text>
      </TouchableOpacity>
    );
  }
  return (
    <TouchableOpacity disabled={disabled} onPress={onAdd} style={[b.primary, style, disabled && b.primaryDis]} testID={testID}
      accessibilityRole="button" accessibilityState={{ disabled: !!disabled }}>
      <Text style={[b.primaryText, disabled && { color: T.disabledText }]}>{label}</Text>
    </TouchableOpacity>
  );
}

/** Closes the pages that were opened for an add, however many (the review and its deal page: 2). */
export function closePages(navigation, count = 1) {
  if (!navigation) return;
  if (typeof navigation.pop === 'function') { navigation.pop(count); return; }
  for (let i = 0; i < count; i += 1) navigation.goBack();
}

/** False only when this screen is known to be behind another one (she went elsewhere meanwhile). */
export const inFront = (navigation) => !(navigation && typeof navigation.isFocused === 'function' && !navigation.isFocused());

/* ───────────────────────────────────────────── deals that stay whole in the bag (G1, G2) */

/**
 * A deal made of fixed pieces: the set, the bundle (pick any, mix & match), buy one get one. In
 * the bag it is one group — no − 1 +, no single Remove — and it changes only through Edit deal.
 * A plain discount, buy more save more, spend or buy for a gift, and no offer, are not locked.
 */
export const LOCKED_DEALS = ['fixed', 'pick_any', 'mix_match', 'bogo'];
export const isLockedDeal = (offer) => !!offer && LOCKED_DEALS.includes(offer.sub_type);

/* ───────────────────────────────────────────── colour and size */

/** The colours and sizes of a product from the deal page's data: [{ colour, sizes:[{ size, price, shopper_price, left, sold_out }] }]. */
export function hasChoices(product) {
  return !!(product && Array.isArray(product.colours) && product.colours.some((c) => (c.sizes || []).length));
}

/**
 * Nothing of this product can be bought (shopper-app-fixes · F6): the deal data says so
 * (`sold_out`), or every size of every colour has sold out.
 */
export function isSoldOut(product) {
  if (!product) return false;
  if (product.sold_out) return true;
  const withSizes = (product.colours || []).filter((c) => (c.sizes || []).length);
  return withSizes.length > 0 && withSizes.every((c) => c.sizes.every((s) => !!s.sold_out));
}

/** The size she has chosen, as the deal data sends it ({ size, price, shopper_price, left, sold_out }), or null. */
export function chosenSize(product, sel) {
  if (!product || !sel || !sel.size) return null;
  const withSizes = (product.colours || []).filter((c) => (c.sizes || []).length);
  const colour = sel.colour != null ? sel.colour : (withSizes[0] ? withSizes[0].colour : null);
  const row = withSizes.find((c) => (c.colour || null) === (colour || null)) || withSizes[0];
  return (row && row.sizes.find((s) => s.size === sel.size)) || null;
}

/**
 * The price to show for a product once a size is chosen (shopper-app-fixes · F10). A size can have
 * its own price; the server sends, per size, `price` and `shopper_price` (what she pays for THAT
 * size, after the offer). Nothing is worked out here — the numbers are the server's:
 *
 *   pays     what she pays: the chosen size's `shopper_price`; before a size is chosen (or from a
 *            server that sends none per size) the product's own
 *   normal   the price to strike through when `pays` is lower
 *   seen     what to send as `price_seen` with a bag line or Buy now: the chosen size's `price`
 *            (the product's own when no size is chosen) — so the bag never says a false
 *            "Price changed from ₹…"
 */
export function priceFor(product, sel) {
  if (!product) return { pays: null, normal: null, seen: null };
  const own = product.shopper_price != null ? product.shopper_price : product.price;
  const s = chosenSize(product, sel);
  const seen = s && s.price != null ? Number(s.price) : product.price;
  if (s && s.shopper_price != null) return { pays: Number(s.shopper_price), normal: s.price != null ? Number(s.price) : Number(s.shopper_price), seen };
  return { pays: own, normal: product.price, seen };
}

export function ChoicePicker({ product, value, onChange, testIDPrefix = 'pick' }) {
  const colours = (product && product.colours) || [];
  const withSizes = colours.filter((c) => (c.sizes || []).length);
  const colour = value.colour != null ? value.colour : (withSizes[0] ? withSizes[0].colour : null);
  const row = withSizes.find((c) => (c.colour || null) === (colour || null)) || withSizes[0];
  if (!withSizes.length) return null;
  const allGone = isSoldOut(product);
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
      {/* F6: every size crossed out used to be all it said. */}
      {allGone ? <Text style={b.allGone} testID={`${testIDPrefix}-sold-out`}>{CO.soldOutEverySize}</Text> : null}
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

/**
 * A product's photos, to swipe. In a pop-up they are a rounded card with the count top-left when
 * there is more than one; `page` is the product page's gallery (S3): edge to edge, the count
 * bottom-right, always shown ("1 / 1").
 */
export function Photos({ images, height = 260, width = W - 28, page = false, testID = 'photos' }) {
  const list = (images || []).filter(Boolean);
  const [i, setI] = useState(0);
  const first = list[0] || null;
  useEffect(() => { setI(0); }, [first, list.length]);     // another colour's photos start at the first
  if (!list.length) return <View style={[b.photo, page && b.photoPage, { width, height }]} testID={`${testID}-none`} />;
  const at = Math.min(i, list.length - 1);
  return (
    <View testID={testID}>
      <ScrollView key={`${first}-${list.length}`} horizontal pagingEnabled showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => setI(Math.round(e.nativeEvent.contentOffset.x / width))} testID={`${testID}-swipe`}>
        {list.map((u, k) => <Image key={`${u}-${k}`} source={{ uri: u }} style={[b.photo, page && b.photoPage, { width, height }]} resizeMode="cover" testID={`${testID}-${k}`} />)}
      </ScrollView>
      {list.length > 1 || page ? (
        <View style={[b.pager, page ? b.pagerPage : b.pagerCard]}><Text style={b.pagerText} testID={`${testID}-count`}>{CO.photoCount(at + 1, list.length)}</Text></View>
      ) : null}
    </View>
  );
}

/* ───────────────────────────────────────────── the listing's details (S3, S4) */

const said = (v) => (v == null ? '' : String(v).trim());

/**
 * What the brand entered when listing the product, in one fixed order: Brand, Category, then every
 * detail the server sends (already ordered), then Returns — INFLX's one rule. A row with nothing
 * to say is left out. Nothing is invented: no rating, no reviews, no MRP, no tax line.
 */
export function detailRows(product, returnsLine) {
  const specs = product && Array.isArray(product.specs) ? product.specs : [];
  return [
    { key: 'brand', label: CO.brandRow, value: product ? product.brand_label : null },
    { key: 'category', label: CO.categoryRow, value: product ? product.category_path : null },
    ...specs.map((x, k) => ({ key: `spec-${k}`, label: x && x.label, value: x && x.value })),
    { key: 'returns', label: CO.returnsRow, value: returnsLine },
  ].map((r) => ({ key: r.key, label: said(r.label), value: said(r.value) })).filter((r) => r.label && r.value);
}

/** "Product details" (the rows above) and "Description". Either heading shows only with something under it. */
export function ProductDetails({ product, returnsLine, testID = 'details' }) {
  const rows = detailRows(product, returnsLine);
  const about = said(product && product.details);
  if (!rows.length && !about) return null;
  return (
    <View testID={testID}>
      {rows.length ? (
        <>
          <Text style={b.sech}>{CO.productDetails}</Text>
          {rows.map((r) => (
            <View key={r.key} style={b.kv} testID={`${testID}-row-${r.key}`}>
              <Text style={b.kvLabel}>{r.label}</Text>
              <Text style={b.kvValue}>{r.value}</Text>
            </View>
          ))}
        </>
      ) : null}
      {about ? (
        <>
          <Text style={b.sech}>{CO.description}</Text>
          <Text style={b.desc} testID={`${testID}-description`}>{about}</Text>
        </>
      ) : null}
    </View>
  );
}

/**
 * The product pop-up (P2, V2, K2, K5, G4): photos, price, what picking it does in the deal, colours,
 * sizes with stock, size chart, details, quantity where it applies. Nothing is picked without its
 * colour and size (6.5). The details are the same block the product page shows (S4): brand,
 * category, every listed detail, returns (`returnsLine`), then the description.
 */
export function ProductPopup({ product, visible, onClose, effect, price, struck, allowQty, initial, primaryLabel, onPrimary, onRemove, header, returnsLine, testID = 'product-popup' }) {
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
  const gone = isSoldOut(product);
  const ready = (!needs || !!sel.size) && !gone;
  // F10: once a size is chosen the price is that size's. A price the caller fixes (a gift, the
  // free one of a pair: ₹0) stays as given.
  const pf = priceFor(product, sel);
  const shown = price != null ? price : pf.pays;
  const strike = price != null ? struck : (struck || (Number(pf.pays) < Number(pf.normal) ? pf.normal : null));
  return (
    <Sheet visible={visible} onClose={onClose} testID={testID} tall>
      <ScrollView style={{ maxHeight: 600 }} contentContainerStyle={{ paddingBottom: 8 }}>
        {header}
        <Photos images={images} />
        <View style={[b.rowBetween, { marginTop: 10 }]}>
          <Text style={b.pname} numberOfLines={2}>{product.name}</Text>
          <Text style={b.price} testID={`${testID}-price`}>{inr(shown)}
            {strike ? <Text style={b.struck}>  {inr(strike)}</Text> : null}</Text>
        </View>
        {effect ? <View style={b.effect}><Text style={b.effectText}>{effect}</Text></View> : null}
        <ChoicePicker product={product} value={sel} onChange={setSel} testIDPrefix={testID} />
        <ProductDetails product={product} returnsLine={returnsLine} testID={`${testID}-details`} />
        {allowQty ? (
          <View style={[b.rowBetween, { marginTop: 12 }]}>
            <Text style={b.lab}>{CO.quantity}</Text>
            <QtyStepper value={qty} onChange={setQty} testID={`${testID}-qty`} />
          </View>
        ) : null}
      </ScrollView>
      <TouchableOpacity disabled={!ready} onPress={() => onPrimary({ colour: needs ? (sel.colour || firstColour(product)) : null, size: sel.size, qty })}
        style={[b.primary, !ready && b.primaryDis]} testID={`${testID}-primary`} accessibilityState={{ disabled: !ready }}>
        <Text style={[b.primaryText, !ready && { color: T.disabledText }]}>{ready ? primaryLabel(sel) : gone ? CO.soldOut : CO.chooseSize}</Text>
      </TouchableOpacity>
      {onRemove ? <Text style={b.remove} onPress={onRemove} testID={`${testID}-remove`}>{CO.remove}</Text> : null}
    </Sheet>
  );
}

export function firstColour(product) {
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

/**
 * The quick add (the bag icon on a product). `added` is the second after Add to bag worked (S5):
 * the green line, and the main button a black "Go to bag ›" that opens the bag (`onGoToBag`).
 * The sizes come with the deal data: while they are on their way (`waiting`), or could not be
 * fetched (`problem`), nothing can be added — a product is never put in the bag without its size.
 *
 * shopper-app-fixes:
 *   F6   a product sold out in every size says so, and Add / Buy now stay off
 *   F10  choosing a size shows that size's price; what the sheet hands to `onAdd` / `onBuyNow` is
 *        { colour, size, price_seen } — `price_seen` is the chosen size's own price
 *   F9   an add that fails (her bag could not be read or saved: `onAdd` rejects) is said here, in
 *        the sheet, and nothing was added
 *
 * shopper-deal-orders (board B4): on an offer post whose products can be bought alone, the sheet
 * adds this one product at its normal price. `offerLink` = { text, onPress } is then the line under
 * the buttons ("Or get it in the offer: Any 3 for ₹2,999 ›"), and the top says only whose post it
 * is — the offer's own line is not put next to a price the offer has not touched.
 */
export function SizeSheet({ post, product, visible, onClose, onAdd, onBuyNow, busy: working, waiting = false, problem = null, added = false, onGoToBag, offerLink = null }) {
  const [sel, setSel] = useState({ colour: null, size: null });
  const [failed, setFailed] = useState(null);
  useEffect(() => { if (visible) { setSel({ colour: null, size: null }); setFailed(null); } }, [visible, product && product.id]);
  if (!product) return null;
  const gone = isSoldOut(product);
  const busy = !!working || waiting || !!problem || gone;
  const needs = hasChoices(product);
  const ready = !needs || !!sel.size;
  const pf = priceFor(product, sel);
  const pick = () => ({ colour: needs ? (sel.colour || firstColour(product)) : null, size: sel.size, price_seen: pf.seen });
  async function add() {
    setFailed(null);
    try { await onAdd(pick()); } catch (e) { setFailed((e && e.message) || CO.bagNotSaved); }
  }
  return (
    <Sheet visible={visible} onClose={onClose} testID="size-sheet">
      <View style={{ flexDirection: 'row', gap: 12, marginBottom: 10 }}>
        {product.image_url ? <Image source={{ uri: product.image_url }} style={b.thumb} /> : <View style={b.thumb} />}
        <View style={{ flex: 1 }}>
          <Text style={b.pname} numberOfLines={2}>{product.name}</Text>
          <Text style={b.price} testID="size-sheet-price">{inr(pf.pays)}{Number(pf.pays) < Number(pf.normal) ? <Text style={b.struck}>  {inr(pf.normal)}</Text> : null}</Text>
          {offerLink ? (post && post.creator ? <Text style={b.fromLine} testID="size-sheet-from">{CO.fromPost(post.creator.name.split(' ')[0])}</Text> : null)
            : post && post.offer && post.offer.line ? <Text style={b.okLine}>{post.offer.line}{post.creator ? ` · from ${post.creator.name.split(' ')[0]}'s post` : ''}</Text> : null}
        </View>
      </View>
      <ChoicePicker product={product} value={sel} onChange={(v) => { setSel(v); setFailed(null); }} testIDPrefix="size-sheet" />
      {waiting ? <ActivityIndicator color={K.ink} style={{ marginTop: 12 }} testID="size-sheet-waiting" /> : null}
      {problem ? <Text style={b.problem} testID="size-sheet-problem">{problem}</Text> : null}
      {failed ? <Text style={b.problem} testID="size-sheet-failed">{failed}</Text> : null}
      {added ? <View style={{ marginTop: 12 }}><AddedLine /></View> : null}
      <View style={{ flexDirection: 'row', gap: 10, marginTop: added ? 8 : 14 }}>
        <TouchableOpacity disabled={!ready || busy} onPress={() => onBuyNow(pick())} style={[b.secondary, { flex: 1 }, (!ready || busy) && b.primaryDis]} testID="size-sheet-buy"
          accessibilityState={{ disabled: !ready || busy }}>
          <Text style={b.secondaryText}>{CO.buyNow}</Text>
        </TouchableOpacity>
        <AddToBagButton added={added} disabled={!ready || busy} label={gone ? CO.soldOut : ready ? CO.addToBag : CO.chooseSize}
          onAdd={add} onGoToBag={onGoToBag} testID="size-sheet-add" style={{ flex: 1, marginTop: 0 }} />
      </View>
      {offerLink && offerLink.text ? (
        <TouchableOpacity onPress={offerLink.onPress} style={{ marginTop: 12 }} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }} testID="size-sheet-offer" accessibilityRole="button">
          <Text style={b.offerLink}>{offerLink.text}</Text>
        </TouchableOpacity>
      ) : null}
    </Sheet>
  );
}

export const b = StyleSheet.create({
  ic: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F4F3EE', marginLeft: 6 },
  icDark: { backgroundColor: '#222' },
  // Over a video (Play, beside the sound button) and over a product photo (the product page).
  icOnVideo: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.45)', marginLeft: 0 },
  icOnPhoto: { backgroundColor: 'rgba(255,255,255,0.96)', marginLeft: 0 },
  // The count just went up (S6): a ring for a moment.
  icUp: { borderWidth: 1.5, borderColor: K.ink },
  icUpDark: { borderWidth: 1.5, borderColor: T.primary },
  badge: { position: 'absolute', top: -3, right: -3, minWidth: 17, height: 17, borderRadius: 9, backgroundColor: K.ink, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  badgeText: { fontFamily: fonts.sansBold, fontSize: 9.5, color: '#fff' },
  // On a picture the count is the board's yellow with dark figures: a black one is lost on a video.
  badgeOver: { backgroundColor: T.primary },
  badgeOverText: { color: T.onPrimary },
  buzz: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  buzzText: { fontFamily: fonts.sansBold, fontSize: 12, color: K.ok },
  go: { backgroundColor: K.ink },
  goText: { color: '#fff' },
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
  allGone: { fontFamily: fonts.sansBold, fontSize: 12, color: T.danger, marginTop: 8 },
  step: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: K.border, borderRadius: 10 },
  stepBtn: { width: 34, height: 32, alignItems: 'center', justifyContent: 'center' },
  stepSign: { fontFamily: fonts.sansBold, fontSize: 16, color: K.ink },
  stepVal: { fontFamily: fonts.sansBold, fontSize: 13.5, color: K.ink, minWidth: 18, textAlign: 'center' },
  dim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 14, paddingBottom: 22, maxHeight: '88%' },
  grab: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: '#DDDCD5', marginBottom: 10 },
  photo: { width: '100%', borderRadius: 14, backgroundColor: '#EDECE6' },
  photoPage: { borderRadius: 0 },
  pager: { position: 'absolute', backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3 },
  pagerCard: { top: 10, left: 10 },
  pagerPage: { bottom: 10, right: 10 },
  pagerText: { fontFamily: fonts.sansBold, fontSize: 10.5, color: '#fff' },
  sech: { fontFamily: fonts.sansBold, fontSize: 13.5, color: K.ink, marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: K.border, marginBottom: 8 },
  kv: { flexDirection: 'row', gap: 10, paddingVertical: 3 },
  kvLabel: { width: 92, fontFamily: fonts.sansRegular, fontSize: 12.5, color: K.ink2 },
  kvValue: { flex: 1, fontFamily: fonts.sansSemiBold, fontSize: 12.5, color: K.ink },
  desc: { fontFamily: fonts.sansRegular, fontSize: 12.5, color: K.ink2, lineHeight: 19 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  pname: { fontFamily: fonts.sansBold, fontSize: 15, color: K.ink, flexShrink: 1 },
  price: { fontFamily: fonts.sansBold, fontSize: 15, color: K.ink },
  struck: { fontFamily: fonts.sansRegular, fontSize: 12, color: K.ink3, textDecorationLine: 'line-through' },
  effect: { backgroundColor: K.warnSoft, borderRadius: 10, padding: 9, marginTop: 8 },
  effectText: { fontFamily: fonts.sansBold, fontSize: 12, color: K.warn },
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
  fromLine: { fontFamily: fonts.sansRegular, fontSize: 11.5, color: K.ink2, marginTop: 4 },
  offerLink: { fontFamily: fonts.sansBold, fontSize: 12.5, color: K.ink, textDecorationLine: 'underline' },
});
