/**
 * FiltersSheet — D2 (creators) and F3 (brands). Every filter in one sheet, the button shows
 * the live count from the server (`countOnly`). Clear all returns to the defaults.
 * Contract: features/item3-discovery-profiles-groups · prompt §6.2, §6.6
 */
import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { settingsTokens as T, fonts } from '../../theme/tokens';
import { Sheet } from '../settings/sheets';
import { Chip, SwitchRow, PrimaryButton } from '../settings/primitives';
import StateCityPicker from '../settings/StateCityPicker';
import { AIMS, MODES, aimLabel, modeLabel } from '../settings/copy';
import { C3 } from './copy3';

// creator-distance-and-visit-preference: `sort` ('distance' = nearest first, the server default)
// and `within` ('50' | '100' | 'state' | 'any') travel with the filters as query params.
export const CREATOR_DEFAULTS = Object.freeze({ openOnly: true, sort: 'distance', within: 'any', nicheCodes: [], minInstagram: '', minYoutube: '', minEngagement: '', cityIds: [], languageCodes: [], aims: [], modes: [] });
export const BRAND_DEFAULTS = Object.freeze({ canPitchOnly: true, categoryCodes: [], cityIds: [], aims: [], modes: [] });

/** How many filters differ from the defaults (for "Filters · N"). A sort orders; it never narrows, so it is not counted. */
export function changedCount(f, defaults) {
  let n = 0;
  for (const k of Object.keys(defaults)) {
    if (k === 'sort') continue;
    const a = f[k], d = defaults[k];
    if (Array.isArray(d) ? (a || []).length > 0 : String(a ?? '') !== String(d ?? '')) n += 1;
  }
  return n;
}
/** First changed filter's label and the count of others, for the quick chip. */
export function quickChip(f, defaults, lists) {
  const parts = [];
  if ((f.nicheCodes || []).length) parts.push(lists.nicheLabel(f.nicheCodes[0]));
  if ((f.categoryCodes || []).length) parts.push(lists.categoryLabel ? lists.categoryLabel(f.categoryCodes[0]) : f.categoryCodes[0]);
  if (f.minInstagram) parts.push(`IG ${C3.discover.buckets.followers.find(b => b[0] === String(f.minInstagram))?.[1] || f.minInstagram}`);
  if (f.minYoutube) parts.push(`YT ${C3.discover.buckets.followers.find(b => b[0] === String(f.minYoutube))?.[1] || f.minYoutube}`);
  if (f.minEngagement) parts.push(`${C3.discover.buckets.er.find(b => b[0] === String(f.minEngagement))?.[1] || f.minEngagement}`);
  if ((f.cityIds || []).length) parts.push(lists.cityName ? lists.cityName(f.cityIds[0]) : 'City');
  if (f.within && f.within !== 'any') parts.push(C3.discover.buckets.within.find(b => b[0] === String(f.within))?.[1] || f.within);
  if ((f.languageCodes || []).length) parts.push(f.languageCodes[0]);
  if ((f.aims || []).length) parts.push(aimLabel(f.aims[0]));
  if ((f.modes || []).length) parts.push(modeLabel(f.modes[0]));
  if (!parts.length) return null;
  const n = changedCount(f, defaults) - 1;
  return n > 0 ? `${parts[0]} +${n}` : parts[0];
}

function Group({ title, children }) {
  return <View style={s.group}><Text style={s.groupTitle}>{title}</Text>{children}</View>;
}
function Buckets({ options, value, onChange, testID }) {
  return (
    <View style={s.chips}>
      {options.map(([v, l]) => <Chip key={v || 'any'} testID={`${testID}-${v || 'any'}`} label={l} selected={String(value ?? '') === v} onPress={() => onChange(v)} />)}
    </View>
  );
}

/**
 * `defaults` (optional, ui-walk-fixes board B): what "Clear all" returns to. Left out, it is the
 * kind's own defaults, exactly as before. The creator list passes its own, because "Open to
 * invitations only" starts ON on Discover and in the set picker but OFF when adding to a group —
 * and with the chip row gone this sheet is the only place that switch lives, so "Clear all" here
 * must put it back where that screen starts, not turn it on.
 */
