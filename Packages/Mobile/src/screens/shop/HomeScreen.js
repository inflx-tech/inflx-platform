/**
 * F2 Home — two rows of circles (creators, then brands), then the mixed feed.
 * Contract: features/follower-app-v2 · board F2 / F2b · rules v1.7 §5.5, §5.12, §5.14
 *
 * The server orders the feed (Stage A rules; Stage B once INFLX switches learning on). The phone
 * sends what it has already shown this session, her choices and where she is (never stored), and
 * shows "You're all caught up" before the first post coming back.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, FlatList, RefreshControl, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { followerApi } from '../../services/api';
import { CS } from '../../components/shop/copyShop';
import { TopBar, CircleRow, PostCard, ShopSheet, SignInSheet, Loading, Empty, C } from '../../components/shop/bitsShop';
import { useShopNav } from '../../components/shop/useShopNav';
import { useAutoplay } from '../../components/shop/useAutoplay';
import { shopStore, whoParams, ensureDeviceHeader, isSignedIn } from '../../components/shop/shopStore';
import { fonts } from '../../theme/tokens';

export default function HomeScreen({ navigation }) {
  const nav = useShopNav(navigation);
  const [posts, setPosts] = useState([]);
  const { seenProps, playingId } = useAutoplay('home', posts);
  const [circles, setCircles] = useState(null);
  const [status, setStatus] = useState('loading');
  const [more, setMore] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const served = useRef([]);
  const busy = useRef(false);
  const welcomedChecked = useRef(false);

  const loadPage = useCallback(async (reset) => {
    if (busy.current) return;
    busy.current = true;
    if (reset) served.current = [];
    const who = await whoParams();
    const res = await followerApi.feed({ mode: 'home', served: served.current, ...who });
    busy.current = false;
    if (!res || !res.success) { if (reset) setStatus('error'); return; }
    const page = res.data.posts || [];
    served.current = [...served.current, ...page.map((p) => p.id)];
    setPosts((prev) => (reset ? page : [...prev, ...page]));
    setMore(!!res.data.more);
    setStatus('ready');
  }, []);

  const loadCircles = useCallback(async () => {
    const st = await shopStore.get();
    const who = await whoParams();
    const res = await followerApi.circles({ since: st.lastHome || undefined, ...who });
    if (res && res.success) setCircles(res.data);
    await shopStore.set({ lastHome: new Date().toISOString() });
  }, []);

  const loadAll = useCallback(async () => {
    await ensureDeviceHeader();
    await Promise.all([loadPage(true), loadCircles()]);
  }, [loadPage, loadCircles]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // F1 — the optional Welcome, once, on first open.
  useFocusEffect(useCallback(() => {
    if (welcomedChecked.current) return;
    welcomedChecked.current = true;
    (async () => {
      const st = await shopStore.get();
      if (!st.welcomed && !(await isSignedIn())) navigation.navigate('Welcome');
    })();
  }, [navigation]));

  async function refresh() {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  }

  const firstAgain = posts.findIndex((p) => p.again);

  const renderItem = ({ item, index }) => (
    <View>
      {index === firstAgain ? (
        <View style={st.caught} testID="caught-up">
          <Text style={st.caughtTitle}>✓ {CS.caughtUp}</Text>
          <Text style={st.caughtSub}>{CS.caughtUpSub}</Text>
        </View>
      ) : null}
      <PostCard post={item} surface="home" position={index} active={playingId === item.id}
        onOpen={nav.openPost} onShop={nav.openShop} onComments={nav.openComments}
        onCreator={nav.openCreator} onBrand={nav.openBrand} onNeedSignIn={nav.needSignIn} />
    </View>
  );

  const header = (
    <View style={{ gap: 12, paddingBottom: 12 }}>
      {circles ? (
        <>
          <CircleRow label={CS.creators} items={circles.creators} onPress={nav.openCreator} testIDPrefix="circle-creator" />
          <CircleRow label={CS.brands} items={circles.brands} square onPress={nav.openBrand} testIDPrefix="circle-brand" />
        </>
      ) : null}
    </View>
  );

  return (
    <SafeAreaView style={st.safe} edges={['top']}>
      <TopBar onSearch={() => navigation.navigate('Search')} />
      {status === 'loading' ? <Loading /> : status === 'error' ? (
        <Empty title={CS.loadError} action={CS.retry} onAction={loadAll} testID="home-error" />
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(p) => p.id}
          renderItem={renderItem}
          ListHeaderComponent={header}
          ListEmptyComponent={<Empty title={CS.emptyFeed} sub={CS.emptyFeedSub} testID="home-empty" />}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 24 }}
          onEndReached={() => { if (more) loadPage(false); }}
          onEndReachedThreshold={0.6}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
          testID="home-feed"
          {...seenProps}
        />
      )}
      <ShopSheet post={nav.shopPost} visible={!!nav.shopPost} onClose={nav.closeShop} surface="home" />
      <SignInSheet visible={nav.signIn} onClose={nav.closeSignIn} onSignIn={nav.goSignIn} />
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  caught: { alignItems: 'center', paddingVertical: 14, gap: 2, marginBottom: 12, borderTopWidth: 1, borderBottomWidth: 1, borderColor: C.border },
  caughtTitle: { fontFamily: fonts.sansBold, fontSize: 13.5, color: C.ink },
  caughtSub: { fontFamily: fonts.sansRegular, fontSize: 12, color: C.ink2 },
});
