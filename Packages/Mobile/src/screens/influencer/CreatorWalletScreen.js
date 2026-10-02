/**
 * CreatorWalletScreen — the Wallet tab (item 17, board CW1 and CW2). The stand-in is replaced.
 * Contract: features/item17-wallet · master rules v1.31 §17A
 * (the stand-in was features/creator-wallet-and-first-payment)
 *
 * Three figures, each from its own source on the server — nothing is added up in the app:
 *   Available      what she can withdraw now
 *   On hold        a withdrawal she has asked for and INFLX has not paid yet (CW2)
 *   Still to come  everything promised but not yet hers: collaboration payments with their
 *                  dates, and commission still inside its return window
 * A withdrawal is paid in full. No tax is deducted and none is mentioned (W6).
 */
import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { settingsTokens as T, fonts } from '../../theme/tokens';
import { influencerApi } from '../../services/api';
import { PrimaryButton } from '../../components/settings/primitives';
import { Skeleton, LoadError, useToast } from '../../components/settings/feedback';
import useRouteToast from '../../hooks/useRouteToast';
import useTopInset, { TOP_GAP_TITLE } from '../../hooks/useTopInset';
import { W17, inr, dayMon } from '../../components/wallet/copy17';
import { Balance17, Figs17, Fig17, HoldBox17, s as b } from '../../components/wallet/bits17';

// features/registration-and-profile C7 — UPI, bank account (number + IFSC, one entry) and PAN
// live on the Wallet tab, out of the profile. None blocks approval. (Item 17: one tap in, under
// "Payment details"; the PAN row no longer speaks of a deduction — none is made.)
export const PAYMENT_DETAILS = {
  title: 'Payment details',
  noteTitle: 'Add these to get paid',
  noteBody: 'Not needed for approval — only before your first withdrawal.',
  upi: 'UPI', bank: 'Bank account', bankSub: 'Account number + IFSC', pan: 'PAN',
};

export default function CreatorWalletScreen({ navigation, route }) {
  const [status, setStatus] = useState('loading');
  const [d, setD] = useState(null);
  const { toast, show } = useToast();
  useRouteToast(navigation, route, show);
  // ui-walk-fixes D4 — no blank strip above the title: the phone's real top inset plus a small gap.
  const top = useTopInset(TOP_GAP_TITLE);

  const load = useCallback(async () => {
    setStatus((st) => (st === 'ready' ? 'ready' : 'loading'));
    const r = await influencerApi.getWallet();
    if (!r.success || !r.data.figures) { setStatus('error'); return; }
    setD(r.data);
    setStatus('ready');
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (status === 'loading') return <View style={s.screen} testID="creator-wallet-loading"><Head /><Skeleton /></View>;
  if (status === 'error') return <View style={s.screen} testID="creator-wallet-error"><Head /><LoadError onRetry={load} /></View>;

  const f = d.figures;
  const waiting = d.withdrawal_waiting || null;
  const det = d.details || {};
  const go = (name, params) => () => navigation.navigate(name, params || {});
  const withdraw = (
    <View style={{ marginTop: 12 }}>
      <PrimaryButton label={W17.withdraw} disabled={!!waiting} onPress={go('CreatorWithdraw')} testID="wallet-withdraw" />
      {waiting ? <Text style={s.one} testID="wallet-one-at-a-time">{W17.oneAtATime}</Text> : null}
    </View>
  );

  return (
    <View style={s.screen} testID="creator-wallet">
      <ScrollView contentContainerStyle={{ padding: 18, paddingTop: top, paddingBottom: 40 }}>
        <Text style={[b.title, { marginBottom: 12 }]}>{W17.title}</Text>
        <Balance17 label={W17.available} amount={f.available} testID="wallet-balance" />
        <HoldBox17 w={waiting} />
        {waiting ? null : withdraw}

        <Figs17>
          {waiting ? (
            <Fig17 testID="wallet-hold" label={W17.hold} sub={W17.holdSub(dayMon(waiting.requestedAt), waiting.sendTo)}
              value={inr(f.onHold)} onPress={go('CreatorWithdrawals')} />
          ) : null}
          <Fig17 testID="wallet-still-to-come" label={W17.stillToCome} sub={W17.stillToComeSub} value={inr(f.stillToCome)} />
        </Figs17>
        {waiting ? withdraw : null}

        <Figs17>
          <Fig17 testID="wallet-payments" label={W17.payments} sub={W17.paymentsSub(f.paymentsCount, f.nextPaymentAt ? dayMon(f.nextPaymentAt) : null)}
            value={inr(f.payments)} onPress={go('CreatorWalletPayments')} />
          <Fig17 testID="wallet-commission" label={W17.commission} sub={W17.commissionSub(f.commissionCount)}
            value={inr(f.commission)} onPress={go('CreatorWalletCommission')} />
          <Fig17 testID="wallet-history" label={W17.history} sub={W17.historySub} onPress={go('CreatorWalletHistory')} />
          <Fig17 testID="wallet-details" label={W17.payDetails} sub={W17.payDetailsSub(!!det.has_upi, !!det.has_bank_account)} onPress={go('CreatorWalletDetails')} />
        </Figs17>
      </ScrollView>
      {toast}
    </View>
  );
}

function Head() {
  const top = useTopInset(TOP_GAP_TITLE);
  return <View style={{ paddingTop: top, paddingHorizontal: 18, paddingBottom: 8 }}><Text style={b.title}>{W17.title}</Text></View>;
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: T.bg },
  one: { fontFamily: fonts.sansRegular, fontSize: 12, color: T.ink2, textAlign: 'center', marginTop: 8 },
});
