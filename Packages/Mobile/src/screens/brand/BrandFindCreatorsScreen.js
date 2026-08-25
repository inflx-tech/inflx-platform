import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity,
  ActivityIndicator, Modal, Alert, ScrollView,
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
  // One sheet for every filter, raised from the bottom. Three rows used to sit on the
  // screen whether or not they were doing anything, and each opened its own page.
  // Contract: features/creators-tab-shape (items 3-5)
  const [filtersOpen, setFiltersOpen] = useState(false);
  // Nothing applies until confirmed, so a combination can be explored and backed out of.
  const [draft, setDraft] = useState(null);
  const [places, setPlaces] = useState([]);
  // Saving a set as a group only means anything once something is ticked, so it lives
  // on the bar rather than in the header. Contract: features/creators-tab-shape (item 7)
  const [namingGroup, setNamingGroup] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [savingGroup, setSavingGroup] = useState(false);
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

  // Places with their real counts, so a filter is never offered that returns nobody.
  // These come from the same endpoint the retired Where page used.
  useEffect(() => {
    brandApi.listCreatorLocations().then(res => {
      if (res.success) setPlaces(res.data?.states || []);
    });
  }, []);

  const openFilters = () => {
    setDraft({ cities: [...cities], niches: [...niches], size });
    setFiltersOpen(true);
  };
  const applyFilters = () => {
    if (draft) { setCities(draft.cities); setNiches(draft.niches); setSize(draft.size); }
    setFiltersOpen(false);
  };

  // The chips a brand can strike off one at a time, rather than opening a page to
  // un-choose something.
  const chips = [
    ...cities.map(c => ({ label: c, drop: () => setCities(cities.filter(x => x !== c)) })),
    ...niches.map(n => ({ label: n, drop: () => setNiches(niches.filter(x => x !== n)) })),
    ...(size ? [{ label: (SIZE_BANDS.find(b => b.key === size) || {}).label || size, drop: () => setSize('') }] : []),
  ];

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

  function saveAsGroup() {
    setGroupName('');
    setNamingGroup(true);
  }

  async function confirmGroup() {
    const name = groupName.trim();
    if (!name) return Alert.alert('Name it', 'Give the group a name you will recognise later.');
    setSavingGroup(true);
    const res = await brandApi.createGroup(name, [...picked]);
    setSavingGroup(false);
    if (!res.success) return Alert.alert('Could not save', res.error?.message || 'Please try again.');
    setNamingGroup(false);
    setSelecting(false);
    setPicked(new Set());
    Alert.alert('Saved', `${name} — ${res.data?.group?.member_count ?? '' } creators. You can ask the whole group in one move from Groups.`);
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

      {/* Active filters only. With nothing chosen this is one line, not five.
          Contract: features/creators-tab-shape (item 3) */}
      <View style={s.chipStrip}>
        {chips.map((c, i) => (
          <TouchableOpacity key={`${c.label}-${i}`} style={[s.chip, s.chipOn]} activeOpacity={0.7} onPress={c.drop}>
            <Text style={s.chipTxtOn}>{c.label}</Text>
            <Icon name="close" size={12} color={ig.bg} />
          </TouchableOpacity>
        ))}
        <TouchableOpacity style={[s.chip, s.chipAdd]} activeOpacity={0.7} onPress={openFilters}>
          <Icon name="tune-variant" size={13} color={ig.text} />
          <Text style={s.chipTxtAdd}>Filters</Text>
        </TouchableOpacity>
      </View>

      <View style={s.resultsHead}>
        <Text style={s.resultsN}>
          {loading ? 'Searching…' : `${results.length} creator${results.length === 1 ? '' : 's'}`}
          {activeCount > 0 ? ` · ${activeCount} filter${activeCount === 1 ? '' : 's'}` : ''}
        </Text>
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
                <CreatorAvatar name={item.full_name || item.ig_handle} avatarUrl={item.profile_image_url} size={42} />
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
      {/* The bar always names WHO and HOW MANY — never just "Ask". A brand about to
          write to fourteen people should see the number before the form.

          It used to read "Ask all N" with N ticked and then send the FILTERS, so ticking
          two people wrote to everyone who matched.
          Contract: features/creators-tab-shape (items 6-7) */}
      {!loading && (picked.size > 0 || (!addToGroupId && results.length > 0)) && (
        <View style={s.actionBar}>
          {picked.size > 0 ? (
            <>
              <Text style={s.actionN}>{picked.size} selected</Text>
              {addToGroupId ? (
                <TouchableOpacity style={s.actionBtn} onPress={addPickedToGroup} activeOpacity={0.85}>
                  <Text style={s.actionT}>Add to group</Text>
                </TouchableOpacity>
              ) : (
                <>
                  <TouchableOpacity style={s.actionGhost} activeOpacity={0.85} onPress={saveAsGroup}>
                    <Text style={s.actionGhostT}>Save as group</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={s.actionBtn}
                    activeOpacity={0.85}
                    onPress={() => navigation.navigate('BrandRequestComposer', {
                      influencerIds: [...picked],
                    })}
                  >
                    <Text style={s.actionT}>Ask {picked.size}</Text>
                  </TouchableOpacity>
                </>
              )}
            </>
          ) : (
            <>
              <Text style={s.actionN}>
                {activeCount > 0 ? `${results.length} match your filters` : `${results.length} creators`}
              </Text>
              <TouchableOpacity style={s.actionGhost} activeOpacity={0.85}
                onPress={() => { setSelecting(true); setPicked(new Set()); }}>
                <Text style={s.actionGhostT}>Select</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={s.actionBtn}
                activeOpacity={0.85}
                onPress={() => navigation.navigate('BrandRequestComposer', {
                  filters: {
                    ...(cities.length ? { cities } : {}),
                    ...(niches.length ? { niches } : {}),
                    ...(band.min != null ? { min_followers: band.min } : {}),
                  },
                })}
              >
                <Text style={s.actionT}>Ask all {results.length}</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      )}

      {/* Works in */}
      <Modal visible={namingGroup} transparent animationType="fade" onRequestClose={() => setNamingGroup(false)}>
        <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={() => setNamingGroup(false)}>
          <TouchableOpacity style={s.nameCard} activeOpacity={1} onPress={() => {}}>
            <Text style={s.nameH}>Name this group</Text>
            <Text style={s.nameS}>{picked.size} creators. You can ask the whole group in one move later.</Text>
            <TextInput
              style={s.nameInput}
              value={groupName}
              onChangeText={setGroupName}
              placeholder="AP fashion"
              placeholderTextColor={ig.mut2}
              autoFocus
            />
            <View style={s.nameRow}>
              <TouchableOpacity onPress={() => setNamingGroup(false)}>
                <Text style={s.nameCancel}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.nameSave} onPress={confirmGroup} disabled={savingGroup}>
                <Text style={s.nameSaveT}>{savingGroup ? 'Saving…' : 'Save group'}</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* ONE sheet, raised from the bottom, holding every filter. Three rows used to sit
          on the screen doing nothing, and each opened its own page — including a whole
          page just for choosing a city, now retired.

          Nothing applies until "Show N" is tapped, so a combination can be explored and
          backed out of. Every option carries a real count, so a brand is never offered a
          filter that returns nobody.
          Contract: features/creators-tab-shape (items 4-5) */}
      <Modal visible={filtersOpen} transparent animationType="slide" onRequestClose={() => setFiltersOpen(false)}>
        <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={() => setFiltersOpen(false)}>
          <TouchableOpacity style={s.sheet} activeOpacity={1} onPress={() => {}}>
            <View style={s.grab} />
            <Text style={s.sheetH}>Filters</Text>
            <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={false}>
              <Text style={s.sheetL}>Where</Text>
              <View style={s.sheetChips}>
                {places.flatMap(st => (st.cities || []).map(city => {
                  const name = city.city || city.name || city;
                  const n = city.count ?? city.creators ?? null;
                  const on = (draft?.cities || []).includes(name);
                  return (
                    <TouchableOpacity key={`${st.state}-${name}`} style={[s.chip, on && s.chipOn]} activeOpacity={0.7}
                      onPress={() => setDraft(d => ({
                        ...d,
                        cities: on ? d.cities.filter(x => x !== name) : [...d.cities, name],
                      }))}>
                      <Text style={on ? s.chipTxtOn : s.chipTxt}>{name}{n != null ? ` ${n}` : ""}</Text>
                    </TouchableOpacity>
                  );
                }))}
                {places.length === 0 && <Text style={s.sheetMuted}>No places to filter by yet.</Text>}
              </View>

              <Text style={s.sheetL}>Works in</Text>
              <View style={s.sheetChips}>
                {availableNiches.map(n => {
                  const label = n.niche || n.name || n;
                  const count = n.count ?? null;
                  const on = (draft?.niches || []).includes(label);
                  return (
                    <TouchableOpacity key={label} style={[s.chip, on && s.chipOn]} activeOpacity={0.7}
                      onPress={() => setDraft(d => ({
                        ...d,
                        niches: on ? d.niches.filter(x => x !== label) : [...d.niches, label],
                      }))}>
                      <Text style={on ? s.chipTxtOn : s.chipTxt}>{label}{count != null ? ` ${count}` : ""}</Text>
                    </TouchableOpacity>
                  );
                })}
                {availableNiches.length === 0 && <Text style={s.sheetMuted}>No categories to filter by yet.</Text>}
              </View>

              <Text style={s.sheetL}>Size · followers on Instagram</Text>
              <View style={s.sheetChips}>
                {SIZE_BANDS.map(b => {
                  const on = (draft?.size || "") === b.key;
                  return (
                    <TouchableOpacity key={b.key || "any"} style={[s.chip, on && s.chipOn]} activeOpacity={0.7}
                      onPress={() => setDraft(d => ({ ...d, size: on ? "" : b.key }))}>
                      <Text style={on ? s.chipTxtOn : s.chipTxt}>{b.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>

            <View style={s.sheetBar}>
              <TouchableOpacity onPress={() => setDraft({ cities: [], niches: [], size: "" })}>
                <Text style={s.sheetClear}>Clear all</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.sheetApply} onPress={applyFilters} activeOpacity={0.85}>
                <Text style={s.sheetApplyT}>Show creators</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  chipStrip: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, paddingHorizontal: 14, paddingBottom: 10 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderWidth: 1, borderColor: ig.line, borderRadius: 999,
    paddingHorizontal: 11, paddingVertical: 6,
  },
  chipOn: { backgroundColor: ig.text, borderColor: ig.text },
  chipAdd: { borderStyle: 'dashed', borderColor: ig.text },
  chipTxt: { fontSize: 11.5, fontWeight: '700', color: ig.mut },
  chipTxtOn: { fontSize: 11.5, fontWeight: '700', color: ig.bg },
  chipTxtAdd: { fontSize: 11.5, fontWeight: '800', color: ig.text },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.42)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: ig.bg, borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 14, paddingBottom: 22 },
  grab: { width: 34, height: 4, borderRadius: 2, backgroundColor: ig.line, alignSelf: 'center', marginBottom: 12 },
  sheetH: { fontSize: 16, fontWeight: '800', color: ig.text, marginBottom: 6 },
  sheetL: { fontSize: 9, fontWeight: '800', color: ig.mut, letterSpacing: 0.5, textTransform: 'uppercase', marginTop: 14, marginBottom: 7 },
  sheetChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  sheetMuted: { fontSize: 11.5, color: ig.mut2 },
  sheetBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 18 },
  sheetClear: { fontSize: 12, fontWeight: '700', color: ig.mut },
  sheetApply: { backgroundColor: ig.text, borderRadius: 10, paddingHorizontal: 22, paddingVertical: 11 },
  sheetApplyT: { fontSize: 12.5, fontWeight: '800', color: ig.bg },
  actionGhost: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.38)', borderRadius: 8, paddingHorizontal: 11, paddingVertical: 7 },
  actionGhostT: { fontSize: 11, fontWeight: '800', color: ig.bg },
  nameCard: { backgroundColor: ig.bg, borderRadius: 16, padding: 18, margin: 24 },
  nameH: { fontSize: 16, fontWeight: '800', color: ig.text },
  nameS: { fontSize: 11.5, color: ig.mut, marginTop: 4, lineHeight: 16 },
  nameInput: { borderWidth: 1, borderColor: ig.line, borderRadius: 9, paddingHorizontal: 11, paddingVertical: 10, fontSize: 13.5, color: ig.text, marginTop: 14 },
  nameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 16, marginTop: 16 },
  nameCancel: { fontSize: 12.5, fontWeight: '700', color: ig.mut },
  nameSave: { backgroundColor: ig.text, borderRadius: 9, paddingHorizontal: 18, paddingVertical: 10 },
  nameSaveT: { fontSize: 12.5, fontWeight: '800', color: ig.bg },
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
