/**
 * BrandPitchSettingsScreen — B2 · B3 · B5 · B6 · B8
 * "Who may send this brand a pitch." Rules v1.10 §8A · prompt §5.1.
 * Contract: features/item2-pitch-invitation-settings
 *
 * Public choices first (switch, Aims, modes — creators see these), private filters below
 * (only the brand sees them; a creator who fails is told only that she doesn't match).
 * Save stays grey until something changes and there are no errors. Turning the switch off
 * asks first (B5) and changes nothing until confirmed and saved.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { settingsTokens as T, fonts } from '../../theme/tokens';
import { brandApi, referenceApi } from '../../services/api';
import useUnsavedGuard from '../../hooks/useUnsavedGuard';
import {
  Chip, SettingRow, SwitchRow, Section, FieldError, Banner, StatusChip,
} from '../../components/settings/primitives';
import { PickerSheet, ConfirmSheet } from '../../components/settings/sheets';
import StateCityPicker from '../../components/settings/StateCityPicker';
import { SaveBar, useToast, Skeleton, LoadError } from '../../components/settings/feedback';
import { validateBrandSettings } from '../../components/settings/validation';
import { AIMS, MODES, aimLabel, modeLabel, COPY, shortDate } from '../../components/settings/copy';

const C = COPY.brand;

function toForm(s) {
  return {
    accepting: !!s.accepting,
    acceptedAims: [...(s.acceptedAims || [])],
    acceptedModes: [...(s.acceptedModes || [])],
    nicheCodes: s.nicheCodes || null,
    minFollowersInstagram: s.minFollowersInstagram == null ? '' : String(s.minFollowersInstagram),
    minFollowersYoutube: s.minFollowersYoutube == null ? '' : String(s.minFollowersYoutube),
    minEngagementRate: s.minEngagementRate == null ? '' : String(s.minEngagementRate),
    languageCodes: s.languageCodes || null,
    cityIds: s.cityIds || null,
    allowPastCreators: s.allowPastCreators !== false,
  };
}
function toPayload(f) {
  const numOrNull = (v) => (v === '' || v == null ? null : Number(v));
  return {
    accepting: f.accepting,
    acceptedAims: f.acceptedAims,
    acceptedModes: f.acceptedModes,
    nicheCodes: f.nicheCodes,
    minFollowersInstagram: numOrNull(f.minFollowersInstagram),
    minFollowersYoutube: numOrNull(f.minFollowersYoutube),
    minEngagementRate: numOrNull(f.minEngagementRate),
    languageCodes: f.languageCodes,
    cityIds: f.cityIds,
    allowPastCreators: f.allowPastCreators,
  };
}

export default function BrandPitchSettingsScreen({ navigation }) {
  const [status, setStatus] = useState('loading');   // loading | error | ready
  const [form, setForm] = useState(null);
  const [baseline, setBaseline] = useState(null);
  const [meta, setMeta] = useState({ openPitches: 0, blockedCount: 0, pausedAt: null });
  const [lists, setLists] = useState({ niches: [], languages: [], states: [] });
  const [serverErrors, setServerErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [sheet, setSheet] = useState(null);   // 'niches' | 'languages' | 'cities' | 'pause'
  const { toast, show } = useToast();

  const load = useCallback(async () => {
    setStatus('loading');
    const [s, n, l, st] = await Promise.all([
      brandApi.getPitchSettings(), referenceApi.creatorNiches(), referenceApi.languages(), referenceApi.states(),
    ]);
    if (!s.success) { setStatus('error'); return; }
    const f = toForm(s.data.settings);
    setForm(f); setBaseline(f);
    setMeta({ openPitches: s.data.openPitches || 0, blockedCount: s.data.blockedCount || 0, pausedAt: s.data.settings.pausedAt });
    setLists({
      niches: n.success ? n.data.items : [],
      languages: l.success ? l.data.items : [],
      states: st.success ? st.data.items : [],
    });
    setServerErrors({});
    setStatus('ready');
  }, []);
  useEffect(() => { load(); }, [load]);

  const dirty = !!form && JSON.stringify(form) !== JSON.stringify(baseline);
  const clientErrors = useMemo(() => (form ? validateBrandSettings(form) : {}), [form]);
  const errors = { ...serverErrors, ...clientErrors };
  const errorCount = Object.keys(errors).length;
  useUnsavedGuard(navigation, dirty && !saving);

  const set = (patch) => { setForm(f => ({ ...f, ...patch })); setServerErrors({}); };
  const toggleIn = (key, v) => set({ [key]: form[key].includes(v) ? form[key].filter(x => x !== v) : [...form[key], v] });

  async function save() {
    setSaving(true);
    const res = await brandApi.putPitchSettings(toPayload(form));
    setSaving(false);
    if (res.success) {
      const f = toForm(res.data.settings);
      setForm(f); setBaseline(f);
      setMeta({ openPitches: res.data.openPitches || 0, blockedCount: res.data.blockedCount || 0, pausedAt: res.data.settings.pausedAt });
      show(C.savedToast);
      return;
    }
    const fields = res.error?.details?.fields;
    if (Array.isArray(fields) && fields.length) {
      const e = {};
      for (const f of fields) e[f.field] = f.message;
      setServerErrors(e);
    } else {
      show(COPY.saveFailed);   // edits are kept
    }
  }

  if (status === 'loading') return <View style={s.screen}><Header title={C.title} onBack={() => navigation.goBack()} /><Skeleton /></View>;
  if (status === 'error') return <View style={s.screen}><Header title={C.title} onBack={() => navigation.goBack()} /><LoadError onRetry={load} /></View>;

  const paused = !form.accepting;
  const savedPaused = baseline && !baseline.accepting;
  const cityCounts = countCities(form.cityIds, lists.states);
  const nicheValue = form.nicheCodes ? `${form.nicheCodes.length} selected` : COPY.picker.any;
  const langValue = form.languageCodes ? `${form.languageCodes.length} selected` : COPY.picker.any;
  const cityValue = form.cityIds ? `${cityCounts.cities} ${cityCounts.cities === 1 ? 'city' : 'cities'} in ${cityCounts.states} ${cityCounts.states === 1 ? 'state' : 'states'}` : COPY.picker.any;

  return (
    <KeyboardAvoidingView style={s.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Header title={C.title} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
        {savedPaused ? (
          <Banner testID="paused-banner" title={C.pausedBannerTitle} body={C.pausedBannerBody(meta.openPitches)} />
        ) : null}

        <SwitchRow
          testID="accepting-switch"
          label={C.acceptingLabel}
          hint={savedPaused && meta.pausedAt ? C.pausedSince(shortDate(meta.pausedAt)) : C.acceptingHint}
          value={form.accepting}
          onValueChange={(v) => (v ? set({ accepting: true }) : setSheet('pause'))}
        />

        <Section title={C.aimsTitle} hint={paused ? C.keptHint : C.aimsHint} dimmed={paused}>
          <View style={s.chips}>
            {AIMS.map(a => <Chip key={a} testID={`aim-${a}`} label={aimLabel(a)} selected={form.acceptedAims.includes(a)} onPress={() => toggleIn('acceptedAims', a)} />)}
          </View>
          <FieldError text={errors.acceptedAims} />
        </Section>

        <Section title={C.modesTitle} dimmed={paused}>
          <View style={s.chips}>
            {MODES.map(m => <Chip key={m} testID={`mode-${m}`} label={modeLabel(m)} selected={form.acceptedModes.includes(m)} onPress={() => toggleIn('acceptedModes', m)} />)}
          </View>
          <FieldError text={errors.acceptedModes} />
        </Section>

        <Section title={C.whoTitle} dimmed={paused}>
          <Text style={s.hint}>{C.whoHint}</Text>
          <SettingRow testID="row-niches" label={C.niches} value={nicheValue} onPress={() => setSheet('niches')} error={errors.nicheCodes} />

          <View style={s.fieldBlock}>
            <Text style={s.label}>{C.minFollowers}</Text>
            <View style={s.twoCol}>
              <NumberField testID="min-ig" placeholder="Instagram" value={form.minFollowersInstagram} onChangeText={(t) => set({ minFollowersInstagram: t })} error={errors.minFollowersInstagram} />
              <View style={{ width: 10 }} />
              <NumberField testID="min-yt" placeholder="YouTube" value={form.minFollowersYoutube} onChangeText={(t) => set({ minFollowersYoutube: t })} error={errors.minFollowersYoutube} />
            </View>
            <Text style={s.hint}>{C.followersHint}</Text>
          </View>

          <View style={s.fieldBlock}>
            <Text style={s.label}>{C.minEngagement}</Text>
            <NumberField testID="min-er" placeholder={C.noMinimum} suffix="%" decimal value={form.minEngagementRate} onChangeText={(t) => set({ minEngagementRate: t })} error={errors.minEngagementRate} />
          </View>

          <SettingRow testID="row-languages" label={C.languages} value={langValue} onPress={() => setSheet('languages')} error={errors.languageCodes} />
          <SettingRow testID="row-cities" label={C.cities} value={cityValue} onPress={() => setSheet('cities')} error={errors.cityIds} />

          <SwitchRow testID="past-switch" label={C.pastLabel} hint={C.pastHint} value={form.allowPastCreators} onValueChange={(v) => set({ allowPastCreators: v })} />
        </Section>

        <Section>
          <SettingRow testID="row-blocked" label={C.blockedRow} value={meta.blockedCount ? String(meta.blockedCount) : COPY.picker.none} onPress={() => navigation.navigate('BrandBlockedCreators')} />
          {savedPaused ? (
            <SettingRow testID="row-open-pitches" label={C.openPitchesRow} value={C.openPitchesValue(meta.openPitches)} onPress={() => navigation.navigate('BrandPitchesPlaceholder')} />
          ) : null}
        </Section>
        <View style={{ height: 120 }} />
      </ScrollView>

      <SaveBar dirty={dirty} errorCount={errorCount} saving={saving} onSave={save} />
      {toast}

      <PickerSheet
        visible={sheet === 'niches'} title={C.niches} hint={C.nicheHint} items={lists.niches}
        value={form.nicheCodes} nounOne="niche" nounMany="niches" searchPlaceholder={COPY.picker.searchNiches}
        onApply={(v) => { set({ nicheCodes: v }); setSheet(null); }} onClose={() => setSheet(null)}
      />
      <PickerSheet
        visible={sheet === 'languages'} title={C.languages} items={lists.languages}
        value={form.languageCodes} nounOne="language" nounMany="languages" searchPlaceholder={COPY.picker.searchLanguages}
        onApply={(v) => { set({ languageCodes: v }); setSheet(null); }} onClose={() => setSheet(null)}
      />
      <StateCityPicker
        visible={sheet === 'cities'} title={C.cities} states={lists.states} value={form.cityIds || []}
        onApply={(ids) => { set({ cityIds: ids.length ? ids : null }); setSheet(null); }} onClose={() => setSheet(null)}
      />
      <ConfirmSheet
        visible={sheet === 'pause'}
        title={C.pauseTitle} body={C.pauseBody} info={C.pauseInfo}
        confirmLabel={C.pauseConfirm} cancelLabel={C.pauseCancel}
        onConfirm={() => { set({ accepting: false }); setSheet(null); }}
        onCancel={() => setSheet(null)}
      />
    </KeyboardAvoidingView>
  );
}

export function countCities(ids, states) {
  if (!ids || !ids.length) return { cities: 0, states: 0 };
  const set = new Set(ids.map(Number));
  let cities = 0; const st = new Set();
  for (const s of states || []) for (const c of s.cities || []) if (set.has(Number(c.id))) { cities += 1; st.add(s.id); }
  return { cities, states: st.size };
}

export function Header({ title, onBack, right }) {
  return (
    <View style={s.header}>
      <TouchableOpacity onPress={onBack} accessibilityRole="button" accessibilityLabel="Back" style={s.backBtn}>
        <Text style={s.backText}>‹</Text>
      </TouchableOpacity>
      <Text style={s.headerTitle} numberOfLines={1}>{title}</Text>
      <View style={s.headerRight}>{right || null}</View>
    </View>
  );
}

export function NumberField({ value, onChangeText, placeholder, prefix, suffix, decimal, error, testID }) {
  return (
    <View style={{ flex: 1 }}>
      <View style={[s.numWrap, error && s.numWrapErr]}>
        {prefix ? <Text style={s.suffix}>{prefix}</Text> : null}
        <TextInput
          testID={testID}
          style={s.num}
          value={value}
          onChangeText={(t) => onChangeText(decimal ? t.replace(/[^\d.]/g, '') : t.replace(/\D/g, ''))}
          placeholder={placeholder}
          placeholderTextColor={T.ink3}
          keyboardType={decimal ? 'decimal-pad' : 'number-pad'}
        />
        {suffix ? <Text style={s.suffix}>{suffix}</Text> : null}
      </View>
      <FieldError text={error} />
    </View>
  );
}

export const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: T.bg },
  header: { flexDirection: 'row', alignItems: 'center', paddingTop: 50, paddingBottom: 10, paddingHorizontal: 8, backgroundColor: T.bg, borderBottomWidth: 1, borderBottomColor: T.border },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  backText: { fontSize: 28, color: T.ink, fontFamily: fonts.sansMedium, marginTop: -4 },
  headerTitle: { flex: 1, fontFamily: fonts.sansBold, fontSize: 17, color: T.ink },
  headerRight: { minWidth: 40, alignItems: 'flex-end' },
  body: { padding: 18 },
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
  hint: { fontFamily: fonts.sansRegular, fontSize: 12, color: T.ink3, lineHeight: 17, marginBottom: 4 },
  label: { fontFamily: fonts.sansSemiBold, fontSize: 14, color: T.ink, marginBottom: 8 },
  fieldBlock: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: T.border },
  twoCol: { flexDirection: 'row' },
  numWrap: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: T.border, borderRadius: 10, backgroundColor: T.bg, paddingHorizontal: 12 },
  numWrapErr: { borderColor: T.danger },
  num: { flex: 1, fontFamily: fonts.sansMedium, fontSize: 15, color: T.ink, paddingVertical: 11 },
  suffix: { fontFamily: fonts.sansMedium, fontSize: 14, color: T.ink3, marginHorizontal: 4 },
});
