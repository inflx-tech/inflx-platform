import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, ActivityIndicator, Alert, Linking, Image, RefreshControl,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';
import { ig, IG_TONE } from '../../theme/ig';
import { influencerApi, uploadFile } from '../../services/api';

/* ════════════════════════════════════════════════════════════════════════
   DeliverableScreen — features/deliverable-consolidation.
   THE single deliverable screen: media upload + R2 + live stats (was
   notification-only) UNION status timeline + notes + confirm dialogs (was
   in-app-only). Reached from both doors; registered under both route names.
   ══════════════════════════════════════════════════════════════════════ */

const TYPE_LABELS = {
  reel: 'Instagram Reel', post: 'Instagram Post', story: 'Instagram Story',
  youtube_video: 'YouTube Video', youtube_short: 'YouTube Short',
};

const STATUS_TIMELINE = ['pending', 'submitted', 'under_review', 'approved', 'live'];
const TIMELINE_LABELS = { pending: 'Pending', submitted: 'Submitted', under_review: 'Under review', approved: 'Approved', live: 'Live' };

// Pure, testable.
export function deliverableStatusMeta(status) {
  switch (status) {
    case 'submitted':
    case 'under_review':      return { label: 'In review', tone: 'brand' };
    case 'approved':          return { label: 'Approved', tone: 'you' };
    case 'revision_requested':return { label: 'Revision', tone: 'you' };
    case 'live':              return { label: 'Live', tone: 'done' };
    case 'pending':           return { label: 'Pending', tone: 'neutral' };
    default:                  return { label: String(status || '—').replace(/_/g, ' '), tone: 'neutral' };
  }
}

