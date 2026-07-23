/**
 * PostViewerScreen — full-screen immersive post (Post/Concept Stage A).
 * Contract: features/concept-stagea-posts-ui/.
 *
 * Locked grammar (founder 2026-07-23): concept name as header context,
 * creator row, TRUE-ratio carousel with runtime price tags per the
 * creator's tag style, Reels-style vertical RIGHT RAIL (like/comment/
 * share/save with counts), yellow Shop bar, full caption. Tag data is
 * live-joined server-side — a price change renders on next open, no
 * republish ever.
 */
import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, Image, FlatList, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert, Dimensions, StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { followerApi } from '../../services/api';
import { Pin, ShopBar, CreatorRow, YELLOW } from '../../components/posts/PostCard';
import ShopThisPostSheet from '../../components/posts/ShopThisPostSheet';

const WIN = Dimensions.get('window');

export default function PostViewerScreen({ navigation, route }) {
  const { postId } = route.params || {};
  const [post, setPost] = useState(null);
  const [missing, setMissing] = useState(false);
  const [slide, setSlide] = useState(0);
  const [shopOpen, setShopOpen] = useState(false);

  useEffect(() => {
    followerApi.getPost(postId).then(res => {
      if (res.success) setPost(res.data.post);
      else setMissing(true);
    });
  }, [postId]);

  function requireLogin() {
    Alert.alert('Login needed', 'Log in to like and save posts.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Login', onPress: () => navigation.navigate('FollowerLogin') },
    ]);
  }

  async function toggle(kind) {
    const liked = kind === 'like' ? post.liked : post.saved;
    const call = kind === 'like'
      ? (liked ? followerApi.unlikePost : followerApi.likePost)
      : (liked ? followerApi.unsavePost : followerApi.savePost);
    const res = await call(post.id);
    if (!res.success) {
      if (res.error?.code === 'UNAUTHORIZED' || res.status === 401) requireLogin();
      return;
    }
    setPost(p => kind === 'like'
      ? { ...p, liked: !liked, like_count: res.data.like_count }
      : { ...p, saved: !liked, save_count: res.data.save_count });
  }

  if (missing) {
    return (
      <SafeAreaView style={st.safe}>
        <View style={st.center}>
          <Text style={st.missTitle}>Post unavailable</Text>
          <Text style={st.missSub}>It may have been removed, or its products no longer match its concept.</Text>
          <TouchableOpacity onPress={() => navigation.goBack()} style={st.backBtn}>
            <Text style={st.backBtnTxt}>Go back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }
  if (!post) {
    return <SafeAreaView style={st.safe}><ActivityIndicator style={{ marginTop: 80 }} color={YELLOW} /></SafeAreaView>;
  }

  const railSoon = (what) => Alert.alert(what, 'Coming soon.');

  return (
    <SafeAreaView style={st.safe} edges={['top']}>
      {/* Header — concept name is the context the follower arrived on */}
      <View style={st.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}><Text style={st.hBack}>‹</Text></TouchableOpacity>
        <View>
          <Text style={st.hTitle}>Posts</Text>
          {!!(post.concept || post.collection) && (
            <Text style={st.hSub}>{(post.concept || post.collection).name}</Text>
          )}
        </View>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView>
        <CreatorRow creator={post.creator} onCreator={() =>
          post.creator?.handle && navigation.navigate('InfluencerStore', { handle: post.creator.handle })} compact />

        {/* True-ratio carousel + pins + right rail */}
        <View>
          <FlatList
            horizontal pagingEnabled showsHorizontalScrollIndicator={false}
            data={post.media} keyExtractor={m => m.id}
            onMomentumScrollEnd={e => setSlide(Math.round(e.nativeEvent.contentOffset.x / WIN.width))}
            renderItem={({ item: m }) => {
              const ratio = m.width && m.height ? m.height / m.width : 1.25;
              const h = Math.min(WIN.width * ratio, WIN.height * 0.68);
              return (
                <View style={{ width: WIN.width, height: h }}>
                  <Image source={{ uri: m.url }} style={{ width: WIN.width, height: h }} resizeMode="contain" />
                  {(post.pins || []).filter(t => t.media_id === m.id).map((t, i) => (
                    <Pin key={i} tag={t} style={post.tag_style} />
                  ))}
                </View>
              );
            }}
          />
          {/* Reels-style right rail (founder ruling) */}
          <View style={st.rail}>
            <TouchableOpacity style={st.railBtn} onPress={() => toggle('like')}>
              <Text style={[st.railIcon, post.liked && { color: '#E0245E' }]}>{post.liked ? '♥' : '♡'}</Text>
              <Text style={st.railCount}>{post.like_count || 0}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={st.railBtn} onPress={() => railSoon('Comments')}>
              <Text style={st.railIcon}>💬</Text>
            </TouchableOpacity>
            <TouchableOpacity style={st.railBtn} onPress={() => railSoon('Share')}>
              <Text style={st.railIcon}>↗</Text>
            </TouchableOpacity>
            <TouchableOpacity style={st.railBtn} onPress={() => toggle('save')}>
              <Text style={[st.railIcon, post.saved && { color: YELLOW }]}>🔖</Text>
              <Text style={st.railCount}>{post.save_count || 0}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {post.media.length > 1 && (
          <View style={st.dots}>
            {post.media.map((_, i) => <View key={i} style={[st.dot, i === slide && st.dotOn]} />)}
          </View>
        )}

        <ShopBar count={(post.products || []).length} onPress={() => setShopOpen(true)} />

        {!!post.caption && (
          <Text style={st.caption}>
            <Text style={{ fontWeight: '700' }}>{post.creator.handle} </Text>{post.caption}
          </Text>
        )}
        <View style={{ height: 30 }} />
      </ScrollView>

      <ShopThisPostSheet visible={shopOpen} post={post} onClose={() => setShopOpen(false)} navigation={navigation} />
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFF' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 8 },
  hBack: { fontSize: 30, color: '#111', width: 24 },
  hTitle: { fontSize: 15, fontWeight: '800', color: '#111', textAlign: 'center' },
  hSub: { fontSize: 11, color: '#999', textAlign: 'center' },
  rail: { position: 'absolute', right: 10, bottom: 16, alignItems: 'center', gap: 16 },
  railBtn: { alignItems: 'center', gap: 2 },
  railIcon: { fontSize: 24, color: '#FFF', textShadowColor: 'rgba(0,0,0,0.55)', textShadowRadius: 6, textShadowOffset: { width: 0, height: 1 } },
  railCount: { fontSize: 10.5, fontWeight: '700', color: '#FFF', textShadowColor: 'rgba(0,0,0,0.55)', textShadowRadius: 5 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 5, paddingTop: 8 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#DDD' },
  dotOn: { backgroundColor: '#111' },
  caption: { paddingHorizontal: 16, paddingTop: 10, fontSize: 13, color: '#222', lineHeight: 18 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  missTitle: { fontSize: 16, fontWeight: '800', color: '#111' },
  missSub: { fontSize: 12.5, color: '#999', textAlign: 'center', marginTop: 6, lineHeight: 18 },
  backBtn: { marginTop: 16, backgroundColor: '#111', borderRadius: 12, paddingHorizontal: 22, paddingVertical: 11 },
  backBtnTxt: { color: YELLOW, fontWeight: '800', fontSize: 13 },
});
