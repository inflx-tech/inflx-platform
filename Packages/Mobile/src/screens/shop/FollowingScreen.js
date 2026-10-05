/**
 * Profile › Following — the creators she follows; each opens that creator's store.
 * Contract: features/shopper-app-fixes · F13 · decision X4 (a plain list in the app's row style)
 *
 * A guest's follows live on the phone (rules 5.2), so they go with the request the way the feed
 * sends them; a signed-in shopper's are on her account. Read again each time the screen comes in
 * front: she may have unfollowed someone in a store she opened from here.
 */
import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { followerApi } from '../../services/api';
import { CS } from '../../components/shop/copyShop';
import { TopBar, Avatar, Loading, Empty, C } from '../../components/shop/bitsShop';
import { shopStore, isSignedIn, ensureDeviceHeader } from '../../components/shop/shopStore';
import { fonts } from '../../theme/tokens';

export default function FollowingScreen({ navigation }) {
  const [creators, setCreators] = useState(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    setFailed(false);
    await ensureDeviceHeader();
    const signed = await isSignedIn();
    const kept = await shopStore.get();
    const res = await followerApi.following(signed ? [] : kept.follows);
    if (!res || !res.success) { setFailed(true); return; }
    setCreators(res.data.creators || []);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <SafeAreaView style={st.safe} edges={['top']}>
      <TopBar title={CS.followingRow} onBack={() => navigation.goBack()} />
      {failed && !creators ? (
        <Empty title={CS.loadError} action={CS.retry} onAction={load} testID="following-error" />
      ) : !creators ? <Loading /> : (
        <FlatList
          data={creators}
          keyExtractor={(c) => c.id}
          contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 24 }}
          ListEmptyComponent={<Empty title={CS.noFollowing} testID="following-empty" />}
          renderItem={({ item: c }) => (
            <TouchableOpacity style={st.row} onPress={() => navigation.navigate('CreatorStore', { id: c.id, name: c.name })}
              testID={`following-${c.id}`} accessibilityRole="button" accessibilityLabel={c.name}>
              <Avatar uri={c.avatar} name={c.name} size={40} />
              <Text style={st.name} numberOfLines={1}>{c.name}</Text>
              <Text style={st.chev}>›</Text>
            </TouchableOpacity>
          )}
          testID="following-list"
        />
      )}
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.border },
  name: { flex: 1, fontFamily: fonts.sansBold, fontSize: 13.5, color: C.ink },
  chev: { fontSize: 18, color: C.ink3 },
});
