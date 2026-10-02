/**
 * BrandWalletScreen — the Wallet tab (item 17, board BW1 and BW2).
 * Contract: features/item17-wallet · master rules v1.31 §17A
 * (first built by features/brand-wallet-on-the-phone; rebuilt here to the four figures)
 *
 * The brand's money is in four places and the Wallet says so, each figure from its own source on
 * the server — nothing is added up or subtracted in the app:
 *   Available                what it can use now (an agreement, a parcel, a withdrawal)
 *   On hold                  a withdrawal it has asked for and INFLX has not paid yet (BW2)
 *   Locked in collaborations what is committed to signed collaborations
 *   Sales money coming       its share of sales still inside their return window
 * Add money is unchanged. Withdraw is a request (one at a time).
 */
import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { settingsTokens as T, fonts } from '../../theme/tokens';
import { brandApi } from '../../services/api';
import { PrimaryButton, SecondaryButton, ButtonRow } from '../../components/settings/primitives';
import { useToast, Skeleton, LoadError } from '../../components/settings/feedback';
import useRouteToast from '../../hooks/useRouteToast';
import useTopInset, { TOP_GAP_TITLE } from '../../hooks/useTopInset';
import { W17, inr, dayMon } from '../../components/wallet/copy17';
import { Balance17, Figs17, Fig17, HoldBox17, s as b } from '../../components/wallet/bits17';

// features/registration-and-profile B8 — GSTIN and the bank account live on the Wallet tab, out of
// the profile. Neither blocks approval; both are needed before money moves. (Item 17: one tap in,
// under "Bank and business details".)
export const BUSINESS_DETAILS = {
  title: 'Business & payment details',
  noteTitle: 'Needed before money moves',
  noteBody: 'Not needed for approval. Our team verifies these by hand.',
  gst: 'GST number', gstSub: 'Appears on your agreements', bank: 'Bank account', bankSub: 'Account number + IFSC',
};

export default function BrandWalletScreen({ navigation, route }) {
  const [status, setStatus] = useState('loading');
  const [fig, setFig] = useState(null);
  const [waiting, setWaiting] = useState(null);
  const [brand, setBrand] = useState(null);
  const { toast, show } = useToast();
  useRouteToast(navigation, route, show);
  // ui-walk-fixes D4 — no blank strip above the title: the phone's real top inset plus a small gap.
  const top = useTopInset(TOP_GAP_TITLE);

  const load = useCallback(async () => {
    setStatus((st) => (st === 'ready' ? 'ready' : 'loading'));
    const [w, m] = await Promise.all([brandApi.getWallet(), brandApi.getMe()]);
    if (!w.success || !w.data.figures) { setStatus('error'); return; }
    setFig(w.data.figures);
    setWaiting(w.data.withdrawal_waiting || null);
    // The details line is a nice-to-have: a wallet that loads without it is still a wallet.
    setBrand(m && m.success ? (m.data.brand || m.data) : null);
    setStatus('ready');
  }, []);
  // Refetches on focus, so coming back from Add money or Withdraw shows the new figures.
  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (status === 'loading') return <View style={s.screen} testID="wallet-loading"><Head /><Skeleton /></View>;
  if (status === 'error') return <View style={s.screen} testID="wallet-error"><Head /><LoadError onRetry={load} /></View>;

  const go = (name, params) => () => navigation.navigate(name, params || {});
  // ui-walk-fixes (board E): the shared level pair. The outline Withdraw used to sit 10 lower than
  // Add money and come out a little taller; in the row the two are equal halves, level top and
  // bottom, and Withdraw has the clear dark outline board BW1 draws.
  const buttons = (
    <ButtonRow style={s.btnrow}>
      <PrimaryButton label={W17.addMoney} icon="plus" onPress={go('BrandAddMoney')} testID="wallet-add-money" />
      {waiting
        ? <PrimaryButton label={W17.withdraw} disabled onPress={() => {}} testID="wallet-withdraw" />
        : <SecondaryButton strong label={W17.withdraw} onPress={go('BrandWithdraw')} testID="wallet-withdraw" />}
    </ButtonRow>
  );
  const money = (
    <Figs17>
      {waiting ? (
        <Fig17 testID="wallet-hold" label={W17.hold} sub={W17.holdSub(dayMon(waiting.requestedAt), waiting.sendTo)}
          value={inr(fig.onHold)} onPress={go('BrandWithdrawals')} />
      ) : null}
      <Fig17 testID="wallet-locked" label={W17.locked} sub={W17.lockedSub(fig.lockedCount)} value={inr(fig.locked)} onPress={go('BrandWalletLocked')} />
      <Fig17 testID="wallet-sales" label={W17.sales} sub={W17.salesSub(fig.salesComingCount)} value={inr(fig.salesComing)} onPress={go('BrandWalletSales')} />
    </Figs17>
  );

  return (
    <View style={s.screen} testID="brand-wallet">
      <ScrollView contentContainerStyle={{ padding: 18, paddingTop: top, paddingBottom: 40 }}>
        <Text style={[b.title, { marginBottom: 12 }]}>{W17.title}</Text>
        <Balance17 label={W17.available} amount={fig.available} testID="wallet-available" />
        <HoldBox17 w={waiting} />
        {/* BW2: with a withdrawal waiting, the figures come first and Withdraw is off. */}
        {waiting ? money : buttons}
        {waiting ? buttons : money}
        {waiting ? <Text style={s.one} testID="wallet-one-at-a-time">{W17.oneAtATime}</Text> : null}

        <Figs17>
          <Fig17 testID="wallet-history" label={W17.history} sub={W17.historySub} onPress={go('BrandWalletHistory')} />
          <Fig17 testID="wallet-details" label={W17.brandDetails}
            sub={brand ? W17.brandDetailsSub(!!brand.has_bank_account, !!brand.gstin) : null} onPress={go('BrandWalletDetails')} />
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
  btnrow: { marginTop: 12 },
  one: { fontFamily: fonts.sansRegular, fontSize: 12, color: T.ink2, textAlign: 'center', marginTop: 8 },
});
