/**
 * D4 · Review your deal (every offer) — each item with its colour and size (Change, Remove), the
 * gift if any, what she pays and saves, then Add to bag or Buy now. Buy now never changes the bag
 * (6.5). Coming from the bag's Edit deal, Add to bag replaces that post's items (D11).
 *
 * shopper-walk-fixes · board S7 (spec W3, W10) — Add to bag no longer opens the Bag. It adds, the
 * phone gives one short vibration, the button reads "Go to bag ›" for about a second, and then
 * this review and the deal page under it both close: she is on the post (or the video) she came
 * from, or — when the deal was opened from the Bag's Edit deal — back in the Bag. The bag icon
 * with its count is in the top bar. Buy now is unchanged.
 *
 * shopper-app-fixes · F12 — Remove here is Remove on the deal page too: what is left is handed
 * back (`onChange`), so tapping Change no longer brings the removed item back. Removing the last
 * item returns her to the deal page with nothing picked — it used to leave a spinner for ever,
 * because with no lines the server sends no deal to show. A price that could not be fetched says
 * so, with Try again, instead of spinning.
 *
 * route.params: { postId, lines, editing, onChange? } — `onChange(lines)` is the deal page's.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { followerApi } from '../../../services/api';
import { TopBar, Loading, Empty } from '../../../components/shop/bitsShop';
import { MoneyRows, Notes, BagButton, AddedLine, AddToBagButton, useAdded, closePages, inFront, K, b } from '../../../components/shop/orderBits';
import { CO } from '../../../components/shop/copyOrder';
import { CS, inr } from '../../../components/shop/copyShop';
import { addToBag, replacePost, forgetAddedAlone } from '../../../components/shop/bag';
import { isSignedIn } from '../../../components/shop/shopStore';
import { fonts } from '../../../theme/tokens';

const plain = (xs) => xs.map(({ ref, post_id, product_id, gift_item_id, colour, size, qty, role }) => ({ ref, post_id, product_id, gift_item_id, colour, size, qty, role }));

export default function DealReviewScreen({ navigation, route }) {
  const { postId, lines: start = [], editing = false, onChange = null } = route.params || {};
  const [lines, setLines] = useState(start || []);
  const [g, setG] = useState(null);
  const [failed, setFailed] = useState(false);     // the price could not be fetched
  const [tries, setTries] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  // The review and the deal page it was opened from: both close (W10). If she has gone to another
  // page meanwhile (the bag icon, say) nothing is closed under her; the button stays "Go to bag ›".
  const flash = useAdded(() => { if (inFront(navigation)) closePages(navigation, 2); });
  const nothing = lines.length === 0;

  useEffect(() => {
    if (nothing) return undefined;                 // nothing to price: she is going back (below)
    let alive = true;
    (async () => {
      let r = null;
      try { r = await followerApi.dealPrice(postId, plain(lines)); } catch { r = null; }
      if (!alive) return;
      const group = r && r.success && r.data && Array.isArray(r.data.groups) ? r.data.groups[0] || null : null;
      if (group) { setG(group); setFailed(false); } else setFailed(true);
    })();
    return () => { alive = false; };
  }, [lines, postId, nothing, tries]);

  // F12: with nothing left there is no deal to review — back to the deal page, nothing picked.
  useEffect(() => { if (nothing) navigation.goBack(); }, [nothing]); // eslint-disable-line react-hooks/exhaustive-deps

  function remove(ref) {
    const t = lines.find((l) => l.ref === ref);
    let left = t && t.pair ? lines.filter((l) => l.pair !== t.pair) : lines.filter((l) => l.ref !== ref);
    // A gift is nothing without the items that earn it: with no item left, nothing is picked.
    if (!left.some((l) => l.role !== 'gift')) left = [];
    setLines(left);
    if (onChange) onChange(left);                  // the deal page keeps the same picks
  }
  async function toBag() {
    setBusy(true); setErr(null);
    try {
      const withPost = plain(lines).map((l) => ({ ...l, post_id: postId }));
      if (editing) await replacePost(postId, withPost); else await addToBag(withPost);
      forgetAddedAlone(postId);      // a deal she built here did not "apply by itself" (shopper-deal-orders · B6)
      flash.start();
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  }
  // "Go to bag ›" in that second: the two pages close and the Bag opens. Opened from the Bag's
  // Edit deal, closing them IS the Bag.
  function goToBag() {
    flash.stop();
    closePages(navigation, 2);
    if (!editing) navigation.navigate('Bag');
  }
  async function buyNow() {
    flash.stop();
    const withPost = plain(lines).map((l) => ({ ...l, post_id: postId }));
    const go = () => navigation.navigate('Checkout', { lines: withPost, buyNow: true });
    // N2: the sign-in screen says why she is signing in — here, to place her order.
    if (await isSignedIn()) go(); else navigation.navigate('FollowerLogin', { onDone: go, reason: 'order' });
  }

  if (failed && !nothing) {
    return (
      <SafeAreaView style={st.safe}>
        <TopBar title={CO.yourDeal} onBack={() => navigation.goBack()} right={<BagButton />} />
        <Empty title={CS.loadError} action={CS.retry} onAction={() => { setFailed(false); setG(null); setTries((n) => n + 1); }} testID="deal-review-error" />
      </SafeAreaView>
    );
  }
  if (!g || nothing) return <SafeAreaView style={st.safe}><TopBar title={CO.yourDeal} onBack={() => navigation.goBack()} right={<BagButton />} /><Loading /></SafeAreaView>;
  const items = g.lines.filter((l) => l.role !== 'gift');
  const gifts = g.lines.filter((l) => l.role === 'gift');
  return (
    <SafeAreaView style={st.safe} edges={['top']}>
      <TopBar title={CO.yourDeal} onBack={() => navigation.goBack()} right={<BagButton />} />
      <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 24 }} testID="deal-review">
        {g.offer ? (
          <View style={st.head}>
            <Text style={st.headLine}>{g.offer.line}</Text>
          </View>
        ) : null}
        {items.map((l, i) => (
          <View key={`${l.ref}-${l.deal_key}-${i}`} style={st.line} testID={`review-line-${i}`}>
            {l.image_url ? <Image source={{ uri: l.image_url }} style={st.thumb} /> : <View style={st.thumb} />}
            <View style={{ flex: 1 }}>
              <Text style={st.name}>{l.name}{[l.colour, l.size].filter(Boolean).length ? ` · ${[l.colour, l.size].filter(Boolean).join(' · ')}` : ''}{l.qty > 1 ? ` ×${l.qty}` : ''}</Text>
              <Text style={st.price}>
                {l.role === 'free' ? <Text style={{ color: K.ok }}>{CO.free} ₹0</Text> : inr(l.paid_total)}
                {l.paid_total < l.normal_total && l.role !== 'free' ? <Text style={st.struck}>  {inr(l.normal_total)}</Text> : null}
              </Text>
              <Notes problems={l.problems} notes={l.notes} />
              <View style={{ flexDirection: 'row', gap: 14, marginTop: 4 }}>
                <Text style={st.act} onPress={() => navigation.goBack()} testID={`review-change-${i}`}>{CO.change}</Text>
                <Text style={st.act} onPress={() => remove(l.ref)} testID={`review-remove-${i}`}>{CO.remove}</Text>
              </View>
            </View>
          </View>
        ))}
        {gifts.map((l, i) => (
          <View key={`gift-${i}`} style={[st.line, st.giftLine]} testID={`review-gift-${i}`}>
            {l.image_url ? <Image source={{ uri: l.image_url }} style={st.thumb} /> : <View style={[st.thumb, { backgroundColor: K.okSoft }]} />}
            <View style={{ flex: 1 }}>
              <Text style={st.name}>{CO.freeGift(l.name)}</Text>
              <Text style={[st.price, { color: K.ok }]}>₹0 · {CO.worth(inr(l.normal_unit))}</Text>
              <Notes problems={l.problems} notes={l.notes} />
              {!l.auto ? <Text style={st.act} onPress={() => navigation.goBack()}>{CO.changeGift}</Text> : null}
            </View>
          </View>
        ))}
        <Notes problems={g.problems} />
        <MoneyRows normal={g.normal_total} savings={g.savings} giftValue={g.gift_value} total={g.paid_total} />
        {g.savings > 0 ? <Text style={st.save}>{CO.youSave(inr(g.savings))}</Text> : null}
        {err ? <Text style={b.problem}>{err}</Text> : null}
      </ScrollView>
      <View style={st.bar}>
        {flash.added ? <AddedLine /> : null}
        <View style={st.btnRow}>
          <TouchableOpacity style={[b.secondary, { flex: 1 }, (!g.buyable || busy) && b.primaryDis]} disabled={!g.buyable || busy} onPress={buyNow} testID="review-buy-now">
            <Text style={b.secondaryText}>{CO.buyNow}</Text>
          </TouchableOpacity>
          <AddToBagButton added={flash.added} disabled={!g.buyable || busy} onAdd={toBag} onGoToBag={goToBag}
            testID="review-add-to-bag" style={{ flex: 1, marginTop: 0 }} />
        </View>
      </View>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  head: { backgroundColor: K.warnSoft, borderRadius: 14, padding: 12, marginBottom: 10 },
  headLine: { fontFamily: fonts.sansBold, fontSize: 14.5, color: K.ink },
  line: { flexDirection: 'row', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: K.border },
  giftLine: { borderBottomWidth: 0 },
  thumb: { width: 56, height: 68, borderRadius: 10, backgroundColor: '#EDECE6' },
  name: { fontFamily: fonts.sansBold, fontSize: 13, color: K.ink },
  price: { fontFamily: fonts.sansBold, fontSize: 13, color: K.ink, marginTop: 3 },
  struck: { fontFamily: fonts.sansRegular, fontSize: 11.5, color: K.ink3, textDecorationLine: 'line-through' },
  act: { fontFamily: fonts.sansBold, fontSize: 12, color: K.ink, textDecorationLine: 'underline' },
  save: { fontFamily: fonts.sansBold, fontSize: 12.5, color: K.ok, marginTop: 8, textAlign: 'right' },
  bar: { padding: 14, borderTopWidth: 1, borderTopColor: K.border, gap: 8 },
  btnRow: { flexDirection: 'row', gap: 10 },
});
