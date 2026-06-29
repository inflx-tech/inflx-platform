/**
 * FollowerPageScreen — renders an admin-created GLOBAL custom page (App Builder E)
 * as a section stack, via the same generic <SectionItem> engine used by Home /
 * Brand store / Creator store. The 3rd tap-destination ③.
 *
 * Driven by followerApi.getPageSections(pageKey) → { page, sections }. A disabled
 * or deleted page returns page:null / sections:[] → friendly empty state (a stale
 * tap_destination never crashes). Contract: features/follower-page-builder.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { creatorVibe as C, fonts } from '../../theme/tokens';
import { followerApi } from '../../services/api';
import { SectionItem } from '../../components/SectionRenderer';
import { useAppLocation } from '../../contexts/LocationContext';

export default function FollowerPageScreen({ route, navigation }) {
  const { pageKey, title: routeTitle } = route.params || {};
  const { location } = useAppLocation();
  const [page, setPage] = useState(null);
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchPage = useCallback(async () => {
    try {
      const res = await followerApi.getPageSections(pageKey, location);
      const data = res?.data || res || {};
      setPage(data.page || null);
      setSections(Array.isArray(data.sections) ? data.sections : []);
    } catch (e) {
      console.warn('[FollowerPage] fetch failed', e?.message);
      setSections([]);
    }
  }, [pageKey, location]);

  useEffect(() => { setLoading(true); fetchPage().finally(() => setLoading(false)); }, [fetchPage]);
  const onRefresh = useCallback(async () => { setRefreshing(true); await fetchPage(); setRefreshing(false); }, [fetchPage]);

  const title = page?.title || routeTitle || page?.label || 'Page';

  return (
    <View style={s.root}>
      <SafeAreaView edges={['top']}>
        <View style={s.topbar}>
          <TouchableOpacity style={s.ib} onPress={() => navigation.goBack()}><Text style={s.ibTxt}>←</Text></TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={s.title} numberOfLines={1}>{title}</Text>
            {page?.subtitle ? <Text style={s.subtitle} numberOfLines={1}>{page.subtitle}</Text> : null}
          </View>
        </View>
      </SafeAreaView>

      {loading ? (
        <View style={[s.center, { flex: 1 }]}><ActivityIndicator size="large" color={C.brown} /></View>
      ) : sections.length === 0 ? (
        <View style={[s.center, { flex: 1 }]}>
          <Text style={s.emptyIcon}>🗂️</Text>
          <Text style={s.emptyTitle}>This page isn't available</Text>
          <Text style={s.emptyText}>It may have been moved or turned off.</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.brown} />}
        >
          {sections.map((sec, i) => (
            <SectionItem key={sec.key || `pg_${i}`} section={sec} navigation={navigation} />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.screenBg },
  center: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  topbar: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 },
  ib: { width: 34, height: 34, borderRadius: 17, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center' },
  ibTxt: { fontSize: 16, color: C.ink },
  title: { fontSize: 18, fontWeight: '800', color: C.ink, fontFamily: fonts.displayBold },
  subtitle: { fontSize: 11.5, color: C.muted, fontWeight: '600', marginTop: 1, fontFamily: fonts.sansMedium },
  emptyIcon: { fontSize: 46, marginBottom: 12 },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: C.ink, marginBottom: 6, fontFamily: fonts.displayBold },
  emptyText: { fontSize: 12.5, color: C.muted, textAlign: 'center', fontFamily: fonts.sansMedium },
});
