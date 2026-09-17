/**
 * BrandGroupInviteCheckScreen — I2: a whole group against this set. "{k} of {n} can be
 * invited", the avatar stack of who will be, the short label for who can't.
 *
 * ── 2026-09-17 ───────────────────────────────────────────────────────────────
 * This screen used to call startDraft with the group's members only, which REPLACED whatever
 * the picker already held — so a founder who had ticked creators by hand and from the pool lost
 * them by opening a group, silently. It now ADDS to the picker's basket and goes back, so one
 * Send carries pool + group + manual together.
 *
 * The breakdown of who can't come and why is untouched: it was the useful half all along.
 * What is new is that the overlap with the basket is named BEFORE the tap, not discovered after.
 *
 * Contract: features/item5-invitations · prompt §6.2 · features/one-basket-add-creators
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
import { C5, aimLabel5, modeLabel5, nameList5 } from '../../components/invitations/copy5';
import { addToBasket, basketIds } from '../../components/invitations/draft5';

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

  function add() {
    const name = (data.group && data.group.name) || groupName;
    const creators = data.can.map(c => ({ id: c.id, name: c.name, avatarUrl: c.avatarUrl || null, sourceGroupName: name }));
    const { added, already } = addToBasket(setId, creators, groupId);
    // Back to the picker, which re-reads the basket on focus and shows the new total.
    navigation.navigate('BrandSetPickCreators', {
      campaignId, setId,
      toast: already.length ? G.addedDup(added, name, already.length) : G.added(added, name),
    });
  }

  const title = G.title;
  if (status === 'loading') return <View style={base.screen}><Header title={title} onBack={() => navigation.goBack()} /><Skeleton /></View>;
  if (status === 'error') return <View style={base.screen}><Header title={title} onBack={() => navigation.goBack()} /><LoadError onRetry={load} /></View>;

  const { counts, can, cannot, group, set } = data;
  // Who of this group is already in the basket. Counted here, on the phone, because only the
  // phone knows the basket — the server has no idea what has been ticked and not yet sent.
  const have = basketIds(setId);
  const dupes = can.filter(c => have.has(c.id));
  const fresh = can.length - dupes.length;
  return (
    <View style={base.screen} testID="group-invite-check">
      <Header title={title} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 120 }}>
        <Text style={s.sub}>{summary.set.name.toUpperCase()}</Text>
        <View style={s.card}>
          <Text style={s.big} testID="group-summary">{G.summary(counts.can, counts.total)}</Text>
          <Text style={s.line}>{G.line(group.name || groupName, aimLabel5(set.goal), modeLabel5(set.shootMode), summary.set.postingDate)}</Text>
        </View>
        <Text style={s.secth} testID="will-title">{G.willAdd(counts.can)}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
          <AvatarStack people={can} extra={0} />
          {can.length > 4 ? <Text style={s.more}>{G.more(can.length - 4)}</Text> : null}
        </View>
        {dupes.length ? <Text style={s.was} testID="overlap">{G.overlap(nameList5(dupes.map(c => c.name)))}</Text> : null}
        {cannot.length ? <Text style={s.secth} testID="cant-title">{G.cant(counts.cannot)}</Text> : null}
        {cannot.map(c => (
          <MemberRow key={c.id} c={{ ...c, status: null }} sub={c.label} right={<Chip5 label={c.pick && c.pick.state === 'invited' ? C5.pick.invited : C5.pick.cantInvite} tone={c.pick && c.pick.state === 'invited' ? 'waiting' : 'ended'} />} />
        ))}
        <Text style={s.hint}>{G.hint}</Text>
      </ScrollView>
      <View style={s.footer}>
        {counts.can === 0 ? <Text style={[s.hint, { textAlign: 'center', marginBottom: 8 }]}>{G.nobody}</Text>
          : fresh === 0 ? <Text style={[s.hint, { textAlign: 'center', marginBottom: 8 }]}>{G.addNone}</Text>
            : <Text style={[s.running, { marginBottom: 8 }]} testID="group-running">{G.running(have.size, fresh)}</Text>}
        <PrimaryButton label={G.add(fresh)} onPress={add} disabled={fresh === 0} testID="group-next" />
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
  was: { fontFamily: fonts.sansRegular, fontSize: 12, color: T.ink2, lineHeight: 16, backgroundColor: T.surface, borderRadius: 10, padding: 10, marginBottom: 14 },
  running: { fontFamily: fonts.sansRegular, fontSize: 12, color: T.ink2, textAlign: 'center' },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 14, paddingBottom: 22, backgroundColor: T.bg, borderTopWidth: 1, borderTopColor: T.border },
});
