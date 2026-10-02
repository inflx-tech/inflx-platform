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
 *
 * ui-walk-fixes board C: the "Add N to your selection" strip is part of the column, under the
 * list (BottomBar) — it no longer floats over the last rows; the toast floats just above it.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { settingsTokens as T, fonts } from '../../theme/tokens';
import { brandApi } from '../../services/api';
import { PrimaryButton } from '../../components/settings/primitives';
import { useToast, Skeleton, LoadError } from '../../components/settings/feedback';
import { BottomBar } from '../../components/shell/BottomBar';
import { FormArea } from '../../components/shell/FormScroll';
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
  // ui-walk-fixes D2: a creator who can't be invited says why when tapped, here as in the picker.
  const { toast, show } = useToast({ inFlow: true });

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
      {/* ui-walk-fixes board C: the list scrolls in the room above the strip; nothing floats over it. */}
      <FormArea>
      <ScrollView style={s.fill} contentContainerStyle={{ padding: 18, paddingBottom: 24 }}>
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
        {/* D2: the line under her name is the server's short reason (c.label); tapping a creator
            who can't be invited shows the server's sentence, falling back to that line when an
            older server sends none. "Already in this set" has nothing more to say, as before. */}
        {cannot.map(c => {
          const invited = !!(c.pick && c.pick.state === 'invited');
          const why = c.message || (c.pick && c.pick.message) || c.label;
          return (
            <MemberRow key={c.id} c={{ ...c, status: null }} sub={c.label}
              onOpen={!invited && why ? () => show(why) : undefined}
              right={<Chip5 label={invited ? C5.pick.invited : C5.pick.cantInvite} tone={invited ? 'waiting' : 'ended'} />} />
          );
        })}
        <Text style={s.hint}>{G.hint}</Text>
      </ScrollView>
      {toast}
      </FormArea>
      {/* The line above the button is the strip's first child; the strip keeps the two 8 apart
          (the 8 the line used to carry under itself). */}
      <BottomBar testID="group-check-bar">
        {counts.can === 0 ? <Text style={[s.hint, s.centre]}>{G.nobody}</Text>
          : fresh === 0 ? <Text style={[s.hint, s.centre]}>{G.addNone}</Text>
            : <Text style={s.running} testID="group-running">{G.running(have.size, fresh)}</Text>}
        <PrimaryButton label={G.add(fresh)} onPress={add} disabled={fresh === 0} testID="group-next" />
      </BottomBar>
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
  centre: { textAlign: 'center' },
  // The list fills the box above the strip.
  fill: { flex: 1 },
});
