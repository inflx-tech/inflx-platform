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
import { View, Text, TouchableOpacity, TextInput, FlatList, StyleSheet } from 'react-native';
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

  return (
    <Sheet visible={visible} onClose={onClose} testID="state-city-picker">
      {!state ? (
        <>
          <View style={sh.head}>
            <Text style={sh.title}>{title}</Text>
            {allowClear ? (
              <TouchableOpacity onPress={() => setSel(new Set())}><Text style={sh.clear}>{COPY.picker.clear}</Text></TouchableOpacity>
            ) : null}
          </View>
          <TextInput style={sh.search} value={q} onChangeText={setQ} placeholder={COPY.picker.searchCityOrState} placeholderTextColor={T.ink3} autoCorrect={false} />

          {count > 0 ? (
            <View style={ss.chips}>
              {[...sel].map(id => {
                const c = cityIndex.get(id);
                if (!c) return null;
                return (
                  <TouchableOpacity key={id} style={ss.chip} onPress={() => toggle(id)} accessibilityLabel={`Remove ${c.name}`}>
                    <Text style={ss.chipText}>{c.name}  ×</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : null}

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
          {count > 0 ? (
            <View style={ss.chips}>
              {[...sel].map(id => { const c = cityIndex.get(id); return c ? (
                <TouchableOpacity key={id} style={ss.chip} onPress={() => toggle(id)}><Text style={ss.chipText}>{c.name}  ×</Text></TouchableOpacity>
              ) : null; })}
            </View>
          ) : null}
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
      <View style={{ marginTop: 12 }}>
        <PrimaryButton label={applyLabel} onPress={() => onApply([...sel])} testID="city-apply" />
      </View>
    </Sheet>
  );
}

const ss = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 10 },
  chip: { backgroundColor: T.ink, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, marginRight: 6, marginBottom: 6 },
  chipText: { color: '#FFFFFF', fontFamily: fonts.sansSemiBold, fontSize: 12 },
  step: { fontFamily: fonts.sansSemiBold, fontSize: 11, color: T.ink3, letterSpacing: 0.6, marginTop: 14, marginBottom: 4 },
  count: { backgroundColor: T.surface, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  countText: { fontFamily: fonts.sansSemiBold, fontSize: 11, color: T.ink2 },
  back: { fontFamily: fonts.sansSemiBold, fontSize: 14, color: T.ink2 },
});