function timelineIndex(status) {
  if (status === 'revision_requested') return 1;
  const i = STATUS_TIMELINE.indexOf(status);
  return i >= 0 ? i : 0;
}
function fmtDate(s) { return s ? new Date(s).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'; }
function fmtNum(n) {
  if (n == null) return '—';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return String(n);
}

export default function DeliverableScreen({ navigation, route }) {
  const { deliverable: initial, deliverableId, campaign_name, brand_name } = route.params || {};
  const [deliverable, setDeliverable] = useState(initial || null);
  const [loading, setLoading] = useState(!initial && !!deliverableId);
  const [refreshing, setRefreshing] = useState(false);

  const [selectedMedia, setSelectedMedia] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [submitUrl, setSubmitUrl] = useState('');
  const [notesToBrand, setNotesToBrand] = useState('');
  const [liveUrl, setLiveUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [mediaUrl, setMediaUrl] = useState(null);
  const [stats, setStats] = useState(null);
  const [refreshingStats, setRefreshingStats] = useState(false);

  const fetchById = useCallback(async (id) => {
    const res = await influencerApi.getDeliverable(id);
    if (res.success) {
      setDeliverable(res.data?.deliverable || res.data);
      if (res.data?.stats) setStats(res.data.stats);
    }
  }, []);

  useEffect(() => {
    const id = initial?.id || deliverableId;
    if (!initial && deliverableId) { setLoading(true); fetchById(deliverableId).finally(() => setLoading(false)); }
    else if (initial?.status === 'live' && id) { fetchById(id); }
  }, [deliverableId]);

  useEffect(() => {
    if (deliverable?.media_key && !mediaUrl) {
      influencerApi.getMediaUrl(deliverable.id).then(r => { if (r.success && r.data?.url) setMediaUrl(r.data.url); }).catch(() => {});
    }
  }, [deliverable?.media_key]);

  const onRefresh = useCallback(async () => {
    if (!deliverable?.id) return;
    setRefreshing(true); await fetchById(deliverable.id); setRefreshing(false);
  }, [deliverable?.id, fetchById]);

  async function handleRefreshStats() {
    if (!deliverable?.id) return;
    setRefreshingStats(true);
    const res = await influencerApi.refreshStats(deliverable.id);
    setRefreshingStats(false);
    if (res.success && res.data?.stats) setStats(res.data.stats);
    else Alert.alert('Failed', res.error?.message || 'Could not refresh stats');
  }

  // ── media picker ──
  const pickFromGallery = () => launchImageLibrary({ mediaType: 'mixed', videoQuality: 'high', selectionLimit: 1 }, onPicked);
  const recordVideo = () => launchCamera({ mediaType: 'video', videoQuality: 'high', durationLimit: 300 }, onPicked);
  function onPicked(response) {
    if (response.didCancel) return;
    if (response.errorCode) { Alert.alert('Error', response.errorMessage || 'Could not pick file'); return; }
    const a = response.assets?.[0];
    if (!a) return;
    setSelectedMedia({ uri: a.uri, type: a.type || 'video/mp4', fileName: a.fileName || `content_${Date.now()}.mp4`, fileSize: a.fileSize, duration: a.duration });
  }

  async function handleMediaUpload() {
    if (!selectedMedia) return;
    try {
      setUploading(true); setUploadProgress(0);
      const urlRes = await influencerApi.getUploadUrl(deliverable.id, { filename: selectedMedia.fileName, content_type: selectedMedia.type });
      if (!urlRes.success) { Alert.alert('Error', urlRes.error?.message || 'Failed to get upload URL'); setUploading(false); return; }
      const { url, key, method } = urlRes.data;
      await uploadFile(url, method, selectedMedia.uri, selectedMedia.fileName, selectedMedia.type, key, p => setUploadProgress(p));
      setUploadProgress(1);
      const submitRes = await influencerApi.submitDeliverable(deliverable.id, { media_key: key, media_type: selectedMedia.type, notes_to_brand: notesToBrand.trim() || undefined });
      if (submitRes.success) {
        setDeliverable(submitRes.data?.deliverable || { ...deliverable, status: 'submitted', media_key: key });
        setSelectedMedia(null); setNotesToBrand('');
        Alert.alert('Submitted', 'Your content has been uploaded and sent for brand review.');
      } else Alert.alert('Failed', submitRes.error?.message || 'Submission failed');
    } catch (e) { Alert.alert('Upload failed', e.message || 'Could not upload file'); }
    finally { setUploading(false); }
  }

  function confirmUrlSubmit() {
    if (!submitUrl.trim()) { Alert.alert('URL required', 'Please paste the content draft URL.'); return; }
    Alert.alert(isRevision ? 'Submit revised content' : 'Submit content', 'Send this content for brand review?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Submit', onPress: doUrlSubmit },
    ]);
  }
  async function doUrlSubmit() {
    setSubmitting(true);
    const res = await influencerApi.submitDeliverable(deliverable.id, { submitted_url: submitUrl.trim(), notes_to_brand: notesToBrand.trim() || undefined });
    setSubmitting(false);
    if (res.success) { setDeliverable(res.data?.deliverable || { ...deliverable, status: 'submitted', submitted_url: submitUrl.trim() }); setSubmitUrl(''); setNotesToBrand(''); Alert.alert('Submitted', 'Your content has been sent for brand review.'); }
    else Alert.alert('Failed', res.error?.message || 'Submission failed');
  }

  function confirmLive() {
    if (!liveUrl.trim()) { Alert.alert('URL required', 'Please paste the live post URL.'); return; }
    Alert.alert('Submit live URL', 'Confirm your content is posted live and submit this URL for brand confirmation.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Submit', onPress: doLive },
    ]);
  }
  async function doLive() {
    setSubmitting(true);
    const res = await influencerApi.submitLive(deliverable.id, { live_url: liveUrl.trim() });
    setSubmitting(false);
    if (res.success) { setDeliverable(res.data?.deliverable || { ...deliverable, status: 'approved', live_url: liveUrl.trim() }); setLiveUrl(''); Alert.alert('Done', 'Live URL submitted. The brand will confirm and Tranche 2 will be released.'); }
    else Alert.alert('Failed', res.error?.message || 'Could not submit live URL');
  }

  if (loading) return <View style={s.center}><ActivityIndicator color={ig.text} /></View>;
  if (!deliverable) return <View style={s.center}><Text style={s.err}>No deliverable data</Text></View>;

  const status = deliverable.status;
  const isRevision = status === 'revision_requested';
  const canSubmit = status === 'pending' || isRevision;
  const canSubmitLive = status === 'approved' && !deliverable.live_url;
  const isLive = status === 'live';
  const curIdx = timelineIndex(status);
  const meta = deliverableStatusMeta(status);
  const tone = IG_TONE[meta.tone] || IG_TONE.neutral;

  return (
    <ScrollView style={s.container} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ig.text} />}>
      {/* header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.back}><Icon name="chevron-left" size={18} color={ig.mut} /><Text style={s.backTxt}>Back</Text></TouchableOpacity>
        <View style={s.hRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.title}>{TYPE_LABELS[deliverable.type] || deliverable.type?.replace(/_/g, ' ') || 'Deliverable'}</Text>
            {(brand_name || campaign_name) ? <Text style={s.sub}>{[brand_name, campaign_name].filter(Boolean).join(' · ')}</Text> : null}
          </View>
          <View style={s.pill}><View style={[s.dot, { backgroundColor: tone.dot }]} /><Text style={[s.pillTxt, { color: tone.fg }]}>{meta.label}</Text></View>
        </View>
      </View>

      <View style={s.body}>
        {/* timeline */}
        <View style={s.card}>
          <Text style={s.ct}>Status timeline</Text>
          {STATUS_TIMELINE.map((step, idx) => {
            const on = idx <= curIdx, cur = idx === curIdx, rev = isRevision && cur, last = idx === STATUS_TIMELINE.length - 1;
            return (
              <View key={step} style={s.tstep}>
                <View style={s.tcol}>
                  <View style={[s.tdot, on && s.tdotOn, cur && s.tdotCur, rev && s.tdotRev]}>
                    {on && !cur ? <Icon name="check-bold" size={9} color={ig.text} /> : <Text style={[s.tdotN, on && { color: ig.text }, rev && { color: '#fff' }]}>{rev ? '!' : idx + 1}</Text>}
                  </View>
                  {!last && <View style={[s.tline, idx < curIdx && s.tlineOn]} />}
                </View>
                <Text style={[s.tlab, on && s.tlabOn, rev && { color: ig.red }]}>{rev ? 'Revision requested' : TIMELINE_LABELS[step]}</Text>
              </View>
            );
          })}
        </View>

        {/* details */}
        <View style={s.card}>
          <Text style={s.ct}>Details</Text>
          <Row l="Type" v={(deliverable.type || '').replace(/_/g, ' ').toUpperCase()} />
          {deliverable.submission_deadline ? <Row l="Deadline" v={fmtDate(deliverable.submission_deadline)} danger={canSubmit && new Date(deliverable.submission_deadline) < new Date()} /> : null}
          {deliverable.submitted_at ? <Row l="Submitted" v={fmtDate(deliverable.submitted_at)} /> : null}
          <Row l="Revisions" v={`${deliverable.revision_count || 0} / ${deliverable.revision_limit || 2}`} />
          {deliverable.content_requirements ? (
            <View style={s.brief}><Text style={s.briefL}>CONTENT BRIEF</Text><Text style={s.briefT}>{deliverable.content_requirements}</Text></View>
          ) : null}
        </View>

        {/* submitted content preview */}
        {deliverable.media_key ? (
          <View style={s.card}><Text style={s.ct}>Submitted content</Text>
            {mediaUrl ? ((deliverable.media_type || '').startsWith('image')
              ? <Image source={{ uri: mediaUrl }} style={s.media} resizeMode="contain" />
              : <TouchableOpacity style={s.videoBox} onPress={() => Linking.openURL(mediaUrl)}><Icon name="play-circle" size={44} color={ig.text} /><Text style={s.videoTxt}>Tap to play</Text></TouchableOpacity>)
              : <Text style={s.hint}>Media uploaded.</Text>}
          </View>
        ) : deliverable.submitted_url ? (
          <View style={s.card}><Text style={s.ct}>Submitted content</Text>
            <TouchableOpacity style={s.urlBox} onPress={() => Linking.openURL(deliverable.submitted_url)}><Text style={s.urlL}>DRAFT URL</Text><Text style={s.urlV} numberOfLines={2}>{deliverable.submitted_url}</Text></TouchableOpacity>
            {deliverable.notes_to_brand ? <View style={s.notes}><Text style={s.notesL}>YOUR NOTE</Text><Text style={s.notesT}>{deliverable.notes_to_brand}</Text></View> : null}
          </View>
        ) : null}

        {/* revision card */}
        {isRevision && deliverable.brand_feedback ? (
          <View style={s.revCard}>
            <View style={s.revHead}><View style={s.revIco}><Text style={s.revIcoTxt}>!</Text></View><Text style={s.revTitle}>REVISION REQUESTED</Text></View>
            <View style={s.revBody}><Text style={s.revTxt}>{deliverable.brand_feedback}</Text></View>
          </View>
        ) : null}

        {/* submit section — media upload + URL fallback + notes */}
        {canSubmit ? (
          <View style={s.card}>
            <Text style={s.ct}>{isRevision ? 'Upload revised content' : 'Upload content'}</Text>
            {selectedMedia ? (
              <View style={{ marginBottom: 10 }}>
                {selectedMedia.type?.startsWith('image')
                  ? <Image source={{ uri: selectedMedia.uri }} style={s.media} resizeMode="contain" />
                  : <View style={s.videoSel}><Icon name="video-outline" size={24} color={ig.yInk} /><Text style={s.videoSelTxt} numberOfLines={1}>{selectedMedia.fileName}</Text>{selectedMedia.duration ? <Text style={s.videoSelSub}>{Math.round(selectedMedia.duration)}s{selectedMedia.fileSize ? ` · ${(selectedMedia.fileSize / 1048576).toFixed(1)} MB` : ''}</Text> : null}</View>}
                {!uploading ? <TouchableOpacity onPress={() => setSelectedMedia(null)}><Text style={s.removeTxt}>Remove</Text></TouchableOpacity> : null}
              </View>
            ) : null}

            {uploading ? (
              <View style={s.progRow}><View style={s.progBar}><View style={[s.progFill, { width: `${Math.round(uploadProgress * 100)}%` }]} /></View><Text style={s.progTxt}>{Math.round(uploadProgress * 100)}%</Text></View>
            ) : null}

            {!selectedMedia && !uploading ? (
              <>
                <TouchableOpacity style={s.pick} onPress={pickFromGallery}><View style={s.pickIco}><Icon name="image-multiple-outline" size={19} color={ig.yInk} /></View><View style={{ flex: 1 }}><Text style={s.pickT}>Choose from Gallery</Text><Text style={s.pickS}>Photos &amp; videos</Text></View></TouchableOpacity>
                <TouchableOpacity style={s.pick} onPress={recordVideo}><View style={s.pickIco}><Icon name="video-outline" size={19} color={ig.yInk} /></View><View style={{ flex: 1 }}><Text style={s.pickT}>Record Video</Text><Text style={s.pickS}>Camera · up to 5 min</Text></View></TouchableOpacity>
              </>
            ) : null}

            {selectedMedia && !uploading ? (
              <TouchableOpacity style={s.btnDark} onPress={handleMediaUpload}><Text style={s.btnDarkTxt}>Upload &amp; submit for review</Text></TouchableOpacity>
            ) : null}

            {!selectedMedia && !uploading ? (
              <>
                <View style={s.divider}><View style={s.divLine} /><Text style={s.divTxt}>OR PASTE URL</Text><View style={s.divLine} /></View>
                <TextInput style={s.input} value={submitUrl} onChangeText={setSubmitUrl} placeholder="https://drive.google.com/…" placeholderTextColor={ig.mut2} autoCapitalize="none" autoCorrect={false} keyboardType="url" />
                <TextInput style={[s.input, s.notesInput]} value={notesToBrand} onChangeText={setNotesToBrand} placeholder="Add a note for the brand (optional)…" placeholderTextColor={ig.mut2} multiline textAlignVertical="top" />
                <TouchableOpacity style={[s.btnDark, (submitting || !submitUrl.trim()) && s.disabled]} onPress={confirmUrlSubmit} disabled={submitting || !submitUrl.trim()}>
                  {submitting ? <ActivityIndicator color="#fff" /> : <Text style={s.btnDarkTxt}>Submit URL for review</Text>}
                </TouchableOpacity>
              </>
            ) : null}
          </View>
        ) : null}

        {/* submitted / under review wait */}
        {(status === 'submitted' || status === 'under_review') ? (
          <View style={s.waitCard}><View style={s.waitIco}><Icon name="clock-outline" size={24} color={ig.yInk} /></View><Text style={s.waitT}>Waiting for brand review</Text><Text style={s.waitS}>Your content is submitted. The brand will approve or request changes.</Text></View>
        ) : null}

        {/* submit live */}
        {canSubmitLive ? (
          <View style={s.card}><Text style={s.ct}>Submit live post URL</Text>
            <Text style={s.hint}>Approved! Once posted live, paste the public URL here.</Text>
            <TextInput style={s.input} value={liveUrl} onChangeText={setLiveUrl} placeholder="https://instagram.com/p/…" placeholderTextColor={ig.mut2} autoCapitalize="none" autoCorrect={false} keyboardType="url" />
            <TouchableOpacity style={[s.btnGreen, (submitting || !liveUrl.trim()) && s.disabled]} onPress={confirmLive} disabled={submitting || !liveUrl.trim()}>
              {submitting ? <ActivityIndicator color="#fff" /> : <Text style={s.btnGreenTxt}>Submit live URL</Text>}
            </TouchableOpacity>
          </View>
        ) : null}

        {/* live url display */}
        {deliverable.live_url ? (
          <View style={s.card}><Text style={s.ct}>Live post</Text><TouchableOpacity style={s.urlBox} onPress={() => Linking.openURL(deliverable.live_url)}><Text style={s.urlL}>LIVE URL</Text><Text style={s.urlV} numberOfLines={2}>{deliverable.live_url}</Text></TouchableOpacity></View>
        ) : null}

        {/* live: stats + celebration */}
        {isLive ? (
          <>
            <View style={s.card}>
              <View style={s.ctRow}><Text style={s.ct}>Live performance</Text><TouchableOpacity style={s.refreshBtn} onPress={handleRefreshStats} disabled={refreshingStats}>{refreshingStats ? <ActivityIndicator size="small" color={ig.text} /> : <Text style={s.refreshTxt}>Refresh</Text>}</TouchableOpacity></View>
              {stats ? (
                <>
                  <View style={s.grid}>
                    {[['Likes', stats.likes], ['Comments', stats.comments], ['Saves', stats.saves], ['Shares', stats.shares], ['Reach', stats.reach], ['Impr.', stats.impressions]].map(([l, v]) => (
                      <View key={l} style={s.sb}><Text style={s.sv}>{fmtNum(v)}</Text><Text style={s.sl}>{l}</Text></View>
                    ))}
                  </View>
                  {stats.engagement_rate != null ? <View style={s.erBox}><Text style={s.erV}>{parseFloat(stats.engagement_rate).toFixed(2)}%</Text><Text style={s.erL}>Engagement rate</Text></View> : null}
                </>
              ) : <Text style={s.hint}>No stats yet. Tap Refresh to fetch live data from Instagram.</Text>}
            </View>
            <View style={s.celCard}><View style={s.celTile}><Icon name="star" size={26} color={ig.text} /></View><Text style={s.celT}>Content is live!</Text><Text style={s.celS}>Tranche 2 released to your wallet. Tranche 3 auto-releases 30 days after live confirmation.</Text></View>
          </>
        ) : null}

        <View style={{ height: 36 }} />
      </View>
    </ScrollView>
  );
}

