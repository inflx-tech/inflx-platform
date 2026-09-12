/**
 * SocialDetailScreen — S2 (Instagram) and S3 (YouTube): every number for one platform. The
 * brand and the creator see the same screen; the creator gets the R4 info box on top.
 * Contract: features/item3b-social-numbers · prompt §5.1 S2/S3, §5.2 R4
 *
 * route.params: { platform, viewer: 'brand' | 'creator', influencerId?, creatorName? }
 */
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Linking, StyleSheet } from 'react-native';
import { settingsTokens as T, fonts } from '../../theme/tokens';
import { brandApi, influencerApi } from '../../services/api';
import { Skeleton } from '../../components/settings/feedback';
import { PrimaryButton } from '../../components/settings/primitives';
import { Header, s as base } from '../brand/BrandPitchSettingsScreen';
import { MetricTile, StateBox } from '../../components/social/PlatformCard';
import { C3B, PLATFORM_LABEL } from '../../components/social/copy3b';
import { fmtCompact, fmtPct, fmtDate, windowLabel } from '../../components/discovery/copy3';

export default function SocialDetailScreen({ navigation, route }) {
  const { platform, viewer, influencerId, creatorName } = route?.params || {};
  const ig = platform === 'instagram';
  const label = PLATFORM_LABEL[platform] || 'Account';
  const [status, setStatus] = useState('loading');
  const [a, setA] = useState(null);

  const load = useCallback(async () => {
    setStatus('loading');
    const r = viewer === 'creator' ? await influencerApi.getMySocialDetail(platform) : await brandApi.getCreatorSocial(influencerId, platform);
    if (!r.success) { setStatus('error'); return; }
    setA(r.data.account);
    setStatus('ready');
  }, [platform, viewer, influencerId]);
  useEffect(() => { load(); }, [load]);

  if (status === 'loading') return <View style={base.screen}><Header title={label} onBack={() => navigation.goBack()} /><Skeleton /></View>;
  if (status === 'error') {
    return (
      <View style={base.screen}><Header title={label} onBack={() => navigation.goBack()} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }} testID="load-error">
          <Text style={s.errTitle}>{C3B.states.loadTitle}</Text><Text style={s.errBody}>{C3B.states.loadBody}</Text>
          <View style={{ width: 160, marginTop: 16 }}><PrimaryButton label={C3B.states.tryAgain} onPress={load} testID="try-again" /></View>
        </View>
      </View>
    );
  }

  const n = a.numbers;
  const accountLine = ig ? C3B.detail.accountLine(a.accountTypeLabel ? a.accountTypeLabel.replace(/^./, c => c.toUpperCase()) : 'Account', creatorName || '') : C3B.detail.channelLine(a.channelName || a.handle);
  const D = C3B.detail;

  return (
    <View style={base.screen} testID={`social-detail-${platform}`}>
      <Header title={label} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={[base.body, { paddingBottom: 40 }]}>
        {viewer === 'creator' ? <View style={s.info}><Text style={s.infoText}>{C3B.r4.info}</Text></View> : null}
        <View style={s.acct}>
          <View style={[s.pic, ig ? s.picIg : s.picYt]}><Text style={[s.picText, { color: ig ? '#B0306A' : '#C42B2B' }]}>{ig ? 'IG' : '▶'}</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={s.handle}>@{a.handle}{a.verified ? '  ✓' : ''}</Text>
            <Text style={s.sub} numberOfLines={1}>{accountLine}</Text>
          </View>
          {a.url ? <TouchableOpacity style={s.open} onPress={() => Linking.openURL(a.url).catch(() => {})} testID="open-platform"><Text style={s.openText}>{D.open} ↗</Text></TouchableOpacity> : null}
        </View>

        {!n ? (
          <StateBox tone={a.state === 'updating' || a.state === 'measuring' || a.state === 'waiting_check' ? 'wait' : 'grey'} spinner={a.state === 'updating' || a.state === 'measuring' || a.state === 'waiting_check'}
            title={a.state === 'updating' || a.state === 'measuring' || a.state === 'waiting_check' ? C3B.s1.updating[0] : undefined}
            body={a.state === 'updating' || a.state === 'measuring' || a.state === 'waiting_check' ? C3B.s1.updating[1] : C3B.s1.unavailableBox} testID="detail-state" />
        ) : ig ? (
          <>
            <Text style={s.shead}>{D.profile}</Text>
            <View style={s.grid}><MetricTile value={fmtCompact(n.followers)} label={D.followers} /><MetricTile value={fmtCompact(n.following)} label={D.following} /><MetricTile value={fmtCompact(n.totalPosts)} label={D.totalPosts} /></View>
            <View style={s.sheadRow}><Text style={s.shead}>{ig ? D.last90 : D.last90yt}</Text><Text style={s.sheadSub}>{a.window ? windowLabel(a.window.start, a.window.end) : ''}</Text></View>
            <View style={s.grid}><MetricTile value={fmtPct(n.engagement)} label={D.engagement} hero /><MetricTile value={String(n.posts90d ?? '—')} label={D.postsTile(n.postsPerWeek ?? '—')} /></View>
            {n.posts90d > 0 ? (
              <View>
                <View style={s.mix}>
                  {[['reels', '#1A1A17'], ['photos', '#77766E'], ['carousels', '#C9C8C0']].map(([k, c]) => (
                    <View key={k} style={{ flex: Math.max(n[k] || 0, 0.0001), backgroundColor: c }} />
                  ))}
                </View>
                <View style={s.legend}>
                  <Text style={s.legendItem}>■ {D.reels(n.reels)}</Text><Text style={[s.legendItem, { color: '#77766E' }]}>■ {D.photos(n.photos)}</Text><Text style={[s.legendItem, { color: '#A9A8A0' }]}>■ {D.carousels(n.carousels)}</Text>
                  {n.lastPostAt ? <Text style={s.legendItem}>{D.lastPost(fmtDate(n.lastPostAt))}</Text> : null}
                </View>
              </View>
            ) : null}
            <View style={s.grid}><MetricTile value={fmtCompact(n.avgLikes)} label={D.avgLikes} /><MetricTile value={fmtCompact(n.avgComments)} label={D.avgComments} /><MetricTile value={fmtCompact(n.avgReelViews)} label={D.avgReelViews} /></View>
            <View style={s.formula} testID="formula"><Text style={s.formulaText}>{n.engagementBasis === 'followers' ? D.igFormulaFollowers : D.igFormula}{n.posts90d > 0 ? ` ${D.measuredOf(n.posts90d)}` : ''}{n.hiddenLikesCount > 0 ? ` ${D.hidden(n.hiddenLikesCount)}` : ''}</Text></View>
            <Text style={s.foot} testID="footer">{D.igFooter(fmtDate(a.profileMeasuredAt), fmtDate(a.postsMeasuredAt))}</Text>
          </>
        ) : (
          <>
            <Text style={s.shead}>{D.channel}</Text>
            <View style={s.grid}><MetricTile value={fmtCompact(n.subscribers)} label={D.subscribers} /><MetricTile value={fmtCompact(n.totalVideos)} label={D.totalVideos} /><MetricTile value={fmtCompact(n.totalViews)} label={D.totalViews} /></View>
            <View style={s.sheadRow}><Text style={s.shead}>{ig ? D.last90 : D.last90yt}</Text><Text style={s.sheadSub}>{a.window ? windowLabel(a.window.start, a.window.end) : ''}</Text></View>
            <View style={s.legend}><Text style={s.legendItem}>{D.uploadsLine(n.uploads90d ?? 0, n.uploadsPerWeek ?? '—')}</Text>{n.lastUploadAt ? <Text style={s.legendItem}>{D.lastUpload(fmtDate(n.lastUploadAt))}</Text> : null}</View>
            {[['long', D.long], ['short', D.shorts]].map(([k, title]) => (
              <View key={k} testID={`yt-${k}`}>
                <View style={s.sheadRow}><Text style={s.shead}>{title}</Text><Text style={s.sheadSub}>{D.inWindow(n[k].count ?? 0)}</Text></View>
                <View style={s.grid}><MetricTile value={fmtPct(n[k].engagement)} label={D.engagement} hero /><MetricTile value={fmtCompact(n[k].avgViews)} label={D.avgViews} /></View>
                <View style={s.grid}><MetricTile value={fmtCompact(n[k].avgLikes)} label={D.avgLikes} /><MetricTile value={fmtCompact(n[k].avgComments)} label={D.avgComments} /></View>
              </View>
            ))}
            <View style={s.formula} testID="formula"><Text style={s.formulaText}>{D.ytFormula}</Text></View>
            <Text style={s.foot} testID="footer">{D.ytFooter(fmtDate(a.profileMeasuredAt), fmtDate(a.postsMeasuredAt))}</Text>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  info: { backgroundColor: T.state.waiting.bg, borderRadius: 12, padding: 10, marginBottom: 12 },
  infoText: { fontFamily: fonts.sansSemiBold, fontSize: 12.5, color: T.state.waiting.fg },
  acct: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  pic: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  picIg: { backgroundColor: '#FDE7F0' }, picYt: { backgroundColor: '#FDE8E8' },
  picText: { fontFamily: fonts.sansBold, fontSize: 12 },
  handle: { fontFamily: fonts.sansBold, fontSize: 14, color: T.ink },
  sub: { fontFamily: fonts.sansRegular, fontSize: 11.5, color: T.ink2 },
  open: { borderWidth: 1.5, borderColor: T.ink, borderRadius: 9, paddingHorizontal: 10, paddingVertical: 6 },
  openText: { fontFamily: fonts.sansBold, fontSize: 12.5, color: T.ink },
  shead: { fontFamily: fonts.sansBold, fontSize: 12, color: T.ink, letterSpacing: 0.3, marginTop: 12, marginBottom: 6 },
  sheadRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  sheadSub: { fontFamily: fonts.sansSemiBold, fontSize: 11, color: T.ink2 },
  grid: { flexDirection: 'row', marginBottom: 6 },
  mix: { flexDirection: 'row', height: 8, borderRadius: 99, overflow: 'hidden', backgroundColor: T.surface, marginTop: 4 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 6, marginBottom: 6 },
  legendItem: { fontFamily: fonts.sansRegular, fontSize: 11, color: T.ink2, marginRight: 10 },
  formula: { backgroundColor: T.surface, borderRadius: 10, padding: 10, marginTop: 6 },
  formulaText: { fontFamily: fonts.sansRegular, fontSize: 11, color: T.ink2, lineHeight: 16 },
  foot: { fontFamily: fonts.sansRegular, fontSize: 11, color: T.ink3, textAlign: 'center', marginTop: 12 },
  errTitle: { fontFamily: fonts.sansBold, fontSize: 17, color: T.ink },
  errBody: { fontFamily: fonts.sansRegular, fontSize: 13.5, color: T.ink3, marginTop: 6 },
});
