import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl, ActivityIndicator, Alert, Modal, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { brandPalette as P, fonts } from '../../theme/tokens';
import { brandApi } from '../../services/api';

/**
 * Offer library — mobile mirror of brand-web /dashboard/offers. List, status
 * tabs, activate/archive/delete, where-used attachments, publish-to-store
 * toggle, and creation for the two everyday types (percentage / flat-off
 * discount). Volume/BOGO/bundle/free-gift creation stays on web in v1 (needs
 * product pickers); they are fully manageable here once created.
 * Contract: features/brand-mobile-parity-pack.
 */

const TABS = ['all', 'active', 'draft', 'archived'];
const TYPE_ICON = { discount: '🏷️', volume: '📦', bogo: '🎁', bundle: '🧺', free_gift: '🎀' };
const STATUS_PILL = {
  draft:    { bg: P.bg2,         fg: P.muted },
  active:   { bg: P.successPale, fg: P.successText },
  archived: { bg: P.bg2,         fg: P.muted3 },
};

export default function BrandOffersLibraryScreen({ navigation }) {
  const [offers, setOffers]       = useState([]);
  const [counts, setCounts]       = useState({});
  const [tab, setTab]             = useState('all');
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [detail, setDetail]       = useState(null);     // offer object for the action sheet
  const [attachments, setAttachments] = useState(null);
  const [builder, setBuilder]     = useState(false);
  const [acting, setActing]       = useState(false);
  // builder state
  const [bName, setBName]         = useState('');
  const [bSub, setBSub]           = useState('pct');    // pct | flat
  const [bValue, setBValue]       = useState('');

  async function load() {
    const res = await brandApi.getOffers();
    if (res?.success) {
      setOffers(res.data?.offers || []);
      setCounts(res.data?.counts || {});
    }
    setLoading(false); setRefreshing(false);
  }
  useFocusEffect(useCallback(() => { setLoading(true); load(); }, []));

  async function openDetail(offer) {
    setDetail(offer); setAttachments(null);
    const res = await brandApi.getOfferAttachments(offer.id);
    if (res?.success) setAttachments(res.data?.attachments || []);
  }

  async function patchOffer(id, body, closeAfter = true) {
    setActing(true);
    const res = await brandApi.updateOffer(id, body);
    setActing(false);
    if (res?.success) { if (closeAfter) setDetail(null); load(); }
    else Alert.alert('Failed', res?.error?.message || 'Could not update the offer.');
  }

  function removeOffer(id) {
    Alert.alert('Archive this offer?', 'It stays in your library history but can no longer be attached.', [
      { text: 'Keep', style: 'cancel' },
      { text: 'Archive', style: 'destructive', onPress: async () => {
        setActing(true);
        const res = await brandApi.deleteOffer(id);
        setActing(false);
        if (res?.success) { setDetail(null); load(); }
        else Alert.alert('Failed', res?.error?.message || 'Could not archive.');
      } },
    ]);
  }

  async function createOffer(activate) {
    const v = parseFloat(bValue);
    if (!bName.trim()) { Alert.alert('Name required'); return; }
    if (!Number.isFinite(v) || v <= 0 || (bSub === 'pct' && v > 100)) {
      Alert.alert('Invalid value', bSub === 'pct' ? 'Enter a percentage between 1 and 100.' : 'Enter a positive amount in rupees.');
      return;
    }
    setActing(true);
    const res = await brandApi.createOffer({
      name: bName.trim(),
      offer_type: 'discount',
      offer_config_json: { sub_type: bSub, value: v, scope: 'store' },
    });
    if (res?.success && activate) {
      const id = res.data?.offer?.id;
      if (id) await brandApi.updateOffer(id, { status: 'active' });
    }
    setActing(false);
    if (res?.success) { setBuilder(false); setBName(''); setBValue(''); setBSub('pct'); load(); }
    else Alert.alert('Failed', res?.error?.message || 'Could not create the offer.');
  }

  const visible = offers.filter(o => tab === 'all' || o.status === tab);

  return (
    <View style={{ flex: 1, backgroundColor: P.bg }}>
      <View style={s.header}>
        <TouchableOpacity style={s.back} onPress={() => navigation.goBack()}>
          <Text style={s.backText}>← BACK</Text>
        </TouchableOpacity>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <View>
            <Text style={s.title}>Offer library</Text>
            <View style={s.rule} />
          </View>
          <TouchableOpacity style={s.newBtn} onPress={() => setBuilder(true)}>
            <Text style={s.newBtnTxt}>+ New offer</Text>
          </TouchableOpacity>
        </View>
        <Text style={s.subtitle}>Reusable deals you attach to campaigns or publish to your store</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipsRow} style={{ flexGrow: 0 }}>
        {TABS.map(t => (
          <TouchableOpacity key={t} style={[s.chip, tab === t && s.chipOn]} onPress={() => setTab(t)}>
            <Text style={[s.chipTxt, tab === t && s.chipTxtOn]}>
              {t[0].toUpperCase() + t.slice(1)}{counts[t] != null ? ` (${counts[t]})` : ''}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator size="large" color={P.yellow} /></View>
      ) : (
        <ScrollView
          style={{ flex: 1 }} contentContainerStyle={{ padding: 14, paddingBottom: 32 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={P.yellow} />}
        >
          {visible.length === 0 ? (
            <View style={s.empty}>
              <Text style={s.emptyIcon}>🏷️</Text>
              <Text style={s.emptyTitle}>No offers {tab !== 'all' ? `in ${tab}` : 'yet'}</Text>
              <Text style={s.emptyText}>Create a discount here, or build volume/BOGO/bundle offers on the web dashboard.</Text>
            </View>
          ) : visible.map(o => {
            const pill = STATUS_PILL[o.status] || STATUS_PILL.draft;
            return (
              <TouchableOpacity key={o.id} style={s.card} activeOpacity={0.85} onPress={() => openDetail(o)}>
                <Text style={s.cardIcon}>{TYPE_ICON[o.offer_type] || '🏷️'}</Text>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={s.cardName} numberOfLines={1}>{o.name}</Text>
                  <Text style={s.cardMeta}>
                    {String(o.offer_type || '').replace('_', ' ')}
                    {o.published_to_store ? ' · 🛍 in store' : ''}
                    {o.attached_count ? ` · ★ ${o.attached_count} creator${o.attached_count > 1 ? 's' : ''}` : ''}
                  </Text>
                </View>
                <View style={[s.pill, { backgroundColor: pill.bg }]}>
                  <Text style={[s.pillTxt, { color: pill.fg }]}>{String(o.status || '').toUpperCase()}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {/* Detail / actions sheet */}
      <Modal visible={!!detail} animationType="slide" transparent onRequestClose={() => setDetail(null)}>
        <View style={s.scrim}>
          <View style={s.sheet}>
            {detail && (
              <>
                <Text style={s.sheetTitle}>{TYPE_ICON[detail.offer_type] || '🏷️'} {detail.name}</Text>
                <Text style={s.sheetMeta}>
                  {String(detail.offer_type || '').replace('_', ' ')} · {String(detail.status || '').toUpperCase()}
                  {detail.published_to_store ? ' · published to store' : ''}
                </Text>

                <Text style={s.sheetSection}>WHERE IT'S USED</Text>
                {attachments === null ? <ActivityIndicator color={P.yellow} style={{ marginVertical: 8 }} />
                  : attachments.length === 0 ? <Text style={s.sheetEmpty}>Not attached to any campaign yet.</Text>
                  : attachments.slice(0, 6).map((a, i) => (
                    <Text key={i} style={s.attachRow} numberOfLines={1}>
                      ★ @{a.instagram_handle || a.influencer_name} — {a.campaign_name} ({a.status})
                    </Text>
                  ))}

                <View style={{ marginTop: 14, gap: 8 }}>
                  {detail.status === 'draft' && (
                    <TouchableOpacity style={[s.btn, s.btnFill]} disabled={acting} onPress={() => patchOffer(detail.id, { status: 'active' })}>
                      <Text style={s.btnFillTxt}>Activate</Text>
                    </TouchableOpacity>
                  )}
                  {detail.status === 'active' && (
                    <TouchableOpacity style={[s.btn, s.btnFill]} disabled={acting}
                      onPress={() => patchOffer(detail.id, { published_to_store: !detail.published_to_store })}>
                      <Text style={s.btnFillTxt}>{detail.published_to_store ? 'Remove from store' : 'Publish to store'}</Text>
                    </TouchableOpacity>
                  )}
                  {detail.status !== 'archived' && (
                    <TouchableOpacity style={[s.btn, s.btnGhost]} disabled={acting} onPress={() => removeOffer(detail.id)}>
                      <Text style={s.btnGhostTxt}>Archive</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity style={[s.btn, s.btnPlain]} onPress={() => setDetail(null)}>
                    <Text style={s.btnPlainTxt}>Close</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Builder sheet — discount (pct / flat) */}
      <Modal visible={builder} animationType="slide" transparent onRequestClose={() => setBuilder(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.scrim}>
          <View style={s.sheet}>
            <Text style={s.sheetTitle}>New discount offer</Text>
            <Text style={s.sheetMeta}>Volume, BOGO, bundle and free-gift builders live on the web dashboard.</Text>

            <Text style={s.label}>Offer name</Text>
            <TextInput style={s.input} value={bName} onChangeText={setBName}
              placeholder="e.g. Festive 20% Off" placeholderTextColor={P.muted3} />

            <Text style={s.label}>Discount type</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {[{ k: 'pct', l: '% percentage' }, { k: 'flat', l: '₹ flat off' }].map(x => (
                <TouchableOpacity key={x.k} style={[s.chip, bSub === x.k && s.chipOn, { marginRight: 0 }]} onPress={() => setBSub(x.k)}>
                  <Text style={[s.chipTxt, bSub === x.k && s.chipTxtOn]}>{x.l}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={s.label}>{bSub === 'pct' ? 'Percentage off (1–100)' : 'Amount off (₹)'}</Text>
            <TextInput style={s.input} value={bValue} onChangeText={t => setBValue(t.replace(/[^\d.]/g, ''))}
              keyboardType="numeric" placeholder={bSub === 'pct' ? 'e.g. 20' : 'e.g. 150'} placeholderTextColor={P.muted3} />

            <View style={{ marginTop: 16, gap: 8 }}>
              <TouchableOpacity style={[s.btn, s.btnFill]} disabled={acting} onPress={() => createOffer(true)}>
                <Text style={s.btnFillTxt}>{acting ? 'Working…' : 'Save & activate'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.btn, s.btnGhost]} disabled={acting} onPress={() => createOffer(false)}>
                <Text style={[s.btnGhostTxt, { color: P.ink2 }]}>Save as draft</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.btn, s.btnPlain]} onPress={() => setBuilder(false)}>
                <Text style={s.btnPlainTxt}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  header:    { backgroundColor: P.ink, paddingHorizontal: 18, paddingTop: 52, paddingBottom: 14 },
  back:      { paddingBottom: 6 },
  backText:  { fontFamily: fonts.sansMedium, fontSize: 11.5, fontWeight: '600', color: 'rgba(255,255,255,0.6)' },
  title:     { fontFamily: fonts.displayBold, fontSize: 22, fontWeight: '700', color: P.white, letterSpacing: -0.3 },
  rule:      { width: 30, height: 3, backgroundColor: P.yellow, borderRadius: 2, marginTop: 6 },
  subtitle:  { fontFamily: fonts.sansMedium, fontSize: 11, color: 'rgba(255,255,255,0.55)', marginTop: 6 },
  newBtn:    { backgroundColor: P.yellow, borderRadius: 9, paddingHorizontal: 12, paddingVertical: 8 },
  newBtnTxt: { fontSize: 12, fontWeight: '800', color: P.ink },
  chipsRow:  { paddingHorizontal: 14, paddingVertical: 10, gap: 6 },
  chip:      { backgroundColor: P.white, borderWidth: 1, borderColor: P.border, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6, marginRight: 6 },
  chipOn:    { backgroundColor: P.yellowPale, borderColor: P.yellow },
  chipTxt:   { fontSize: 11.5, fontWeight: '600', color: P.muted },
  chipTxtOn: { color: P.yellowText },
  card:      { backgroundColor: P.white, borderWidth: 1, borderColor: P.border, borderRadius: 12, padding: 14, marginBottom: 10, flexDirection: 'row', alignItems: 'center' },
  cardIcon:  { fontSize: 20 },
  cardName:  { fontSize: 14, fontWeight: '700', color: P.ink },
  cardMeta:  { fontSize: 11.5, color: P.muted2, marginTop: 2 },
  pill:      { borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2 },
  pillTxt:   { fontSize: 9, fontWeight: '800', letterSpacing: 0.4 },
  scrim:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  sheet:     { backgroundColor: P.white, borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 20, paddingBottom: 30 },
  sheetTitle:{ fontSize: 16, fontWeight: '800', color: P.ink },
  sheetMeta: { fontSize: 11.5, color: P.muted2, marginTop: 3 },
  sheetSection:{ fontSize: 10, fontWeight: '800', color: P.muted2, letterSpacing: 0.5, marginTop: 14, marginBottom: 4 },
  sheetEmpty:{ fontSize: 12, color: P.muted3 },
  attachRow: { fontSize: 12, color: P.ink2, marginTop: 3 },
  label:     { fontSize: 11, fontWeight: '700', color: P.ink2, marginTop: 14, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.4 },
  input:     { backgroundColor: P.bg, borderWidth: 1, borderColor: P.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, color: P.ink2 },
  btn:       { borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  btnFill:   { backgroundColor: P.yellow },
  btnFillTxt:{ fontSize: 13.5, fontWeight: '800', color: P.ink },
  btnGhost:  { backgroundColor: P.white, borderWidth: 1, borderColor: P.border },
  btnGhostTxt:{ fontSize: 13, fontWeight: '700', color: P.dangerText },
  btnPlain:  { backgroundColor: 'transparent' },
  btnPlainTxt:{ fontSize: 13, fontWeight: '600', color: P.muted2 },
  empty:     { alignItems: 'center', paddingTop: 60, paddingHorizontal: 30 },
  emptyIcon: { fontSize: 34, marginBottom: 10 },
  emptyTitle:{ fontSize: 15, fontWeight: '700', color: P.ink },
  emptyText: { fontSize: 12.5, color: P.muted2, textAlign: 'center', marginTop: 4 },
});
