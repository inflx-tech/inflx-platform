import React, { useState, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Modal, FlatList, ActivityIndicator } from 'react-native';
import { brandApi, followerApi, referenceApi } from '../../services/api';

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
  green:       '#16A34A',
  greenPale:   '#EAF7EF',
};

const MONO = Platform.OS === 'android' ? 'monospace' : 'Menlo';

// Docs/THE_CUT.md pass 0, founder 2026-09-02: "INFLX is a fashion platform."
//
// This screen used to offer 30 business types across 9 industries. There is now
// exactly one, so the industry -> type chip picker is gone with it: two rows of
// chips offering one choice each is worse than a plain statement. The server is
// the real gate (backend/src/services/businessCategory.model.js); this constant
// only decides what the form SAYS.
const CATEGORY = 'fashion';
const CATEGORY_LABEL = 'Fashion — clothing, footwear, jewellery & accessories';
// Item 2 (rules v1.10 §8A, founder Q5b): after Fashion, one or more of the eight
// sub-categories. Required. The server list is the gate; this is the offline fallback.
const SUB_CATEGORIES_FALLBACK = [
  { code: 'MEN', label: 'Men' }, { code: 'WOMEN', label: 'Women' }, { code: 'KIDS', label: 'Kids' },
  { code: 'PLUS_SIZE', label: 'Plus Size' }, { code: 'WATCHES', label: 'Watches' },
  { code: 'IMITATION_JEWELLERY', label: 'Imitation Jewellery' }, { code: 'FOOTWEAR', label: 'Footwear' },
  { code: 'BAGS_ACCESSORIES', label: 'Bags & Accessories' },
];

const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand',
  'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur',
  'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab',
  'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
  'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Andaman & Nicobar', 'Chandigarh', 'Dadra & Nagar Haveli and Daman & Diu',
  'Delhi', 'Jammu & Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry',
];

/**
 * Brand registration on mobile (contract: features/brand-mobile-register).
 * Mirrors the brand-web register step: name + business name + industry →
 * business type + location. Location autofills from place search (same
 * Places proxy the follower address flow uses); every field stays editable;
 * manual typing works without search. On success → Waiting (admin review).
 */
