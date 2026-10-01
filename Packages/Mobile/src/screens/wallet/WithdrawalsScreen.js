/**
 * Item 17 — Withdrawals (BW8 for the brand, CW6 for the creator): every request and what happened
 * to it. Waiting; processed, with the bank reference; could not process, with the reason she
 * reads and the line that her money is back in Available.
 * Contract: features/item17-wallet · master rules v1.31 §17A
 *
 * route.params.side: 'brand' | 'creator' (set by the navigator).
 */
import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { brandApi, influencerApi } from '../../services/api';
import { EmptyState } from '../../components/settings/primitives';
import { Skeleton, LoadError } from '../../components/settings/feedback';
import { Header, s as base } from '../brand/BrandPitchSettingsScreen';
import { W17, inr } from '../../components/wallet/copy17';
import { Chip17, s as b } from '../../components/wallet/bits17';

export default function WithdrawalsScreen({ navigation, route }) {
  const api = route?.params?.side === 'creator' ? influencerApi : brandApi;
  const [status, setStatus] = useState('loading');
  const [rows, setRows] = useState([]);

  const load = useCallback(async () => {
    setStatus((st) => (st === 'ready' ? 'ready' : 'loading'));
    const r = await api.getWalletWithdrawals();
    if (!r.success) { setStatus('error'); return; }
    setRows(r.data.withdrawals || []);
    setStatus('ready');
  }, [api]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const back = () => navigation.goBack();
  if (status === 'loading') return <View style={base.screen} testID="withdrawals-loading"><Header title={W17.withdrawalsTitle} onBack={back} /><Skeleton /></View>;
  if (status === 'error') return <View style={base.screen} testID="withdrawals-error"><Header title={W17.withdrawalsTitle} onBack={back} /><LoadError onRetry={load} /></View>;

  return (
    <View style={base.screen} testID="withdrawals">
      <Header title={W17.withdrawalsTitle} onBack={back} />
      <ScrollView contentContainerStyle={{ padding: 18, paddingTop: 6, paddingBottom: 40 }}>
        {rows.length ? rows.map((w) => {
          const [tone, word] = W17.chip[w.status] || W17.chip.requested;
          return (
            <View key={w.id} style={b.card} testID={`withdrawal-${w.id}`}>
              <View style={b.cardHead}>
                <Text style={b.cardTitle}>{inr(w.amount)}</Text>
                <Chip17 tone={tone} text={word} testID={`withdrawal-${w.id}-chip`} />
              </View>
              <Text style={b.small}>{W17.wSub(w)}</Text>
              {w.status === 'processed' && w.reference ? <Text style={b.code}>{W17.reference(w.reference)}</Text> : null}
              {w.status === 'could_not_process' ? (
                <View style={b.note}><Text style={b.noteText}>{`${w.reason || ''} ${W17.backInAvailable(inr(w.amount))}`.trim()}</Text></View>
              ) : null}
            </View>
          );
        }) : (
          <View style={b.card} testID="withdrawals-empty"><EmptyState title={W17.noWithdrawalsTitle} body={W17.noWithdrawalsBody} /></View>
        )}
      </ScrollView>
    </View>
  );
}
