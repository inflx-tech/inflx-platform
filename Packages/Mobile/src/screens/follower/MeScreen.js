/**
 * MeScreen (Profile) — white sweep (features/follower-white-sweep, board
 * white-sweep.html frames 2+3).
 *
 * White law: identity card (initial avatar · name · masked phone · Edit) →
 * grouped rows — Shopping (Orders / Wishlist / Addresses / Returns) and
 * Following (creators / saved posts) → red Log out. Wallet row is
 * DATA-GATED (renders only when a balance exists — never a dead row).
 *
 * Guest-first law: guests get an honest card + black sign-in CTA + only the
 * rows that work logged-out (Wishlist + Addresses live on-device and follow
 * them into the account at first login). No dead rows, no "session expired".
 */
import React, { useState, useCallback, useContext } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { fmtRupees } from '../../theme/tokens';
import { followerApi } from '../../services/api';
import { AuthContext } from '../../../App';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ErrorBoundary from '../../components/ErrorBoundary';

function maskPhone(p) {
  const s = String(p || '');
  if (s.length < 6) return s;
  return `${s.slice(0, 6)}••• ••${s.slice(-3)}`;
}

function Row({ icon, label, sub, onPress }) {
  return (
    <TouchableOpacity style={st.row} activeOpacity={0.7} onPress={onPress}>
      <Icon name={icon} size={20} color="#111" />
      <View style={{ flex: 1 }}>
        <Text style={st.rowLbl}>{label}</Text>
        {sub ? <Text style={st.rowSub}>{sub}</Text> : null}
      </View>
      <Icon name="chevron-right" size={18} color="#BBB" />
    </TouchableOpacity>
  );
}

