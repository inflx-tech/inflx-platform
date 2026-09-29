/**
 * BrandSetPostsScreen — L7 "Posts · Set A": every post made for this set once INFLX approves it, with
 * its code, visits, orders, sales and commission; the set so far (orders, creators' commission, the
 * INFLX fee, what the brand receives). "Copy all codes" (L8) copies a ready list of the live posts'
 * codes and offers the phone's Share sheet. Tapping a post opens its channel breakdown (L6).
 * Contract: features/post-links-codes · rules §4.14 "Who sees what"
 */
import React, { useCallback, useState } from 'react';
import { View, ScrollView, Text, TouchableOpacity, Modal, Share, StyleSheet } from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import { useFocusEffect } from '@react-navigation/native';
import { brandApi } from '../../services/api';
import { Skeleton, LoadError } from '../../components/settings/feedback';
import { PrimaryButton, SecondaryButton } from '../../components/settings/primitives';
import { Header, s as base } from './BrandPitchSettingsScreen';
import { settingsTokens as T, fonts } from '../../theme/tokens';
import { CL } from '../../components/create/copyLinks';
import { rupeesP } from '../../components/create/copyCreate';
import { StateChip, s as b } from '../../components/create/bitsCreate';

export default function BrandSetPostsScreen({ navigation, route }) {
  const { campaignId, setId, setName } = route.params || {};
  const [d, setD] = useState(null);
  const [status, setStatus] = useState('loading');
  const [sheet, setSheet] = useState(false);

  const load = useCallback(async () => {
    const r = await brandApi.setPosts(campaignId, setId);
    if (!r.success) { setStatus('error'); return; }
    setD(r.data); setStatus('ready');
  }, [campaignId, setId]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  function copyAll() {
    Clipboard.setString(d.copy_text || '');
    setSheet(true);
  }

  return (
    <View style={base.screen} testID="set-posts">
      <Header title={CL.postsTitle(setName || (d && d.set_name) || '')} onBack={() => navigation.goBack()} />
      {status === 'loading' ? <Skeleton /> : status === 'error' ? <LoadError onRetry={load} /> : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
          <Text style={b.rowMeta}>{CL.postsSub(d)}</Text>
          {d.live ? <View style={{ marginVertical: 10 }}><SecondaryButton label={CL.copyAll(d.live)} onPress={copyAll} testID="copy-all" /></View> : null}
          {d.posts.length ? d.posts.map(p => (
            <TouchableOpacity key={p.id} style={x.row} testID={`post-${p.id}`}
              onPress={() => navigation.navigate('BrandPostStats', { postId: p.id, brand: { campaignId, setId } })}>
              <View style={x.th} />
              <View style={{ flex: 1 }}>
                <Text style={x.name}>{p.title} · {p.creator_name.split(' ')[0]}</Text>
                <Text style={x.code}>{p.code}</Text>
                <Text style={b.rowMeta}>{p.state === 'approved' ? CL.goesLiveRow(p.goes_live_on) : CL.postRow(p.totals)}</Text>
              </View>
              <StateChip state={p.state} />
            </TouchableOpacity>
          )) : <Text style={b.hint}>{CL.noPosts}</Text>}
          <View style={x.card} testID="set-totals">
            <Text style={b.label}>{CL.setSoFar}</Text>
            <View style={x.line}><Text style={b.rowMeta}>{CL.shopOrders}</Text><Text style={x.v}>{d.totals.orders} · {rupeesP(d.totals.sales)}</Text></View>
            <View style={x.line}><Text style={b.rowMeta}>{CL.creatorsCommission}</Text><Text style={x.v}>{rupeesP(d.totals.commission)}</Text></View>
            <View style={x.line}><Text style={b.rowMeta}>{CL.inflxFee}</Text><Text style={x.v}>{rupeesP(d.totals.inflx_fee)}</Text></View>
            <View style={x.line}><Text style={b.rowMeta}>{CL.youReceive}</Text><Text style={x.v}>{rupeesP(d.totals.you_receive)}</Text></View>
          </View>
        </ScrollView>
      )}
      <Modal visible={sheet} transparent animationType="slide" onRequestClose={() => setSheet(false)}>
        <TouchableOpacity style={x.dim} activeOpacity={1} onPress={() => setSheet(false)}>
          <TouchableOpacity activeOpacity={1} style={x.sheet} testID="copied-sheet">
            <Text style={x.sheetTitle}>{d ? CL.copiedN(d.live) : ''}</Text>
            <View style={x.list}><Text style={x.listText}>{d ? d.copy_text : ''}</Text></View>
            <Text style={b.hint}>{CL.copiedHint}</Text>
            <PrimaryButton label={CL.shareBtn} onPress={() => Share.share({ message: d.copy_text })} testID="share-codes" />
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const x = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: T.border },
  th: { width: 40, height: 50, borderRadius: 8, backgroundColor: T.surface, marginRight: 10 },
  name: { fontFamily: fonts.sansBold, fontSize: 13, color: T.ink },
  code: { fontFamily: fonts.mono || fonts.sansRegular, fontSize: 11.5, color: T.ink2, marginTop: 1 },
  card: { backgroundColor: T.surface, borderRadius: 14, padding: 12, marginTop: 14 },
  line: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  v: { fontFamily: fonts.sansBold, fontSize: 12.5, color: T.ink },
  dim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: T.bg, borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 18, paddingBottom: 30 },
  sheetTitle: { fontFamily: fonts.sansBold, fontSize: 15, color: T.ink, marginBottom: 10 },
  list: { backgroundColor: T.surface, borderRadius: 12, padding: 10, marginBottom: 6 },
  listText: { fontFamily: fonts.sansRegular, fontSize: 12, color: T.ink, lineHeight: 19 },
});
