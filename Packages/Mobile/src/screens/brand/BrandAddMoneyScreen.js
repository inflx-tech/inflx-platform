/**
 * BrandAddMoneyScreen — W3 to W7. The screen that did not exist, which is why no brand has ever
 * been able to sign an agreement and no creator has ever been paid.
 * Contract: features/brand-wallet-on-the-phone
 *
 * route.params (all optional — without them this is the plain "Add money" of W3):
 *   need        the exact shortfall, pre-filled and offered as the first quick amount
 *   forWhom     her first name, so the screen can say what the money is for
 *   fee         her fee and
 *   campaignFee the campaign fee, the two halves of `need`
 *   returnTo    { screen, params } — where "Back to her agreement" goes
 *
 * ⚠️ NEVER call the Razorpay SDK directly from here. `services/payment.js` exists because opening
 * the sheet with a mock order id crashes the app NATIVELY, below the JS try/catch. It detects a
 * mock order and simulates instead. Production runs RAZORPAY_MOCK=true today.
 *
 * ⚠️ SUCCESS IS ONLY EVER DRAWN AFTER VERIFY SAYS SO. If the payment happened and our confirmation
 * failed, we say we could not confirm it — never "nothing was taken", which we do not know, and
 * never "money added", which we cannot promise.
 */
import React, { useState } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { settingsTokens as T, fonts } from '../../theme/tokens';
import { brandApi } from '../../services/api';
import { processPayment } from '../../services/payment';
import { PrimaryButton, SecondaryButton, FieldError } from '../../components/settings/primitives';
import { Header, s as base } from './BrandPitchSettingsScreen';
import { WALLET, rupeesW } from '../../components/wallet/copyW';

const A = WALLET.add;
const MAX = 1000000;

const clean = (v) => String(v || '').replace(/[^0-9]/g, '');
const grouped = (v) => (v ? Number(v).toLocaleString('en-IN') : '');