function MeInner({ navigation }) {
  const { setRole } = useContext(AuthContext);
  const [authed, setAuthed] = useState(null);   // null = checking
  const [profile, setProfile] = useState(null);
  const [wallet, setWallet] = useState(null);

  useFocusEffect(useCallback(() => {
    let alive = true;
    (async () => {
      const token = await AsyncStorage.getItem('inflx_token');
      if (!alive) return;
      if (!token) { setAuthed(false); setProfile(null); setWallet(null); return; }
      setAuthed(true);
      followerApi.getMe()
        .then((res) => { if (alive) { const d = res.data || res; setProfile(d.follower || d); } })
        .catch(() => {});
      // Wallet row is data-gated: only a real positive balance earns the row.
      followerApi.getWallet()
        .then((r) => {
          if (!alive) return;
          const d = r.data || r;
          const bal = Number(d.balance ?? d.wallet_balance ?? d.wallet?.balance);
          setWallet(Number.isFinite(bal) && bal > 0 ? bal : null);
        })
        .catch(() => {});
    })();
    return () => { alive = false; };
  }, []));

  const handleLogout = () => {
    Alert.alert('Log out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log out', style: 'destructive',
        onPress: async () => {
          await AsyncStorage.multiRemove(['inflx_token', 'inflx_refresh_token', 'inflx_user']);
          setRole('');
          setAuthed(false); setProfile(null); setWallet(null);
        },
      },
    ]);
  };

  if (authed == null) {
    return <View style={st.center}><ActivityIndicator color="#111" /></View>;
  }

  // ── guest profile (frame 3) ────────────────────────────────────────────────
  if (!authed) {
    return (
      <SafeAreaView style={st.safe} edges={['top']}>
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
          <Text style={st.title}>Profile</Text>
          <View style={[st.pcard, { borderStyle: 'dashed' }]}>
            <View style={[st.pav, { backgroundColor: '#F5F2EC' }]}><Text style={[st.pavTxt, { color: '#111' }]}>?</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={st.pname}>Browsing as guest</Text>
              <Text style={st.psub}>Your bag, wishlist & addresses are saved on this phone</Text>
            </View>
          </View>
          <TouchableOpacity style={st.signin} activeOpacity={0.85} onPress={() => navigation.navigate('FollowerLogin')}>
            <Text style={st.signinTxt}>Sign in with phone number</Text>
          </TouchableOpacity>
          <Text style={st.guestNote}>Everything you've saved as a guest follows you into your account — nothing is lost.</Text>
          <View style={st.grp}>
            <Text style={st.grpT}>Works without signing in</Text>
            <Row icon="heart-outline" label="Wishlist" sub="saved products & collections" onPress={() => navigation.navigate('Wishlist')} />
            <Row icon="map-marker-outline" label="Addresses" sub="delivery addresses" onPress={() => navigation.navigate('Address')} />
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── logged-in profile (frame 2) ────────────────────────────────────────────
  const initial = (profile?.name || 'F').trim().charAt(0).toUpperCase();
  return (
    <SafeAreaView style={st.safe} edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <Text style={st.title}>Profile</Text>

        <View style={st.pcard}>
          <View style={st.pav}><Text style={st.pavTxt}>{initial}</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={st.pname}>{profile?.name || 'Follower'}</Text>
            {profile?.phone ? <Text style={st.psub}>{maskPhone(profile.phone)}</Text> : null}
          </View>
          <TouchableOpacity hitSlop={8} onPress={() => Alert.alert('Edit profile', 'Coming with the account settings slice.')}>
            <Text style={st.edit}>Edit</Text>
          </TouchableOpacity>
        </View>

        <View style={st.grp}>
          <Text style={st.grpT}>Shopping</Text>
          <Row icon="package-variant-closed" label="My Orders" sub="track · cancel · return" onPress={() => navigation.navigate('OrderHistory')} />
          <Row icon="heart-outline" label="Wishlist" sub="saved products & collections" onPress={() => navigation.navigate('Wishlist')} />
          <Row icon="map-marker-outline" label="Addresses" sub="delivery addresses" onPress={() => navigation.navigate('Address')} />
          <Row icon="keyboard-return" label="My Returns" onPress={() => navigation.navigate('MyReturns')} />
          {wallet != null && (
            <Row icon="wallet-outline" label="Wallet" sub={`${fmtRupees(wallet)} balance`} onPress={() => navigation.navigate('FollowerWallet')} />
          )}
        </View>

        <View style={st.grp}>
          <Text style={st.grpT}>Following</Text>
          <Row icon="account-group-outline" label="Creators I follow" onPress={() => navigation.navigate('FollowedInfluencers')} />
          <Row icon="bookmark-outline" label="Saved posts" onPress={() => navigation.navigate('SavedList')} />
        </View>

        <TouchableOpacity style={st.logout} onPress={handleLogout} hitSlop={8}>
          <Text style={st.logoutTxt}>Log out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

export default function MeScreen(props) {
  return <ErrorBoundary><MeInner {...props} /></ErrorBoundary>;
}

const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFF' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF' },
  title: { fontSize: 17, fontWeight: '800', color: '#111', paddingHorizontal: 16, paddingTop: 10, paddingBottom: 8 },
  pcard: { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 16, borderWidth: 1, borderColor: '#EEE', borderRadius: 16, padding: 14 },
  pav: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#111', alignItems: 'center', justifyContent: 'center' },
  pavTxt: { color: '#FFF', fontSize: 20, fontWeight: '800' },
  pname: { fontSize: 15.5, fontWeight: '800', color: '#111' },
  psub: { fontSize: 11.5, color: '#8A8A8A', marginTop: 2, lineHeight: 16 },
  edit: { fontSize: 12.5, fontWeight: '800', color: '#111' },
  grp: { marginTop: 16, marginHorizontal: 16 },
  grpT: { fontSize: 11, fontWeight: '800', color: '#8A8A8A', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: '#F6F6F6' },
  rowLbl: { fontSize: 13.5, fontWeight: '700', color: '#111' },
  rowSub: { fontSize: 10.5, color: '#8A8A8A', marginTop: 1 },
  logout: { marginTop: 22, alignItems: 'center' },
  logoutTxt: { fontSize: 13, fontWeight: '800', color: '#D64545' },
  signin: { marginHorizontal: 16, marginTop: 12, backgroundColor: '#111', borderRadius: 999, alignItems: 'center', paddingVertical: 13 },
  signinTxt: { color: '#FFF', fontSize: 13, fontWeight: '800' },
  guestNote: { marginHorizontal: 30, marginTop: 10, textAlign: 'center', fontSize: 11, color: '#9A9A9A', lineHeight: 17 },
});
