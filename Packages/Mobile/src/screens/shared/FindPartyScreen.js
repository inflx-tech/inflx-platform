/**
 * FindPartyScreen — a minimal name search that opens X1 (a brand, from the creator app) or
 * X4 (a creator, from the brand app). Contract: features/item2-pitch-invitation-settings
 *
 * WHY THIS EXISTS. Both phone apps were cut to their profile on 2026-09-10, so there is no
 * way to reach a brand overview or a creator profile — and the founder's checks 1, 4, 5, 6
 * and 17 need someone to open one on a real phone. This is the smallest possible door: a
 * search box and a list. Item 3 replaces it with the real Find screens; nothing else
 * depends on it. Both lists come from endpoints that already exist.
 */

import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { settingsTokens as T, fonts } from '../../theme/tokens';
import { api } from '../../services/api';
import { Header, s as base } from '../brand/BrandPitchSettingsScreen';
import { Avatar, bl } from '../brand/BrandBlockedCreatorsScreen';

export default function FindPartyScreen({ navigation, route }) {
  const mode = route?.params?.mode === 'creators' ? 'creators' : 'brands';
  const [q, setQ] = useState('');
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const timer = useRef(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(run, 350);
    return () => clearTimeout(timer.current);
  }, [q]); // eslint-disable-line

  async function run() {
    setBusy(true); setErr('');
    const term = encodeURIComponent(q.trim());
    const r = mode === 'brands'
      ? await api.get(`/influencers/me/discover-brands${term ? `?search=${term}` : ''}`)
      : await api.get(`/influencers/search?limit=30${term ? `&q=${term}` : ''}`);
    setBusy(false);
    if (!r.success) { setErr(r.error?.message || 'Could not load'); setRows([]); return; }
    if (mode === 'brands') {
      setRows((r.data.brands || []).map(b => ({ id: b.id, name: b.business_name, sub: [b.category, b.brand_city].filter(Boolean).join(' · '), img: b.logo_url })));
    } else {
      const list = r.data.creators || r.data.influencers || [];
      setRows(list.map(i => ({
        id: i.linked_influencer_id || i.row_id || i.id,
        name: i.full_name || i.name || (i.ig_handle ? `@${i.ig_handle}` : i.instagram_handle ? `@${i.instagram_handle}` : 'Creator'),
        sub: [i.city, i.followers_count != null ? `${i.followers_count} followers` : null].filter(Boolean).join(' · '),
        img: i.profile_pic_url || i.profile_image_url,
        source: i.source,
      })).filter(x => x.id && x.source !== 'scraped'));
    }
  }

  function open(row) {
    if (mode === 'brands') navigation.navigate('BrandOverview', { brandId: row.id });
    else navigation.navigate('BrandCreatorProfile', { influencerId: row.id });
  }

  return (
    <View style={base.screen}>
      <Header title={mode === 'brands' ? 'Find a brand' : 'Find a creator'} onBack={() => navigation.goBack()} />
      <View style={{ padding: 18 }}>
        <TextInput style={fp.search} value={q} onChangeText={setQ} placeholder={mode === 'brands' ? 'Search brands by name' : 'Search creators by name'} placeholderTextColor={T.ink3} autoCorrect={false} testID="find-search" />
        {err ? <Text style={fp.err}>{err}</Text> : null}
        <FlatList
          data={rows}
          keyExtractor={r => String(r.id)}
          style={{ marginTop: 8 }}
          ListEmptyComponent={busy ? null : <Text style={base.hint}>{q ? 'No results.' : 'Type a name to search.'}</Text>}
          renderItem={({ item }) => (
            <TouchableOpacity style={bl.row} onPress={() => open(item)} testID={`find-row-${item.id}`}>
              <Avatar name={item.name} url={item.img} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={bl.name}>{item.name}</Text>
                {item.sub ? <Text style={bl.sub}>{item.sub}</Text> : null}
              </View>
              <Text style={fp.chev}>›</Text>
            </TouchableOpacity>
          )}
        />
      </View>
    </View>
  );
}

const fp = StyleSheet.create({
  search: { fontFamily: fonts.sansRegular, borderWidth: 1, borderColor: T.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: T.ink, backgroundColor: T.surface },
  err: { fontFamily: fonts.sansMedium, fontSize: 12, color: T.danger, marginTop: 8 },
  chev: { fontFamily: fonts.sansBold, fontSize: 18, color: T.ink3 },
});
