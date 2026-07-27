import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, Image, TouchableOpacity, RefreshControl, StyleSheet, ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { ig, IG_TONE } from '../../theme/ig';
import { influencerApi } from '../../services/api';

/* ════════════════════════════════════════════════════════════════════════
   CreateScreen — features/create-tab. The Create tab root: New Post CTA +
   the IG-clean My Posts ledger. Reuses getMyPosts + the existing PostComposer.
   ══════════════════════════════════════════════════════════════════════ */

// Pure, testable: moderation status → { label, tone }.
export function postStatusMeta(status) {
  switch (status) {
    case 'submitted': return { label: 'In review', tone: 'you' };
    case 'approved':  return { label: 'Live', tone: 'done' };
    case 'rejected':  return { label: 'Rejected', tone: 'closed' };
    default:          return { label: 'Draft', tone: 'neutral' };
  }
}

export default function CreateScreen({ navigation }) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError(false);
    const res = await influencerApi.getMyPosts();
    setLoading(false);
    if (res.success) setPosts(res.data?.posts || []);
    else setError(true);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  const onRefresh = useCallback(async () => { setRefreshing(true); await load(); setRefreshing(false); }, [load]);

  const openComposer = () => navigation.navigate('PostComposer');

  const renderItem = ({ item }) => {
    const meta = postStatusMeta(item.status);
    const tone = IG_TONE[meta.tone] || IG_TONE.neutral;
    const cover = item.media?.[0];
    const slides = item.media?.length || 0;
    const prods = item.products?.length || 0;
    return (
      <View style={st.row}>
        {cover ? <Image source={{ uri: cover.url }} style={st.cover} /> : <View style={[st.cover, st.coverBlank]} />}
        <View style={st.mid}>
          <Text style={st.title} numberOfLines={1}>{item.concept?.name || item.collection?.name || 'Post'}</Text>
          <Text style={st.metaLine}>{slides} slide{slides === 1 ? '' : 's'} · {prods} product{prods === 1 ? '' : 's'}</Text>
          {item.status === 'rejected' && item.reject_reason
            ? <Text style={st.reason} numberOfLines={2}>{item.reject_reason}</Text> : null}
          {item.status === 'rejected'
            ? <TouchableOpacity onPress={openComposer}><Text style={st.retry}>Try again</Text></TouchableOpacity> : null}
        </View>
        <View style={st.status}>
          <View style={[st.dot, { backgroundColor: tone.dot }]} />
          <Text style={[st.statusTxt, { color: tone.fg }]}>{meta.label}</Text>
        </View>
      </View>
    );
  };

  return (
    <View style={st.container}>
      <View style={st.header}>
        <Text style={st.hTitle}>Create</Text>
        <Text style={st.hSub}>Turn products into shoppable posts</Text>
      </View>

      <FlatList
        data={posts}
        keyExtractor={p => String(p.id)}
        renderItem={renderItem}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ig.text} />}
        ListHeaderComponent={
          <View>
            <TouchableOpacity style={st.cta} activeOpacity={0.9} onPress={openComposer}>
              <View style={st.ctaIco}><Icon name="camera-plus-outline" size={22} color="#fff" /></View>
              <View style={{ flex: 1 }}>
                <Text style={st.ctaTitle}>New Post</Text>
                <Text style={st.ctaSub}>Concept → photos → tag products</Text>
              </View>
              <Icon name="chevron-right" size={20} color="#fff" />
            </TouchableOpacity>
            {/* B4 — arrange the follower-facing store (sections/covers/order) */}
            <TouchableOpacity style={st.storeCta} activeOpacity={0.85} onPress={() => navigation.navigate('MyStore')}>
              <Icon name="storefront-outline" size={20} color="#111" />
              <View style={{ flex: 1 }}>
                <Text style={st.storeCtaTitle}>My Store</Text>
                <Text style={st.storeCtaSub}>Arrange what followers see first</Text>
              </View>
              <Icon name="chevron-right" size={18} color="#111" />
            </TouchableOpacity>
            {posts.length > 0 && <Text style={st.lab}>My Posts · {posts.length}</Text>}
          </View>
        }
        ListEmptyComponent={loading ? (
          <View style={st.center}><ActivityIndicator color={ig.text} /></View>
        ) : (
          <View style={st.empty}>
            <Icon name={error ? 'alert-circle-outline' : 'image-plus'} size={30} color={ig.mut2} />
            <Text style={st.emptyTitle}>{error ? 'Could not load posts' : 'No posts yet'}</Text>
            <Text style={st.emptySub}>{error ? 'Pull to retry.' : 'Your shoppable posts appear here with their review status.'}</Text>
          </View>
        )}
        contentContainerStyle={{ padding: 16, paddingTop: 12 }}
      />
    </View>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: ig.bg },
  header: { paddingHorizontal: 16, paddingTop: 50, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: ig.line },
  hTitle: { fontSize: 24, fontWeight: '800', color: ig.text, letterSpacing: -0.3 },
  hSub: { fontSize: 12, color: ig.mut, marginTop: 2 },

  cta: { flexDirection: 'row', alignItems: 'center', gap: 13, backgroundColor: ig.text, borderRadius: 14, padding: 15, marginBottom: 4 },
  ctaIco: { width: 42, height: 42, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' },
  ctaTitle: { color: '#fff', fontWeight: '800', fontSize: 15 },
  ctaSub: { color: 'rgba(255,255,255,0.65)', fontSize: 11.5, marginTop: 2 },

  lab: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase', color: ig.mut, marginTop: 20, marginBottom: 6 },
  storeCta: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1.5, borderColor: '#111', borderRadius: 14, padding: 13, marginTop: 8 },
  storeCtaTitle: { fontSize: 14, fontWeight: '800', color: '#111' },
  storeCtaSub: { fontSize: 11, color: '#777', marginTop: 1 },

  row: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: ig.line, borderRadius: 13, padding: 10, marginTop: 8 },
  cover: { width: 52, height: 66, borderRadius: 9 },
  coverBlank: { backgroundColor: ig.bgSoft, borderWidth: 1, borderColor: ig.lineSoft },
  mid: { flex: 1, minWidth: 0 },
  title: { fontSize: 13.5, fontWeight: '700', color: ig.text },
  metaLine: { fontSize: 11, color: ig.mut, marginTop: 2 },
  reason: { fontSize: 11, color: ig.red, marginTop: 4 },
  retry: { fontSize: 11.5, fontWeight: '700', color: ig.text, marginTop: 5 },
  status: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  statusTxt: { fontSize: 10.5, fontWeight: '700' },

  center: { paddingVertical: 50, alignItems: 'center' },
  empty: { alignItems: 'center', paddingTop: 50, paddingHorizontal: 24 },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: ig.text, marginTop: 12 },
  emptySub: { fontSize: 12.5, color: ig.mut, textAlign: 'center', marginTop: 5, lineHeight: 18 },
});
