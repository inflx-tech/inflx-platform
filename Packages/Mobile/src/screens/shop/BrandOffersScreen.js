/**
 * F10 Brand store · Offers — the four filters (offer type, price band, category, theme); each offer
 * says how many posts carry it; tapping one shows those posts. Offers with no live posts aren't
 * listed: every purchase goes through a post, so the creator is credited.
 * Contract: features/follower-app-v2 · board F10 · rules v1.7 §5.10
 */
import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { followerApi } from '../../services/api';
import { CS } from '../../components/shop/copyShop';
import { TopBar, Loading, Empty, Chip, C } from '../../components/shop/bitsShop';
import { fonts } from '../../theme/tokens';

function Picker({ label, options, value, onChange, testID }) {
  const [open, setOpen] = useState(false);
  const cur = options.find((o) => o.id === value);
  return (
    <View>
      <Chip label={`${cur ? cur.label : label} ▾`} on={!!cur} onPress={() => setOpen(!open)} testID={testID} />
      {open ? (
        <View style={st.menu}>
          <TouchableOpacity onPress={() => { onChange(null); setOpen(false); }} style={st.menuRow}><Text style={st.menuText}>{CS.all}</Text></TouchableOpacity>
          {options.map((o) => (
            <TouchableOpacity key={o.id} onPress={() => { onChange(o.id); setOpen(false); }} style={st.menuRow} testID={`${testID}-${o.label}`}>
              <Text style={[st.menuText, o.id === value && { fontFamily: fonts.sansBold }]}>{o.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}
    </View>
  );
}

export default function BrandOffersScreen({ navigation, route }) {
  const { id, name } = route.params || {};
  const [words, setWords] = useState(null);
  const [cats, setCats] = useState([]);
  const [filters, setFilters] = useState({ type: null, band: null, category: null, theme: null });
  const [list, setList] = useState(null);

  useEffect(() => {
    (async () => {
      const [w, b] = await Promise.all([followerApi.filters(), followerApi.brandStore(id)]);
      if (w && w.success) setWords(w.data);
      if (b && b.success) setCats(b.data.categories.map((c) => ({ id: c.id, label: c.name })));
    })();
  }, [id]);

  useEffect(() => {
    (async () => {
      setList(null);
      const r = await followerApi.brandOffers(id, { type: filters.type || undefined, band: filters.band || undefined, category: filters.category || undefined, theme: filters.theme || undefined });
      setList(r && r.success ? r.data.offers : []);
    })();
  }, [id, filters]);

  const set = (k) => (v) => setFilters((f) => ({ ...f, [k]: v }));

  return (
    <SafeAreaView style={st.safe} edges={['top']}>
      <TopBar title={CS.offersTitle(name || '')} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={{ padding: 14, gap: 12, paddingBottom: 30 }}>
        {words ? (
          <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
              <Chip label={CS.all} on={!filters.type} onPress={() => set('type')(null)} testID="type-all" />
              {words.types.map((t) => <Chip key={t.key} label={t.label} on={filters.type === t.key} onPress={() => set('type')(t.key)} testID={`type-${t.key}`} />)}
            </ScrollView>
            <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
              <Picker label={CS.price} options={words.price_bands.map((b) => ({ id: b.id, label: b.label }))} value={filters.band} onChange={set('band')} testID="f-price" />
              <Picker label={CS.category} options={cats} value={filters.category} onChange={set('category')} testID="f-category" />
              <Picker label={CS.theme} options={words.themes.map((t) => ({ id: t.id, label: t.name }))} value={filters.theme} onChange={set('theme')} testID="f-theme" />
            </View>
          </>
        ) : null}
        {list === null ? <Loading /> : list.length === 0 ? <Empty title={CS.noOffers} testID="offers-empty" /> : list.map((o) => (
          <TouchableOpacity key={o.id} style={st.offer} onPress={() => navigation.navigate('OfferPosts', { brandId: id, offerId: o.id, title: o.name })} testID={`offer-${o.id}`}>
            <View style={st.badge}><Text style={st.badgeText} numberOfLines={2}>{o.badge || '%'}</Text></View>
            <View style={{ flex: 1, gap: 1 }}>
              <Text style={st.name}>{o.name}</Text>
              <Text style={st.line}>{o.line}</Text>
            </View>
            <Text style={st.chev}>›</Text>
          </TouchableOpacity>
        ))}
        <Text style={st.foot}>{CS.offersFoot}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  menu: { position: 'absolute', top: 38, left: 0, zIndex: 10, elevation: 10, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: C.border, paddingVertical: 4, minWidth: 170 },
  menuRow: { paddingHorizontal: 12, paddingVertical: 9 },
  menuText: { fontFamily: fonts.sansRegular, fontSize: 13, color: C.ink },
  offer: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 11 },
  badge: { width: 54, minHeight: 40, borderRadius: 10, backgroundColor: C.primarySoft, alignItems: 'center', justifyContent: 'center', padding: 4 },
  badgeText: { fontFamily: fonts.sansBold, fontSize: 10, color: C.ink, textAlign: 'center' },
  name: { fontFamily: fonts.sansBold, fontSize: 13, color: C.ink },
  line: { fontFamily: fonts.sansRegular, fontSize: 11.5, color: C.ink2 },
  chev: { fontSize: 18, color: C.ink3 },
  foot: { fontFamily: fonts.sansRegular, fontSize: 11.5, color: C.ink2 },
});
