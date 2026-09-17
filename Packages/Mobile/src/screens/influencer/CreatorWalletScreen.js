/**
 * CreatorWalletScreen — a TEMPORARY wallet, so a creator can see money that already exists.
 * Contract: features/creator-wallet-and-first-payment
 *
 * ⚠️ THIS IS A STAND-IN AND SAYS SO. The founder asked for "a small frontend that simply shows
 * creator wallet with funds… later we design it clearly whenever the item comes". So this screen
 * deliberately does the least it can: it reads what the server already knows and prints it. No
 * withdrawals, no filters, no history beyond what is owed and why.
 *
 * It exists because the money is real and invisible. Asha signed, ₹3,000 was released into her
 * wallet that same second, and the app had nowhere to show it — the Wallet tab said "coming soon"
 * and her collaboration card said "₹0 is in your wallet".
 *
 * Every number comes from GET /influencers/me/earnings. Nothing is computed here.
 */
import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { settingsTokens as T, fonts } from '../../theme/tokens';
import { influencerApi } from '../../services/api';
import { EmptyState } from '../../components/settings/primitives';
import { Skeleton, LoadError } from '../../components/settings/feedback';
import { CREATOR_WALLET as C } from '../../components/wallet/copyCreator';

const money = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

export default function CreatorWalletScreen() {
  const [status, setStatus] = useState('loading');
  const [d, setD] = useState(null);

  const load = useCallback(async () => {
    setStatus(st => (st === 'ready' ? 'ready' : 'loading'));
    const r = await influencerApi.getEarnings();
    if (!r.success) { setStatus('error'); return; }
    setD(r.data);
    setStatus('ready');
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (status === 'loading') return <View style={s.screen} testID="creator-wallet-loading"><Head /><Skeleton /></View>;
  if (status === 'error') return <View style={s.screen} testID="creator-wallet-error"><Head /><LoadError onRetry={load} /></View>;

  const balance = Number(d.wallet_balance || 0);
  const held = Number(d.pending_amount || 0);          // locked tranches not yet released
  const earned = Number(d.total_earned || 0);
  const comm = d.commission_summary || {};
  const commPending = Number(comm.pending || 0);
  const locked = Array.isArray(d.locked_entries) ? d.locked_entries : [];

  return (
    <View style={s.screen} testID="creator-wallet">
      <ScrollView contentContainerStyle={{ padding: 18, paddingTop: 54, paddingBottom: 40 }}>
        <Text style={s.title}>{C.title}</Text>

        <Text style={[s.label, { marginTop: 14 }]}>{C.yours}</Text>
        <Text style={s.big} testID="wallet-balance">{money(balance)}</Text>
        <Text style={s.hint}>{C.yoursHint}</Text>

        <View style={s.split}>
          <View style={s.half} testID="wallet-held">
            <Text style={s.label}>{C.stillToCome}</Text>
            <Text style={s.n}>{money(held)}</Text>
            <Text style={s.tiny}>{C.stillToComeSub}</Text>
          </View>
          <View style={{ width: 10 }} />
          <View style={s.half} testID="wallet-earned">
            <Text style={s.label}>{C.earnedEver}</Text>
            <Text style={s.n}>{money(earned)}</Text>
            <Text style={s.tiny}>{C.earnedEverSub}</Text>
          </View>
        </View>

        {commPending > 0 ? (
          <View style={s.box} testID="wallet-commission">
            <Text style={s.boxH}>{C.commissionTitle(money(commPending))}</Text>
            <Text style={s.boxB}>{C.commissionBody}</Text>
          </View>
        ) : null}

        <Text style={[s.label, { marginTop: 18, marginBottom: 6 }]}>{C.waitingOn}</Text>
        {locked.length ? (
          <View style={s.card} testID="wallet-locked-list">
            {locked.map((e, i) => (
              <View key={e.id || i} style={[s.row, i === locked.length - 1 && { borderBottomWidth: 0 }]} testID={`locked-${e.id || i}`}>
                <View style={{ flex: 1, paddingRight: 10 }}>
                  <Text style={s.t}>{e.campaign_name || C.aCollaboration}</Text>
                  {/*
                    Founder, 2026-09-17: "it is showing next 50% even without
                    release". The MONEY was never wrong — T2 and T3 are locked in
                    escrow and nothing had been released early. The SENTENCE was:
                    the server sends `tranche_number`, this read `tranche`, so
                    every row got undefined and fell through to the default,
                    "On signing". Three quarters of her fee looked due at
                    signature. A label about money is not a cosmetic thing.
                  */}
                  <Text style={s.sub}>{C.tranche(e.tranche_number)}</Text>
                </View>
                <Text style={s.v}>{money(e.amount)}</Text>
              </View>
            ))}
          </View>
        ) : (
          <View style={s.card}>
            <EmptyState title={C.nothingHeldTitle} body={C.nothingHeldBody} />
          </View>
        )}

        <View style={s.note}>
          <Text style={s.noteT}>{C.standInNote}</Text>
        </View>
      </ScrollView>
    </View>
  );
}

function Head() {
  return <View style={{ paddingTop: 54, paddingHorizontal: 18, paddingBottom: 8 }}><Text style={s.title}>{C.title}</Text></View>;
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
  box: { borderRadius: 12, padding: 12, marginTop: 14, backgroundColor: T.state.waiting.bg },
  boxH: { fontFamily: fonts.sansBold, fontSize: 13.5, color: T.state.waiting.fg },
  boxB: { fontFamily: fonts.sansRegular, fontSize: 12.5, color: T.state.waiting.fg, lineHeight: 17, marginTop: 3 },
  note: { backgroundColor: T.surface, borderRadius: 11, padding: 12, marginTop: 18 },
  noteT: { fontFamily: fonts.sansRegular, fontSize: 12.5, color: T.ink2, lineHeight: 17 },
});
