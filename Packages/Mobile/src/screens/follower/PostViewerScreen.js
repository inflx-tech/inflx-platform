/**
 * PostViewerScreen — full-screen immersive post (Stage C1, locked board
 * c1-shopping-window.html step 1). Contract: features/concept-stagec1-shopping-window/.
 *
 * Immersive dark canvas: the TRUE image (Model B — never cropped) on black,
 * overlays on top — creator row + Follow pill, Reels right rail, bottom-left
 * title (the concept/collection name) + caption (more/less) + "N PRODUCTS",
 * WHITE Shop-this-post pill. Pins render per the creator's tag style.
 *
 * Back from the product returns HERE with the sheet REOPENED — same list,
 * added items still marked (the board's step-5 promise).
 */
import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, Image, FlatList, TouchableOpacity,
  ActivityIndicator, Alert, Dimensions, StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { followerApi } from '../../services/api';
import { Pin, YELLOW } from '../../components/posts/PostCard';
import ShopThisPostSheet from '../../components/posts/ShopThisPostSheet';

const WIN = Dimensions.get('window');

function timeAgo(iso) {
  if (!iso) return '';
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 3600) return `${Math.max(1, Math.floor(s / 60))}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)}d ago`;
  return `${Math.floor(s / (86400 * 30))}mo ago`;
}

