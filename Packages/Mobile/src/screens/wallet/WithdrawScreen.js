/**
 * Item 17 — Withdraw (BW7, BW9 for the brand; CW5 for the creator). One screen, two sides.
 * Contract: features/item17-wallet · master rules v1.31 §17A
 *
 * A withdrawal is a REQUEST. The amount goes on hold at once, INFLX pays it from its bank and
 * marks it processed. The server decides everything — what is available, the minimum, where it
 * can be sent, and why it cannot be asked for right now (`blocked`); this screen only says it.
 * The full amount is paid: nothing is deducted and nothing here mentions tax.
 *
 * route.params.side: 'brand' | 'creator' (set by the navigator).
 */
import React, { useCallback, useState } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { settingsTokens as T, fonts } from '../../theme/tokens';
import { brandApi, influencerApi } from '../../services/api';
import { PrimaryButton, SecondaryButton, TextButton, FieldError } from '../../components/settings/primitives';
import { Skeleton, LoadError } from '../../components/settings/feedback';
import { Header, s as base } from '../brand/BrandPitchSettingsScreen';
import { W17, inr } from '../../components/wallet/copy17';
import { Box17, GreyBox17, s as b } from '../../components/wallet/bits17';

const clean = (v) => String(v || '').replace(/[^0-9]/g, '');
const grouped = (v) => (v ? Number(v).toLocaleString('en-IN') : '');
const QUICK = [50000, 20000, 10000, 5000, 2000, 1000, 500];

export const ROUTES17 = {
  brand: { home: 'BrandWallet', withdrawals: 'BrandWithdrawals', details: ['BrandPayoutDetail', { kind: 'bank', returnTo: 'BrandWithdraw' }] },
  creator: { home: 'CreatorWallet', withdrawals: 'CreatorWithdrawals', details: ['CreatorWalletDetails', {}] },
};

