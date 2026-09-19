import React, { useContext, useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { brandApi, referenceApi } from '../../services/api';
import { AuthContext } from '../../../App';
import OfferedStateCityFields, { MSG_STATE, MSG_CITY } from '../../components/registration/OfferedStateCityFields';

const P = {
  bg:          '#FAFAFA',
  surface:     '#FFFFFF',
  surface2:    '#F4F4F5',
  ink:         '#0A0A0A',
  ink2:        '#18181B',
  muted:       '#52525B',
  muted2:      '#71717A',
  muted3:      '#A1A1AA',
  border:      '#E4E4E7',
  border2:     '#D4D4D8',
  yellow:      '#FFC107',
  yellowPale:  '#FFF7CC',
  yellowText:  '#6B5A00',
  danger:      '#E8401A',
  dangerDeep:  '#B91C1C',
};

const MONO = Platform.OS === 'android' ? 'monospace' : 'Menlo';

// Docs/THE_CUT.md pass 0, founder 2026-09-02: "INFLX is a fashion platform."
// There is exactly one business type, so it is stated rather than chosen. The server is
// the real gate (backend/src/services/businessCategory.model.js); this constant only
// decides what the form SAYS.
const CATEGORY = 'fashion';
const CATEGORY_LABEL = 'Fashion — clothing, footwear, jewellery';
// Item 2 (rules v1.10 §8A, founder Q5b): one or more of the eight sub-categories.
// Required. The server list is the gate; this is the offline fallback.
const SUB_CATEGORIES_FALLBACK = [
  { code: 'MEN', label: 'Men' }, { code: 'WOMEN', label: 'Women' }, { code: 'KIDS', label: 'Kids' },
  { code: 'PLUS_SIZE', label: 'Plus Size' }, { code: 'WATCHES', label: 'Watches' },
  { code: 'IMITATION_JEWELLERY', label: 'Imitation Jewellery' }, { code: 'FOOTWEAR', label: 'Footwear' },
  { code: 'BAGS_ACCESSORIES', label: 'Bags & Accessories' },
];

export const MSG_B1 = {
  NAME: 'Enter your name.',
  BUSINESS: 'Enter your business name.',
  SUBS: 'Pick at least one category you sell.',
  STREET: 'Enter your street address.',
  PINCODE: 'Enter a 6-digit pincode.',
};

/**
 * Brand registration on the phone — B1: seven fields, one screen, all mandatory.
 * Your name · Business name · Business type (stated: Fashion) · What do you sell? ·
 * Street address · Pincode · State · Nearest major city.
 *
 * Gone (spec §2.2, §9): the Google place search, the Maps-link box, coordinate capture and
 * the referral code. State and city are ids from the offered lists, never typed names, so
 * there is no longer any path that writes an unresolved city. On success the brand enters
 * the app as a pending account (the pending home says "under review").
 * Contract: features/registration-and-profile
 */
export default function BrandRegisterScreen({ navigation }) {
  const { setRole: setAppRole } = useContext(AuthContext);
  const [fullName, setFullName]         = useState('');
  const [businessName, setBusinessName] = useState('');
  const [subCategories, setSubCategories] = useState([]);
  const [subCategoryOptions, setSubCategoryOptions] = useState(SUB_CATEGORIES_FALLBACK);
  const [street, setStreet]             = useState('');
  const [pincode, setPincode]           = useState('');
  const [stateId, setStateId]           = useState(null);
  const [cityId, setCityId]             = useState(null);
  const [fieldErr, setFieldErr]         = useState({});
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState('');

  useEffect(() => {
    referenceApi.brandCategories().then(r => { if (r && r.success && r.data.items?.length) setSubCategoryOptions(r.data.items); }).catch(() => {});
  }, []);

  function toggleSubCategory(code) {
    setSubCategories(prev => prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]);
    setFieldErr(e => ({ ...e, subs: '' }));
  }
  const clear = (k) => setFieldErr(e => ({ ...e, [k]: '' }));

  function validate() {
    const errs = {};
    if (!fullName.trim()) errs.name = MSG_B1.NAME;
    if (!businessName.trim()) errs.business = MSG_B1.BUSINESS;
    if (subCategories.length === 0) errs.subs = MSG_B1.SUBS;
    if (!street.trim()) errs.street = MSG_B1.STREET;
    if (!/^[0-9]{6}$/.test(pincode.trim())) errs.pincode = MSG_B1.PINCODE;
    if (stateId == null) errs.state = MSG_STATE;
    if (cityId == null) errs.city = MSG_CITY;
    return errs;
  }

  async function handleRegister() {
    setError('');
    const errs = validate();
    setFieldErr(errs);
    if (Object.keys(errs).length) return;

    setLoading(true);
    const body = {
      name:           fullName.trim(),
      business_name:  businessName.trim(),
      sub_categories: subCategories,
      address_line:   street.trim(),
      pincode:        pincode.trim(),
      state_id:       stateId,
      city_id:        cityId,
    };
    const res = await brandApi.register(body);
    setLoading(false);
    if (!res.success) {
      const map = { name: 'name', business_name: 'business', sub_categories: 'subs', address_line: 'street', pincode: 'pincode', city_id: 'city', state_id: 'state' };
      const k = map[res.error?.field];
      if (k) setFieldErr({ [k]: res.error.message });
      else setError(res.error?.message || 'Registration failed');
      return;
    }
    // Pending accounts enter the app now (spec §6.5); the Waiting screen is retired.
    setAppRole('brand');
  }

  const allValid = Object.keys(validate()).length === 0;
  const canSubmit = allValid && !loading;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: P.bg }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Set up your business</Text>
        <Text style={styles.lede}>Reviewed by our team, usually within 24 hours.</Text>

        <Text style={styles.label}>Your name <Text style={styles.req}>*</Text></Text>
        <TextInput style={[styles.input, fieldErr.name && styles.inputError]} value={fullName} onChangeText={(t) => { setFullName(t); clear('name'); }}
          placeholder="Your full name" placeholderTextColor={P.muted3} autoCorrect={false} testID="reg-name" />
        {fieldErr.name ? <Text style={styles.fieldError} testID="err-name">{fieldErr.name}</Text> : null}

        <Text style={styles.label}>Business name <Text style={styles.req}>*</Text></Text>
        <TextInput style={[styles.input, fieldErr.business && styles.inputError]} value={businessName} onChangeText={(t) => { setBusinessName(t); clear('business'); }}
          placeholder="e.g. Label Fern" placeholderTextColor={P.muted3} autoCorrect={false} testID="reg-business" />
        {fieldErr.business ? <Text style={styles.fieldError} testID="err-business">{fieldErr.business}</Text> : null}

        {/* Docs/THE_CUT.md pass 0 — one business type, so it is stated rather than chosen. */}
        <Text style={styles.label}>Business type</Text>
        <View style={styles.fixedType} testID="reg-business-type">
          <Text style={styles.fixedTypeT}>{CATEGORY_LABEL}</Text>
        </View>

        <Text style={styles.label}>What do you sell? <Text style={styles.req}>*</Text></Text>
        <View style={styles.chipWrap}>
          {subCategoryOptions.map(opt => {
            const on = subCategories.includes(opt.code);
            return (
              <TouchableOpacity key={opt.code} testID={`sub-${opt.code}`} style={[styles.chip, on && styles.chipOnInk]} onPress={() => toggleSubCategory(opt.code)} accessibilityRole="button" accessibilityState={{ selected: !!on }}>
                <Text style={[styles.chipTxt, on && styles.chipTxtOnInk]}>{on ? '✓ ' : ''}{opt.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        {fieldErr.subs ? <Text style={styles.fieldError} testID="err-subs">{fieldErr.subs}</Text> : null}

        <Text style={styles.label}>Street address <Text style={styles.req}>*</Text></Text>
        <TextInput style={[styles.input, styles.multi, fieldErr.street && styles.inputError]} value={street} onChangeText={(t) => { setStreet(t); clear('street'); }}
          placeholder="Shop no., street, area" placeholderTextColor={P.muted3} autoCorrect={false} multiline testID="reg-street" />
        {fieldErr.street ? <Text style={styles.fieldError} testID="err-street">{fieldErr.street}</Text> : null}

        <View style={{ height: 14 }} />
        <OfferedStateCityFields
          stateId={stateId}
          cityId={cityId}
          onChange={({ stateId: s, cityId: c }) => { setStateId(s); setCityId(c); setFieldErr(e => ({ ...e, state: '', city: '' })); }}
          errors={{ state: fieldErr.state, city: fieldErr.city }}
          testIDPrefix="reg"
          cityLabel="Nearest major city"
          cityHint="The closest big city — not your exact area."
          labelStyle={styles.pickerLabel}
          fieldStyle={styles.pickerField}
          hintStyle={styles.hint}
          placeholderColor={P.muted2}
          beside={(
            <View>
              <Text style={[styles.label, { marginTop: 0 }]}>Pincode <Text style={styles.req}>*</Text></Text>
              <TextInput style={[styles.input, { fontFamily: MONO, marginBottom: 0 }, fieldErr.pincode && styles.inputError]} value={pincode}
                onChangeText={t => { setPincode(t.replace(/\D/g, '').slice(0, 6)); clear('pincode'); }}
                placeholder="6 digits" placeholderTextColor={P.muted3} keyboardType="number-pad" maxLength={6} testID="reg-pincode" />
              {fieldErr.pincode ? <Text style={[styles.fieldError, { marginTop: 6 }]} testID="err-pincode">{fieldErr.pincode}</Text> : null}
            </View>
          )}
        />

        {!!error && (
          <View style={styles.errorBox} testID="reg-error"><Text style={styles.errorTxt}>{error}</Text></View>
        )}

        <TouchableOpacity style={[styles.btn, !canSubmit && styles.btnOff]} disabled={!canSubmit} onPress={handleRegister} testID="reg-submit" accessibilityRole="button" accessibilityState={{ disabled: !canSubmit }}>
          <Text style={styles.btnTxt}>{loading ? 'Creating…' : 'Create business account'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll:     { padding: 24, paddingTop: 64, paddingBottom: 48 },
  title:      { fontSize: 24, fontWeight: '800', color: P.ink, marginBottom: 6 },
  lede:       { fontSize: 13.5, color: P.muted, lineHeight: 19, marginBottom: 22 },
  label:      { fontSize: 12, fontWeight: '700', color: P.ink2, marginBottom: 6, marginTop: 14, textTransform: 'uppercase', letterSpacing: 0.4 },
  pickerLabel:{ fontSize: 12, fontWeight: '700', color: P.ink2, marginBottom: 6, marginTop: 0, textTransform: 'uppercase', letterSpacing: 0.4, fontFamily: undefined },
  pickerField:{ backgroundColor: P.surface, borderWidth: 1, borderColor: P.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12 },
  req:        { color: P.danger },
  hint:       { fontSize: 11.5, color: P.muted2, marginTop: 6, lineHeight: 16 },
  input:      { backgroundColor: P.surface, borderWidth: 1, borderColor: P.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: P.ink2, justifyContent: 'center' },
  inputError: { borderColor: P.danger },
  multi:      { minHeight: 76, textAlignVertical: 'top' },
  fieldError: { fontSize: 12, color: P.dangerDeep, fontWeight: '600', marginTop: 6 },
  chipWrap:   { flexDirection: 'row', flexWrap: 'wrap' },
  // Docs/THE_CUT.md pass 0 — the stated (not chosen) business type.
  fixedType:  { borderWidth: 1, borderColor: P.border, backgroundColor: P.surface2, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11 },
  fixedTypeT: { fontSize: 13.5, fontWeight: '700', color: P.ink2 },
  chip:       { backgroundColor: P.surface, borderWidth: 1, borderColor: P.border2, borderRadius: 18, paddingHorizontal: 12, paddingVertical: 7, marginRight: 8, marginBottom: 8 },
  chipTxt:    { fontSize: 12.5, color: P.muted, fontWeight: '600' },
  chipOnInk:  { backgroundColor: P.ink, borderColor: P.ink },
  chipTxtOnInk: { color: '#FFFFFF' },
  errorBox:   { backgroundColor: '#FDEEE9', borderWidth: 1, borderColor: 'rgba(232,64,26,0.2)', borderRadius: 10, padding: 12, marginTop: 16 },
  errorTxt:   { color: P.dangerDeep, fontSize: 12.5, fontWeight: '600' },
  btn:        { backgroundColor: P.yellow, borderRadius: 12, paddingVertical: 15, alignItems: 'center', marginTop: 24 },
  btnOff:     { opacity: 0.45 },
  btnTxt:     { color: P.ink, fontSize: 15, fontWeight: '800' },
});
