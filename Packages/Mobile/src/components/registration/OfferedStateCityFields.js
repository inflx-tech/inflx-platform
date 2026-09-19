/**
 * OfferedStateCityFields — the two-step address picker: State first, then "Your nearest major
 * city" narrowed to that state (C1 / C1b, and the same pair on B1, B6, B9, C5, C8).
 * Contract: features/registration-and-profile · spec §1
 *
 * The lists come from GET /reference/states?offered=1 — six southern states and their 146
 * offered cities — loaded once per app session and shared by every form. A city can never be
 * chosen before its state; changing the state clears the city. There is deliberately no
 * "my city isn't listed": the label "Your nearest major city" and its helper line are what
 * make 146 entries enough (spec §1.3) — keep them verbatim.
 *
 * Props
 *   stateId, cityId          the chosen ids (numbers or null)
 *   onChange({ stateId, cityId })
 *   errors                   { state?, city? } — the red lines under each field
 *   testIDPrefix             `${prefix}-state`, `${prefix}-city`, `${prefix}-option-<id>`
 *   stateName, cityName      fallback labels when the saved city is not on the offered list
 *                            (older accounts keep resolving and keep showing their city)
 *   cityLabel, cityHint      the mockup wording per screen; hint '' hides the line
 *   beside                   a node drawn in a two-column row beside State (B1/B6: the pincode)
 *   labelStyle, fieldStyle, hintStyle   the auth screens' own yellow-world styles
 */
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, FlatList, StyleSheet } from 'react-native';
import { settingsTokens as T, fonts } from '../../theme/tokens';
import { referenceApi } from '../../services/api';
import { FieldError } from '../settings/primitives';
import { Sheet, sh } from '../settings/sheets';

export const CITY_LABEL = 'Your nearest major city';
export const CITY_HINT = 'The closest big city to you — not your exact town or area.';
export const MSG_STATE = 'Pick your state.';
export const MSG_CITY = 'Pick your nearest major city.';

let _statesPromise = null;
/** Loads the offered states once per app session; a failure is not cached so a retry can work. */
export function loadOfferedStates() {
  if (!_statesPromise) {
    _statesPromise = referenceApi.offeredStates().then((r) => {
      if (!r || !r.success) { _statesPromise = null; return []; }
      return (r.data && r.data.items) || [];
    }).catch(() => { _statesPromise = null; return []; });
  }
  return _statesPromise;
}
export function _resetOfferedStatesCache() { _statesPromise = null; }

/** One-choice list sheet with a search box and an optional footer line ("33 cities in Telangana"). */
export function SinglePickSheet({ visible, title, items, value, onPick, onClose, searchPlaceholder, footer, testIDPrefix }) {
  const [q, setQ] = useState('');
  useEffect(() => { if (visible) setQ(''); }, [visible]);
  const shown = useMemo(() => {
    const n = q.trim().toLowerCase();
    return n ? items.filter((i) => String(i.name).toLowerCase().includes(n)) : items;
  }, [items, q]);
  return (
    <Sheet visible={visible} onClose={onClose} testID={`${testIDPrefix}-sheet`}>
      <View style={sh.head}>
        <TouchableOpacity onPress={onClose} accessibilityRole="button" accessibilityLabel="Back" style={ss.backBtn}>
          <Text style={ss.backText}>‹</Text>
        </TouchableOpacity>
        <Text style={[sh.title, { flex: 1 }]}>{title}</Text>
      </View>
      <TextInput style={sh.search} value={q} onChangeText={setQ} placeholder={searchPlaceholder} placeholderTextColor={T.ink3} autoCorrect={false} testID={`${testIDPrefix}-search`} />
      <FlatList
        data={shown}
        keyExtractor={(i) => String(i.id)}
        style={{ maxHeight: 380, marginTop: 6 }}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => {
          const on = value != null && String(value) === String(item.id);
          return (
            <TouchableOpacity style={sh.optRow} onPress={() => onPick(item.id)} accessibilityRole="radio" accessibilityState={{ selected: !!on }} testID={`${testIDPrefix}-option-${item.id}`}>
              <Text style={[sh.optLabel, on && { fontFamily: fonts.sansBold }]}>{item.name}</Text>
              {on ? <Text style={ss.tick}>✓</Text> : null}
            </TouchableOpacity>
          );
        }}
      />
      {footer ? <Text style={ss.footer}>{footer}</Text> : null}
    </Sheet>
  );
}

