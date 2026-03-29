import React, { useEffect, useState, useContext } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, ActivityIndicator, Alert,
} from 'react-native';
import { colors } from '../../theme/tokens';
import { followerApi, clearSession } from '../../services/api';
import { AuthContext } from '../../../App';

export default function FollowerProfileScreen({ navigation }) {
  const { setRole: setAppRole } = useContext(AuthContext);
  const [profile, setProfile]   = useState(null);
  const [loading, setLoading]   = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving]     = useState(false);
  const [name, setName]         = useState('');
  const [email, setEmail]       = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    const res = await followerApi.getMe();
    setLoading(false);
    if (res.success) {
      const f = res.data?.follower || res.data;
      setProfile(f);
      setName(f?.name || '');
      setEmail(f?.email || '');
    }
  }

  async function save() {
    if (!name.trim()) { Alert.alert('Name required'); return; }
    setSaving(true);
    const res = await followerApi.updateMe?.({ name: name.trim(), email: email.trim() });
    setSaving(false);
    if (res?.success) {
      setProfile(res.data?.follower || res.data);
      setEditMode(false);
      Alert.alert('Saved!');
    } else {
      Alert.alert('Failed', res?.error?.message || 'Update failed');
    }
  }

  async function logout() {
    Alert.alert('Logout', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout', style: 'destructive',
        onPress: async () => {
          await clearSession();
          setAppRole('');
        },
      },
    ]);
  }

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={colors.navy} /></View>;
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>My Profile</Text>
          <TouchableOpacity onPress={() => setEditMode(!editMode)} style={styles.editBtn}>
            <Text style={styles.editBtnText}>{editMode ? 'Cancel' : 'Edit'}</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.avatarRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {(profile?.name || profile?.phone || '??').slice(0, 2).toUpperCase()}
            </Text>
          </View>
          <View>
            <Text style={styles.nameText}>{profile?.name || 'Follower'}</Text>
            <Text style={styles.phoneText}>{profile?.phone}</Text>
          </View>
        </View>
      </View>

      {editMode ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Edit Details</Text>
          <Text style={styles.fieldLabel}>Name</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Your name" placeholderTextColor={colors.t3} />
          <Text style={styles.fieldLabel}>Email (optional)</Text>
          <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder="email@example.com" placeholderTextColor={colors.t3} keyboardType="email-address" autoCapitalize="none" />
          <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={save} disabled={saving}>
            {saving ? <ActivityIndicator color={colors.white} /> : <Text style={styles.saveBtnText}>Save Changes</Text>}
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Profile Info</Text>
          <ProfileRow label="Name" value={profile?.name || '—'} />
          <ProfileRow label="Phone" value={profile?.phone || '—'} />
          <ProfileRow label="Email" value={profile?.email || 'Not set'} />
          <ProfileRow label="Member Since" value={profile?.created_at ? new Date(profile.created_at).toLocaleDateString('en-IN') : '—'} />
        </View>
      )}

      {/* Quick actions */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Quick Actions</Text>
        <TouchableOpacity style={styles.actionItem} onPress={() => navigation.navigate('Address', {})}>
          <Text style={styles.actionIcon}>📍</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.actionLabel}>Manage Addresses</Text>
            <Text style={styles.actionSub}>Add or edit delivery addresses</Text>
          </View>
          <Text style={styles.actionArrow}>›</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionItem} onPress={() => navigation.navigate('OrderHistory', {})}>
          <Text style={styles.actionIcon}>📦</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.actionLabel}>Order History</Text>
            <Text style={styles.actionSub}>View your past orders</Text>
          </View>
          <Text style={styles.actionArrow}>›</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

function ProfileRow({ label, value }) {
  return (
    <View style={styles.profileRow}>
      <Text style={styles.profileLabel}>{label}</Text>
      <Text style={styles.profileValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { backgroundColor: colors.navyDeep, padding: 20, paddingTop: 52 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title: { fontSize: 20, fontWeight: '800', color: colors.white },
  editBtn: { backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20 },
  editBtnText: { fontSize: 12, fontWeight: '700', color: colors.white },
  avatarRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.orange, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 20, fontWeight: '800', color: colors.white },
  nameText: { fontSize: 16, fontWeight: '700', color: colors.white },
  phoneText: { fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  card: { margin: 16, marginBottom: 0, backgroundColor: colors.white, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.border },
  cardTitle: { fontSize: 14, fontWeight: '700', color: colors.t1, marginBottom: 12 },
  fieldLabel: { fontSize: 11, fontWeight: '700', color: colors.t3, textTransform: 'uppercase', marginBottom: 6, marginTop: 10 },
  input: { borderWidth: 2, borderColor: colors.border2, borderRadius: 12, padding: 12, fontSize: 14, color: colors.t1, marginBottom: 4 },
  saveBtn: { backgroundColor: colors.navy, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 16 },
  saveBtnText: { fontSize: 15, fontWeight: '800', color: colors.white },
  profileRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
  profileLabel: { fontSize: 12, color: colors.t3, fontWeight: '600' },
  profileValue: { fontSize: 12, color: colors.t1, fontWeight: '500' },
  actionItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border, gap: 12 },
  actionIcon: { fontSize: 20 },
  actionLabel: { fontSize: 13, fontWeight: '600', color: colors.t1 },
  actionSub: { fontSize: 11, color: colors.t3, marginTop: 1 },
  actionArrow: { fontSize: 18, color: colors.t3 },
  logoutBtn: { margin: 16, borderWidth: 1, borderColor: colors.red, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  logoutText: { fontSize: 14, fontWeight: '700', color: colors.red },
});
