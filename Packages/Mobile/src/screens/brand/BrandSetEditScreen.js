/**
 * BrandSetEditScreen — C4 (new set: name, Aim, mode, branch, every field error) and C5 (the
 * posting-date picker with the cutoff). Also edits a draft set, renames a live one, and is the
 * "Choose a new date" screen for a draft whose date passed.
 * Contract: features/item4-campaigns-sets · prompt §6.3
 *
 * route.params: { campaignId, campaignName, set?, dateRules?, suggestedName?, first? }
 *   set      the summary shape when editing (locked/lockedFields decide what is disabled)
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { settingsTokens as T, fonts } from '../../theme/tokens';
import { brandApi } from '../../services/api';
import { Chip, PrimaryButton, FieldError } from '../../components/settings/primitives';
import { useToast } from '../../components/settings/feedback';
import { COPY } from '../../components/settings/copy';
import { Header, s as base } from './BrandPitchSettingsScreen';
import DateField from '../../components/DateField';
import { TextField4 } from '../../components/campaigns/bits4';
import { BranchSheet4 } from '../../components/campaigns/sheets4';
import { C4, MSG4, AIMS4, MODES4 } from '../../components/campaigns/copy4';
import { C6 } from '../../components/negotiation/copy6';
import { startDraft } from '../../components/invitations/draft5';
import { addDays, earliestGoLiveDay } from '../../utils/setShape';
import { applyServerError } from '../../utils/serverError';

const S = C4.set;
/** The only error keys this form draws a line for. Anything else must be said out loud. */
const SET_FIELDS = ['name', 'goal', 'shoot_mode', 'branch_id', 'go_live_date'];
/** Posting date − 3 days, the same rule the server applies (campaignState.cutoffFor). */
export const cutoffFor = (day) => (day ? addDays(day, -3) : null);

