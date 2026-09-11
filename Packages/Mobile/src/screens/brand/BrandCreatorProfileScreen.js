/**
 * BrandCreatorProfileScreen — P1 · P2 · P3 · P4: a creator's profile as a brand sees it.
 * Contract: features/item3-discovery-profiles-groups · prompt §6.3 (item 2 X4 grown up)
 *
 * P1 open: header, measured numbers, "{N} collaborations signed on INFLX" (hidden at 0),
 *          "In your groups", Open-to card, Invite to a set (coming soon) + Add to group.
 * P2 worked with you: adds "Collaborations with you", this brand's both-signed rows only.
 * P3 not open to your brand / P4 not taking invitations: grey banner, Invite off.
 * Blocked by you: grey chip next to the name; ⋯ offers Unblock (founder Q4).
 */

import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import { settingsTokens as T, fonts } from '../../theme/tokens';
import { brandApi } from '../../services/api';
import { TagRow, Banner, PrimaryButton, SecondaryButton } from '../../components/settings/primitives';
import { ActionSheet, ConfirmSheet } from '../../components/settings/sheets';
import { useToast, Skeleton, LoadError } from '../../components/settings/feedback';
import { AIMS, MODES, aimLabel, modeLabel, COPY, shortDate } from '../../components/settings/copy';
import { Header, s as base } from './BrandPitchSettingsScreen';
import { Avatar } from './BrandBlockedCreatorsScreen';
import { StatTriple, PostGrid } from '../../components/discovery/bits';
import { AddToGroupSheet } from '../../components/discovery/GroupSheets';
import { C3, firstName } from '../../components/discovery/copy3';
// Item 3b — S1: one platform card per added platform replaces the handle tags.
// Contract: features/item3b-social-numbers
import PlatformCard from '../../components/social/PlatformCard';

const C = COPY.brand;
const P = C3.profile;