export default function BrandAddMoneyScreen({ navigation, route }) {
  const { need, forWhom, fee, campaignFee, returnTo } = route?.params || {};
  const [amount, setAmount] = useState(need ? String(Math.ceil(Number(need))) : '');
  const [error, setError] = useState(null);
  // idle | paying | done | failed | unsure
  const [phase, setPhase] = useState('idle');
  const [added, setAdded] = useState(null);
  const [balance, setBalance] = useState(null);

  const n = Number(clean(amount) || 0);
  const quick = need ? [Math.ceil(Number(need)), 25000, 50000] : A.quick;

  function validate() {
    if (!clean(amount)) { setError(A.errors.number); return false; }
    if (n < 1) { setError(A.errors.min); return false; }
    if (n > MAX) { setError(A.errors.max); return false; }
    setError(null);
    return true;
  }

  async function add() {
    if (!validate()) return;
    setPhase('paying');

    const order = await brandApi.createTopup(n);
    if (!order.success) { setPhase('failed'); setError(order.error?.message || null); return; }
    const d = order.data;

    // The helper owns the mock/live decision. Null means she cancelled or the bank refused.
    const paid = await processPayment({
      amount: d.amount, orderId: d.order_id, keyId: d.key_id,
      description: 'Add money to your INFLX wallet', brandName: 'INFLX',
    });
    if (!paid) { setPhase('failed'); return; }

    const ok = await brandApi.verifyTopup({
      razorpay_order_id: paid.razorpay_order_id,
      razorpay_payment_id: paid.razorpay_payment_id,
      razorpay_signature: paid.razorpay_signature,
    });
    // Paid, but we could not confirm it. Do not claim either outcome.
    if (!ok.success) { setPhase('unsure'); return; }

    setAdded(n);
    setBalance(Number(ok.data?.wallet?.available_balance ?? ok.data?.wallet_balance ?? 0) || null);
    setPhase('done');
  }

  const goBack = () => {
    if (returnTo && returnTo.screen) navigation.navigate(returnTo.screen, returnTo.params || {});
    else navigation.goBack();
  };

  // ── W5 · paying ────────────────────────────────────────────────────────────
  if (phase === 'paying') {
    return (
      <View style={base.screen} testID="add-money-paying">
        <Header title={A.title} onBack={() => {}} />
        <View style={{ padding: 18, alignItems: 'center' }}>
          <ActivityIndicator size="large" color={T.ink} style={{ marginTop: 38, marginBottom: 14 }} />
          <Text style={s.h}>{A.paying}</Text>
          <Text style={[s.hint, { textAlign: 'center' }]}>{A.payingHint}</Text>
          <View style={s.note}><Text style={s.noteT}>{A.testMode}</Text></View>
        </View>
      </View>
    );
  }

  // ── W6 · added ─────────────────────────────────────────────────────────────
  if (phase === 'done') {
    return (
      <View style={base.screen} testID="add-money-done">
        <Header title={A.title} onBack={goBack} />
        <View style={{ padding: 18, alignItems: 'center' }}>
          <View style={s.tick}><Text style={s.tickT}>✓</Text></View>
          <Text style={s.big} testID="added-amount">{A.addedTitle(added)}</Text>
          {balance != null ? <Text style={[s.hint, { textAlign: 'center' }]}>{A.addedBody(balance)}</Text> : null}
          <View style={{ height: 22, width: '100%' }} />
          <View style={{ width: '100%' }}>
            <PrimaryButton label={forWhom ? A.backTo(forWhom) : (returnTo ? A.backToAgreement : A.stay)}
              onPress={goBack} testID="added-back" />
          </View>
          {returnTo ? (
            <View style={{ width: '100%', marginTop: 9 }}>
              <SecondaryButton label={A.stay} onPress={() => navigation.navigate('BrandWallet')} testID="added-stay" />
            </View>
          ) : null}
          <View style={s.note}>
            <Text style={s.noteT}>{forWhom ? A.nothingCommitted(forWhom) : A.nothingCommittedPlain}</Text>
          </View>
        </View>
      </View>
    );
  }

  // ── W3 · W4 · W7 ───────────────────────────────────────────────────────────
  return (
    <View style={base.screen} testID="add-money">
      <Header title={A.title} onBack={goBack} />
      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">

        {phase === 'failed' ? (
          <View style={[s.box, { backgroundColor: T.state.yourMove.bg }]} testID="add-money-failed">
            <Text style={[s.boxH, { color: T.state.yourMove.fg }]}>{A.failedTitle}</Text>
            <Text style={[s.boxB, { color: T.state.yourMove.fg }]}>{A.failedBody}</Text>
          </View>
        ) : null}
        {phase === 'unsure' ? (
          <View style={[s.box, { backgroundColor: T.state.waiting.bg }]} testID="add-money-unsure">
            <Text style={[s.boxH, { color: T.state.waiting.fg }]}>{A.unsureTitle}</Text>
            <Text style={[s.boxB, { color: T.state.waiting.fg }]}>{A.unsureBody}</Text>
          </View>
        ) : null}

        {need && phase === 'idle' ? (
          <View style={[s.box, { backgroundColor: T.state.waiting.bg }]} testID="add-money-need">
            <Text style={[s.boxH, { color: T.state.waiting.fg }]}>{A.needTitle(forWhom || 'This', need)}</Text>
            <Text style={[s.boxB, { color: T.state.waiting.fg }]}>
              {fee != null && campaignFee != null ? A.needBody(forWhom || 'the creator', fee, campaignFee) : A.needBodyPlain(forWhom || 'the')}
            </Text>
          </View>
        ) : null}

        <Text style={s.label}>{A.howMuch}</Text>
        <View style={[s.field, error && s.fieldError]}>
          <Text style={s.cur}>₹</Text>
          <TextInput style={s.amt} value={grouped(clean(amount))} onChangeText={(v) => { setAmount(clean(v)); setError(null); }}
            keyboardType="number-pad" placeholder="0" placeholderTextColor={T.ink3} testID="add-amount" />
        </View>
        <FieldError text={error} />

        <View style={s.chips}>
          {quick.map((q, i) => {
            const on = n === q;
            return (
              <TouchableOpacity key={q} style={[s.chip, on && s.chipOn]} onPress={() => { setAmount(String(q)); setError(null); }}
                accessibilityRole="button" accessibilityState={{ selected: !!on }} testID={`quick-${q}`}>
                <Text style={[s.chipT, on && s.chipTOn]}>{need && i === 0 ? A.exact(q) : rupeesW(q)}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={s.hint}>{need ? A.extraStays : A.commitsNothing}</Text>

        <View style={{ marginTop: 20 }}>
          <PrimaryButton label={n > 0 ? A.cta(n) : A.ctaPlain} onPress={add} disabled={n <= 0}
            busy={false} testID="add-money-submit" />
        </View>
        <Text style={[s.tiny, { textAlign: 'center', marginTop: 9 }]}>{A.payBy}</Text>

        {phase === 'failed' || phase === 'unsure' ? (
          <View style={{ marginTop: 9 }}>
            <SecondaryButton label={returnTo ? A.backToAgreement : A.stay} onPress={goBack} testID="failed-back" />
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  label: { fontFamily: fonts.sansBold, fontSize: 11, letterSpacing: 0.7, color: T.ink3, textTransform: 'uppercase' },
  field: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: T.ink, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 4, marginTop: 7 },
  fieldError: { borderColor: T.danger },
  cur: { fontFamily: fonts.sansBold, fontSize: 19, color: T.ink3, marginRight: 8 },
  amt: { flex: 1, fontFamily: fonts.sansBold, fontSize: 23, color: T.ink, paddingVertical: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 10 },
  chip: { borderWidth: 1.5, borderColor: T.border, borderRadius: 999, paddingHorizontal: 13, paddingVertical: 7 },
  chipOn: { backgroundColor: T.ink, borderColor: T.ink },
  chipT: { fontFamily: fonts.sansBold, fontSize: 12.5, color: T.ink },
  chipTOn: { color: T.bg },
  hint: { fontFamily: fonts.sansRegular, fontSize: 12, color: T.ink2, lineHeight: 16.5, marginTop: 10 },
  tiny: { fontFamily: fonts.sansRegular, fontSize: 11.5, color: T.ink3 },
  h: { fontFamily: fonts.sansBold, fontSize: 15, color: T.ink },
  big: { fontFamily: fonts.sansBold, fontSize: 19, color: T.ink, marginTop: 2 },
  box: { borderRadius: 12, padding: 12, marginBottom: 12 },
  boxH: { fontFamily: fonts.sansBold, fontSize: 13.5 },
  boxB: { fontFamily: fonts.sansRegular, fontSize: 12.5, lineHeight: 17, marginTop: 3 },
  note: { backgroundColor: T.surface, borderRadius: 11, padding: 12, marginTop: 14, width: '100%' },
  noteT: { fontFamily: fonts.sansRegular, fontSize: 12.5, color: T.ink2, lineHeight: 17 },
  tick: { width: 52, height: 52, borderRadius: 26, backgroundColor: T.state.active.bg, alignItems: 'center', justifyContent: 'center', marginTop: 26, marginBottom: 12 },
  tickT: { fontFamily: fonts.sansBold, fontSize: 26, color: T.state.active.fg },
});
