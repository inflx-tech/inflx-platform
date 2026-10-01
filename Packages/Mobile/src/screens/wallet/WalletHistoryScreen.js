/**
 * Item 17 — History (BW10 for the brand, CW7 for the creator): every rupee that moved, newest
 * first, with filters. Each row's words come from the server already in the reader's language —
 * a ledger label never reaches this screen. Money in is green with a plus.
 * Contract: features/item17-wallet · master rules v1.31 §17A
 *
 * route.params.side: 'brand' | 'creator' (set by the navigator).
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, ScrollView } from 'react-native';
import { brandApi, influencerApi } from '../../services/api';
import { EmptyState, SecondaryButton } from '../../components/settings/primitives';
import { Skeleton, LoadError } from '../../components/settings/feedback';
import { Header, s as base } from '../brand/BrandPitchSettingsScreen';
import { W17, dayMon } from '../../components/wallet/copy17';
import { Filters17, MoneyRow17, s as b } from '../../components/wallet/bits17';

const PAGE = 50;

export default function WalletHistoryScreen({ navigation, route }) {
  const side = route?.params?.side === 'creator' ? 'creator' : 'brand';
  const api = side === 'creator' ? influencerApi : brandApi;
  const [status, setStatus] = useState('loading');
  const [filter, setFilter] = useState('all');
  const [rows, setRows] = useState([]);
  const [more, setMore] = useState(false);

  const seq = useRef(0); const busy = useRef(false);
  const load = useCallback(async (f, offset) => {
    if (offset && busy.current) return;               // a page (or a filter's first page) is already on its way
    const mine = ++seq.current; busy.current = true;
    if (!offset) setStatus('loading');
    const r = await api.getWalletHistory(f, offset);
    if (mine !== seq.current) return;                 // a newer first-page load owns the list now
    busy.current = false;
    if (!r.success) { setStatus('error'); return; }
    const got = r.data.rows || [];
    setRows((old) => (offset ? [...old, ...got] : got));
    setMore(got.length === PAGE);
    setStatus('ready');
  }, [api]);
  useEffect(() => { load(filter, 0); }, [filter, load]);

  const back = () => navigation.goBack();
  return (
    <View style={base.screen} testID="wallet-history">
      <Header title={W17.historyTitle} onBack={back} />
      <ScrollView contentContainerStyle={{ padding: 18, paddingTop: 2, paddingBottom: 40 }}>
        <Filters17 options={side === 'creator' ? W17.creatorHistoryFilters : W17.brandHistoryFilters} value={filter} onChange={setFilter} />
        {status === 'loading' ? <Skeleton /> : status === 'error' ? <LoadError onRetry={() => load(filter, 0)} /> : rows.length ? (
          <View testID="history-rows">
            {rows.map((r, i) => (
              <MoneyRow17 key={r.id} testID={`history-${i}`} title={r.label} last={i === rows.length - 1}
                sub={[r.sub, dayMon(r.at)].filter(Boolean).join(' · ')} amount={W17.amount(r)} moneyIn={r.moneyIn} />
            ))}
            {more ? <View style={{ marginTop: 12 }}><SecondaryButton label={W17.more} onPress={() => load(filter, rows.length)} testID="history-more" /></View> : null}
          </View>
        ) : (
          <View style={b.card} testID="history-empty"><EmptyState title={W17.noHistoryTitle} body={W17.noHistoryBody} /></View>
        )}
      </ScrollView>
    </View>
  );
}