export default function BrandSetEditScreen({ navigation, route }) {
  const { campaignId, campaignName, set: existing, suggestedName } = route?.params || {};
  // Item 6 (N15) — building a set for creators from the pool: the Aim, the mode and the date they
  // all asked for arrive already filled in. A wanted date that is now inside item 4's seven-day
  // floor is NOT pre-filled (APPROVAL Q7); the banner says so.
  const poolDefaults = route?.params?.poolDefaults || null;
  const editing = !!existing;
  const locked = !!(existing && existing.locked);
  const lockedFields = new Set((existing && existing.lockedFields) || []);
  const [rules, setRules] = useState(route?.params?.dateRules || null);
  const [branches, setBranches] = useState(null);
  const [name, setName] = useState(existing ? existing.name : (suggestedName || ''));
  const [goal, setGoal] = useState(existing ? existing.goal : (poolDefaults ? poolDefaults.goal : null));
  const [mode, setMode] = useState(existing ? existing.shootMode : (poolDefaults ? poolDefaults.shoot_mode : null));
  const [branchId, setBranchId] = useState(existing && existing.branch ? existing.branch.id : null);
  const [day, setDay] = useState(existing ? existing.postingDate : (poolDefaults ? poolDefaults.go_live_date : null));
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [pickBranch, setPickBranch] = useState(false);
  const { toast, show } = useToast();

  // The server owns the earliest date (A12); until it answers, the same rule computed here.
  const earliest = (rules && rules.earliestPostingDate) || earliestGoLiveDay();

  const loadRules = useCallback(async () => {
    if (rules) return;
    const r = await brandApi.campaignSummary(campaignId);
    if (r.success) setRules(r.data.dateRules);
  }, [campaignId, rules]);
  const loadBranches = useCallback(async () => {
    if (branches) return;
    const r = await brandApi.listBranches();
    setBranches(r.success ? (r.data.branches || []) : []);
  }, [branches]);
  useEffect(() => { loadRules(); }, [loadRules]);
  useEffect(() => { if (mode === 'visit') loadBranches(); }, [mode, loadBranches]);

  const branch = useMemo(() => (branches || []).find(b => b.id === branchId) || (existing && existing.branch) || null, [branches, branchId, existing]);
  const canEdit = (f) => !(locked && lockedFields.has(f));
  const clear = (f) => setErrors(x => ({ ...x, [f]: undefined }));

  async function save() {
    const e = {};
    if (!name.trim() || name.trim().length > S.nameMax) e.name = MSG4.SET_NAME;
    if (!goal) e.goal = MSG4.AIM;
    if (!mode) e.shoot_mode = MSG4.MODE;
    if (mode === 'visit' && !branchId) e.branch_id = MSG4.BRANCH;
    if (!day) e.go_live_date = MSG4.DATE;
    setErrors(e);
    if (Object.keys(e).length) return;
    setSaving(true);
    const body = { name: name.trim(), goal, shoot_mode: mode, branch_id: mode === 'visit' ? branchId : null, go_live_date: day };
    const r = editing ? await brandApi.updateCampaignSet(campaignId, existing.id, body) : await brandApi.createCampaignSet(campaignId, body);
    setSaving(false);
    if (!r.success) {
      // A refusal this form cannot draw — the plan's set limit, for one — is SPOKEN, not
      // filed under a field that does not exist. See utils/serverError.js.
      applyServerError(r.error, { fields: SET_FIELDS, setErrors, show, fallback: COPY.saveFailed });
      return;
    }
    if (editing) { navigation.navigate('BrandSetDetail', { campaignId, setId: existing.id, toast: S.saved }); return; }
    // From the pool (N15 → N16): the new set goes straight to the terms screen with the agreed
    // money already in the fields.
    if (poolDefaults && poolDefaults.creators && poolDefaults.creators.length) {
      const created = r.data.set;
      const creators = poolDefaults.creators.map(c => ({ id: c.influencerId, name: c.name, avatarUrl: c.avatarUrl || null, poolEntryId: c.entryId, poolTerms: c.terms, poolAgreedAt: c.agreedAt }));
      startDraft(created.id, { set: { ...created, goal, shootMode: mode, postingDate: day, cutoff: cutoffFor(day), branch: branch || null }, campaignName, creators, sourceGroupId: null });
      navigation.replace('BrandCreatorTerms', { campaignId, setId: created.id, index: 0 });
      return;
    }
    /**
     * A NEW set opens straight away and carries her on to the creators (founder, 2026-09-16).
     *
     * The stack is rebuilt rather than replaced because this screen is reached two ways — "Add
     * another set" from the campaign, and the first set right after creating the campaign. Both
     * must end up in the same place: campaigns → this campaign → the new set. Back from the set
     * is then the campaign she just filled, which the first-set path never used to show at all.
     */
    navigation.reset({
      index: 2,
      routes: [
        { name: 'BrandCampaigns' },
        { name: 'BrandCampaignDetail', params: { campaignId, name: campaignName } },
        { name: 'BrandSetDetail', params: { campaignId, setId: r.data.set.id, toast: S.saved, addCreators: true } },
      ],
    });
  }

  return (
    <View style={base.screen} testID="set-edit">
      <Header title={editing ? S.editTitle : S.newTitle} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
        {campaignName ? <Text style={s.stepnote}>{String(campaignName).toUpperCase()}</Text> : null}

        {poolDefaults ? (
          <View style={s.pool} testID="pool-banner">
            <Text style={s.poolT}>{C6.newSet.banner(poolDefaults.creators.length)}</Text>
            <Text style={s.poolS}>{C6.newSet.names(poolDefaults.creators.map(c => c.name).join(', '), poolDefaults.wantedDate)}</Text>
            {poolDefaults.dateNoLongerPossible ? <Text style={s.poolWarn} testID="pool-date-gone">{C6.newSet.dateGone(poolDefaults.wantedDate)}</Text> : null}
          </View>
        ) : null}

        <TextField4 label={S.nameLabel} required value={name} onChangeText={(v) => { setName(v); clear('name'); }} max={S.nameMax} hint={S.nameHint} error={errors.name} testID="set-name" />

        <Text style={s.label}>{S.aimLabel} <Text style={{ color: T.danger }}>*</Text></Text>
        {AIMS4.map(a => {
          const on = goal === a.code;
          return (
            <TouchableOpacity key={a.code} style={[s.aim, on && s.aimOn, !canEdit('goal') && s.dim]} onPress={() => { if (canEdit('goal')) { setGoal(a.code); clear('goal'); } }} disabled={!canEdit('goal')}
              accessibilityRole="radio" accessibilityState={{ selected: !!on, disabled: !canEdit('goal') }} testID={`aim-${a.code}`}>
              <Text style={s.aimT}>{a.label}</Text>
              <Text style={s.aimS}>{a.sub}</Text>
            </TouchableOpacity>
          );
        })}
        <FieldError text={errors.goal} />
        <Text style={s.hint}>{poolDefaults ? C6.newSet.aimNote(poolDefaults.creators.length, AIMS4.find(a => a.code === poolDefaults.goal)?.label || '') : S.aimHint}</Text>

        <Text style={[s.label, { marginTop: 16 }]}>{S.modeLabel} <Text style={{ color: T.danger }}>*</Text></Text>
        <View style={s.chips}>
          {MODES4.map(m => <Chip key={m.code} label={m.label} selected={mode === m.code} disabled={!canEdit('shoot_mode')} onPress={() => { setMode(m.code); clear('shoot_mode'); }} testID={`mode-${m.code}`} />)}
        </View>
        <FieldError text={errors.shoot_mode} />
        <Text style={s.hint}>{S.modeHint}</Text>

        {mode === 'visit' ? (
          <View style={{ marginTop: 16 }} testID="branch-row">
            <Text style={s.label}>{S.branchLabel} <Text style={{ color: T.danger }}>*</Text></Text>
            <TouchableOpacity style={[s.field, errors.branch_id && s.fieldError, !canEdit('branch_id') && s.dim]} onPress={() => canEdit('branch_id') && setPickBranch(true)} disabled={!canEdit('branch_id')} testID="branch-field" accessibilityRole="button">
              <Text style={[s.fieldT, !branch && s.placeholder]} numberOfLines={1}>{branch ? [branch.name, branch.cityName].filter(Boolean).join(', ') : S.branchPlaceholder}</Text>
              <Text style={s.caret}>›</Text>
            </TouchableOpacity>
            <FieldError text={errors.branch_id} />
            <Text style={s.hint}>{S.branchHint}</Text>
          </View>
        ) : null}

        <View style={{ marginTop: 16 }}>
          <DateField label={`${S.dateLabel} *`} value={day} onChange={(d) => { setDay(d); clear('go_live_date'); }} placeholder={S.datePlaceholder} minDate={earliest}
            confirmLabel={S.useDate} error={errors.go_live_date} testID="posting-date"
            renderFooter={(pending) => (
              <View>
                <Text style={s.hint}>{S.pickerHint(earliest)}</Text>
                {pending ? <View style={s.cut} testID="picker-cutoff"><Text style={s.cutText}>{S.pickerCutoff(cutoffFor(pending))}</Text></View> : null}
              </View>
            )} />
          {day ? <View style={s.cut} testID="cutoff-line"><Text style={s.cutText}>{poolDefaults && day === poolDefaults.go_live_date ? C6.newSet.dateHint(cutoffFor(day)) : S.cutoffLine(cutoffFor(day))}</Text></View> : null}
          <Text style={s.hint}>{S.dateHint}</Text>
          {locked ? <Text style={s.lock} testID="lock-note">🔒 {C4.setDetail.lockLive}</Text> : null}
        </View>
      </ScrollView>
      <View style={s.bar}>
        <PrimaryButton label={S.save} onPress={save} busy={saving} testID="save-set" />
      </View>
      <BranchSheet4 visible={pickBranch} branches={branches || []} value={branchId} onPick={(b) => { setBranchId(b.id); clear('branch_id'); setPickBranch(false); }} onClose={() => setPickBranch(false)} />
      {toast}
    </View>
  );
}

