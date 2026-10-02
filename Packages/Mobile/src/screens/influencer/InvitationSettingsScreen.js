/**
 * InvitationSettingsScreen — C2 · C3 · C5 · C6 · B8 states
 * "Which brands may invite this creator." Rules v1.10 §8A · prompt §5.2.
 * Contract: features/item2-pitch-invitation-settings
 *
 * Order (C2): switch → Aims → modes → cities you can visit (only with Store Visit) →
 * brand categories → your minimums, one card per SELECTED Aim → blocked brands → Save.
 * Turning an Aim off hides its card; its numbers are kept (server keeps the rows; this
 * screen keeps them in state) and come back when the Aim is turned on again.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { settingsTokens as T, fonts } from '../../theme/tokens';
import { influencerApi, referenceApi } from '../../services/api';
import useUnsavedGuard from '../../hooks/useUnsavedGuard';
import { Chip, SettingRow, SwitchRow, Section, FieldError, InfoBox, TagRow } from '../../components/settings/primitives';
import { ConfirmSheet } from '../../components/settings/sheets';
import StateCityPicker from '../../components/settings/StateCityPicker';
import { SaveBar, useToast, Skeleton, LoadError } from '../../components/settings/feedback';
import { FormScroll, FormArea } from '../../components/shell/FormScroll';
import { validateCreatorSettings, visibleCommissionKeys, minimumsSummary } from '../../components/settings/validation';
import { AIMS, MODES, aimLabel, modeLabel, COPY, groupIndian } from '../../components/settings/copy';
import { Header, NumberField, s as base, countCities } from '../brand/BrandPitchSettingsScreen';

const C = COPY.creator;

function toForm(st) {
  const commissions = {};
  for (const r of st.minCommissions || []) commissions[`${r.aim}:${r.categoryCode}`] = r.pct == null ? '' : String(r.pct);
  return {
    open: !!st.open,
    acceptedAims: [...(st.acceptedAims || [])],
    acceptedModes: [...(st.acceptedModes || [])],
    visitCityIds: [...(st.visitCityIds || [])],
    brandCategoryCodes: st.brandCategoryCodes || null,
    minFeeEngagement: st.minFeeEngagement == null ? '' : String(st.minFeeEngagement),
    minFeeHybrid: st.minFeeHybrid == null ? '' : String(st.minFeeHybrid),
    commissions,
  };
}
function toPayload(f, baseline) {
  const numOrNull = (v) => (v === '' || v == null ? null : Number(v));
  const minCommissions = [];
  const keys = new Set([...Object.keys(f.commissions), ...Object.keys(baseline?.commissions || {})]);
  for (const k of keys) {
    const cur = f.commissions[k] ?? '';
    const was = baseline?.commissions?.[k] ?? '';
    if (cur === was) continue;
    const [aim, categoryCode] = k.split(':');
    minCommissions.push({ aim, categoryCode, pct: cur === '' ? null : Number(cur) });
  }
  return {
    open: f.open,
    acceptedAims: f.acceptedAims,
    acceptedModes: f.acceptedModes,
    visitCityIds: f.visitCityIds,
    brandCategoryCodes: f.brandCategoryCodes,
    minFeeEngagement: numOrNull(f.minFeeEngagement),
    minFeeHybrid: numOrNull(f.minFeeHybrid),
    minCommissions,
  };
}

export default function InvitationSettingsScreen({ navigation }) {
  const [status, setStatus] = useState('loading');
  const [form, setForm] = useState(null);
  const [baseline, setBaseline] = useState(null);
  const [saved, setSaved] = useState(null);          // last server settings (for C6 preview)
  const [meta, setMeta] = useState({ blockedCount: 0 });
  const [lists, setLists] = useState({ categories: [], states: [] });
  const [serverErrors, setServerErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [sheet, setSheet] = useState(null);           // 'cities' | 'pause'
  const [justSaved, setJustSaved] = useState(false);
  const { toast, show } = useToast({ inFlow: true });

  const load = useCallback(async () => {
    setStatus('loading');
    const [r, cats, st] = await Promise.all([
      influencerApi.getInvitationSettings(), referenceApi.brandCategories(), referenceApi.states(),
    ]);
    if (!r.success) { setStatus('error'); return; }
    const f = toForm(r.data.settings);
    setForm(f); setBaseline(f); setSaved(r.data.settings);
    setMeta({ blockedCount: r.data.blockedCount || 0 });
    setLists({ categories: cats.success ? cats.data.items : [], states: st.success ? st.data.items : [] });
    setServerErrors({});
    setStatus('ready');
  }, []);
  useEffect(() => { load(); }, [load]);

  const dirty = !!form && JSON.stringify(form) !== JSON.stringify(baseline);
  const clientErrors = useMemo(() => {
    if (!form) return {};
    // Only the commission rows currently on screen can block a save.
    const visible = new Set(visibleCommissionKeys(form.acceptedAims, form.brandCategoryCodes));
    const scoped = {};
    for (const k of visible) scoped[k] = form.commissions[k];
    return validateCreatorSettings({ ...form, commissions: scoped });
  }, [form]);
  const errors = { ...serverErrors, ...clientErrors };
  const errorCount = Object.keys(errors).length;
  useUnsavedGuard(navigation, dirty && !saving);

  const set = (patch) => { setForm(f => ({ ...f, ...patch })); setServerErrors({}); setJustSaved(false); };
  const toggleIn = (key, v) => set({ [key]: form[key].includes(v) ? form[key].filter(x => x !== v) : [...form[key], v] });
  const toggleCategory = (code) => {
    const cur = form.brandCategoryCodes || [];
    const next = cur.includes(code) ? cur.filter(c => c !== code) : [...cur, code];
    set({ brandCategoryCodes: next.length ? next : null });
  };
  const setCommission = (key, val) => set({ commissions: { ...form.commissions, [key]: val.replace(/[^\d.]/g, '') } });

  async function save() {
    setSaving(true);
    const res = await influencerApi.putInvitationSettings(toPayload(form, baseline));
    setSaving(false);
    if (res.success) {
      const f = toForm(res.data.settings);
      setForm(f); setBaseline(f); setSaved(res.data.settings);
      setMeta({ blockedCount: res.data.blockedCount || 0 });
      setJustSaved(true);
      show(C.savedToast);
      return;
    }
    const fields = res.error?.details?.fields;
    if (Array.isArray(fields) && fields.length) {
      const e = {};
      for (const f of fields) {
        const m = /^minCommissions\[(\d+)\]/.exec(f.field);
        e[m ? `commission:${Object.keys(form.commissions)[Number(m[1])] || m[1]}` : f.field] = f.message;
      }
      setServerErrors(e);
    } else {
      show(COPY.saveFailed);
    }
  }

  if (status === 'loading') return <View style={base.screen}><Header title={C.title} onBack={() => navigation.goBack()} /><Skeleton /></View>;
  if (status === 'error') return <View style={base.screen}><Header title={C.title} onBack={() => navigation.goBack()} /><LoadError onRetry={load} /></View>;

  const paused = !form.open;
  const visitOn = form.acceptedModes.includes('visit');
  const cats = form.brandCategoryCodes || [];
  const catLabel = (code) => (lists.categories.find(c => c.code === code) || {}).label || code;
  const cityCounts = countCities(form.visitCityIds, lists.states);
  const cityNames = cityNamesFor(form.visitCityIds, lists.states);
  // creator-distance-and-visit-preference (D3): no cities = anywhere, said in words under the row.
  const visitAnywhere = form.visitCityIds.length === 0;
  const visitValue = visitAnywhere ? C.visitAnywhere
    : form.visitCityIds.length <= 2 ? cityNames.join(', ')
    : `${cityCounts.cities} cities in ${cityCounts.states} ${cityCounts.states === 1 ? 'state' : 'states'}`;
  const industries = cats.length ? cats.map(c => ({ code: c, label: catLabel(c) })) : [{ code: 'ALL', label: C.allIndustries }];

  const commissionRows = (aim) => (
    <View>
      {industries.map(ind => {
        const key = `${aim}:${ind.code}`;
        return (
          <View key={key} style={cs.pctRow}>
            <Text style={cs.pctLabel}>{ind.label}</Text>
            <View style={{ width: 120 }}>
              <NumberField testID={`pct-${key}`} placeholder={C.noMinPct} suffix="%" decimal value={form.commissions[key] || ''} onChangeText={(t) => setCommission(key, t)} error={errors[`commission:${key}`]} />
            </View>
          </View>
        );
      })}
      {!cats.length ? <Text style={base.hint}>{C.perIndustryHint}</Text> : null}
    </View>
  );

  return (
    <KeyboardAvoidingView style={base.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Header title={C.title} onBack={() => navigation.goBack()} />
      {/* ui-walk-fixes board C: the form scrolls in the room above the Save strip; nothing floats over it. */}
      <FormArea>
      <FormScroll contentContainerStyle={base.body}>
        <SwitchRow testID="open-switch" label={C.openLabel} hint={C.openHint} value={form.open}
          onValueChange={(v) => (v ? set({ open: true }) : setSheet('pause'))} />

        {justSaved && saved ? (
          <View style={cs.preview} testID="public-preview">
            <Text style={cs.previewTitle}>{C.previewTitle}</Text>
            <TagRow items={[...AIMS.filter(a => saved.acceptedAims.includes(a)).map(aimLabel), ...MODES.filter(m => saved.acceptedModes.includes(m)).map(modeLabel)]} />
            <Text style={base.hint}>{C.previewHint}</Text>
            <SettingRow label={C.categoriesTitle} value={(saved.brandCategoryCodes || []).length ? saved.brandCategoryCodes.map(catLabel).join(', ') : COPY.picker.any} />
            <SettingRow label={C.yourMinimums} value={minimumsSummary(saved, groupIndian)} />
          </View>
        ) : null}

        <Section title={C.aimsTitle} hint={C.aimsHint} dimmed={paused}>
          <View style={base.chips}>
            {AIMS.map(a => <Chip key={a} testID={`aim-${a}`} label={aimLabel(a)} selected={form.acceptedAims.includes(a)} onPress={() => toggleIn('acceptedAims', a)} />)}
          </View>
          <FieldError text={errors.acceptedAims} />
        </Section>

        <Section title={C.modesTitle} dimmed={paused}>
          <View style={base.chips}>
            {MODES.map(m => <Chip key={m} testID={`mode-${m}`} label={modeLabel(m)} selected={form.acceptedModes.includes(m)} onPress={() => toggleIn('acceptedModes', m)} />)}
          </View>
          <FieldError text={errors.acceptedModes} />
          {visitOn ? (
            <SettingRow testID="row-visit-cities" label={C.visitCities} value={visitValue} hint={visitAnywhere ? C.visitAnywhereHint : undefined} onPress={() => setSheet('cities')} error={errors.visitCityIds} />
          ) : null}
        </Section>

        <Section title={C.categoriesTitle} hint={C.categoriesHint} dimmed={paused}>
          <View style={base.chips}>
            {lists.categories.map(c => <Chip key={c.code} testID={`cat-${c.code}`} label={c.label} selected={cats.includes(c.code)} onPress={() => toggleCategory(c.code)} />)}
          </View>
          <FieldError text={errors.brandCategoryCodes} />
        </Section>

        <Section title={C.minimumsTitle} dimmed={paused}>
          <Text style={base.hint}>{C.minimumsHint}</Text>

          {form.acceptedAims.includes('engagement') ? (
            <View style={cs.card} testID="card-engagement">
              <Text style={cs.cardTitle}>{C.contentCard} <Text style={cs.cardSub}>{C.contentSub}</Text></Text>
              <NumberField testID="fee-engagement" placeholder={C.noMinimum} prefix="₹" value={form.minFeeEngagement} onChangeText={(t) => set({ minFeeEngagement: t })} error={errors.minFeeEngagement} />
            </View>
          ) : null}

          {form.acceptedAims.includes('conversion') ? (
            <View style={cs.card} testID="card-conversion">
              <Text style={cs.cardTitle}>{C.saleCard} <Text style={cs.cardSub}>{C.saleSub}</Text></Text>
              {commissionRows('conversion')}
            </View>
          ) : null}

          {form.acceptedAims.includes('hybrid') ? (
            <View style={cs.card} testID="card-hybrid">
              <Text style={cs.cardTitle}>{C.hybridCard} <Text style={cs.cardSub}>{C.hybridSub}</Text></Text>
              <NumberField testID="fee-hybrid" placeholder={C.noMinimumFixedFee} prefix="₹" value={form.minFeeHybrid} onChangeText={(t) => set({ minFeeHybrid: t })} error={errors.minFeeHybrid} />
              <View style={{ height: 8 }} />
              {commissionRows('hybrid')}
            </View>
          ) : null}

          {dirty ? <InfoBox text={C.aimOffInfo} /> : null}
        </Section>

        <Section>
          <SettingRow testID="row-blocked" label={C.blockedRow} value={meta.blockedCount ? String(meta.blockedCount) : COPY.picker.none} onPress={() => navigation.navigate('BlockedBrands')} />
        </Section>
      </FormScroll>
      {toast}
      </FormArea>

      <SaveBar dirty={dirty} errorCount={errorCount} saving={saving} onSave={save} />

      <StateCityPicker
        visible={sheet === 'cities'} title={C.visitCities} states={lists.states} value={form.visitCityIds}
        onApply={(ids) => { set({ visitCityIds: ids }); setSheet(null); }} onClose={() => setSheet(null)}
      />
      <ConfirmSheet
        visible={sheet === 'pause'}
        title={C.pauseTitle} body={C.pauseBody} info={C.pauseInfo}
        confirmLabel={C.pauseConfirm} cancelLabel={C.pauseCancel}
        onConfirm={() => { set({ open: false }); setSheet(null); }}
        onCancel={() => setSheet(null)}
      />
    </KeyboardAvoidingView>
  );
}

function cityNamesFor(ids, states) {
  const out = [];
  const set = new Set((ids || []).map(Number));
  for (const s of states || []) for (const c of s.cities || []) if (set.has(Number(c.id))) out.push(c.name);
  return out;
}

const cs = StyleSheet.create({
  card: { borderWidth: 1, borderColor: T.border, borderRadius: 12, padding: 14, marginTop: 10, backgroundColor: T.bg },
  cardTitle: { fontFamily: fonts.sansBold, fontSize: 14.5, color: T.ink, marginBottom: 10 },
  cardSub: { fontFamily: fonts.sansRegular, fontSize: 12.5, color: T.ink3 },
  pctRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6 },
  pctLabel: { fontFamily: fonts.sansMedium, fontSize: 13.5, color: T.ink, flex: 1, marginRight: 10 },
  preview: { backgroundColor: T.surface, borderRadius: 12, padding: 14, marginTop: 12 },
  previewTitle: { fontFamily: fonts.sansSemiBold, fontSize: 13.5, color: T.ink, marginBottom: 8 },
});
