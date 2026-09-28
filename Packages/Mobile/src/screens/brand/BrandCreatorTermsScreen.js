/**
 * BrandCreatorTermsScreen — I3 (Pay for Sale), I4 (Pay for Content), I5 (Hybrid): one screen
 * keyed by the set's Aim, with the set's own terms locked at the top, the creator's minimums as
 * a warning that never blocks, "Use these terms for everyone", and what she can sell.
 * creator-terms-v2 (T1, T5; rules §2): what she can sell is her OFFERS + PRODUCTS WITHOUT OFFERS —
 * the whole-store / category / products chips and the follower / special offer sheets are retired.
 * The draft lives in the app (draft5) until Send.
 * Contract: features/item5-invitations · prompt §6.3–§6.5, §7
 */
import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { settingsTokens as T, fonts } from '../../theme/tokens';
import { brandApi } from '../../services/api';
import { PrimaryButton, SwitchRow, SettingRow, Chip, FieldError } from '../../components/settings/primitives';
import { ConfirmSheet } from '../../components/settings/sheets';
import { useToast } from '../../components/settings/feedback';
import { Header, NumberField, s as base } from './BrandPitchSettingsScreen';
import { TextField4 } from '../../components/campaigns/bits4';
import { Stepper5, LockedSetCard5, MinBox5, DeliverablesEditor5 } from '../../components/invitations/bits5';
import { OffersSheet, ProductsSheet, ChooseProductsModal } from '../../components/invitations/sellSheets';
import { C5, MSG5, USAGE_DURATIONS, USAGE_PLACES, first, rupees5, fmtPct5, MIN_SHOPPABLE_POSTS } from '../../components/invitations/copy5';
import { C6 } from '../../components/negotiation/copy6';
import { getDraft, setTerms, setMinimums, copyTermsToAll, defaultTerms, validateLocal, sellProductCount, markOver50Confirmed } from '../../components/invitations/draft5';

const TT = C5.terms;
const SL = C5.sell;

