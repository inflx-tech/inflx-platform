import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, FlatList,
  ActivityIndicator, Alert, Linking, Image, TextInput, RefreshControl,
  Modal, KeyboardAvoidingView, Platform,
} from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import { brandPalette as P, fonts, fmtRupees } from '../../theme/tokens';
import { brandApi, uploadFile } from '../../services/api';
import ScreenHeader from '../../components/brand/ScreenHeader';
import StatusPill from '../../components/brand/StatusPill';
import EmptyState from '../../components/brand/EmptyState';

/**
 * BrandMediaGalleryScreen — 3-tab gallery (Assets / Links / Contracts).
 *
 * Flow 25 (2026-05-25): navy + orange → brandPalette + ScreenHeader +
 * StatusPill + EmptyState + fonts. SDK boundary preserved verbatim
 * (launchImageLibrary + uploadFile to R2 signed URL + 3-step upload flow).
 */

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

function iconFor(type) {
  if (!type) return '[DOC]';
  if (type.startsWith('image/')) return '[PHOTO]';
  if (type === 'application/pdf') return '[PDF]';
  if (type.includes('zip')) return '[ZIP]';
  return '[DOC]';
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
    <View style={s.container}>
      <ScreenHeader title="Media Gallery" back onBack={() => navigation.goBack()} />

      <View style={s.tabs}>
        {TABS.map(t => (
          <TouchableOpacity
            key={t.key}
            style={[s.tab, tab === t.key && s.tabActive]}
            onPress={() => setTab(t.key)}
            activeOpacity={0.7}
          >
            <Text style={[s.tabLabel, tab === t.key && s.tabLabelActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'assets'    ? <AssetsTab /> :
       tab === 'links'     ? <LinksTab /> :
       <ContractsTab navigation={navigation} />}
    </View>
  );
}

function UsageBar({ usage }) {
  if (!usage) return null;
  const pct = Math.min(100, usage.used_pct || 0);
  const usedMb   = (usage.used_bytes / (1024 * 1024)).toFixed(1);
  const quotaMb  = Math.floor(usage.quota_bytes / (1024 * 1024));
  const color = pct >= 90 ? P.danger : pct >= 75 ? P.yellowHover : P.ink;
  return (
    <View style={s.usageWrap}>
      <View style={s.usageRow}>
        <Text style={s.usageLabel}>{usedMb} MB of {quotaMb} MB used</Text>
        <Text style={s.usageRemaining}>{(usage.remaining_bytes / (1024 * 1024)).toFixed(0)} MB free</Text>
      </View>
      <View style={s.usageTrack}>
        <View style={[s.usageFill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
      {pct >= 90 && (
        <Text style={s.usageWarning}>Near the limit. Delete unused assets to free space.</Text>
      )}
    </View>
  );
}

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
        ? file.type : 'image/jpeg';
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
    return <View style={s.center}><ActivityIndicator color={P.yellow} size="large" /></View>;
  }

  return (
    <FlatList
      data={assets}
      keyExtractor={a => a.id}
      numColumns={2}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={P.yellow} colors={[P.yellow]} />}
      ListHeaderComponent={
        <View>
          <UsageBar usage={usage} />

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterRow}>
            {TAG_OPTIONS.map(opt => (
              <TouchableOpacity
                key={opt.value}
                style={[s.filterChip, tagFilter === opt.value && s.filterChipActive]}
                onPress={() => setTagFilter(opt.value)}
                activeOpacity={0.7}
              >
                <Text style={[s.filterChipLabel, tagFilter === opt.value && s.filterChipLabelActive]}>{opt.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <TouchableOpacity
            style={[s.uploadBtn, uploading && { opacity: 0.6 }]}
            onPress={handleUpload}
            disabled={uploading}
            activeOpacity={0.85}
          >
            <Text style={s.uploadBtnText}>{uploading ? 'Uploading…' : '+ Upload Photo'}</Text>
          </TouchableOpacity>
          <Text style={s.uploadHint}>Photos only · max 25 MB. For videos, add a Reference Link. For PDFs and ZIPs, use the web dashboard.</Text>
        </View>
      }
      renderItem={({ item: a }) => (
        <View style={s.card}>
          <TouchableOpacity onPress={() => openAsset(a)} activeOpacity={0.85}>
            <View style={s.thumb}>
              {(a.file_type || '').startsWith('image/') && a.download_url ? (
                <Image source={{ uri: a.download_url }} style={s.thumbImg} />
              ) : (
                <Text style={s.thumbIcon}>{iconFor(a.file_type)}</Text>
              )}
            </View>
          </TouchableOpacity>
          <View style={s.cardBody}>
            <Text numberOfLines={1} style={s.cardTitle}>{a.title}</Text>
            <Text style={s.cardMeta}>{sizeLabel(a.file_size_bytes)}</Text>
            <View style={s.cardActions}>
              <TouchableOpacity onPress={() => openAsset(a)} style={s.actionBtn}>
                <Text style={s.actionTxtOpen}>Open</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => confirmDelete(a)} style={s.actionBtn}>
                <Text style={s.actionTxtDelete}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
      ListEmptyComponent={
        <View style={{ marginTop: 24 }}>
          <EmptyState
            icon="[PHOTOS]"
            title="No assets yet"
            sub="Upload logos and product shots to reuse in campaigns."
          />
        </View>
      }
      contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 24 }}
    />
  );
}

function LinksTab() {
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editing, setEditing] = useState(null);

  const load = useCallback(async () => {
    const res = await brandApi.listReferenceLinks();
    if (res.success) setLinks(res.data?.links || []);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function confirmDelete(link) {
    Alert.alert(
      'Delete link?', link.title,
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
    return <View style={s.center}><ActivityIndicator color={P.yellow} size="large" /></View>;
  }

  return (
    <>
      <FlatList
        data={links}
        keyExtractor={l => l.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={P.yellow} colors={[P.yellow]} />}
        ListHeaderComponent={
          <View>
            <Text style={s.sectionHint}>
              URLs to YouTube, Drive, Figma, Notion — anything you'd normally share by link. Zero storage cost.
            </Text>
            <TouchableOpacity style={s.uploadBtn} onPress={() => setEditing({})} activeOpacity={0.85}>
              <Text style={s.uploadBtnText}>+ Add Link</Text>
            </TouchableOpacity>
          </View>
        }
        renderItem={({ item: l }) => (
          <TouchableOpacity style={s.linkCard} onPress={() => Linking.openURL(l.url)} activeOpacity={0.85}>
            <Text style={s.linkIconText}>{iconForUrl(l.url)}</Text>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={s.linkTitle} numberOfLines={1}>{l.title}</Text>
              <Text style={s.linkUrl} numberOfLines={1}>{l.url}</Text>
              {l.description ? <Text style={s.linkDesc} numberOfLines={2}>{l.description}</Text> : null}
            </View>
            <View style={s.linkActions}>
              <TouchableOpacity onPress={() => setEditing(l)} style={s.actionBtn}>
                <Text style={s.actionTxtOpen}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => confirmDelete(l)} style={s.actionBtn}>
                <Text style={s.actionTxtDelete}>Delete</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={{ marginTop: 24 }}>
            <EmptyState
              icon="[LINKS]"
              title="No links yet"
              sub='Tap "Add Link" to save a YouTube reel, Drive folder, or any other URL.'
            />
          </View>
        }
        contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 24 }}
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
    if (!title.trim() || !url.trim()) { Alert.alert('Missing info', 'Title and URL are required.'); return; }
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
      <KeyboardAvoidingView style={s.modalWrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={s.modalBody}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>{link?.id ? 'Edit Link' : 'Add Reference Link'}</Text>
            <TouchableOpacity onPress={onClose}><Text style={s.modalClose}>×</Text></TouchableOpacity>
          </View>

          <Text style={s.formLabel}>Title</Text>
          <TextInput
            style={s.formInput}
            placeholder="e.g. Product launch hero video"
            placeholderTextColor={P.muted3}
            value={title} onChangeText={setTitle}
          />

          <Text style={s.formLabel}>URL</Text>
          <TextInput
            style={[s.formInput, { fontFamily: fonts.monoMedium, fontSize: 12 }]}
            placeholder="https://…"
            placeholderTextColor={P.muted3}
            autoCapitalize="none" autoCorrect={false}
            value={url} onChangeText={setUrl}
          />

          <Text style={s.formLabel}>Description (optional)</Text>
          <TextInput
            style={[s.formInput, { height: 80, textAlignVertical: 'top' }]}
            multiline
            placeholder="What's this link for?"
            placeholderTextColor={P.muted3}
            value={description} onChangeText={setDescription}
          />

          <View style={s.modalFooter}>
            <TouchableOpacity style={s.secondaryBtn} onPress={onClose} activeOpacity={0.85}>
              <Text style={s.secondaryBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.primaryBtn, saving && { opacity: 0.6 }]}
              onPress={save} disabled={saving}
              activeOpacity={0.85}
            >
              <Text style={s.primaryBtnText}>{saving ? 'Saving…' : 'Save'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

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
    const q = search.toLowerCase();
    return (c.campaign_name || '').toLowerCase().includes(q) ||
           (c.influencer_name || '').toLowerCase().includes(q) ||
           (c.influencer_handle || '').toLowerCase().includes(q);
  });

  if (loading) {
    return <View style={s.center}><ActivityIndicator color={P.yellow} size="large" /></View>;
  }

  return (
    <FlatList
      data={filtered}
      keyExtractor={c => c.id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={P.yellow} colors={[P.yellow]} />}
      ListHeaderComponent={
        <View style={s.searchWrap}>
          <TextInput
            style={s.searchInput}
            placeholder="Search campaigns or influencers…"
            placeholderTextColor={P.muted3}
            value={search} onChangeText={setSearch}
          />
        </View>
      }
      renderItem={({ item: c }) => {
        const total = Number(c.influencer_fee || 0) + Number(c.bonus_amount || 0);
        return (
          <TouchableOpacity
            style={s.contractCard}
            onPress={() => {
              if (c.pdf_url) navigation.navigate('ContractPdf', { contractId: c.id, role: 'brand' });
              else Alert.alert('No PDF', 'This contract does not have a PDF yet.');
            }}
            activeOpacity={0.85}
          >
            <View style={s.contractHead}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={s.contractCampaign} numberOfLines={1}>{c.campaign_name}</Text>
                <Text style={s.contractInf} numberOfLines={1}>
                  {c.influencer_name}{c.influencer_handle ? ` · @${c.influencer_handle}` : ''}
                </Text>
              </View>
              <StatusPill status={c.status} />
            </View>
            <View style={s.contractFoot}>
              <Text style={s.contractMeta}>{fmtDate(c.brand_signed_at || c.created_at)} · {c.campaign_goal}</Text>
              <Text style={s.contractAmount}>{fmtRupees(total)}</Text>
            </View>
          </TouchableOpacity>
        );
      }}
      ListEmptyComponent={
        <View style={{ marginTop: 24 }}>
          <EmptyState
            icon="[DOCS]"
            title="No contracts yet"
            sub="Signed contracts with influencers appear here for quick access."
          />
        </View>
      }
      contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 24 }}
    />
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: P.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  tabs: { flexDirection: 'row', backgroundColor: P.white, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: P.border, gap: 18 },
  tab: { paddingVertical: 11, paddingHorizontal: 4, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: P.yellow },
  tabLabel: { fontFamily: fonts.sansBold, fontSize: 12.5, fontWeight: '600', color: P.muted2 },
  tabLabelActive: { color: P.ink, fontWeight: '700' },

  usageWrap: { backgroundColor: P.white, borderRadius: 12, borderWidth: 1, borderColor: P.border, padding: 12, marginVertical: 12 },
  usageRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 7 },
  usageLabel: { fontFamily: fonts.sansBold, fontSize: 11, fontWeight: '700', color: P.ink },
  usageRemaining: { fontFamily: fonts.monoMedium, fontSize: 10, color: P.muted2 },
  usageTrack: { height: 6, backgroundColor: P.bg2, borderRadius: 3, overflow: 'hidden' },
  usageFill: { height: '100%', borderRadius: 3 },
  usageWarning: { fontFamily: fonts.sansMedium, fontSize: 10, color: P.dangerText, marginTop: 6 },

  sectionHint: { fontFamily: fonts.sansMedium, fontSize: 11, color: P.muted, marginTop: 12, marginBottom: 8, lineHeight: 16 },

  filterRow: { paddingVertical: 8, gap: 6 },
  filterChip: { paddingHorizontal: 11, paddingVertical: 6, borderRadius: 99, backgroundColor: P.bg2, marginRight: 6 },
  filterChipActive: { backgroundColor: P.ink },
  filterChipLabel: { fontFamily: fonts.sansBold, fontSize: 10.5, fontWeight: '700', color: P.muted },
  filterChipLabelActive: { color: P.yellow, fontFamily: fonts.monoBold },

  uploadBtn: { backgroundColor: P.ink, paddingVertical: 13, borderRadius: 10, alignItems: 'center', marginTop: 4 },
  uploadBtnText: { fontFamily: fonts.displayBold, color: P.yellow, fontWeight: '800', fontSize: 13.5, letterSpacing: 0.3 },
  uploadHint: { fontFamily: fonts.sansMedium, marginTop: 5, marginBottom: 12, fontSize: 9.5, color: P.muted2, textAlign: 'center', lineHeight: 14 },

  card: { flex: 1, backgroundColor: P.white, borderRadius: 12, margin: 5, borderWidth: 1, borderColor: P.border, overflow: 'hidden' },
  thumb: { aspectRatio: 1, backgroundColor: P.bg2, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 1, borderBottomColor: P.borderSoft },
  thumbImg: { width: '100%', height: '100%' },
  thumbIcon: { fontFamily: fonts.monoBold, fontSize: 14, fontWeight: '800', color: P.muted2, letterSpacing: 0.5 },
  cardBody: { padding: 9 },
  cardTitle: { fontFamily: fonts.displayBold, fontSize: 12, fontWeight: '700', color: P.ink },
  cardMeta: { fontFamily: fonts.monoMedium, fontSize: 9.5, color: P.muted2, marginTop: 2 },
  cardActions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 7, paddingTop: 6, borderTopWidth: 1, borderTopColor: P.borderSoft },
  actionBtn: { paddingVertical: 3, paddingHorizontal: 4 },
  actionTxtOpen: { fontFamily: fonts.sansBold, fontSize: 10.5, fontWeight: '700', color: P.yellowText },
  actionTxtDelete: { fontFamily: fonts.sansBold, fontSize: 10.5, fontWeight: '700', color: P.dangerText },

  linkCard: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: P.white, borderRadius: 12, borderWidth: 1, borderColor: P.border, padding: 12, marginBottom: 8, gap: 12 },
  linkIconText: { fontSize: 22, marginTop: 2 },
  linkTitle: { fontFamily: fonts.displayBold, fontSize: 13, fontWeight: '700', color: P.ink },
  linkUrl: { fontFamily: fonts.monoMedium, fontSize: 10, color: P.info, marginTop: 2 },
  linkDesc: { fontFamily: fonts.sansMedium, fontSize: 10.5, color: P.muted, marginTop: 4, lineHeight: 14 },
  linkActions: { alignItems: 'flex-end', gap: 4 },

  modalWrap: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalBody: { backgroundColor: P.white, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 18, paddingBottom: 32 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, paddingHorizontal: 2 },
  modalTitle: { fontFamily: fonts.displayBold, fontSize: 16, fontWeight: '700', color: P.ink },
  modalClose: { fontFamily: fonts.monoBold, fontSize: 22, color: P.muted2, paddingHorizontal: 4, lineHeight: 22 },
  formLabel: { fontFamily: fonts.monoBold, fontSize: 10, fontWeight: '800', color: P.muted, marginBottom: 4, marginTop: 8, textTransform: 'uppercase', letterSpacing: 0.4 },
  formInput: { fontFamily: fonts.sansMedium, backgroundColor: P.bg2, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: P.ink },
  modalFooter: { flexDirection: 'row', gap: 8, marginTop: 16 },
  primaryBtn: { flex: 1, backgroundColor: P.yellow, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  primaryBtnText: { fontFamily: fonts.displayBold, color: P.ink, fontWeight: '800', fontSize: 13 },
  secondaryBtn: { flex: 1, backgroundColor: P.bg2, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  secondaryBtnText: { fontFamily: fonts.sansBold, color: P.muted, fontWeight: '800', fontSize: 13 },

  searchWrap: { paddingVertical: 12 },
  searchInput: { fontFamily: fonts.sansMedium, backgroundColor: P.white, borderRadius: 10, borderWidth: 1, borderColor: P.border, paddingHorizontal: 12, paddingVertical: 10, fontSize: 12.5, color: P.ink },

  contractCard: { backgroundColor: P.white, borderRadius: 12, borderWidth: 1, borderColor: P.border, padding: 12, marginBottom: 8 },
  contractHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  contractCampaign: { fontFamily: fonts.displayBold, fontSize: 13.5, fontWeight: '700', color: P.ink },
  contractInf: { fontFamily: fonts.monoMedium, fontSize: 10.5, color: P.muted2, marginTop: 2 },
  contractFoot: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: P.borderSoft },
  contractMeta: { fontFamily: fonts.monoMedium, fontSize: 10, color: P.muted },
  contractAmount: { fontFamily: fonts.monoBold, fontSize: 12.5, fontWeight: '800', color: P.ink },
});
