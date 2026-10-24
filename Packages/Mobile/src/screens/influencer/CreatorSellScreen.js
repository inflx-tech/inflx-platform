/**
 * CreatorSellScreen — C2 "What you can sell", read-only. Her offers (the deal in words, product
 * count, dates, a peek at the products, what she earns on an example) and her products at normal
 * price. Nothing here can be changed or countered (rules 2.6, 2.11).
 * Contract: features/creator-terms-v2 · rules Docs/OFFER_TERMS_POSTS_RULES.md §2
 */
import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { settingsTokens as T, fonts } from '../../theme/tokens';
import { influencerApi } from '../../services/api';
import { Skeleton, LoadError } from '../../components/settings/feedback';
import { Header, s as base } from '../brand/BrandPitchSettingsScreen';
import { rupees5 } from '../../components/invitations/copy5';
import { dayMonth } from '../../components/invitations/sellSheets';

export const C12 = {
  title: 'What you can sell',
  sub: (brand, set, pct) => `${brand} · ${set}${pct != null ? ` · you earn ${pct}% on every sale` : ''}`,
  offers: (n) => `OFFERS · ${n}`,
  normal: (n) => `AT NORMAL PRICE · ${n}`,
  products: (n) => `${n} ${n === 1 ? 'product' : 'products'}`,
  ended: 'Ended',
  youEarn: 'You earn',
  normalRow: (n) => `${n} ${n === 1 ? 'product' : 'products'} · no offer`,
  hint: "When an offer ends, your posts using it leave the shop. Products at normal price keep selling until they're out of stock.",
  none: 'Nothing to sell here yet.',
  // Item 21 (board C4, C5)
  noCommission: 'No commission on these — your fee is your pay.',
  storeLine: 'Everything in the store: every offer and every product without an offer, including ones added later. An offer that ends leaves.',
  titlePosts: 'What you post about',
  runs: 'Runs', how: 'How it works for shoppers', gifts: (n) => `${n} ${n === 1 ? 'gift' : 'gifts'}`,
  more: (n) => `+${n}`,
};

function Thumbs({ items, testID }) {
  return (
    <View style={s.thumbs} testID={testID}>
      {items.map(p => (p.image_url
        ? <Image key={p.id} source={{ uri: p.image_url }} style={s.thumb} />
        : <View key={p.id} style={s.thumb} />))}
    </View>
  );
}

export default function CreatorSellScreen({ navigation, route }) {
  const { ciId } = route?.params || {};
  const [status, setStatus] = useState('loading');
  const [d, setD] = useState(null);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    setStatus(st => (st === 'ready' ? 'ready' : 'loading'));
    const r = await influencerApi.mySell(ciId);
    if (!r.success) { setStatus('error'); return; }
    setD(r.data); setStatus('ready');
  }, [ciId]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (status === 'loading') return <View style={base.screen}><Header title={C12.title} onBack={() => navigation.goBack()} /><Skeleton /></View>;
  if (status === 'error') return <View style={base.screen}><Header title={C12.title} onBack={() => navigation.goBack()} /><LoadError onRetry={load} /></View>;

  const list = (d.products && d.products.list) || [];
  return (
    <View style={base.screen} testID="creator-sell">
      <Header title={d.no_commission ? C12.titlePosts : C12.title} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <Text style={s.sub}>{C12.sub(d.brand_name, d.set_name, d.commission_pct)}</Text>
        {d.no_commission ? <Text style={s.sub} testID="no-commission">{C12.noCommission}</Text> : null}
        {d.store ? <Text style={s.sub} testID="store-line">{C12.storeLine}</Text> : null}
        {d.offers.length ? <Text style={s.eyebrow}>{C12.offers(d.offers.length)}</Text> : null}
        {d.offers.map(o => (
          <TouchableOpacity key={o.id} style={s.card} onPress={() => navigation.navigate('CreatorOffer', { ciId, offerId: o.id })} testID={`sell-offer-${o.id}`}>
            <View style={s.hd}>
              <View style={{ flex: 1 }}>
                <Text style={s.name}>{o.name}</Text>
                <Text style={s.meta}>{o.deal}</Text>
              </View>
              <Text style={[s.tag, o.display_status === 'ended' && s.tagEnded]}>{o.display_status === 'ended' ? C12.ended : o.type_label.split(' ·')[0]}</Text>
            </View>
            <Text style={s.meta}>{C12.products(o.products)} · {dayMonth(o.starts_on)} – {dayMonth(o.ends_on)}</Text>
            {o.thumbs && o.thumbs.length ? <Thumbs items={o.thumbs} /> : null}
            {o.you_earn ? <Text style={s.earn} testID={`earn-${o.id}`}>{C12.youEarn} · {o.you_earn.line}</Text> : null}
          </TouchableOpacity>
        ))}
        {d.products.count ? (
          <>
            <Text style={s.eyebrow}>{C12.normal(d.products.count)}</Text>
            <TouchableOpacity style={s.row} onPress={() => setOpen(v => !v)} testID="sell-normal">
              <View style={{ flex: 1 }}><Text style={s.name}>{C12.normalRow(d.products.count)}</Text></View>
              <Text style={s.chev}>{open ? '⌄' : '›'}</Text>
            </TouchableOpacity>
            {open ? list.map(p => (
              <View key={p.id} style={s.prow}><Text style={s.pname}>{p.name}</Text><Text style={s.meta}>{rupees5(p.price)}</Text></View>
            )) : null}
          </>
        ) : null}
        {!d.offers.length && !d.products.count ? <Text style={s.meta}>{C12.none}</Text> : null}
        <Text style={s.hint}>{C12.hint}</Text>
      </ScrollView>
    </View>
  );
}

export const s = StyleSheet.create({
  sub: { fontFamily: fonts.sansRegular, fontSize: 12, color: T.ink2, marginBottom: 10 },
  eyebrow: { fontFamily: fonts.sansBold, fontSize: 11, color: T.ink3, letterSpacing: 0.6, marginTop: 8, marginBottom: 8 },
  card: { borderWidth: 1, borderColor: T.border, borderRadius: 14, padding: 12, marginBottom: 10 },
  hd: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 4 },
  name: { fontFamily: fonts.sansBold, fontSize: 13.5, color: T.ink },
  meta: { fontFamily: fonts.sansRegular, fontSize: 12, color: T.ink2, marginTop: 2 },
  tag: { fontFamily: fonts.sansSemiBold, fontSize: 11, color: T.ink2, borderWidth: 1, borderColor: T.border, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3, overflow: 'hidden', marginLeft: 8 },
  tagEnded: { backgroundColor: T.state.ended.bg, color: T.state.ended.fg },
  thumbs: { flexDirection: 'row', marginTop: 8 },
  thumb: { width: 58, height: 74, borderRadius: 7, backgroundColor: T.surface, marginRight: 5 },
  earn: { fontFamily: fonts.sansBold, fontSize: 12, color: T.state.active.fg, marginTop: 8 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: T.border },
  chev: { fontSize: 16, color: T.ink3, marginLeft: 8 },
  prow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: T.border },
  pname: { fontFamily: fonts.sansSemiBold, fontSize: 12.5, color: T.ink, flex: 1, marginRight: 8 },
  hint: { fontFamily: fonts.sansRegular, fontSize: 12, color: T.ink2, marginTop: 14, lineHeight: 16 },
});
