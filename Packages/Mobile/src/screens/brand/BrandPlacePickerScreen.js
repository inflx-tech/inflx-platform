import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { ig } from '../../theme/ig';
import { brandApi } from '../../services/api';

/**
 * BrandPlacePickerScreen — where to look for creators.
 * Contract: features/stage-1-find-each-other-and-agree
 *
 * State, then city, each with a real count of creators who are actually there. It only
 * ever offers somewhere someone is — a filter that returns nothing is a tap that leads
 * nowhere, so zero-count rows are shown greyed and cannot be selected.
 *
 * Why a picker rather than chips: chips work for four options and fall apart at forty.
 * A summary row that never grows — "2 states · 5 cities" — survives any number of places.
 *
 * The counts come from the same source the search does, so what is promised here is what
 * comes back. Since Stage 0 both count only real platform members, never scraped
 * prospects — offering a brand ten and returning three is worse than saying three.
 */
export default function BrandPlacePickerScreen({ route, navigation }) {
  const { selected: initial = [], onDone } = route.params || {};
  const [states, setStates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState({});          // which states are expanded
  const [picked, setPicked] = useState(new Set(initial.map(String)));

  useEffect(() => {
    (async () => {
      const res = await brandApi.listCreatorLocations();
      if (res.success) setStates(res.data?.states || []);
      setLoading(false);
    })();
  }, []);

  const toggleCity = useCallback((city) => {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(city)) next.delete(city); else next.add(city);
      return next;
    });
  }, []);

  /** Tapping a state takes or drops every city under it that has anyone in it. */
  const toggleState = useCallback((st) => {
    const cities = (st.cities || []).filter(c => c.creators > 0).map(c => c.city);
    setPicked((prev) => {
      const next = new Set(prev);
      const allOn = cities.length > 0 && cities.every(c => next.has(c));
      for (const c of cities) { if (allOn) next.delete(c); else next.add(c); }
      return next;
    });
  }, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return states;
    return states
      .map(st => {
        const stateHit = st.state.toLowerCase().includes(needle);
        const cities = (st.cities || []).filter(c => stateHit || c.city.toLowerCase().includes(needle));
        return cities.length || stateHit ? { ...st, cities } : null;
      })
      .filter(Boolean);
  }, [states, q]);

  const chosen = [...picked];
  const stateCount = states.filter(st => (st.cities || []).some(c => picked.has(c.city))).length;

  function done() {
    if (typeof onDone === 'function') onDone(chosen);
    navigation.goBack();
  }

  return (
    <View style={s.container}>
      <View style={s.nav}>
        <View style={{ flex: 1 }}>
          <Text style={s.navTitle}>Where</Text>
          <Text style={s.navSub}>
            {chosen.length === 0 ? 'ANYWHERE' : `${stateCount} STATE${stateCount === 1 ? '' : 'S'} · ${chosen.length} CIT${chosen.length === 1 ? 'Y' : 'IES'}`}
          </Text>
        </View>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.close} activeOpacity={0.6}>
          <Icon name="close" size={22} color={ig.text} />
        </TouchableOpacity>
      </View>

      <View style={s.searchWrap}>
        <Icon name="magnify" size={17} color={ig.mut2} />
        <TextInput
          style={s.search}
          placeholder="Search a state or city…"
          placeholderTextColor={ig.mut2}
          value={q}
          onChangeText={setQ}
        />
      </View>

      {chosen.length > 0 && (
        <View style={s.chips}>
          {chosen.slice(0, 4).map(c => (
            <TouchableOpacity key={c} style={s.chip} onPress={() => toggleCity(c)} activeOpacity={0.75}>
              <Text style={s.chipT}>{c}</Text>
              <Icon name="close" size={12} color={ig.bg} />
            </TouchableOpacity>
          ))}
          {chosen.length > 4 && (
            <View style={[s.chip, s.chipGhost]}><Text style={s.chipGhostT}>+{chosen.length - 4}</Text></View>
          )}
        </View>
      )}

      {loading ? (
        <View style={s.center}><ActivityIndicator color={ig.text} /></View>
      ) : states.length === 0 ? (
        <View style={s.center}>
          <Icon name="map-marker-off-outline" size={30} color={ig.mut2} />
          <Text style={s.emptyT}>No creator locations yet</Text>
          <Text style={s.emptyS}>
            Places appear here once creators on the platform have a city recorded.
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
          {filtered.map(st => {
            const cities = st.cities || [];
            const live = cities.filter(c => c.creators > 0).map(c => c.city);
            const someOn = live.some(c => picked.has(c));
            const allOn = live.length > 0 && live.every(c => picked.has(c));
            const expanded = open[st.state] ?? true;

            return (
              <View key={st.state}>
                <TouchableOpacity style={s.stateRow} activeOpacity={0.7} onPress={() => toggleState(st)}>
                  <View style={[s.box, (allOn || someOn) && s.boxOn]}>
                    <Text style={s.boxT}>{allOn ? '✓' : someOn ? '–' : ''}</Text>
                  </View>
                  <Text style={s.stateName}>{st.state}</Text>
                  <Text style={s.count}>{st.creators}</Text>
                  <TouchableOpacity
                    onPress={() => setOpen(o => ({ ...o, [st.state]: !expanded }))}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Icon name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={ig.mut} />
                  </TouchableOpacity>
                </TouchableOpacity>

                {expanded && cities.map(c => {
                  const empty = !c.creators;
                  const on = picked.has(c.city);
                  return (
                    <TouchableOpacity
                      key={c.city}
                      style={[s.cityRow, empty && s.rowEmpty]}
                      activeOpacity={empty ? 1 : 0.7}
                      // Never offer a tap that leads nowhere.
                      onPress={empty ? undefined : () => toggleCity(c.city)}
                    >
                      <View style={[s.box, on && s.boxOn]}><Text style={s.boxT}>{on ? '✓' : ''}</Text></View>
                      <Text style={s.cityName}>{c.city}</Text>
                      <Text style={s.count}>{c.creators}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            );
          })}
        </ScrollView>
      )}

      <View style={s.footer}>
        <TouchableOpacity style={s.doneBtn} onPress={done} activeOpacity={0.85}>
          <Text style={s.doneT}>
            {chosen.length === 0 ? 'Search anywhere' : `Use these ${chosen.length}`}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: ig.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },

  nav: { flexDirection: 'row', alignItems: 'center', paddingTop: 50, paddingBottom: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: ig.lineSoft },
  navTitle: { fontSize: 19, fontWeight: '800', color: ig.text },
  navSub: { fontSize: 10.5, fontWeight: '700', color: ig.mut, marginTop: 1, letterSpacing: 0.3 },
  close: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },

  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginTop: 12, paddingHorizontal: 11, borderWidth: 1, borderColor: ig.line, borderRadius: 10 },
  search: { flex: 1, paddingVertical: 10, fontSize: 13, color: ig.text },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 16, paddingTop: 12 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: ig.text, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 5 },
  chipT: { color: ig.bg, fontSize: 11.5, fontWeight: '700' },
  chipGhost: { backgroundColor: ig.lineSoft },
  chipGhostT: { color: ig.mut, fontSize: 11.5, fontWeight: '700' },

  stateRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 11, backgroundColor: ig.bgSoft, borderBottomWidth: 1, borderBottomColor: ig.lineSoft },
  stateName: { flex: 1, fontSize: 13, fontWeight: '800', color: ig.text },
  cityRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 34, paddingRight: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: ig.lineSoft },
  cityName: { flex: 1, fontSize: 12.5, fontWeight: '600', color: ig.text },
  rowEmpty: { opacity: 0.42 },
  count: { fontSize: 12, fontWeight: '800', color: ig.mut, minWidth: 26, textAlign: 'right' },

  box: { width: 17, height: 17, borderWidth: 1.5, borderColor: ig.line, borderRadius: 4, alignItems: 'center', justifyContent: 'center' },
  boxOn: { backgroundColor: ig.text, borderColor: ig.text },
  boxT: { color: ig.bg, fontSize: 10, fontWeight: '800' },

  emptyT: { fontSize: 15, fontWeight: '700', color: ig.text, marginTop: 12 },
  emptyS: { fontSize: 12.5, color: ig.mut, marginTop: 5, textAlign: 'center', lineHeight: 18 },

  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 16, paddingBottom: 28, backgroundColor: ig.bg, borderTopWidth: 1, borderTopColor: ig.lineSoft },
  doneBtn: { backgroundColor: ig.text, borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  doneT: { color: ig.bg, fontSize: 13.5, fontWeight: '800' },
});
