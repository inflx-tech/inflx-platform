import React, { useEffect, useState, useContext, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, ActivityIndicator, Alert, Switch, RefreshControl,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { brandPalette as P, fonts, fmtNum } from '../../theme/tokens';
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

function ReadOnlyRow({ label, value, valueStyle }) {
  return (
    <View style={styles.readOnlyRow}>
      <Text style={styles.readOnlyLabel}>{label}</Text>
      <Text style={[styles.readOnlyValue, valueStyle]}>{value || '--'}</Text>
    </View>
  );
}

/**
 * ProfileScreen — settings hub with 3 inline edit modes.
 *
 * Flow 35 restyle (2026-05-27): brandPalette + Outfit/PJS/Mono fonts.
 * Yellow avatar tile with ink Outfit-Black initials (matches Flow 32 MyStore).
 * 📨📝 doc-row emojis replaced with MCI email-outline + file-document-outline
 * in yellowPale tiles per locked design call #2.
 * Push toggle "ON" track = success-green per locked design call #4.
 * All 3 edit modes + UPI XOR Bank XOR PAN validation preserved verbatim.
 */

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
    return <View style={styles.center}><ActivityIndicator color={P.yellow} size="large" /></View>;
  }

  const statusColor = {
    approved: P.success,
    pending: P.yellow,
    rejected: P.danger,
    suspended: P.danger,
  }[profile?.user_status] || P.muted3;

  const statusTextColor = {
    approved: P.successText,
    pending: P.yellowText,
    rejected: P.dangerText,
    suspended: P.dangerText,
  }[profile?.user_status] || P.muted;

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[P.yellow]} />}
    >
      {/* ── Ink header with avatar ── */}
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
            <Text style={styles.nameText}>{(profile?.name || profile?.full_name || 'No name set').toUpperCase()}</Text>
            <View style={styles.statusRow}>
              <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
              <Text style={styles.statusText}>
                {(profile?.user_status || 'UNKNOWN').toUpperCase()}
              </Text>
            </View>
          </View>
        </View>
        <View style={styles.headerAccent} />
      </View>

      {/* ── Instagram Stats (read-only, from Apify) ── */}
      <View style={styles.statsRow}>
        {[
          { label: 'FOLLOWERS', value: fmtNum(profile?.followers_count) },
          { label: 'ENG. RATE', value: `${profile?.engagement_rate || 0}%` },
          { label: 'TIER', value: (profile?.tier || 'Nano').toUpperCase() },
          { label: 'PLATFORM', value: (profile?.platform || 'IG').toUpperCase() },
        ].map(s => (
          <View key={s.label} style={styles.statItem}>
            <Text style={styles.statValue}>{s.value}</Text>
            <Text style={styles.statLabel}>{s.label}</Text>
          </View>
        ))}
      </View>
      <Text style={styles.statsNote}>STATS REFRESHED AUTOMATICALLY VIA INSTAGRAM</Text>

      {/* ── Profile Info Section ── */}
      <SectionHeader title="Profile Info" />
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Personal Details</Text>
          {editSection !== 'profile' ? (
            <TouchableOpacity onPress={() => startEdit('profile')} style={styles.editBtnSmall}>
              <Text style={styles.editBtnSmallText}>EDIT</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={cancelEdit} style={styles.cancelBtnSmall}>
              <Text style={styles.cancelBtnSmallText}>CANCEL</Text>
            </TouchableOpacity>
          )}
        </View>

        {editSection === 'profile' ? (
          <>
            <Text style={styles.fieldLabel}>NAME</Text>
            <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Your name" placeholderTextColor={P.muted3} />
            <Text style={styles.fieldLabel}>BIO</Text>
            <TextInput
              style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
              value={bio} onChangeText={setBio}
              placeholder="Tell brands about yourself…"
              placeholderTextColor={P.muted3} multiline maxLength={300}
            />
            <Text style={styles.fieldLabel}>CITY</Text>
            <TextInput style={styles.input} value={city} onChangeText={setCity} placeholder="e.g. Mumbai, Bangalore" placeholderTextColor={P.muted3} />
            <TouchableOpacity
              style={[styles.saveBtn, saving && { opacity: 0.6 }]}
              onPress={saveProfile} disabled={saving}
            >
              {saving ? <ActivityIndicator color={P.yellow} /> : <Text style={styles.saveBtnText}>SAVE PROFILE INFO</Text>}
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
          <Text style={styles.cardTitle}>Languages &amp; Niches</Text>
          {editSection !== 'content' ? (
            <TouchableOpacity onPress={() => startEdit('content')} style={styles.editBtnSmall}>
              <Text style={styles.editBtnSmallText}>EDIT</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={cancelEdit} style={styles.cancelBtnSmall}>
              <Text style={styles.cancelBtnSmallText}>CANCEL</Text>
            </TouchableOpacity>
          )}
        </View>

        {editSection === 'content' ? (
          <>
            <Text style={styles.fieldLabel}>LANGUAGES</Text>
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

            <Text style={[styles.fieldLabel, { marginTop: 16 }]}>CONTENT NICHES</Text>
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

            <Text style={[styles.fieldLabel, { marginTop: 16 }]}>YOUTUBE HANDLE</Text>
            <TextInput style={styles.input} value={youtubeHandle} onChangeText={setYoutubeHandle} placeholder="@yourhandle" placeholderTextColor={P.muted3} autoCapitalize="none" />

            <Text style={styles.fieldLabel}>CONTENT STYLE</Text>
            <TextInput style={styles.input} value={contentStyle} onChangeText={setContentStyle} placeholder="e.g. lifestyle, tutorials, reviews" placeholderTextColor={P.muted3} />

            <TouchableOpacity
              style={[styles.saveBtn, saving && { opacity: 0.6 }]}
              onPress={saveContent} disabled={saving}
            >
              {saving ? <ActivityIndicator color={P.yellow} /> : <Text style={styles.saveBtnText}>SAVE CONTENT PREFERENCES</Text>}
            </TouchableOpacity>
          </>
        ) : (
          <>
            <ReadOnlyRow label="Languages" value={languages.length > 0 ? languages.join(', ') : 'Not set'} />
            <ReadOnlyRow label="Niches" value={(profile?.niche || []).length > 0 ? profile.niche.map(n => n.replace(/_/g, ' ')).join(', ') : 'Not set'} />
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
              <Text style={styles.editBtnSmallText}>{profile?.has_payout_method ? 'UPDATE' : 'ADD'}</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={cancelEdit} style={styles.cancelBtnSmall}>
              <Text style={styles.cancelBtnSmallText}>CANCEL</Text>
            </TouchableOpacity>
          )}
        </View>

        {editSection === 'bank' ? (
          <>
            <Text style={styles.fieldLabel}>UPI ID (PREFERRED)</Text>
            <TextInput
              style={styles.input} value={upiId} onChangeText={setUpiId}
              placeholder="yourname@upi" placeholderTextColor={P.muted3}
              autoCapitalize="none" keyboardType="email-address"
            />
            <Text style={styles.orDivider}>— OR BANK ACCOUNT —</Text>
            <Text style={styles.fieldLabel}>ACCOUNT NUMBER</Text>
            <TextInput
              style={styles.input} value={bankAccount} onChangeText={setBankAccount}
              placeholder="Bank account number" placeholderTextColor={P.muted3}
              keyboardType="number-pad" secureTextEntry
            />
            <Text style={styles.fieldLabel}>IFSC CODE</Text>
            <TextInput
              style={styles.input} value={bankIfsc} onChangeText={setBankIfsc}
              placeholder="SBIN0001234" placeholderTextColor={P.muted3}
              autoCapitalize="characters"
            />
            <Text style={styles.orDivider}>— TAX INFO —</Text>
            <Text style={styles.fieldLabel}>PAN NUMBER</Text>
            <TextInput
              style={styles.input} value={panNumber} onChangeText={setPanNumber}
              placeholder="ABCDE1234F" placeholderTextColor={P.muted3}
              autoCapitalize="characters" maxLength={10}
            />

            <View style={styles.warningBox}>
              <Text style={styles.warningText}>
                <Text style={{ fontWeight: '800' }}>SECURE: </Text>
                Bank details and PAN are encrypted with AES-256 before storage. We never store or display your details in plain text. Used only for processing withdrawals and TDS compliance.
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.saveBtn, saving && { opacity: 0.6 }]}
              onPress={saveBank} disabled={saving}
            >
              {saving ? <ActivityIndicator color={P.yellow} /> : <Text style={styles.saveBtnText}>SAVE PAYMENT DETAILS</Text>}
            </TouchableOpacity>
          </>
        ) : (
          <>
            <ReadOnlyRow label="UPI" value={profile?.has_upi ? 'On file (encrypted)' : 'Not configured'} />
            <ReadOnlyRow label="Bank Account" value={profile?.has_bank_account ? 'On file (encrypted)' : 'Not configured'} />
            <ReadOnlyRow label="IFSC" value={profile?.bank_ifsc || (profile?.has_bank_account ? 'On file' : 'Not configured')} />
            <ReadOnlyRow label="PAN" value={profile?.has_pan ? 'On file (encrypted)' : 'Not configured'} />
            <View style={styles.tdsInfoBox}>
              <Text style={styles.tdsInfoText}>
                TDS at 10% is deducted on withdrawals as per Indian tax regulations. Minimum withdrawal: ₹100.
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
            trackColor={{ false: P.border, true: P.success }}
            thumbColor={P.white}
          />
        </View>
      </View>

      {/* ── Account Info Section ── */}
      <SectionHeader title="Account" />
      <View style={styles.card}>
        <ReadOnlyRow
          label="Account Status"
          value={(profile?.user_status || 'unknown').toUpperCase()}
          valueStyle={{ color: statusTextColor }}
        />
        <ReadOnlyRow label="Instagram" value={profile?.instagram_handle ? `@${profile.instagram_handle}` : '--'} />
        <ReadOnlyRow label="Followers" value={fmtNum(profile?.followers_count)} />
        <ReadOnlyRow label="Eng. Rate" value={`${profile?.engagement_rate || 0}%`} />
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

      {/* ── Brand Outreach (Documents + Proposals) ── */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Brand Outreach</Text>
        <TouchableOpacity
          style={styles.docRow}
          onPress={() => navigation.navigate('ProposalsHub')}>
          <View style={styles.docIco}>
            <Icon name="email-outline" size={18} color={P.yellowText} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.docLabel}>Brand Proposals</Text>
            <Text style={styles.docHint}>DISCOVER + TRACK PITCHES</Text>
          </View>
          <Icon name="chevron-right" size={16} color={P.muted3} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.docRow, { borderTopWidth: 1, borderTopColor: P.borderSoft, marginTop: 4 }]}
          onPress={() => navigation.navigate('MyContracts')}>
          <View style={styles.docIco}>
            <Icon name="file-document-outline" size={18} color={P.yellowText} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.docLabel}>My Contracts</Text>
            <Text style={styles.docHint}>SIGNED CONTRACT PDFS</Text>
          </View>
          <Icon name="chevron-right" size={16} color={P.muted3} />
        </TouchableOpacity>
      </View>

      {/* ── Logout ── */}
      <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
        <Text style={styles.logoutText}>LOG OUT</Text>
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: P.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: P.bg },

  // Ink header
  header: { backgroundColor: P.ink, padding: 18, paddingTop: 50, paddingBottom: 22, position: 'relative' },
  headerAccent: { position: 'absolute', left: 18, bottom: 8, width: 30, height: 3, backgroundColor: P.yellow, borderRadius: 2 },
  headerTitle: {
    fontSize: 20, fontWeight: '900', color: P.white, marginBottom: 16,
    letterSpacing: -0.3, fontFamily: fonts.displayBlack,
  },
  avatarRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: P.yellow,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 22, fontWeight: '900', color: P.ink, fontFamily: fonts.displayBlack },
  handle: { fontSize: 16, fontWeight: '800', color: P.white, fontFamily: fonts.displayBold },
  nameText: { fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 2, fontWeight: '700', letterSpacing: 0.2, fontFamily: fonts.monoMedium },
  statusRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 6 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 10, color: 'rgba(255,255,255,0.65)', fontWeight: '800', letterSpacing: 0.3, fontFamily: fonts.monoBold },

  // Stats bar
  statsRow: {
    flexDirection: 'row', backgroundColor: P.white,
    borderBottomWidth: 1, borderBottomColor: P.border,
  },
  statItem: { flex: 1, alignItems: 'center', paddingVertical: 12 },
  statValue: { fontSize: 15, fontWeight: '900', color: P.ink, fontFamily: fonts.monoBold },
  statLabel: {
    fontSize: 8.5, color: P.muted2, fontWeight: '800', marginTop: 2,
    textTransform: 'uppercase', letterSpacing: 0.3, fontFamily: fonts.monoBold,
  },
  statsNote: {
    fontSize: 9.5, color: P.muted2, textAlign: 'center',
    paddingVertical: 6, backgroundColor: P.bg2,
    fontWeight: '700', letterSpacing: 0.2, fontFamily: fonts.monoMedium,
  },

  // Section header
  sectionHeader: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 6 },
  sectionHeaderText: {
    fontSize: 11, fontWeight: '800', color: P.muted2,
    textTransform: 'uppercase', letterSpacing: 0.5, fontFamily: fonts.displayBold,
  },

  // Cards
  card: {
    marginHorizontal: 16, marginBottom: 4,
    backgroundColor: P.white, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: P.border,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 11 },
  cardTitle: { fontSize: 13.5, fontWeight: '800', color: P.ink, fontFamily: fonts.displayBold },

  // Edit / cancel buttons (inline)
  editBtnSmall: { backgroundColor: P.bg2, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999 },
  editBtnSmallText: { fontSize: 10, fontWeight: '800', color: P.ink, letterSpacing: 0.3, fontFamily: fonts.monoBold },
  cancelBtnSmall: { backgroundColor: P.dangerPale, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999 },
  cancelBtnSmallText: { fontSize: 10, fontWeight: '800', color: P.dangerText, letterSpacing: 0.3, fontFamily: fonts.monoBold },

  // Read-only row
  readOnlyRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: P.bg,
  },
  readOnlyLabel: { fontSize: 11.5, fontWeight: '600', color: P.muted2, width: 100, fontFamily: fonts.sansRegular },
  readOnlyValue: { fontSize: 11.5, color: P.ink, flex: 1, textAlign: 'right', fontWeight: '700', fontFamily: fonts.monoMedium },

  // Form elements
  fieldLabel: {
    fontSize: 9.5, fontWeight: '800', color: P.muted2, marginBottom: 6,
    textTransform: 'uppercase', letterSpacing: 0.3, marginTop: 8,
    fontFamily: fonts.monoBold,
  },
  input: {
    borderWidth: 1.5, borderColor: P.ink, borderRadius: 10,
    padding: 11, fontSize: 12.5, color: P.ink, marginBottom: 8,
    backgroundColor: P.white, fontFamily: fonts.sansRegular,
  },
  orDivider: {
    fontSize: 10, color: P.muted2, textAlign: 'center', marginVertical: 8,
    fontWeight: '800', letterSpacing: 0.3, fontFamily: fonts.monoBold,
  },

  // Chips
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    paddingHorizontal: 11, paddingVertical: 5, borderRadius: 999,
    backgroundColor: P.bg2, borderWidth: 1, borderColor: P.border,
  },
  chipActive: { backgroundColor: P.ink, borderColor: P.ink },
  chipText: { fontSize: 10, color: P.muted, fontWeight: '700', textTransform: 'capitalize', fontFamily: fonts.monoMedium },
  chipTextActive: { color: P.yellow, fontWeight: '900', fontFamily: fonts.monoBold },

  // Save button — ink + yellow Outfit-Black UPPERCASE
  saveBtn: {
    backgroundColor: P.ink, borderRadius: 12,
    paddingVertical: 13, alignItems: 'center', marginTop: 12,
  },
  saveBtnText: {
    fontSize: 13, fontWeight: '900', color: P.yellow,
    letterSpacing: 0.2, textTransform: 'uppercase', fontFamily: fonts.displayBlack,
  },

  // Warning / info boxes — yellowPale per design call
  warningBox: {
    backgroundColor: P.yellowPale, borderRadius: 10, padding: 11, marginTop: 8,
    borderWidth: 1, borderColor: '#F0DA88',
  },
  warningText: { fontSize: 10.5, color: P.yellowText, lineHeight: 16, fontFamily: fonts.sansRegular },
  tdsInfoBox: {
    backgroundColor: P.infoPale, borderRadius: 10, padding: 11, marginTop: 8,
    borderWidth: 1, borderColor: '#BFD9F2',
  },
  tdsInfoText: { fontSize: 10.5, color: P.ink, lineHeight: 16, fontFamily: fonts.sansRegular },
  accountNote: { fontSize: 10.5, color: P.muted2, lineHeight: 16, marginTop: 10, fontFamily: fonts.sansRegular },

  // Settings
  settingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  settingLabel: { fontSize: 13.5, fontWeight: '800', color: P.ink, fontFamily: fonts.displayBold },
  settingDesc: { fontSize: 10.5, color: P.muted2, marginTop: 2, fontFamily: fonts.sansRegular },

  // Doc rows — yellowPale MCI tiles
  docRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 12 },
  docIco: {
    width: 36, height: 36, borderRadius: 9,
    backgroundColor: P.yellowPale,
    alignItems: 'center', justifyContent: 'center',
  },
  docLabel: { fontSize: 13, fontWeight: '800', color: P.ink, fontFamily: fonts.displayBold },
  docHint: { fontSize: 10, color: P.muted2, marginTop: 2, fontWeight: '700', letterSpacing: 0.2, fontFamily: fonts.monoMedium },

  // Logout — danger border
  logoutBtn: {
    margin: 16, borderWidth: 1.5, borderColor: P.danger, borderRadius: 14,
    paddingVertical: 14, alignItems: 'center', backgroundColor: P.white,
  },
  logoutText: { fontSize: 13, fontWeight: '900', color: P.dangerText, textTransform: 'uppercase', letterSpacing: 0.3, fontFamily: fonts.displayBlack },
});