const s = StyleSheet.create({
  stepnote: { fontFamily: fonts.monoMedium, fontSize: 11, color: T.ink3, letterSpacing: 0.6, marginBottom: 12 },
  pool: { borderRadius: 12, padding: 11, backgroundColor: T.state.active.bg, marginBottom: 14 },
  poolT: { fontFamily: fonts.sansBold, fontSize: 13, color: T.state.active.fg },
  poolS: { fontFamily: fonts.sansRegular, fontSize: 12.5, color: T.state.active.fg, marginTop: 2, lineHeight: 17 },
  poolWarn: { fontFamily: fonts.sansSemiBold, fontSize: 12.5, color: T.state.yourMove.fg, marginTop: 6, lineHeight: 17 },
  label: { fontFamily: fonts.sansBold, fontSize: 13, color: T.ink, marginBottom: 8 },
  hint: { fontFamily: fonts.sansRegular, fontSize: 12, color: T.ink2, lineHeight: 16, marginTop: 6 },
  aim: { borderWidth: 1.5, borderColor: T.border, borderRadius: 12, paddingVertical: 9, paddingHorizontal: 11, marginBottom: 8 },
  aimOn: { borderColor: T.ink, backgroundColor: T.surface },
  aimT: { fontFamily: fonts.sansBold, fontSize: 13, color: T.ink },
  aimS: { fontFamily: fonts.sansRegular, fontSize: 11.5, color: T.ink2, marginTop: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  field: { height: 44, borderWidth: 1.5, borderColor: T.border, borderRadius: 12, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  fieldError: { borderColor: T.danger },
  fieldT: { fontFamily: fonts.sansSemiBold, fontSize: 14, color: T.ink, flex: 1 },
  placeholder: { color: T.ink3, fontFamily: fonts.sansRegular },
  caret: { fontSize: 18, color: T.ink3, marginLeft: 8 },
  cut: { marginTop: 8, borderRadius: 12, padding: 10, backgroundColor: T.state.waiting.bg },
  cutText: { fontFamily: fonts.sansSemiBold, fontSize: 12.5, color: T.state.waiting.fg },
  lock: { fontFamily: fonts.sansRegular, fontSize: 11.5, color: T.ink3, marginTop: 10 },
  dim: { opacity: 0.5 },
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 14, paddingBottom: 22, backgroundColor: T.bg, borderTopWidth: 1, borderTopColor: T.border },
});
