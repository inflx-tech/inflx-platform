/**
 * D4 · Review your deal (every offer) — each item with its colour and size (Change, Remove), the
 * gift if any, what she pays and saves, then Add to bag or Buy now. Buy now never changes the bag
 * (6.5). Coming from the bag's Edit deal, Add to bag replaces that post's items (D11).
 */
import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { followerApi } from '../../../services/api';
import { TopBar, Loading } from '../../../components/shop/bitsShop';
import { MoneyRows, Notes, K, b } from '../../../components/shop/orderBits';
import { CO } from '../../../components/shop/copyOrder';
import { inr } from '../../../components/shop/copyShop';
import { addToBag, replacePost } from '../../../components/shop/bag';
import { isSignedIn } from '../../../components/shop/shopStore';
import { fonts } from '../../../theme/tokens';

const plain = (xs) => xs.map(({ ref, post_id, product_id, gift_item_id, colour, size, qty, role }) => ({ ref, post_id, product_id, gift_item_id, colour, size, qty, role }));

export default function DealReviewScreen({ navigation, route }) {
  const { postId, lines: start = [], editing = false } = route.params || {};
  const [lines, setLines] = useState(start);
  const [g, setG] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const r = await followerApi.dealPrice(postId, plain(lines));
      if (alive) setG(r && r.success ? r.data.groups[0] || null : null);
    })();
    return () => { alive = false; };
  }, [lines, postId]);

  function remove(ref) {
    const t = lines.find((l) => l.ref === ref);
    setLines((xs) => (t && t.pair ? xs.filter((l) => l.pair !== t.pair) : xs.filter((l) => l.ref !== ref)));
  }
  async function toBag() {
    setBusy(true); setErr(null);
    try {
      const withPost = plain(lines).map((l) => ({ ...l, post_id: postId }));
      if (editing) await replacePost(postId, withPost); else await addToBag(withPost);
      navigation.navigate('Bag');
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  }
  async function buyNow() {
    const withPost = plain(lines).map((l) => ({ ...l, post_id: postId }));
    const go = () => navigation.navigate('Checkout', { lines: withPost, buyNow: true });
    if (await isSignedIn()) go(); else navigation.navigate('FollowerLogin', { onDone: go });
  }

  if (!g) return <SafeAreaView style={st.safe}><TopBar title={CO.yourDeal} onBack={() => navigation.goBack()} /><Loading /></SafeAreaView>;
  const items = g.lines.filter((l) => l.role !== 'gift');
  const gifts = g.lines.filter((l) => l.role === 'gift');
  return (
    <SafeAreaView style={st.safe} edges={['top']}>
      <TopBar title={CO.yourDeal} onBack={() => navigation.goBack()} />
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
        <TouchableOpacity style={[b.secondary, { flex: 1 }, (!g.buyable || busy) && b.primaryDis]} disabled={!g.buyable || busy} onPress={buyNow} testID="review-buy-now">
          <Text style={b.secondaryText}>{CO.buyNow}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[b.primary, { flex: 1, marginTop: 0 }, (!g.buyable || busy) && b.primaryDis]} disabled={!g.buyable || busy} onPress={toBag} testID="review-add-to-bag">
          <Text style={b.primaryText}>{CO.addToBag}</Text>
        </TouchableOpacity>
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
  bar: { flexDirection: 'row', gap: 10, padding: 14, borderTopWidth: 1, borderTopColor: K.border },
});