export default function BrandRegisterScreen({ navigation }) {
  const [fullName, setFullName]         = useState('');
  const [businessName, setBusinessName] = useState('');
  // Docs/THE_CUT.md pass 0 — no longer chosen, so it is a constant rather than state.
  const category = CATEGORY;
  const [subCategories, setSubCategories] = useState([]);
  const [subCategoryOptions, setSubCategoryOptions] = useState(SUB_CATEGORIES_FALLBACK);
  React.useEffect(() => {
    referenceApi.brandCategories().then(r => { if (r.success && r.data.items?.length) setSubCategoryOptions(r.data.items); }).catch(() => {});
  }, []);
  function toggleSubCategory(code) {
    setSubCategories(prev => prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]);
  }
  const [addressLine, setAddressLine]   = useState('');
  const [city, setCity]                 = useState('');
  const [stateField, setStateField]     = useState('');
  const [pincode, setPincode]           = useState('');
  const [stateModal, setStateModal]     = useState(false);
  // Place search
  const [query, setQuery]               = useState('');
  const [suggestions, setSuggestions]   = useState([]);
  const [searching, setSearching]       = useState(false);
  const [coords, setCoords]             = useState(null); // { lat, lng, locality, formatted_address }
  const debounceRef = useRef(null);
  const sessionRef  = useRef(Math.random().toString(36).slice(2));
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState('');


  function onQueryChange(t) {
    setQuery(t);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (t.trim().length < 3) { setSuggestions([]); return; }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      const res = await followerApi.placesAutocomplete(t.trim(), { session: sessionRef.current });
      setSearching(false);
      setSuggestions(res.success ? (res.data?.predictions || []) : []);
    }, 350);
  }

  async function pickSuggestion(pr) {
    setSuggestions([]);
    setQuery(pr.main || pr.description);
    setSearching(true);
    const res = await followerApi.placeDetails(pr.place_id, sessionRef.current);
    setSearching(false);
    if (!res.success || !res.data) return;
    const d = res.data;
    setCoords({ lat: d.lat, lng: d.lng, locality: d.area_name || null, formatted_address: d.formatted_address || null });
    if (d.formatted_address) setAddressLine(d.formatted_address);
    if (d.city) setCity(d.city);
    if (d.state && INDIAN_STATES.includes(d.state)) setStateField(d.state);
    if (d.pincode && /^[0-9]{6}$/.test(String(d.pincode))) setPincode(String(d.pincode));
  }

  async function handleRegister() {
    setError('');
    if (!fullName.trim())      { setError('Please enter your name'); return; }
    if (!businessName.trim())  { setError('Please enter your business name'); return; }
    if (subCategories.length === 0) { setError('Pick at least one category your brand sells'); return; }
    if (!addressLine.trim())   { setError('Please enter your business address'); return; }
    if (!city.trim())          { setError('Please enter your city'); return; }
    if (!stateField)           { setError('Please select your state'); return; }
    if (!/^[0-9]{6}$/.test(pincode.trim())) { setError('Pincode must be 6 digits'); return; }

    setLoading(true);
    const body = {
      name:          fullName.trim(),
      business_name: businessName.trim(),
      category,
      sub_categories: subCategories,
      address_line:  addressLine.trim(),
      city:          city.trim(),
      state:         stateField,
      pincode:       pincode.trim(),
    };
    if (coords && coords.lat != null && coords.lng != null) {
      body.latitude  = coords.lat;
      body.longitude = coords.lng;
      if (coords.locality)          body.locality = coords.locality;
      if (coords.formatted_address) body.formatted_address = coords.formatted_address;
    }
    const res = await brandApi.register(body);
    setLoading(false);
    if (!res.success) { setError(res.error?.message || 'Registration failed'); return; }
    navigation.reset({ index: 0, routes: [{ name: 'Waiting' }] });
  }

  const canSubmit = fullName.trim() && businessName.trim() && category && subCategories.length > 0 &&
    addressLine.trim() && city.trim() && stateField && pincode.length === 6 && !loading;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: P.bg }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Set up your business</Text>
        <Text style={styles.lede}>A few details so customers and creators can find you. Reviewed by our team within 24 hours.</Text>

        <Text style={styles.label}>Your name <Text style={styles.req}>*</Text></Text>
        <TextInput style={styles.input} value={fullName} onChangeText={setFullName}
          placeholder="Your full name" placeholderTextColor={P.muted3} autoCorrect={false} />

        <Text style={styles.label}>Business name <Text style={styles.req}>*</Text></Text>
        <TextInput style={styles.input} value={businessName} onChangeText={setBusinessName}
          placeholder="e.g. Label Fern" placeholderTextColor={P.muted3} autoCorrect={false} />

        {/* Docs/THE_CUT.md pass 0 — one business type, so it is stated rather than
            chosen. Said plainly so an owner of a different kind of business finds out
            here, on the form, and not after building a catalogue nobody can reach. */}
        <Text style={styles.label}>Business type</Text>
        <View style={styles.fixedType}>
          <Text style={styles.fixedTypeT}>{CATEGORY_LABEL}</Text>
          <Text style={styles.fixedTypeS}>
            INFLX is a fashion platform. Other kinds of business are not supported yet.
          </Text>
        </View>

        {/* Item 2 — what the brand sells, from the eight fashion sub-categories. Required:
            creators filter the brands that may invite them by these. */}
        <Text style={styles.label}>What you sell <Text style={styles.req}>*</Text></Text>
        <View style={styles.chipWrap}>
          {subCategoryOptions.map(opt => {
            const on = subCategories.includes(opt.code);
            return (
              <TouchableOpacity key={opt.code} testID={`sub-${opt.code}`} style={[styles.chip, on && styles.chipOnInk]} onPress={() => toggleSubCategory(opt.code)}>
                <Text style={[styles.chipTxt, on && styles.chipTxtOnInk]}>{on ? '✓ ' : ''}{opt.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <Text style={styles.footnoteLeft}>Pick every category you sell. You can change this later in Business details.</Text>

        <View style={styles.divider} />
        <Text style={styles.section}>LOCATION</Text>

        <Text style={styles.label}>Find your place <Text style={styles.opt}>(auto-fills the address)</Text></Text>
        <View>
          <TextInput style={styles.input} value={query} onChangeText={onQueryChange}
            placeholder="Search shop name or area…" placeholderTextColor={P.muted3}
            autoCorrect={false} autoCapitalize="none" />
          {searching && <ActivityIndicator size="small" color={P.muted2} style={styles.spinner} />}
          {suggestions.length > 0 && (
            <View style={styles.suggestBox}>
              {suggestions.slice(0, 5).map(pr => (
                <TouchableOpacity key={pr.place_id} style={styles.suggestRow} onPress={() => pickSuggestion(pr)}>
                  <Text style={styles.suggestMain} numberOfLines={1}>{pr.main}</Text>
                  {!!pr.secondary && <Text style={styles.suggestSec} numberOfLines={1}>{pr.secondary}</Text>}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
        {coords && (
          <View style={styles.locBadge}>
            <Text style={styles.locBadgeTxt}>✓ Location captured{coords.locality ? ` — ${coords.locality}` : ''}</Text>
          </View>
        )}

        <Text style={styles.label}>Business address <Text style={styles.req}>*</Text></Text>
        <TextInput style={styles.input} value={addressLine} onChangeText={setAddressLine}
          placeholder="Building, street, area" placeholderTextColor={P.muted3} autoCorrect={false} />

        <View style={styles.row2}>
          <View style={{ flex: 1, marginRight: 8 }}>
            <Text style={styles.label}>City <Text style={styles.req}>*</Text></Text>
            <TextInput style={styles.input} value={city} onChangeText={setCity}
              placeholder="e.g. Vijayawada" placeholderTextColor={P.muted3} autoCorrect={false} />
          </View>
          <View style={{ flex: 1, marginLeft: 8 }}>
            <Text style={styles.label}>Pincode <Text style={styles.req}>*</Text></Text>
            <TextInput style={[styles.input, { fontFamily: MONO }]} value={pincode}
              onChangeText={t => setPincode(t.replace(/\D/g, '').slice(0, 6))}
              placeholder="6-digit" placeholderTextColor={P.muted3} keyboardType="number-pad" maxLength={6} />
          </View>
        </View>

        <Text style={styles.label}>State <Text style={styles.req}>*</Text></Text>
        <TouchableOpacity style={styles.input} onPress={() => setStateModal(true)}>
          <Text style={{ color: stateField ? P.ink2 : P.muted3, fontSize: 14 }}>
            {stateField || 'Select your state'}
          </Text>
        </TouchableOpacity>

        {!!error && (
          <View style={styles.errorBox}><Text style={styles.errorTxt}>{error}</Text></View>
        )}

        <TouchableOpacity style={[styles.btn, !canSubmit && styles.btnOff]} disabled={!canSubmit} onPress={handleRegister}>
          <Text style={styles.btnTxt}>{loading ? 'Registering…' : 'Complete registration'}</Text>
        </TouchableOpacity>
        <Text style={styles.footnote}>Admin review takes under 24 hours. You'll get an SMS when approved.</Text>
      </ScrollView>

      <Modal visible={stateModal} animationType="slide" transparent onRequestClose={() => setStateModal(false)}>
        <View style={styles.modalScrim}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Select your state</Text>
            <FlatList data={INDIAN_STATES} keyExtractor={s => s}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.stateRow} onPress={() => { setStateField(item); setStateModal(false); }}>
                  <Text style={[styles.stateTxt, stateField === item && { color: P.yellowText, fontWeight: '700' }]}>{item}</Text>
                </TouchableOpacity>
              )} />
            <TouchableOpacity style={styles.modalClose} onPress={() => setStateModal(false)}>
              <Text style={styles.modalCloseTxt}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll:     { padding: 24, paddingTop: 64, paddingBottom: 48 },
  title:      { fontSize: 24, fontWeight: '800', color: P.ink, marginBottom: 6 },
  lede:       { fontSize: 13.5, color: P.muted, lineHeight: 19, marginBottom: 22 },
  label:      { fontSize: 12, fontWeight: '700', color: P.ink2, marginBottom: 6, marginTop: 14, textTransform: 'uppercase', letterSpacing: 0.4 },
  req:        { color: P.danger },
  opt:        { color: P.muted3, textTransform: 'none', fontWeight: '500' },
  input:      { backgroundColor: P.surface, borderWidth: 1, borderColor: P.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: P.ink2, justifyContent: 'center' },
  chipWrap:   { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  // Docs/THE_CUT.md pass 0 — the stated (not chosen) business type.
  fixedType:  { borderWidth: 1, borderColor: P.border, backgroundColor: P.surface2, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11 },
  fixedTypeT: { fontSize: 13.5, fontWeight: '800', color: P.ink },
  fixedTypeS: { fontSize: 11.5, color: P.muted, marginTop: 3, lineHeight: 16 },
  chip:       { backgroundColor: P.surface, borderWidth: 1, borderColor: P.border2, borderRadius: 18, paddingHorizontal: 12, paddingVertical: 7, marginRight: 8, marginBottom: 8 },
  chipOn:     { backgroundColor: P.yellowPale, borderColor: P.yellow },
  chipTxt:    { fontSize: 12.5, color: P.muted, fontWeight: '600' },
  chipTxtOn:  { color: P.yellowText },
  chipOnInk:  { backgroundColor: P.ink, borderColor: P.ink },
  chipTxtOnInk: { color: '#FFFFFF' },
  footnoteLeft: { fontSize: 11.5, color: P.muted2, marginTop: 2 },
  divider:    { height: 1, backgroundColor: P.border, marginTop: 22, marginBottom: 14 },
  section:    { fontSize: 11, fontWeight: '800', color: P.ink2, letterSpacing: 0.6 },
  spinner:    { position: 'absolute', right: 14, top: 14 },
  suggestBox: { backgroundColor: P.surface, borderWidth: 1, borderColor: P.border, borderRadius: 10, marginTop: 4, overflow: 'hidden' },
  suggestRow: { paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: P.surface2 },
  suggestMain:{ fontSize: 13.5, color: P.ink2, fontWeight: '600' },
  suggestSec: { fontSize: 12, color: P.muted2, marginTop: 1 },
  locBadge:   { backgroundColor: P.greenPale, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, marginTop: 8, alignSelf: 'flex-start' },
  locBadgeTxt:{ color: P.green, fontSize: 12, fontWeight: '700' },
  row2:       { flexDirection: 'row' },
  errorBox:   { backgroundColor: '#FDEEE9', borderWidth: 1, borderColor: 'rgba(232,64,26,0.2)', borderRadius: 10, padding: 12, marginTop: 16 },
  errorTxt:   { color: P.dangerDeep, fontSize: 12.5, fontWeight: '600' },
  btn:        { backgroundColor: P.yellow, borderRadius: 12, paddingVertical: 15, alignItems: 'center', marginTop: 20 },
  btnOff:     { opacity: 0.45 },
  btnTxt:     { color: P.ink, fontSize: 15, fontWeight: '800' },
  footnote:   { fontSize: 11.5, color: P.muted2, textAlign: 'center', marginTop: 14 },
  modalScrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: P.surface, borderTopLeftRadius: 18, borderTopRightRadius: 18, maxHeight: '70%', paddingTop: 18 },
  modalTitle: { fontSize: 15, fontWeight: '800', color: P.ink, paddingHorizontal: 20, marginBottom: 8 },
  stateRow:   { paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: P.surface2 },
  stateTxt:   { fontSize: 14, color: P.ink2 },
  modalClose: { padding: 16, alignItems: 'center' },
  modalCloseTxt:{ fontSize: 14, fontWeight: '700', color: P.muted },
});
