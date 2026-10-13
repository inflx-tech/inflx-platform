/**
 * ProfileScreen — C4: the creator's Profile tab. Header (photo, name, @handle · city, account
 * status), the amber "N things left" note, one row per thing to edit with a red dot where a
 * missing item lives (Profile info · Your numbers · Niche & languages · Invitation settings ·
 * Legal), then "Submit for review" — the new gate. Payment & tax has left this list for the
 * Wallet tab. Contract: features/registration-and-profile · features/item3-discovery-profiles-groups
 */
import React, { useCallback, useContext, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { settingsTokens as T, fonts } from '../../theme/tokens';
import { influencerApi, clearSession } from '../../services/api';
import { AuthContext } from '../../../App';
import { StatusChip, PrimaryButton } from '../../components/settings/primitives';
import { useToast, Skeleton } from '../../components/settings/feedback';
import { aimsPhrase, modesPhrase } from '../../components/settings/copy';
import { s as base } from '../brand/BrandPitchSettingsScreen';
import { Avatar } from '../brand/BrandBlockedCreatorsScreen';
import { ProfileRow } from '../brand/BrandProfileScreen';
import useRouteToast from '../../hooks/useRouteToast';
import useTopInset, { TOP_GAP_TITLE } from '../../hooks/useTopInset';
import { C3, fmtCompact } from '../../components/discovery/copy3';
// Item 3b — the "Your numbers" row between Profile info and Niche (R3). Contract: features/item3b-social-numbers
import { C3B } from '../../components/social/copy3b';
import { CompletenessNote, SubmitForReviewBlock } from '../../components/registration/ReviewBlock';
import { CREATOR_ROW_KEYS, rowNeeds, REVIEW_COPY } from '../../components/registration/completeness';
// Item 20 — the "My brand" row. Never one of the "things left". Contract: features/item20-own-brand
import { O20 } from '../../components/ownbrand/copy20';
// creator-address-bank-save — the "Delivery address" row. Never one of the "things left".
import { ADDR } from '../../components/profile/addressBankCopy';

const R = C3.creatorProfile;

/** R3 chip: red for Fix …, blue for Waiting / Measuring. */
export function SocialChip({ chip }) {
  if (!chip) return null;
  const tone = chip.startsWith('fix') ? T.state.declined : T.state.waiting;
  return (
    <View style={{ backgroundColor: tone.bg, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 }} testID={`social-chip-${chip}`}>
      <Text style={{ fontFamily: fonts.sansSemiBold, fontSize: 11, color: tone.fg }}>{C3B.r3.chips[chip]}</Text>
    </View>
  );
}
/** "Instagram 48.2K · YouTube 12.1K" — added platforms only, "—" where there is no number yet. */
export function socialSubtitle(social) {
  if (!social) return '';
  const parts = [];
  if (social.instagram) parts.push(`Instagram ${fmtCompact(social.instagram.followers)}`);
  if (social.youtube) parts.push(`YouTube ${fmtCompact(social.youtube.subscribers)}`);
  return C3B.r3.sub(parts);
}

export default function ProfileScreen({ navigation, route }) {
  const { setRole: setAppRole } = useContext(AuthContext);
  const [status, setStatus] = useState('loading');
  const [me, setMe] = useState(null);
  const [meta, setMeta] = useState({});
  const [invite, setInvite] = useState(null);
  const [social, setSocial] = useState(null);
  const [brandLink, setBrandLink] = useState(null);
  const [address, setAddress] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  // Item 12 (Phase 2b): the upload test row appears only while the server switch is on.
  const [probe, setProbe] = useState(false);
  const { toast, show } = useToast();
  useRouteToast(navigation, route, show);
  // ui-walk-fixes D4 — no blank strip above the title: the phone's real top inset plus a small gap.
  const top = useTopInset(TOP_GAP_TITLE);

  const load = useCallback(async () => {
    const [r, i, so] = await Promise.all([influencerApi.getMe(), influencerApi.getInvitationSettings(), influencerApi.getMySocial ? influencerApi.getMySocial() : Promise.resolve({ success: false })]);
    if (!r.success) { setStatus('error'); return; }
    setMe(r.data?.influencer || r.data);
    setMeta(r.data || {});
    setInvite(i.success ? i.data.summary || null : null);
    setSocial(so && so.success ? so.data : null);
    setStatus('ready');
    const ad = influencerApi.getDeliveryAddress ? await influencerApi.getDeliveryAddress() : null;
    setAddress(ad && ad.success ? ad.data.address || null : null);
    const bl = influencerApi.brandLink ? await influencerApi.brandLink() : null;
    setBrandLink(bl && bl.success ? bl.data.link || null : null);
    const pr = influencerApi.uploadProbeStatus ? await influencerApi.uploadProbeStatus() : null;
    setProbe(!!(pr && pr.success && pr.data && pr.data.enabled === true));
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  function logout() {
    Alert.alert('Logout', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: async () => { await clearSession(); setAppRole(''); } },
    ]);
  }

  async function submitForReview() {
    setSubmitting(true);
    const r = await influencerApi.submitForReview();
    setSubmitting(false);
    if (!r.success) { show(r.error?.message || "Couldn't send it for review. Please try again."); return; }
    show(r.data?.message || 'Sent for review.');
    load();
  }

  if (status === 'loading') return <View style={base.screen}><Text style={[s.title, { paddingTop: top }]}>Profile</Text><Skeleton /></View>;
  if (status === 'error') {
    return (
      <View style={[base.screen, s.center]}>
        <Text style={s.recoverTitle}>Couldn't load your profile</Text>
        <Text style={s.recoverBody}>We could not reach the server. Check your connection and try again.</Text>
        <View style={{ width: 200, marginTop: 16 }}><PrimaryButton label="Try again" onPress={load} testID="recover" /></View>
      </View>
    );
  }

  const name = me.full_name || me.name || me.instagram_handle || 'Creator';
  const st = meta.user_status || me.user_status || 'pending';
  const completeness = meta.completeness || null;
  const missing = completeness ? completeness.missing : [];
  const needsNiche = me.needsNiche != null ? me.needsNiche : !(Array.isArray(me.niche) && me.niche.length === 1);
  const inviteValue = invite ? `${invite.labelState === 'paused' ? 'Paused' : 'Open'} · ${aimsPhrase(invite.aims)} · ${modesPhrase(invite.modes)}` : '';
  const line = [me.instagram_handle ? `@${me.instagram_handle}` : '', me.city_name || me.city || ''].filter(Boolean).join(' · ');

  return (
    <View style={base.screen} testID="creator-profile-main">
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <Text style={[s.title, { paddingTop: top }]}>Profile</Text>
        <View style={s.hero}>
          <Avatar name={name} url={me.profile_image_url} size={56} />
          <View style={{ flex: 1, marginLeft: 14 }}>
            <Text style={s.name} numberOfLines={1}>{name}</Text>
            {line ? <Text style={s.line}>{line}</Text> : null}
          </View>
          <StatusChip on={st === 'approved'} label={REVIEW_COPY.status[st] || st} />
        </View>
        <CompletenessNote completeness={completeness} userStatus={st} />
        <View style={{ paddingHorizontal: 18 }}>
          <ProfileRow label={R.rows.info[0]} sub={R.rows.info[1]} dot={st !== 'approved' && rowNeeds(CREATOR_ROW_KEYS.info, missing)} onPress={() => navigation.navigate('ProfileInfo')} testID="row-profile-info" />
          <ProfileRow label={ADDR.row} sub={address ? ADDR.rowSaved(address) : ADDR.rowAsk} onPress={() => navigation.navigate('DeliveryAddress')} testID="row-delivery-address" />
          <ProfileRow label={C3B.r3.row} sub={socialSubtitle(social)} right={<SocialChip chip={social && social.chip} />} onPress={() => navigation.navigate('YourNumbers')} testID="row-your-numbers" />
          <ProfileRow label={R.rows.niche} warn={needsNiche ? R.niche.warning : ''} dot={st !== 'approved' && rowNeeds(CREATOR_ROW_KEYS.niche, missing)} onPress={() => navigation.navigate('NicheLanguages')} testID="row-niche" />
          <ProfileRow label={R.rows.invitation} value={inviteValue} right={invite ? <StatusChip on={invite.labelState !== 'paused'} /> : null} onPress={() => navigation.navigate('InvitationSettings')} testID="row-invitation-settings" />
          <ProfileRow label={O20.row} value={brandLink ? brandLink.brand.name : ''} sub={brandLink ? '' : O20.rowAsk}
            right={brandLink ? <StatusChip on label={O20.linked} /> : null} onPress={() => navigation.navigate('MyBrand')} testID="row-my-brand" />
          <ProfileRow label={R.rows.legal} onPress={() => navigation.navigate('LegalList')} testID="row-legal" />
          {probe ? <ProfileRow label="Upload test" sub="Checks a large video reaches INFLX from this phone" onPress={() => navigation.navigate('UploadProbe')} testID="row-upload-probe" /> : null}
          <TouchableOpacity style={s.logout} onPress={logout} testID="row-logout"><Text style={s.logoutText}>{R.logout}</Text></TouchableOpacity>
        </View>
        <SubmitForReviewBlock completeness={completeness} userStatus={st} submittedAt={meta.submitted_for_review_at} onSubmit={submitForReview} busy={submitting} />
      </ScrollView>
      {toast}
    </View>
  );
}

const s = StyleSheet.create({
  title: { fontFamily: fonts.sansBold, fontSize: 22, color: T.ink, paddingTop: TOP_GAP_TITLE, paddingHorizontal: 18 },
  hero: { flexDirection: 'row', alignItems: 'center', padding: 18, paddingBottom: 6 },
  name: { fontFamily: fonts.sansBold, fontSize: 18, color: T.ink },
  line: { fontFamily: fonts.sansRegular, fontSize: 12.5, color: T.ink2, marginTop: 2 },
  logout: { paddingVertical: 18 },
  logoutText: { fontFamily: fonts.sansSemiBold, fontSize: 15, color: T.danger },
  center: { alignItems: 'center', justifyContent: 'center', padding: 28 },
  recoverTitle: { fontFamily: fonts.sansBold, fontSize: 17, color: T.ink, textAlign: 'center' },
  recoverBody: { fontFamily: fonts.sansRegular, fontSize: 13.5, color: T.ink2, textAlign: 'center', marginTop: 8, lineHeight: 19 },
});
