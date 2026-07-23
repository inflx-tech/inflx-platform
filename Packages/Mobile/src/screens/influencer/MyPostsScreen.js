/**
 * MyPostsScreen — the creator's published-post ledger (Post/Concept P2).
 * Contract: features/concept-p2-posts/.
 *
 * Statuses are the moderation lifecycle only (submitted → approved|rejected);
 * "gone dark" (approved but no attached product still satisfies the concept)
 * arrives with the P4 eligibility engine.
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, Image, TouchableOpacity, RefreshControl, StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { influencerApi } from '../../services/api';

const STATUS_META = {
  submitted: { label: 'In review', bg: '#FFF4D6', fg: '#8A6D00' },
  approved: { label: 'Live', bg: '#DFF5E4', fg: '#1D7A38' },
  rejected: { label: 'Rejected', bg: '#FDE3E3', fg: '#B3261E' },
  draft: { label: 'Draft', bg: '#EEE', fg: '#777' },
};

export default function MyPostsScreen({ navigation }) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await influencerApi.getMyPosts();
    setLoading(false);
    if (res.success) setPosts(res.data?.posts || []);
  }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <SafeAreaView style={st.safe}>
      <View style={st.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}><Text style={st.back}>‹</Text></TouchableOpacity>
        <Text style={st.hTitle}>My Posts</Text>
        <TouchableOpacity onPress={() => navigation.navigate('PostComposer')}>
          <Text style={st.newBtn}>＋</Text>
        </TouchableOpacity>
      </View>
      <FlatList
        data={posts}
        keyExtractor={p => p.id}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
        contentContainerStyle={{ padding: 16 }}
        ListEmptyComponent={!loading && (
          <View style={st.empty}>
            <Text style={st.emptyTitle}>No posts yet</Text>
            <Text style={st.emptySub}>Your shoppable posts appear here with their review status.</Text>
            <TouchableOpacity style={st.cta} onPress={() => navigation.navigate('PostComposer')}>
              <Text style={st.ctaTxt}>Create your first post</Text>
            </TouchableOpacity>
          </View>
        )}
        renderItem={({ item }) => {
          const meta = STATUS_META[item.status] || STATUS_META.draft;
          const cover = item.media?.[0];
          return (
            <View style={st.card}>
              {cover
                ? <Image source={{ uri: cover.url }} style={st.cover} />
                : <View style={[st.cover, { backgroundColor: '#F2F2F2' }]} />}
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={st.concept} numberOfLines={1}>
                  {item.concept?.name || item.collection?.name || '—'}
                </Text>
                <Text style={st.metaLine}>
                  {item.media?.length || 0} slide{(item.media?.length || 0) === 1 ? '' : 's'} · {item.products?.length || 0} product{(item.products?.length || 0) === 1 ? '' : 's'}
                </Text>
                <View style={[st.pill, { backgroundColor: meta.bg }]}>
                  <Text style={[st.pillTxt, { color: meta.fg }]}>{meta.label}</Text>
                </View>
                {item.status === 'rejected' && item.reject_reason && (
                  <Text style={st.reason} numberOfLines={2}>“{item.reject_reason}”</Text>
                )}
              </View>
            </View>
          );
        }}
      />
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  back: { fontSize: 30, color: '#1A1A1A', width: 24 },
  hTitle: { fontSize: 16, fontWeight: '800', color: '#1A1A1A' },
  newBtn: { fontSize: 24, color: '#1A1A1A', width: 24, textAlign: 'right' },
  empty: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 24 },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: '#1A1A1A' },
  emptySub: { fontSize: 12.5, color: '#777', textAlign: 'center', marginTop: 6, lineHeight: 18 },
  cta: { backgroundColor: '#1A1A1A', borderRadius: 14, paddingHorizontal: 22, paddingVertical: 13, marginTop: 18 },
  ctaTxt: { color: '#F6B11E', fontWeight: '800', fontSize: 13.5 },
  card: { flexDirection: 'row', borderWidth: 1, borderColor: '#EFEFEF', borderRadius: 14, padding: 10, marginBottom: 10 },
  cover: { width: 64, height: 80, borderRadius: 10 },
  concept: { fontSize: 13.5, fontWeight: '800', color: '#1A1A1A' },
  metaLine: { fontSize: 11.5, color: '#999', marginTop: 2 },
  pill: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3, marginTop: 6 },
  pillTxt: { fontSize: 10.5, fontWeight: '800' },
  reason: { fontSize: 11, color: '#B3261E', marginTop: 5, fontStyle: 'italic' },
});
