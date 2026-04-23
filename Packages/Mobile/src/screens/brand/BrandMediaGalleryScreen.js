import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, FlatList,
  ActivityIndicator, Alert, Linking, Image, TextInput, RefreshControl,
} from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import { colors, spacing, radius, fmtRupees } from '../../theme/tokens';
import { brandApi, uploadFile } from '../../services/api';

const TABS = [
  { key: 'assets',    label: 'Brand Assets' },
  { key: 'contracts', label: 'Contracts' },
];

const TAG_OPTIONS = [
  { value: '',            label: 'All' },
  { value: 'logo',        label: 'Logo' },
  { value: 'brand_kit',   label: 'Brand Kit' },
  { value: 'product_shot',label: 'Product' },
  { value: 'video',       label: 'Video' },
  { value: 'document',    label: 'Document' },
  { value: 'other',       label: 'Other' },
];

const STATUS_COLORS = {
  draft:              { bg: '#EEF1FB', fg: '#4A5278' },
  pending_influencer: { bg: '#FFF4D6', fg: '#B8860B' },
  pending_brand:      { bg: '#DBE5FF', fg: '#1B2D5E' },
  active:             { bg: '#E0FAF5', fg: '#007A63' },
  cancelled:          { bg: '#FDEEE9', fg: '#E8401A' },
};

function iconFor(type) {
  if (!type) return '📄';
  if (type.startsWith('image/')) return '🖼️';
  if (type.startsWith('video/')) return '🎬';
  if (type === 'application/pdf') return '📄';
  if (type.includes('zip')) return '📦';
  return '📄';
}
function sizeLabel(bytes) {
  const n = Number(bytes || 0);
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
function fmtDate(iso) {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }); }
  catch { return '—'; }
}

