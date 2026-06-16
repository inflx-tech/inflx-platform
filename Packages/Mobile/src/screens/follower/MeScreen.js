import React, { useState, useCallback, useContext } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { creatorVibe as C, fonts, fmtRupees } from '../../theme/tokens';
import { followerApi } from '../../services/api';
import { AuthContext } from '../../../App';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ErrorBoundary from '../../components/ErrorBoundary';

/**
 * MeScreen (Profile) — rebuilt to orders-profile-comprehensive.html.
 * Contract: features/follower-profile-rebuild.
 *
 * Profile card · stats (Orders/Following/Saved) · Wallet card · Refer & Earn ·
 * menu rows · logout. User-data screen (no admin Section Manager). getMe + logout
 * flow preserved; counts + wallet from existing follower endpoints.
 */

function MeInner({ navigation }) {
  const { setRole } = useContext(AuthContext);
  const [profile, setProfile] = useState(null);
  const [stats, setStats] = useState({ orders: null, following: null, saved: null });
  const [wallet, setWallet] = useState(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(useCallback(() => {
    setLoading(true);
    followerApi.getMe()
      .then(res => { const d = res.data || res; setProfile(d.follower || d); })
      .catch(e => console.error('[MeScreen] Error:', e.message))
      .finally(() => setLoading(false));
    // counts + wallet (best-effort; show — when a call fails leave it blank, not 0)
    followerApi.getActivity().then(r => setStats(s => ({ ...s, orders: ((r.data || r)?.items || []).length }))).catch(() => {});
    followerApi.getFollowing().then(r => setStats(s => ({ ...s, following: ((r.data || r)?.influencers || (r.data || r)?.following || []).length }))).catch(() => {});
    followerApi.getSavedOffers().then(r => setStats(s => ({ ...s, saved: ((r.data || r)?.offers || (r.data || r)?.saved || []).length }))).catch(() => {});
    followerApi.getWallet().then(r => { const d = r.data || r; setWallet(d.balance ?? d.wallet_balance ?? d.wallet?.balance ?? null); }).catch(() => {});
  }, []));

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: async () => {
        await AsyncStorage.multiRemove(['inflx_token', 'inflx_refresh_token', 'inflx_user']);
        setRole('');
      } },
    ]);
  };

  if (loading) {
    return <View style={s.center}><ActivityIndicator size="large" color={C.brown} /></View>;
  }

  const menu = [
    { icon: 'package-variant', label: 'My Orders', sub: 'history & tracking', onPress: () => navigation.navigate('OrderHistory') },
    { icon: 'account-group-outline', label: 'Following', sub: 'creators you follow', onPress: () => navigation.navigate('FollowedInfluencers') },
    { icon: 'bookmark-outline', label: 'Saved Offers', sub: 'bookmarked deals', onPress: () => navigation.navigate('SavedList') },
    { icon: 'map-marker-outline', label: 'My Addresses', sub: 'delivery addresses', onPress: () => navigation.navigate('Address') },
    { icon: 'keyboard-return', label: 'Returns', sub: 'requests & status', onPress: () => navigation.navigate('OrderHistory') },
    { icon: 'cog-outline', label: 'Settings & Help', sub: 'notifications · support', onPress: () => Alert.alert('Settings & Help', 'Coming soon.') },
  ];

  return (
    <ScrollView style={s.container} contentContainerStyle={{ paddingBottom: 110 }}>
      <Text style={s.title}>Profile</Text>

      {/* profile card */}
      <View style={s.pcard}>
        <View style={s.pav}><Text style={s.pavTxt}>{getInitials(profile?.name)}</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={s.pn}>{profile?.name || 'Follower'}</Text>
          {profile?.phone ? <Text style={s.pp}>{profile.phone}</Text> : null}
          {profile?.user_city ? <Text style={s.pcity}>📍 {String(profile.user_city).toUpperCase()}</Text> : null}
        </View>
      </View>

      {/* stats */}
      <View style={s.stats}>
        {[
          { n: stats.orders, l: 'ORDERS' },
          { n: stats.following, l: 'FOLLOWING' },
          { n: stats.saved, l: 'SAVED' },
        ].map((st, i) => (
          <View key={i} style={[s.stat, i < 2 && s.statBorder]}>
            <Text style={s.statN}>{st.n != null ? st.n : '—'}</Text>
            <Text style={s.statL}>{st.l}</Text>
          </View>
        ))}
      </View>

      {/* wallet */}
      <TouchableOpacity style={s.wallet} activeOpacity={0.9} onPress={() => navigation.navigate('FollowerWallet')}>
        <View style={{ flex: 1 }}>
          <Text style={s.wl}>INFLX Wallet · cashback from creator visits</Text>
          <Text style={s.wb}>{wallet != null ? fmtRupees(wallet) : '—'}</Text>
        </View>
        <Text style={s.wa}>›</Text>
      </TouchableOpacity>

      {/* refer & earn */}
      <View style={s.refer}>
        <Text style={{ fontSize: 24 }}>🎁</Text>
        <View style={{ flex: 1 }}>
          <Text style={s.rt}>Refer & Earn</Text>
          <Text style={s.rs}>Invite friends — you both earn wallet credit</Text>
        </View>
        <TouchableOpacity style={s.rb} onPress={() => Alert.alert('Refer & Earn', 'Invite link coming soon.')}>
          <Text style={s.rbTxt}>Invite</Text>
        </TouchableOpacity>
      </View>

      {/* menu */}
      <View style={s.menu}>
        {menu.map((m, i) => (
          <TouchableOpacity key={i} style={[s.mrow, i === menu.length - 1 && { borderBottomWidth: 0 }]} onPress={m.onPress}>
            <View style={s.mic}><Icon name={m.icon} size={18} color={C.brown} /></View>
            <View style={{ flex: 1 }}>
              <Text style={s.mlbl}>{m.label}</Text>
              <Text style={s.msub}>{m.sub}</Text>
            </View>
            <Icon name="chevron-right" size={18} color={C.muted} />
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity style={s.logout} onPress={handleLogout}>
        <Text style={s.logoutTxt}>LOG OUT</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

export default function MeScreen(props) {
  return <ErrorBoundary screen="Profile"><MeInner {...props} /></ErrorBoundary>;
}

function getInitials(name) {
  if (!name) return '?';
  return name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.screenBg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.screenBg },
  title: { fontSize: 23, fontWeight: '600', color: C.ink, paddingHorizontal: 18, paddingTop: 50, paddingBottom: 4, fontFamily: fonts.serifDisplay },
  pcard: { flexDirection: 'row', alignItems: 'center', gap: 14, marginHorizontal: 16, marginTop: 8, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 18, padding: 16 },
  pav: { width: 58, height: 58, borderRadius: 29, backgroundColor: '#e6cfa6', alignItems: 'center', justifyContent: 'center' },
  pavTxt: { fontSize: 22, fontWeight: '800', color: C.brown, fontFamily: fonts.displayBold },
  pn: { fontSize: 17, fontWeight: '800', color: C.ink, fontFamily: fonts.displayBold },
  pp: { fontSize: 11, color: C.muted, fontWeight: '600', marginTop: 1, fontFamily: fonts.monoMedium },
  pcity: { fontSize: 9.5, fontWeight: '800', color: C.brown, backgroundColor: C.soft, borderWidth: 1, borderColor: C.line, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20, marginTop: 5, alignSelf: 'flex-start', overflow: 'hidden' },
  stats: { flexDirection: 'row', marginHorizontal: 16, marginTop: 12, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 16, overflow: 'hidden' },
  stat: { flex: 1, alignItems: 'center', paddingVertical: 13 },
  statBorder: { borderRightWidth: 1, borderRightColor: C.line },
  statN: { fontSize: 17, fontWeight: '800', color: C.ink, fontFamily: fonts.displayBold },
  statL: { fontSize: 9.5, color: C.muted, fontWeight: '700', marginTop: 1, fontFamily: fonts.sansBold },
  wallet: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginTop: 12, backgroundColor: C.brown, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14 },
  wl: { fontSize: 10, color: 'rgba(26,26,26,0.65)', fontWeight: '600', fontFamily: fonts.sansMedium },
  wb: { fontSize: 22, fontWeight: '600', color: C.onGold, fontFamily: fonts.serifDisplay, marginTop: 2 },
  wa: { fontSize: 20, color: 'rgba(26,26,26,0.85)' },
  refer: { flexDirection: 'row', alignItems: 'center', gap: 11, marginHorizontal: 16, marginTop: 12, backgroundColor: C.soft, borderWidth: 1, borderColor: C.brown, borderStyle: 'dashed', borderRadius: 14, padding: 13 },
  rt: { fontSize: 12.5, fontWeight: '800', color: C.ink, fontFamily: fonts.displayBold },
  rs: { fontSize: 10, color: C.muted, fontWeight: '600', marginTop: 1, fontFamily: fonts.sansMedium },
  rb: { backgroundColor: C.brown, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 30 },
  rbTxt: { fontSize: 11, fontWeight: '800', color: C.onGold, fontFamily: fonts.sansBold },
  menu: { marginHorizontal: 16, marginTop: 14, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 16, overflow: 'hidden' },
  mrow: { flexDirection: 'row', alignItems: 'center', gap: 13, padding: 13, borderBottomWidth: 1, borderBottomColor: C.soft },
  mic: { width: 34, height: 34, borderRadius: 11, backgroundColor: C.soft, alignItems: 'center', justifyContent: 'center' },
  mlbl: { fontSize: 13.5, fontWeight: '700', color: C.ink, fontFamily: fonts.displayBold },
  msub: { fontSize: 9.5, color: C.muted, fontWeight: '600', fontFamily: fonts.sansMedium },
  logout: { marginHorizontal: 16, marginTop: 14, borderWidth: 1.5, borderColor: C.offer, borderRadius: 14, paddingVertical: 13, alignItems: 'center', backgroundColor: C.card },
  logoutTxt: { fontSize: 13, fontWeight: '800', color: C.offer, letterSpacing: 0.3, fontFamily: fonts.displayBold },
});
