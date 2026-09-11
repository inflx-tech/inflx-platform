/**
 * BrandOverviewScreen — O1 · O2: a brand's overview as a creator sees it (item 2's X1–X3
 * grown up): header, about, "Accepts pitches for" or the grey banner, Pitch this brand
 * (coming soon), products, posts by creators, branch cities, links. ⋯ → Block.
 * Contract: features/item3-discovery-profiles-groups · prompt §6.7
 */

import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { influencerApi } from '../../services/api';
import { TagRow, Banner, PrimaryButton } from '../../components/settings/primitives';
import { ActionSheet, ConfirmSheet } from '../../components/settings/sheets';
import { useToast, Skeleton, LoadError } from '../../components/settings/feedback';
import { AIMS, MODES, aimLabel, modeLabel, COPY } from '../../components/settings/copy';
import { Header, s as base } from '../brand/BrandPitchSettingsScreen';
import { hx } from '../brand/BrandCreatorProfileScreen';
import BrandOverviewBody from '../../components/discovery/BrandOverviewBody';
import { C3 } from '../../components/discovery/copy3';

const C = COPY.creator;

export default function BrandOverviewScreen({ navigation, route }) {
  const brandId = route?.params?.brandId;
  const [status, setStatus] = useState('loading');
  const [data, setData] = useState(null);
  const [menu, setMenu] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const { toast, show } = useToast();

  const load = useCallback(async () => {
    setStatus('loading');
    const r = await influencerApi.getBrandOverview(brandId);
    if (!r.success) { setStatus('error'); return; }
    setData(r.data);
    setStatus('ready');
  }, [brandId]);
  useEffect(() => { load(); }, [load]);

  const name = data?.brand?.business_name || data?.brand?.name || '';

  async function block() {
    setConfirm(false);
    const r = await influencerApi.blockBrand(brandId);
    if (!r.success) { show(COPY.saveFailed); return; }
    show(C.blocked(name), { undo: async () => { await influencerApi.unblockBrand(brandId); } });
  }

  const right = (
    <TouchableOpacity onPress={() => setMenu(true)} accessibilityRole="button" accessibilityLabel="More" style={hx.more} testID="more-menu">
      <Text style={hx.moreText}>⋯</Text>
    </TouchableOpacity>
  );

  if (status === 'loading') return <View style={base.screen}><Header title="Brand overview" onBack={() => navigation.goBack()} /><Skeleton /></View>;
  if (status === 'error') return <View style={base.screen}><Header title="Brand overview" onBack={() => navigation.goBack()} /><LoadError onRetry={load} /></View>;

  const summary = data.pitchSummary;
  const reason = summary ? summary.reason : 'NOT_ACCEPTING';
  const tags = summary ? [...AIMS.filter(a => summary.aims.includes(a)).map(aimLabel), ...MODES.filter(m => summary.modes.includes(m)).map(modeLabel)] : [];
  const accepts = (
    <View>
      {reason === 'NOT_ACCEPTING' ? (
        <Banner testID="not-accepting-banner" title={C.notAcceptingTitle} body={C.notAcceptingBody} />
      ) : (
        <View style={hx.card} testID="accepts-card"><Text style={hx.cardTitle}>{C3.overview.accepts}</Text><TagRow items={tags} /></View>
      )}
      {reason === 'NOT_MATCHING' ? <Banner testID="not-matching-banner" title={C.notMatchingTitle} body={C.notMatchingBody} /> : null}
      <PrimaryButton label={C3.overview.pitch} onPress={() => show(C3.toasts.pitchSoon)} disabled={reason !== 'OK'} testID="pitch-button" />
    </View>
  );

  return (
    <View style={base.screen} testID="brand-overview">
      <Header title="Brand overview" onBack={() => navigation.goBack()} right={right} />
      <ScrollView contentContainerStyle={base.body}>
        <BrandOverviewBody brand={data.brand} products={data.products} viewer="creator" navigation={navigation} acceptsNode={accepts} />
        <View style={{ height: 40 }} />
      </ScrollView>
      {toast}
      <ActionSheet visible={menu} onClose={() => setMenu(false)} actions={[
        { label: C.blockMenu(name), destructive: true, onPress: () => setConfirm(true) },
      ]} />
      <ConfirmSheet visible={confirm} danger title={C.blockTitle(name)} body={C.blockBody} confirmLabel={C.blockConfirm} cancelLabel="Cancel" onConfirm={block} onCancel={() => setConfirm(false)} />
    </View>
  );
}
