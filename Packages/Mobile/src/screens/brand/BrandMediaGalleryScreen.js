import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, FlatList,
  ActivityIndicator, Alert, Linking, Image, TextInput, RefreshControl,
  Modal, KeyboardAvoidingView, Platform,
} from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import { colors, spacing, radius, fmtRupees } from '../../theme/tokens';
import { brandApi, uploadFile } from '../../services/api';

const TABS = [
  { key: 'assets',    label: 'Assets' },
  { key: 'links',     label: 'Links' },
  { key: 'contracts', label: 'Contracts' },
];

const TAG_OPTIONS = [
  { value: '',             label: 'All' },
  { value: 'logo',         label: 'Logo' },
  { value: 'brand_kit',    label: 'Brand Kit' },
  { value: 'product_shot', label: 'Product' },
  { value: 'document',     label: 'Document' },
  { value: 'other',        label: 'Other' },
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
  if (type === 'application/pdf') return '📄';
  if (type.includes('zip')) return '📦';
  return '📄';
}
function iconForUrl(url) {
  const u = (url || '').toLowerCase();
  if (u.includes('youtube.') || u.includes('youtu.be')) return '▶️';
  if (u.includes('drive.google.') || u.includes('docs.google.')) return '📄';
  if (u.includes('figma.com')) return '🎨';
  if (u.includes('notion.')) return '📝';
  if (u.includes('instagram.')) return '📷';
  if (u.includes('dropbox.')) return '📦';
  return '🔗';
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

      {tab === 'assets'    ? <AssetsTab /> :
       tab === 'links'     ? <LinksTab /> :
       <ContractsTab navigation={navigation} />}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Usage bar
// ─────────────────────────────────────────────────────────────────────────────

function UsageBar({ usage }) {
  if (!usage) return null;
  const pct = Math.min(100, usage.used_pct || 0);
  const usedMb   = (usage.used_bytes / (1024 * 1024)).toFixed(1);
  const quotaMb  = Math.floor(usage.quota_bytes / (1024 * 1024));
  const color = pct >= 90 ? colors.red : pct >= 75 ? colors.orange : colors.navy;
  return (
    <View style={styles.usageWrap}>
      <View style={styles.usageRow}>
        <Text style={styles.usageLabel}>{usedMb} MB of {quotaMb} MB used</Text>
        <Text style={styles.usageRemaining}>{(usage.remaining_bytes / (1024 * 1024)).toFixed(0)} MB free</Text>
      </View>
      <View style={styles.usageTrack}>
        <View style={[styles.usageFill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
      {pct >= 90 && (
        <Text style={styles.usageWarning}>Near the limit. Delete unused assets to free space.</Text>
      )}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Brand Assets tab
// ─────────────────────────────────────────────────────────────────────────────

function AssetsTab() {
  const [assets, setAssets]   = useState([]);
  const [usage, setUsage]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tagFilter, setTagFilter]   = useState('');
  const [uploading, setUploading]   = useState(false);

  const load = useCallback(async () => {
    const [assetsRes, usageRes] = await Promise.all([
      brandApi.listMediaAssets(tagFilter || null),
      brandApi.getMediaUsage(),
    ]);
    if (assetsRes.success) setAssets(assetsRes.data?.assets || []);
    if (usageRes.success)  setUsage(usageRes.data);
    setLoading(false);
    setRefreshing(false);
  }, [tagFilter]);

  useEffect(() => { load(); }, [load]);

  async function handleUpload() {
    launchImageLibrary(
      { mediaType: 'photo', selectionLimit: 1, includeBase64: false },
      async (response) => {
        if (response.didCancel) return;
        if (response.errorCode) {
          Alert.alert('Error', response.errorMessage || 'Could not pick file');
          return;
        }
        const file = response.assets?.[0];
        if (!file) return;
        await doUpload(file, file.fileName || 'Untitled');
      },
    );
  }

  async function doUpload(file, title) {
    setUploading(true);
    try {
      const guessedType = (file.type && /^[a-z]+\/[a-z0-9.+-]+$/i.test(file.type))
        ? file.type
        : 'image/jpeg';
      const fileType = guessedType;
      const fileName = file.fileName || `asset_${Date.now()}.${fileType.split('/')[1] || 'bin'}`;
      const fileSize = Number(file.fileSize) || 0;

      const urlRes = await brandApi.getMediaUploadUrl({
        file_name: fileName, file_type: fileType, file_size_bytes: fileSize,
      });
      if (!urlRes.success) {
        const isQuota = urlRes.error?.code === 'QUOTA_EXCEEDED';
        Alert.alert(isQuota ? 'Storage full' : 'Upload failed',
          urlRes.error?.message || 'Could not get upload URL');
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
        Alert.alert('Upload failed', 'Storage did not accept the file.');
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
      await load();
    } catch (err) {
      Alert.alert('Upload failed', err.message || 'Unknown error');
    } finally {
      setUploading(false);
    }
  }

  function confirmDelete(asset) {
    Alert.alert(
      'Delete asset?',
      `"${asset.title}" will be removed from your gallery.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: async () => {
          const res = await brandApi.deleteMediaAsset(asset.id);
          if (res.success || res.ok || res.status === 204) load();
          else Alert.alert('Error', res.error?.message || 'Delete failed');
        }},
      ]
    );
  }

  function openAsset(asset) {
    if (asset.download_url) Linking.openURL(asset.download_url);
    else Alert.alert('Unavailable', 'This asset cannot be opened right now.');
  }

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={colors.navy} /></View>;
  }

  return (
    <FlatList
      data={assets}
      keyExtractor={a => a.id}
      numColumns={2}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
      ListHeaderComponent={
        <View>
          <UsageBar usage={usage} />

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
            <Text style={styles.uploadBtnText}>{uploading ? 'Uploading…' : '+ Upload Photo'}</Text>
          </TouchableOpacity>
          <Text style={styles.uploadHint}>Photos only · max 25 MB. For videos, add a Reference Link. For PDFs and ZIPs, use the web dashboard.</Text>
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
          <Text style={styles.emptySub}>Upload logos and product shots to reuse in campaigns.</Text>
        </View>
      }
      contentContainerStyle={{ paddingHorizontal: spacing.md, paddingBottom: spacing.xxl }}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Reference Links tab
// ─────────────────────────────────────────────────────────────────────────────

function LinksTab() {
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editing, setEditing] = useState(null); // null | {} | {id,...}

  const load = useCallback(async () => {
    const res = await brandApi.listReferenceLinks();
    if (res.success) setLinks(res.data?.links || []);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function confirmDelete(link) {
    Alert.alert(
      'Delete link?',
      link.title,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: async () => {
          const res = await brandApi.deleteReferenceLink(link.id);
          if (res.success || res.ok || res.status === 204) load();
          else Alert.alert('Error', res.error?.message || 'Delete failed');
        }},
      ]
    );
  }

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={colors.navy} /></View>;
  }

  return (
    <>
      <FlatList
        data={links}
        keyExtractor={l => l.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
        ListHeaderComponent={
          <View>
            <Text style={styles.sectionHint}>
              URLs to YouTube, Drive, Figma, Notion — anything you'd normally share by link.
              {' '}Zero storage cost.
            </Text>
            <TouchableOpacity style={styles.uploadBtn} onPress={() => setEditing({})}>
              <Text style={styles.uploadBtnText}>+ Add Link</Text>
            </TouchableOpacity>
          </View>
        }
        renderItem={({ item: l }) => (
          <TouchableOpacity style={styles.linkCard} onPress={() => Linking.openURL(l.url)}>
            <Text style={styles.linkIcon}>{iconForUrl(l.url)}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.linkTitle} numberOfLines={1}>{l.title}</Text>
              <Text style={styles.linkUrl} numberOfLines={1}>{l.url}</Text>
              {l.description ? <Text style={styles.linkDesc} numberOfLines={2}>{l.description}</Text> : null}
            </View>
            <View style={styles.linkActions}>
              <TouchableOpacity onPress={() => setEditing(l)} style={styles.actionBtn}>
                <Text style={styles.actionTxt}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => confirmDelete(l)} style={styles.actionBtn}>
                <Text style={[styles.actionTxt, { color: colors.red }]}>Delete</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🔗</Text>
            <Text style={styles.emptyTitle}>No links yet</Text>
            <Text style={styles.emptySub}>Tap "Add Link" to save a YouTube reel, Drive folder, or any other URL.</Text>
          </View>
        }
        contentContainerStyle={{ paddingHorizontal: spacing.md, paddingBottom: spacing.xxl }}
      />

      {editing && (
        <LinkEditorModal
          link={editing.id ? editing : null}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}
    </>
  );
}

function LinkEditorModal({ link, onClose, onSaved }) {
  const [title, setTitle] = useState(link?.title || '');
  const [url, setUrl] = useState(link?.url || '');
  const [description, setDescription] = useState(link?.description || '');
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!title.trim() || !url.trim()) {
      Alert.alert('Missing info', 'Title and URL are required.');
      return;
    }
    setSaving(true);
    const payload = { title: title.trim(), url: url.trim(), description: description.trim() || null };
    const res = link?.id
      ? await brandApi.updateReferenceLink(link.id, payload)
      : await brandApi.createReferenceLink(payload);
    setSaving(false);
    if (res.success) onSaved();
    else Alert.alert('Save failed', res.error?.message || 'Could not save link');
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.modalWrap}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.modalBody}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{link?.id ? 'Edit Link' : 'Add Reference Link'}</Text>
            <TouchableOpacity onPress={onClose}><Text style={styles.modalClose}>×</Text></TouchableOpacity>
          </View>

          <Text style={styles.formLabel}>Title</Text>
          <TextInput
            style={styles.formInput}
            placeholder="e.g. Product launch hero video"
            placeholderTextColor={colors.t3}
            value={title}
            onChangeText={setTitle}
          />

          <Text style={styles.formLabel}>URL</Text>
          <TextInput
            style={styles.formInput}
            placeholder="https://…"
            placeholderTextColor={colors.t3}
            autoCapitalize="none"
            autoCorrect={false}
            value={url}
            onChangeText={setUrl}
          />

          <Text style={styles.formLabel}>Description (optional)</Text>
          <TextInput
            style={[styles.formInput, { height: 80, textAlignVertical: 'top' }]}
            multiline
            placeholder="What's this link for?"
            placeholderTextColor={colors.t3}
            value={description}
            onChangeText={setDescription}
          />

          <View style={styles.modalFooter}>
            <TouchableOpacity style={styles.secondaryBtn} onPress={onClose}>
              <Text style={styles.secondaryBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.primaryBtn, saving && { opacity: 0.6 }]}
              onPress={save}
              disabled={saving}>
              <Text style={styles.primaryBtnText}>{saving ? 'Saving…' : 'Save'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
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
    return <View style={styles.center}><ActivityIndicator color={colors.navy} /></View>;
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
              if (c.pdf_url) navigation.navigate('ContractPdf', { contractId: c.id, role: 'brand' });
              else Alert.alert('No PDF', 'This contract does not have a PDF yet.');
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

  // Usage bar
  usageWrap:    { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginVertical: spacing.md },
  usageRow:     { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  usageLabel:   { fontSize: 11, fontWeight: '700', color: colors.t1 },
  usageRemaining: { fontSize: 10, color: colors.t3 },
  usageTrack:   { height: 6, backgroundColor: colors.surface2, borderRadius: 3, overflow: 'hidden' },
  usageFill:    { height: '100%' },
  usageWarning: { fontSize: 10, color: colors.red, marginTop: 6 },

  sectionHint:  { fontSize: 11, color: colors.t3, marginTop: spacing.md, marginBottom: spacing.sm, lineHeight: 16 },

  filterRow:    { paddingVertical: spacing.sm, gap: 6 },
  filterChip:   { paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.lg, backgroundColor: colors.surface2, marginRight: 6 },
  filterChipActive: { backgroundColor: colors.navy },
  filterChipLabel: { fontSize: 11, fontWeight: '600', color: colors.t2 },
  filterChipLabelActive: { color: colors.white },

  uploadBtn:    { backgroundColor: colors.navy, paddingVertical: 12, borderRadius: radius.md, alignItems: 'center', marginTop: spacing.xs },
  uploadBtnText:{ color: colors.white, fontWeight: '700', fontSize: 13 },
  uploadHint:   { marginTop: 4, marginBottom: spacing.md, fontSize: 10, color: colors.t3, textAlign: 'center' },

  card:         { flex: 1, backgroundColor: colors.surface, borderRadius: radius.md, margin: spacing.xs, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  thumb:        { aspectRatio: 1, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' },
  thumbImg:     { width: '100%', height: '100%' },
  thumbIcon:    { fontSize: 38 },
  cardBody:     { padding: 10 },
  cardTitle:    { fontSize: 12, fontWeight: '700', color: colors.t1 },
  cardMeta:     { fontSize: 10, color: colors.t3, marginTop: 2 },
  cardActions:  { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, paddingTop: 6, borderTopWidth: 1, borderTopColor: colors.border },
  actionBtn:    { paddingVertical: 4, paddingHorizontal: 4 },
  actionTxt:    { fontSize: 11, fontWeight: '700', color: colors.navy },

  // Link card
  linkCard:     { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.sm, gap: spacing.md },
  linkIcon:     { fontSize: 22 },
  linkTitle:    { fontSize: 13, fontWeight: '700', color: colors.t1 },
  linkUrl:      { fontSize: 10, color: colors.navy, marginTop: 2 },
  linkDesc:     { fontSize: 11, color: colors.t3, marginTop: 4 },
  linkActions:  { alignItems: 'flex-end', gap: 4 },

  // Modal
  modalWrap:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalBody:    { backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: spacing.lg, paddingBottom: 32 },
  modalHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  modalTitle:   { fontSize: 16, fontWeight: '700', color: colors.t1 },
  modalClose:   { fontSize: 24, color: colors.t3, fontWeight: '300' },
  formLabel:    { fontSize: 11, fontWeight: '700', color: colors.t2, marginBottom: 4, marginTop: spacing.sm },
  formInput:    { backgroundColor: colors.surface2, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 10, fontSize: 13, color: colors.t1 },
  modalFooter:  { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  primaryBtn:   { flex: 1, backgroundColor: colors.navy, paddingVertical: 12, borderRadius: radius.md, alignItems: 'center' },
  primaryBtnText:{ color: colors.white, fontWeight: '700', fontSize: 13 },
  secondaryBtn: { flex: 1, backgroundColor: colors.surface2, paddingVertical: 12, borderRadius: radius.md, alignItems: 'center' },
  secondaryBtnText:{ color: colors.t2, fontWeight: '700', fontSize: 13 },

  // Contracts
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
