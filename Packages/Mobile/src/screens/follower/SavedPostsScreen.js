/**
 * SavedPostsScreen — Profile → Saved posts (Slice 1).
 * Contract: features/follower-profile-repairs/
 * Mockup: 04-preview/mockups/profile-repairs-comprehensive.html, frames 1-2.
 *
 * THE FAULT THIS FIXES: Profile's "Saved posts" row opened the legacy saved-
 * OFFERS list, while post_saves (mig 141) had been collecting rows since P3
 * with nothing anywhere reading them back. A follower could save a post and
 * never find it again.
 *
 * White law: white surface, black ink, grey hairlines. Two-up grid, newest save
 * first, honest empty state. Signed-in only — saved posts are personal, so this
 * screen is never reached as a guest.
 */
import React, { useState, useCallback } from 'react';
import {
  View, Text, Image, FlatList, TouchableOpacity, RefreshControl,
  ActivityIndicator, StyleSheet, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { followerApi } from '../../services/api';
import ErrorBoundary from '../../components/ErrorBoundary';

const GAP = 10;
const COL = (Dimensions.get('window').width - 16 * 2 - GAP) / 2;

function Card({ post, onOpen }) {
  const creator = post.creator || {};
  const initial = (creator.name || creator.handle || '?').trim().charAt(0).toUpperCase();
  const count = post.product_count || 0;
  return (
    <TouchableOpacity style={st.card} activeOpacity={0.85} onPress={onOpen}>
      <View style={st.shot}>
        {post.cover?.url
          ? <Image source={{ uri: post.cover.url }} style={st.img} resizeMode="cover" />
          : <View style={[st.img, st.imgFallback]} />}
        {post.media_kind === 'video' && (
          <View style={st.play}><Icon name="play" size={11} color="#FFF" /></View>
        )}
      </View>
      <View style={st.meta}>
        {creator.avatar
          ? <Image source={{ uri: creator.avatar }} style={st.av} />
          : <View style={st.avFallback}><Text style={st.avTxt}>{initial}</Text></View>}
        <Text style={st.who} numberOfLines={1}>{creator.handle || creator.name || 'Creator'}</Text>
        {count > 0 && <Text style={st.cnt}>{count} item{count === 1 ? '' : 's'}</Text>}
      </View>
    </TouchableOpacity>
  );
}

function SavedPostsInner({ navigation }) {
  const [posts, setPosts] = useState(null);      // null = first load
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    const res = await followerApi.getSavedPosts();
    setRefreshing(false);
    // On failure keep whatever is already on screen rather than flashing the
    // empty state — "you have saved nothing" is a lie when the network failed.
    setPosts(prev => (res?.success ? (res.data?.posts || []) : (prev || [])));
  }, []);

  // Reload on focus so an unsave made inside the viewer is reflected on return.
  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (posts === null) {
    return <View style={st.center}><ActivityIndicator color="#111" /></View>;
  }

  return (
    <SafeAreaView style={st.safe} edges={['top']}>
      <View style={st.nav}>
        <TouchableOpacity hitSlop={10} onPress={() => navigation.goBack()}>
          <Icon name="chevron-left" size={26} color="#111" />
        </TouchableOpacity>
        <Text style={st.title}>Saved posts</Text>
      </View>

      <FlatList
        data={posts}
        keyExtractor={p => p.id}
        numColumns={2}
        columnWrapperStyle={{ gap: GAP }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32, gap: GAP }}
        renderItem={({ item }) => (
          <Card post={item} onOpen={() => navigation.navigate('PostViewer', { postId: item.id })} />
        )}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
        ListEmptyComponent={(
          <View style={st.empty}>
            <View style={st.emptyIcon}><Icon name="bookmark-outline" size={22} color="#111" /></View>
            <Text style={st.emptyT}>Nothing saved yet</Text>
            <Text style={st.emptyS}>Posts you save will appear here, so you can come back to them later.</Text>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

export default function SavedPostsScreen(props) {
  return <ErrorBoundary><SavedPostsInner {...props} /></ErrorBoundary>;
}

const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFF' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF' },
  nav: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingTop: 8, paddingBottom: 10 },
  title: { fontSize: 17, fontWeight: '800', color: '#111' },

  card: { width: COL, borderWidth: 1, borderColor: '#EEE', borderRadius: 14, overflow: 'hidden' },
  shot: { width: '100%', height: COL * 1.05 },
  img: { width: '100%', height: '100%' },
  imgFallback: { backgroundColor: '#F5F2EC' },
  play: {
    position: 'absolute', right: 8, top: 8, width: 20, height: 20, borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center',
  },

  meta: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 9, paddingTop: 8, paddingBottom: 10 },
  av: { width: 18, height: 18, borderRadius: 9 },
  avFallback: { width: 18, height: 18, borderRadius: 9, backgroundColor: '#111', alignItems: 'center', justifyContent: 'center' },
  avTxt: { color: '#FFF', fontSize: 8.5, fontWeight: '800' },
  who: { flex: 1, fontSize: 10.5, fontWeight: '700', color: '#111' },
  cnt: { fontSize: 9.5, color: '#8A8A8A' },

  empty: { alignItems: 'center', paddingTop: 110, paddingHorizontal: 34 },
  emptyIcon: {
    width: 52, height: 52, borderRadius: 26, backgroundColor: '#FAFAFA',
    borderWidth: 1, borderColor: '#EEE', alignItems: 'center', justifyContent: 'center', marginBottom: 14,
  },
  emptyT: { fontSize: 14, fontWeight: '800', color: '#111', marginBottom: 6 },
  emptyS: { fontSize: 11.5, color: '#8A8A8A', textAlign: 'center', lineHeight: 18 },
});
