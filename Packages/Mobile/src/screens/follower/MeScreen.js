/**
 * MeScreen (Profile) — white sweep (features/follower-white-sweep, board
 * white-sweep.html frames 2+3).
 *
 * White law: identity card (initial avatar · name · masked phone · Edit) →
 * Legal → red Log out.
 *
 * features/profile-only-apps (2026-09-10) — the Shopping and Following rows went
 * with their screens; this and Edit Profile are the whole shopper app now.
 *
 * Docs/THE_CUT.md pass 1 — the Wallet row is gone with the shopper reward
 * wallet. It was data-gated so it only appeared with a positive balance, and
 * nothing in the platform could ever produce one.
 *
 * Guest-first law: guests get an honest card + black sign-in CTA + Legal.
 * No dead rows, no "session expired".
 */
import React, { useState, useCallback, useContext } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
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

// Legal — shoppers see only the documents that apply to buying: the six everyone
// gets, plus refunds and how ranking works. Shown to guests too: the privacy policy
// must be reachable inside the app whether or not anyone has signed in.
function LegalGroup({ navigation }) {
  return (
    <View style={st.grp}>
      <Text style={st.grpT}>About</Text>
      <Row
        icon="shield-check-outline"
        label="Legal & policies"
        sub="terms · privacy · refunds · complaints"
        onPress={() => navigation.navigate('LegalList')}
      />
    </View>
  );
}

function MeInner({ navigation }) {
  const { setRole } = useContext(AuthContext);
  const [authed, setAuthed] = useState(null);   // null = checking
  const [profile, setProfile] = useState(null);

  useFocusEffect(useCallback(() => {
    let alive = true;
    (async () => {
      const token = await AsyncStorage.getItem('inflx_token');
      if (!alive) return;
      if (!token) { setAuthed(false); setProfile(null); return; }
      setAuthed(true);
      followerApi.getMe()
        .then((res) => { if (alive) { const d = res.data || res; setProfile(d.follower || d); } })
        .catch(() => {});
      // Docs/THE_CUT.md pass 1 — the shopper reward wallet is removed. It showed a
      // balance that nothing could fill, nothing could spend and nothing could pay
      // out: a promise on screen with no machinery behind it.
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
          setAuthed(false); setProfile(null); 
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
              <Text style={st.psub}>Sign in to see your profile</Text>
            </View>
          </View>
          <TouchableOpacity style={st.signin} activeOpacity={0.85} onPress={() => navigation.navigate('FollowerLogin')}>
            <Text style={st.signinTxt}>Sign in with phone number</Text>
          </TouchableOpacity>
          <LegalGroup navigation={navigation} />
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
          {/* Slice 1 — was an Alert stub; PATCH /followers/me did not exist
              server-side either. Both halves are real now. */}
          <TouchableOpacity hitSlop={8} onPress={() => navigation.navigate('EditProfile')}>
            <Text style={st.edit}>Edit</Text>
          </TouchableOpacity>
        </View>

        {/* Shopping (Orders / Wishlist / Addresses / Returns) and Following
            (Creators I follow / Saved posts) removed with their screens —
            features/profile-only-apps. */}
        <LegalGroup navigation={navigation} />

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
});
