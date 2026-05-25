import React, { useEffect, useState, useContext } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { brandPalette as P, fonts } from '../../theme/tokens';
import { brandApi, clearSession } from '../../services/api';
import { AuthContext } from '../../../App';
import { openWebDashboard } from '../../utils/openWebDashboard';
import StatusPill from '../../components/brand/StatusPill';

/**
 * BrandProfileScreen — brand profile editor (business info, main branch,
 * additional branches) + Other links + Logout.
 *
 * Flow 24 (2026-05-25): navy + orange → brandPalette + StatusPill + fonts.
 * Behavior preserved 1:1 (diff-based save, listing_data flatten with
 * branches[0]=Main, branch list CRUD with Alert confirmation, AuthContext
 * logout via clearSession + setAppRole('')).
 */

const EMPTY_BRANCH = {
  name: '', state: '', city: '', pincode: '', address: '', phone: '', google_maps_url: '',
};

export default function BrandProfileScreen({ navigation }) {
  const { setRole: setAppRole } = useContext(AuthContext);
  const [brand, setBrand]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);

  const [businessName, setBusinessName] = useState('');
  const [contactName,  setContactName]  = useState('');
  const [gstin,        setGstin]        = useState('');
  const [logoUrl,      setLogoUrl]      = useState('');

  const [mainBranch, setMainBranch] = useState({
    state: '', city: '', pincode: '', address: '', google_maps_url: '',
  });
  const [branches, setBranches] = useState([]);

  useEffect(() => { loadProfile(); }, []);

  async function loadProfile() {
    setLoading(true);
    const res = await brandApi.getMe();
    setLoading(false);
    if (!res.success) { Alert.alert('Error', res.error?.message || 'Failed to load profile'); return; }
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
    if (!businessName.trim()) { Alert.alert('Missing info', 'Business name is required.'); return; }

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

    if (Object.keys(payload).length === 0) { Alert.alert('Nothing to save', 'No changes detected.'); return; }

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
    return <View style={s.center}><ActivityIndicator color={P.yellow} size="large" /></View>;
  }
  if (!brand) {
    return (
      <View style={s.center}>
        <Text style={s.loadingText}>Brand profile not found. Please complete registration first.</Text>
      </View>
    );
  }

  const status = brand.user_status || brand.status || 'pending';
  const rejectionReason = brand.rejection_reason;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={s.container} keyboardShouldPersistTaps="handled">
        <View style={s.hero}>
          <View style={s.avatar}>
            <Text style={s.avatarText}>
              {(businessName || 'BR').slice(0, 2).toUpperCase()}
            </Text>
          </View>
          <Text style={s.brandName}>{businessName || '—'}</Text>
          <StatusPill status={status} />
        </View>

        {(status === 'pending' || status === 'rejected') && (
          <View style={[s.statusBanner, status === 'rejected' ? s.statusBannerError : s.statusBannerWarn]}>
            <Text style={[s.statusBannerTitle, status === 'rejected' ? s.statusBannerErrorText : s.statusBannerWarnText]}>
              {status === 'pending' ? 'Account pending review' : 'Account not approved'}
            </Text>
            <Text style={[s.statusBannerBody, status === 'rejected' ? s.statusBannerErrorText : s.statusBannerWarnText]}>
              {status === 'pending'
                ? 'An admin will approve your account soon. You can update your profile in the meantime.'
                : (rejectionReason ? `Reason: ${rejectionReason}` : 'Please contact support for details.')}
            </Text>
          </View>
        )}

        <View style={s.card}>
          <Text style={s.cardTitle}>Business Information</Text>

          <Field label="Business Name *">
            <TextInput style={s.input} value={businessName} onChangeText={setBusinessName} placeholder="Your business name" placeholderTextColor={P.muted3} />
          </Field>

          <Field label="Contact Person">
            <TextInput style={s.input} value={contactName} onChangeText={setContactName} placeholder="Primary contact name" placeholderTextColor={P.muted3} />
          </Field>

          <Field label="Phone" hint="Linked to your login — cannot be changed here.">
            <TextInput style={[s.input, s.inputReadOnly]} value={brand.phone || ''} editable={false} />
          </Field>

          <Field label="Category" hint="Locked after registration.">
            <TextInput style={[s.input, s.inputReadOnly]} value={brand.category || ''} editable={false} />
          </Field>

          <Field label="GSTIN">
            <TextInput
              style={[s.input, { fontFamily: fonts.monoMedium }]}
              value={gstin}
              onChangeText={t => setGstin(t.toUpperCase())}
              placeholder="22AAAAA0000A1Z5"
              placeholderTextColor={P.muted3}
              autoCapitalize="characters"
              maxLength={15}
            />
          </Field>

          <Field label="Logo URL" hint="Direct image URL. File upload coming soon.">
            <TextInput
              style={[s.input, { fontFamily: fonts.monoMedium, fontSize: 11.5 }]}
              value={logoUrl}
              onChangeText={setLogoUrl}
              placeholder="https://example.com/logo.png"
              placeholderTextColor={P.muted3}
              autoCapitalize="none"
              keyboardType="url"
            />
          </Field>
        </View>

        <View style={s.card}>
          <View style={s.cardTitleRow}>
            <Text style={s.cardTitle}>Main Branch</Text>
            <Text style={s.primaryChip}>PRIMARY</Text>
          </View>

          <Field label="State">
            <TextInput style={s.input} value={mainBranch.state} onChangeText={t => setMainField('state', t)} placeholder="e.g. Karnataka" placeholderTextColor={P.muted3} />
          </Field>
          <Field label="City / District">
            <TextInput style={s.input} value={mainBranch.city} onChangeText={t => setMainField('city', t)} placeholder="e.g. Bangalore" placeholderTextColor={P.muted3} />
          </Field>
          <Field label="Pincode">
            <TextInput
              style={[s.input, { fontFamily: fonts.monoMedium }]}
              value={mainBranch.pincode}
              onChangeText={t => setMainField('pincode', t.replace(/\D/g, '').slice(0, 6))}
              placeholder="560001" placeholderTextColor={P.muted3}
              keyboardType="number-pad" maxLength={6}
            />
          </Field>
          <Field label="Full Address">
            <TextInput
              style={[s.input, s.inputTextarea]}
              value={mainBranch.address} onChangeText={t => setMainField('address', t)}
              placeholder="Street, landmark, area..." placeholderTextColor={P.muted3}
              multiline numberOfLines={3}
            />
          </Field>
          <Field label="Google Maps URL">
            <TextInput
              style={[s.input, { fontFamily: fonts.monoMedium, fontSize: 11.5 }]}
              value={mainBranch.google_maps_url} onChangeText={t => setMainField('google_maps_url', t)}
              placeholder="Paste Google Maps link" placeholderTextColor={P.muted3}
              autoCapitalize="none" keyboardType="url"
            />
          </Field>
        </View>

        <View style={s.card}>
          <View style={s.cardTitleRow}>
            <Text style={s.cardTitle}>Additional Branches</Text>
            <TouchableOpacity onPress={addBranch} style={s.addBranchBtn} activeOpacity={0.7}>
              <Text style={s.addBranchBtnText}>+ Add Branch</Text>
            </TouchableOpacity>
          </View>

          {branches.length === 0 && (
            <Text style={s.emptyText}>No additional branches. Tap "+ Add Branch" to add one.</Text>
          )}

          {branches.map((b, idx) => (
            <View key={idx} style={s.branchBox}>
              <View style={s.branchHead}>
                <Text style={s.branchIndex}>BRANCH {idx + 1}</Text>
                <TouchableOpacity onPress={() => removeBranch(idx)}>
                  <Text style={s.removeText}>Remove</Text>
                </TouchableOpacity>
              </View>

              <Field label="Branch Name">
                <TextInput style={s.input} value={b.name} onChangeText={t => updateBranch(idx, 'name', t)} placeholder="e.g. Indiranagar Branch" placeholderTextColor={P.muted3} />
              </Field>
              <Field label="State">
                <TextInput style={s.input} value={b.state} onChangeText={t => updateBranch(idx, 'state', t)} placeholder="e.g. Karnataka" placeholderTextColor={P.muted3} />
              </Field>
              <Field label="City / District">
                <TextInput style={s.input} value={b.city} onChangeText={t => updateBranch(idx, 'city', t)} placeholder="e.g. Bangalore" placeholderTextColor={P.muted3} />
              </Field>
              <Field label="Pincode">
                <TextInput
                  style={[s.input, { fontFamily: fonts.monoMedium }]}
                  value={b.pincode}
                  onChangeText={t => updateBranch(idx, 'pincode', t.replace(/\D/g, '').slice(0, 6))}
                  placeholder="560001" placeholderTextColor={P.muted3}
                  keyboardType="number-pad" maxLength={6}
                />
              </Field>
              <Field label="Address">
                <TextInput
                  style={[s.input, s.inputTextarea]}
                  value={b.address} onChangeText={t => updateBranch(idx, 'address', t)}
                  placeholder="Full address" placeholderTextColor={P.muted3}
                  multiline numberOfLines={2}
                />
              </Field>
              <Field label="Phone">
                <TextInput
                  style={[s.input, { fontFamily: fonts.monoMedium }]}
                  value={b.phone} onChangeText={t => updateBranch(idx, 'phone', t)}
                  placeholder="+91 9876543210" placeholderTextColor={P.muted3}
                  keyboardType="phone-pad"
                />
              </Field>
              <Field label="Google Maps URL">
                <TextInput
                  style={[s.input, { fontFamily: fonts.monoMedium, fontSize: 11.5 }]}
                  value={b.google_maps_url} onChangeText={t => updateBranch(idx, 'google_maps_url', t)}
                  placeholder="Paste Google Maps link" placeholderTextColor={P.muted3}
                  autoCapitalize="none" keyboardType="url"
                />
              </Field>
            </View>
          ))}
        </View>

        <TouchableOpacity style={[s.saveBtn, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving} activeOpacity={0.85}>
          {saving ? <ActivityIndicator color={P.ink} /> : <Text style={s.saveBtnText}>Save Changes</Text>}
        </TouchableOpacity>

        <View style={s.card}>
          <Text style={s.cardTitle}>Other</Text>
          <TouchableOpacity style={s.linkRow} onPress={() => openWebDashboard('/dashboard')}>
            <Text style={s.linkIcon}>[W]</Text>
            <Text style={s.linkLabel}>Open Web Dashboard</Text>
            <Text style={s.linkArrow}>›</Text>
          </TouchableOpacity>
          <Text style={s.hintSubtle}>For campaign creation and product/menu management.</Text>
          <TouchableOpacity style={s.linkRow} onPress={() => navigation.navigate('Notifications')}>
            <Text style={s.linkIcon}>[N]</Text>
            <Text style={s.linkLabel}>Notifications</Text>
            <Text style={s.linkArrow}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.linkRow} onPress={() => navigation.navigate('MediaGallery')}>
            <Text style={s.linkIcon}>[G]</Text>
            <Text style={s.linkLabel}>Media Gallery</Text>
            <Text style={s.linkArrow}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.linkRow, s.linkRowLast]} onPress={() => navigation.navigate('ProposalInbox')}>
            <Text style={s.linkIcon}>[P]</Text>
            <Text style={s.linkLabel}>Influencer Proposals</Text>
            <Text style={s.linkArrow}>›</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={s.logoutBtn} onPress={logout} activeOpacity={0.85}>
          <Text style={s.logoutText}>Logout</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({ label, hint, children }) {
  return (
    <View style={s.field}>
      <Text style={s.fieldLabel}>{label}</Text>
      {children}
      {hint ? <Text style={s.fieldHint}>{hint}</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: P.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  loadingText: { fontFamily: fonts.sansMedium, fontSize: 13, color: P.muted, textAlign: 'center' },

  hero: { backgroundColor: P.ink, padding: 20, paddingTop: 52, alignItems: 'center' },
  avatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: P.yellow, alignItems: 'center', justifyContent: 'center', marginBottom: 11 },
  avatarText: { fontFamily: fonts.displayBold, fontSize: 24, fontWeight: '900', color: P.ink },
  brandName: { fontFamily: fonts.displayBold, fontSize: 20, fontWeight: '800', color: P.white, marginBottom: 8, letterSpacing: -0.3 },

  statusBanner: { margin: 14, marginBottom: 0, padding: 12, borderRadius: 12, borderWidth: 1 },
  statusBannerWarn: { backgroundColor: P.yellowPale, borderColor: P.yellow },
  statusBannerError: { backgroundColor: P.dangerPale, borderColor: P.dangerPale },
  statusBannerTitle: { fontFamily: fonts.displayBold, fontSize: 12.5, fontWeight: '800', marginBottom: 3 },
  statusBannerBody: { fontFamily: fonts.sansMedium, fontSize: 11, lineHeight: 16 },
  statusBannerWarnText: { color: P.yellowText },
  statusBannerErrorText: { color: P.dangerText },

  card: { margin: 14, marginBottom: 0, backgroundColor: P.white, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: P.border },
  cardTitle: { fontFamily: fonts.displayBold, fontSize: 13, fontWeight: '800', color: P.ink, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 11 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 11 },
  primaryChip: { fontFamily: fonts.monoBold, backgroundColor: P.successPale, color: P.successText, fontSize: 9, fontWeight: '800', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, overflow: 'hidden', letterSpacing: 0.3 },

  field: { marginBottom: 11 },
  fieldLabel: { fontFamily: fonts.monoBold, fontSize: 9.5, fontWeight: '800', color: P.muted, marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.4 },
  fieldHint: { fontFamily: fonts.sansMedium, fontSize: 9.5, color: P.muted2, marginTop: 4 },
  input: { fontFamily: fonts.sansMedium, borderWidth: 1.5, borderColor: P.border, backgroundColor: P.white, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, fontSize: 12.5, color: P.ink, minHeight: 38 },
  inputReadOnly: { backgroundColor: P.bg2, color: P.muted3 },
  inputTextarea: { minHeight: 68, textAlignVertical: 'top' },

  addBranchBtn: { borderWidth: 1, borderColor: P.yellow, borderRadius: 99, paddingHorizontal: 11, paddingVertical: 5 },
  addBranchBtnText: { fontFamily: fonts.sansBold, fontSize: 10.5, fontWeight: '800', color: P.yellowText },
  branchBox: { borderWidth: 1, borderColor: P.border, borderRadius: 12, padding: 11, marginBottom: 10, backgroundColor: P.bg },
  branchHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 9 },
  branchIndex: { fontFamily: fonts.monoBold, fontSize: 9, fontWeight: '800', color: P.muted2, letterSpacing: 0.4, textTransform: 'uppercase' },
  removeText: { fontFamily: fonts.sansBold, fontSize: 11, color: P.dangerText, fontWeight: '700' },
  emptyText: { fontFamily: fonts.sansMedium, fontSize: 11, color: P.muted2, textAlign: 'center', paddingVertical: 10 },

  saveBtn: { margin: 14, backgroundColor: P.yellow, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  saveBtnText: { fontFamily: fonts.displayBold, fontSize: 14, fontWeight: '800', color: P.ink, letterSpacing: 0.3 },

  linkRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: P.border, gap: 10 },
  linkRowLast: { borderBottomWidth: 0 },
  linkIcon: { fontFamily: fonts.monoBold, fontSize: 10.5, fontWeight: '800', color: P.muted, width: 24 },
  linkLabel: { flex: 1, fontFamily: fonts.sansBold, fontSize: 12.5, fontWeight: '600', color: P.ink },
  linkArrow: { fontFamily: fonts.monoBold, fontSize: 16, color: P.muted3, fontWeight: '800' },
  hintSubtle: { fontFamily: fonts.sansMedium, fontSize: 9.5, color: P.muted2, marginTop: 3, marginLeft: 34, marginBottom: 4 },

  logoutBtn: { margin: 14, borderWidth: 1.5, borderColor: P.dangerPale, borderRadius: 14, paddingVertical: 13, alignItems: 'center', backgroundColor: P.white },
  logoutText: { fontFamily: fonts.sansBold, fontSize: 13, fontWeight: '700', color: P.dangerText },
});
