/**
 * WhereToShareScreen — L4 "Where to share what": the founder's guide, place by place, with the exact
 * line or link to use (X and LinkedIn under "Anywhere else"). The bio line uses her store link.
 * Contract: features/post-links-codes · rules §4.14 "Where she shares what"
 */
import React, { useCallback, useState } from 'react';
import { View, ScrollView, Text, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { influencerApi } from '../../services/api';
import { Skeleton, LoadError } from '../../components/settings/feedback';
import { Header, s as base } from '../brand/BrandPitchSettingsScreen';
import { settingsTokens as T, fonts } from '../../theme/tokens';
import { CL } from '../../components/create/copyLinks';

export default function WhereToShareScreen({ navigation, route }) {
  const { postId } = route.params || {};
  const [rows, setRows] = useState(null);
  const [status, setStatus] = useState('loading');

  const load = useCallback(async () => {
    const [share, mine] = await Promise.all([influencerApi.postShare(postId), influencerApi.myLinks()]);
    if (!share.success) { setStatus('error'); return; }
    const storeIg = mine.success && mine.data.store ? mine.data.store.links.find(l => l.channel === 'ig') : null;
    setRows(share.data.where.map(w => (w.sample === null && storeIg ? { ...w, sample: storeIg.display } : w)));
    setStatus('ready');
  }, [postId]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <View style={base.screen} testID="where-to-share">
      <Header title={CL.whereTitle} onBack={() => navigation.goBack()} />
      {status === 'loading' ? <Skeleton /> : status === 'error' ? <LoadError onRetry={load} /> : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
          {rows.map(w => (
            <View key={w.title} style={g.card}>
              <Text style={g.title}>{w.title}</Text>
              <Text style={g.body}>{w.body}</Text>
              {w.sample ? <Text style={g.sample}>{w.sample}</Text> : null}
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const g = StyleSheet.create({
  card: { borderWidth: 1, borderColor: T.border, borderRadius: 12, padding: 10, marginBottom: 10 },
  title: { fontFamily: fonts.sansBold, fontSize: 12.5, color: T.ink },
  body: { fontFamily: fonts.sansRegular, fontSize: 12, color: T.ink2, marginTop: 3, lineHeight: 17 },
  sample: { alignSelf: 'flex-start', fontFamily: fonts.mono || fonts.sansRegular, fontSize: 11, color: T.ink, backgroundColor: T.surface, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 3, marginTop: 6, overflow: 'hidden' },
});
