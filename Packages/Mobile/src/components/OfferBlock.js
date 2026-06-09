import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { creatorVibe as C, fonts, fmtRupees } from '../theme/tokens';
import { offerKind, offerMeta, bundleSavings } from '../utils/offerMechanics';

/**
 * OfferBlock — product-page UI for an offer, type-specific, from the locked
 * mockup (features/follower-offer-mechanics/04-preview). Renders nothing for a
 * plain/absent offer. The SERVER prices authoritatively (resolveOfferDiscount);
 * this is presentation + the honest in-store/online note.
 *
 * Props: offer = { offer_type, discount:{kind,value,label}, config:{...}, availing_modes }
 */
export default function OfferBlock({ offer }) {
  if (!offer || !offer.offer_type) return null;
  const kind = offerKind(offer.offer_type);
  const meta = offerMeta(offer.offer_type);
  if (!meta) return null;
  const cfg = offer.config || {};
  const tint = TINT[kind] || TINT.discount;

  let title = meta.label;
  let sub = '';
  let body = null;

  if (kind === 'discount') {
    const d = offer.discount || {};
    title = d.label || (d.kind === 'flat' ? 'Flat off' : 'Discount');
    sub = 'Works in-store and online';
    body = (
      <Note tone={C.verify} text="Simple discounts need no cart — they also apply to a walk-in pay-at-store bill." />
    );
  } else if (kind === 'volume') {
    title = 'Buy more, save more';
    sub = 'Discount grows with your cart total';
    const tiers = Array.isArray(cfg.tiers) ? cfg.tiers : [];
    body = (
      <View>
        {tiers.map((t, i) => (
          <View key={i} style={[s.tier, i === 0 && { marginTop: 8 }]}>
            <View style={s.tk}><Text style={s.tkTxt}>{i + 1}</Text></View>
            <Text style={s.tt}>Spend {fmtRupees(t.min_spend)}</Text>
            <Text style={s.tp}>{t.pct_off}% off</Text>
          </View>
        ))}
        {tiers.length === 0 ? <Text style={s.muted}>Tiered discount applied at checkout.</Text> : null}
        <Note tone={C.star} text="Your tier is applied automatically at checkout, based on your cart total." />
      </View>
    );
  } else if (kind === 'bogo') {
    title = 'Buy 1, Get 1 Free';
    sub = "We'll add the free one for you";
    const buy = cfg.buy_product, get = cfg.get_product;
    body = (
      <View>
        <View style={s.pair}>
          <Item emoji="🛍️" name={buy?.name || 'This item'} price={buy?.price} label="you buy" />
          <Text style={s.arrow}>→</Text>
          <Item emoji="🎁" name={get?.name || 'Free item'} free />
        </View>
        <Note tone={C.brown} text="Tap the deal and the free item is added to your cart at ₹0 — quantity matched." />
      </View>
    );
  } else if (kind === 'bundle') {
    title = 'Bundle & save';
    sub = 'Get the set together for one price';
    const prods = Array.isArray(cfg.products) ? cfg.products : [];
    const sv = bundleSavings(cfg);
    body = (
      <View>
        {prods.map((p, i) => (
          <View key={i} style={[s.bitem, i === prods.length - 1 && { borderBottomWidth: 0 }]}>
            <Text style={s.be}>📦</Text>
            <Text style={s.bn} numberOfLines={1}>{p.name || 'Bundle item'}</Text>
            {p.price != null ? <Text style={s.bp}>{fmtRupees(p.price)}</Text> : null}
          </View>
        ))}
        {cfg.bundle_price != null ? (
          <View style={s.bsum}>
            <Text style={s.bl}>Bundle price</Text>
            <View style={s.bv}>
              <Text style={s.bnow}>{fmtRupees(cfg.bundle_price)}</Text>
              {sv ? <Text style={s.bwas}>{fmtRupees(sv.sum)}</Text> : null}
            </View>
          </View>
        ) : null}
        <Note tone="#6D4EA3" text={sv
          ? `Save ${fmtRupees(sv.save)} — applies only when the full set is in your cart.`
          : 'The bundle price applies only when the full set is in your cart.'} />
      </View>
    );
  } else if (kind === 'free_gift') {
    title = 'Free gift with this item';
    sub = 'Added automatically when you buy';
    const pair = Array.isArray(cfg.offers) ? cfg.offers[0] : null;
    body = (
      <View>
        <View style={s.pair}>
          <Item emoji="🛍️" name={pair?.main?.name || 'This item'} price={pair?.main?.price} label="you buy" />
          <Text style={s.arrow}>+</Text>
          <Item emoji="🎀" name={pair?.gift?.name || 'Free gift'} free />
        </View>
        <Note tone={C.green || '#3F8A57'} text="The gift is added to your cart at ₹0 — you're never charged for it." />
      </View>
    );
  }

  return (
    <View style={[s.block, { borderColor: tint.border, backgroundColor: tint.bg }]}>
      <View style={s.head}>
        <View style={[s.ic, { backgroundColor: meta.color }]}><Text style={s.icTxt}>{meta.icon}</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>{title}</Text>
          {sub ? <Text style={s.sub}>{sub}</Text> : null}
        </View>
        {!meta.anyBill ? <Text style={s.flag}>in-store or online</Text> : null}
      </View>
      {body ? <View style={s.body}>{body}</View> : null}
    </View>
  );
}

