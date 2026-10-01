/**
 * Item 17 — Sales money (BW5) and one sale (BW6).
 * Contract: features/item17-wallet · master rules v1.31 §17A
 *
 * A shopper's payment lands with INFLX. The brand sees each item sold split three ways — its
 * share, the creator's, INFLX's — and where it stands: inside its return window, or added to the
 * wallet. When the window closes the brand's share joins Available by itself. A cash-on-delivery
 * order appears the same way once it is delivered. Only the brand sees all three shares.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { brandApi } from '../../services/api';
import { EmptyState, SecondaryButton } from '../../components/settings/primitives';
import { Skeleton, LoadError } from '../../components/settings/feedback';
import { Header, s as base } from './BrandPitchSettingsScreen';
import { W17, inr, dayMon } from '../../components/wallet/copy17';
import { Stat3, Filters17, MoneyRow17, TLine17, Box17, s as b } from '../../components/wallet/bits17';

const amountOf = (x) => (x.state === 'added' ? `+ ${inr(x.brandShare)}` : inr(x.brandShare));
const PAGE = 50;

export default function BrandWalletSalesScreen({ navigation }) {
  const [status, setStatus] = useState('loading');
  const [filter, setFilter] = useState('all');
  const [d, setD] = useState(null);
  const [more, setMore] = useState(false);

  // The list comes a page at a time ("Show more" asks for the next one from where it ends).
  const seq = useRef(0); const busy = useRef(false);
  const load = useCallback(async (f, offset) => {
    if (offset && busy.current) return;               // a page (or a filter's first page) is already on its way
    const mine = ++seq.current; busy.current = true;
    if (!offset) setStatus((st) => (st === 'ready' ? 'ready' : 'loading'));
    const r = await brandApi.getWalletSales(f, offset);
    if (mine !== seq.current) return;                 // a newer first-page load owns the list now
    busy.current = false;
    if (!r.success) { if (!offset) setStatus('error'); return; }
    const got = r.data.sales || [];
    setD((old) => (offset && old ? { totals: r.data.totals, sales: [...old.sales, ...got] } : r.data));
    setMore(got.length === PAGE);
    setStatus('ready');
  }, []);
  useEffect(() => { load(filter, 0); }, [filter, load]);

  const back = () => navigation.goBack();
  if (status === 'loading') return <View style={base.screen} testID="sales-loading"><Header title={W17.salesTitle} onBack={back} /><Skeleton /></View>;
  if (status === 'error') return <View style={base.screen} testID="sales-error"><Header title={W17.salesTitle} onBack={back} /><LoadError onRetry={() => load(filter, 0)} /></View>;

  const t = d.totals;
  return (
    <View style={base.screen} testID="wallet-sales-list">
      <Header title={W17.salesTitle} onBack={back} />
      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 40 }}>
        <Stat3 items={[[inr(t.coming), W17.coming], [inr(t.addedThisMonth), W17.addedMonth], [String(t.sales), W17.salesCount]]} />
        <Filters17 options={W17.filters} value={filter} onChange={setFilter} />
        {d.sales.length ? d.sales.map((x, i) => (
          <MoneyRow17 key={x.id} testID={`sale-${x.id}`} title={x.item} sub={W17.saleLine(x, W17.whoseBrand(x))}
            amount={amountOf(x)} moneyIn={x.state === 'added'} last={i === d.sales.length - 1}
            onPress={() => navigation.navigate('BrandWalletSale', { sale: x })} />
        )) : (
          <View style={b.card} testID="sales-empty"><EmptyState title={W17.noSalesTitle} body={W17.noSalesBody} /></View>
        )}
        {more ? <View style={{ marginTop: 12 }}><SecondaryButton label={W17.more} onPress={() => load(filter, d.sales.length)} testID="sales-more" /></View> : null}
      </ScrollView>
    </View>
  );
}

/** BW6 — what the shopper paid, and who gets what. The sale is handed over by the list. */
export function BrandWalletSaleScreen({ navigation, route }) {
  const x = route?.params?.sale;
  const back = () => navigation.goBack();
  if (!x) return <View style={base.screen}><Header title={W17.salesTitle} onBack={back} /></View>;
  const box = W17.saleBox(x);
  return (
    <View style={base.screen} testID="wallet-sale">
      <Header title={x.item} onBack={back} />
      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 40 }}>
        <Text style={b.crumbs}>{`Order · ${dayMon(x.soldAt)} · ${W17.whoseBrand(x)} post ${x.post.code || ''}`.trim()}</Text>
        <View style={b.card} testID="sale-shares">
          <TLine17 label={W17.shopperPaid} value={inr(x.paid)} />
          <TLine17 label={W17.creatorShare(x.commissionPct)} value={inr(x.creatorShare)} />
          <TLine17 label={W17.inflxShare(x.feePct)} value={inr(x.inflxShare)} />
          <View style={b.nextLine}><View style={{ flex: 1 }}><TLine17 strong label={W17.yourShare} value={inr(x.brandShare)} /></View></View>
        </View>
        <Box17 tone={box.tone} text={box.text} testID="sale-state" />
        <View style={[b.card, b.cardTint]}>
          {x.offerName ? <TLine17 label={W17.offer} value={x.offerName} /> : null}
          <TLine17 label={W17.paidBy} value={W17.paidByWord(x)} />
          <TLine17 label={W17.status} value={W17.orderWord(x)} />
        </View>
      </ScrollView>
    </View>
  );
}
