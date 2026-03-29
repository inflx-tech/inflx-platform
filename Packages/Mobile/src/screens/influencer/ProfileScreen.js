import React, { useEffect, useState, useContext } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, ActivityIndicator, Alert, Switch,
} from 'react-native';
import { colors } from '../../theme/tokens';
import { influencerApi, clearSession } from '../../services/api';
import { AuthContext } from '../../../App';

const LANGUAGE_OPTIONS = ['Hindi', 'English', 'Tamil', 'Telugu', 'Kannada', 'Malayalam', 'Marathi', 'Bengali', 'Gujarati', 'Punjabi'];
const NICHE_OPTIONS = ['food', 'fashion', 'beauty', 'travel', 'fitness', 'tech', 'home_decor', 'parenting', 'finance', 'education'];

export default function ProfileScreen({ navigation }) {
  const { setRole: setAppRole } = useContext(AuthContext);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editMode, setEditMode] = useState(false);

  // Form fields
  const [name, setName] = useState('');
  const [upiId, setUpiId] = useState('');
  const [bankAccount, setBankAccount] = useState('');
  const [bankIfsc, setBankIfsc] = useState('');
  const [panNumber, setPanNumber] = useState('');
  const [languages, setLanguages] = useState([]);
  const [niches, setNiches] = useState([]);
  const [youtubeHandle, setYoutubeHandle] = useState('');
  const [contentStyle, setContentStyle] = useState('');

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const res = await influencerApi.getMe();
    setLoading(false);
    if (res.success) {
      const inf = res.data?.influencer || res.data;
      setProfile(inf);
      setLanguages(inf.language || []);
      setNiches(inf.niche || []);
      setYoutubeHandle(inf.youtube_handle || '');
      setContentStyle(inf.content_style || '');
    }
  }

  async function save() {
    if (upiId && bankAccount) {
      Alert.alert('Choose one', 'Please provide either UPI ID or Bank Account, not both.');
      return;
    }
    const payload = { language: languages, niche: niches };
    if (youtubeHandle.trim()) payload.youtube_handle = youtubeHandle.trim();
    if (contentStyle.trim()) payload.content_style = contentStyle.trim();
    if (upiId.trim()) payload.upi_id = upiId.trim();
    if (bankAccount.trim()) {
      if (!bankIfsc.trim()) { Alert.alert('IFSC required', 'Please enter your bank IFSC code.'); return; }
      payload.bank_account_no = bankAccount.trim();
      payload.bank_ifsc = bankIfsc.trim();
    }
    if (panNumber.trim()) payload.pan_number = panNumber.trim();

    setSaving(true);
    const res = await influencerApi.updateMe(payload);
    setSaving(false);
    if (res.success) {
      setProfile(res.data?.influencer || res.data);
      setEditMode(false);
      setUpiId('');
      setBankAccount('');
      setBankIfsc('');
      setPanNumber('');
      Alert.alert('Saved!', 'Your profile has been updated.');
    } else {
      Alert.alert('Failed', res.error?.message || 'Update failed');
    }
  }

  function toggleLanguage(lang) {
    setLanguages(prev => prev.includes(lang) ? prev.filter(l => l !== lang) : [...prev, lang]);
  }

  function toggleNiche(n) {
    setNiches(prev => prev.includes(n) ? prev.filter(x => x !== n) : [...prev, n]);
  }

  async function logout() {
    Alert.alert('Logout', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
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
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>My Profile</Text>
          <TouchableOpacity onPress={() => setEditMode(!editMode)} style={styles.editBtn}>
            <Text style={styles.editBtnText}>{editMode ? 'Cancel' : 'Edit'}</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.avatarRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {(profile?.instagram_handle || '??').slice(0, 2).toUpperCase()}
            </Text>
          </View>
          <View>
            <Text style={styles.handle}>@{profile?.instagram_handle}</Text>
            <Text style={styles.followers}>{(profile?.followers_count || 0).toLocaleString('en-IN')} followers</Text>
          </View>
        </View>
      </View>

      {/* Stats row */}
      <View style={styles.statsRow}>
        {[
          { label: 'ER', value: `${profile?.engagement_rate || 0}%` },
          { label: 'Tier', value: profile?.tier || 'Nano' },
          { label: 'City', value: profile?.city || '—' },
          { label: 'Platform', value: profile?.platform || 'Instagram' },
        ].map(s => (
          <View key={s.label} style={styles.statItem}>
            <Text style={styles.statValue}>{s.value}</Text>
            <Text style={styles.statLabel}>{s.label}</Text>
          </View>
        ))}
      </View>

      {/* Languages */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Languages</Text>
        {editMode ? (
          <View style={styles.chipWrap}>
            {LANGUAGE_OPTIONS.map(lang => (
              <TouchableOpacity
                key={lang}
                style={[styles.chip, languages.includes(lang) && styles.chipActive]}
                onPress={() => toggleLanguage(lang)}
              >
                <Text style={[styles.chipText, languages.includes(lang) && styles.chipTextActive]}>{lang}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <Text style={styles.value}>
            {languages.length > 0 ? languages.join(', ') : 'Not set'}
          </Text>
        )}
      </View>

      {/* Niches */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Content Niches</Text>
        {editMode ? (
          <View style={styles.chipWrap}>
            {NICHE_OPTIONS.map(n => (
              <TouchableOpacity
                key={n}
                style={[styles.chip, niches.includes(n) && styles.chipActive]}
                onPress={() => toggleNiche(n)}
              >
                <Text style={[styles.chipText, niches.includes(n) && styles.chipTextActive]}>
                  {n.replace(/_/g, ' ')}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <Text style={styles.value}>
            {(profile?.niche || []).length > 0 ? profile.niche.join(', ') : 'Not set'}
          </Text>
        )}
      </View>

      {/* YouTube handle */}
      {editMode && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>YouTube Handle</Text>
          <TextInput
            style={styles.input}
            value={youtubeHandle}
            onChangeText={setYoutubeHandle}
            placeholder="@yourhandle"
            placeholderTextColor={colors.t3}
            autoCapitalize="none"
          />
        </View>
      )}

      {/* Payout settings */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Payout Settings</Text>
        {editMode ? (
          <>
            <Text style={styles.fieldLabel}>UPI ID (preferred)</Text>
            <TextInput
              style={styles.input}
              value={upiId}
              onChangeText={setUpiId}
              placeholder="yourname@upi"
              placeholderTextColor={colors.t3}
              autoCapitalize="none"
              keyboardType="email-address"
            />
            <Text style={styles.orDivider}>— or bank account —</Text>
            <Text style={styles.fieldLabel}>Account Number</Text>
            <TextInput
              style={styles.input}
              value={bankAccount}
              onChangeText={setBankAccount}
              placeholder="Bank account number"
              placeholderTextColor={colors.t3}
              keyboardType="number-pad"
              secureTextEntry
            />
            <Text style={styles.fieldLabel}>IFSC Code</Text>
            <TextInput
              style={styles.input}
              value={bankIfsc}
              onChangeText={setBankIfsc}
              placeholder="SBIN0001234"
              placeholderTextColor={colors.t3}
              autoCapitalize="characters"
            />
            <Text style={styles.orDivider}>— tax info —</Text>
            <Text style={styles.fieldLabel}>PAN Number</Text>
            <TextInput
              style={styles.input}
              value={panNumber}
              onChangeText={setPanNumber}
              placeholder="ABCDE1234F"
              placeholderTextColor={colors.t3}
              autoCapitalize="characters"
            />
            <Text style={styles.sensitiveNote}>
              🔒 Bank details are encrypted and used only for withdrawals. We never store your details in plain text.
            </Text>
          </>
        ) : (
          <Text style={styles.value}>
            {profile?.has_payout_method ? '✓ Payout method on file' : 'Not configured — add to enable withdrawals'}
          </Text>
        )}
      </View>

      {/* Save button */}
      {editMode && (
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.saveBtn, saving && { opacity: 0.6 }]}
            onPress={save}
            disabled={saving}
          >
            {saving
              ? <ActivityIndicator color={colors.white} />
              : <Text style={styles.saveBtnText}>Save Changes</Text>
            }
          </TouchableOpacity>
        </View>
      )}

      {/* Logout */}
      {!editMode && (
        <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { backgroundColor: colors.navyDeep, padding: 20, paddingTop: 52 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  headerTitle: { fontSize: 20, fontWeight: '800', color: colors.white },
  editBtn: { backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20 },
  editBtnText: { fontSize: 12, fontWeight: '700', color: colors.white },
  avatarRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.orange, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 22, fontWeight: '800', color: colors.white },
  handle: { fontSize: 16, fontWeight: '700', color: colors.white },
  followers: { fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  statsRow: { flexDirection: 'row', backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.border },
  statItem: { flex: 1, alignItems: 'center', paddingVertical: 12 },
  statValue: { fontSize: 16, fontWeight: '800', color: colors.t1 },
  statLabel: { fontSize: 10, color: colors.t3, fontWeight: '600', marginTop: 2 },
  card: { margin: 16, marginBottom: 0, backgroundColor: colors.white, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.border },
  cardTitle: { fontSize: 14, fontWeight: '700', color: colors.t1, marginBottom: 10 },
  value: { fontSize: 13, color: colors.t2 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border },
  chipActive: { backgroundColor: colors.navy, borderColor: colors.navy },
  chipText: { fontSize: 12, color: colors.t2, fontWeight: '600' },
  chipTextActive: { color: colors.white },
  fieldLabel: { fontSize: 11, fontWeight: '700', color: colors.t3, marginBottom: 6, textTransform: 'uppercase' },
  input: { borderWidth: 2, borderColor: colors.border2, borderRadius: 12, padding: 12, fontSize: 14, color: colors.t1, marginBottom: 12 },
  orDivider: { fontSize: 11, color: colors.t3, textAlign: 'center', marginVertical: 8 },
  sensitiveNote: { fontSize: 11, color: colors.t3, lineHeight: 16, marginTop: 4 },
  footer: { padding: 16 },
  saveBtn: { backgroundColor: colors.navy, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  saveBtnText: { fontSize: 15, fontWeight: '800', color: colors.white },
  logoutBtn: { margin: 16, borderWidth: 1, borderColor: colors.red, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  logoutText: { fontSize: 14, fontWeight: '700', color: colors.red },
});
