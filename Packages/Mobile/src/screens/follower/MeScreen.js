import React, { useState, useCallback, useContext } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { darkColors, spacing, radius } from '../../theme/tokens';
import { followerApi } from '../../services/api';
import { AuthContext } from '../../../App';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
    return <View style={s.center}><ActivityIndicator size="large" color={darkColors.amber} /></View>;
  }

  const menuItems = [
    { icon: '📦', label: 'My Orders', sub: 'View order history & tracking', onPress: () => navigation.navigate('OrderHistory') },
    { icon: '📍', label: 'My Addresses', sub: 'Manage delivery addresses', onPress: () => navigation.navigate('Address') },
    { icon: '👥', label: 'Following', sub: 'Influencers you follow', onPress: () => navigation.navigate('FollowedInfluencers') },
    { icon: '🔖', label: 'Saved Offers', sub: 'Bookmarked deals', onPress: () => navigation.navigate('SavedList') },
  ];

  return (
    <ScrollView style={s.container}>
      {/* Profile card */}
      <View style={s.profileCard}>
        <View style={s.avatar}>
          <Text style={s.avatarText}>{getInitials(profile?.name)}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.name}>{profile?.name || 'Follower'}</Text>
          <Text style={s.phone}>{profile?.phone || ''}</Text>
          {profile?.user_city && <Text style={s.city}>📍 {profile.user_city}</Text>}
        </View>
      </View>

      {/* Menu items */}
      <View style={s.menuSection}>
        {menuItems.map((item, i) => (
          <TouchableOpacity key={i} style={[s.menuItem, i === menuItems.length - 1 && { borderBottomWidth: 0 }]} onPress={item.onPress}>
            <Text style={{ fontSize: 22 }}>{item.icon}</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.menuLabel}>{item.label}</Text>
              <Text style={s.menuSub}>{item.sub}</Text>
            </View>
            <Text style={{ color: darkColors.textMuted, fontSize: 16 }}>›</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Logout */}
      <TouchableOpacity style={s.logoutBtn} onPress={handleLogout}>
        <Text style={s.logoutText}>Logout</Text>
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
  container: { flex: 1, backgroundColor: darkColors.bg2, paddingTop: 50 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: darkColors.bg2 },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: darkColors.card,
    margin: spacing.lg,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: darkColors.border,
  },
  avatar: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: darkColors.amber, alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 18, fontWeight: '800', color: '#000' },
  name: { fontSize: 18, fontWeight: '700', color: darkColors.text },
  phone: { fontSize: 13, color: darkColors.textSecondary, marginTop: 2 },
  city: { fontSize: 11, color: darkColors.textMuted, marginTop: 2 },
  menuSection: {
    backgroundColor: darkColors.card,
    marginHorizontal: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: darkColors.border,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: darkColors.border,
  },
  menuLabel: { fontSize: 15, fontWeight: '600', color: darkColors.text },
  menuSub: { fontSize: 11, color: darkColors.textMuted, marginTop: 2 },
  logoutBtn: {
    margin: spacing.lg,
    marginTop: spacing.xl,
    height: 48,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: darkColors.red,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutText: { fontSize: 14, fontWeight: '700', color: darkColors.red },
});
