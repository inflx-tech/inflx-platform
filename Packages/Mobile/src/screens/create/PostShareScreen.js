/**
 * PostShareScreen — L2 / L3 "Share your post": the post code, the caption line, and one link per
 * channel, each with Copy ("Copied" after a tap) and the phone's Share sheet. From approval: before
 * the posting date a banner says the links work from that day (L3). "Follower view" opens the link.
 * Contract: features/post-links-codes · rules §4.14
 */
import React, { useCallback, useState } from 'react';
import { View, ScrollView, Text, Linking, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { influencerApi } from '../../services/api';
import { Skeleton, LoadError } from '../../components/settings/feedback';
import { SecondaryButton } from '../../components/settings/primitives';
import { Header, s as base } from '../brand/BrandPitchSettingsScreen';
import { settingsTokens as T, fonts } from '../../theme/tokens';
import { CL } from '../../components/create/copyLinks';
import { StateChip, s as b } from '../../components/create/bitsCreate';
import { CodeBox, CopyButton, LinkRow, k } from '../../components/create/bitsLinks';

export default function PostShareScreen({ navigation, route }) {
  const { postId } = route.params || {};
  const [d, setD] = useState(null);
  const [status, setStatus] = useState('loading');
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    const r = await influencerApi.postShare(postId);
    if (!r.success) { setErr(r.error?.message || ''); setStatus('error'); return; }
    setD(r.data); setStatus('ready');
  }, [postId]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <View style={base.screen} testID="post-share">
      <Header title={CL.shareTitle} onBack={() => navigation.goBack()} />
      {status === 'loading' ? <Skeleton /> : status === 'error' ? (err ? <Text style={[b.hint, { padding: 16 }]}>{err}</Text> : <LoadError onRetry={load} />) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
          <View style={x.head}>
            <View style={{ flex: 1 }}>
              <Text style={x.title}>{d.title}</Text>
              <Text style={b.rowMeta}>{CL.since(d.brand_name, d.offer_line, d.live_since)}</Text>
            </View>
            <StateChip state={d.state} />
          </View>
          {d.goes_live_on ? (
            <View style={x.soon} testID="goes-live">
              <Text style={x.soonTitle}>{CL.goesLive(d.goes_live_on)}</Text>
              <Text style={x.soonBody}>{CL.goesLiveBody(d.goes_live_on)}</Text>
            </View>
          ) : null}
          <CodeBox code={d.code} hint={d.goes_live_on ? null : CL.codeHint} testID="code-box" />
          <Text style={b.label}>{CL.captionLine}</Text>
          <View style={k.capline}><Text style={k.caplineText}>{d.caption_line}</Text></View>
          <View style={{ alignSelf: 'flex-start' }}><CopyButton text={d.caption_line} testID="copy-caption" /></View>
          <Text style={b.label}>{CL.postLinks}</Text>
          {d.links.map(l => <LinkRow key={l.channel} label={l.label} display={l.display} url={l.url} note={l.where} testID={`link-${l.channel}`} />)}
          <View style={x.btns}>
            <View style={{ flex: 1, marginRight: 8 }}><SecondaryButton label={CL.whereToShare} onPress={() => navigation.navigate('WhereToShare', { postId })} testID="where" /></View>
            <View style={{ flex: 1 }}><SecondaryButton label={CL.followerView} onPress={() => Linking.openURL(d.follower_view)} testID="follower-view" /></View>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const x = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  title: { fontFamily: fonts.sansBold, fontSize: 14, color: T.ink },
  soon: { backgroundColor: T.state.completed.bg, borderRadius: 12, padding: 12, marginBottom: 12 },
  soonTitle: { fontFamily: fonts.sansBold, fontSize: 13.5, color: T.state.completed.fg },
  soonBody: { fontFamily: fonts.sansRegular, fontSize: 12, color: T.state.completed.fg, marginTop: 3, lineHeight: 17 },
  btns: { flexDirection: 'row', marginTop: 14 },
});
