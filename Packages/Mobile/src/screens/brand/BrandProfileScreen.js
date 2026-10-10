/**
 * BrandProfileScreen — B3: the brand's Profile tab. A header (logo, name, "Fashion · city",
 * account status), the amber "N things left" note, one row per thing to edit with a red dot
 * where a missing item lives (Business details · What you sell · Branches · Pitch settings ·
 * Brand overview · Links · Legal · Log out), then "Submit for review" — the new gate. GSTIN has
 * left this list for the Wallet tab.
 * Contract: features/registration-and-profile · features/item3-discovery-profiles-groups
 */
import React, { useCallback, useContext, useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { settingsTokens as T, brandPalette as BP, fonts } from '../../theme/tokens';
import { brandApi, referenceApi, clearSession } from '../../services/api';
import { AuthContext } from '../../../App';
import { StatusChip, PrimaryButton } from '../../components/settings/primitives';
import { useToast, Skeleton } from '../../components/settings/feedback';
import { aimsPhrase, modesPhrase } from '../../components/settings/copy';
import { s as base } from './BrandPitchSettingsScreen';
import { Avatar } from './BrandBlockedCreatorsScreen';
import useRouteToast from '../../hooks/useRouteToast';
import useTopInset, { TOP_GAP_TITLE } from '../../hooks/useTopInset';
import { C3, subCategoryLabel } from '../../components/discovery/copy3';
// Item 20 — the "Linked creators" row. Contract: features/item20-own-brand
import { O20 } from '../../components/ownbrand/copy20';
import { CompletenessNote, SubmitForReviewBlock, Dot } from '../../components/registration/ReviewBlock';
import { BRAND_ROW_KEYS, rowNeeds, REVIEW_COPY } from '../../components/registration/completeness';

const R = C3.brandProfile;

export function ProfileRow({ label, sub, value, warn, right, dot, onPress, testID }) {
  return (
    <TouchableOpacity style={s.row} onPress={onPress} activeOpacity={0.7} testID={testID} accessibilityRole="button">
      <View style={{ flex: 1 }}>
        <Text style={s.rowLabel}>{label}</Text>
        {sub ? <Text style={s.rowSub} numberOfLines={1}>{sub}</Text> : null}
        {value ? <Text style={s.rowValue} numberOfLines={2}>{value}</Text> : null}
        {warn ? <View style={s.warn}><Text style={s.warnText}>{warn}</Text></View> : null}
      </View>
      {right || null}
      {dot ? <Dot testID={testID ? `${testID}-dot` : undefined} /> : null}
      <Text style={s.chev}>›</Text>
    </TouchableOpacity>
  );
}

export default function BrandProfileScreen({ navigation, route }) {
  const { setRole: setAppRole } = useContext(AuthContext);
  const [status, setStatus] = useState('loading');
  const [loadError, setLoadError] = useState(null);
  const [me, setMe] = useState(null);
  const [pitch, setPitch] = useState(null);
  const [linkedN, setLinkedN] = useState(0);
  const [cats, setCats] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const { toast, show } = useToast();
  useRouteToast(navigation, route, show);
  // ui-walk-fixes D4 — no blank strip above the title: the phone's real top inset plus a small gap.
  const top = useTopInset(TOP_GAP_TITLE);

  useEffect(() => { referenceApi.brandCategories().then(r => { if (r.success) setCats(r.data.items || []); }).catch(() => {}); }, []);
  const load = useCallback(async () => {
    const [r, p] = await Promise.all([brandApi.getMe(), brandApi.getPitchSettings()]);
    if (!r.success) { setLoadError(r.error?.code === 'NOT_FOUND' ? 'no_profile' : 'load_failed'); setStatus('error'); return; }
    setMe(r.data);
    setPitch(p.success ? p.data.summary || null : null);
    setStatus('ready');
    // Item 20 — how many creators are linked to this brand (the row's line; never blocks the screen).
    const lc = brandApi.linkedCreators ? await brandApi.linkedCreators() : null;
    setLinkedN(lc && lc.success ? (lc.data.linked || []).length : 0);
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  function logout() {
    Alert.alert('Logout', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: async () => { await clearSession(); setAppRole(''); } },
    ]);
  }

  async function submitForReview() {
    setSubmitting(true);
    const r = await brandApi.submitForReview();
    setSubmitting(false);
    if (!r.success) { show(r.error?.message || "Couldn't send it for review. Please try again."); return; }
    show(r.data?.message || 'Sent for review.');
    load();
  }

  if (status === 'loading') return <View style={base.screen}><Text style={[s.title, { paddingTop: top }]}>Profile</Text><Skeleton /></View>;
  if (status === 'error') {
    const noProfile = loadError === 'no_profile';
    return (
      <View style={[base.screen, s.center]}>
        <Text style={s.recoverTitle}>{noProfile ? 'Your business details are missing' : "Couldn't load your profile"}</Text>
        <Text style={s.recoverBody}>{noProfile
          ? 'This account was signed up but the business registration form was never completed. Sign in again to finish it — it takes a minute.'
          : 'We could not reach the server. Check your connection and try again.'}</Text>
        <View style={{ width: 200, marginTop: 16 }}>
          <PrimaryButton label={noProfile ? 'Complete registration' : 'Try again'} onPress={noProfile ? async () => { await clearSession(); setAppRole(''); } : load} testID="recover" />
        </View>
      </View>
    );
  }

  const b = me.brand;
  const st = me.user_status || b.user_status || 'pending';
  const completeness = me.completeness || null;
  const missing = completeness ? completeness.missing : [];
  const pendingDots = st !== 'approved';
  const subs = Array.isArray(b.sub_categories) ? b.sub_categories : [];
  const subLabels = subs.map(code => cats.find(c => c.code === code)?.label || subCategoryLabel(code)).join(', ');
  const headerLine = me.mainCity ? `Fashion · ${me.mainCity.name}` : 'Fashion';
  const pitchValue = pitch ? `${pitch.labelState === 'paused' ? 'Paused' : 'Accepting'} · ${aimsPhrase(pitch.aims)} · ${modesPhrase(pitch.modes)}` : '';

  return (
    <View style={base.screen} testID="brand-profile">
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <Text style={[s.title, { paddingTop: top }]}>Profile</Text>
        <View style={s.hero}>
          <Avatar name={b.business_name} url={b.logo_url} size={56} />
          <View style={{ flex: 1, marginLeft: 14 }}>
            <Text style={s.name} numberOfLines={1}>{b.business_name}</Text>
            <Text style={s.line} testID="profile-header-line">{headerLine}</Text>
          </View>
          <StatusChip on={st === 'approved'} label={REVIEW_COPY.status[st] || st} />
        </View>
        <CompletenessNote completeness={completeness} userStatus={st} />
        <View style={{ paddingHorizontal: 18 }}>
          <ProfileRow label={R.rows.details[0]} sub={R.rows.details[1]} dot={pendingDots && rowNeeds(BRAND_ROW_KEYS.details, missing)} onPress={() => navigation.navigate('BrandBusinessDetails')} testID="row-business-details" />
          <ProfileRow label={R.rows.subs} value={subLabels} dot={pendingDots && rowNeeds(BRAND_ROW_KEYS.subs, missing)} onPress={() => navigation.navigate('BrandSubCategories')} testID="row-sub-categories" />
          <ProfileRow label={R.rows.branches} value={R.branches.locations((me.branches || []).length)} dot={pendingDots && rowNeeds(BRAND_ROW_KEYS.branches, missing)} onPress={() => navigation.navigate('BrandBranches')} testID="row-branches" />
          <ProfileRow label={R.rows.pitch} value={pitchValue} right={pitch ? <StatusChip on={pitch.labelState !== 'paused'} /> : null} onPress={() => navigation.navigate('BrandPitchSettings')} testID="row-pitch-settings" />
          <ProfileRow label={O20.linkedRow} sub={O20.linkedRowSub(linkedN)} onPress={() => navigation.navigate('BrandLinkedCreators')} testID="row-linked-creators" />
          <ProfileRow label={R.rows.overview[0]} sub={R.rows.overview[1]} onPress={() => navigation.navigate('BrandOwnOverview', { brandId: b.id })} testID="row-brand-overview" />
          <ProfileRow label={R.rows.links[0]} sub={R.rows.links[1]} onPress={() => navigation.navigate('BrandLinks')} testID="row-links" />
          <ProfileRow label={R.rows.legal} onPress={() => navigation.navigate('LegalList')} testID="row-legal" />
          <TouchableOpacity style={s.logout} onPress={logout} testID="row-logout"><Text style={s.logoutText}>{R.logout}</Text></TouchableOpacity>
        </View>
        <SubmitForReviewBlock completeness={completeness} userStatus={st} submittedAt={me.submitted_for_review_at} onSubmit={submitForReview} busy={submitting} />
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
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: T.border },
  rowLabel: { fontFamily: fonts.sansSemiBold, fontSize: 15, color: T.ink },
  rowSub: { fontFamily: fonts.sansRegular, fontSize: 12, color: T.ink3, marginTop: 2 },
  rowValue: { fontFamily: fonts.sansMedium, fontSize: 12.5, color: T.ink2, marginTop: 2 },
  warn: { backgroundColor: BP.warnPale, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, marginTop: 6, alignSelf: 'flex-start' },
  warnText: { fontFamily: fonts.sansSemiBold, fontSize: 12, color: BP.warnText },
  chev: { fontFamily: fonts.sansBold, fontSize: 18, color: T.ink3, marginLeft: 10 },
  logout: { paddingVertical: 18 },
  logoutText: { fontFamily: fonts.sansSemiBold, fontSize: 15, color: T.danger },
  center: { alignItems: 'center', justifyContent: 'center', padding: 28 },
  recoverTitle: { fontFamily: fonts.sansBold, fontSize: 17, color: T.ink, textAlign: 'center' },
  recoverBody: { fontFamily: fonts.sansRegular, fontSize: 13.5, color: T.ink2, textAlign: 'center', marginTop: 8, lineHeight: 19 },
});