export default function PostViewerScreen({ navigation, route }) {
  const { postId } = route.params || {};
  const [post, setPost] = useState(null);
  const [missing, setMissing] = useState(false);
  const [slide, setSlide] = useState(0);
  const [shopOpen, setShopOpen] = useState(false);
  const [capOpen, setCapOpen] = useState(false);
  const [followed, setFollowed] = useState(false);
  const reopenShop = useRef(false);

  useEffect(() => {
    followerApi.getPost(postId).then(res => {
      if (res.success) setPost(res.data.post);
      else setMissing(true);
    });
  }, [postId]);

  // Board step 5: back from the product → the sheet reopens, state intact.
  useEffect(() => {
    const unsub = navigation.addListener('focus', () => {
      if (reopenShop.current) { reopenShop.current = false; setShopOpen(true); }
    });
    return unsub;
  }, [navigation]);

  function requireLogin(what = 'do this') {
    Alert.alert('Login needed', `Log in to ${what}.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Login', onPress: () => navigation.navigate('FollowerLogin') },
    ]);
  }

  async function toggle(kind) {
    const on = kind === 'like' ? post.liked : post.saved;
    const call = kind === 'like'
      ? (on ? followerApi.unlikePost : followerApi.likePost)
      : (on ? followerApi.unsavePost : followerApi.savePost);
    const res = await call(post.id);
    if (!res.success) {
      if (res.error?.code === 'UNAUTHORIZED' || res.status === 401) requireLogin('like and save posts');
      return;
    }
    setPost(pv => kind === 'like'
      ? { ...pv, liked: !on, like_count: res.data.like_count }
      : { ...pv, saved: !on, save_count: res.data.save_count });
  }

  async function follow() {
    const res = followed
      ? await followerApi.unfollow(post.creator.id)
      : await followerApi.follow(post.creator.id);
    if (!res.success) {
      if (res.error?.code === 'UNAUTHORIZED' || res.status === 401) requireLogin('follow creators');
      return;
    }
    setFollowed(f => !f);
  }

  function openProduct(p) {
    if (p === '__bag__') { navigation.navigate('Cart'); return; }
    reopenShop.current = true;
    setShopOpen(false);
    navigation.navigate('PostProduct', { p });
  }

  if (missing) {
    return (
      <SafeAreaView style={st.safeLight}>
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
  const title = (post.concept || post.collection)?.name || null;
  const capLong = (post.caption || '').length > 70;

  return (
    <SafeAreaView style={st.safe} edges={['top']}>
      {/* media — TRUE image on black (never cropped), full height */}
      <FlatList
        horizontal pagingEnabled showsHorizontalScrollIndicator={false}
        data={post.media} keyExtractor={m => m.id}
        style={StyleSheet.absoluteFill}
        onMomentumScrollEnd={e => setSlide(Math.round(e.nativeEvent.contentOffset.x / WIN.width))}
        renderItem={({ item: m }) => (
          <View style={{ width: WIN.width, height: '100%' }}>
            <Image source={{ uri: m.url }} style={{ width: WIN.width, height: '100%' }} resizeMode="contain" />
            {(post.pins || []).filter(t => t.media_id === m.id).map((t, i) => (
              <Pin key={i} tag={t} style={post.tag_style} />
            ))}
          </View>
        )}
      />

      {/* top overlay — back + creator + follow + share/menu */}
      <View style={st.top}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={st.topBack}>‹</Text>
        </TouchableOpacity>
        <TouchableOpacity style={st.crow} activeOpacity={0.8}
          onPress={() => post.creator?.handle && navigation.navigate('InfluencerStore', { handle: post.creator.handle })}>
          {post.creator.avatar
            ? <Image source={{ uri: post.creator.avatar }} style={st.av} />
            : <View style={[st.av, { backgroundColor: '#DDD' }]} />}
          <View>
            <Text style={st.handle}>{post.creator.handle}</Text>
            <Text style={st.meta}>{[post.creator.city, timeAgo(post.created_at)].filter(Boolean).join(' · ')}</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={st.followPill} onPress={follow}>
          <Text style={st.followTxt}>{followed ? 'Following' : 'Follow'}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => railSoon('Share')}>
          <Text style={st.topIcon}>↗</Text>
        </TouchableOpacity>
      </View>

      {/* right rail */}
      <View style={st.rail}>
        <TouchableOpacity style={st.railBtn} onPress={() => toggle('like')}>
          <Text style={[st.railIcon, post.liked && { color: '#FF5C7A' }]}>{post.liked ? '♥' : '♡'}</Text>
          <Text style={st.railCount}>{post.like_count || 0}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={st.railBtn} onPress={() => railSoon('Comments')}>
          <Text style={st.railIcon}>💬</Text>
        </TouchableOpacity>
        <TouchableOpacity style={st.railBtn} onPress={() => toggle('save')}>
          <Text style={[st.railIcon, post.saved && { color: YELLOW }]}>🔖</Text>
          <Text style={st.railCount}>{post.save_count || 0}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={st.railBtn} onPress={() => railSoon('Share')}>
          <Text style={st.railIcon}>↗</Text>
        </TouchableOpacity>
      </View>

      {/* bottom overlay — title / caption / count / dots / WHITE shop pill */}
      <View style={st.bottom}>
        {!!title && <Text style={st.bTitle}>{title}</Text>}
        {!!post.caption && (
          <TouchableOpacity activeOpacity={0.9} onPress={() => capLong && setCapOpen(o => !o)}>
            <Text style={st.bCap} numberOfLines={capOpen ? undefined : 2}>{post.caption}</Text>
            {capLong && <Text style={st.bMore}>{capOpen ? 'less' : '… more'}</Text>}
          </TouchableOpacity>
        )}
        <Text style={st.bCount}>🛍 {(post.products || []).length} PRODUCT{(post.products || []).length === 1 ? '' : 'S'}</Text>
        {post.media.length > 1 && (
          <View style={st.dots}>
            {post.media.map((_, i) => <View key={i} style={[st.dot, i === slide && st.dotOn]} />)}
          </View>
        )}
        <TouchableOpacity style={st.shopPill} activeOpacity={0.9} onPress={() => setShopOpen(true)}>
          <Text style={st.shopTxt}>Shop this post 🛍</Text>
          <Text style={st.shopChev}>›</Text>
        </TouchableOpacity>
      </View>

      <ShopThisPostSheet
        visible={shopOpen}
        post={post}
        onClose={() => setShopOpen(false)}
        onOpenProduct={openProduct}
      />
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#000' },
  safeLight: { flex: 1, backgroundColor: '#FFF' },
  top: { position: 'absolute', top: 44, left: 10, right: 12, flexDirection: 'row', alignItems: 'center', gap: 9 },
  topBack: { fontSize: 30, color: '#FFF', textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 6, width: 22 },
  crow: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  av: { width: 30, height: 30, borderRadius: 15, borderWidth: 1.5, borderColor: '#FFF' },
  handle: { color: '#FFF', fontSize: 12.5, fontWeight: '800', textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 5 },
  meta: { color: 'rgba(255,255,255,0.85)', fontSize: 9.5, textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 5 },
  followPill: { borderWidth: 1.3, borderColor: 'rgba(255,255,255,0.95)', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 },
  followTxt: { color: '#FFF', fontSize: 11, fontWeight: '800' },
  topIcon: { color: '#FFF', fontSize: 16, textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 5, paddingLeft: 2 },
  rail: { position: 'absolute', right: 10, bottom: 190, alignItems: 'center', gap: 15 },
  railBtn: { alignItems: 'center', gap: 2 },
  railIcon: { fontSize: 24, color: '#FFF', textShadowColor: 'rgba(0,0,0,0.55)', textShadowRadius: 6, textShadowOffset: { width: 0, height: 1 } },
  railCount: { fontSize: 10.5, fontWeight: '700', color: '#FFF', textShadowColor: 'rgba(0,0,0,0.55)', textShadowRadius: 5 },
  bottom: { position: 'absolute', left: 14, right: 60, bottom: 18 },
  bTitle: { color: '#FFF', fontSize: 16, fontWeight: '800', textShadowColor: 'rgba(0,0,0,0.55)', textShadowRadius: 6 },
  bCap: { color: 'rgba(255,255,255,0.95)', fontSize: 11.5, lineHeight: 16, marginTop: 4, textShadowColor: 'rgba(0,0,0,0.55)', textShadowRadius: 5 },
  bMore: { color: 'rgba(255,255,255,0.75)', fontSize: 11, fontWeight: '700', marginTop: 2 },
  bCount: { color: '#FFF', fontSize: 9.5, fontWeight: '800', letterSpacing: 0.6, marginTop: 8, textShadowColor: 'rgba(0,0,0,0.55)', textShadowRadius: 5 },
  dots: { flexDirection: 'row', gap: 4, marginTop: 8 },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.45)' },
  dotOn: { backgroundColor: '#FFF' },
  shopPill: { marginTop: 10, marginRight: -46, backgroundColor: '#FFF', borderRadius: 999, paddingVertical: 12, paddingHorizontal: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  shopTxt: { fontSize: 13.5, fontWeight: '800', color: '#111' },
  shopChev: { fontSize: 15, color: '#999', fontWeight: '700' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  missTitle: { fontSize: 16, fontWeight: '800', color: '#111' },
  missSub: { fontSize: 12.5, color: '#999', textAlign: 'center', marginTop: 6, lineHeight: 18 },
  backBtn: { marginTop: 16, backgroundColor: '#111', borderRadius: 12, paddingHorizontal: 22, paddingVertical: 11 },
  backBtnTxt: { color: YELLOW, fontWeight: '800', fontSize: 13 },
});
