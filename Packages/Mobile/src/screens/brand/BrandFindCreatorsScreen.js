import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity,
  ActivityIndicator, Modal, Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { ig } from '../../theme/ig';
import { brandApi } from '../../services/api';
import CreatorAvatar from '../../components/CreatorAvatar';

/**
 * BrandFindCreatorsScreen — searching for creators.
 * Contract: features/stage-1-find-each-other-and-agree
 *
 * THREE filters, never more. The founder asked for the best filter UI without loading it
 * with everything, and the agreed board says the same: four rows at most, each opening a
 * picker rather than sprawling inline.
 *
 * Where · Works in · Size. That is it. The earlier screen also offered a minimum
 * engagement rate and a sort order — dropped, because a brand looking for someone to
 * work with does not think "show me people above 3.2% engagement", and every filter that
 * goes unused still costs the reader attention.
 *
 * A filter row that would return nobody is not offered. Zero-count options are shown
 * greyed and refuse to be tapped: never a tap that leads nowhere.
 */

/** Bands, not a number to type. Nobody knows what they want to type. */
const SIZE_BANDS = [
  { key: '',        label: 'Any size',       min: null,    max: null },
  { key: 'nano',    label: 'Under 10K',      min: null,    max: 10000 },
  { key: 'micro',   label: '10K – 100K',     min: 10000,   max: 100000 },
  { key: 'mid',     label: '100K – 500K',    min: 100000,  max: 500000 },
  { key: 'macro',   label: '500K and above', min: 500000,  max: null },
];

const fmtCompact = (n) => {
  const v = Number(n || 0);
  if (v >= 10000000) return `${(v / 10000000).toFixed(1)}Cr`;
  if (v >= 100000) return `${(v / 100000).toFixed(1)}L`;
  if (v >= 1000) return `${(v / 1000).toFixed(1)}K`;
  return String(v);
};

