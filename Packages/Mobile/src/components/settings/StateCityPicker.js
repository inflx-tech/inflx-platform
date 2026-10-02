/**
 * Item 2 — the shared state → city picker (C4 / C4b), also used by the brand's Cities filter.
 * Contract: features/item2-pitch-invitation-settings · prompt §5.2 C4/C4b
 *
 * Step 1: search "Search a city or state", chosen cities as removable chips, the list of
 *         states each with a "{N} selected" chip, "Apply · N {city|cities}".
 * Step 2: back, state name, Select all, "Search cities in {State}", checkbox city list.
 *         Back keeps the choices. Searching from step 1 shows "{City} · {State}".
 *
 * states: [{ id, name, cities: [{ id, name }] }]   value: array of city ids
 */

import React, { useMemo, useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, TextInput, FlatList, ScrollView, StyleSheet } from 'react-native';
import { settingsTokens as T, fonts } from '../../theme/tokens';
import { Sheet, sh } from './sheets';
import { PrimaryButton } from './primitives';
import { COPY } from './copy';

export default function StateCityPicker({ visible, title, states, value, onApply, onClose, allowClear = true }) {
  const [sel, setSel] = useState(() => new Set(value || []));
  const [q, setQ] = useState('');
  const [state, setState] = useState(null);     // step 2 when set
  const [cq, setCq] = useState('');

  useEffect(() => { if (visible) { setSel(new Set(value || [])); setQ(''); setCq(''); setState(null); } }, [visible]); // eslint-disable-line

  const cityIndex = useMemo(() => {
    const m = new Map();
    for (const s of states || []) for (const c of s.cities || []) m.set(c.id, { ...c, stateName: s.name, stateId: s.id });
    return m;
  }, [states]);

  function toggle(id) { setSel(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; }); }

  const count = sel.size;
  const applyLabel = COPY.picker.apply(count, count === 1 ? 'city' : 'cities');

  // Step 1 search results: cities and states whose name matches.
  const results = useMemo(() => {
    const n = q.trim().toLowerCase();
    if (!n) return null;
    const out = [];
    for (const s of states || []) {
      if (s.name.toLowerCase().includes(n)) out.push({ type: 'state', state: s });
      for (const c of s.cities || []) if (c.name.toLowerCase().includes(n)) out.push({ type: 'city', city: c, state: s });
    }
    return out.slice(0, 40);
  }, [q, states]);

  function selectAllIn(s) {
    setSel(prev => { const n = new Set(prev); for (const c of s.cities || []) n.add(c.id); return n; });
  }

  // The chosen cities, each removable. ui-walk-fixes (board C, rule 3): they were a plain block
  // that could neither scroll nor shrink, so in the shrinking sheet the list alone gave way — and
  // with the keypad open on a short phone two rows of them left the results less than one row,
  // while "Select all" on a big state (eleven rows) left the list nothing at all. They now sit in
  // a scroller of their own, beside the list and never around it. While there is room it is as
  // tall as its chips, so the picker looks exactly as it did; when the room runs out the chips
  // give way FIRST (four times as readily as the list), down to a single chip, and scroll.
  // (A tap on a chip must reach the chip with the keypad open: keyboardShouldPersistTaps.)
  const chosen = [...sel].map(id => cityIndex.get(id)).filter(Boolean);
  const chips = count === 0 ? null : chosen.length === 0 ? <View style={ss.chipsNone} /> : (
    <ScrollView style={ss.chipsBox} contentContainerStyle={ss.chips} keyboardShouldPersistTaps="handled" persistentScrollbar testID="city-chips">
      {chosen.map(c => (
        <TouchableOpacity key={c.id} style={ss.chip} onPress={() => toggle(c.id)} accessibilityLabel={`Remove ${c.name}`} testID={`city-chip-${c.id}`}>
          <Text style={ss.chipText}>{c.name}  ×</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );

  // ui-walk-fixes (board C, rule 3): both steps have a search box. With the keypad open the list
  // gives way (fit="list" — the lists are never put inside a ScrollView) and "Apply" stays pinned
  // under it, directly above the keypad, instead of sliding underneath.
  return (
    <Sheet visible={visible} onClose={onClose} testID="state-city-picker" fit="list"
      footer={<PrimaryButton label={applyLabel} onPress={() => onApply([...sel])} testID="city-apply" />}>
      {!state ? (
        <>
          <View style={sh.head}>
            <Text style={sh.title}>{title}</Text>
            {allowClear ? (
              <TouchableOpacity onPress={() => setSel(new Set())}><Text style={sh.clear}>{COPY.picker.clear}</Text></TouchableOpacity>
            ) : null}
          </View>
          <TextInput style={sh.search} value={q} onChangeText={setQ} placeholder={COPY.picker.searchCityOrState} placeholderTextColor={T.ink3} autoCorrect={false} />

          {chips}

          {results ? (
            <FlatList
              data={results}
              style={{ maxHeight: 320 }}
              keyboardShouldPersistTaps="handled"
              keyExtractor={(r, i) => `${r.type}-${r.type === 'city' ? r.city.id : r.state.id}-${i}`}
              renderItem={({ item }) => item.type === 'city' ? (
                <TouchableOpacity style={sh.optRow} onPress={() => toggle(item.city.id)}>
                  <View style={[sh.box, sel.has(item.city.id) && sh.boxOn]}>{sel.has(item.city.id) ? <Text style={sh.tick}>✓</Text> : null}</View>
                  <Text style={sh.optLabel}>{item.city.name} · {item.state.name}</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={sh.optRow} onPress={() => { setState(item.state); setQ(''); }}>
                  <Text style={sh.optLabel}>{item.state.name}</Text>
                  <Text style={sh.clear}>›</Text>
                </TouchableOpacity>
              )}
            />
          ) : (
            <>
              <Text style={ss.step}>1 · {COPY.picker.chooseState}</Text>
              <FlatList
                data={states || []}
                style={{ maxHeight: 320 }}
                keyboardShouldPersistTaps="handled"
                keyExtractor={s => String(s.id)}
                renderItem={({ item }) => {
                  const n = (item.cities || []).filter(c => sel.has(c.id)).length;
                  return (
                    <TouchableOpacity style={sh.optRow} onPress={() => setState(item)} testID={`state-${item.id}`}>
                      <Text style={sh.optLabel}>{item.name}</Text>
                      {n > 0 ? <View style={ss.count}><Text style={ss.countText}>{COPY.picker.nSelected(n)}</Text></View> : null}
                      <Text style={[sh.clear, { marginLeft: 8 }]}>›</Text>
                    </TouchableOpacity>
                  );
                }}
              />
            </>
          )}
        </>
      ) : (
        <>
          <View style={sh.head}>
            <TouchableOpacity onPress={() => { setState(null); setCq(''); }} accessibilityRole="button" accessibilityLabel="Back">
              <Text style={ss.back}>‹ Back</Text>
            </TouchableOpacity>
            <Text style={sh.title}>{state.name}</Text>
            <TouchableOpacity onPress={() => selectAllIn(state)}><Text style={sh.clear}>{COPY.picker.selectAll}</Text></TouchableOpacity>
          </View>
          <TextInput style={sh.search} value={cq} onChangeText={setCq} placeholder={COPY.picker.searchCitiesIn(state.name)} placeholderTextColor={T.ink3} autoCorrect={false} />
          {chips}
          <Text style={ss.step}>2 · {COPY.picker.chooseCities}</Text>
          <FlatList
            data={(state.cities || []).filter(c => !cq.trim() || c.name.toLowerCase().includes(cq.trim().toLowerCase()))}
            style={{ maxHeight: 300 }}
            keyboardShouldPersistTaps="handled"
            keyExtractor={c => String(c.id)}
            renderItem={({ item }) => {
              const on = sel.has(item.id);
              return (
                <TouchableOpacity style={sh.optRow} onPress={() => toggle(item.id)} testID={`city-${item.id}`} accessibilityRole="checkbox" accessibilityState={{ checked: !!on }}>
                  <View style={[sh.box, on && sh.boxOn]}>{on ? <Text style={sh.tick}>✓</Text> : null}</View>
                  <Text style={sh.optLabel}>{item.name}</Text>
                </TouchableOpacity>
              );
            }}
          />
        </>
      )}
    </Sheet>
  );
}

/** A chosen-city chip is about 28 high (6 + a 12-point line + 6), with 6 under it. */
export const CHIP_HIGH = 28;

const ss = StyleSheet.create({
  // The chips' own scroller. As tall as its chips and never growing into the list's room (a
  // ScrollView grows by default). When the sheet has to shrink, the room that is missing is shared
  // out by `flexShrink × height`: at 4 the chips give up theirs well before the list does, however
  // many there are — but never to less than one chip. That least height is the chip WITHOUT the 6
  // under it, so a single row of chips is not made any taller than it was.
  chipsBox: { flexGrow: 0, flexShrink: 4, marginTop: 10, minHeight: CHIP_HIGH },
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
  // Cities chosen earlier that are no longer offered draw no chip; the 10 above the list stays.
  chipsNone: { marginTop: 10 },
  chip: { backgroundColor: T.ink, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, marginRight: 6, marginBottom: 6 },
  chipText: { color: '#FFFFFF', fontFamily: fonts.sansSemiBold, fontSize: 12 },
  step: { fontFamily: fonts.sansSemiBold, fontSize: 11, color: T.ink3, letterSpacing: 0.6, marginTop: 14, marginBottom: 4 },
  count: { backgroundColor: T.surface, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  countText: { fontFamily: fonts.sansSemiBold, fontSize: 11, color: T.ink2 },
  back: { fontFamily: fonts.sansSemiBold, fontSize: 14, color: T.ink2 },
});