export default function BrandCreatorTermsScreen({ navigation, route }) {
  const { campaignId, setId, index = 0 } = route?.params || {};
  const draft = getDraft(setId);
  const creator = draft ? draft.creators[index] : null;
  const goal = draft ? draft.set.goal : 'conversion';
  const [t, setT] = useState(() => (draft && creator ? (draft.terms[creator.id] || defaultTerms(goal)) : defaultTerms(goal)));
  const [errs, setErrs] = useState({});
  const [everyone, setEveryone] = useState(false);
  const [sheet, setSheet] = useState(null); // 'offers' | 'products' | 'choose' | 'over50'
  const { toast } = useToast();

  // The creators' own minimums, for the warning (once per draft).
  useEffect(() => {
    let alive = true;
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
  const offersN = (t.sellOffers || []).length;
  const offerProducts = (t.sellOffers || []).reduce((a, o) => a + (o.products || 0), 0);
  const productsN = sellProductCount(t);

  const update = (patch) => { setT(prev => ({ ...prev, ...patch })); setErrs(prev => { const e = { ...prev }; for (const k of Object.keys(patch)) delete e[k]; if (patch.sellOffers || patch.sellMode) delete e.sell; return e; }); };

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
        {/* Item 6 (N16): filled in from what was agreed in the pool. */}
        {creator.poolTerms ? <View style={s.pool} testID="from-pool"><Text style={s.poolText}>{C6.terms.filled(f, creator.poolAgreedAt)}</Text></View> : null}
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
              {creator.poolTerms ? <Text style={s.hint} testID="pool-field-hint">{C6.terms.fieldHint(f)}</Text> : null}
              {mins.commissionPct != null ? <Text style={s.hint}>{TT.minCommission(f, fmtPct5(mins.commissionPct))}</Text> : null}
              {belowCommission ? <MinBox5 text={MSG5.BELOW_MIN(f, fmtPct5(mins.commissionPct))} testID="min-commission" /> : null}
            </Field>
            {/* creator-terms-v2 (T1, T5): two rows replace the scope chips and the follower offer. */}
            <Text style={s.label}>{TT.sell}<Text style={{ color: T.danger }}> *</Text></Text>
            <SellRow title={SL.offers} set={offersN > 0} testID="sell-offers" onPress={() => setSheet('offers')}
              sub={offersN ? SL.offersValue(offersN, offerProducts) : SL.offersNone} />
            <SellRow title={SL.productsWithout} set={productsN > 0} testID="sell-products" onPress={() => setSheet('products')}
              sub={productsN ? SL.productsValue(productsN) : SL.productsNone} />
            {errs.sell ? <View style={s.errBox} testID="sell-error"><Text style={s.errText}>⚠ {MSG5.SELL_NOTHING(f)}</Text></View> : null}
            {offersN || productsN ? (
              <View style={s.sum} testID="sell-summary">
                <Text style={s.sumMain}>{SL.summary(offersN, offerProducts, productsN)}</Text>
                {t.commissionPct !== '' ? <Text style={s.sumSub}>{SL.summaryMoney(fmtPct5(t.commissionPct))}</Text> : null}
              </View>
            ) : null}
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

        {n > 1 ? <SwitchRow label={TT.everyone} hint={selling ? SL.everyoneHint : TT.everyoneHint} value={everyone} onValueChange={setEveryone} testID="everyone-switch" /> : null}
      </ScrollView>
      <View style={s.footer}>
        <PrimaryButton label={last ? TT.review : TT.next} onPress={next} testID="terms-next" />
      </View>
      {toast}

      <OffersSheet visible={sheet === 'offers'} campaignId={campaignId} setId={setId} postingDate={draft.set.postingDate} creatorName={creator.name}
        value={t.sellOffers} onUse={(list) => { update({ sellOffers: list }); setSheet(null); }} onClose={() => setSheet(null)} />
      <ProductsSheet visible={sheet === 'products'} campaignId={campaignId} setId={setId} postingDate={draft.set.postingDate}
        value={{ mode: t.sellMode, ids: t.sellProductIds, products: t.sellProducts, allCount: t.sellAllCount }}
        onUse={(v) => { update({ sellMode: v.mode, sellProductIds: v.ids || [], sellProducts: v.products || [], sellAllCount: v.allCount || 0 }); setSheet(null); }}
        onChoose={() => setSheet('choose')} onClose={() => setSheet(null)} />
      <ChooseProductsModal visible={sheet === 'choose'} campaignId={campaignId} setId={setId}
        value={{ ids: t.sellProductIds, products: t.sellProducts }}
        onUse={(ids, prods) => { update({ sellMode: ids.length ? 'chosen' : 'none', sellProductIds: ids, sellProducts: prods, sellAllCount: 0 }); setSheet('products'); }}
        onClose={() => setSheet('products')} />
      <ConfirmSheet visible={sheet === 'over50'} title={TT.over50Title} body={TT.over50Body} confirmLabel={TT.over50Yes} cancelLabel={TT.over50No}
        onConfirm={() => { markOver50Confirmed(setId); setSheet(null); proceed(); }} onCancel={() => setSheet(null)} />
    </View>
  );
}

/** T1 — one of the two "what she can sell" rows. */
function SellRow({ title, sub, set, onPress, testID }) {
  return (
    <TouchableOpacity style={[s.sellRow, set && s.sellRowSet]} onPress={onPress} testID={testID} accessibilityRole="button">
      <View style={{ flex: 1 }}><Text style={s.sellTitle}>{title}</Text><Text style={s.sellSub}>{sub}</Text></View>
      <Text style={s.chev}>›</Text>
    </TouchableOpacity>
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
  pool: { borderRadius: 12, padding: 10, backgroundColor: T.state.active.bg, marginBottom: 12 },
  poolText: { fontFamily: fonts.sansSemiBold, fontSize: 12.5, color: T.state.active.fg, lineHeight: 17 },
  label: { fontFamily: fonts.sansBold, fontSize: 13, color: T.ink, marginBottom: 6 },
  hint: { fontFamily: fonts.sansRegular, fontSize: 12, color: T.ink2, marginTop: 6, lineHeight: 16 },
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
  link: { fontFamily: fonts.sansBold, fontSize: 12.5, color: T.ink },
  sellRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: T.border, borderRadius: 12, paddingHorizontal: 11, paddingVertical: 10, marginBottom: 8 },
  sellRowSet: { borderColor: T.ink },
  sellTitle: { fontFamily: fonts.sansBold, fontSize: 13, color: T.ink },
  sellSub: { fontFamily: fonts.sansRegular, fontSize: 11.5, color: T.ink2, marginTop: 1 },
  chev: { fontSize: 18, color: T.ink3, marginLeft: 8 },
  errBox: { borderRadius: 12, padding: 10, backgroundColor: T.dangerSoft, marginBottom: 8 },
  errText: { fontFamily: fonts.sansSemiBold, fontSize: 12.5, color: T.danger },
  sum: { borderRadius: 12, padding: 11, backgroundColor: T.surface, marginBottom: 10 },
  sumMain: { fontFamily: fonts.sansBold, fontSize: 13, color: T.ink },
  sumSub: { fontFamily: fonts.sansRegular, fontSize: 12.5, color: T.ink2, marginTop: 2 },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 14, paddingBottom: 22, backgroundColor: T.bg, borderTopWidth: 1, borderTopColor: T.border },
});