export default function BrandFindCreatorsScreen({ navigation, route, embedded }) {
  const addToGroupId = route?.params?.addToGroupId;

  const [q, setQ] = useState('');
  const [cities, setCities] = useState([]);
  const [niches, setNiches] = useState([]);
  const [size, setSize] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [nicheOpen, setNicheOpen] = useState(false);
  const [sizeOpen, setSizeOpen] = useState(false);
  const [availableNiches, setAvailableNiches] = useState([]);
  const [selecting, setSelecting] = useState(false);
  const [picked, setPicked] = useState(new Set());

  const band = SIZE_BANDS.find(b => b.key === size) || SIZE_BANDS[0];

  const search = useCallback(async () => {
    setLoading(true);
    const params = {};
    if (q.trim()) params.q = q.trim();
    if (cities.length) params.city = cities.join(',');
    if (niches.length) params.niche = niches.join(',');
    if (band.min != null) params.min_followers = band.min;
    if (band.max != null) params.max_followers = band.max;

    const res = await brandApi.searchInfluencers(params);
    if (res.success) {
      setResults(res.data?.creators || res.data?.influencers || []);
      // The niche list is built from what is actually out there, so a brand is never
      // offered a category nobody works in.
      const facets = res.data?.niches || res.data?.facets?.niches;
      if (facets) setAvailableNiches(facets);
    }
    setLoading(false);
  }, [q, cities, niches, band]);

  // Debounced so typing does not fire a search per keystroke.
  useEffect(() => {
    const t = setTimeout(search, q ? 350 : 0);
    return () => clearTimeout(t);
  }, [search, q]);

  // Derive the niche options from results the first time, if the API sends no facets.
  useEffect(() => {
    if (availableNiches.length || results.length === 0) return;
    const seen = new Map();
    for (const r of results) if (r.niche) seen.set(r.niche, (seen.get(r.niche) || 0) + 1);
    setAvailableNiches([...seen.entries()].map(([niche, count]) => ({ niche, count })));
  }, [results, availableNiches.length]);

  const activeCount = (cities.length ? 1 : 0) + (niches.length ? 1 : 0) + (size ? 1 : 0);

  const summary = useMemo(() => ({
    where: cities.length === 0 ? 'Anywhere'
      : cities.length <= 2 ? cities.join(', ')
      : `${cities.length} cities`,
    works: niches.length === 0 ? 'Anything'
      : niches.length <= 2 ? niches.join(', ')
      : `${niches.length} kinds`,
    size: band.label,
  }), [cities, niches, band]);

  function toggleNiche(n) {
    setNiches(prev => (prev.includes(n) ? prev.filter(x => x !== n) : [...prev, n]));
  }

  function togglePick(id) {
    setPicked(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function addPickedToGroup() {
    const ids = [...picked];
    const res = await brandApi.addToGroup(addToGroupId, ids);
    if (!res.success) return Alert.alert('Could not add', res.error?.message || 'Please try again.');
    navigation.goBack();
  }

  const FilterRow = ({ icon, label, value, onPress }) => (
    <TouchableOpacity style={s.frow} activeOpacity={0.7} onPress={onPress}>
      <Icon name={icon} size={17} color={ig.mut} style={{ width: 22 }} />
      <View style={{ flex: 1 }}>
        <Text style={s.fk}>{label}</Text>
        <Text style={s.fv} numberOfLines={1}>{value}</Text>
      </View>
      <Text style={s.fc}>Change</Text>
    </TouchableOpacity>
  );

  return (
    <View style={s.container}>
      {!embedded && (
        <View style={s.nav}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.back} activeOpacity={0.6}>
            <Icon name="chevron-left" size={24} color={ig.text} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={s.navTitle}>{addToGroupId ? 'Add to group' : 'Find creators'}</Text>
            <Text style={s.navSub}>{loading ? 'SEARCHING…' : `${results.length} MATCH`}</Text>
          </View>
        </View>
      )}

      <View style={s.searchWrap}>
        <Icon name="magnify" size={17} color={ig.mut2} />
        <TextInput
          style={s.search}
          placeholder="Search by name or handle…"
          placeholderTextColor={ig.mut2}
          value={q}
          onChangeText={setQ}
          returnKeyType="search"
        />
        {q.length > 0 && (
          <TouchableOpacity onPress={() => setQ('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Icon name="close-circle" size={16} color={ig.mut2} />
          </TouchableOpacity>
        )}
      </View>

      <FilterRow
        icon="map-marker-outline" label="Where" value={summary.where}
        onPress={() => navigation.navigate('BrandPlacePicker', {
          selected: cities,
          onDone: (next) => setCities(next),
        })}
      />
      <FilterRow icon="tag-outline" label="Works in" value={summary.works} onPress={() => setNicheOpen(true)} />
      <FilterRow icon="account-group-outline" label="Size" value={summary.size} onPress={() => setSizeOpen(true)} />

      <View style={s.resultsHead}>
        <Text style={s.resultsN}>
          {loading ? 'Searching…' : `${results.length} creator${results.length === 1 ? '' : 's'}`}
          {activeCount > 0 ? ` · ${activeCount} filter${activeCount === 1 ? '' : 's'}` : ''}
        </Text>
        {activeCount > 0 && (
          <TouchableOpacity onPress={() => { setCities([]); setNiches([]); setSize(''); }} activeOpacity={0.7}>
            <Text style={s.clear}>Clear</Text>
          </TouchableOpacity>
        )}
        {!addToGroupId && results.length > 0 && (
          <TouchableOpacity onPress={() => { setSelecting(v => !v); setPicked(new Set()); }} activeOpacity={0.7}>
            <Text style={s.clear}>{selecting ? 'Done' : 'Select'}</Text>
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator color={ig.text} /></View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(r) => String(r.row_id || r.id)}
          renderItem={({ item }) => {
            const id = item.linked_influencer_id || item.row_id || item.id;
            // Muted creators are shown greyed, never hidden — hiding them looks like
            // they do not exist, and a brand would keep searching for someone who is
            // simply not taking requests.
            const muted = item.accepts_brand_requests === false;
            const on = picked.has(id);
            return (
              <TouchableOpacity
                style={[s.row, muted && s.rowMuted]}
                activeOpacity={0.7}
                onPress={() => {
                  if (selecting || addToGroupId) return togglePick(id);
                  navigation.navigate('BrandInfluencerProfile', { influencerId: id });
                }}
              >
                {(selecting || addToGroupId) && (
                  <View style={[s.box, on && s.boxOn]}><Text style={s.boxT}>{on ? '✓' : ''}</Text></View>
                )}
                <CreatorAvatar name={item.full_name || item.ig_handle} avatarUrl={item.avatar_url} size={42} />
                <View style={{ flex: 1 }}>
                  <Text style={s.name}>{item.full_name || item.ig_handle}</Text>
                  <Text style={s.meta}>
                    {[item.city, item.niche].filter(Boolean).join(' · ')}
                  </Text>
                  <Text style={s.stats}>
                    {/* INFLX first: it is who can buy without leaving, which predicts a
                        sale far better than reach does. */}
                    {fmtCompact(item.inflx_followers || 0)} on INFLX
                    {item.followers_count ? ` · ${fmtCompact(item.followers_count)} Instagram` : ''}
                  </Text>
                  {muted && <Text style={s.muted}>NOT TAKING BRAND REQUESTS</Text>}
                </View>
                {!selecting && !addToGroupId && <Icon name="chevron-right" size={18} color={ig.mut2} />}
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <View style={s.empty}>
              <Icon name="account-search-outline" size={30} color={ig.mut2} />
              <Text style={s.emptyT}>Nobody matches</Text>
              <Text style={s.emptyS}>
                {activeCount > 0
                  ? 'Try widening a filter — or clear them and start again.'
                  : 'No creators on the platform yet.'}
              </Text>
            </View>
          }
          contentContainerStyle={results.length === 0 ? { flexGrow: 1 } : { paddingBottom: picked.size ? 96 : 28 }}
        />
      )}

      {/* Multi-select turns into the three things you can do with a selection. */}
      {picked.size > 0 && (
        <View style={s.actionBar}>
          <Text style={s.actionN}>{picked.size} selected</Text>
          {addToGroupId ? (
            <TouchableOpacity style={s.actionBtn} onPress={addPickedToGroup} activeOpacity={0.85}>
              <Text style={s.actionT}>Add to group</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={s.actionBtn}
              activeOpacity={0.85}
              onPress={() => navigation.navigate('BrandAskMany', {
                filters: {
                  ...(cities.length ? { cities } : {}),
                  ...(niches.length ? { niches } : {}),
                  ...(band.min != null ? { min_followers: band.min } : {}),
                },
              })}
            >
              <Text style={s.actionT}>Ask all {picked.size}</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Works in */}
      <Modal visible={nicheOpen} transparent animationType="slide" onRequestClose={() => setNicheOpen(false)}>
        <View style={s.sheetWrap}>
          <View style={s.sheet}>
            <View style={s.sheetHead}>
              <Text style={s.sheetH}>Works in</Text>
              <TouchableOpacity onPress={() => setNicheOpen(false)}><Icon name="close" size={20} color={ig.text} /></TouchableOpacity>
            </View>
            {availableNiches.length === 0 && <Text style={s.sheetEmpty}>No categories yet.</Text>}
            {availableNiches.map(n => {
              const key = n.niche || n;
              const count = n.count;
              const on = niches.includes(key);
              const empty = count === 0;
              return (
                <TouchableOpacity
                  key={key}
                  style={[s.pick, empty && s.rowMuted]}
                  activeOpacity={empty ? 1 : 0.7}
                  onPress={empty ? undefined : () => toggleNiche(key)}
                >
                  <View style={[s.box, on && s.boxOn]}><Text style={s.boxT}>{on ? '✓' : ''}</Text></View>
                  <Text style={s.pickT}>{key}</Text>
                  {count != null && <Text style={s.pickC}>{count}</Text>}
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity style={s.sheetDone} onPress={() => setNicheOpen(false)} activeOpacity={0.85}>
              <Text style={s.sheetDoneT}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Size */}
      <Modal visible={sizeOpen} transparent animationType="slide" onRequestClose={() => setSizeOpen(false)}>
        <View style={s.sheetWrap}>
          <View style={s.sheet}>
            <View style={s.sheetHead}>
              <Text style={s.sheetH}>Size</Text>
              <TouchableOpacity onPress={() => setSizeOpen(false)}><Icon name="close" size={20} color={ig.text} /></TouchableOpacity>
            </View>
            <Text style={s.sheetNote}>Instagram following.</Text>
            {SIZE_BANDS.map(b => (
              <TouchableOpacity
                key={b.key || 'any'}
                style={s.pick}
                activeOpacity={0.7}
                onPress={() => { setSize(b.key); setSizeOpen(false); }}
              >
                <View style={[s.radio, size === b.key && s.radioOn]} />
                <Text style={s.pickT}>{b.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: ig.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 40 },

  nav: { flexDirection: 'row', alignItems: 'center', paddingTop: 50, paddingBottom: 12, paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: ig.lineSoft },
  back: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  navTitle: { fontSize: 18, fontWeight: '800', color: ig.text },
  navSub: { fontSize: 10.5, fontWeight: '700', color: ig.mut, marginTop: 1, letterSpacing: 0.3 },

  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginTop: 12, marginBottom: 4, paddingHorizontal: 11, borderWidth: 1, borderColor: ig.line, borderRadius: 10 },
  search: { flex: 1, paddingVertical: 10, fontSize: 13, color: ig.text },

  frow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: ig.lineSoft },
  fk: { fontSize: 9.5, fontWeight: '800', color: ig.mut, letterSpacing: 0.4, textTransform: 'uppercase' },
  fv: { fontSize: 12.5, fontWeight: '800', color: ig.text, marginTop: 1 },
  fc: { fontSize: 11, color: ig.blue, fontWeight: '800' },

  resultsHead: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingTop: 13, paddingBottom: 7 },
  resultsN: { flex: 1, fontSize: 9.5, fontWeight: '800', color: ig.mut, letterSpacing: 0.5, textTransform: 'uppercase' },
  clear: { fontSize: 11.5, color: ig.blue, fontWeight: '800' },

  row: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 16, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: ig.lineSoft },
  rowMuted: { opacity: 0.45 },
  name: { fontSize: 13.5, fontWeight: '800', color: ig.text },
  meta: { fontSize: 11.5, color: ig.text2, fontWeight: '600', marginTop: 2 },
  stats: { fontSize: 11, color: ig.mut, fontWeight: '700', marginTop: 3 },
  muted: { fontSize: 9.5, fontWeight: '800', color: ig.red, marginTop: 4, letterSpacing: 0.2 },

  box: { width: 18, height: 18, borderWidth: 1.5, borderColor: ig.line, borderRadius: 4, alignItems: 'center', justifyContent: 'center' },
  boxOn: { backgroundColor: ig.text, borderColor: ig.text },
  boxT: { color: ig.bg, fontSize: 10, fontWeight: '800' },
  radio: { width: 17, height: 17, borderRadius: 9, borderWidth: 1.5, borderColor: ig.line },
  radioOn: { borderWidth: 5.5, borderColor: ig.text },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyT: { fontSize: 15, fontWeight: '700', color: ig.text, marginTop: 12 },
  emptyS: { fontSize: 12.5, color: ig.mut, marginTop: 5, textAlign: 'center', lineHeight: 18 },

  actionBar: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, paddingBottom: 24, backgroundColor: ig.bg, borderTopWidth: 1, borderTopColor: ig.line },
  actionN: { flex: 1, fontSize: 12.5, fontWeight: '800', color: ig.text },
  actionBtn: { backgroundColor: ig.text, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 20 },
  actionT: { color: ig.bg, fontSize: 13, fontWeight: '800' },

  sheetWrap: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: ig.bg, borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingBottom: 28 },
  sheetHead: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: ig.lineSoft },
  sheetH: { flex: 1, fontSize: 16, fontWeight: '800', color: ig.text },
  sheetNote: { fontSize: 11.5, color: ig.mut, fontWeight: '600', paddingHorizontal: 16, paddingTop: 10 },
  sheetEmpty: { fontSize: 12.5, color: ig.mut, padding: 20, textAlign: 'center' },
  pick: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: ig.lineSoft },
  pickT: { flex: 1, fontSize: 13, fontWeight: '700', color: ig.text },
  pickC: { fontSize: 12, fontWeight: '800', color: ig.mut },
  sheetDone: { backgroundColor: ig.text, borderRadius: 10, paddingVertical: 14, alignItems: 'center', margin: 16 },
  sheetDoneT: { color: ig.bg, fontSize: 13.5, fontWeight: '800' },
});
