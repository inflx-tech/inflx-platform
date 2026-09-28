/**
 * CreatorOfferScreen — C3, one offer, read-only: the deal explained in shopper terms, when it
 * runs, what she earns on an example (founder Q3), and all its products. Nothing can be changed
 * or countered (rules 2.6).
 * Contract: features/creator-terms-v2 · rules Docs/OFFER_TERMS_POSTS_RULES.md §2.11
 */
import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, Image, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { settingsTokens as T, fonts } from '../../theme/tokens';
import { influencerApi } from '../../services/api';
import { Skeleton, LoadError } from '../../components/settings/feedback';
import { Header, s as base } from '../brand/BrandPitchSettingsScreen';
import { rupees5 } from '../../components/invitations/copy5';
import { dayMonth } from '../../components/invitations/sellSheets';
import { C12 } from './CreatorSellScreen';

export default function CreatorOfferScreen({ navigation, route }) {
  const { ciId, offerId } = route?.params || {};
  const [status, setStatus] = useState('loading');
  const [o, setO] = useState(null);

  const load = useCallback(async () => {
    setStatus(st => (st === 'ready' ? 'ready' : 'loading'));
    const r = await influencerApi.myOffer(ciId, offerId);
    if (!r.success) { setStatus('error'); return; }
    setO(r.data.offer); setStatus('ready');
  }, [ciId, offerId]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (status === 'loading') return <View style={base.screen}><Header title="Offer" onBack={() => navigation.goBack()} /><Skeleton /></View>;
  if (status === 'error') return <View style={base.screen}><Header title="Offer" onBack={() => navigation.goBack()} /><LoadError onRetry={load} /></View>;

  const shown = o.products.slice(0, 8);
  const names = o.products.slice(0, 3).map(p => p.name).join(' · ');
  return (
    <View style={base.screen} testID="creator-offer">
      <Header title={o.name} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <View style={s.how}>
          <Text style={s.howTitle}>{C12.how}</Text>
          <Text style={s.howText} testID="offer-how">{o.how}</Text>
        </View>
        <View style={s.line}><Text style={s.k}>{C12.runs}</Text><Text style={s.v}>{dayMonth(o.starts_on)} – {dayMonth(o.ends_on)} {String(o.ends_on).slice(0, 4)}</Text></View>
        {o.you_earn ? <View style={s.line}><Text style={s.k}>{C12.youEarn}</Text><Text style={s.v} testID="offer-earn">{o.you_earn.line}</Text></View> : null}
        {o.display_status === 'ended' ? <Text style={s.ended}>{C12.ended}</Text> : null}
        <Text style={s.eyebrow}>{C12.products(o.products.length).toUpperCase()}</Text>
        <View style={s.grid}>
          {shown.map(p => (p.image_url
            ? <Image key={p.id} source={{ uri: p.image_url }} style={s.tile} />
            : <View key={p.id} style={s.tile} />))}
        </View>
        <Text style={s.names}>{names}{o.products.length > 3 ? ` · ${C12.more(o.products.length - 3)}` : ''}</Text>
        {o.products.map(p => (
          <View key={p.id} style={s.prow}><Text style={s.pname}>{p.name}</Text><Text style={s.price}>{rupees5(p.price)}</Text></View>
        ))}
        {o.gifts && o.gifts.length ? (
          <>
            <Text style={s.eyebrow}>{C12.gifts(o.gifts.length).toUpperCase()}</Text>
            {o.gifts.map((g, i) => <View key={`${g.name}-${i}`} style={s.prow}><Text style={s.pname}>{g.name}</Text><Text style={s.price}>worth {rupees5(g.value)}</Text></View>)}
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  how: { backgroundColor: T.surface, borderRadius: 14, padding: 12, marginBottom: 12 },
  howTitle: { fontFamily: fonts.sansBold, fontSize: 13, color: T.ink, marginBottom: 4 },
  howText: { fontFamily: fonts.sansRegular, fontSize: 12.5, color: T.ink2, lineHeight: 18 },
  line: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  k: { fontFamily: fonts.sansRegular, fontSize: 12.5, color: T.ink2 },
  v: { fontFamily: fonts.sansBold, fontSize: 12.5, color: T.ink, textAlign: 'right', flex: 1, marginLeft: 10 },
  ended: { fontFamily: fonts.sansBold, fontSize: 12, color: T.state.ended.fg, marginTop: 4 },
  eyebrow: { fontFamily: fonts.sansBold, fontSize: 11, color: T.ink3, letterSpacing: 0.6, marginTop: 14, marginBottom: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  tile: { width: '23%', aspectRatio: 0.75, borderRadius: 7, backgroundColor: T.surface, marginRight: '2%', marginBottom: 6 },
  names: { fontFamily: fonts.sansRegular, fontSize: 12, color: T.ink2, marginBottom: 6 },
  prow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: T.border },
  pname: { fontFamily: fonts.sansSemiBold, fontSize: 12.5, color: T.ink, flex: 1, marginRight: 8 },
  price: { fontFamily: fonts.sansRegular, fontSize: 12, color: T.ink2 },
});
