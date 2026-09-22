/**
 * Item 11 — R6, R6b, R7: booking the parcel.
 * Contract: features/item11-remote · rules v1.27 §11.2, §9
 *
 * ONE SCREEN, ONE PRICE, GST INCLUDED. The return pickup is locked at the same moment, so the
 * return can always be paid for — and the screen says that in those words rather than showing
 * two numbers and leaving the brand to work out why.
 *
 * R6b IS NOT A DIFFERENT SCREEN. A short balance is this screen with the shortfall named and
 * one way forward, exactly as the balance check at signing does it (§9).
 *
 * THE BRANCH RADIOS: a branch with no street address CANNOT BE SELECTED, and says why
 * (approval Q9). The server refuses it too — but a refusal the brand could have been spared is
 * a refusal that should have been prevented.
 */
import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { settingsTokens as T, fonts } from '../../theme/tokens';
import { brandApi } from '../../services/api';
import { PrimaryButton, SecondaryButton } from '../../components/settings/primitives';
import { Skeleton, LoadError, useToast } from '../../components/settings/feedback';
import { COPY } from '../../components/settings/copy';
import { Card7, StateBox7 } from '../../components/agreement/bits7';
import { Header, s as base } from './BrandPitchSettingsScreen';
import { MoneyCard11, BoxPicker11, DispositionTag11 } from '../../components/remote/bits11';
import { C11, MSG11, rupees5 } from '../../components/remote/copy11';

