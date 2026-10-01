/**
 * Item 17 — her "Still to come", opened into its two kinds: Collaboration payments (CW3) and
 * Commission (CW4).
 * Contract: features/item17-wallet · master rules v1.31 §17A
 *
 * CW3: each Pay for Content and Hybrid collaboration shows its three payments — paid, the next
 * one and what it waits for, and the final 50% with the date it arrives. The INFLX campaign fee
 * is the brand's alone and is never here. Pay for Sale has no fixed payments.
 * CW4: her commission, collaboration by collaboration and sale by sale. She never sees who
 * bought, nor anyone else's share.
 */
import React, { useCallback, useRef, useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { influencerApi } from '../../services/api';
import { EmptyState, SecondaryButton } from '../../components/settings/primitives';
import { Skeleton, LoadError } from '../../components/settings/feedback';
import { Header, s as base } from '../brand/BrandPitchSettingsScreen';
import { W17, inr } from '../../components/wallet/copy17';
import { Chip17, TLine17, Payments17, Stat3, MoneyRow17, GreyBox17, s as b } from '../../components/wallet/bits17';

function useLoad(fetcher) {
  const [status, setStatus] = useState('loading');
  const [d, setD] = useState(null);
  const load = useCallback(async () => {
    setStatus((st) => (st === 'ready' ? 'ready' : 'loading'));
    const r = await fetcher();
    if (!r.success) { setStatus('error'); return; }
    setD(r.data);
    setStatus('ready');
  }, [fetcher]);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  return { status, d, load };
}

const getPayments = () => influencerApi.getWalletPayments();
const PAGE = 50;

export function CreatorWalletPaymentsScreen({ navigation }) {
  const { status, d, load } = useLoad(getPayments);
  const back = () => navigation.goBack();
  if (status === 'loading') return <View style={base.screen} testID="payments-loading"><Header title={W17.paymentsTitle} onBack={back} /><Skeleton /></View>;
  if (status === 'error') return <View style={base.screen} testID="payments-error"><Header title={W17.paymentsTitle} onBack={back} /><LoadError onRetry={load} /></View>;

  return (
    <View style={base.screen} testID="wallet-payments-list">
      <Header title={W17.paymentsTitle} onBack={back} />
      <ScrollView contentContainerStyle={{ padding: 18, paddingTop: 6, paddingBottom: 40 }}>
        <View style={[b.card, b.cardTint]} testID="payments-summary">
          <TLine17 label={W17.stillToCome} value={inr(d.stillToCome)} />
          <TLine17 label={W17.received} value={inr(d.received)} />
        </View>
        {d.collaborations.length ? d.collaborations.map((c) => (
          <View key={c.ciId} style={b.card} testID={`payments-${c.ciId}`}>
            <View style={b.cardHead}>
              <Text style={b.cardTitle}>{c.brandName}</Text>
              <Chip17 tone="waiting" text={c.aimLabel} />
            </View>
            <Text style={b.small}>{[c.campaignName, c.setName, inr(c.amount)].filter(Boolean).join(' · ')}</Text>
            <Payments17 payments={c.payments} when={W17.payWhenCreator} />
          </View>
        )) : (
          <View style={b.card} testID="payments-empty"><EmptyState title={W17.noPaymentsTitle} body={W17.noPaymentsBody} /></View>
        )}
      </ScrollView>
    </View>
  );
}

const commissionAmount = (x) => (x.state === 'added' ? `+ ${inr(x.commission)}` : inr(x.commission));

export function CreatorWalletCommissionScreen({ navigation }) {
  const [status, setStatus] = useState('loading');
  const [d, setD] = useState(null);
  const [more, setMore] = useState(false);
  // The list comes a page at a time; the totals above it always count every sale.
  const seq = useRef(0); const busy = useRef(false);
  const load = useCallback(async (offset) => {
    if (offset && busy.current) return;               // a page is already on its way
    const mine = ++seq.current; busy.current = true;
    if (!offset) setStatus((st) => (st === 'ready' ? 'ready' : 'loading'));
    const r = await influencerApi.getWalletCommission('all', offset);
    if (mine !== seq.current) return;                 // a newer first-page load owns the list now
    busy.current = false;
    if (!r.success) { if (!offset) setStatus('error'); return; }
    const got = r.data.sales || [];
    setD((old) => (offset && old ? { totals: r.data.totals, sales: [...old.sales, ...got] } : r.data));
    setMore(got.length === PAGE);
    setStatus('ready');
  }, []);
  useFocusEffect(useCallback(() => { load(0); }, [load]));
  const back = () => navigation.goBack();
  if (status === 'loading') return <View style={base.screen} testID="commission-loading"><Header title={W17.commissionTitle} onBack={back} /><Skeleton /></View>;
  if (status === 'error') return <View style={base.screen} testID="commission-error"><Header title={W17.commissionTitle} onBack={back} /><LoadError onRetry={() => load(0)} /></View>;

  // Sale by sale under its collaboration: "Urban Threads · Diwali Edit · 10%".
  const groups = [];
  for (const x of d.sales) {
    const key = `${x.brandName} · ${x.campaignName} · ${x.commissionPct}%`;
    let g = groups.find((y) => y.key === key);
    if (!g) { g = { key, rows: [] }; groups.push(g); }
    g.rows.push(x);
  }
  const t = d.totals;
  return (
    <View style={base.screen} testID="wallet-commission-list">
      <Header title={W17.commissionTitle} onBack={back} />
      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 40 }}>
        <Stat3 items={[[inr(t.inWindow), W17.inWindow], [inr(t.added), W17.addedSoFar], [String(t.sales), W17.salesCount]]} />
        {groups.length ? groups.map((g) => (
          <View key={g.key}>
            <Text style={b.section}>{g.key}</Text>
            {g.rows.map((x, i) => (
              <MoneyRow17 key={x.id} testID={`commission-${x.id}`} title={x.item} sub={W17.saleLine(x, 'Your')}
                amount={commissionAmount(x)} moneyIn={x.state === 'added'} last={i === g.rows.length - 1} />
            ))}
          </View>
        )) : (
          <View style={b.card} testID="commission-empty"><EmptyState title={W17.noCommissionTitle} body={W17.noCommissionBody} /></View>
        )}
        {more ? <View style={{ marginTop: 12 }}><SecondaryButton label={W17.more} onPress={() => load(d.sales.length)} testID="commission-more" /></View> : null}
        <GreyBox17 text={W17.commissionNote} />
      </ScrollView>
    </View>
  );
}
