import React, { useEffect, useState, useContext } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { colors } from '../../theme/tokens';
import { brandApi, clearSession } from '../../services/api';
import { AuthContext } from '../../../App';
import { openWebDashboard } from '../../utils/openWebDashboard';

const EMPTY_BRANCH = {
  name: '', state: '', city: '', pincode: '', address: '', phone: '', google_maps_url: '',
};

export default function BrandProfileScreen({ navigation }) {
  const { setRole: setAppRole } = useContext(AuthContext);
  const [brand, setBrand]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);

  // Editable fields (flat)
  const [businessName, setBusinessName] = useState('');
  const [contactName,  setContactName]  = useState('');
  const [gstin,        setGstin]        = useState('');
  const [logoUrl,      setLogoUrl]      = useState('');

  // Main branch (structured, flattened into top-level address_line + pincode on save)
  const [mainBranch, setMainBranch] = useState({
    state: '', city: '', pincode: '', address: '', google_maps_url: '',
  });

  // Additional branches
  const [branches, setBranches] = useState([]);

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    setLoading(true);
    const res = await brandApi.getMe();
    setLoading(false);
    if (!res.success) {
      Alert.alert('Error', res.error?.message || 'Failed to load profile');
      return;
    }
    const b = res.data?.brand || res.data;
    setBrand(b);
    setBusinessName(b.business_name || '');
    setGstin(b.gstin || '');
    setLogoUrl(b.logo_url || '');

    const ld = b.listing_data || {};
    setContactName(ld.contact_person_name || b.name || '');

    const allBranches = Array.isArray(ld.branches) ? ld.branches : [];
    const main = allBranches.find(br => br.name === 'Main Branch') || {};
    setMainBranch({
      state:           main.state || '',
      city:            main.city || '',
      pincode:         main.pincode || b.pincode || '',
      address:         main.address || b.address_line || '',
      google_maps_url: main.google_maps_url || '',
    });
    setBranches(allBranches.filter(br => br.name !== 'Main Branch'));
  }

  function setMainField(field, value) {
    setMainBranch(prev => ({ ...prev, [field]: value }));
  }

  function addBranch() {
    setBranches(prev => [...prev, { ...EMPTY_BRANCH }]);
  }
  function updateBranch(index, field, value) {
    setBranches(prev => prev.map((b, i) => i === index ? { ...b, [field]: value } : b));
  }
  function removeBranch(index) {
    Alert.alert('Remove branch?', 'This will delete the branch from your profile.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => setBranches(prev => prev.filter((_, i) => i !== index)) },
    ]);
  }

  async function handleSave() {
    if (!businessName.trim()) {
      Alert.alert('Missing info', 'Business name is required.');
      return;
    }

    const payload = {};
    if (businessName.trim() !== (brand?.business_name || '')) payload.business_name = businessName.trim();
    if (gstin.trim() !== (brand?.gstin || ''))                payload.gstin         = gstin.trim();
    if (logoUrl.trim() !== (brand?.logo_url || ''))           payload.logo_url      = logoUrl.trim();

    const mainAddr = mainBranch.address.trim();
    const mainPin  = mainBranch.pincode.trim();
    if (mainAddr !== (brand?.address_line || '')) payload.address_line = mainAddr;
    if (mainPin  !== (brand?.pincode || ''))      payload.pincode      = mainPin;

    const existingLd = brand?.listing_data || {};
    const mainBranchEntry = {
      name: 'Main Branch',
      state:           mainBranch.state,
      city:            mainBranch.city.trim(),
      pincode:         mainBranch.pincode.trim(),
      address:         mainBranch.address.trim(),
      phone:           brand?.phone || '',
      google_maps_url: mainBranch.google_maps_url.trim(),
    };
    const extras = branches
      .filter(b => (b.name || '').trim() || (b.address || '').trim())
      .map(b => ({
        name:            (b.name || '').trim(),
        state:           b.state || '',
        city:            (b.city || '').trim(),
        pincode:         (b.pincode || '').trim(),
        address:         (b.address || '').trim(),
        phone:           (b.phone || '').trim(),
        google_maps_url: (b.google_maps_url || '').trim(),
      }));
    const newLd = {
      ...existingLd,
      contact_person_name: contactName.trim(),
      branches: [mainBranchEntry, ...extras],
    };
    if (JSON.stringify(newLd) !== JSON.stringify(existingLd)) {
      payload.listing_data = newLd;
    }

    if (Object.keys(payload).length === 0) {
      Alert.alert('Nothing to save', 'No changes detected.');
      return;
    }

    setSaving(true);
    const res = await brandApi.updateMe(payload);
    setSaving(false);
    if (res.success) {
      Alert.alert('Saved', 'Your profile has been updated.');
      const updated = res.data?.brand || res.data;
      setBrand(updated);
    } else {
      Alert.alert('Save failed', res.error?.message || 'Could not save changes.');
    }
  }

  async function logout() {
    Alert.alert('Logout', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive',
        onPress: async () => { await clearSession(); setAppRole(''); } },
    ]);
  }

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={colors.navy} /></View>;
  }
  if (!brand) {
    return (
      <View style={styles.center}>
        <Text style={styles.loadingText}>Brand profile not found. Please complete registration first.</Text>
      </View>
    );
  }

  const status = brand.user_status || brand.status || 'pending';
  const rejectionReason = brand.rejection_reason;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {(businessName || 'BR').slice(0, 2).toUpperCase()}
            </Text>
          </View>
          <Text style={styles.brandName}>{businessName || '—'}</Text>
          <View style={[styles.statusChip, status === 'approved' ? styles.statusApproved : styles.statusPending]}>
            <Text style={[styles.statusChipText, status === 'approved' ? styles.statusApprovedText : styles.statusPendingText]}>
              {status}
            </Text>
          </View>
        </View>

        {/* Status banner for pending / rejected */}
        {(status === 'pending' || status === 'rejected') && (
          <View style={[styles.statusBanner, status === 'rejected' ? styles.statusBannerError : styles.statusBannerWarn]}>
            <Text style={[styles.statusBannerTitle, status === 'rejected' ? styles.statusBannerErrorText : styles.statusBannerWarnText]}>
              {status === 'pending' ? 'Account pending review' : 'Account not approved'}
            </Text>
            <Text style={[styles.statusBannerBody, status === 'rejected' ? styles.statusBannerErrorText : styles.statusBannerWarnText]}>
              {status === 'pending'
                ? 'An admin will approve your account soon. You can update your profile in the meantime.'
                : (rejectionReason ? `Reason: ${rejectionReason}` : 'Please contact support for details.')}
            </Text>
          </View>
        )}

        {/* Business Information */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Business Information</Text>

          <Field label="Business Name *">
            <TextInput
              style={styles.input}
              value={businessName}
              onChangeText={setBusinessName}
              placeholder="Your business name"
              placeholderTextColor={colors.t3}
            />
          </Field>

          <Field label="Contact Person">
            <TextInput
              style={styles.input}
              value={contactName}
              onChangeText={setContactName}
              placeholder="Primary contact name"
              placeholderTextColor={colors.t3}
            />
          </Field>

          <Field label="Phone" hint="Linked to your login — cannot be changed here.">
            <TextInput
              style={[styles.input, styles.inputReadOnly]}
              value={brand.phone || ''}
              editable={false}
            />
          </Field>

          <Field label="Category" hint="Locked after registration.">
            <TextInput
              style={[styles.input, styles.inputReadOnly]}
              value={brand.category || ''}
              editable={false}
            />
          </Field>

          <Field label="GSTIN">
            <TextInput
              style={styles.input}
              value={gstin}
              onChangeText={t => setGstin(t.toUpperCase())}
              placeholder="22AAAAA0000A1Z5"
              placeholderTextColor={colors.t3}
              autoCapitalize="characters"
              maxLength={15}
            />
          </Field>

          <Field label="Logo URL" hint="Direct image URL. File upload coming soon.">
            <TextInput
              style={styles.input}
              value={logoUrl}
              onChangeText={setLogoUrl}
              placeholder="https://example.com/logo.png"
              placeholderTextColor={colors.t3}
              autoCapitalize="none"
              keyboardType="url"
            />
          </Field>
        </View>

        {/* Main Branch */}
        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <Text style={styles.cardTitle}>Main Branch</Text>
            <Text style={styles.primaryChip}>Primary</Text>
          </View>

          <Field label="State">
            <TextInput
              style={styles.input}
              value={mainBranch.state}
              onChangeText={t => setMainField('state', t)}
              placeholder="e.g. Karnataka"
              placeholderTextColor={colors.t3}
            />
          </Field>

          <Field label="City / District">
            <TextInput
              style={styles.input}
              value={mainBranch.city}
              onChangeText={t => setMainField('city', t)}
              placeholder="e.g. Bangalore"
              placeholderTextColor={colors.t3}
            />
          </Field>

          <Field label="Pincode">
            <TextInput
              style={styles.input}
              value={mainBranch.pincode}
              onChangeText={t => setMainField('pincode', t.replace(/\D/g, '').slice(0, 6))}
              placeholder="560001"
              placeholderTextColor={colors.t3}
              keyboardType="number-pad"
              maxLength={6}
            />
          </Field>

          <Field label="Full Address">
            <TextInput
              style={[styles.input, styles.inputTextarea]}
              value={mainBranch.address}
              onChangeText={t => setMainField('address', t)}
              placeholder="Street, landmark, area..."
              placeholderTextColor={colors.t3}
              multiline
              numberOfLines={3}
            />
          </Field>

          <Field label="Google Maps URL">
            <TextInput
              style={styles.input}
              value={mainBranch.google_maps_url}
              onChangeText={t => setMainField('google_maps_url', t)}
              placeholder="Paste Google Maps link"
              placeholderTextColor={colors.t3}
              autoCapitalize="none"
              keyboardType="url"
            />
          </Field>
        </View>

        {/* Additional Branches */}
        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <Text style={styles.cardTitle}>Additional Branches</Text>
            <TouchableOpacity onPress={addBranch} style={styles.addBranchBtn}>
              <Text style={styles.addBranchBtnText}>+ Add Branch</Text>
            </TouchableOpacity>
          </View>

          {branches.length === 0 && (
            <Text style={styles.emptyText}>No additional branches. Tap &quot;+ Add Branch&quot; to add one.</Text>
          )}

          {branches.map((b, idx) => (
            <View key={idx} style={styles.branchBox}>
              <View style={styles.cardTitleRow}>
                <Text style={styles.branchIndex}>Branch {idx + 1}</Text>
                <TouchableOpacity onPress={() => removeBranch(idx)}>
                  <Text style={styles.removeText}>Remove</Text>
                </TouchableOpacity>
              </View>

              <Field label="Branch Name">
                <TextInput
                  style={styles.input}
                  value={b.name}
                  onChangeText={t => updateBranch(idx, 'name', t)}
                  placeholder="e.g. Indiranagar Branch"
                  placeholderTextColor={colors.t3}
                />
              </Field>

              <Field label="State">
                <TextInput
                  style={styles.input}
                  value={b.state}
                  onChangeText={t => updateBranch(idx, 'state', t)}
                  placeholder="e.g. Karnataka"
                  placeholderTextColor={colors.t3}
                />
              </Field>

              <Field label="City / District">
                <TextInput
                  style={styles.input}
                  value={b.city}
                  onChangeText={t => updateBranch(idx, 'city', t)}
                  placeholder="e.g. Bangalore"
                  placeholderTextColor={colors.t3}
                />
              </Field>

              <Field label="Pincode">
                <TextInput
                  style={styles.input}
                  value={b.pincode}
                  onChangeText={t => updateBranch(idx, 'pincode', t.replace(/\D/g, '').slice(0, 6))}
                  placeholder="560001"
                  placeholderTextColor={colors.t3}
                  keyboardType="number-pad"
                  maxLength={6}
                />
              </Field>

              <Field label="Address">
                <TextInput
                  style={[styles.input, styles.inputTextarea]}
                  value={b.address}
                  onChangeText={t => updateBranch(idx, 'address', t)}
                  placeholder="Full address"
                  placeholderTextColor={colors.t3}
                  multiline
                  numberOfLines={2}
                />
              </Field>

              <Field label="Phone">
                <TextInput
                  style={styles.input}
                  value={b.phone}
                  onChangeText={t => updateBranch(idx, 'phone', t)}
                  placeholder="+91 9876543210"
                  placeholderTextColor={colors.t3}
                  keyboardType="phone-pad"
                />
              </Field>

              <Field label="Google Maps URL">
                <TextInput
                  style={styles.input}
                  value={b.google_maps_url}
                  onChangeText={t => updateBranch(idx, 'google_maps_url', t)}
                  placeholder="Paste Google Maps link"
                  placeholderTextColor={colors.t3}
                  autoCapitalize="none"
                  keyboardType="url"
                />
              </Field>
            </View>
          ))}
        </View>

        {/* Save button */}
        <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
          {saving ? <ActivityIndicator color={colors.white} /> : <Text style={styles.saveBtnText}>Save Changes</Text>}
        </TouchableOpacity>

        {/* Quick Links / Logout */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Other</Text>
          <TouchableOpacity style={styles.linkRow} onPress={() => openWebDashboard('/dashboard')}>
            <Text style={styles.linkIcon}>[W]</Text>
            <Text style={styles.linkLabel}>Open Web Dashboard</Text>
            <Text style={styles.linkArrow}>›</Text>
          </TouchableOpacity>
          <Text style={styles.hintSubtle}>For campaign creation and product/menu management.</Text>
          <TouchableOpacity style={styles.linkRow} onPress={() => navigation.navigate('Notifications')}>
            <Text style={styles.linkIcon}>[N]</Text>
            <Text style={styles.linkLabel}>Notifications</Text>
            <Text style={styles.linkArrow}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.linkRow} onPress={() => navigation.navigate('MediaGallery')}>
            <Text style={styles.linkIcon}>[G]</Text>
            <Text style={styles.linkLabel}>Media Gallery</Text>
            <Text style={styles.linkArrow}>›</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({ label, hint, children }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
      {hint ? <Text style={styles.fieldHint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: colors.bg },
  center:       { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  loadingText:  { fontSize: 13, color: colors.t2, textAlign: 'center' },

  header:       { backgroundColor: colors.navyDeep, padding: 20, paddingTop: 52, alignItems: 'center' },
  avatar:       { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.orange, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  avatarText:   { fontSize: 26, fontWeight: '900', color: colors.white },
  brandName:    { fontSize: 20, fontWeight: '800', color: colors.white, marginBottom: 8 },
  statusChip:   { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 5 },
  statusApproved: { backgroundColor: colors.teal + '30' },
  statusApprovedText: { color: colors.teal, fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  statusPending:      { backgroundColor: colors.orange + '30' },
  statusPendingText:  { color: colors.orange, fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  statusChipText:     { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },

  statusBanner:        { margin: 16, marginBottom: 0, padding: 12, borderRadius: 12, borderWidth: 1 },
  statusBannerWarn:    { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' },
  statusBannerError:   { backgroundColor: '#FEF2F2', borderColor: '#FCA5A5' },
  statusBannerTitle:   { fontSize: 13, fontWeight: '800', marginBottom: 4 },
  statusBannerBody:    { fontSize: 12, lineHeight: 16 },
  statusBannerWarnText:{ color: '#92400E' },
  statusBannerErrorText:{ color: '#991B1B' },

  card:         { margin: 16, marginBottom: 0, backgroundColor: colors.white, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.border },
  cardTitle:    { fontSize: 14, fontWeight: '700', color: colors.t1 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  primaryChip:  { backgroundColor: colors.tealPale, color: colors.tealDeep, fontSize: 10, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, overflow: 'hidden' },

  field:        { marginBottom: 12 },
  fieldLabel:   { fontSize: 11, fontWeight: '700', color: colors.t2, marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.3 },
  fieldHint:    { fontSize: 10, color: colors.t3, marginTop: 4 },
  input:        { borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.white, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: colors.t1 },
  inputReadOnly:{ backgroundColor: colors.bg, color: colors.t3 },
  inputTextarea:{ minHeight: 72, textAlignVertical: 'top' },

  addBranchBtn: { borderWidth: 1, borderColor: colors.orange, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 },
  addBranchBtnText: { fontSize: 11, fontWeight: '700', color: colors.orange },
  branchBox:    { borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12, marginBottom: 12 },
  branchIndex:  { fontSize: 10, fontWeight: '800', color: colors.t3, letterSpacing: 0.5, textTransform: 'uppercase' },
  removeText:   { fontSize: 12, color: colors.red, fontWeight: '700' },
  emptyText:    { fontSize: 12, color: colors.t3, textAlign: 'center', paddingVertical: 8 },

  saveBtn:      { margin: 16, backgroundColor: colors.orange, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  saveBtnText:  { fontSize: 14, fontWeight: '800', color: colors.white },

  linkRow:      { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border, gap: 10 },
  linkIcon:     { fontSize: 12, fontWeight: '800', color: colors.t2, width: 24 },
  linkLabel:    { flex: 1, fontSize: 13, fontWeight: '600', color: colors.t1 },
  linkArrow:    { fontSize: 18, color: colors.t3 },
  hintSubtle:   { fontSize: 10, color: colors.t3, marginTop: 4, marginLeft: 34 },

  logoutBtn:    { margin: 16, borderWidth: 1, borderColor: colors.red, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  logoutText:   { fontSize: 14, fontWeight: '700', color: colors.red },
});
