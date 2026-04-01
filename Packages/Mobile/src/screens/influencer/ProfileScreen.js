import React, { useEffect, useState, useContext, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, ActivityIndicator, Alert, Switch, RefreshControl,
} from 'react-native';
import { colors, fmtNum } from '../../theme/tokens';
import { influencerApi, clearSession } from '../../services/api';
import { AuthContext } from '../../../App';

const LANGUAGE_OPTIONS = ['Hindi', 'English', 'Tamil', 'Telugu', 'Kannada', 'Malayalam', 'Marathi', 'Bengali', 'Gujarati', 'Punjabi'];
const NICHE_OPTIONS = ['food', 'fashion', 'beauty', 'travel', 'fitness', 'tech', 'home_decor', 'parenting', 'finance', 'education'];

function SectionHeader({ title }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionHeaderText}>{title}</Text>
    </View>
  );
}

function ReadOnlyRow({ label, value }) {
  return (
    <View style={styles.readOnlyRow}>
      <Text style={styles.readOnlyLabel}>{label}</Text>
      <Text style={styles.readOnlyValue}>{value || '--'}</Text>
    </View>
  );
}

export default function ProfileScreen({ navigation }) {
  const { setRole: setAppRole } = useContext(AuthContext);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [editSection, setEditSection] = useState(null); // 'profile' | 'bank' | 'content' | null
  const [pushEnabled, setPushEnabled] = useState(true);

  // Profile info fields
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [city, setCity] = useState('');

  // Content fields
  const [languages, setLanguages] = useState([]);
  const [niches, setNiches] = useState([]);
  const [youtubeHandle, setYoutubeHandle] = useState('');
  const [contentStyle, setContentStyle] = useState('');

  // Bank / payout fields
  const [upiId, setUpiId] = useState('');
  const [bankAccount, setBankAccount] = useState('');
  const [bankIfsc, setBankIfsc] = useState('');
  const [panNumber, setPanNumber] = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    const res = await influencerApi.getMe();
    setLoading(false);
    if (res.success) {
      const inf = res.data?.influencer || res.data;
      setProfile(inf);
      populateFields(inf);
    }
  }

  function populateFields(inf) {
    setName(inf.name || inf.full_name || '');
    setBio(inf.bio || '');
    setCity(inf.city || '');
    setLanguages(inf.language || []);
    setNiches(inf.niche || []);
    setYoutubeHandle(inf.youtube_handle || '');
    setContentStyle(inf.content_style || '');
  }

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, []);

  function startEdit(section) {
    if (editSection && editSection !== section) {
      Alert.alert('Unsaved changes', 'Please save or cancel the current section first.');
      return;
    }
    setEditSection(section);
  }

  function cancelEdit() {
    if (profile) populateFields(profile);
    setUpiId('');
    setBankAccount('');
    setBankIfsc('');
    setPanNumber('');
    setEditSection(null);
  }

  async function saveProfile() {
    const payload = {};
    if (name.trim() !== (profile?.name || '')) payload.name = name.trim();
    if (bio.trim() !== (profile?.bio || '')) payload.bio = bio.trim();
    if (city.trim() !== (profile?.city || '')) payload.city = city.trim();

    if (Object.keys(payload).length === 0) {
      setEditSection(null);
      return;
    }

    setSaving(true);
    const res = await influencerApi.updateMe(payload);
    setSaving(false);
    if (res.success) {
      const inf = res.data?.influencer || res.data;
      setProfile(p => ({ ...p, ...inf }));
      setEditSection(null);
      Alert.alert('Saved', 'Profile info updated.');
    } else {
      Alert.alert('Failed', res.error?.message || 'Update failed');
    }
  }

  async function saveContent() {
    const payload = { language: languages, niche: niches };
    if (youtubeHandle.trim()) payload.youtube_handle = youtubeHandle.trim();
    if (contentStyle.trim()) payload.content_style = contentStyle.trim();

    setSaving(true);
    const res = await influencerApi.updateMe(payload);
    setSaving(false);
    if (res.success) {
      const inf = res.data?.influencer || res.data;
      setProfile(p => ({ ...p, ...inf }));
      setEditSection(null);
      Alert.alert('Saved', 'Content preferences updated.');
    } else {
      Alert.alert('Failed', res.error?.message || 'Update failed');
    }
  }

  async function saveBank() {
    if (upiId && bankAccount) {
      Alert.alert('Choose one', 'Please provide either UPI ID or Bank Account, not both.');
      return;
    }
    if (!upiId.trim() && !bankAccount.trim() && !panNumber.trim()) {
      setEditSection(null);
      return;
    }

    const payload = {};
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
      const inf = res.data?.influencer || res.data;
      setProfile(p => ({ ...p, ...inf }));
      setEditSection(null);
      setUpiId('');
      setBankAccount('');
      setBankIfsc('');
      setPanNumber('');
      Alert.alert('Saved', 'Payment details updated.');
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
    Alert.alert('Logout', 'Are you sure you want to log out?', [
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
    return <View style={styles.center}><ActivityIndicator color={colors.navy} size="large" /></View>;
  }

  const statusColor = {
    approved: colors.teal,
    pending: colors.gold,
    rejected: colors.red,
    suspended: colors.red,
  }[profile?.user_status] || colors.t3;

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.navy} />}
    >
      {/* ── Header with avatar ── */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Profile</Text>
        <View style={styles.avatarRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {(profile?.instagram_handle || '??').slice(0, 2).toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.handle}>@{profile?.instagram_handle}</Text>
            <Text style={styles.nameText}>{profile?.name || profile?.full_name || 'No name set'}</Text>
            <View style={styles.statusRow}>
              <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
              <Text style={styles.statusText}>
                {(profile?.user_status || 'unknown').charAt(0).toUpperCase() + (profile?.user_status || 'unknown').slice(1)}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* ── Instagram Stats (read-only, from Apify) ── */}
      <View style={styles.statsRow}>
        {[
          { label: 'Followers', value: fmtNum(profile?.followers_count) },
          { label: 'Eng. Rate', value: `${profile?.engagement_rate || 0}%` },
          { label: 'Tier', value: profile?.tier || 'Nano' },
          { label: 'Platform', value: profile?.platform || 'Instagram' },
        ].map(s => (
          <View key={s.label} style={styles.statItem}>
            <Text style={styles.statValue}>{s.value}</Text>
            <Text style={styles.statLabel}>{s.label}</Text>
          </View>
        ))}
      </View>
      <Text style={styles.statsNote}>Stats refreshed automatically via Instagram</Text>

      {/* ── Profile Info Section ── */}
      <SectionHeader title="Profile Info" />
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Personal Details</Text>
          {editSection !== 'profile' ? (
            <TouchableOpacity onPress={() => startEdit('profile')} style={styles.editBtnSmall}>
              <Text style={styles.editBtnSmallText}>Edit</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={cancelEdit} style={styles.cancelBtnSmall}>
              <Text style={styles.cancelBtnSmallText}>Cancel</Text>
            </TouchableOpacity>
          )}
        </View>

        {editSection === 'profile' ? (
          <>
            <Text style={styles.fieldLabel}>Name</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Your name"
              placeholderTextColor={colors.t3}
            />
            <Text style={styles.fieldLabel}>Bio</Text>
            <TextInput
              style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
              value={bio}
              onChangeText={setBio}
              placeholder="Tell brands about yourself..."
              placeholderTextColor={colors.t3}
              multiline
              maxLength={300}
            />
            <Text style={styles.fieldLabel}>City</Text>
            <TextInput
              style={styles.input}
              value={city}
              onChangeText={setCity}
              placeholder="e.g. Mumbai, Bangalore"
              placeholderTextColor={colors.t3}
            />
            <TouchableOpacity
              style={[styles.saveBtn, saving && { opacity: 0.6 }]}
              onPress={saveProfile}
              disabled={saving}
            >
              {saving
                ? <ActivityIndicator color={colors.white} />
                : <Text style={styles.saveBtnText}>Save Profile Info</Text>
              }
            </TouchableOpacity>
          </>
        ) : (
          <>
            <ReadOnlyRow label="Name" value={profile?.name || profile?.full_name} />
            <ReadOnlyRow label="Phone" value={profile?.phone ? `+${profile.phone}` : null} />
            <ReadOnlyRow label="Instagram" value={profile?.instagram_handle ? `@${profile.instagram_handle}` : null} />
            <ReadOnlyRow label="Bio" value={profile?.bio} />
            <ReadOnlyRow label="City" value={profile?.city} />
            {profile?.youtube_handle && (
              <ReadOnlyRow label="YouTube" value={`@${profile.youtube_handle}`} />
            )}
          </>
        )}
      </View>

      {/* ── Content Preferences Section ── */}
      <SectionHeader title="Content Preferences" />
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Languages & Niches</Text>
          {editSection !== 'content' ? (
            <TouchableOpacity onPress={() => startEdit('content')} style={styles.editBtnSmall}>
              <Text style={styles.editBtnSmallText}>Edit</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={cancelEdit} style={styles.cancelBtnSmall}>
              <Text style={styles.cancelBtnSmallText}>Cancel</Text>
            </TouchableOpacity>
          )}
        </View>

        {editSection === 'content' ? (
          <>
            <Text style={styles.fieldLabel}>Languages</Text>
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

            <Text style={[styles.fieldLabel, { marginTop: 16 }]}>Content Niches</Text>
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

            <Text style={[styles.fieldLabel, { marginTop: 16 }]}>YouTube Handle</Text>
            <TextInput
              style={styles.input}
              value={youtubeHandle}
              onChangeText={setYoutubeHandle}
              placeholder="@yourhandle"
              placeholderTextColor={colors.t3}
              autoCapitalize="none"
            />

            <Text style={styles.fieldLabel}>Content Style</Text>
            <TextInput
              style={styles.input}
              value={contentStyle}
              onChangeText={setContentStyle}
              placeholder="e.g. lifestyle, tutorials, reviews"
              placeholderTextColor={colors.t3}
            />

            <TouchableOpacity
              style={[styles.saveBtn, saving && { opacity: 0.6 }]}
              onPress={saveContent}
              disabled={saving}
            >
              {saving
                ? <ActivityIndicator color={colors.white} />
                : <Text style={styles.saveBtnText}>Save Content Preferences</Text>
              }
            </TouchableOpacity>
          </>
        ) : (
          <>
            <ReadOnlyRow
              label="Languages"
              value={languages.length > 0 ? languages.join(', ') : 'Not set'}
            />
            <ReadOnlyRow
              label="Niches"
              value={(profile?.niche || []).length > 0 ? profile.niche.map(n => n.replace(/_/g, ' ')).join(', ') : 'Not set'}
            />
            {profile?.content_style && (
              <ReadOnlyRow label="Content Style" value={profile.content_style} />
            )}
          </>
        )}
      </View>

      {/* ── Bank & Payment Details Section ── */}
      <SectionHeader title="Payment & Tax" />
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Payout Settings</Text>
          {editSection !== 'bank' ? (
            <TouchableOpacity onPress={() => startEdit('bank')} style={styles.editBtnSmall}>
              <Text style={styles.editBtnSmallText}>{profile?.has_payout_method ? 'Update' : 'Add'}</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={cancelEdit} style={styles.cancelBtnSmall}>
              <Text style={styles.cancelBtnSmallText}>Cancel</Text>
            </TouchableOpacity>
          )}
        </View>

        {editSection === 'bank' ? (
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
            <Text style={styles.orDivider}>-- or bank account --</Text>
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
            <Text style={styles.orDivider}>-- tax info --</Text>
            <Text style={styles.fieldLabel}>PAN Number</Text>
            <TextInput
              style={styles.input}
              value={panNumber}
              onChangeText={setPanNumber}
              placeholder="ABCDE1234F"
              placeholderTextColor={colors.t3}
              autoCapitalize="characters"
              maxLength={10}
            />

            <View style={styles.warningBox}>
              <Text style={styles.warningText}>
                Bank details and PAN are encrypted with AES-256 before storage. We never store or display your details in plain text. These are used only for processing withdrawals and TDS compliance.
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.saveBtn, saving && { opacity: 0.6 }]}
              onPress={saveBank}
              disabled={saving}
            >
              {saving
                ? <ActivityIndicator color={colors.white} />
                : <Text style={styles.saveBtnText}>Save Payment Details</Text>
              }
            </TouchableOpacity>
          </>
        ) : (
          <>
            <ReadOnlyRow
              label="UPI"
              value={profile?.has_upi ? 'On file (encrypted)' : 'Not configured'}
            />
            <ReadOnlyRow
              label="Bank Account"
              value={profile?.has_bank_account ? 'On file (encrypted)' : 'Not configured'}
            />
            <ReadOnlyRow
              label="IFSC"
              value={profile?.bank_ifsc || (profile?.has_bank_account ? 'On file' : 'Not configured')}
            />
            <ReadOnlyRow
              label="PAN"
              value={profile?.has_pan ? 'On file (encrypted)' : 'Not configured'}
            />
            <View style={styles.tdsInfoBox}>
              <Text style={styles.tdsInfoText}>
                TDS at 10% is deducted on withdrawals as per Indian tax regulations. Minimum withdrawal: Rs.100.
              </Text>
            </View>
          </>
        )}
      </View>

      {/* ── App Settings Section ── */}
      <SectionHeader title="App Settings" />
      <View style={styles.card}>
        <View style={styles.settingRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.settingLabel}>Push Notifications</Text>
            <Text style={styles.settingDesc}>Receive alerts for offers, payments, and campaigns</Text>
          </View>
          <Switch
            value={pushEnabled}
            onValueChange={setPushEnabled}
            trackColor={{ false: colors.border, true: colors.teal }}
            thumbColor={colors.white}
          />
        </View>
      </View>

      {/* ── Account Info Section ── */}
      <SectionHeader title="Account" />
      <View style={styles.card}>
        <ReadOnlyRow
          label="Account Status"
          value={(profile?.user_status || 'unknown').charAt(0).toUpperCase() + (profile?.user_status || 'unknown').slice(1)}
        />
        <ReadOnlyRow label="Instagram Handle" value={profile?.instagram_handle ? `@${profile.instagram_handle}` : '--'} />
        <ReadOnlyRow label="Followers" value={fmtNum(profile?.followers_count)} />
        <ReadOnlyRow label="Engagement Rate" value={`${profile?.engagement_rate || 0}%`} />
        {profile?.scrape_last_run && (
          <ReadOnlyRow
            label="Last Stats Update"
            value={new Date(profile.scrape_last_run).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
          />
        )}
        <Text style={styles.accountNote}>
          Instagram handle and stats are verified by INFLX and cannot be edited manually. Stats are refreshed daily via our analytics partner.
        </Text>
      </View>

      {/* ── Logout ── */}
      <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg },

  // Header
  header: { backgroundColor: colors.navyDeep, padding: 20, paddingTop: 52 },
  headerTitle: { fontSize: 20, fontWeight: '800', color: colors.white, marginBottom: 16 },
  avatarRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.orange, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 22, fontWeight: '800', color: colors.white },
  handle: { fontSize: 16, fontWeight: '700', color: colors.white },
  nameText: { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  statusRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 6 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 11, color: 'rgba(255,255,255,0.6)', fontWeight: '600' },

  // Stats bar
  statsRow: { flexDirection: 'row', backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.border },
  statItem: { flex: 1, alignItems: 'center', paddingVertical: 12 },
  statValue: { fontSize: 15, fontWeight: '800', color: colors.t1 },
  statLabel: { fontSize: 9, color: colors.t3, fontWeight: '600', marginTop: 2, textTransform: 'uppercase' },
  statsNote: { fontSize: 10, color: colors.t3, textAlign: 'center', paddingVertical: 6, backgroundColor: colors.surface2 },

  // Section header
  sectionHeader: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 6 },
  sectionHeaderText: { fontSize: 11, fontWeight: '700', color: colors.t3, textTransform: 'uppercase', letterSpacing: 0.8 },

  // Cards
  card: { marginHorizontal: 16, marginBottom: 4, backgroundColor: colors.white, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.border },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  cardTitle: { fontSize: 14, fontWeight: '700', color: colors.t1 },

  // Edit / cancel buttons (inline)
  editBtnSmall: { backgroundColor: colors.navyPale, paddingHorizontal: 14, paddingVertical: 5, borderRadius: 20 },
  editBtnSmallText: { fontSize: 11, fontWeight: '700', color: colors.navy },
  cancelBtnSmall: { backgroundColor: colors.redPale, paddingHorizontal: 14, paddingVertical: 5, borderRadius: 20 },
  cancelBtnSmallText: { fontSize: 11, fontWeight: '700', color: colors.red },

  // Read-only row
  readOnlyRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.bg },
  readOnlyLabel: { fontSize: 12, fontWeight: '600', color: colors.t3, width: 110 },
  readOnlyValue: { fontSize: 13, color: colors.t1, flex: 1, textAlign: 'right' },

  // Form elements
  fieldLabel: { fontSize: 11, fontWeight: '700', color: colors.t3, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.3 },
  input: { borderWidth: 2, borderColor: colors.border2, borderRadius: 12, padding: 12, fontSize: 14, color: colors.t1, marginBottom: 12, backgroundColor: colors.surface2 },
  orDivider: { fontSize: 11, color: colors.t3, textAlign: 'center', marginVertical: 8 },

  // Chips
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border },
  chipActive: { backgroundColor: colors.navy, borderColor: colors.navy },
  chipText: { fontSize: 12, color: colors.t2, fontWeight: '600' },
  chipTextActive: { color: colors.white },

  // Save button
  saveBtn: { backgroundColor: colors.navy, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 12 },
  saveBtnText: { fontSize: 14, fontWeight: '800', color: colors.white },

  // Warning / info boxes
  warningBox: { backgroundColor: colors.goldPale, borderRadius: 10, padding: 12, marginTop: 8, borderWidth: 1, borderColor: colors.gold },
  warningText: { fontSize: 11, color: '#7A5500', lineHeight: 16 },
  tdsInfoBox: { backgroundColor: colors.navyPale, borderRadius: 10, padding: 12, marginTop: 8 },
  tdsInfoText: { fontSize: 11, color: colors.navy, lineHeight: 16 },
  accountNote: { fontSize: 11, color: colors.t3, lineHeight: 16, marginTop: 10 },

  // Settings
  settingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  settingLabel: { fontSize: 14, fontWeight: '700', color: colors.t1 },
  settingDesc: { fontSize: 11, color: colors.t3, marginTop: 2 },

  // Logout
  logoutBtn: { margin: 16, borderWidth: 1.5, borderColor: colors.red, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  logoutText: { fontSize: 14, fontWeight: '700', color: colors.red },
});
