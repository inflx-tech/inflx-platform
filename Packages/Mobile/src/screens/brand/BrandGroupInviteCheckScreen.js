/**
 * BrandGroupInviteCheckScreen — I2: a whole group against this set. "{k} of {n} can be
 * invited", the avatar stack of who will be, the short label for who can't. Next starts the
 * draft with the ones who can, remembering the group (never shown to creators).
 * Contract: features/item5-invitations · prompt §6.2
 */
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { settingsTokens as T, fonts } from '../../theme/tokens';
import { brandApi } from '../../services/api';
import { PrimaryButton } from '../../components/settings/primitives';
import { Skeleton, LoadError } from '../../components/settings/feedback';
import { Header, s as base } from './BrandPitchSettingsScreen';
import { MemberRow } from '../../components/discovery/DiscoverList';
import { AvatarStack } from '../../components/discovery/bits';
import { Chip5 } from '../../components/invitations/bits5';
import { C5, aimLabel5, modeLabel5 } from '../../components/invitations/copy5';
import { startDraft } from '../../components/invitations/draft5';

const G = C5.group;

export default function BrandGroupInviteCheckScreen({ navigation, route }) {
  const { campaignId, setId, groupId, groupName } = route?.params || {};
  const [status, setStatus] = useState('loading');
  const [data, setData] = useState(null);
  const [summary, setSummary] = useState(null);

  const load = useCallback(async () => {
    setStatus('loading');
    const [r, s2] = await Promise.all([brandApi.groupCheck(campaignId, setId, groupId), brandApi.setSummary(campaignId, setId)]);
    if (!r.success || !s2.success) { setStatus('error'); return; }
    setData(r.data); setSummary(s2.data); setStatus('ready');
  }, [campaignId, setId, groupId]);
  useEffect(() => { load(); }, [load]);

  function next() {
    const creators = data.can.map(c => ({ id: c.id, name: c.name, avatarUrl: c.avatarUrl || null }));
    startDraft(setId, { set: summary.set, campaignName: summary.campaign.name, creators, sourceGroupId: groupId });
    navigation.navigate('BrandCreatorTerms', { campaignId, setId, index: 0 });
  }

  const title = G.title;
  if (status === 'loading') return <View style={base.screen}><Header title={title} onBack={() => navigation.goBack()} /><Skeleton /></View>;
  if (status === 'error') return <View style={base.screen}><Header title={title} onBack={() => navigation.goBack()} /><LoadError onRetry={load} /></View>;

  const { counts, can, cannot, group, set } = data;
  return (
    <View style={base.screen} testID="group-invite-check">
      <Header title={title} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 120 }}>
        <Text style={s.sub}>{summary.set.name.toUpperCase()}</Text>
        <View style={s.card}>
          <Text style={s.big} testID="group-summary">{G.summary(counts.can, counts.total)}</Text>
          <Text style={s.line}>{G.line(group.name || groupName, aimLabel5(set.goal), modeLabel5(set.shootMode), summary.set.postingDate)}</Text>
        </View>
        <Text style={s.secth} testID="will-title">{G.will(counts.can)}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
          <AvatarStack people={can} extra={0} />
          {can.length > 4 ? <Text style={s.more}>{G.more(can.length - 4)}</Text> : null}
        </View>
        {cannot.length ? <Text style={s.secth} testID="cant-title">{G.cant(counts.cannot)}</Text> : null}
        {cannot.map(c => (
          <MemberRow key={c.id} c={{ ...c, status: null }} sub={c.label} right={<Chip5 label={c.pick && c.pick.state === 'invited' ? C5.pick.invited : C5.pick.cantInvite} tone={c.pick && c.pick.state === 'invited' ? 'waiting' : 'ended'} />} />
        ))}
        <Text style={s.hint}>{G.hint}</Text>
      </ScrollView>
      <View style={s.footer}>
        {counts.can === 0 ? <Text style={[s.hint, { textAlign: 'center', marginBottom: 8 }]}>{G.nobody}</Text> : null}
        <PrimaryButton label={G.next(counts.can)} onPress={next} disabled={counts.can === 0} testID="group-next" />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  sub: { fontFamily: fonts.sansBold, fontSize: 10.5, color: T.ink3, letterSpacing: 0.6, marginBottom: 10 },
  card: { backgroundColor: T.surface, borderRadius: 14, padding: 14, marginBottom: 16 },
  big: { fontFamily: fonts.sansBold, fontSize: 18, color: T.ink },
  line: { fontFamily: fonts.sansRegular, fontSize: 12.5, color: T.ink2, marginTop: 4 },
  secth: { fontFamily: fonts.sansBold, fontSize: 13.5, color: T.ink, marginBottom: 8, marginTop: 4 },
  more: { fontFamily: fonts.sansSemiBold, fontSize: 12, color: T.ink2, marginLeft: 8 },
  hint: { fontFamily: fonts.sansRegular, fontSize: 12, color: T.ink2, lineHeight: 16, marginTop: 14 },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 14, paddingBottom: 22, backgroundColor: T.bg, borderTopWidth: 1, borderTopColor: T.border },
});