export default function BrandMediaGalleryScreen({ navigation }) {
  const [tab, setTab] = useState('assets');

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backIcon}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Media Gallery</Text>
        <View style={{ width: 36 }} />
      </View>

      <View style={styles.tabs}>
        {TABS.map(t => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tab, tab === t.key && styles.tabActive]}
            onPress={() => setTab(t.key)}>
            <Text style={[styles.tabLabel, tab === t.key && styles.tabLabelActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'assets' ? <AssetsTab /> : <ContractsTab navigation={navigation} />}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Brand Assets tab
// ─────────────────────────────────────────────────────────────────────────────

function AssetsTab() {
  const [assets, setAssets]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tagFilter, setTagFilter]   = useState('');
  const [uploading, setUploading]   = useState(false);

  const load = useCallback(async () => {
    const res = await brandApi.listMediaAssets(tagFilter || null);
    if (res.success) setAssets(res.data?.assets || []);
    setLoading(false);
    setRefreshing(false);
  }, [tagFilter]);

  useEffect(() => { load(); }, [load]);

  async function handleUpload() {
    launchImageLibrary(
      { mediaType: 'mixed', selectionLimit: 1, includeBase64: false, videoQuality: 'high' },
      async (response) => {
        if (response.didCancel) return;
        if (response.errorCode) {
          Alert.alert('Error', response.errorMessage || 'Could not pick file');
          return;
        }
        const file = response.assets?.[0];
        if (!file) return;
        // Filename becomes the default title. Brand can rename later on web.
        await doUpload(file, file.fileName || 'Untitled');
      },
    );
  }

  async function doUpload(file, title) {
    setUploading(true);
    try {
      // Image picker sometimes omits type/size on Android — derive safe
      // defaults so backend validation doesn't reject the request.
      const guessedType = (file.type && /^[a-z]+\/[a-z0-9.+-]+$/i.test(file.type))
        ? file.type
        : (/\.(mp4|mov|m4v)$/i.test(file.fileName || '') ? 'video/mp4' : 'image/jpeg');
      const fileType = guessedType;
      const fileName = file.fileName || `asset_${Date.now()}.${fileType.split('/')[1] || 'bin'}`;
      const fileSize = Number(file.fileSize) || 0;

      const urlRes = await brandApi.getMediaUploadUrl({
        file_name: fileName,
        file_type: fileType,
        file_size_bytes: fileSize,
      });
      if (!urlRes.success) {
        Alert.alert('Upload failed', urlRes.error?.message || 'Could not get upload URL');
        return;
      }
      const { url, method, key } = urlRes.data;

      let putRes;
      try {
        putRes = await uploadFile(url, method, file.uri, fileName, fileType, key);
      } catch (e) {
        Alert.alert('Upload failed', `Storage upload error: ${e.message || 'unknown'}`);
        return;
      }
      if (!putRes || putRes.success === false) {
        Alert.alert('Upload failed', 'Storage did not accept the file. Please try a different file.');
        return;
      }

      const createRes = await brandApi.createMediaAsset({
        title: title || fileName,
        file_r2_key: key,
        file_name: fileName,
        file_type: fileType,
        file_size_bytes: fileSize,
      });
      if (!createRes.success) {
        Alert.alert('Save failed', createRes.error?.message || 'Could not save asset metadata');
        return;
      }
      setAssets(prev => [createRes.data.asset, ...prev]);
    } catch (err) {
      Alert.alert('Upload failed', err.message || 'Unknown error');
    } finally {
      setUploading(false);
    }
  }

  function confirmDelete(asset) {
    Alert.alert(
      'Delete asset?',
      `"${asset.title}" will be removed from your gallery. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: async () => {
          const res = await brandApi.deleteMediaAsset(asset.id);
          if (res.success || res.ok || res.status === 204) {
            setAssets(prev => prev.filter(a => a.id !== asset.id));
          } else {
            Alert.alert('Error', res.error?.message || 'Delete failed');
          }
        }},
      ]
    );
  }

  function openAsset(asset) {
    if (asset.download_url) {
      Linking.openURL(asset.download_url);
    } else {
      Alert.alert('Unavailable', 'This asset cannot be opened right now.');
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.navy} />
      </View>
    );
  }

  return (
    <FlatList
      data={assets}
      keyExtractor={a => a.id}
      numColumns={2}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
      ListHeaderComponent={
        <View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
            {TAG_OPTIONS.map(opt => (
              <TouchableOpacity
                key={opt.value}
                style={[styles.filterChip, tagFilter === opt.value && styles.filterChipActive]}
                onPress={() => setTagFilter(opt.value)}>
                <Text style={[styles.filterChipLabel, tagFilter === opt.value && styles.filterChipLabelActive]}>{opt.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <TouchableOpacity
            style={[styles.uploadBtn, uploading && { opacity: 0.6 }]}
            onPress={handleUpload}
            disabled={uploading}>
            <Text style={styles.uploadBtnText}>{uploading ? 'Uploading…' : '+ Upload Asset'}</Text>
          </TouchableOpacity>
          <Text style={styles.uploadHint}>Photos, videos · max 50 MB each. For PDFs and ZIPs, use the web dashboard.</Text>
        </View>
      }
      renderItem={({ item: a }) => (
        <View style={styles.card}>
          <TouchableOpacity onPress={() => openAsset(a)} activeOpacity={0.85}>
            <View style={styles.thumb}>
              {(a.file_type || '').startsWith('image/') && a.download_url ? (
                <Image source={{ uri: a.download_url }} style={styles.thumbImg} />
              ) : (
                <Text style={styles.thumbIcon}>{iconFor(a.file_type)}</Text>
              )}
            </View>
          </TouchableOpacity>
          <View style={styles.cardBody}>
            <Text numberOfLines={1} style={styles.cardTitle}>{a.title}</Text>
            <Text style={styles.cardMeta}>{sizeLabel(a.file_size_bytes)}</Text>
            {(a.tags || []).length > 0 && (
              <View style={styles.chipRow}>
                {(a.tags || []).slice(0, 2).map(t => (
                  <View key={t} style={styles.miniChip}><Text style={styles.miniChipTxt}>{t.replace(/_/g, ' ')}</Text></View>
                ))}
              </View>
            )}
            <View style={styles.cardActions}>
              <TouchableOpacity onPress={() => openAsset(a)} style={styles.actionBtn}>
                <Text style={styles.actionTxt}>Open</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => confirmDelete(a)} style={styles.actionBtn}>
                <Text style={[styles.actionTxt, { color: colors.red }]}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
      ListEmptyComponent={
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>🖼️</Text>
          <Text style={styles.emptyTitle}>No assets yet</Text>
          <Text style={styles.emptySub}>Upload logos, product shots, and reference material to reuse in campaigns.</Text>
        </View>
      }
      contentContainerStyle={{ paddingHorizontal: spacing.md, paddingBottom: spacing.xxl }}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Contracts tab
// ─────────────────────────────────────────────────────────────────────────────

function ContractsTab({ navigation }) {
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    const res = await brandApi.listBrandContracts();
    if (res.success) setContracts(res.data?.contracts || []);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = contracts.filter(c => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (c.campaign_name || '').toLowerCase().includes(s) ||
           (c.influencer_name || '').toLowerCase().includes(s) ||
           (c.influencer_handle || '').toLowerCase().includes(s);
  });

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.navy} />
      </View>
    );
  }

  return (
    <FlatList
      data={filtered}
      keyExtractor={c => c.id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
      ListHeaderComponent={
        <View style={styles.searchWrap}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search campaigns or influencers…"
            placeholderTextColor={colors.t3}
            value={search}
            onChangeText={setSearch}
          />
        </View>
      }
      renderItem={({ item: c }) => {
        const total = Number(c.influencer_fee || 0) + Number(c.bonus_amount || 0);
        const statusStyle = STATUS_COLORS[c.status] || STATUS_COLORS.draft;
        return (
          <TouchableOpacity
            style={styles.contractCard}
            onPress={() => {
              if (c.pdf_url) {
                navigation.navigate('ContractPdf', { contractId: c.id, role: 'brand' });
              } else {
                Alert.alert('No PDF', 'This contract does not have a PDF yet.');
              }
            }}>
            <View style={styles.contractHead}>
              <View style={{ flex: 1 }}>
                <Text style={styles.contractCampaign} numberOfLines={1}>{c.campaign_name}</Text>
                <Text style={styles.contractInf} numberOfLines={1}>
                  {c.influencer_name}{c.influencer_handle ? ` · @${c.influencer_handle}` : ''}
                </Text>
              </View>
              <View style={[styles.statusPill, { backgroundColor: statusStyle.bg }]}>
                <Text style={[styles.statusTxt, { color: statusStyle.fg }]}>
                  {String(c.status || '').replace(/_/g, ' ')}
                </Text>
              </View>
            </View>
            <View style={styles.contractFoot}>
              <Text style={styles.contractMeta}>{fmtDate(c.brand_signed_at || c.created_at)} · {c.campaign_goal}</Text>
              <Text style={styles.contractAmount}>{fmtRupees(total)}</Text>
            </View>
          </TouchableOpacity>
        );
      }}
      ListEmptyComponent={
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>📝</Text>
          <Text style={styles.emptyTitle}>No contracts yet</Text>
          <Text style={styles.emptySub}>Signed contracts with influencers appear here for quick access.</Text>
        </View>
      }
      contentContainerStyle={{ paddingHorizontal: spacing.md, paddingBottom: spacing.xxl }}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: colors.bg },
  center:       { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingTop: spacing.xl, paddingBottom: spacing.md, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  backBtn:      { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  backIcon:     { fontSize: 28, color: colors.t1, fontWeight: '400' },
  headerTitle:  { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '700', color: colors.t1 },

  tabs:         { flexDirection: 'row', backgroundColor: colors.surface, paddingHorizontal: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  tab:          { paddingVertical: spacing.md, paddingHorizontal: spacing.lg, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive:    { borderBottomColor: colors.navy },
  tabLabel:     { fontSize: 13, fontWeight: '600', color: colors.t3 },
  tabLabelActive:{ color: colors.navy },

  filterRow:    { paddingHorizontal: spacing.md, paddingVertical: spacing.md, gap: 6 },
  filterChip:   { paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.lg, backgroundColor: colors.surface2, marginRight: 6 },
  filterChipActive: { backgroundColor: colors.navy },
  filterChipLabel: { fontSize: 11, fontWeight: '600', color: colors.t2 },
  filterChipLabelActive: { color: colors.white },

  uploadBtn:    { marginHorizontal: spacing.md, marginTop: spacing.xs, backgroundColor: colors.navy, paddingVertical: 12, borderRadius: radius.md, alignItems: 'center' },
  uploadBtnText:{ color: colors.white, fontWeight: '700', fontSize: 13 },
  uploadHint:   { marginHorizontal: spacing.md, marginTop: 4, marginBottom: spacing.md, fontSize: 10, color: colors.t3, textAlign: 'center' },

  card:         { flex: 1, backgroundColor: colors.surface, borderRadius: radius.md, margin: spacing.xs, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  thumb:        { aspectRatio: 1, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' },
  thumbImg:     { width: '100%', height: '100%' },
  thumbIcon:    { fontSize: 38 },
  cardBody:     { padding: 10 },
  cardTitle:    { fontSize: 12, fontWeight: '700', color: colors.t1 },
  cardMeta:     { fontSize: 10, color: colors.t3, marginTop: 2 },
  chipRow:      { flexDirection: 'row', gap: 4, marginTop: 6, flexWrap: 'wrap' },
  miniChip:     { backgroundColor: colors.navyPale, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  miniChipTxt:  { fontSize: 9, color: colors.navy, fontWeight: '600' },
  cardActions:  { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, paddingTop: 6, borderTopWidth: 1, borderTopColor: colors.border },
  actionBtn:    { paddingVertical: 4, paddingHorizontal: 4 },
  actionTxt:    { fontSize: 11, fontWeight: '700', color: colors.navy },

  searchWrap:   { padding: spacing.md },
  searchInput:  { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, paddingVertical: 10, fontSize: 13, color: colors.t1 },

  contractCard: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.sm },
  contractHead: { flexDirection: 'row', alignItems: 'flex-start' },
  contractCampaign: { fontSize: 14, fontWeight: '700', color: colors.t1 },
  contractInf:  { fontSize: 11, color: colors.t3, marginTop: 2 },
  statusPill:   { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.sm, marginLeft: 8 },
  statusTxt:    { fontSize: 9, fontWeight: '700', textTransform: 'uppercase' },
  contractFoot: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border },
  contractMeta: { fontSize: 10, color: colors.t3 },
  contractAmount:{ fontSize: 13, fontWeight: '700', color: colors.navy },

  empty:        { alignItems: 'center', padding: spacing.xxl * 2 },
  emptyIcon:    { fontSize: 40, marginBottom: spacing.md },
  emptyTitle:   { fontSize: 14, fontWeight: '700', color: colors.t1, marginBottom: 4 },
  emptySub:     { fontSize: 11, color: colors.t3, textAlign: 'center', paddingHorizontal: spacing.xl },
});
