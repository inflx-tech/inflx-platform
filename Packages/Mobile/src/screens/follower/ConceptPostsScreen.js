/**
 * ConceptPostsScreen — Stage B3: a banner's landing page. The posts feed
 * filtered to ONE concept (or collection) — the existing server filter, so
 * every post here honestly satisfies the banner's promise. Reuses the feed
 * card + shop sheet rails wholesale.
 * Contract: features/concept-stageb-discover/.
 */
import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, Alert, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { followerApi } from '../../services/api';
import PostCard from '../../components/posts/PostCard';
import ShopThisPostSheet from '../../components/posts/ShopThisPostSheet';

const PAGE = 20;

export default function ConceptPostsScreen({ navigation, route }) {
  const { conceptId, collectionId, creatorHandle, title, count } = route.params || {};
  const [posts, setPosts] = useState(null);
  const [end, setEnd] = useState(false);
  const [shopPost, setShopPost] = useState(null);

  const load = useCallback(async (offset = 0) => {
    const res = await followerApi.getPosts({
      limit: PAGE, offset,
      concept_id: conceptId || null, collection_id: collectionId || null,
      creator: creatorHandle || null,   // B4: a creator-page banner shows THEIR posts only
    });
    if (res.success) {
      const page = res.data?.posts || [];
      setEnd(page.length < PAGE);
      setPosts((prev) => (offset === 0 ? page : [...(prev || []), ...page]));
    } else if (posts == null) setPosts([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conceptId, collectionId, creatorHandle]);
  useEffect(() => { load(0); }, [load]);

  async function toggle(post, kind) {
    const on = kind === 'like' ? post.liked : post.saved;
    const call = kind === 'like'
      ? (on ? followerApi.unlikePost : followerApi.likePost)
      : (on ? followerApi.unsavePost : followerApi.savePost);
    const res = await call(post.id);
    if (!res.success) {
      if (res.error?.code === 'UNAUTHORIZED') {
        Alert.alert('Login needed', 'Log in to like and save posts.', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Login', onPress: () => navigation.navigate('FollowerLogin') },
        ]);
      }
      return;
    }
    setPosts((ps) => ps.map((p) => p.id !== post.id ? p : (kind === 'like'
      ? { ...p, liked: !on, like_count: res.data.like_count }
      : { ...p, saved: !on, save_count: res.data.save_count })));
  }

  async function openShop(post) {
    setShopPost({ ...post, products: null, __loading: true });
    const res = await followerApi.getPost(post.id);
    if (res.success) setShopPost(res.data.post);
    else { setShopPost(null); Alert.alert('Unavailable', 'This post is no longer available.'); }
  }

  return (
    <SafeAreaView style={st.safe} edges={['top']}>
      <View style={st.hdr}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10}><Text style={st.back}>‹</Text></TouchableOpacity>
        <View>
          <Text style={st.title} numberOfLines={1}>{title || 'Posts'}</Text>
          <Text style={st.sub}>{posts ? `${posts.length}${end ? '' : '+'} posts` : count ? `${count} posts` : ''}</Text>
        </View>
      </View>
      {posts == null ? (
        <View style={st.center}><ActivityIndicator color="#111" /></View>
      ) : posts.length === 0 ? (
        <View style={st.center}>
          <Text style={st.emptyTitle}>Nothing here right now</Text>
          <Text style={st.emptySub}>Posts for this pick sold out or went offline — check back soon.</Text>
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(p) => p.id}
          renderItem={({ item }) => (
            <PostCard
              post={item}
              onOpen={() => navigation.navigate('PostViewer', { postId: item.id })}
              onShop={() => openShop(item)}
              onLike={() => toggle(item, 'like')}
              onSave={() => toggle(item, 'save')}
              onCreator={() => item.creator?.handle && navigation.navigate('InfluencerStore', { handle: item.creator.handle })}
            />
          )}
          onEndReached={() => { if (!end) load(posts.length); }}
          onEndReachedThreshold={0.6}
        />
      )}
      <ShopThisPostSheet
        visible={!!shopPost}
        post={shopPost}
        loading={!!shopPost?.__loading}
        onClose={() => setShopPost(null)}
        onOpenProduct={(p) => {
          if (p === '__bag__') { setShopPost(null); navigation.navigate('Cart'); return; }
          setShopPost(null);
          navigation.navigate('PostProduct', { p });
        }}
      />
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFF' },
  hdr: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 10 },
  back: { fontSize: 24, fontWeight: '700', color: '#111', marginTop: -2 },
  title: { fontSize: 16, fontWeight: '800', color: '#111', maxWidth: 300 },
  sub: { fontSize: 11.5, color: '#8A8A8A', fontWeight: '600', marginTop: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  emptyTitle: { fontSize: 15, fontWeight: '800', color: '#111' },
  emptySub: { fontSize: 12, color: '#9A9A9A', textAlign: 'center', marginTop: 6, lineHeight: 18 },
});
