/**
 * The deal page (shopper-ordering · board D1, P1–P3, B1–B4, V1–V4, K1–K5, G1–G5 · rules 6.5).
 * A deal is never built in a small pop-up: every product of the post in a grid, the deal at the
 * top, and one product pop-up per pick (photos, colours, sizes with stock, details) → Pick → the
 * pop-up closes → the card shows it picked → the next product. Every price on it comes from the
 * server (POST /follower/posts/:id/deal/price), the same engine that charges at Place order.
 *
 * shopper-walk-fixes: the bag icon with its count is in the top bar (O6), and the product pop-up
 * shows the listing's details as the product page does — brand, category, every listed detail,
 * returns, then the description (O3, board S4).
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, Image, ScrollView, StyleSheet, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { followerApi } from '../../../services/api';
import { TopBar, Loading, Empty, Chip } from '../../../components/shop/bitsShop';
import { ProductPopup, StickyBar, BagButton, K } from '../../../components/shop/orderBits';
import { CO, dayLabel } from '../../../components/shop/copyOrder';
import { CS, inr } from '../../../components/shop/copyShop';
import { fonts } from '../../../theme/tokens';

const W = Dimensions.get('window').width;
const CARD = (W - 14 * 2 - 10) / 2;
let seq = 0;
const newRef = () => `d${Date.now().toString(36)}${(seq += 1)}`;
const firstSize = (p) => {
  for (const c of p.colours || []) for (const s of c.sizes || []) if (!s.sold_out) return { colour: c.colour, size: s.size };
  return { colour: null, size: null };
};

/**
 * A BOGO deal coming back from the bag (Edit deal): the bag keeps quantities, the page keeps pairs.
 * Each free unit is paired with a paid unit of the same product; lines of other deals pass through.
 */
function withPairs(lines) {
  if (!lines.some((l) => l.role === 'free')) return lines;
  const units = lines.flatMap((l) => Array.from({ length: l.qty || 1 }).map((_, i) => ({ ...l, qty: 1, ref: `${l.ref}-${i}` })));
  const out = units.filter((u) => u.role !== 'buy' && u.role !== 'free');
  const paid = units.filter((u) => u.role === 'buy');
  for (const f of units.filter((u) => u.role === 'free')) {
    const i = paid.findIndex((p) => p.product_id === f.product_id);
    if (i < 0) continue;
    const pair = newRef();
    out.push({ ...paid[i], pair, ref: `${pair}a` }, { ...f, pair, ref: `${pair}b` });
    paid.splice(i, 1);
  }
  return [...out, ...paid];
}

