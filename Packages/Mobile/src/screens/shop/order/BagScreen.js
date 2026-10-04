/**
 * O6 · The bag — grouped by post (R2): each group its creator, brand and offer, its items, and
 * what is left to complete its deal. Tick boxes (only ticked items go on), quantity 1–5, Change ·
 * Remove · Move to Saved, Add more from this post; deal groups show as one (D11) with Edit deal.
 * O7 · When something changed (price, a sold-out size, an offer that ended) it says so before paying.
 * O8 · A guest fills the bag without signing in; Continue asks her to sign in, then carries on.
 *
 * shopper-walk-fixes · board G1, G2 (spec W2, W8) — a deal made of fixed pieces stays whole. A set,
 * a bundle (pick any, mix & match) and buy one get one are ONE group: one tick in its header, each
 * item with its colour and size and nothing to press, what the deal costs, Edit deal and Remove
 * deal. No − 1 +, no Change, no Remove, no Move to Saved on a single item — raising one item of a
 * set used to block the whole bag ("Sold only as the whole set"). Everything else — a plain
 * discount, buy more save more, spend or buy for a gift, no offer — is exactly as it was.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { View, Text, ScrollView, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { followerApi } from '../../../services/api';
import { TopBar, Loading, Empty, Avatar, PrimaryBtn } from '../../../components/shop/bitsShop';
import { MoneyRows, Notes, QtyStepper, ProductPopup, Sheet, isLockedDeal, K, b } from '../../../components/shop/orderBits';
import { CO } from '../../../components/shop/copyOrder';
import { CS, inr } from '../../../components/shop/copyShop';
import { loadBag, saveBag } from '../../../components/shop/bag';
import { isSignedIn, toggleSaveProductLocal } from '../../../components/shop/shopStore';
import { fonts } from '../../../theme/tokens';

const plain = (xs) => xs.map(({ ref, post_id, product_id, gift_item_id, colour, size, qty, role, ticked, price_seen }) => ({ ref, post_id, product_id, gift_item_id, colour, size, qty, role, ticked, price_seen }));

export default function BagScreen({ navigation }) {
  const [lines, setLines] = useState(null);
  const [priced, setPriced] = useState(null);
  const [err, setErr] = useState(null);
  const [change, setChange] = useState(null);   // { line, product, returns }
  const [askSignIn, setAskSignIn] = useState(false);
  const whole = useRef(new Set());              // posts whose deal was seen to be one that stays whole
  useEffect(() => {
    for (const g of (priced ? priced.groups : [])) if (isLockedDeal(g.offer)) whole.current.add(g.post_id);
  }, [priced]);

  const price = useCallback(async (ls) => {
    if (!ls.length) { setPriced(null); return; }
    const r = await followerApi.bagPrice(plain(ls));
    setPriced(r && r.success ? r.data : null);
    if (!r || !r.success) setErr((r && r.error && r.error.message) || CS.loadError);
  }, []);

  const refresh = useCallback(() => {
    let alive = true;
    (async () => {
      const ls = await loadBag();
      if (!alive) return;
      setLines(ls); setErr(null);
      await price(ls);
    })();
    return () => { alive = false; };
  }, [price]);
  useFocusEffect(refresh);

  async function write(next) {
    setLines(next);
    try { const saved = await saveBag(next); setLines(saved); await price(saved); } catch (e) { setErr(e.message); }
  }
  const upd = (ref, patch) => write(lines.map((l) => (l.ref === ref ? { ...l, ...patch } : l)));
  const remove = (ref) => write(lines.filter((l) => l.ref !== ref));
  // A deal that stays whole (G1, G2): one tick and one Remove for every line of its post.
  const tickPost = (postId, on) => write(lines.map((l) => (l.post_id === postId ? { ...l, ticked: on } : l)));
  const removeDeal = (postId) => write(lines.filter((l) => l.post_id !== postId));
  /**
   * Ticking an unticked item again. If it is one piece of a deal that stays whole, the whole deal
   * comes back with it — one piece alone would break the set. An unticked deal is not priced, so
   * when this screen has not seen the deal before, the post's deal data says what kind it is.
   */
  async function tickAgain(l) {
    const mates = lines.some((x) => x.post_id === l.post_id && x.ref !== l.ref && x.ticked === false);
    let together = whole.current.has(l.post_id);
    if (!together && mates) {
      let r = null;
      try { r = await followerApi.deal(l.post_id); } catch { r = null; }
      together = !!(r && r.success && r.data && isLockedDeal(r.data.offer));
      if (together) whole.current.add(l.post_id);
    }
    if (together) tickPost(l.post_id, true); else upd(l.ref, { ticked: true });
  }
  async function moveToSaved(l) {
    if (await isSignedIn()) await followerApi.saveProduct({ product_id: l.product_id, post_id: l.post_id });
    else await toggleSaveProductLocal({ product_id: l.product_id, post_id: l.post_id }, true);
    remove(l.ref);
  }
  async function openChange(l) {
    const r = await followerApi.deal(l.post_id);
    if (!r || !r.success) { setErr(r && r.error ? r.error.message : CS.loadError); return; }
    if (r.data.deal_page) { editDeal(l.post_id); return; }
    const product = r.data.products.find((p) => p.id === l.product_id);
    if (product) setChange({ line: l, product, returns: r.data.returns ? r.data.returns.line : null });
  }
  function editDeal(postId) {
    navigation.navigate('Deal', { postId, lines: lines.filter((l) => l.post_id === postId && l.ticked !== false), editing: true });
  }
  async function onContinue() {
    if (!(await isSignedIn())) { setAskSignIn(true); return; }
    navigation.navigate('Checkout', {});
  }

  if (lines === null) return <SafeAreaView style={st.safe}><TopBar title={CO.bag(0)} onBack={() => navigation.goBack()} /><Loading /></SafeAreaView>;
  const count = lines.filter((l) => l.role !== 'gift').reduce((s, l) => s + l.qty, 0);
  if (!lines.length) {
    return (
      <SafeAreaView style={st.safe}>
        <TopBar title={CO.bag(0)} onBack={() => navigation.goBack()} />
        <Empty title={CO.bagEmpty} sub={CO.bagEmptySub} action={CO.keepShopping} onAction={() => navigation.navigate('Tabs')} testID="bag-empty" />
      </SafeAreaView>
    );
  }

  // Each bag line with what the server priced it at (a line can split across a deal's sets).
  const pricedOf = (ref) => {
    const all = priced ? priced.groups.flatMap((g) => g.lines.filter((x) => String(x.ref) === String(ref))) : [];
    if (!all.length) return null;
    return {
      paid: all.reduce((s, x) => s + x.paid_total, 0), normal: all.reduce((s, x) => s + x.normal_total, 0),
      name: all[0].name, image_url: all[0].image_url, problems: all.flatMap((x) => x.problems || []), notes: all[0].notes || [],
      role: all[0].role, price_was: all[0].price_was,
    };
  };
  const unticked = (priced && priced.unticked) || [];

  return (
    <SafeAreaView style={st.safe} edges={['top']}>
      <TopBar title={CO.bag(count)} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 20 }} testID="bag">
        {(priced ? priced.groups : []).map((g) => {
          const mine = lines.filter((l) => l.post_id === g.post_id && l.ticked !== false);
          const isDeal = g.offer && g.offer.type && g.offer.type !== 'discount';
          const gifts = g.lines.filter((x) => x.role === 'gift');
          const head = (
            <>
              <Avatar uri={g.creator && g.creator.avatar} name={g.creator ? g.creator.name : ''} size={30} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={st.gName} numberOfLines={1}>{[g.creator && g.creator.name, g.brand && g.brand.name].filter(Boolean).join(' · ')}</Text>
                {g.offer && g.offer.line ? <Text style={st.gOffer}>{g.offer.line}</Text> : null}
              </View>
              {isDeal ? <Text style={st.edit} onPress={() => editDeal(g.post_id)} testID={`edit-deal-${g.post_id}`}>{CO.editDeal}</Text> : null}
            </>
          );
          // G1, G2 — a deal made of fixed pieces: one group, one tick, nothing to press on an item.
          if (isLockedDeal(g.offer)) {
            const bogo = g.offer.sub_type === 'bogo';
            return (
              <View key={g.post_id} style={st.group} testID={`bag-group-${g.post_id}`}>
                <View style={st.gHead}>
                  <TouchableOpacity onPress={() => tickPost(g.post_id, false)} testID={`tick-group-${g.post_id}`}
                    accessibilityRole="checkbox" accessibilityState={{ checked: true }} accessibilityLabel={CO.wholeDeal}>
                    <Icon name="checkbox-marked" size={22} color={K.ink} />
                  </TouchableOpacity>
                  {head}
                </View>
                {mine.map((l) => {
                  const p = pricedOf(l.ref) || {};
                  const free = (p.role || l.role) === 'free';
                  const about = [l.colour, l.size].filter(Boolean).join(' · ');
                  return (
                    <View key={l.ref} style={st.line} testID={`bag-line-${l.ref}`}>
                      {p.image_url ? <Image source={{ uri: p.image_url }} style={st.thumb} /> : <View style={st.thumb} />}
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={st.name} numberOfLines={2}>{p.name || '…'}{free ? ` · ${CO.free}` : ''}</Text>
                        <Text style={st.meta}>{[about, l.qty > 1 ? CO.times(l.qty) : null].filter(Boolean).join(' ')}</Text>
                        {bogo ? (
                          <Text style={[st.price, free && { color: K.ok }]} testID={`deal-price-${l.ref}`}>{free ? '₹0' : p.paid != null ? inr(p.paid) : ''}</Text>
                        ) : null}
                        <Notes problems={p.problems || []} notes={p.notes || []} />
                      </View>
                    </View>
                  );
                })}
                <View style={st.dealSet} testID={`deal-whole-${g.post_id}`}>
                  <Text style={st.dealSetTop}>
                    {[g.progress && g.progress.text, inr(g.paid_total)].filter(Boolean).join(' · ')}
                    {/* a pair costs what one costs: nothing to strike (G2). A set or a bundle shows what it would have cost. */}
                    {!bogo && g.normal_total > g.paid_total ? <Text style={st.struck}>  {inr(g.normal_total)}</Text> : null}
                  </Text>
                  <Text style={st.dealSetLine}>{CO.dealWhole[g.offer.sub_type]}</Text>
                </View>
                {g.progress && g.progress.next ? <View style={st.nudge}><Text style={st.nudgeText}>{g.progress.next}</Text></View> : null}
                <Notes problems={g.problems} />
                <Text style={st.more} onPress={() => removeDeal(g.post_id)} testID={`remove-deal-${g.post_id}`}>{CO.removeDeal}</Text>
              </View>
            );
          }
          return (
            <View key={g.post_id} style={st.group} testID={`bag-group-${g.post_id}`}>
              <View style={st.gHead}>{head}</View>
              {mine.map((l) => {
                const p = pricedOf(l.ref) || {};
                return (
                  <View key={l.ref} style={st.line} testID={`bag-line-${l.ref}`}>
                    <TouchableOpacity onPress={() => upd(l.ref, { ticked: false })} testID={`tick-${l.ref}`} accessibilityRole="checkbox" accessibilityState={{ checked: true }}>
                      <Icon name="checkbox-marked" size={22} color={K.ink} />
                    </TouchableOpacity>
                    {p.image_url ? <Image source={{ uri: p.image_url }} style={st.thumb} /> : <View style={st.thumb} />}
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={st.name} numberOfLines={2}>{p.name || '…'}{p.role === 'free' ? ` · ${CO.free}` : ''}</Text>
                      <Text style={st.meta}>{[l.colour, l.size].filter(Boolean).join(' · ')}</Text>
                      <Text style={st.price}>
                        {p.paid != null ? (p.role === 'free' ? '₹0' : inr(p.paid)) : ''}
                        {p.normal > p.paid ? <Text style={st.struck}>  {inr(p.normal)}</Text> : null}
                      </Text>
                      <Notes problems={p.problems || []} notes={p.notes || []} />
                      {l.role === 'buy' ? (
                        <View style={st.acts}>
                          <QtyStepper value={l.qty} onChange={(v) => upd(l.ref, { qty: v })} testID={`qty-${l.ref}`} />
                          <Text style={st.act} onPress={() => openChange(l)} testID={`change-${l.ref}`}>{CO.change}</Text>
                          <Text style={st.act} onPress={() => remove(l.ref)} testID={`remove-${l.ref}`}>{CO.remove}</Text>
                          <Text style={st.act} onPress={() => moveToSaved(l)} testID={`save-${l.ref}`}>{CO.moveToSaved}</Text>
                        </View>
                      ) : (
                        <View style={st.acts}><Text style={st.act} onPress={() => remove(l.ref)}>{CO.remove}</Text></View>
                      )}
                    </View>
                  </View>
                );
              })}
              {gifts.map((x, i) => (
                <Text key={`g${i}`} style={st.gift}>{CO.freeGift(x.name)} · ₹0 · {CO.worth(inr(x.normal_unit))}</Text>
              ))}
              {g.progress && (g.progress.next || !g.progress.done) ? (
                <View style={st.nudge}><Text style={st.nudgeText}>{g.progress.next || g.progress.text}</Text></View>
              ) : null}
              <Notes problems={g.problems} />
              <Text style={st.more} onPress={() => navigation.navigate('Post', { postId: g.post_id })} testID={`add-more-${g.post_id}`}>{CO.addMore}</Text>
            </View>
          );
        })}

        {unticked.length ? (
          <View style={st.group} testID="bag-unticked">
            {unticked.map((l) => (
              <View key={l.ref} style={[st.line, { opacity: 0.7 }]}>
                <TouchableOpacity onPress={() => tickAgain(l)} testID={`tick-${l.ref}`} accessibilityRole="checkbox" accessibilityState={{ checked: false }}>
                  <Icon name="checkbox-blank-outline" size={22} color={K.ink} />
                </TouchableOpacity>
                {l.image_url ? <Image source={{ uri: l.image_url }} style={st.thumb} /> : <View style={st.thumb} />}
                <View style={{ flex: 1 }}>
                  <Text style={st.name}>{l.name || '…'}</Text>
                  <Text style={st.meta}>{[l.colour, l.size].filter(Boolean).join(' · ')}</Text>
                  <Notes problems={l.problems || []} />
                </View>
              </View>
            ))}
            <Text style={st.hint}>{CO.unticked}</Text>
          </View>
        ) : null}

        {priced ? <MoneyRows normal={priced.items_normal} savings={priced.savings} delivery={0} total={priced.items_total} /> : null}
        {err ? <Text style={b.problem}>{err}</Text> : null}
      </ScrollView>
      <View style={st.bar}>
        <TouchableOpacity style={[b.primary, { marginTop: 0 }, !(priced && priced.buyable) && b.primaryDis]} disabled={!(priced && priced.buyable)} onPress={onContinue} testID="bag-continue">
          <Text style={b.primaryText}>{CO.continueTo(inr(priced ? priced.items_total : 0))}</Text>
        </TouchableOpacity>
      </View>

      <ProductPopup
        visible={!!change}
        product={change ? change.product : null}
        initial={change ? change.line : null}
        allowQty
        onClose={() => setChange(null)}
        primaryLabel={() => CO.change}
        onPrimary={(sel) => { upd(change.line.ref, { colour: sel.colour, size: sel.size, qty: sel.qty || change.line.qty }); setChange(null); }}
        returnsLine={change ? change.returns : null}
        testID="bag-change"
      />
      <Sheet visible={askSignIn} onClose={() => setAskSignIn(false)} testID="bag-sign-in">
        <Text style={st.sheetTitle}>{CO.signInToOrder}</Text>
        <Text style={st.hint}>{CO.signInToOrderSub}</Text>
        <PrimaryBtn label={CO.getOtp} testID="bag-sign-in-go" onPress={() => {
          setAskSignIn(false);
          navigation.navigate('FollowerLogin', { onDone: () => navigation.navigate('Checkout', {}) });
        }} />
      </Sheet>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  group: { borderWidth: 1, borderColor: K.border, borderRadius: 16, padding: 12, marginBottom: 12 },
  gHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  gName: { fontFamily: fonts.sansBold, fontSize: 13, color: K.ink },
  gOffer: { fontFamily: fonts.sansRegular, fontSize: 11.5, color: K.ink2, marginTop: 1 },
  edit: { fontFamily: fonts.sansBold, fontSize: 12.5, color: K.ink, textDecorationLine: 'underline' },
  line: { flexDirection: 'row', gap: 10, paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#F1F0EB', alignItems: 'flex-start' },
  thumb: { width: 54, height: 66, borderRadius: 9, backgroundColor: '#EDECE6' },
  name: { fontFamily: fonts.sansBold, fontSize: 13, color: K.ink },
  meta: { fontFamily: fonts.sansRegular, fontSize: 11.5, color: K.ink2, marginTop: 2 },
  price: { fontFamily: fonts.sansBold, fontSize: 13, color: K.ink, marginTop: 3 },
  struck: { fontFamily: fonts.sansRegular, fontSize: 11.5, color: K.ink3, textDecorationLine: 'line-through' },
  acts: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8, flexWrap: 'wrap' },
  act: { fontFamily: fonts.sansBold, fontSize: 12, color: K.ink, textDecorationLine: 'underline' },
  gift: { fontFamily: fonts.sansBold, fontSize: 12, color: K.ok, marginTop: 6 },
  dealSet: { backgroundColor: K.surface, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, marginTop: 4, gap: 3 },
  dealSetTop: { fontFamily: fonts.sansBold, fontSize: 13, color: K.ink },
  dealSetLine: { fontFamily: fonts.sansRegular, fontSize: 11.5, color: K.ink2, lineHeight: 16 },
  nudge: { backgroundColor: K.warnSoft, borderRadius: 10, padding: 9, marginTop: 8 },
  nudgeText: { fontFamily: fonts.sansBold, fontSize: 12, color: K.warn },
  more: { fontFamily: fonts.sansBold, fontSize: 12.5, color: K.ink, textDecorationLine: 'underline', marginTop: 10 },
  hint: { fontFamily: fonts.sansRegular, fontSize: 11.5, color: K.ink2, marginTop: 8, lineHeight: 16 },
  bar: { padding: 14, borderTopWidth: 1, borderTopColor: K.border },
  sheetTitle: { fontFamily: fonts.sansBold, fontSize: 16, color: K.ink },
});