function Item({ emoji, name, price, label, free }) {
  return (
    <View style={s.item}>
      <Text style={s.itemEmoji}>{emoji}</Text>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={s.itemName} numberOfLines={1}>{name}</Text>
        {free
          ? <Text style={s.itemFree}>₹0 · free</Text>
          : <Text style={s.itemPrice}>{price != null ? `${fmtRupees(price)} · ` : ''}{label || ''}</Text>}
      </View>
      {free ? <View style={s.freeChip}><Text style={s.freeChipTxt}>FREE</Text></View> : null}
    </View>
  );
}

function Note({ tone, text }) {
  return (
    <View style={s.note}>
      <Text style={[s.noteDot, { color: tone }]}>●</Text>
      <Text style={s.noteTxt}>{text}</Text>
    </View>
  );
}

const TINT = {
  discount:  { border: 'rgba(217,83,30,0.4)',  bg: 'rgba(217,83,30,0.05)' },
  volume:    { border: 'rgba(185,138,46,0.45)', bg: 'rgba(185,138,46,0.06)' },
  bogo:      { border: 'rgba(139,74,47,0.4)',  bg: 'rgba(139,74,47,0.05)' },
  bundle:    { border: 'rgba(109,78,163,0.4)', bg: 'rgba(109,78,163,0.05)' },
  free_gift: { border: 'rgba(63,138,87,0.42)', bg: 'rgba(63,138,87,0.05)' },
};

const s = StyleSheet.create({
  block: { borderRadius: 16, borderWidth: 1.5, overflow: 'hidden', marginTop: 16 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 9, padding: 12 },
  ic: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  icTxt: { fontSize: 15, color: '#fff' },
  title: { fontSize: 13, fontWeight: '800', color: C.ink, fontFamily: fonts.displayBold },
  sub: { fontSize: 10, color: C.muted, fontWeight: '600', marginTop: 1, fontFamily: fonts.sansMedium },
  flag: { fontSize: 8.5, fontWeight: '800', color: C.muted, fontFamily: fonts.sansBold },
  body: { paddingHorizontal: 12, paddingBottom: 12 },

  tier: { flexDirection: 'row', alignItems: 'center', gap: 9, padding: 8, borderRadius: 11, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, marginTop: 7 },
  tk: { width: 18, height: 18, borderRadius: 9, backgroundColor: '#B98A2E', alignItems: 'center', justifyContent: 'center' },
  tkTxt: { fontSize: 9, fontWeight: '800', color: '#fff' },
  tt: { fontSize: 11, fontWeight: '700', color: C.ink, flex: 1, fontFamily: fonts.sansBold },
  tp: { fontSize: 12, fontWeight: '800', color: '#B98A2E', fontFamily: fonts.displayBold },
  muted: { fontSize: 11, color: C.muted, marginTop: 8, fontFamily: fonts.sansMedium },

  pair: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 9 },
  arrow: { fontSize: 16, fontWeight: '800', color: C.muted },
  item: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 11, padding: 8 },
  itemEmoji: { fontSize: 19 },
  itemName: { fontSize: 10.5, fontWeight: '800', color: C.ink, fontFamily: fonts.displayBold },
  itemPrice: { fontSize: 9.5, fontWeight: '700', color: C.muted, marginTop: 1, fontFamily: fonts.sansMedium },
  itemFree: { fontSize: 9.5, fontWeight: '800', color: '#3F8A57', marginTop: 1, fontFamily: fonts.sansBold },
  freeChip: { backgroundColor: '#3F8A57', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  freeChipTxt: { fontSize: 8, fontWeight: '800', color: '#fff', fontFamily: fonts.sansBold },

  bitem: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: C.line, borderStyle: 'dashed' },
  be: { fontSize: 17 },
  bn: { fontSize: 11, fontWeight: '700', color: C.ink, flex: 1, fontFamily: fonts.sansBold },
  bp: { fontSize: 11, fontWeight: '700', color: C.muted, fontFamily: fonts.monoMedium },
  bsum: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 9, paddingTop: 10, borderTopWidth: 1.5, borderTopColor: C.line },
  bl: { fontSize: 11, fontWeight: '700', color: C.muted, fontFamily: fonts.sansBold },
  bv: { flexDirection: 'row', alignItems: 'baseline', gap: 7 },
  bnow: { fontSize: 17, fontWeight: '800', color: '#6D4EA3', fontFamily: fonts.displayBold },
  bwas: { fontSize: 12, color: C.muted, textDecorationLine: 'line-through', fontFamily: fonts.monoMedium },

  note: { flexDirection: 'row', gap: 6, alignItems: 'flex-start', marginTop: 9 },
  noteDot: { fontSize: 9, marginTop: 1 },
  noteTxt: { flex: 1, fontSize: 9.5, fontWeight: '600', color: '#6a5a47', lineHeight: 13.5, fontFamily: fonts.sansMedium },
});