export default function BrandRemoteBookScreen({ navigation, route }) {
  const { campaignId, setId, ciId, rebook } = route.params || {};
  const [sh, setSh] = useState(null);
  const [branches, setBranches] = useState([]);
  const [status, setStatus] = useState('loading');
  const [branchId, setBranchId] = useState(null);
  const [box, setBox] = useState('medium');
  const [dims, setDims] = useState({});
  const [weight, setWeight] = useState('');
  const [quote, setQuote] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const { toast, show } = useToast();

  const load = useCallback(async () => {
    setStatus((st) => (st === 'ready' ? 'ready' : 'loading'));
    const [r, b] = await Promise.all([
      brandApi.remote(campaignId, setId, ciId),
      brandApi.listBranches().catch(() => null),
    ]);
    if (!r || !r.success) { setStatus('error'); return; }
    setSh(r.data.shoot);
    const list = (b && b.success && (b.data.branches || [])) || [];
    setBranches(list);
    // §11.2 — the brand's MAIN branch by default; any of its branches instead.
    const main = list.find((x) => x.isMain) || list[0];
    setBranchId((v) => v || (main && main.id) || null);
    setStatus('ready');
  }, [campaignId, setId, ciId]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const body = () => ({
    branchId,
    ...(box === 'other' ? { boxL: Number(dims.l), boxW: Number(dims.w), boxH: Number(dims.h) } : { boxPreset: box }),
    weightKg: Number(weight),
  });

  function validate() {
    if (!branchId) return 'Choose a branch to collect from.';
    if (!box) return MSG11.BOX_REQUIRED;
    if (box === 'other' && !(Number(dims.l) > 0 && Number(dims.w) > 0 && Number(dims.h) > 0)) return MSG11.BOX_REQUIRED;
    if (!(Number(weight) > 0)) return MSG11.WEIGHT_REQUIRED;
    return null;
  }

  async function getQuote() {
    const e = validate();
    if (e) { setError(e); setQuote(null); return; }
    setError(null);
    const r = await brandApi.remoteQuote(campaignId, setId, ciId, body());
    if (!r || !r.success) { setQuote(null); setError((r && r.error && r.error.message) || COPY.saveFailed); return; }
    setQuote(r.data);
  }

  async function book() {
    const e = validate();
    if (e) { setError(e); return; }
    setBusy(true); setError(null);
    const call = rebook ? brandApi.remoteRebook : brandApi.remoteBook;
    const r = await call(campaignId, setId, ciId, body());
    setBusy(false);
    if (!r || !r.success) { setError((r && r.error && r.error.message) || COPY.saveFailed); return; }
    navigation.navigate('BrandRemote', { campaignId, setId, ciId, toast: 'Parcel booked.' });
  }

  if (status === 'loading') return <View style={base.screen}><Header title="Book the parcel" onBack={() => navigation.goBack()} /><Skeleton rows={6} /></View>;
  if (status === 'error') return <View style={base.screen}><Header title="Book the parcel" onBack={() => navigation.goBack()} /><LoadError onRetry={load} /></View>;

  const who = sh.creator.name;
  const short = quote && !quote.enough;

  return (
    <View style={base.screen} testID="brand-remote-book">
      <Header title={rebook ? C11.brand.bookAgain : 'Book the parcel'} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 190 }} keyboardShouldPersistTaps="handled">

        {rebook ? <StateBox7 tone="move" text="The same products go. You can't change the list on a second booking." testID="rebook-note" /> : null}

        {/* §11.2 — collected from the main branch unless the brand picks another. */}
        <Card7 title={C11.brand.collectedFrom} tone="plain" testID="branches">
          {branches.map((b) => {
            const usable = !!(b.formattedAddress) && !!b.pincode;
            const on = branchId === b.id;
            return (
              <Pressable key={b.id} onPress={() => { if (usable) { setBranchId(b.id); setQuote(null); } }}
                disabled={!usable} accessibilityRole="radio" accessibilityState={{ selected: !!on, disabled: !usable }}
                testID={`branch-${b.id}`} style={[s.branch, on && s.branchOn, !usable && s.branchDead]}>
                <View style={[s.radio, on && s.radioOn]} />
                <View style={{ flex: 1 }}>
                  <Text style={s.branchName}>{b.name}{b.isMain ? ' · Main' : ''}</Text>
                  <Text style={s.branchSub}>
                    {usable ? [b.cityName, b.pincode].filter(Boolean).join(', ') : C11.brand.branchNeedsAddress}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </Card7>

        <Text style={s.label}>Box size</Text>
        <BoxPicker11 value={box} onChange={(v) => { setBox(v); setQuote(null); }} dims={dims}
          onDims={(d) => { setDims(d); setQuote(null); }} />

        <Text style={[s.label, { marginTop: 16 }]}>Packed weight</Text>
        <View style={s.weightRow}>
          <TextInput value={weight} onChangeText={(v) => { setWeight(v.replace(/[^\d.]/g, '')); setQuote(null); }}
            onBlur={getQuote} keyboardType="decimal-pad" placeholder="0.0" placeholderTextColor={T.ink3}
            style={s.weight} testID="weight" />
          <Text style={s.unit}>kg</Text>
        </View>
        <Text style={s.hint}>{C11.brand.weightHint}</Text>

        {quote ? (
          <View style={{ marginTop: 18 }}>
            <MoneyCard11 quote={quote} creatorName={who} />
            {/* R6b — the shortfall as an amount, and one way forward (§9's pattern). */}
            {short ? (
              <View style={s.short} testID="shortfall">
                <Text style={s.shortTitle}>{C11.brand.shortTitle(quote.shortfall)}</Text>
                <Text style={s.shortBody}>{C11.brand.shortBody(quote.available)}</Text>
              </View>
            ) : null}
          </View>
        ) : null}
      </ScrollView>

      <View style={s.bar}>
        {error ? <Text style={s.error} testID="book-error">{error}</Text> : null}
        {!quote ? (
          <PrimaryButton label="See the price" onPress={getQuote} testID="see-price" />
        ) : short ? (
          <>
            <PrimaryButton label={C11.brand.addMoney} icon="wallet-outline"
              onPress={() => navigation.navigate('BrandAddMoney', { need: quote.shortfall })} testID="add-money" />
            <SecondaryButton label={C11.brand.backToProducts} onPress={() => navigation.goBack()} testID="back-to-products" />
          </>
        ) : (
          <PrimaryButton label={C11.brand.bookAndPay(quote.total)} icon="truck-outline"
            onPress={book} busy={busy} busyLabel="Booking" testID="book-and-pay" />
        )}
      </View>
      {toast}
    </View>
  );
}

const s = StyleSheet.create({
  label: { fontFamily: fonts.sansBold, fontSize: 12.5, color: T.ink, marginBottom: 8 },
  branch: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  branchOn: {},
  branchDead: { opacity: 0.45 },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, borderColor: T.border },
  radioOn: { borderColor: T.ink, borderWidth: 6 },
  branchName: { fontFamily: fonts.sansBold, fontSize: 13, color: T.ink },
  branchSub: { fontFamily: fonts.sansRegular, fontSize: 11.5, color: T.ink3, marginTop: 2 },
  weightRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  weight: { flex: 1, borderWidth: 1, borderColor: T.border, borderRadius: 10, padding: 12,
    fontFamily: fonts.sansRegular, fontSize: 15, color: T.ink },
  unit: { fontFamily: fonts.sansRegular, fontSize: 13, color: T.ink3 },
  hint: { fontFamily: fonts.sansRegular, fontSize: 12, color: T.ink3, lineHeight: 17, marginTop: 6 },
  short: { backgroundColor: T.state.declined.bg, borderRadius: 12, padding: 14 },
  shortTitle: { fontFamily: fonts.sansBold, fontSize: 14, color: T.state.declined.fg },
  shortBody: { fontFamily: fonts.sansRegular, fontSize: 12.5, color: T.state.declined.fg, marginTop: 4 },
  error: { fontFamily: fonts.sansRegular, fontSize: 12.5, color: T.state.declined.fg, marginBottom: 8, textAlign: 'center' },
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 14, paddingBottom: 22, backgroundColor: T.bg, borderTopWidth: 1, borderTopColor: T.border, gap: 8 },
});