export default function OfferedStateCityFields({
  stateId, cityId, onChange, errors = {}, testIDPrefix = 'reg', stateName, cityName,
  cityLabel = CITY_LABEL, cityHint = CITY_HINT, beside, labelStyle, fieldStyle, hintStyle, placeholderColor,
}) {
  const [states, setStates] = useState([]);
  const [open, setOpen] = useState(null); // 'state' | 'city' | null

  useEffect(() => {
    let alive = true;
    loadOfferedStates().then((items) => { if (alive) setStates(items); });
    return () => { alive = false; };
  }, []);

  const state = useMemo(() => states.find((s) => String(s.id) === String(stateId)) || null, [states, stateId]);
  const cities = state ? (state.cities || []) : [];
  const city = useMemo(() => cities.find((c) => String(c.id) === String(cityId)) || null, [cities, cityId]);
  const stateText = state ? state.name : (stateId != null && stateName ? stateName : '');
  const cityText = city ? city.name : (cityId != null && cityName ? cityName : '');
  const cityDisabled = stateId == null;
  const phColor = placeholderColor || T.ink3;

  // onChange also carries the names, for screens that print the choice before saving (B7).
  function pickState(id) {
    setOpen(null);
    if (String(id) === String(stateId)) return;
    const st = states.find((x) => String(x.id) === String(id));
    onChange({ stateId: id, cityId: null, stateName: st ? st.name : '', cityName: '' });
  }
  function pickCity(id) {
    setOpen(null);
    const c = cities.find((x) => String(x.id) === String(id));
    onChange({ stateId, cityId: id, stateName: state ? state.name : '', cityName: c ? c.name : '' });
  }

  const stateField = (
    <View style={{ flex: 1 }}>
      <Text style={[ss.label, labelStyle]}>State <Text style={ss.req}>*</Text></Text>
      <TouchableOpacity style={[ss.field, fieldStyle, errors.state ? ss.fieldErr : null]} onPress={() => setOpen('state')} accessibilityRole="button" testID={`${testIDPrefix}-state`}>
        <Text style={[ss.value, !stateText && { color: phColor }]} numberOfLines={1}>{stateText || 'Select'}</Text>
        <Text style={ss.chev}>›</Text>
      </TouchableOpacity>
      <FieldError text={errors.state} />
    </View>
  );

  return (
    <View>
      {beside ? (
        <View style={ss.row}>
          <View style={{ flex: 1, marginRight: 8 }}>{beside}</View>
          <View style={{ flex: 1, marginLeft: 8 }}>{stateField}</View>
        </View>
      ) : stateField}

      <View style={{ height: 14 }} />
      <Text style={[ss.label, labelStyle]}>{cityLabel} <Text style={ss.req}>*</Text></Text>
      <TouchableOpacity
        style={[ss.field, fieldStyle, cityDisabled && ss.fieldOff, errors.city ? ss.fieldErr : null]}
        onPress={() => setOpen('city')}
        disabled={cityDisabled}
        accessibilityRole="button"
        accessibilityState={{ disabled: !!cityDisabled }}
        testID={`${testIDPrefix}-city`}
      >
        <Text style={[ss.value, !cityText && { color: phColor }]} numberOfLines={1}>{cityText || (cityDisabled ? 'Pick a state first' : 'Select')}</Text>
        <Text style={ss.chev}>›</Text>
      </TouchableOpacity>
      {cityHint ? <Text style={[ss.hint, hintStyle]} testID={`${testIDPrefix}-city-hint`}>{cityHint}</Text> : null}
      <FieldError text={errors.city} />

      <SinglePickSheet
        visible={open === 'state'}
        title="State"
        items={states}
        value={stateId}
        onPick={pickState}
        onClose={() => setOpen(null)}
        searchPlaceholder="Search states"
        testIDPrefix={`${testIDPrefix}-state`}
      />
      <SinglePickSheet
        visible={open === 'city'}
        title="Nearest major city"
        items={cities}
        value={cityId}
        onPick={pickCity}
        onClose={() => setOpen(null)}
        searchPlaceholder={state ? `Search ${state.name} cities` : 'Search cities'}
        footer={state ? `${cities.length} ${cities.length === 1 ? 'city' : 'cities'} in ${state.name}` : ''}
        testIDPrefix={`${testIDPrefix}-city`}
      />
    </View>
  );
}

const ss = StyleSheet.create({
  row: { flexDirection: 'row' },
  label: { fontFamily: fonts.sansSemiBold, fontSize: 14, color: T.ink, marginBottom: 8 },
  req: { color: T.danger },
  field: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: T.border, borderRadius: 10, backgroundColor: T.bg, paddingHorizontal: 12, paddingVertical: 12 },
  fieldOff: { backgroundColor: T.surface },
  fieldErr: { borderColor: T.danger },
  value: { flex: 1, fontFamily: fonts.sansMedium, fontSize: 15, color: T.ink },
  chev: { fontFamily: fonts.sansBold, fontSize: 18, color: T.ink3, marginLeft: 8 },
  hint: { fontFamily: fonts.sansRegular, fontSize: 12, color: T.ink3, marginTop: 6, lineHeight: 17 },
  backBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', marginRight: 4 },
  backText: { fontSize: 26, color: T.ink, fontFamily: fonts.sansMedium, marginTop: -3 },
  tick: { fontFamily: fonts.sansBold, fontSize: 15, color: T.ink },
  footer: { fontFamily: fonts.sansRegular, fontSize: 12, color: T.ink3, textAlign: 'center', marginTop: 12 },
});