export default function FiltersSheet({ visible, kind, value, lists, fetchCount, onApply, onClose, defaults: defaultsProp }) {
  const defaults = defaultsProp || (kind === 'brands' ? BRAND_DEFAULTS : CREATOR_DEFAULTS);
  const [f, setF] = useState({ ...defaults, ...value });
  const [count, setCount] = useState(null);
  const [cityPicker, setCityPicker] = useState(false);
  const [showAllNiches, setShowAllNiches] = useState(false);
  const [showAllLangs, setShowAllLangs] = useState(false);
  useEffect(() => { if (visible) setF({ ...defaults, ...value }); }, [visible]); // eslint-disable-line
  useEffect(() => {
    if (!visible) return undefined;
    let alive = true;
    setCount(null);
    fetchCount(f).then(n => { if (alive) setCount(n); }).catch(() => { if (alive) setCount(null); });
    return () => { alive = false; };
  }, [f, visible]); // eslint-disable-line

  const set = (patch) => setF(prev => ({ ...prev, ...patch }));
  const toggle = (key, v) => set({ [key]: (f[key] || []).includes(v) ? f[key].filter(x => x !== v) : [...(f[key] || []), v] });
  const niches = lists.niches || [];
  const langs = lists.languages || [];
  const shownNiches = showAllNiches ? niches : niches.slice(0, 4);
  const shownLangs = showAllLangs ? langs : langs.slice(0, 3);
  const cityValue = (f.cityIds || []).length ? (f.cityIds.map(id => lists.cityName ? lists.cityName(id) : id).join(', ')) : 'Any';
  const noun = kind === 'brands' ? C3.findBrands.showN : C3.discover.showN;

  // ui-walk-fixes (board C, rule 3): the sheet is as tall as a small phone, so its "Show N" button
  // could end up off the screen. It now takes the Sheet's shrinking shape: the title row keeps its
  // place, the scrolling list of filters gives way, and the button is pinned under it. `fit="list"`
  // because the scrolling part is this sheet's own (it must not be put inside a second scroller).
  return (
    <Sheet visible={visible} onClose={onClose} testID="filters-sheet" fit="list"
      footer={<PrimaryButton label={count == null ? '…' : noun(count)} onPress={() => onApply(f)} disabled={count == null} testID="filters-apply" />}>
      <View style={s.head}>
        <Text style={s.title}>{C3.discover.filters}</Text>
        <TouchableOpacity onPress={() => setF({ ...defaults })} testID="filters-clear"><Text style={s.clear}>{C3.discover.clearAll}</Text></TouchableOpacity>
      </View>
      <ScrollView style={{ maxHeight: 460 }} keyboardShouldPersistTaps="handled">
        {kind === 'brands' ? (
          <>
            <SwitchRow testID="filter-canpitch" label={C3.findBrands.canPitchOnly} value={!!f.canPitchOnly} onValueChange={(v) => set({ canPitchOnly: v })} />
            <Group title={C3.findBrands.filterTitles.category}>
              <View style={s.chips}>{(lists.categories || []).map(c => <Chip key={c.code} testID={`filter-cat-${c.code}`} label={c.label} selected={(f.categoryCodes || []).includes(c.code)} onPress={() => toggle('categoryCodes', c.code)} />)}</View>
            </Group>
            <Group title={C3.findBrands.filterTitles.city}>
              <TouchableOpacity style={s.rowBtn} onPress={() => setCityPicker(true)} testID="filter-city"><Text style={s.rowBtnText}>{cityValue}</Text><Text style={s.chev}>›</Text></TouchableOpacity>
            </Group>
            <Group title={C3.findBrands.filterTitles.aims}>
              <View style={s.chips}>{AIMS.map(a => <Chip key={a} testID={`filter-aim-${a}`} label={aimLabel(a)} selected={(f.aims || []).includes(a)} onPress={() => toggle('aims', a)} />)}</View>
            </Group>
            <Group title={C3.findBrands.filterTitles.modes}>
              <View style={s.chips}>{MODES.map(m => <Chip key={m} testID={`filter-mode-${m}`} label={modeLabel(m)} selected={(f.modes || []).includes(m)} onPress={() => toggle('modes', m)} />)}</View>
            </Group>
          </>
        ) : (
          <>
            <SwitchRow testID="filter-openonly" label={C3.discover.openOnlyLong} value={!!f.openOnly} onValueChange={(v) => set({ openOnly: v })} />
            {/* creator-distance-and-visit-preference (D2): sort first, nearest first selected by default; then the distance chips. */}
            <Group title={C3.discover.filterTitles.sort}>
              <Buckets testID="filter-sort" options={Object.entries(C3.discover.sorts)} value={f.sort || CREATOR_DEFAULTS.sort} onChange={(v) => set({ sort: v })} />
            </Group>
            <Group title={C3.discover.filterTitles.distance}>
              <Buckets testID="filter-within" options={C3.discover.buckets.within} value={f.within || CREATOR_DEFAULTS.within} onChange={(v) => set({ within: v })} />
              <Text style={s.hint}>{C3.discover.distanceHint}</Text>
            </Group>
            <Group title={C3.discover.filterTitles.niche}>
              <View style={s.chips}>
                {shownNiches.map(n => <Chip key={n.code} testID={`filter-niche-${n.code}`} label={n.label} selected={(f.nicheCodes || []).includes(n.code)} onPress={() => toggle('nicheCodes', n.code)} />)}
                {!showAllNiches && niches.length > 4 ? <Chip label={`+${niches.length - 4} more`} onPress={() => setShowAllNiches(true)} /> : null}
              </View>
            </Group>
            <Group title={C3.discover.filterTitles.ig}><Buckets testID="filter-ig" options={C3.discover.buckets.followers} value={f.minInstagram} onChange={(v) => set({ minInstagram: v })} /></Group>
            <Group title={C3.discover.filterTitles.yt}><Buckets testID="filter-yt" options={C3.discover.buckets.followers} value={f.minYoutube} onChange={(v) => set({ minYoutube: v })} /></Group>
            <Group title={C3.discover.filterTitles.er}><Buckets testID="filter-er" options={C3.discover.buckets.er} value={f.minEngagement} onChange={(v) => set({ minEngagement: v })} /></Group>
            <Group title={C3.discover.filterTitles.city}>
              <TouchableOpacity style={s.rowBtn} onPress={() => setCityPicker(true)} testID="filter-city"><Text style={s.rowBtnText}>{cityValue}</Text><Text style={s.chev}>›</Text></TouchableOpacity>
            </Group>
            <Group title={C3.discover.filterTitles.language}>
              <View style={s.chips}>
                {shownLangs.map(l => <Chip key={l.code} testID={`filter-lang-${l.code}`} label={l.label} selected={(f.languageCodes || []).includes(l.code)} onPress={() => toggle('languageCodes', l.code)} />)}
                {!showAllLangs && langs.length > 3 ? <Chip label={`+${langs.length - 3} more`} onPress={() => setShowAllLangs(true)} /> : null}
              </View>
            </Group>
            <Group title={C3.discover.filterTitles.aims}>
              <View style={s.chips}>{AIMS.map(a => <Chip key={a} testID={`filter-aim-${a}`} label={aimLabel(a)} selected={(f.aims || []).includes(a)} onPress={() => toggle('aims', a)} />)}</View>
            </Group>
            <Group title={C3.discover.filterTitles.modes}>
              <View style={s.chips}>{MODES.map(m => <Chip key={m} testID={`filter-mode-${m}`} label={modeLabel(m)} selected={(f.modes || []).includes(m)} onPress={() => toggle('modes', m)} />)}</View>
            </Group>
          </>
        )}
      </ScrollView>
      <StateCityPicker visible={cityPicker} title={C3.discover.filterTitles.city} states={lists.states || []} value={f.cityIds || []}
        onApply={(ids) => { set({ cityIds: ids }); setCityPicker(false); }} onClose={() => setCityPicker(false)} />
    </Sheet>
  );
}

const s = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  title: { fontFamily: fonts.sansBold, fontSize: 17, color: T.ink },
  clear: { fontFamily: fonts.sansSemiBold, fontSize: 13, color: T.ink2 },
  group: { marginTop: 14 },
  groupTitle: { fontFamily: fonts.sansSemiBold, fontSize: 13, color: T.ink2, marginBottom: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
  hint: { fontFamily: fonts.sansRegular, fontSize: 12, color: T.ink3, marginTop: 2, lineHeight: 17 },
  rowBtn: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: T.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11 },
  rowBtnText: { flex: 1, fontFamily: fonts.sansMedium, fontSize: 14, color: T.ink },
  chev: { fontFamily: fonts.sansBold, fontSize: 18, color: T.ink3 },
});
