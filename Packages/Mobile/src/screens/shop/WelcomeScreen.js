/**
 * F1 Welcome (optional) — Women / Men / Kids, a few styles, and "Use my location" or "Pick my city".
 * Contract: features/follower-app-v2 · board F1 · rules v1.7 §5.3, §5.4
 *
 * Skippable and changeable later in Profile. The choices live on the phone (and on her account
 * once she signs in). The location is asked for here, used for the feed and never stored.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { followerApi } from '../../services/api';
import { CS } from '../../components/shop/copyShop';
import { Chip, PrimaryBtn, Loading, C } from '../../components/shop/bitsShop';
import { shopStore, askLocationPermission, currentPosition, isSignedIn } from '../../components/shop/shopStore';
import { fonts } from '../../theme/tokens';

export default function WelcomeScreen({ navigation, route }) {
  const fromProfile = !!(route && route.params && route.params.fromProfile);
  const [opts, setOpts] = useState(null);
  const [shopFor, setShopFor] = useState([]);
  const [styles, setStyles] = useState([]);
  const [cityId, setCityId] = useState(null);
  const [cityName, setCityName] = useState(null);
  const [useLoc, setUseLoc] = useState(false);
  const [locNote, setLocNote] = useState('');
  const [picking, setPicking] = useState(false);
  const [q, setQ] = useState('');

  useEffect(() => {
    (async () => {
      const [res, st] = await Promise.all([followerApi.welcome(), shopStore.get()]);
      if (res && res.success) setOpts(res.data);
      setShopFor(st.shopFor); setStyles(st.styles); setCityId(st.cityId); setCityName(st.cityName); setUseLoc(!!st.useLocation);
    })();
  }, []);

  const cities = useMemo(() => {
    const list = (opts && opts.cities) || [];
    const t = q.trim().toLowerCase();
    return (t ? list.filter((c) => c.name.toLowerCase().startsWith(t)) : list).slice(0, 40);
  }, [opts, q]);

  const toggle = (list, set, v) => set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  async function useMyLocation() {
    const ok = await askLocationPermission();
    if (!ok) { setUseLoc(false); setLocNote(CS.locationDenied); setPicking(true); return; }
    await shopStore.set({ useLocation: true });
    setUseLoc(true); setLocNote('');
    const pos = await currentPosition();
    if (pos) {
      const r = await followerApi.nearestCity(pos.lat, pos.lng);
      if (r && r.success && r.data.city_id) { setCityId(r.data.city_id); setCityName(r.data.city); }
    }
  }

  async function finish(skip) {
    const patch = skip ? { welcomed: true } : { shopFor, styles, cityId, cityName, useLocation: useLoc, welcomed: true };
    await shopStore.set(patch);
    if (!skip && (await isSignedIn())) {
      await followerApi.setPreferences({ shop_for: shopFor, style_tag_ids: styles, city_id: cityId, welcomed: true });
    }
    navigation.goBack();
  }

  if (!opts) return <SafeAreaView style={st.safe}><Loading /></SafeAreaView>;

  return (
    <SafeAreaView style={st.safe} edges={['top', 'bottom']}>
      <View style={st.top}>
        <Text style={st.wm}>{CS.wordmark}</Text>
        {!fromProfile ? <TouchableOpacity onPress={() => finish(true)} testID="welcome-skip"><Text style={st.skip}>{CS.skip}</Text></TouchableOpacity> : null}
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 18 }} keyboardShouldPersistTaps="handled">
        <Text style={st.h}>{CS.welcomeTitle}</Text>
        <View style={{ gap: 8 }}>
          <Text style={st.lbl}>{CS.shopFor}</Text>
          <View style={st.chips}>
            {opts.shop_for.map((x) => <Chip key={x.key} label={x.label} on={shopFor.includes(x.key)} onPress={() => toggle(shopFor, setShopFor, x.key)} testID={`shop-for-${x.key}`} />)}
          </View>
        </View>
        <View style={{ gap: 8 }}>
          <Text style={st.lbl}>{CS.styles}</Text>
          <View style={st.chips}>
            {opts.styles.map((x) => <Chip key={x.id} label={x.name} on={styles.includes(x.id)} onPress={() => toggle(styles, setStyles, x.id)} testID={`style-${x.name}`} />)}
          </View>
        </View>
        <View style={{ gap: 8 }}>
          <Text style={st.lbl}>{CS.myCity}</Text>
          <View style={st.chips}>
            <Chip label={useLoc ? `📍 ${CS.locationOn}` : `📍 ${CS.useLocation}`} on={useLoc} onPress={useMyLocation} testID="use-location" />
            <Chip label={cityName && !useLoc ? cityName : CS.pickCity} on={!useLoc && !!cityId} onPress={() => setPicking(true)} testID="pick-city" />
          </View>
          {useLoc && cityName ? <Text style={st.field}>{cityName}</Text> : null}
          {locNote ? <Text style={st.warn}>{locNote}</Text> : null}
          {picking ? (
            <View style={{ gap: 6 }}>
              <TextInput value={q} onChangeText={setQ} placeholder={CS.searchCity} placeholderTextColor={C.ink3} style={st.input} testID="city-search" />
              {cities.map((c) => (
                <TouchableOpacity key={c.id} style={st.cityRow} onPress={async () => { setCityId(c.id); setCityName(c.name); setUseLoc(false); await shopStore.set({ useLocation: false }); setPicking(false); setQ(''); }} testID={`city-${c.name}`}>
                  <Text style={st.cityName}>{c.name}</Text>
                  {c.state ? <Text style={st.cityState}>{c.state}</Text> : null}
                </TouchableOpacity>
              ))}
            </View>
          ) : null}
          <Text style={st.hint}>{opts.location_line}</Text>
        </View>
      </ScrollView>
      <View style={st.foot}>
        <PrimaryBtn label={CS.showFeed} onPress={() => finish(false)} testID="welcome-done" />
      </View>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, minHeight: 44 },
  wm: { fontFamily: fonts.sansBold, fontSize: 18, color: C.ink },
  skip: { fontFamily: fonts.sansBold, fontSize: 13.5, color: C.ink, textDecorationLine: 'underline' },
  h: { fontFamily: fonts.sansBold, fontSize: 22, color: C.ink, letterSpacing: -0.3 },
  lbl: { fontFamily: fonts.sansBold, fontSize: 13, color: C.ink },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  field: { borderWidth: 1.5, borderColor: C.border, borderRadius: 12, paddingHorizontal: 11, paddingVertical: 11, fontFamily: fonts.sansRegular, fontSize: 13.5, color: C.ink },
  input: { borderWidth: 1.5, borderColor: C.border, borderRadius: 12, paddingHorizontal: 11, height: 42, fontFamily: fonts.sansRegular, fontSize: 13.5, color: C.ink },
  cityRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: C.border },
  cityName: { fontFamily: fonts.sansSemiBold, fontSize: 13.5, color: C.ink },
  cityState: { fontFamily: fonts.sansRegular, fontSize: 12, color: C.ink3 },
  warn: { fontFamily: fonts.sansSemiBold, fontSize: 12, color: '#B04600' },
  hint: { fontFamily: fonts.sansRegular, fontSize: 11.5, color: C.ink2 },
  foot: { padding: 14, borderTopWidth: 1, borderTopColor: C.border },
});
