/**
 * BrandCreatorTermsScreen — I3 (Pay for Sale), I4 (Pay for Content), I5 (Hybrid): one screen
 * keyed by the set's Aim, with the set's own terms locked at the top, the creator's minimums as
 * a warning that never blocks, "Use these terms for everyone", and the follower offer sheets.
 * The draft lives in the app (draft5) until Send.
 * Contract: features/item5-invitations · prompt §6.3–§6.5, §7
 */
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { settingsTokens as T, fonts } from '../../theme/tokens';
import { brandApi } from '../../services/api';
import { PrimaryButton, SwitchRow, SettingRow, Chip, FieldError } from '../../components/settings/primitives';
import { ConfirmSheet } from '../../components/settings/sheets';
import { useToast } from '../../components/settings/feedback';
import { Header, NumberField, s as base } from './BrandPitchSettingsScreen';
import { TextField4 } from '../../components/campaigns/bits4';
import { Stepper5, LockedSetCard5, MinBox5, DeliverablesEditor5 } from '../../components/invitations/bits5';
import { OfferSheet5, SpecialOfferSheet5, ScopePickerSheet5, loadBrandProducts } from '../../components/invitations/sheets5';
import { C5, MSG5, USAGE_DURATIONS, USAGE_PLACES, SCOPE_LABEL, first, rupees5, fmtPct5, MIN_SHOPPABLE_POSTS } from '../../components/invitations/copy5';
import { getDraft, setTerms, setMinimums, copyTermsToAll, defaultTerms, validateLocal, scopeValue, markOver50Confirmed } from '../../components/invitations/draft5';

const TT = C5.terms;

