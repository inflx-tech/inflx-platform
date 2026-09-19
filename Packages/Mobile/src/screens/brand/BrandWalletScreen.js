/**
 * BrandWalletScreen — W1, W2. The Wallet tab, which was a "Coming soon" placeholder until now.
 * Contract: features/brand-wallet-on-the-phone
 *
 * One number she acts on (what she can spend), two she should see (what is locked, what has been
 * paid out), and the ledger underneath. Every figure is a field the wallet endpoint already
 * returns — nothing here is computed in the app.
 *
 * Withdrawals are deliberately absent (founder, 2026-09-16). The screen shows what it can do
 * rather than a disabled thing it cannot.
 */
import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { settingsTokens as T, fonts } from '../../theme/tokens';
import { brandApi } from '../../services/api';
import { PrimaryButton, EmptyState } from '../../components/settings/primitives';
import { useToast, Skeleton, LoadError } from '../../components/settings/feedback';
import useRouteToast from '../../hooks/useRouteToast';
import { WALLET, txLabel, txAmount, rupeesW } from '../../components/wallet/copyW';
import DetailSection, { ADDED, NOT_ADDED, HAND_CHECK } from '../../components/wallet/DetailSection';

const W = WALLET.tab;

// features/registration-and-profile B8 — GSTIN and the bank account live here, out of the
// profile. Neither blocks approval; both are needed before money moves.
export const BUSINESS_DETAILS = {
  title: 'Business & payment details',
  noteTitle: 'Needed before money moves',
  noteBody: 'Not needed for approval. Our team verifies these by hand.',
  gst: 'GST number', gstSub: 'Appears on your agreements', bank: 'Bank account', bankSub: 'Account number + IFSC',
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** "16 Sep" — and the time too when it is today, because she has just done it. */
function when(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const today = new Date();
  const sameDay = d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
  const day = `${d.getDate()} ${MONTHS[d.getMonth()]}`;
  if (!sameDay) return day;
  const h = d.getHours(), m = String(d.getMinutes()).padStart(2, '0');
  const ampm = h >= 12 ? 'pm' : 'am';
  return `${day}, ${((h + 11) % 12) + 1}:${m} ${ampm}`;
}

export default function BrandWalletScreen({ navigation, route }) {
  const [status, setStatus] = useState('loading');
  const [wallet, setWallet] = useState(null);
  const [rows, setRows] = useState([]);
  const [brand, setBrand] = useState(null);
  const { toast, show } = useToast();
  useRouteToast(navigation, route, show);

  const load = useCallback(async () => {
    setStatus(st => (st === 'ready' ? 'ready' : 'loading'));
    const [w, t, m] = await Promise.all([brandApi.getWallet(), brandApi.getWalletTransactions(), brandApi.getMe()]);
    if (!w.success) { setStatus('error'); return; }
    setWallet(w.data.wallet || w.data);
    // The ledger and the details are nice-to-haves: a wallet that loads without them is still a wallet.
    setRows(t.success ? (t.data.transactions || []) : []);
    setBrand(m && m.success ? (m.data.brand || m.data) : null);
    setStatus('ready');
  }, []);
  // Refetches on focus, so coming back from Add money shows the new balance without a pull.
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const addMoney = () => navigation.navigate('BrandAddMoney', {});

  if (status === 'loading') return <View style={s.screen} testID="wallet-loading"><Head /><Skeleton /></View>;
  if (status === 'error') return <View style={s.screen} testID="wallet-error"><Head /><LoadError onRetry={load} /></View>;

  const available = Number(wallet.available_balance ?? wallet.wallet_balance ?? 0);
  const locked = Number(wallet.reserved_balance ?? 0);
  const paidOut = Number(wallet.settled_balance ?? 0);
  const val = (has) => (brand ? (has ? ADDED : NOT_ADDED) : '—');
  const openDetail = (kind) => navigation.navigate('BrandPayoutDetail', { kind });

  return (
    <View style={s.screen} testID="brand-wallet">
      <ScrollView contentContainerStyle={{ padding: 18, paddingTop: 54, paddingBottom: 40 }}>
        <Text style={s.label}>{W.available}</Text>
        <Text style={s.big} testID="wallet-available">{rupeesW(available)}</Text>
        <Text style={s.hint}>{W.availableHint}</Text>

        <View style={{ marginTop: 14 }}>
          <PrimaryButton label={W.add} onPress={addMoney} testID="wallet-add-money" />
        </View>

        <View style={s.split}>
          <View style={s.half} testID="wallet-locked">
            <Text style={s.label}>{W.locked}</Text>
            <Text style={s.n}>{rupeesW(locked)}</Text>
            <Text style={s.tiny}>{W.lockedSub}</Text>
          </View>
          <View style={{ width: 10 }} />
          <View style={s.half} testID="wallet-paid-out">
            <Text style={s.label}>{W.paidOut}</Text>
            <Text style={s.n}>{rupeesW(paidOut)}</Text>
            <Text style={s.tiny}>{W.paidOutSub}</Text>
          </View>
        </View>

        <DetailSection
          testID="business-details"
          title={BUSINESS_DETAILS.title}
          noteTitle={BUSINESS_DETAILS.noteTitle}
          noteBody={BUSINESS_DETAILS.noteBody}
          rows={[
            { key: 'gst', label: BUSINESS_DETAILS.gst, sub: BUSINESS_DETAILS.gstSub, value: val(brand && !!brand.gstin), onPress: () => openDetail('gst'), testID: 'row-gst' },
            { key: 'bank', label: BUSINESS_DETAILS.bank, sub: BUSINESS_DETAILS.bankSub, value: val(brand && brand.has_bank_account), onPress: () => openDetail('bank'), testID: 'row-bank' },
          ]}
          footer={HAND_CHECK}
        />

        <Text style={[s.label, { marginTop: 18, marginBottom: 6 }]}>{W.activity}</Text>
        {rows.length ? (
          <View style={s.card} testID="wallet-activity">
            {rows.map((t, i) => (
              <View key={t.id || i} style={[s.row, i === rows.length - 1 && { borderBottomWidth: 0 }]} testID={`tx-${t.id || i}`}>
                <View style={{ flex: 1, paddingRight: 10 }}>
                  <Text style={s.t}>{txLabel(t)}</Text>
                  <Text style={s.sub}>{when(t.created_at)}</Text>
                </View>
                <Text style={[s.v, t.direction === 'credit' && s.vIn]}>{txAmount(t)}</Text>
              </View>
            ))}
          </View>
        ) : (
          <View style={s.card} testID="wallet-empty">
            <EmptyState title={W.emptyTitle} body={W.emptyBody} />
          </View>
        )}
      </ScrollView>
      {toast}
    </View>
  );
}

function Head() {
  return <View style={{ paddingTop: 54, paddingHorizontal: 18, paddingBottom: 8 }}><Text style={s.title}>{W.title}</Text></View>;
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: T.bg },
  title: { fontFamily: fonts.sansBold, fontSize: 22, color: T.ink },
  label: { fontFamily: fonts.sansBold, fontSize: 11, letterSpacing: 0.7, color: T.ink3, textTransform: 'uppercase' },
  big: { fontFamily: fonts.sansBold, fontSize: 34, color: T.ink, marginTop: 2 },
  n: { fontFamily: fonts.sansBold, fontSize: 17, color: T.ink, marginTop: 3 },
  hint: { fontFamily: fonts.sansRegular, fontSize: 12, color: T.ink2, lineHeight: 16, marginTop: 2 },
  tiny: { fontFamily: fonts.sansRegular, fontSize: 11.5, color: T.ink3, marginTop: 2 },
  split: { flexDirection: 'row', marginTop: 16 },
  half: { flex: 1, borderWidth: 1.5, borderColor: T.border, borderRadius: 12, padding: 11 },
  card: { borderWidth: 1.5, borderColor: T.border, borderRadius: 12, paddingHorizontal: 14 },
  row: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: T.border },
  t: { fontFamily: fonts.sansBold, fontSize: 13.5, color: T.ink },
  sub: { fontFamily: fonts.sansRegular, fontSize: 11.5, color: T.ink3, marginTop: 2 },
  v: { fontFamily: fonts.sansBold, fontSize: 13.5, color: T.ink },
  vIn: { color: T.state.active.fg },
});