export default function BrandCreatorProfileScreen({ navigation, route }) {
  const influencerId = route?.params?.influencerId;
  const [status, setStatus] = useState('loading');
  const [data, setData] = useState(null);
  const [menu, setMenu] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [addTo, setAddTo] = useState(null);
  const { toast, show } = useToast();

  const load = useCallback(async (quiet) => {
    if (!quiet) setStatus('loading');
    const r = await brandApi.getCreatorProfile(influencerId);
    if (!r.success) { setStatus('error'); return; }
    setData(r.data);
    setStatus('ready');
  }, [influencerId]);
  useEffect(() => { load(); }, [load]);

  const inf = data?.influencer;
  const name = inf ? (inf.full_name || inf.name || inf.instagram_handle || 'Creator') : '';
  const first = firstName(name);

  async function block() {
    setConfirm(false);
    const r = await brandApi.blockCreator(influencerId);
    if (!r.success) { show(COPY.saveFailed); return; }
    load(true);
    show(C.blocked(name), { undo: async () => { await brandApi.unblockCreator(influencerId); load(true); } });
  }
  async function unblock() {
    const r = await brandApi.unblockCreator(influencerId);
    if (!r.success) { show(COPY.saveFailed); return; }
    load(true);
    show(C.unblocked(name));
  }

  const right = (
    <TouchableOpacity onPress={() => setMenu(true)} accessibilityRole="button" accessibilityLabel="More" style={hx.more} testID="more-menu">
      <Text style={hx.moreText}>⋯</Text>
    </TouchableOpacity>
  );

  if (status === 'loading') return <View style={base.screen}><Header title="Creator" onBack={() => navigation.goBack()} /><Skeleton /></View>;
  if (status === 'error') return <View style={base.screen}><Header title="Creator" onBack={() => navigation.goBack()} /><LoadError onRetry={() => load()} /></View>;

  const summary = data.inviteSummary;
  const reason = summary ? summary.reason : 'NOT_ACCEPTING';
  const tags = summary ? [...AIMS.filter(a => summary.aims.includes(a)).map(aimLabel), ...MODES.filter(m => summary.modes.includes(m)).map(modeLabel)] : [];
  const nicheCode = Array.isArray(inf.niche) ? inf.niche[0] : inf.niche;
  const nicheLabel = nicheCode ? String(nicheCode).replace(/_/g, ' ').replace(/\b\w/g, ch => ch.toUpperCase()) : null;
  const place = [data.cityName, data.stateName].filter(Boolean).join(', ');
  const meta = [nicheLabel, place, (inf.language || []).join(', ')].filter(Boolean).join(' · ');
  const measured = data.measuredAt ? P.measured(shortDate(data.measuredAt)) : P.measuredNoDate;
  const collabs = data.collaborationsWithYou || [];
  const groups = data.groups || [];

  return (
    <View style={base.screen} testID="creator-profile">
      <Header title="Creator" onBack={() => navigation.goBack()} right={right} />
      <ScrollView contentContainerStyle={base.body}>
        <View style={hx.hero}>
          <Avatar name={name} url={inf.profile_image_url} size={64} />
          <View style={{ flex: 1, marginLeft: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
              <Text style={hx.name}>{name}</Text>
              {data.blockedByYou ? <View style={hx.blocked} testID="blocked-chip"><Text style={hx.blockedText}>{C3.discover.chips.blocked}</Text></View> : null}
            </View>
            {meta ? <Text style={hx.sub}>{meta}</Text> : null}
          </View>
        </View>

        <StatTriple instagram={inf.followers_count} youtube={inf.youtube_subscribers} engagement={inf.engagement_rate} />
        <Text style={hx.measured} testID="measured-line">{measured}</Text>
        <View style={{ marginTop: 12 }}>
          {['instagram', 'youtube'].map(p => (data.social && data.social[p] ? (
            <PlatformCard key={p} platform={p} data={data.social[p]} mode="brand"
              onPress={() => navigation.navigate('SocialDetail', { platform: p, viewer: 'brand', influencerId, creatorName: name })} />
          ) : null))}
        </View>
        {data.signedCollaborationsLabel ? <Text style={hx.signed} testID="signed-line">{data.signedCollaborationsLabel}</Text> : null}
        {groups.length ? <Text style={hx.groups} testID="groups-line">{C3.groups.inYourGroups(groups.map(g => g.name).join(', '))}</Text> : null}

        <View style={{ height: 16 }} />
        {reason === 'OK' ? (
          <View style={hx.card} testID="open-to-card">
            <Text style={hx.cardTitle}>{P.openTo}</Text>
            <TagRow items={tags} />
          </View>
        ) : reason === 'NOT_MATCHING' ? (
          <Banner testID="not-open-banner" title={P.notOpenTitle} body={P.notOpenBody(first)} />
        ) : (
          <Banner testID="not-taking-banner" title={P.notTakingTitle} body={P.notTakingBody(first)} />
        )}

        <PrimaryButton label={P.invite} onPress={() => show(C3.toasts.inviteSoon)} disabled={reason !== 'OK'} testID="invite-button" />
        <SecondaryButton label={P.addToGroup} onPress={() => setAddTo({ id: influencerId, name })} testID="add-to-group-button" />

        {collabs.length ? (
          <View style={{ marginTop: 22 }} testID="collabs-with-you">
            <Text style={hx.sectionTitle}>{P.collabsWithYou}</Text>
            {collabs.map(c => {
              const tone = T.state[c.stateFamily] || T.state.ended;
              return (
                <View key={c.id} style={hx.collabRow} testID={`collab-${c.id}`}>
                  <View style={{ flex: 1 }}>
                    <Text style={hx.collabName} numberOfLines={1}>{[c.campaignName, c.setName].filter(Boolean).join(' · ')}</Text>
                    <Text style={hx.sub}>{P.collabLine(aimLabel(c.aim) || c.aim, shortDate(c.signedAt))}</Text>
                  </View>
                  <View style={[hx.stateChip, { backgroundColor: tone.bg }]}><Text style={[hx.stateText, { color: tone.fg }]}>{c.stateLabel}</Text></View>
                </View>
              );
            })}
          </View>
        ) : null}

        <View style={{ marginTop: 22 }}>
          <Text style={hx.sectionTitle}>{P.postsTitle}</Text>
          <PostGrid posts={[]} emptyTitle={P.postsEmptyTitle} emptyBody={P.postsEmptyBody(first)} />
        </View>

        <View style={{ marginTop: 8 }}>
          {inf.instagram_url ? <SecondaryButton label={P.openIg} onPress={() => Linking.openURL(inf.instagram_url).catch(() => {})} testID="open-instagram" /> : null}
          {inf.youtube_url ? <SecondaryButton label={P.openYt} onPress={() => Linking.openURL(inf.youtube_url).catch(() => {})} testID="open-youtube" /> : null}
        </View>
        <View style={{ height: 40 }} />
      </ScrollView>
      {toast}

      <ActionSheet visible={menu} onClose={() => setMenu(false)} actions={data.blockedByYou ? [
        { label: `${C.unblock} ${name}`, onPress: unblock },
      ] : [
        { label: C.blockMenu(name), destructive: true, onPress: () => setConfirm(true) },
      ]} />
      <ConfirmSheet visible={confirm} danger title={C.blockTitle(name)} body={C.blockBody} confirmLabel={C.blockConfirm} cancelLabel="Cancel" onConfirm={block} onCancel={() => setConfirm(false)} />
      <AddToGroupSheet creator={addTo} onClose={() => setAddTo(null)} onDone={(msg) => { show(msg); load(true); }} />
    </View>
  );
}

export const hx = StyleSheet.create({
  hero: { flexDirection: 'row', alignItems: 'center' },
  name: { fontFamily: fonts.sansBold, fontSize: 19, color: T.ink, marginRight: 8 },
  sub: { fontFamily: fonts.sansRegular, fontSize: 12.5, color: T.ink2, marginTop: 3 },
  card: { borderWidth: 1, borderColor: T.border, borderRadius: 12, padding: 14, marginBottom: 14 },
  cardTitle: { fontFamily: fonts.sansSemiBold, fontSize: 13.5, color: T.ink2, marginBottom: 8 },
  more: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  moreText: { fontSize: 22, color: T.ink, fontFamily: fonts.sansBold },
  blocked: { backgroundColor: T.state.ended.bg, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
  blockedText: { fontFamily: fonts.sansSemiBold, fontSize: 11, color: T.state.ended.fg },
  measured: { fontFamily: fonts.sansRegular, fontSize: 11.5, color: T.ink3, marginTop: 6 },
  signed: { fontFamily: fonts.sansSemiBold, fontSize: 13, color: T.ink, marginTop: 10 },
  groups: { fontFamily: fonts.sansRegular, fontSize: 12.5, color: T.ink2, marginTop: 4 },
  sectionTitle: { fontFamily: fonts.sansSemiBold, fontSize: 14, color: T.ink, marginBottom: 8 },
  collabRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: T.border },
  collabName: { fontFamily: fonts.sansSemiBold, fontSize: 14, color: T.ink },
  stateChip: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999, marginLeft: 10 },
  stateText: { fontFamily: fonts.sansSemiBold, fontSize: 11.5 },
});
