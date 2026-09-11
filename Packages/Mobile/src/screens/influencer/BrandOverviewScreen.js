/**
 * BrandOverviewScreen — X1 · X2 · X3: a brand's overview as a creator sees it.
 * Contract: features/item2-pitch-invitation-settings · prompt §5.2 X1–X3
 *
 * OK            → "Accepts pitches for" card + Pitch this brand (item 8 wires it)
 * NOT_ACCEPTING → "Not accepting pitches right now" banner, button off. Paused and
 *                 blocked look identical — the server never says which.
 * NOT_MATCHING  → "You don't match this brand's pitch criteria" banner, button off.
 * ⋯ → Block {Brand} → confirm → toast with Undo.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { influencerApi } from '../../services/api';
import { TagRow, Banner, PrimaryButton } from '../../components/settings/primitives';
import { ActionSheet, ConfirmSheet } from '../../components/settings/sheets';
import { useToast, Skeleton, LoadError } from '../../components/settings/feedback';
import { AIMS, MODES, aimLabel, modeLabel, COPY } from '../../components/settings/copy';
import { Header, s as base } from '../brand/BrandPitchSettingsScreen';
import { Avatar } from '../brand/BrandBlockedCreatorsScreen';
import { hx } from '../brand/BrandCreatorProfileScreen';

const C = COPY.creator;

export default function BrandOverviewScreen({ navigation, route }) {
  const brandId = route?.params?.brandId;
  const [status, setStatus] = useState('loading');
  const [brand, setBrand] = useState(null);
  const [summary, setSummary] = useState(null);
  const [menu, setMenu] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const { toast, show } = useToast();

  const load = useCallback(async () => {
    setStatus('loading');
    const r = await influencerApi.getBrandOverview(brandId);
    if (!r.success) { setStatus('error'); return; }
    setBrand(r.data.brand);
    setSummary(r.data.pitchSummary || null);
    setStatus('ready');
  }, [brandId]);
  useEffect(() => { load(); }, [load]);

  const name = brand ? brand.business_name : '';

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

  const reason = summary ? summary.reason : 'NOT_ACCEPTING';
  const tags = summary ? [
    ...AIMS.filter(a => summary.aims.includes(a)).map(aimLabel),
    ...MODES.filter(m => summary.modes.includes(m)).map(modeLabel),
  ] : [];
  const subCats = Array.isArray(brand.sub_categories) ? brand.sub_categories.map(c => c.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, ch => ch.toUpperCase())) : [];
  const line = [subCats.join(', ') || brand.category, brand.city].filter(Boolean).join(' · ');

  return (
    <View style={base.screen}>
      <Header title="Brand overview" onBack={() => navigation.goBack()} right={right} />
      <ScrollView contentContainerStyle={base.body}>
        <View style={hx.hero}>
          <Avatar name={name} url={brand.logo_url} size={64} />
          <View style={{ flex: 1, marginLeft: 14 }}>
            <Text style={hx.name}>{name}</Text>
            {line ? <Text style={hx.sub}>{line}</Text> : null}
          </View>
        </View>
        <View style={{ height: 16 }} />

        {reason === 'NOT_ACCEPTING' ? (
          <Banner testID="not-accepting-banner" title={C.notAcceptingTitle} body={C.notAcceptingBody} />
        ) : (
          <View style={hx.card} testID="accepts-card">
            <Text style={hx.cardTitle}>{C.acceptsTitle}</Text>
            <TagRow items={tags} />
          </View>
        )}
        {reason === 'NOT_MATCHING' ? (
          <Banner testID="not-matching-banner" title={C.notMatchingTitle} body={C.notMatchingBody} />
        ) : null}

        {/* Enabled only when she may pitch. Non-functional in item 2 — item 8 builds the flow. */}
        <PrimaryButton label={C.pitchBtn} onPress={() => {}} disabled={reason !== 'OK'} testID="pitch-button" />
        <View style={{ height: 40 }} />
      </ScrollView>
      {toast}

      <ActionSheet visible={menu} onClose={() => setMenu(false)} actions={[
        { label: C.blockMenu(name), destructive: true, onPress: () => setConfirm(true) },
      ]} />
      <ConfirmSheet
        visible={confirm} danger
        title={C.blockTitle(name)} body={C.blockBody}
        confirmLabel={C.blockConfirm} cancelLabel="Cancel"
        onConfirm={block} onCancel={() => setConfirm(false)}
      />
    </View>
  );
}
