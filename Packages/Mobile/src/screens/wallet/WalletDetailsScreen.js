/**
 * Item 17 — "Bank and business details" (brand) / "Payment details" (creator): the rows that
 * used to sit on the Wallet tab itself, one tap in now that the tab carries the figures (BW1, CW1).
 * Contract: features/item17-wallet (rows first built by features/registration-and-profile B8 / C7)
 *
 * This is the ONE place each side's payout details are kept: the brand's bank account and GST
 * number; the creator's UPI, bank account and PAN. A withdrawal is sent to what is saved here.
 *
 * route.params.side: 'brand' | 'creator' (set by the navigator).
 */
import React, { useCallback, useState } from 'react';
import { View, ScrollView } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { brandApi, influencerApi } from '../../services/api';
import { Skeleton, LoadError, useToast } from '../../components/settings/feedback';
import useRouteToast from '../../hooks/useRouteToast';
import { Header, s as base } from '../brand/BrandPitchSettingsScreen';
import DetailSection, { ADDED, NOT_ADDED, HAND_CHECK } from '../../components/wallet/DetailSection';
import { W17 } from '../../components/wallet/copy17';
import { BUSINESS_DETAILS } from '../brand/BrandWalletScreen';
import { PAYMENT_DETAILS } from '../influencer/CreatorWalletScreen';

export default function WalletDetailsScreen({ navigation, route }) {
  const side = route?.params?.side === 'creator' ? 'creator' : 'brand';
  const [status, setStatus] = useState('loading');
  const [me, setMe] = useState(null);
  const { toast, show } = useToast();
  useRouteToast(navigation, route, show);

  const load = useCallback(async () => {
    setStatus((st) => (st === 'ready' ? 'ready' : 'loading'));
    const m = side === 'creator' ? await influencerApi.getMe() : await brandApi.getMe();
    if (!m.success) { setStatus('error'); return; }
    setMe(side === 'creator' ? (m.data.influencer || m.data) : (m.data.brand || m.data));
    setStatus('ready');
  }, [side]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const title = side === 'creator' ? W17.payDetails : W17.brandDetails;
  const back = () => navigation.goBack();
  if (status === 'loading') return <View style={base.screen} testID="wallet-details-loading"><Header title={title} onBack={back} /><Skeleton /></View>;
  if (status === 'error') return <View style={base.screen} testID="wallet-details-error"><Header title={title} onBack={back} /><LoadError onRetry={load} /></View>;

  const val = (has) => (has ? ADDED : NOT_ADDED);
  const open = (kind) => () => navigation.navigate(side === 'creator' ? 'PayoutDetail' : 'BrandPayoutDetail', { kind, returnTo: side === 'creator' ? 'CreatorWalletDetails' : 'BrandWalletDetails' });
  const rows = side === 'creator' ? [
    { key: 'upi', label: PAYMENT_DETAILS.upi, value: val(me.has_upi), onPress: open('upi'), testID: 'row-upi' },
    { key: 'bank', label: PAYMENT_DETAILS.bank, sub: PAYMENT_DETAILS.bankSub, value: val(me.has_bank_account), onPress: open('bank'), testID: 'row-bank' },
    { key: 'pan', label: PAYMENT_DETAILS.pan, value: val(me.has_pan), onPress: open('pan'), testID: 'row-pan' },
  ] : [
    { key: 'gst', label: BUSINESS_DETAILS.gst, sub: BUSINESS_DETAILS.gstSub, value: val(!!me.gstin), onPress: open('gst'), testID: 'row-gst' },
    { key: 'bank', label: BUSINESS_DETAILS.bank, sub: BUSINESS_DETAILS.bankSub, value: val(me.has_bank_account), onPress: open('bank'), testID: 'row-bank' },
  ];
  const D = side === 'creator' ? PAYMENT_DETAILS : BUSINESS_DETAILS;

  return (
    <View style={base.screen} testID="wallet-details">
      <Header title={title} onBack={back} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 40 }}>
        <DetailSection testID={side === 'creator' ? 'payment-details' : 'business-details'}
          title={D.title} noteTitle={D.noteTitle} noteBody={D.noteBody} rows={rows} footer={HAND_CHECK} />
      </ScrollView>
      {toast}
    </View>
  );
}
