/**
 * F12 Search — "Search or enter a post code". A code opens exactly that post; anything else searches
 * creators, brands and posts. Capitals don't matter.
 * Contract: features/follower-app-v2 · board F12 · rules v1.7 §5.11, §4.14
 */
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { followerApi } from '../../services/api';
import { CS } from '../../components/shop/copyShop';
import { Avatar, TileGrid, PrimaryBtn, Loading, C } from '../../components/shop/bitsShop';
import { useShopNav } from '../../components/shop/useShopNav';
import { ensureDeviceHeader } from '../../components/shop/shopStore';
import { fonts } from '../../theme/tokens';

const CODE = /^[BCDFGHJKMNPQRSTVWXYZ2-9]{6}$/i;

export default function SearchScreen({ navigation }) {
  const nav = useShopNav(navigation);
  const [q, setQ] = useState('');
  const [res, setRes] = useState(null);
  const [busy, setBusy] = useState(false);
  const timer = useRef(null);

  useEffect(() => { ensureDeviceHeader(); }, []);
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    const text = q.trim();
    if (!text) { setRes(null); return undefined; }
    timer.current = setTimeout(async () => {
      setBusy(true);
      const r = await followerApi.search(text);
      setBusy(false);
      setRes(r && r.success ? r.data : { creators: [], brands: [], posts: [] });
    }, CODE.test(text) ? 0 : 350);
    return () => clearTimeout(timer.current);
  }, [q]);

  const code = res && res.code_match;
  const nothing = res && !code && !res.creators.length && !res.brands.length && !res.posts.length;

  return (
    <SafeAreaView style={st.safe} edges={['top']}>
      <View style={st.bar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={st.ic} testID="back"><Text style={st.icText}>‹</Text></TouchableOpacity>
        <TextInput value={q} onChangeText={setQ} placeholder={CS.searchPlaceholder} placeholderTextColor={C.ink3} autoFocus
          autoCapitalize="characters" autoCorrect={false} style={st.input} testID="search-input" returnKeyType="search" />
      </View>
      <ScrollView contentContainerStyle={{ padding: 14, gap: 14, paddingBottom: 30 }} keyboardShouldPersistTaps="handled">
        {!q.trim() ? (
          <View style={{ gap: 6 }}>
            <Text style={st.mut}>{CS.searchHint}</Text>
            <Text style={st.lbl}>{CS.orSearchFor}</Text>
            <Text style={st.b}>{CS.searchWhat}</Text>
            <Text style={st.mut}>{CS.searchExample}</Text>
          </View>
        ) : busy && !res ? <Loading /> : null}
        {code ? (
          code.state === 'live' ? (
            <View style={st.match} testID="code-match">
              <Text style={st.eyebrow}>{CS.codeMatch}</Text>
              <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                <Avatar uri={code.post.creator.avatar} name={code.post.creator.name} size={40} />
                <View style={{ flex: 1 }}>
                  <Text style={st.b}>{code.post.title}{code.post.offer ? ` · ${code.post.offer.deal || code.post.offer.badge}` : ''}</Text>
                  <Text style={st.mut}>{code.post.creator.name} · {code.post.brand.name} · {CS.items(code.post.products.length)}</Text>
                </View>
              </View>
              <PrimaryBtn label={CS.openPost} onPress={() => nav.openPost(code.post)} testID="code-open" />
            </View>
          ) : (
            <View style={st.match} testID="code-other">
              <Text style={st.b}>{code.message}</Text>
              {code.creator ? <PrimaryBtn secondary label={`See ${code.creator.name.split(' ')[0]}'s store`} onPress={() => nav.openCreator(code.creator)} /> : null}
            </View>
          )
        ) : null}
        {res && res.creators.length ? (
          <View style={{ gap: 4 }}>
            <Text style={st.lbl}>{CS.creators}</Text>
            {res.creators.map((c) => (
              <TouchableOpacity key={c.id} style={st.row} onPress={() => nav.openCreator(c)} testID={`result-creator-${c.id}`}>
                <Avatar uri={c.avatar} name={c.name} size={34} />
                <View style={{ flex: 1 }}><Text style={st.b}>{c.name}</Text><Text style={st.mut}>{[c.handle && `@${c.handle}`, c.city].filter(Boolean).join(' · ')}</Text></View>
              </TouchableOpacity>
            ))}
          </View>
        ) : null}
        {res && res.brands.length ? (
          <View style={{ gap: 4 }}>
            <Text style={st.lbl}>{CS.brands}</Text>
            {res.brands.map((b) => (
              <TouchableOpacity key={b.id} style={st.row} onPress={() => nav.openBrand(b)} testID={`result-brand-${b.id}`}>
                <Avatar uri={b.logo} name={b.name} size={34} square />
                <View style={{ flex: 1 }}><Text style={st.b}>{b.name}</Text>{b.city ? <Text style={st.mut}>{b.city}</Text> : null}</View>
              </TouchableOpacity>
            ))}
          </View>
        ) : null}
        {res && res.posts.length ? (
          <View style={{ gap: 6 }}>
            <Text style={st.lbl}>{CS.posts}</Text>
            <TileGrid posts={res.posts} onOpen={nav.openPost} testIDPrefix="result-post" />
          </View>
        ) : null}
        {nothing ? <Text style={st.mut} testID="search-nothing">{CS.noResults}</Text> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 6 },
  ic: { width: 32, height: 32, borderRadius: 10, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  icText: { fontSize: 17, color: C.ink, fontFamily: fonts.sansBold },
  input: { flex: 1, height: 40, borderRadius: 12, backgroundColor: C.surface, paddingHorizontal: 11, fontFamily: fonts.sansSemiBold, fontSize: 14, color: C.ink },
  mut: { fontFamily: fonts.sansRegular, fontSize: 12, color: C.ink2 },
  lbl: { fontFamily: fonts.sansBold, fontSize: 10.5, letterSpacing: 0.6, color: C.ink3, textTransform: 'uppercase' },
  b: { fontFamily: fonts.sansBold, fontSize: 13.5, color: C.ink },
  eyebrow: { fontFamily: fonts.sansBold, fontSize: 10.5, letterSpacing: 0.8, color: '#1A7A3D' },
  match: { borderWidth: 1.5, borderColor: C.ink, borderRadius: 14, padding: 12, gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.border },
});
