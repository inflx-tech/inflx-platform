/**
 * BrandCreatorProfileScreen — X4: a creator's profile as a brand sees it.
 * Contract: features/item2-pitch-invitation-settings · prompt §5.1 X4
 *
 * Minimal on purpose (item 3 fills it out): header, "Open to invitations for" card,
 * the Invite button (disabled until item 5 wires it), and ⋯ → Block. When the creator
 * is paused OR has blocked this brand the screen is identical: grey banner, button off.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { settingsTokens as T, fonts, fmtNum } from '../../theme/tokens';
import { brandApi } from '../../services/api';
import { TagRow, Banner, PrimaryButton } from '../../components/settings/primitives';
import { ActionSheet, ConfirmSheet } from '../../components/settings/sheets';
import { useToast, Skeleton, LoadError } from '../../components/settings/feedback';
import { AIMS, MODES, aimLabel, modeLabel, COPY } from '../../components/settings/copy';
import { Header, s as base } from './BrandPitchSettingsScreen';
import { Avatar } from './BrandBlockedCreatorsScreen';

const C = COPY.brand;

export default function BrandCreatorProfileScreen({ navigation, route }) {
  const influencerId = route?.params?.influencerId;
  const [status, setStatus] = useState('loading');
  const [inf, setInf] = useState(null);
  const [summary, setSummary] = useState(null);
  const [menu, setMenu] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const { toast, show } = useToast();

  const load = useCallback(async () => {
    setStatus('loading');
    const r = await brandApi.getCreatorProfile(influencerId);
    if (!r.success) { setStatus('error'); return; }
    setInf(r.data.influencer);
    setSummary(r.data.inviteSummary || null);
    setStatus('ready');
  }, [influencerId]);
  useEffect(() => { load(); }, [load]);

  const name = inf ? (inf.full_name || inf.name || inf.instagram_handle || 'Creator') : '';
  const first = name.split(/\s+/)[0];

  async function block() {
    setConfirm(false);
    const r = await brandApi.blockCreator(influencerId);
    if (!r.success) { show(COPY.saveFailed); return; }
    show(C.blocked(name), { undo: async () => { await brandApi.unblockCreator(influencerId); } });
  }

  const right = (
    <TouchableOpacity onPress={() => setMenu(true)} accessibilityRole="button" accessibilityLabel="More" style={hx.more} testID="more-menu">
      <Text style={hx.moreText}>⋯</Text>
    </TouchableOpacity>
  );

  if (status === 'loading') return <View style={base.screen}><Header title="Creator" onBack={() => navigation.goBack()} /><Skeleton /></View>;
  if (status === 'error') return <View style={base.screen}><Header title="Creator" onBack={() => navigation.goBack()} /><LoadError onRetry={load} /></View>;

  const notAccepting = !summary || summary.reason === 'NOT_ACCEPTING';
  const tags = summary ? [
    ...AIMS.filter(a => summary.aims.includes(a)).map(aimLabel),
    ...MODES.filter(m => summary.modes.includes(m)).map(modeLabel),
  ] : [];
  const stats = [
    inf.followers_count != null ? `${fmtNum(inf.followers_count)} Instagram` : null,
    inf.engagement_rate != null ? `${Number(inf.engagement_rate)}% engagement` : null,
    inf.city || null,
  ].filter(Boolean).join(' · ');
  const profileTags = [...(inf.niche || []), ...(inf.language || [])].map(String);

  return (
    <View style={base.screen}>
      <Header title="Creator" onBack={() => navigation.goBack()} right={right} />
      <ScrollView contentContainerStyle={base.body}>
        <View style={hx.hero}>
          <Avatar name={name} url={inf.profile_image_url} size={64} />
          <View style={{ flex: 1, marginLeft: 14 }}>
            <Text style={hx.name}>{name}</Text>
            {stats ? <Text style={hx.sub}>{stats}</Text> : null}
          </View>
        </View>
        {profileTags.length ? <View style={{ marginTop: 10 }}><TagRow items={profileTags.map(t => t.replace(/_/g, ' '))} /></View> : null}

        <View style={{ height: 16 }} />
        {notAccepting ? (
          <Banner testID="not-taking-banner" title={C.notTakingTitle} body={C.notTakingBody(first)} />
        ) : (
          <View style={hx.card} testID="open-to-card">
            <Text style={hx.cardTitle}>{C.openToTitle}</Text>
            <TagRow items={tags} />
          </View>
        )}

        {/* Disabled in item 2: item 5 wires the set picker and the "below minimum" warnings. */}
        <PrimaryButton label={C.inviteBtn} onPress={() => {}} disabled testID="invite-button" />
        <View style={{ height: 40 }} />
      </ScrollView>
      {toast}

      <ActionSheet visible={menu} onClose={() => setMenu(false)} actions={[
        { label: C.blockMenu(name), destructive: true, onPress: () => setConfirm(true) },
      ]} />
      <ConfirmSheet
        visible={confirm} danger
        title={C.blockTitle(name)} body={C.blockBody}
        confirmLabel={C.blockConfirm} cancelLabel="Cancel"
        onConfirm={block} onCancel={() => setConfirm(false)}
      />
    </View>
  );
}

export const hx = StyleSheet.create({
  hero: { flexDirection: 'row', alignItems: 'center' },
  name: { fontFamily: fonts.sansBold, fontSize: 19, color: T.ink },
  sub: { fontFamily: fonts.sansRegular, fontSize: 12.5, color: T.ink2, marginTop: 3 },
  card: { borderWidth: 1, borderColor: T.border, borderRadius: 12, padding: 14, marginBottom: 14 },
  cardTitle: { fontFamily: fonts.sansSemiBold, fontSize: 13.5, color: T.ink2, marginBottom: 8 },
  more: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  moreText: { fontSize: 22, color: T.ink, fontFamily: fonts.sansBold },
});
