import React, { useState, useCallback, useContext } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { creatorVibe as C, fonts, spacing, radius } from '../../theme/tokens';

// Flow 52.G — Creator Vibe recolor shim. Avatar → warm amber (ink initials stay
// readable); menu tiles → soft + brown icons; logout → offer red. Visual only;
// getMe / useFocusEffect / logout flow unchanged.
const P = {
  white: C.card, bg: C.screenBg,
  border: C.line, borderSoft: C.line,
  ink: C.ink, muted: C.muted, muted2: C.muted, muted3: C.muted,
  yellow: C.star, yellowText: C.brown, yellowPale: C.soft,
  danger: C.offer, dangerText: C.offer,
};
import { followerApi } from '../../services/api';
import { AuthContext } from '../../../App';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * MeScreen — follower account hub.
 *
 * Flow 41 (F2) restyle (2026-05-28): dark → light brandPalette. Yellow avatar
 * tile + ink initials (matches F0 MyStore/profile avatar). Menu emoji
 * (💰📦📍👥🔖) → MCI vector icons in yellowPale tiles (founder design call).
 * Danger-border logout. getMe + useFocusEffect reload + logout flow preserved.
 */

export default function MeScreen({ navigation }) {
  const { setRole } = useContext(AuthContext);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      followerApi.getMe()
        .then(res => {
          const data = res.data || res;
          setProfile(data.follower || data);
        })
        .catch(e => console.error('[MeScreen] Error:', e.message))
        .finally(() => setLoading(false));
    }, [])
  );

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          await AsyncStorage.multiRemove(['inflx_token', 'inflx_refresh_token', 'inflx_user']);
          setRole('');
        },
      },
    ]);
  };

  if (loading) {
    return <View style={s.center}><ActivityIndicator size="large" color={P.yellow} /></View>;
  }

  const menuItems = [
    { icon: 'wallet', label: 'Wallet & Rewards', sub: 'CASHBACK FROM CREATOR VISITS', onPress: () => navigation.navigate('FollowerWallet') },
    { icon: 'package-variant', label: 'My Orders', sub: 'HISTORY & TRACKING', onPress: () => navigation.navigate('OrderHistory') },
    { icon: 'map-marker-outline', label: 'My Addresses', sub: 'DELIVERY ADDRESSES', onPress: () => navigation.navigate('Address') },
    { icon: 'account-group-outline', label: 'Following', sub: 'INFLUENCERS YOU FOLLOW', onPress: () => navigation.navigate('FollowedInfluencers') },
    { icon: 'bookmark-outline', label: 'Saved Offers', sub: 'BOOKMARKED DEALS', onPress: () => navigation.navigate('SavedList') },
  ];

  return (
    <ScrollView style={s.container}>
      {/* Title */}
      <View style={s.topBar}>
        <Text style={s.topTitle}>Profile</Text>
      </View>

      {/* Profile card */}
      <View style={s.profileCard}>
        <View style={s.avatar}>
          <Text style={s.avatarText}>{getInitials(profile?.name)}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.name}>{profile?.name || 'Follower'}</Text>
          <Text style={s.phone}>{profile?.phone || ''}</Text>
          {profile?.user_city && <Text style={s.city}>📍 {String(profile.user_city).toUpperCase()}</Text>}
        </View>
      </View>

      {/* Menu items */}
      <View style={s.menuSection}>
        {menuItems.map((item, i) => (
          <TouchableOpacity key={i} style={[s.menuItem, i === menuItems.length - 1 && { borderBottomWidth: 0 }]} onPress={item.onPress}>
            <View style={s.menuIco}>
              <Icon name={item.icon} size={20} color={P.yellowText} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.menuLabel}>{item.label}</Text>
              <Text style={s.menuSub}>{item.sub}</Text>
            </View>
            <Icon name="chevron-right" size={18} color={P.muted3} />
          </TouchableOpacity>
        ))}
      </View>

      {/* Logout */}
      <TouchableOpacity style={s.logoutBtn} onPress={handleLogout}>
        <Text style={s.logoutText}>LOG OUT</Text>
      </TouchableOpacity>

      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

function getInitials(name) {
  if (!name) return '?';
  return name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: P.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: P.bg },

  topBar: {
    paddingTop: 50, paddingHorizontal: 16, paddingBottom: 8,
    backgroundColor: P.white, borderBottomWidth: 1, borderBottomColor: P.border,
  },
  topTitle: { fontSize: 22, fontWeight: '600', color: P.ink, fontFamily: fonts.serifDisplay },

  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: P.white,
    margin: spacing.lg,
    padding: spacing.lg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: P.border,
  },
  avatar: {
    width: 58, height: 58, borderRadius: 29,
    backgroundColor: P.yellow, alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 20, fontWeight: '900', color: P.ink, fontFamily: fonts.displayBlack },
  name: { fontSize: 18, fontWeight: '900', color: P.ink, fontFamily: fonts.displayBlack },
  phone: { fontSize: 12, color: P.muted2, marginTop: 2, fontWeight: '700', fontFamily: fonts.monoMedium },
  city: { fontSize: 10, color: P.muted3, marginTop: 3, fontWeight: '700', letterSpacing: 0.2, fontFamily: fonts.monoMedium },

  menuSection: {
    backgroundColor: P.white,
    marginHorizontal: spacing.lg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: P.border,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: P.borderSoft,
  },
  menuIco: {
    width: 38, height: 38, borderRadius: 11,
    backgroundColor: P.yellowPale,
    alignItems: 'center', justifyContent: 'center',
  },
  menuLabel: { fontSize: 14.5, fontWeight: '800', color: P.ink, fontFamily: fonts.displayBold },
  menuSub: { fontSize: 10, color: P.muted2, marginTop: 2, fontWeight: '700', letterSpacing: 0.2, fontFamily: fonts.monoMedium },

  logoutBtn: {
    margin: spacing.lg,
    marginTop: spacing.xl,
    height: 50,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: P.danger,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: P.white,
  },
  logoutText: { fontSize: 14, fontWeight: '900', color: P.dangerText, textTransform: 'uppercase', letterSpacing: 0.3, fontFamily: fonts.displayBlack },
});