export default function WithdrawScreen({ navigation, route }) {
  const side = route?.params?.side === 'creator' ? 'creator' : 'brand';
  const api = side === 'creator' ? influencerApi : brandApi;
  const R = ROUTES17[side];
  const [status, setStatus] = useState('loading');
  const [o, setO] = useState(null);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setStatus((st) => (st === 'ready' ? 'ready' : 'loading'));
    const r = await api.getWithdrawOptions();
    if (!r.success) { setStatus('error'); return; }
    setO(r.data);
    setMethod((m) => m || (r.data.sendTo[0] && r.data.sendTo[0].method) || null);
    setStatus('ready');
  }, [api]);
  // Refetch on focus: she may have just added her bank account.
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const back = () => navigation.goBack();
  if (status === 'loading') return <View style={base.screen} testID="withdraw-loading"><Header title={W17.withdraw} onBack={back} /><Skeleton /></View>;
  if (status === 'error') return <View style={base.screen} testID="withdraw-error"><Header title={W17.withdraw} onBack={back} /><LoadError onRetry={load} /></View>;

  const past = <View style={{ marginTop: 14 }}><TextButton label={W17.seeWithdrawals} onPress={() => navigation.navigate(R.withdrawals)} testID="withdraw-past" /></View>;

  // ── BW9 — it cannot be requested right now, and why ────────────────────────
  if (o.blocked) {
    const noDetails = o.blocked.code === 'NO_DETAILS';
    return (
      <View style={base.screen} testID="withdraw-blocked">
        <Header title={W17.withdraw} onBack={back} />
        <ScrollView contentContainerStyle={{ padding: 18 }}>
          {noDetails ? (
            <View style={s.empty} testID="withdraw-no-details">
              <Text style={s.emptyT}>{side === 'brand' ? W17.addBankTitle : W17.addDetailsTitle}</Text>
              <Text style={s.emptyB}>{W17.addBankBody}</Text>
              <View style={{ alignSelf: 'stretch', marginTop: 12 }}>
                <SecondaryButton label={side === 'brand' ? W17.addBank : W17.addDetails}
                  onPress={() => navigation.navigate(R.details[0], R.details[1])} testID="withdraw-add-details" />
              </View>
            </View>
          ) : (
            <Box17 tone="waiting" text={o.blocked.message} testID={`withdraw-blocked-${o.blocked.code}`} />
          )}
          {past}
        </ScrollView>
      </View>
    );
  }

  const n = Number(clean(amount) || 0);
  const quick = QUICK.filter((q) => q < o.available && q >= o.minimum).slice(0, 2).reverse();
  const picked = o.sendTo.find((x) => x.method === method) || o.sendTo[0];

  function check(v) {
    if (!v) return W17.errMin(o.minimum, o.available);
    if (v < o.minimum) return W17.errMin(o.minimum, o.available);
    if (v > o.available) return W17.errMax(o.available);
    return null;
  }
  const set = (v) => { setAmount(clean(v)); setError(null); };

  async function send() {
    const bad = check(n);
    if (bad) { setError(bad); return; }
    setBusy(true);
    const r = side === 'creator' ? await api.requestWithdrawal(n, picked.method) : await api.requestWithdrawal(n);
    setBusy(false);
    if (!r.success) {
      setError((r.error && r.error.message) || 'Something went wrong. Try again.');
      load();                        // what blocks it may have changed (another device, a second tap)
      return;
    }
    navigation.navigate(R.home, { toast: W17.requested(inr(n)) });
  }

  return (
    <View style={base.screen} testID="withdraw">
      <Header title={W17.withdraw} onBack={back} />
      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
        <Text style={s.lbl}>{W17.howMuch}</Text>
        <View style={[s.big, error && { borderColor: T.danger }]}>
          <Text style={s.pre}>₹</Text>
          <TextInput testID="withdraw-amount" style={s.input} value={grouped(amount)} onChangeText={set}
            keyboardType="number-pad" placeholder="0" placeholderTextColor={T.ink3} maxLength={12} />
        </View>
        {error ? <FieldError text={error} /> : null}
        <Text style={b.hint}>{W17.availMin(o.available, o.minimum)}</Text>

        <View style={s.chips}>
          {quick.map((q) => (
            <TouchableOpacity key={q} style={[s.opt, n === q && s.optOn]} onPress={() => set(String(q))} activeOpacity={0.8} testID={`withdraw-quick-${q}`}>
              <Text style={[s.optT, n === q && s.optTOn]}>{inr(q)}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={[s.opt, n === Math.floor(o.available) && s.optOn]} onPress={() => set(String(Math.floor(o.available)))} activeOpacity={0.8} testID="withdraw-all">
            <Text style={[s.optT, n === Math.floor(o.available) && s.optTOn]}>{W17.all(Math.floor(o.available))}</Text>
          </TouchableOpacity>
        </View>

        {side === 'brand' ? (
          <View style={b.card} testID="withdraw-sent-to">
            <Text style={b.crumbs}>{W17.sentTo}</Text>
            <View style={[b.cardHead, { marginTop: 5 }]}>
              <Text style={b.cardTitle}>{picked.label}</Text>
              <TouchableOpacity onPress={() => navigation.navigate(R.details[0], R.details[1])} testID="withdraw-change">
                <Text style={s.link}>{W17.change}</Text>
              </TouchableOpacity>
            </View>
            <Text style={b.small}>{picked.masked}</Text>
          </View>
        ) : (
          <View style={{ marginTop: 16 }} testID="withdraw-send-to">
            <Text style={s.lbl}>{W17.sendItTo}</Text>
            {o.sendTo.map((x) => (
              <TouchableOpacity key={x.method} style={[s.optbox, picked.method === x.method && s.optboxOn]} onPress={() => setMethod(x.method)}
                activeOpacity={0.8} accessibilityRole="radio" accessibilityState={{ selected: picked.method === x.method }} testID={`withdraw-to-${x.method}`}>
                <View style={[s.radio, picked.method === x.method && s.radioOn]} />
                <Text style={s.optboxT}>{x.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <GreyBox17 testID="withdraw-explain"
          text={side === 'brand' ? W17.brandExplain(inr(n), o.processHours) : W17.creatorExplain(inr(n), o.processHours)} />
        {past}
      </ScrollView>
      <View style={s.bar}>
        <PrimaryButton label={n ? W17.request(inr(n)) : W17.requestPlain} onPress={send} busy={busy} busyLabel="Requesting" testID="withdraw-request" />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  lbl: { fontFamily: fonts.sansSemiBold, fontSize: 14, color: T.ink, marginBottom: 8 },
  big: { height: 56, borderRadius: 14, borderWidth: 1.5, borderColor: T.ink, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14 },
  pre: { fontFamily: fonts.sansBold, fontSize: 24, color: T.ink, marginRight: 6 },
  input: { flex: 1, fontFamily: fonts.sansBold, fontSize: 24, color: T.ink, padding: 0 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 12 },
  opt: { borderWidth: 1, borderColor: T.border, borderRadius: 999, paddingHorizontal: 13, paddingVertical: 7, marginRight: 7, marginBottom: 7 },
  optOn: { backgroundColor: T.ink, borderColor: T.ink },
  optT: { fontFamily: fonts.sansSemiBold, fontSize: 12.5, color: T.ink },
  optTOn: { color: '#FFFFFF' },
  link: { fontFamily: fonts.sansSemiBold, fontSize: 12, color: T.ink, textDecorationLine: 'underline' },
  optbox: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: T.border, borderRadius: 12, padding: 12, marginBottom: 8 },
  optboxOn: { borderColor: T.ink, borderWidth: 1.5 },
  optboxT: { fontFamily: fonts.sansBold, fontSize: 13.5, color: T.ink, flex: 1 },
  radio: { width: 16, height: 16, borderRadius: 8, borderWidth: 1.5, borderColor: T.border, marginRight: 10 },
  radioOn: { borderColor: T.ink, borderWidth: 5 },
  empty: { alignItems: 'center', borderWidth: 1, borderColor: T.border, borderRadius: 14, padding: 18 },
  emptyT: { fontFamily: fonts.sansBold, fontSize: 14, color: T.ink, textAlign: 'center' },
  emptyB: { fontFamily: fonts.sansRegular, fontSize: 12.5, color: T.ink2, marginTop: 4, textAlign: 'center' },
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 14, paddingBottom: 18, backgroundColor: T.bg, borderTopWidth: 1, borderTopColor: T.border },
});
