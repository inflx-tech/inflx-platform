/**
 * F4 A photo post, opened — at its own size; the feed below carries on with that creator's posts,
 * newest first, then similar posts (same brand or category), so it never dead-ends.
 * Contract: features/follower-app-v2 · board F4 · rules v1.7 §5.6
 * Also where a post link or a typed code lands (4.14), and where a store tile opens.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { followerApi } from '../../services/api';
import { CS } from '../../components/shop/copyShop';
import { TopBar, PostCard, ShopSheet, SignInSheet, Loading, Empty, C } from '../../components/shop/bitsShop';
import { useShopNav } from '../../components/shop/useShopNav';
import { useSeen } from '../../components/shop/useSeen';
import { track } from '../../services/events';
import { fonts } from '../../theme/tokens';

export default function PostScreen({ navigation, route }) {
  const { postId, code, ch } = route.params || {};
  const nav = useShopNav(navigation);
  const seenProps = useSeen('post');
  const [post, setPost] = useState(route.params && route.params.post ? route.params.post : null);
  const [rest, setRest] = useState([]);
  const [status, setStatus] = useState(post ? 'ready' : 'loading');
  const [gone, setGone] = useState(null);
  const [more, setMore] = useState(false);
  const served = useRef([]);

  const loadMore = useCallback(async (id) => {
    const res = await followerApi.more(id, served.current);
    if (!res || !res.success) return;
    served.current = [...served.current, ...res.data.posts.map((p) => p.id)];
    setRest((prev) => [...prev, ...res.data.posts]);
    setMore(!!res.data.more);
  }, []);

  useEffect(() => {
    (async () => {
      let p = post;
      if (code) {
        const r = await followerApi.code(code, ch);
        if (!r || !r.success) { setStatus('error'); return; }
        if (r.data.state !== 'live') { setGone(r.data); setStatus('gone'); return; }
        p = r.data.post;
        track('open', p.id, 'link');
      } else if (!p || !p.products) {
        const r = await followerApi.post(postId);
        if (!r || !r.success) { setGone({ message: r && r.error ? r.error.message : CS.loadError }); setStatus('gone'); return; }
        p = r.data;
      }
      if (p.media_kind === 'video' && code) { navigation.replace('Tabs', { screen: 'PlayTab', params: { start: p.id, at: Date.now() } }); return; }
      setPost(p); setStatus('ready');
      served.current = [p.id];
      loadMore(p.id);
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (status === 'loading') return <SafeAreaView style={st.safe}><TopBar onBack={() => navigation.goBack()} /><Loading /></SafeAreaView>;
  if (status === 'gone' || status === 'error') {
    return (
      <SafeAreaView style={st.safe}>
        <TopBar onBack={() => navigation.goBack()} />
        <Empty title={gone ? gone.message : CS.loadError} testID="post-gone"
          action={gone && gone.creator ? `See ${gone.creator.name.split(' ')[0]}'s store` : null}
          onAction={() => gone && gone.creator && navigation.replace('CreatorStore', { id: gone.creator.handle || gone.creator.id, name: gone.creator.name })} />
      </SafeAreaView>
    );
  }

  const first = post.creator ? post.creator.name.split(' ')[0] : '';
  const label = (x, i) => {
    const prev = i === 0 ? null : rest[i - 1];
    if (i === 0 && x.from === 'creator') return CS.moreFrom(first);
    if (x.from === 'similar' && (!prev || prev.from !== 'similar')) return CS.similar;
    if (x.from === 'more' && (!prev || prev.from !== 'more')) return CS.more;
    return null;
  };

  return (
    <SafeAreaView style={st.safe} edges={['top']}>
      <TopBar title={post.creator ? post.creator.name : ''} onBack={() => navigation.goBack()} onSearch={() => navigation.navigate('Search')} />
      <FlatList
        data={rest}
        keyExtractor={(p) => p.id}
        ListHeaderComponent={(
          <View style={{ paddingBottom: 14 }}>
            <PostCard post={post} surface="post" position={0} onOpen={() => {}} onShop={nav.openShop} onComments={nav.openComments}
              onCreator={nav.openCreator} onBrand={nav.openBrand} onNeedSignIn={nav.needSignIn} />
          </View>
        )}
        renderItem={({ item, index }) => (
          <View style={{ marginBottom: 12 }}>
            {label(item, index) ? <Text style={st.section}>{label(item, index)}</Text> : null}
            <PostCard post={item} surface="post" position={index + 1} onOpen={nav.openPost} onShop={nav.openShop} onComments={nav.openComments}
              onCreator={nav.openCreator} onBrand={nav.openBrand} onNeedSignIn={nav.needSignIn} />
          </View>
        )}
        contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 24 }}
        onEndReached={() => { if (more) loadMore(post.id); }}
        onEndReachedThreshold={0.6}
        testID="post-feed"
        {...seenProps}
      />
      <ShopSheet post={nav.shopPost} visible={!!nav.shopPost} onClose={nav.closeShop} surface="post" />
      <SignInSheet visible={nav.signIn} onClose={nav.closeSignIn} onSignIn={nav.goSignIn} />
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  section: { fontFamily: fonts.sansBold, fontSize: 14, color: C.ink, marginBottom: 8 },
});
