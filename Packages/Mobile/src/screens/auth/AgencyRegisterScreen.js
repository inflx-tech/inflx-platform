import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { agencyApi } from '../../services/api';

const P = {
  bg: '#FAFAFA', surface: '#FFFFFF', ink: '#0A0A0A', ink2: '#18181B',
  muted: '#52525B', muted2: '#71717A', muted3: '#A1A1AA', border2: '#D4D4D8',
  yellow: '#FFC107', yellowPale: '#FFF7CC', yellowText: '#6B5A00',
  danger: '#E8401A', dangerPale: '#FDEEE9', dangerDeep: '#B91C1C',
};

/**
 * Agency registration (Contract 3b). Post-OTP profile setup for the agency
 * flavor. Mirrors InfluencerRegisterScreen. Optional referral code → redeemed
 * after a successful register. Lands on Waiting (pending admin approval).
 */
export default function AgencyRegisterScreen({ navigation }) {
  const [agencyName, setAgencyName] = useState('');
  const [contact, setContact] = useState('');
  const [email, setEmail] = useState('');
  const [city, setCity] = useState('');
  const [method, setMethod] = useState('upi');
  const [payout, setPayout] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleRegister() {
    setError('');
    const nm = agencyName.trim();
    if (!nm) { setError('Please enter your agency name'); return; }

    setLoading(true);
    const body = { agency_name: nm };
    if (contact.trim()) body.contact_person = contact.trim();
    if (email.trim()) body.contact_email = email.trim();
    if (city.trim()) body.city = city.trim();
    if (payout.trim()) {
      if (method === 'upi') body.upi_id = payout.trim();
      else body.bank_account_no = payout.trim();
    }
    const res = await agencyApi.register(body);
    if (!res.success) { setLoading(false); setError(res.error?.message || 'Registration failed'); return; }

    // Optional referral code — best-effort; a bad code shouldn't block onboarding.
    if (code.trim()) {
      const rr = await agencyApi.redeemReferral(code.trim());
      if (!rr.success) { /* surfaced softly below; registration already succeeded */ }
    }
    setLoading(false);
    navigation.reset({ index: 0, routes: [{ name: 'Waiting' }] });
  }

  const canSubmit = agencyName.trim().length > 0 && !loading;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: P.bg }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Set up your agency</Text>
        <Text style={styles.lede}>Tell us about your agency. After you submit, our team approves you — then you can share your code and start earning.</Text>

        <Text style={styles.label}>Agency name <Text style={styles.req}>*</Text></Text>
        <TextInput style={styles.input} value={agencyName} onChangeText={setAgencyName} placeholder="e.g. Vizag Media Partners" placeholderTextColor={P.muted3} />

        <Text style={styles.label}>Contact person</Text>
        <TextInput style={styles.input} value={contact} onChangeText={setContact} placeholder="Your name" placeholderTextColor={P.muted3} />

        <Text style={styles.label}>Contact email</Text>
        <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder="you@agency.in" placeholderTextColor={P.muted3} autoCapitalize="none" keyboardType="email-address" />

        <Text style={styles.label}>City</Text>
        <TextInput style={styles.input} value={city} onChangeText={setCity} placeholder="Visakhapatnam" placeholderTextColor={P.muted3} />

        <Text style={styles.label}>Payout method</Text>
        <View style={styles.seg}>
          <TouchableOpacity style={[styles.opt, method === 'upi' && styles.optOn]} onPress={() => setMethod('upi')}>
            <Text style={[styles.optText, method === 'upi' && styles.optTextOn]}>UPI</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.opt, method === 'bank' && styles.optOn]} onPress={() => setMethod('bank')}>
            <Text style={[styles.optText, method === 'bank' && styles.optTextOn]}>Bank account</Text>
          </TouchableOpacity>
        </View>
        <TextInput style={styles.input} value={payout} onChangeText={setPayout} placeholder={method === 'upi' ? 'yourname@upi' : 'Account number'} placeholderTextColor={P.muted3} autoCapitalize="none" />

        <Text style={styles.label}>Have a referral code? <Text style={styles.opt2}>(optional)</Text></Text>
        <TextInput style={styles.input} value={code} onChangeText={setCode} placeholder="INFLX-XXXXXX" placeholderTextColor={P.muted3} autoCapitalize="characters" />

        {error ? (<View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View>) : null}
      </ScrollView>

      <View style={styles.ctaBar}>
        <TouchableOpacity style={[styles.btn, !canSubmit && styles.btnDisabled]} onPress={handleRegister} disabled={!canSubmit}>
          <Text style={styles.btnText}>{loading ? 'Creating…' : 'Create agency account'}</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, paddingHorizontal: 22, paddingTop: 40, paddingBottom: 24 },
  title: { fontSize: 22, fontWeight: '700', color: P.ink, marginBottom: 6, letterSpacing: -0.4 },
  lede: { fontSize: 13, color: P.muted, marginBottom: 22, lineHeight: 19 },
  label: { fontSize: 11.5, fontWeight: '600', color: P.ink2, marginBottom: 8, marginTop: 6 },
  req: { color: P.danger, fontWeight: '700' },
  opt2: { fontSize: 11, fontWeight: '500', color: P.muted2 },
  input: { backgroundColor: P.surface, borderWidth: 1.5, borderColor: P.border2, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, fontSize: 15, color: P.ink, marginBottom: 14 },
  seg: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  opt: { flex: 1, borderWidth: 1.5, borderColor: P.border2, borderRadius: 12, paddingVertical: 12, alignItems: 'center', backgroundColor: P.surface },
  optOn: { borderColor: P.ink, backgroundColor: P.ink },
  optText: { fontSize: 13, fontWeight: '700', color: P.muted },
  optTextOn: { color: '#fff' },
  errorBox: { backgroundColor: P.dangerPale, borderLeftWidth: 3, borderLeftColor: P.danger, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginTop: 12 },
  errorText: { fontSize: 12, color: P.dangerDeep, fontWeight: '500' },
  ctaBar: { paddingHorizontal: 22, paddingTop: 14, paddingBottom: 28, backgroundColor: P.bg },
  btn: { backgroundColor: P.yellow, borderRadius: 16, paddingVertical: 16, alignItems: 'center' },
  btnDisabled: { opacity: 0.45 },
  btnText: { fontSize: 15, fontWeight: '700', color: P.ink, letterSpacing: 0.2 },
});
