/**
 * ProfileScreen — A7: the creator's Profile tab. Header (photo, name, @handle, account
 * status) and one row per thing to edit: Profile info, Niche & languages, Invitation
 * settings, Payment & tax, Legal & policies, Log out. The inline edit modes and the
 * decorative notifications switch are gone (founder's item-3 decisions).
 * Contract: features/item3-discovery-profiles-groups · prompt §6.1 A7
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
import { C3 } from '../../components/discovery/copy3';

const R = C3.creatorProfile;
const STATUS_LABEL = { approved: 'Approved', pending: 'Pending review', rejected: 'Rejected', suspended: 'Suspended' };

export default function ProfileScreen({ navigation, route }) {
  const { setRole: setAppRole } = useContext(AuthContext);
  const [status, setStatus] = useState('loading');
  const [me, setMe] = useState(null);
  const [invite, setInvite] = useState(null);
  const { toast, show } = useToast();
  useRouteToast(navigation, route, show);

  const load = useCallback(async () => {
    const [r, i] = await Promise.all([influencerApi.getMe(), influencerApi.getInvitationSettings()]);
    if (!r.success) { setStatus('error'); return; }
    setMe(r.data?.influencer || r.data);
    setInvite(i.success ? i.data.summary || null : null);
    setStatus('ready');
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  function logout() {
    Alert.alert('Logout', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: async () => { await clearSession(); setAppRole(''); } },
    ]);
  }

  if (status === 'loading') return <View style={base.screen}><Text style={s.title}>Profile</Text><Skeleton /></View>;
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
  const st = me.user_status || 'pending';
  const needsNiche = me.needsNiche != null ? me.needsNiche : !(Array.isArray(me.niche) && me.niche.length === 1);
  const inviteValue = invite ? `${invite.labelState === 'paused' ? 'Paused' : 'Open'} · ${aimsPhrase(invite.aims)} · ${modesPhrase(invite.modes)}` : '';

  return (
    <View style={base.screen} testID="creator-profile-main">
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <Text style={s.title}>Profile</Text>
        <View style={s.hero}>
          <Avatar name={name} url={me.profile_image_url} size={56} />
          <View style={{ flex: 1, marginLeft: 14 }}>
            <Text style={s.name} numberOfLines={1}>{name}</Text>
            {me.instagram_handle ? <Text style={s.line}>@{me.instagram_handle}</Text> : null}
          </View>
          <StatusChip on={st === 'approved'} label={STATUS_LABEL[st] || st} />
        </View>
        <View style={{ paddingHorizontal: 18 }}>
          <ProfileRow label={R.rows.info[0]} sub={R.rows.info[1]} onPress={() => navigation.navigate('ProfileInfo')} testID="row-profile-info" />
          <ProfileRow label={R.rows.niche} warn={needsNiche ? R.niche.warning : ''} onPress={() => navigation.navigate('NicheLanguages')} testID="row-niche" />
          <ProfileRow label={R.rows.invitation} value={inviteValue} right={invite ? <StatusChip on={invite.labelState !== 'paused'} /> : null} onPress={() => navigation.navigate('InvitationSettings')} testID="row-invitation-settings" />
          <ProfileRow label={R.rows.payment} onPress={() => navigation.navigate('PaymentTax')} testID="row-payment-tax" />
          <ProfileRow label={R.rows.legal} onPress={() => navigation.navigate('LegalList')} testID="row-legal" />
          <TouchableOpacity style={s.logout} onPress={logout} testID="row-logout"><Text style={s.logoutText}>{R.logout}</Text></TouchableOpacity>
        </View>
      </ScrollView>
      {toast}
    </View>
  );
}

const s = StyleSheet.create({
  title: { fontFamily: fonts.sansBold, fontSize: 22, color: T.ink, paddingTop: 54, paddingHorizontal: 18 },
  hero: { flexDirection: 'row', alignItems: 'center', padding: 18, paddingBottom: 6 },
  name: { fontFamily: fonts.sansBold, fontSize: 18, color: T.ink },
  line: { fontFamily: fonts.sansRegular, fontSize: 12.5, color: T.ink2, marginTop: 2 },
  logout: { paddingVertical: 18 },
  logoutText: { fontFamily: fonts.sansSemiBold, fontSize: 15, color: T.danger },
  center: { alignItems: 'center', justifyContent: 'center', padding: 28 },
  recoverTitle: { fontFamily: fonts.sansBold, fontSize: 17, color: T.ink, textAlign: 'center' },
  recoverBody: { fontFamily: fonts.sansRegular, fontSize: 13.5, color: T.ink2, textAlign: 'center', marginTop: 8, lineHeight: 19 },
});
