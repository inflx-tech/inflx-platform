/**
 * PaymentTaxScreen — the creator's Payment & tax card, moved from the old inline profile
 * onto its own screen behind the Profile row (founder's item-3 decision). Same content and
 * the same rules: UPI or bank account (not both), IFSC required with an account, PAN, and
 * the TDS note. Contract: features/item3-discovery-profiles-groups
 */
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { settingsTokens as T, fonts } from '../../theme/tokens';
import { influencerApi } from '../../services/api';
import { InfoBox, PrimaryButton, SecondaryButton } from '../../components/settings/primitives';
import { Skeleton, LoadError } from '../../components/settings/feedback';
import { Header, s as base } from '../brand/BrandPitchSettingsScreen';
import { C3 } from '../../components/discovery/copy3';

function ReadOnlyRow({ label, value }) {
  return (
    <View style={s.roRow}>
      <Text style={s.roLabel}>{label}</Text>
      <Text style={s.roValue}>{value || '--'}</Text>
    </View>
  );
}

export default function PaymentTaxScreen({ navigation }) {
  const [status, setStatus] = useState('loading');
  const [profile, setProfile] = useState(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [upiId, setUpiId] = useState('');
  const [bankAccount, setBankAccount] = useState('');
  const [bankIfsc, setBankIfsc] = useState('');
  const [panNumber, setPanNumber] = useState('');

  const load = useCallback(async () => {
    setStatus('loading');
    const res = await influencerApi.getMe();
    if (!res.success) { setStatus('error'); return; }
    setProfile(res.data?.influencer || res.data);
    setStatus('ready');
  }, []);
  useEffect(() => { load(); }, [load]);

  function cancelEdit() {
    setUpiId(''); setBankAccount(''); setBankIfsc(''); setPanNumber('');
    setEditing(false);
  }

  // Ported verbatim from the old ProfileScreen.saveBank — the rules are unchanged.
  async function saveBank() {
    if (upiId && bankAccount) {
      Alert.alert('Choose one', 'Please provide either UPI ID or Bank Account, not both.');
      return;
    }
    if (!upiId.trim() && !bankAccount.trim() && !panNumber.trim()) {
      setEditing(false);
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
      setEditing(false);
      setUpiId(''); setBankAccount(''); setBankIfsc(''); setPanNumber('');
      Alert.alert('Saved', 'Payment details updated.');
    } else {
      Alert.alert('Failed', res.error?.message || 'Update failed');
    }
  }

  const title = C3.creatorProfile.payment.title;
  if (status === 'loading') return <View style={base.screen}><Header title={title} onBack={() => navigation.goBack()} /><Skeleton rows={4} /></View>;
  if (status === 'error') return <View style={base.screen}><Header title={title} onBack={() => navigation.goBack()} /><LoadError onRetry={load} /></View>;

  return (
    <View style={base.screen} testID="payment-tax">
      <Header title={title} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={base.body} keyboardShouldPersistTaps="handled">
        <View style={s.cardHeader}>
          <Text style={s.cardTitle}>Payout Settings</Text>
          {!editing ? (
            <TouchableOpacity onPress={() => setEditing(true)} style={s.smallBtn} testID="payout-edit"><Text style={s.smallBtnText}>{profile?.has_payout_method ? 'UPDATE' : 'ADD'}</Text></TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={cancelEdit} style={s.smallBtn} testID="payout-cancel"><Text style={s.smallBtnText}>CANCEL</Text></TouchableOpacity>
          )}
        </View>

        {editing ? (
          <>
            <Text style={s.fieldLabel}>UPI ID (PREFERRED)</Text>
            <TextInput style={s.input} value={upiId} onChangeText={setUpiId} placeholder="yourname@upi" placeholderTextColor={T.ink3} autoCapitalize="none" keyboardType="email-address" testID="upi" />
            <Text style={s.orDivider}>— OR BANK ACCOUNT —</Text>
            <Text style={s.fieldLabel}>ACCOUNT NUMBER</Text>
            <TextInput style={s.input} value={bankAccount} onChangeText={setBankAccount} placeholder="Bank account number" placeholderTextColor={T.ink3} keyboardType="number-pad" secureTextEntry testID="bank-account" />
            <Text style={s.fieldLabel}>IFSC CODE</Text>
            <TextInput style={s.input} value={bankIfsc} onChangeText={setBankIfsc} placeholder="SBIN0001234" placeholderTextColor={T.ink3} autoCapitalize="characters" testID="bank-ifsc" />
            <Text style={s.orDivider}>— TAX INFO —</Text>
            <Text style={s.fieldLabel}>PAN NUMBER</Text>
            <TextInput style={s.input} value={panNumber} onChangeText={setPanNumber} placeholder="ABCDE1234F" placeholderTextColor={T.ink3} autoCapitalize="characters" maxLength={10} testID="pan" />
            <InfoBox text="SECURE: Bank details and PAN are encrypted with AES-256 before storage. We never store or display your details in plain text. Used only for processing withdrawals and TDS compliance." />
            <View style={{ height: 14 }} />
            <PrimaryButton label="SAVE PAYMENT DETAILS" onPress={saveBank} busy={saving} testID="payout-save" />
            <SecondaryButton label="Cancel" onPress={cancelEdit} />
          </>
        ) : (
          <>
            <ReadOnlyRow label="UPI" value={profile?.has_upi ? 'On file (encrypted)' : 'Not configured'} />
            <ReadOnlyRow label="Bank Account" value={profile?.has_bank_account ? 'On file (encrypted)' : 'Not configured'} />
            <ReadOnlyRow label="IFSC" value={profile?.bank_ifsc || (profile?.has_bank_account ? 'On file' : 'Not configured')} />
            <ReadOnlyRow label="PAN" value={profile?.has_pan ? 'On file (encrypted)' : 'Not configured'} />
            <InfoBox text="TDS at 10% is deducted on withdrawals as per Indian tax regulations. Minimum withdrawal: ₹100." />
          </>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  cardTitle: { fontFamily: fonts.sansBold, fontSize: 15, color: T.ink },
  smallBtn: { borderWidth: 1, borderColor: T.border, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  smallBtnText: { fontFamily: fonts.sansBold, fontSize: 11.5, color: T.ink },
  fieldLabel: { fontFamily: fonts.sansSemiBold, fontSize: 11.5, color: T.ink2, marginTop: 12, marginBottom: 6, letterSpacing: 0.4 },
  input: { fontFamily: fonts.sansMedium, fontSize: 15, color: T.ink, borderWidth: 1, borderColor: T.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11 },
  orDivider: { fontFamily: fonts.sansSemiBold, fontSize: 11, color: T.ink3, textAlign: 'center', marginTop: 16, letterSpacing: 0.6 },
  roRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: T.border },
  roLabel: { fontFamily: fonts.sansMedium, fontSize: 14, color: T.ink2 },
  roValue: { fontFamily: fonts.sansSemiBold, fontSize: 14, color: T.ink },
});