function Row({ l, v, danger }) {
  return <View style={s.row}><Text style={s.rowL}>{l}</Text><Text style={[s.rowV, danger && { color: ig.red }]}>{v}</Text></View>;
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: ig.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: ig.bg },
  err: { fontSize: 14, color: ig.mut },

  header: { backgroundColor: ig.bg, paddingHorizontal: 16, paddingTop: 50, paddingBottom: 13, borderBottomWidth: 1, borderBottomColor: ig.line },
  back: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, marginLeft: -4 },
  backTxt: { fontSize: 12.5, color: ig.mut, fontWeight: '600' },
  hRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  title: { fontSize: 19, fontWeight: '800', color: ig.text, letterSpacing: -0.2 },
  sub: { fontSize: 11.5, color: ig.mut, marginTop: 3 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  pillTxt: { fontSize: 11, fontWeight: '700' },

  body: { padding: 14 },
  card: { borderWidth: 1, borderColor: ig.line, borderRadius: 13, padding: 13, marginBottom: 10 },
  ct: { fontSize: 12, fontWeight: '800', color: ig.text, textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 11 },
  ctRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },

  tstep: { flexDirection: 'row', gap: 10 },
  tcol: { width: 22, alignItems: 'center' },
  tdot: { width: 18, height: 18, borderRadius: 9, backgroundColor: ig.bgSoft, borderWidth: 2, borderColor: ig.line, alignItems: 'center', justifyContent: 'center' },
  tdotOn: { backgroundColor: ig.y, borderColor: ig.y },
  tdotCur: { borderColor: ig.text, borderWidth: 3 },
  tdotRev: { backgroundColor: ig.red, borderColor: ig.red },
  tdotN: { fontSize: 9, fontWeight: '800', color: ig.mut2 },
  tline: { width: 2, flex: 1, minHeight: 14, backgroundColor: ig.line, marginVertical: 2 },
  tlineOn: { backgroundColor: ig.y },
  tlab: { flex: 1, fontSize: 12.5, color: ig.mut, fontWeight: '600', paddingBottom: 14 },
  tlabOn: { color: ig.text, fontWeight: '800' },

  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: ig.lineSoft },
  rowL: { fontSize: 12, color: ig.mut },
  rowV: { fontSize: 12, fontWeight: '700', color: ig.text },
  brief: { backgroundColor: ig.bgSoft, borderRadius: 10, padding: 11, marginTop: 11 },
  briefL: { fontSize: 9.5, fontWeight: '800', color: ig.mut, letterSpacing: 0.4, marginBottom: 4 },
  briefT: { fontSize: 12, color: ig.text, lineHeight: 17 },

  media: { width: '100%', height: 200, borderRadius: 11, backgroundColor: ig.bgSoft, marginBottom: 8 },
  videoBox: { backgroundColor: ig.text, borderRadius: 11, padding: 28, alignItems: 'center' },
  videoTxt: { fontSize: 11, color: ig.y, fontWeight: '700', marginTop: 7 },
  videoSel: { backgroundColor: ig.bgSoft, borderRadius: 10, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: ig.line, marginBottom: 8 },
  videoSelTxt: { fontSize: 11.5, color: ig.text, fontWeight: '700', marginTop: 8 },
  videoSelSub: { fontSize: 10, color: ig.mut, marginTop: 3 },
  removeTxt: { fontSize: 11, color: ig.red, fontWeight: '700', textAlign: 'center', marginTop: 4 },

  urlBox: { backgroundColor: ig.bgSoft, borderRadius: 10, padding: 11 },
  urlL: { fontSize: 9.5, fontWeight: '800', color: ig.mut, letterSpacing: 0.4, marginBottom: 4 },
  urlV: { fontSize: 11.5, color: ig.blue, textDecorationLine: 'underline', fontWeight: '600' },
  notes: { backgroundColor: ig.bgSoft, borderRadius: 10, padding: 11, marginTop: 9 },
  notesL: { fontSize: 9.5, fontWeight: '800', color: ig.mut, letterSpacing: 0.4, marginBottom: 4 },
  notesT: { fontSize: 11.5, color: ig.text, lineHeight: 16 },

  revCard: { backgroundColor: '#FBEEEA', borderRadius: 13, padding: 13, borderWidth: 1.5, borderColor: ig.red, marginBottom: 10 },
  revHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 9 },
  revIco: { width: 24, height: 24, borderRadius: 12, backgroundColor: ig.red, alignItems: 'center', justifyContent: 'center' },
  revIcoTxt: { color: '#fff', fontSize: 14, fontWeight: '900' },
  revTitle: { fontSize: 12.5, fontWeight: '900', color: ig.red, letterSpacing: 0.3 },
  revBody: { backgroundColor: ig.bg, borderRadius: 10, padding: 11, borderWidth: 1, borderColor: '#F0D0C6' },
  revTxt: { fontSize: 12.5, color: ig.text, lineHeight: 18 },

  hint: { fontSize: 11.5, color: ig.mut, marginBottom: 11, lineHeight: 16 },
  pick: { flexDirection: 'row', alignItems: 'center', gap: 11, borderWidth: 1.5, borderColor: ig.text, borderStyle: 'dashed', borderRadius: 11, padding: 13, marginBottom: 8 },
  pickIco: { width: 34, height: 34, borderRadius: 9, backgroundColor: ig.yBg, alignItems: 'center', justifyContent: 'center' },
  pickT: { fontSize: 12.5, fontWeight: '800', color: ig.text },
  pickS: { fontSize: 10, color: ig.mut, marginTop: 1 },

  progRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 11 },
  progBar: { flex: 1, height: 8, backgroundColor: ig.bgSoft, borderRadius: 4, overflow: 'hidden' },
  progFill: { height: '100%', backgroundColor: ig.text, borderRadius: 4 },
  progTxt: { fontSize: 11.5, fontWeight: '800', color: ig.text, width: 42, textAlign: 'right' },

  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 13 },
  divLine: { flex: 1, height: 1, backgroundColor: ig.line },
  divTxt: { paddingHorizontal: 11, fontSize: 9.5, fontWeight: '800', color: ig.mut, letterSpacing: 0.3 },
  input: { borderWidth: 1.5, borderColor: ig.text, borderRadius: 10, padding: 11, fontSize: 11.5, color: ig.text, marginBottom: 10 },
  notesInput: { borderColor: ig.line, minHeight: 60 },

  btnDark: { backgroundColor: ig.text, borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
  btnDarkTxt: { fontSize: 12.5, fontWeight: '800', color: '#fff', textTransform: 'uppercase', letterSpacing: 0.2 },
  btnGreen: { backgroundColor: ig.green, borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
  btnGreenTxt: { fontSize: 12.5, fontWeight: '800', color: '#fff', textTransform: 'uppercase', letterSpacing: 0.2 },
  disabled: { opacity: 0.5 },

  waitCard: { alignItems: 'center', borderWidth: 1, borderColor: ig.line, borderRadius: 13, padding: 20, marginBottom: 10 },
  waitIco: { width: 50, height: 50, borderRadius: 13, backgroundColor: ig.yBg, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  waitT: { fontSize: 14, fontWeight: '800', color: ig.text, marginBottom: 5 },
  waitS: { fontSize: 11.5, color: ig.mut, textAlign: 'center', lineHeight: 16 },

  refreshBtn: { backgroundColor: ig.bgSoft, borderRadius: 8, paddingHorizontal: 11, paddingVertical: 6 },
  refreshTxt: { fontSize: 10.5, fontWeight: '800', color: ig.text },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  sb: { width: '31.5%', backgroundColor: ig.bgSoft, borderRadius: 10, padding: 10, alignItems: 'center' },
  sv: { fontSize: 15, fontWeight: '900', color: ig.text },
  sl: { fontSize: 8, fontWeight: '800', color: ig.mut, marginTop: 3, textTransform: 'uppercase', letterSpacing: 0.3 },
  erBox: { backgroundColor: ig.yBg, borderRadius: 10, padding: 10, marginTop: 8, alignItems: 'center', borderWidth: 1, borderColor: '#F0DA88' },
  erV: { fontSize: 20, fontWeight: '900', color: ig.yInk },
  erL: { fontSize: 8.5, fontWeight: '800', color: ig.yInk, marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.3 },

  celCard: { alignItems: 'center', borderWidth: 1, borderColor: ig.line, borderRadius: 13, padding: 20, marginBottom: 10 },
  celTile: { width: 54, height: 54, borderRadius: 13, backgroundColor: ig.y, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  celT: { fontSize: 16, fontWeight: '900', color: ig.text, marginBottom: 5 },
  celS: { fontSize: 11.5, color: ig.mut, textAlign: 'center', lineHeight: 16 },
});