export default function BrandCreatorTermsScreen({ navigation, route }) {
  const { campaignId, setId, index = 0 } = route?.params || {};
  const draft = getDraft(setId);
  const creator = draft ? draft.creators[index] : null;
  const goal = draft ? draft.set.goal : 'conversion';
  const [t, setT] = useState(() => (draft && creator ? (draft.terms[creator.id] || defaultTerms(goal)) : defaultTerms(goal)));
  const [errs, setErrs] = useState({});
  const [everyone, setEveryone] = useState(false);
  const [sheet, setSheet] = useState(null); // 'offer' | 'special' | 'category' | 'products' | 'over50'
  const [products, setProducts] = useState([]);
  const { toast, show } = useToast();

  // Products for the pickers and the preview's example; minimums for the warning (once per draft).
  useEffect(() => {
    let alive = true;
    loadBrandProducts().then(r => { if (alive) setProducts(r.rows || []); }).catch(() => {});
    if (draft && !Object.keys(draft.minimums || {}).length) {
      brandApi.checkEligibility(campaignId, setId, draft.creators.map(c => ({ influencerId: c.id })))
        .then(r => { if (!alive || !r.success) return; const by = {}; for (const x of r.data.results || []) by[x.influencerId] = x.minimums || {}; setMinimums(setId, by); setTick(x => x + 1); })
        .catch(() => {});
    }
    return () => { alive = false; };
  }, []); // eslint-disable-line
  const [, setTick] = useState(0);

  if (!draft || !creator) {
    return <View style={base.screen}><Header title={TT.title('')} onBack={() => navigation.goBack()} /><Text style={s.hint}>{MSG5.NOBODY_PICKED}</Text></View>;
  }
  const n = draft.creators.length;
  const last = index === n - 1;
  const f = first(creator.name);
  const mins = (draft.minimums || {})[creator.id] || {};
  const selling = goal === 'conversion' || goal === 'hybrid';
  const example = products.find(p => (t.productIds || []).includes(p.id)) || products[0] || null;

  const update = (patch) => { setT(prev => ({ ...prev, ...patch })); setErrs(prev => { const e = { ...prev }; for (const k of Object.keys(patch)) delete e[k]; if (patch.scope || patch.categoryNodeId || patch.productIds) delete e.scope; return e; }); };

  const belowCommission = mins.commissionPct != null && t.commissionPct !== '' && Number(t.commissionPct) < Number(mins.commissionPct);
  const belowFee = mins.fee != null && t.fee !== '' && Number(t.fee) < Number(mins.fee);

  function save() { setTerms(setId, creator.id, t); if (everyone) copyTermsToAll(setId, creator.id); }
  function proceed() {
    save();
    if (last) navigation.navigate('BrandReviewSend', { campaignId, setId });
    else navigation.push('BrandCreatorTerms', { campaignId, setId, index: index + 1 });
  }
  function next() {
    const e = validateLocal(goal, t);
    setErrs(e);
    if (Object.keys(e).length) return;
    if (selling && Number(t.commissionPct) > 50 && !draft.over50Confirmed) { setSheet('over50'); return; }
    proceed();
  }

  return (
    <View style={base.screen} testID={`creator-terms-${goal}`}>
      <Header title={TT.title(creator.name)} onBack={() => { save(); navigation.goBack(); }} />
      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
        <Stepper5 text={TT.step(index + 1, n)} />
        <LockedSetCard5 set={draft.set} />

        {goal === 'hybrid' ? (
          <Field label={TT.fixedFee} required error={errs.fee} hint={TT.fixedFeeHint}>
            <NumberField value={String(t.fee)} onChangeText={(v) => update({ fee: v })} placeholder="5,000" prefix="₹" testID="fee" />
            {belowFee ? <MinBox5 text={MSG5.BELOW_MIN(f, rupees5(mins.fee))} /> : mins.fee != null ? <Text style={s.hint}>{TT.minFee(f, rupees5(mins.fee))}</Text> : null}
          </Field>
        ) : null}

        {selling ? (
          <>
            <Field label={TT.commission} required error={errs.commissionPct}>
              <NumberField value={String(t.commissionPct)} onChangeText={(v) => update({ commissionPct: v })} placeholder="10" suffix="%" decimal testID="commission" />
              {mins.commissionPct != null ? <Text style={s.hint}>{TT.minCommission(f, fmtPct5(mins.commissionPct))}</Text> : null}
              {belowCommission ? <MinBox5 text={MSG5.BELOW_MIN(f, fmtPct5(mins.commissionPct))} testID="min-commission" /> : null}
            </Field>
            <Field label={TT.sell} error={errs.scope}>
              <View style={s.chips}>
                {['store', 'category', 'products'].map(k => (
                  <Chip key={k} label={SCOPE_LABEL[k]} selected={t.scope === k} onPress={() => { update({ scope: k }); if (k !== 'store') setSheet(k); }} testID={`scope-${k}`} />
                ))}
              </View>
              {t.scope !== 'store' ? (
                <View style={s.tagRow}>
                  <Text style={s.tagText} testID="scope-value">{scopeValue(t)}</Text>
                  <TouchableOpacity onPress={() => setSheet(t.scope)} testID="scope-change"><Text style={s.link}>{TT.change}</Text></TouchableOpacity>
                </View>
              ) : null}
            </Field>
            <SettingRow label={TT.offer} value={t.offer ? (t.offer.name || C5.offer.specialLine) : TT.none} onPress={() => setSheet('offer')} testID="offer-row" />
            <SettingRow label={TT.shoppable} value={`🔒 ${TT.shoppableValue(MIN_SHOPPABLE_POSTS)}`} testID="shoppable-row" />
          </>
        ) : null}

        {goal === 'engagement' ? (
          <>
            <Field label={TT.fee} required error={errs.fee} hint={TT.feeHint}>
              <NumberField value={String(t.fee)} onChangeText={(v) => update({ fee: v })} placeholder="8,000" prefix="₹" testID="fee" />
              {belowFee ? <MinBox5 text={MSG5.BELOW_MIN(f, rupees5(mins.fee))} testID="min-fee" /> : mins.fee != null ? <Text style={s.hint}>{TT.minFee(f, rupees5(mins.fee))}</Text> : null}
            </Field>
            <Field label={TT.delivers} required error={null}>
              <DeliverablesEditor5 rows={t.deliverables} onChange={(rows) => update({ deliverables: rows })} error={errs.deliverables} />
            </Field>
            <TextField4 label={TT.note} value={t.note} onChangeText={(v) => update({ note: v })} placeholder={TT.notePlaceholder} max={300} multiline error={errs.note} testID="note" />
            <SwitchRow label={TT.reuse} hint={TT.reuseHint} value={t.usage.on} onValueChange={(on) => update({ usage: { ...t.usage, on } })} testID="usage-switch" />
            {t.usage.on ? (
              <View>
                <View style={s.chips}>{USAGE_DURATIONS.map(([d, l]) => <Chip key={String(d)} label={l} selected={t.usage.durationDays === d} onPress={() => update({ usage: { ...t.usage, durationDays: d } })} testID={`usage-${d}`} />)}</View>
                <View style={s.chips}>{USAGE_PLACES.map(([p, l]) => { const on = t.usage.places.includes(p); return <Chip key={p} label={l} selected={on} onPress={() => update({ usage: { ...t.usage, places: on ? t.usage.places.filter(x => x !== p) : [...t.usage.places, p] } })} testID={`place-${p}`} />; })}</View>
                <FieldError text={errs.usage} />
              </View>
            ) : null}
          </>
        ) : null}

        {n > 1 ? <SwitchRow label={TT.everyone} hint={TT.everyoneHint} value={everyone} onValueChange={setEveryone} testID="everyone-switch" /> : null}
      </ScrollView>
      <View style={s.footer}>
        <PrimaryButton label={last ? TT.review : TT.next} onPress={next} testID="terms-next" />
      </View>
      {toast}

      <ScopePickerSheet5 visible={sheet === 'category' || sheet === 'products'} kind={sheet === 'category' ? 'category' : 'products'} products={products}
        value={{ categoryNodeId: t.categoryNodeId, productIds: t.productIds }}
        onApply={(v) => { update(v); setSheet(null); }} onClose={() => { if ((t.scope === 'category' && !t.categoryNodeId) || (t.scope === 'products' && !t.productIds.length)) update({ scope: 'store' }); setSheet(null); }} />
      <OfferSheet5 visible={sheet === 'offer'} creatorName={creator.name} value={t.offer} commissionPct={t.commissionPct} example={example}
        onUse={(v) => { update({ offer: v }); setSheet(null); }} onSpecial={() => setSheet('special')} onClose={() => setSheet(null)} />
      <SpecialOfferSheet5 visible={sheet === 'special'} creatorName={creator.name} products={products} postingDate={draft.set.postingDate} commissionPct={t.commissionPct} example={example} value={t.offer}
        onUse={(v) => { update({ offer: v }); setSheet(null); }} onClose={() => setSheet('offer')} />
      <ConfirmSheet visible={sheet === 'over50'} title={TT.over50Title} body={TT.over50Body} confirmLabel={TT.over50Yes} cancelLabel={TT.over50No}
        onConfirm={() => { markOver50Confirmed(setId); setSheet(null); proceed(); }} onCancel={() => setSheet(null)} />
    </View>
  );
}

function Field({ label, required, hint, error, children }) {
  return (
    <View style={s.field}>
      <Text style={s.label}>{label}{required ? <Text style={{ color: T.danger }}> *</Text> : null}</Text>
      {children}
      {hint ? <Text style={s.hint}>{hint}</Text> : null}
      <FieldError text={error} />
    </View>
  );
}

const s = StyleSheet.create({
  field: { marginBottom: 14 },
  label: { fontFamily: fonts.sansBold, fontSize: 13, color: T.ink, marginBottom: 6 },
  hint: { fontFamily: fonts.sansRegular, fontSize: 12, color: T.ink2, marginTop: 6, lineHeight: 16 },
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
  tagRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: T.surface, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, marginTop: 4 },
  tagText: { fontFamily: fonts.sansSemiBold, fontSize: 13, color: T.ink, flex: 1 },
  link: { fontFamily: fonts.sansBold, fontSize: 12.5, color: T.ink },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 14, paddingBottom: 22, backgroundColor: T.bg, borderTopWidth: 1, borderTopColor: T.border },
});
