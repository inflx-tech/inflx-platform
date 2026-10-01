/**
 * Item 17 — Locked in collaborations (BW3) and one collaboration's payments (BW4).
 * Contract: features/item17-wallet · master rules v1.31 §17A
 *
 * Money locks when the brand signs (Pay for Content: her fee; Hybrid: the fixed amount). Each
 * collaboration shows what has been paid to the creator, what is still locked, and the next
 * payment with its condition or its date. Pay for Sale locks nothing and is not listed. The INFLX
 * campaign fee was charged once at signing and is never part of what is locked for her.
 * Nothing here can be cancelled: after both have signed, locked money moves only by the agreed
 * payments (or by INFLX settling a dispute).
 */
import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { settingsTokens as T } from '../../theme/tokens';
import { brandApi } from '../../services/api';
import { EmptyState, SecondaryButton } from '../../components/settings/primitives';
import { Skeleton, LoadError } from '../../components/settings/feedback';
import { Header, s as base } from './BrandPitchSettingsScreen';
import { W17, inr } from '../../components/wallet/copy17';
import { Chip17, TLine17, Payments17, GreyBox17, s as b } from '../../components/wallet/bits17';

const amountWord = (c) => (c.aim === 'hybrid' ? W17.fixedAmount : W17.fee);

function CollabCard({ c, onPress }) {
  const next = W17.nextBrand(c.next);
  return (
    <TouchableOpacity style={b.card} onPress={onPress} activeOpacity={0.8} accessibilityRole="button" testID={`locked-${c.ciId}`}>
      <View style={b.cardHead}>
        <Text style={b.cardTitle}>{c.creatorName}</Text>
        <Chip17 tone="waiting" text={c.aimLabel} />
      </View>
      <Text style={[b.small, { marginBottom: 5 }]}>{[c.campaignName, c.setName].filter(Boolean).join(' · ')}</Text>
      <TLine17 label={amountWord(c)} value={inr(c.amount)} />
      <TLine17 label={W17.paid} value={inr(c.paid)} />
      <TLine17 label={W17.stillLocked} value={inr(c.locked)} />
      {next ? (
        <View style={b.nextLine}>
          <Icon name="clock-outline" size={14} color={T.ink2} />
          <Text style={b.nextText}>{next}</Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

export default function BrandWalletLockedScreen({ navigation }) {
  const [status, setStatus] = useState('loading');
  const [d, setD] = useState(null);

  const load = useCallback(async () => {
    setStatus((st) => (st === 'ready' ? 'ready' : 'loading'));
    const r = await brandApi.getWalletLocked();
    if (!r.success) { setStatus('error'); return; }
    setD(r.data);
    setStatus('ready');
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const back = () => navigation.goBack();
  if (status === 'loading') return <View style={base.screen} testID="locked-loading"><Header title={W17.lockedTitle} onBack={back} /><Skeleton /></View>;
  if (status === 'error') return <View style={base.screen} testID="locked-error"><Header title={W17.lockedTitle} onBack={back} /><LoadError onRetry={load} /></View>;

  const open = (c) => () => navigation.navigate('BrandWalletCollab', { collab: c });
  const none = !d.collaborations.length && !d.paidInFull.length;

  return (
    <View style={base.screen} testID="wallet-locked-list">
      <Header title={W17.lockedTitle} onBack={back} />
      <ScrollView contentContainerStyle={{ padding: 18, paddingTop: 6, paddingBottom: 40 }}>
        <View style={[b.card, b.cardTint]} testID="locked-summary">
          <TLine17 label={W17.stillLocked} value={inr(d.stillLocked)} />
          <TLine17 label={W17.paidToCreators} value={inr(d.paidSoFar)} />
        </View>
        {none ? (
          <View style={b.card} testID="locked-empty"><EmptyState title={W17.nothingLockedTitle} body={W17.nothingLockedBody} /></View>
        ) : null}
        {d.collaborations.map((c) => <CollabCard key={c.ciId} c={c} onPress={open(c)} />)}
        {d.collaborations.some((c) => c.aim === 'engagement') ? <Text style={b.hint}>{W17.feeNotLocked}</Text> : null}
        {d.paidInFull.length ? <Text style={b.section}>{W17.paidInFull}</Text> : null}
        {d.paidInFull.map((c) => <CollabCard key={c.ciId} c={c} onPress={open(c)} />)}
      </ScrollView>
    </View>
  );
}

/** BW4 — one collaboration's three payments. The collaboration is handed over by the list. */
export function BrandWalletCollabScreen({ navigation, route }) {
  const c = route?.params?.collab;
  const back = () => navigation.goBack();
  if (!c) return <View style={base.screen}><Header title={W17.lockedTitle} onBack={back} /></View>;
  return (
    <View style={base.screen} testID="wallet-collab">
      <Header title={c.creatorName} onBack={back} />
      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 110 }}>
        <Text style={b.crumbs}>{[c.campaignName, c.setName, c.aimLabel].filter(Boolean).join(' · ')}</Text>
        <View style={b.card}>
          <View style={b.cardHead}>
            <Text style={b.cardTitle}>{c.aim === 'hybrid' ? W17.fixedAmount : W17.herFee}</Text>
            <Text style={b.small}>{inr(c.amount)}</Text>
          </View>
          <Payments17 payments={c.payments} when={W17.payWhenBrand} />
          <View style={b.nextLine}>
            <Text style={[b.nextText, { marginLeft: 0, color: T.ink2 }]}>{W17.stillLocked}</Text>
            <Text style={b.payAmt} testID="collab-still-locked">{inr(c.locked)}</Text>
          </View>
        </View>
        {c.campaignFee > 0 ? <GreyBox17 text={W17.campaignFee(c.campaignFee)} testID="collab-campaign-fee" /> : null}
      </ScrollView>
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: 14, paddingBottom: 18, backgroundColor: T.bg, borderTopWidth: 1, borderTopColor: T.border }}>
        <SecondaryButton label={W17.openCollab} testID="collab-open"
          onPress={() => navigation.navigate('CampaignsTab', { screen: 'BrandSetDetail', params: { campaignId: c.campaignId, setId: c.setId, name: c.setName } })} />
      </View>
    </View>
  );
}