export default function DealScreen({ navigation, route }) {
  const { postId, start = null, lines: fromBag = null, editing = false } = route.params || {};
  const [data, setData] = useState(null);
  const [status, setStatus] = useState('loading');
  const [picks, setPicks] = useState(() => withPairs((fromBag || []).map((l) => ({ ...l, ref: l.ref || newRef() }))));
  const [priced, setPriced] = useState(null);
  const [popup, setPopup] = useState(null);       // { product, mode, ref, part, paid, gift }
  const [preview, setPreview] = useState(null);   // what picking it would do (V2, K2)
  const [step, setStep] = useState('buy');        // free gift: 'buy' | 'gift'
  const [cat, setCat] = useState(null);
  const [sort, setSort] = useState(null);
  const pricing = useRef(0);

  const sub = data && data.offer ? data.offer.sub_type : null;
  const cfg = (data && data.offer && data.offer.config) || {};

  useEffect(() => {
    (async () => {
      const r = await followerApi.deal(postId);
      if (!r || !r.success) { setStatus('error'); return; }
      setData(r.data); setStatus('ready');
      if (start) {
        const p = r.data.products.find((x) => x.id === start);
        if (p) setTimeout(() => openProduct(p, r.data), 250);
      }
    })();
  }, [postId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Every change is priced by the server (R5).
  useEffect(() => {
    if (!data) return;
    const n = (pricing.current += 1);
    (async () => {
      const r = await followerApi.dealPrice(postId, picks.map(({ ref, product_id, gift_item_id, colour, size, qty, role }) => ({ ref, product_id, gift_item_id, colour, size, qty, role })));
      if (n !== pricing.current) return;
      setPriced(r && r.success && r.data.groups[0] ? r.data.groups[0] : null);
    })();
  }, [picks, data, postId]);

  const effectFor = useCallback(async (product) => {
    setPreview(null);
    const one = { ref: 'preview', product_id: product.id, ...firstSize(product), qty: 1, role: 'buy' };
    const r = await followerApi.dealPrice(postId, [...picks, one]);
    const g = r && r.success ? r.data.groups[0] : null;
    if (!g) return;
    const mine = g.lines.find((l) => l.ref === 'preview');
    const bits = [g.progress && g.progress.text, mine && mine.paid_total !== mine.normal_total ? `this one ${inr(mine.paid_total)}` : null].filter(Boolean);
    setPreview(bits.join(' · '));
  }, [picks, postId]);

  function openProduct(product, d = data) {
    const s2 = d && d.offer ? d.offer.sub_type : null;
    const existing = picks.find((l) => l.product_id === product.id && l.role !== 'gift' && l.role !== 'free');
    if (s2 === 'bogo') { setPopup({ product, mode: 'bogo', part: 1 }); return; }
    setPopup({ product, mode: s2 === 'fixed' ? 'fixed' : 'pick', ref: existing ? existing.ref : null, initial: existing || null });
    if (s2 !== 'fixed') effectFor(product);
  }
  function openGift(g) {
    if (g.all_given) return;
    const product = { id: g.id, name: g.name, price: 0, shopper_price: 0, images: g.images, colours: g.colours, details: null };
    const existing = picks.find((l) => l.role === 'gift' && (l.gift_item_id === g.id || l.product_id === g.id));
    setPopup({ product, gift: g, mode: 'gift', ref: existing ? existing.ref : null, initial: existing || null });
  }

  function primary(sel) {
    const p = popup.product;
    if (popup.mode === 'bogo' && popup.part === 1) { setPopup({ ...popup, part: 2, paid: sel }); return; }
    if (popup.mode === 'bogo') {
      const pair = newRef();
      setPicks((xs) => [...xs,
        { ref: `${pair}a`, pair, post_id: postId, product_id: p.id, colour: popup.paid.colour, size: popup.paid.size, qty: 1, role: 'buy' },
        { ref: `${pair}b`, pair, post_id: postId, product_id: p.id, colour: sel.colour, size: sel.size, qty: 1, role: 'free' }]);
      setPopup(null); return;
    }
    if (popup.mode === 'gift') {
      const g = popup.gift;
      const line = { ref: popup.ref || newRef(), post_id: postId, product_id: g.kind === 'product' ? g.id : null, gift_item_id: g.kind === 'gift_item' ? g.id : null,
        colour: sel.colour, size: sel.size, qty: 1, role: 'gift' };
      setPicks((xs) => {
        let rest = xs.filter((l) => l.ref !== popup.ref);
        const gifts = rest.filter((l) => l.role === 'gift');
        const max = cfg.gift_count || 1;
        if (gifts.length >= max) rest = rest.filter((l) => l.ref !== gifts[0].ref);   // choosing another replaces the oldest
        return [...rest, line];
      });
      setPopup(null); return;
    }
    const line = { ref: popup.ref || newRef(), post_id: postId, product_id: p.id, colour: sel.colour, size: sel.size, qty: sel.qty || 1, role: 'buy' };
    setPicks((xs) => (popup.ref ? xs.map((l) => (l.ref === popup.ref ? line : l)) : [...xs, line]));
    setPopup(null);
  }
  function removePick(ref) {
    setPicks((xs) => {
      const t = xs.find((l) => l.ref === ref);
      return t && t.pair ? xs.filter((l) => l.pair !== t.pair) : xs.filter((l) => l.ref !== ref);
    });
    setPopup(null);
  }

  const products = useMemo(() => {
    if (!data) return [];
    let list = data.products.filter((p) => p.in_deal || !data.offer);
    if (cat) list = list.filter((p) => p.category && p.category.id === cat);
    if (sort) list = [...list].sort((a, b2) => (sort === 'up' ? a.shopper_price - b2.shopper_price : b2.shopper_price - a.shopper_price));
    return [...list.filter((p) => !p.sold_out), ...list.filter((p) => p.sold_out)];
  }, [data, cat, sort]);

  if (status === 'loading') return <SafeAreaView style={st.safe}><TopBar title={CO.buildDeal} onBack={() => navigation.goBack()} right={<BagButton />} /><Loading /></SafeAreaView>;
  if (status === 'error' || !data) return <SafeAreaView style={st.safe}><TopBar title={CO.buildDeal} onBack={() => navigation.goBack()} right={<BagButton />} /><Empty title={CS.loadError} /></SafeAreaView>;

  const buys = picks.filter((l) => l.role !== 'gift');
  const unitCount = buys.reduce((s, l) => s + (l.qty || 1), 0);
  const isGift = sub === 'spend' || sub === 'buy_x';
  const giftUnlocked = priced && priced.gift && priced.gift.state !== 'locked';
  const oneGift = isGift && data.gifts.length === 1;
  const nextToGift = isGift && step === 'buy' && giftUnlocked && !oneGift && !picks.some((l) => l.role === 'gift');
  const setPrice = cfg.price != null ? inr(cfg.price) : '';

  const cardState = (p) => {
    const mine = picks.filter((l) => l.product_id === p.id && l.role !== 'gift');
    if (!mine.length) return null;
    const q = mine.reduce((s, l) => s + (l.qty || 1), 0);
    return { first: mine[0], count: q };
  };

  return (
    <SafeAreaView style={st.safe} edges={['top']}>
      <TopBar title={CO.buildDeal} onBack={() => navigation.goBack()} right={<BagButton />} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 20 }} testID="deal-page">
        {/* The deal at the top */}
        <View style={st.head} testID="deal-head">
          <View style={st.rowBetween}>
            <Text style={st.headLine} numberOfLines={2}>{data.offer ? data.offer.line : CO.buildDeal}</Text>
            {data.offer && data.offer.ends_on ? <Text style={st.till}>{CO.tillDate(dayLabel(data.offer.ends_on).replace(/^\w+, /, ''))}</Text> : null}
          </View>
          <Text style={st.headSub}>{[data.post.creator && data.post.creator.name, data.post.brand && data.post.brand.name].filter(Boolean).join(' · ')}</Text>
          {data.offer && data.offer.how ? <Text style={st.how}>{data.offer.how}</Text> : null}
        </View>

        {/* Volume: the ladder (V1, V3, V4) */}
        {(sub === 'quantity' || sub === 'value') && Array.isArray(cfg.tiers) ? (
          <View style={st.ladder} testID="ladder">
            {cfg.tiers.map((t) => {
              const on = priced && priced.progress && priced.progress.tier === t.at;
              return (
                <View key={t.at} style={[st.rung, on && st.rungOn]}>
                  <Text style={[st.rungTop, on && st.rungTextOn]}>{sub === 'quantity' ? `Buy ${t.at}` : inr(t.at)}</Text>
                  <Text style={[st.rungSub, on && st.rungTextOn]}>{cfg.reward === 'amount' ? `${inr(t.value)} off` : `${t.value}% off`}</Text>
                </View>
              );
            })}
          </View>
        ) : null}

        {/* Bundle: the set's slots (K1, K3) */}
        {(sub === 'pick_any' || sub === 'mix_match') && cfg.pick ? (
          <View style={st.slots} testID="slots">
            {Array.from({ length: Math.max(cfg.pick, Math.ceil(unitCount / cfg.pick) * cfg.pick) }).map((_, i) => {
              const l = buys.flatMap((x) => Array.from({ length: x.qty || 1 }).map(() => x))[i];
              const p = l && data.products.find((x) => x.id === l.product_id);
              return (
                <TouchableOpacity key={i} style={[st.slot, l && st.slotOn]} disabled={!l} onPress={() => l && p && openProduct(p)} testID={`slot-${i}`}>
                  {p && p.image_url ? <Image source={{ uri: p.image_url }} style={StyleSheet.absoluteFill} /> : null}
                  <Text style={[st.slotText, l && st.slotTextOn]} numberOfLines={2}>{p ? `${p.name.split(' ').slice(0, 2).join(' ')} · ${l.size || ''}` : CO.tapToFill}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ) : null}

        {/* BOGO: the pairs picked (B4) */}
        {sub === 'bogo' && buys.length ? (
          <View style={st.pairs} testID="pairs">
            {buys.filter((l) => l.role === 'buy' && l.pair).map((l, i) => {
              const p = data.products.find((x) => x.id === l.product_id);
              const free = buys.find((x) => x.pair === l.pair && x.role === 'free');
              return (
                <View key={l.pair} style={st.pair} testID={`pair-${i}`}>
                  <Text style={st.pairName}>{i + 1} · {p ? p.name : ''}</Text>
                  <Text style={st.pairLine}>{[l.colour, l.size].filter(Boolean).join(' · ')} · {inr(p ? p.shopper_price : 0)}</Text>
                  {free ? <Text style={st.pairFree}>{[free.colour, free.size].filter(Boolean).join(' · ')} · {CO.free} ₹0</Text> : null}
                  <Text style={st.remove} onPress={() => removePick(l.ref)} testID={`pair-remove-${i}`}>{CO.remove}</Text>
                </View>
              );
            })}
          </View>
        ) : null}

        {/* Free gift: the two steps (G1–G3) */}
        {isGift ? (
          <View style={st.steps} testID="gift-steps">
            <TouchableOpacity onPress={() => setStep('buy')} style={[st.stepTab, step === 'buy' && st.stepOn]} testID="step-buy">
              <Text style={[st.stepText, step === 'buy' && st.stepTextOn]}>{CO.stepBuy}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => giftUnlocked && setStep('gift')} style={[st.stepTab, step === 'gift' && st.stepOn, !giftUnlocked && { opacity: 0.5 }]} testID="step-gift">
              <Text style={[st.stepText, step === 'gift' && st.stepTextOn]}>{giftUnlocked ? CO.stepGift : `🔒 ${CO.stepGift}`}</Text>
            </TouchableOpacity>
          </View>
        ) : null}
        {oneGift ? <Text style={st.oneGift} testID="one-gift">{CO.yourGift(data.gifts[0].name)} · {CO.worth(inr(data.gifts[0].worth))} · {CO.giftAddedByItself}</Text> : null}

        {/* Mix & match tabs, or chips above 8 products (6.5) */}
        {(sub === 'mix_match' || data.products.length > 8) && data.categories.length > 1 && !(isGift && step === 'gift') ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }} contentContainerStyle={{ gap: 8 }}>
            <Chip label={`All ${data.products.filter((p) => p.in_deal).length}`} on={!cat} onPress={() => setCat(null)} testID="cat-all" />
            {data.categories.map((c) => <Chip key={c.id} label={`${c.name} ${c.count}`} on={cat === c.id} onPress={() => setCat(c.id)} testID={`cat-${c.id}`} />)}
            <Chip label={sort === 'up' ? 'Price ↑' : sort === 'down' ? 'Price ↓' : 'Sort: price'} on={!!sort} onPress={() => setSort(sort === 'up' ? 'down' : sort === 'down' ? null : 'up')} testID="sort" />
          </ScrollView>
        ) : null}

        {isGift && step === 'gift' ? (
          <View style={st.grid} testID="gift-grid">
            {data.gifts.map((g) => {
              const chosen = picks.some((l) => l.role === 'gift' && (l.gift_item_id === g.id || l.product_id === g.id));
              return (
                <TouchableOpacity key={g.id} style={[st.card, chosen && st.cardOn, g.all_given && { opacity: 0.45 }]} onPress={() => openGift(g)} disabled={g.all_given} testID={`gift-${g.id}`}>
                  {g.image_url ? <Image source={{ uri: g.image_url }} style={st.img} /> : <View style={st.img} />}
                  <Text style={st.name} numberOfLines={2}>{g.name}</Text>
                  <Text style={st.meta}>{CO.worth(inr(g.worth))}{g.left ? ` · ${CO.left(g.left)}` : ''}</Text>
                  <Text style={[st.cta, chosen && st.ctaOn]}>{g.all_given ? CO.allGiven : chosen ? CO.chosen : CO.tapToChoose}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ) : sub === 'fixed' ? (
          <View testID="set-list">
            {products.map((p) => {
              const cs = cardState(p);
              return (
                <TouchableOpacity key={p.id} style={[st.setRow, cs && st.cardOn]} onPress={() => openProduct(p)} testID={`set-item-${p.id}`}>
                  {p.image_url ? <Image source={{ uri: p.image_url }} style={st.setImg} /> : <View style={st.setImg} />}
                  <View style={{ flex: 1 }}>
                    <Text style={st.name}>{p.name}{p.set_qty > 1 ? ` ×${p.set_qty}` : ''}</Text>
                    <Text style={st.meta}>{inr(p.price)}{cs ? ` · ${[cs.first.colour, cs.first.size].filter(Boolean).join(' · ')}` : ''}</Text>
                    <Text style={[st.cta, cs && st.ctaOn, { alignSelf: 'flex-start' }]}>{cs ? CO.chosen : CO.tapToChooseColourSize}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        ) : (
          <View style={st.grid} testID="deal-grid">
            {products.map((p) => {
              const cs = cardState(p);
              const pl = priced && cs ? priced.lines.find((l) => l.ref === cs.first.ref) : null;
              return (
                <TouchableOpacity key={p.id} style={[st.card, cs && st.cardOn, p.sold_out && { opacity: 0.45 }]} disabled={p.sold_out} onPress={() => openProduct(p)} testID={`deal-product-${p.id}`}>
                  <View>
                    {p.image_url ? <Image source={{ uri: p.image_url }} style={st.img} /> : <View style={st.img} />}
                    {cs && cs.count > 1 ? <View style={st.times}><Text style={st.timesText}>×{cs.count}</Text></View> : null}
                  </View>
                  <Text style={st.name} numberOfLines={2}>{p.name}</Text>
                  <Text style={st.meta}>
                    {pl && pl.paid_total < pl.normal_total ? <><Text style={st.bold}>{inr(pl.paid_total / (pl.qty || 1))}</Text>{'  '}<Text style={st.struck}>{inr(p.price)}</Text></> : inr(p.shopper_price)}
                    {!cs ? ` · ${CO.sizesCount(p.colours.length, (p.colours[0] && p.colours[0].sizes.length) || 0)}` : ''}
                  </Text>
                  <Text style={[st.cta, cs && st.ctaOn]} numberOfLines={1}>{p.sold_out ? CO.soldOut : cs ? (sub === 'pick_any' || sub === 'mix_match' ? CO.inSet(cs.first.size) : CO.picked(cs.first.colour, cs.first.size)) : CO.tapToChoose}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>

      <StickyBar
        progress={priced && priced.progress ? priced.progress.text : (buys.length ? null : CO.nothingPicked)}
        next={priced && priced.progress ? priced.progress.next : null}
        count={CO.items(unitCount)}
        amount={priced ? priced.paid_total : 0}
        struck={priced && priced.savings > 0 ? priced.normal_total : null}
        label={nextToGift ? CO.nextChooseGift : CO.reviewDeal}
        disabled={nextToGift ? false : !(priced && priced.buyable)}
        onPress={() => {
          if (nextToGift) { setStep('gift'); return; }
          navigation.navigate('DealReview', { postId, lines: picks, editing });
        }}
      />

      <ProductPopup
        visible={!!popup}
        product={popup ? popup.product : null}
        onClose={() => setPopup(null)}
        header={popup && popup.mode === 'bogo' ? (
          <View style={{ marginBottom: 8 }}>
            <Text style={st.popHead}>{popup.part === 1 ? CO.youPayFor : CO.yourFreeOne}</Text>
            {popup.part === 2 ? <Text style={st.headSub}>{CO.sameProduct}</Text> : null}
            {popup.part === 2 ? <Text style={st.back} onPress={() => setPopup({ ...popup, part: 1 })}>{CO.backToPaid}</Text> : null}
          </View>
        ) : popup && popup.mode === 'fixed' ? (
          <Text style={st.popHead}>{CO.setOnePrice(setPrice)}</Text>
        ) : null}
        price={popup && (popup.mode === 'gift' || (popup.mode === 'bogo' && popup.part === 2)) ? 0 : undefined}
        struck={popup && popup.mode === 'gift' ? popup.gift.worth : undefined}
        effect={popup ? (popup.mode === 'gift' ? CO.worth(inr(popup.gift.worth)) : popup.mode === 'pick' ? (preview || (data.offer ? CO.countsToward(data.offer.line) : null)) : null) : null}
        allowQty={popup && popup.mode === 'pick' && (sub === 'quantity' || sub === 'value' || sub === 'spend' || sub === 'buy_x' || !data.offer)}
        initial={popup ? popup.initial : null}
        primaryLabel={(sel) => {
          if (!popup) return '';
          if (popup.mode === 'bogo') return popup.part === 1 ? CO.nextFree : CO.pickPair;
          if (popup.mode === 'gift') return CO.chooseGift;
          if (popup.mode === 'fixed') return CO.done(sel.colour, sel.size);
          if (sub === 'pick_any' || sub === 'mix_match') return CO.putInSet(((unitCount % (cfg.pick || 1)) || 0) + 1, cfg.pick || 1);
          return CO.pick(sel.colour, sel.size);
        }}
        onPrimary={primary}
        onRemove={popup && popup.ref ? () => removePick(popup.ref) : null}
        returnsLine={popup && popup.mode !== 'gift' && data.returns ? data.returns.line : null}
        testID="product-popup"
      />
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  head: { backgroundColor: K.warnSoft, borderRadius: 14, padding: 12, marginBottom: 12 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  headLine: { fontFamily: fonts.sansBold, fontSize: 15, color: K.ink, flexShrink: 1 },
  till: { fontFamily: fonts.sansRegular, fontSize: 11.5, color: K.warn },
  headSub: { fontFamily: fonts.sansRegular, fontSize: 12, color: K.ink2, marginTop: 3 },
  how: { fontFamily: fonts.sansRegular, fontSize: 12, color: K.warn, marginTop: 6, lineHeight: 17 },
  ladder: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  rung: { flex: 1, borderRadius: 12, borderWidth: 1.5, borderStyle: 'dashed', borderColor: K.border, paddingVertical: 8, alignItems: 'center' },
  rungOn: { backgroundColor: K.ink, borderColor: K.ink, borderStyle: 'solid' },
  rungTop: { fontFamily: fonts.sansBold, fontSize: 12.5, color: K.ink },
  rungSub: { fontFamily: fonts.sansRegular, fontSize: 11, color: K.ink2, marginTop: 2 },
  rungTextOn: { color: '#fff' },
  slots: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  slot: { width: (W - 28 - 16) / 3, height: 96, borderRadius: 12, borderWidth: 1.5, borderStyle: 'dashed', borderColor: K.border, alignItems: 'center', justifyContent: 'flex-end', padding: 6, overflow: 'hidden' },
  slotOn: { borderStyle: 'solid', borderColor: K.ink },
  slotText: { fontFamily: fonts.sansRegular, fontSize: 10.5, color: K.ink3, textAlign: 'center' },
  slotTextOn: { fontFamily: fonts.sansBold, color: '#fff', backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 6, paddingHorizontal: 4 },
  pairs: { gap: 8, marginBottom: 12 },
  pair: { borderWidth: 1.5, borderColor: K.ink, borderRadius: 12, padding: 10 },
  pairName: { fontFamily: fonts.sansBold, fontSize: 13, color: K.ink },
  pairLine: { fontFamily: fonts.sansRegular, fontSize: 12, color: K.ink2, marginTop: 3 },
  pairFree: { fontFamily: fonts.sansBold, fontSize: 12, color: K.ok, marginTop: 2 },
  steps: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  stepTab: { flex: 1, borderRadius: 12, borderWidth: 1.5, borderColor: K.border, padding: 9, alignItems: 'center' },
  stepOn: { backgroundColor: K.ink, borderColor: K.ink },
  stepText: { fontFamily: fonts.sansBold, fontSize: 12, color: K.ink },
  stepTextOn: { color: '#fff' },
  oneGift: { fontFamily: fonts.sansBold, fontSize: 12, color: K.ok, marginBottom: 10 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  card: { width: CARD, borderRadius: 14, borderWidth: 1, borderColor: K.border, padding: 8 },
  cardOn: { borderColor: K.ink, borderWidth: 2 },
  img: { width: '100%', height: CARD * 1.05, borderRadius: 10, backgroundColor: '#EDECE6' },
  times: { position: 'absolute', top: 6, right: 6, backgroundColor: K.ink, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  timesText: { fontFamily: fonts.sansBold, fontSize: 10.5, color: '#fff' },
  name: { fontFamily: fonts.sansBold, fontSize: 12.5, color: K.ink, marginTop: 6 },
  meta: { fontFamily: fonts.sansRegular, fontSize: 11.5, color: K.ink2, marginTop: 2 },
  bold: { fontFamily: fonts.sansBold, color: K.ink },
  struck: { textDecorationLine: 'line-through', color: K.ink3 },
  cta: { fontFamily: fonts.sansBold, fontSize: 11.5, color: K.ink, marginTop: 8, borderWidth: 1.5, borderColor: K.ink, borderRadius: 9, paddingVertical: 6, textAlign: 'center', overflow: 'hidden' },
  ctaOn: { backgroundColor: K.ink, color: '#fff' },
  setRow: { flexDirection: 'row', gap: 10, borderWidth: 1, borderColor: K.border, borderRadius: 12, padding: 8, marginBottom: 8, alignItems: 'center' },
  setImg: { width: 60, height: 74, borderRadius: 8, backgroundColor: '#EDECE6' },
  remove: { fontFamily: fonts.sansBold, fontSize: 12, color: K.danger, marginTop: 6 },
  popHead: { fontFamily: fonts.sansBold, fontSize: 13.5, color: K.ink },
  back: { fontFamily: fonts.sansBold, fontSize: 12, color: K.ink, textDecorationLine: 'underline', marginTop: 4 },
});
