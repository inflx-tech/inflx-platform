import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, ActivityIndicator, Alert, Linking, Image,
  Platform,
} from 'react-native';
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';
import { colors } from '../../theme/tokens';
import { influencerApi, uploadFile } from '../../services/api';

const STATUS_CONFIG = {
  pending:           { label: 'Pending',           color: colors.t3,    bg: colors.surface2 },
  submitted:         { label: 'Under Review',       color: colors.orange, bg: colors.orange + '22' },
  under_review:      { label: 'Under Review',       color: colors.orange, bg: colors.orange + '22' },
  revision_requested:{ label: 'Revision Needed',    color: colors.red,   bg: colors.redPale },
  approved:          { label: 'Approved',           color: colors.teal,  bg: colors.teal + '22' },
  live:              { label: 'Live',               color: colors.navy,  bg: colors.navy + '22' },
};

const TYPE_LABELS = {
  reel: 'Instagram Reel',
  post: 'Instagram Post',
  story: 'Instagram Story',
  youtube_video: 'YouTube Video',
  youtube_short: 'YouTube Short',
};

export default function DeliverableScreen({ navigation, route }) {
  const { deliverable: initialDeliverable, deliverableId } = route.params || {};
  const [deliverable, setDeliverable] = useState(initialDeliverable || null);
  const [loading, setLoading] = useState(!initialDeliverable && !!deliverableId);

  // Media upload state
  const [selectedMedia, setSelectedMedia] = useState(null);  // { uri, type, fileName }
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);

  // URL-based submission (fallback)
  const [submitUrl, setSubmitUrl] = useState('');
  const [liveUrl, setLiveUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Media playback URL
  const [mediaUrl, setMediaUrl] = useState(null);
  const [loadingMedia, setLoadingMedia] = useState(false);

  // Stats
  const [stats, setStats] = useState(null);
  const [refreshingStats, setRefreshingStats] = useState(false);

  // Fetch deliverable by ID if not passed as full object
  useEffect(() => {
    if (!initialDeliverable && deliverableId) {
      (async () => {
        setLoading(true);
        try {
          const res = await influencerApi.getDeliverable(deliverableId);
          if (res.success && res.data?.deliverable) {
            setDeliverable(res.data.deliverable);
          } else if (res.success && res.data) {
            setDeliverable(res.data);
          }
        } catch (e) {
          console.error('[DeliverableScreen] fetch failed:', e);
        } finally {
          setLoading(false);
        }
      })();
    }
  }, [deliverableId]);

  // Fetch media URL if deliverable has media_key
  useEffect(() => {
    if (deliverable?.media_key && !mediaUrl) {
      (async () => {
        setLoadingMedia(true);
        try {
          const res = await influencerApi.getMediaUrl(deliverable.id);
          if (res.success && res.data?.url) {
            setMediaUrl(res.data.url);
          }
        } catch (e) {
          console.error('[DeliverableScreen] media URL fetch failed:', e);
        } finally {
          setLoadingMedia(false);
        }
      })();
    }
  }, [deliverable?.media_key]);

  // Fetch existing stats for live deliverables
  useEffect(() => {
    if (deliverable?.status === 'live' && deliverable?.id) {
      (async () => {
        try {
          const res = await influencerApi.getDeliverable(deliverable.id);
          if (res.success && res.data?.stats) {
            setStats(res.data.stats);
          }
        } catch (e) {
          // Non-critical
        }
      })();
    }
  }, [deliverable?.id, deliverable?.status]);

  async function handleRefreshStats() {
    if (!deliverable?.id) return;
    setRefreshingStats(true);
    try {
      const res = await influencerApi.refreshStats(deliverable.id);
      if (res.success && res.data?.stats) {
        setStats(res.data.stats);
        Alert.alert('Stats Updated', 'Latest engagement data has been fetched from Instagram.');
      } else {
        Alert.alert('Failed', res.error?.message || 'Could not refresh stats');
      }
    } catch (e) {
      Alert.alert('Error', e.message || 'Failed to refresh stats');
    } finally {
      setRefreshingStats(false);
    }
  }

  const statusCfg = STATUS_CONFIG[deliverable?.status] || STATUS_CONFIG.pending;

  // ── Media picker ──────────────────────────────────────────────────────────

  function pickFromGallery() {
    launchImageLibrary(
      {
        mediaType: 'mixed',
        videoQuality: 'high',
        selectionLimit: 1,
        includeBase64: false,
      },
      handlePickerResponse,
    );
  }

  function recordVideo() {
    launchCamera(
      {
        mediaType: 'video',
        videoQuality: 'high',
        durationLimit: 300, // 5 min max
      },
      handlePickerResponse,
    );
  }

  function handlePickerResponse(response) {
    if (response.didCancel) return;
    if (response.errorCode) {
      Alert.alert('Error', response.errorMessage || 'Could not pick file');
      return;
    }
    const asset = response.assets?.[0];
    if (!asset) return;

    setSelectedMedia({
      uri: asset.uri,
      type: asset.type || 'video/mp4',
      fileName: asset.fileName || `content_${Date.now()}.mp4`,
      fileSize: asset.fileSize,
      width: asset.width,
      height: asset.height,
      duration: asset.duration,
    });
  }

  // ── Upload & Submit ───────────────────────────────────────────────────────

  async function handleMediaUpload() {
    if (!selectedMedia) return;

    try {
      setUploading(true);
      setUploadProgress(0);

      // Step 1: Get upload URL from backend
      const urlRes = await influencerApi.getUploadUrl(deliverable.id, {
        filename: selectedMedia.fileName,
        content_type: selectedMedia.type,
      });

      if (!urlRes.success) {
        Alert.alert('Error', urlRes.error?.message || 'Failed to get upload URL');
        setUploading(false);
        return;
      }

      const { url, key, method } = urlRes.data;

      // Step 2: Upload file
      await uploadFile(
        url,
        method,
        selectedMedia.uri,
        selectedMedia.fileName,
        selectedMedia.type,
        key,
        (progress) => setUploadProgress(progress),
      );

      setUploadProgress(1);

      // Step 3: Submit deliverable with media_key
      const submitRes = await influencerApi.submitDeliverable(deliverable.id, {
        media_key: key,
        media_type: selectedMedia.type,
      });

      if (submitRes.success) {
        setDeliverable(submitRes.data?.deliverable || { ...deliverable, status: 'submitted', media_key: key });
        setSelectedMedia(null);
        Alert.alert('Submitted!', 'Your content has been uploaded and sent for brand review.');
      } else {
        Alert.alert('Failed', submitRes.error?.message || 'Submission failed');
      }
    } catch (e) {
      Alert.alert('Upload Failed', e.message || 'Could not upload file');
    } finally {
      setUploading(false);
    }
  }

  async function handleUrlSubmit() {
    if (!submitUrl.trim()) {
      Alert.alert('URL required', 'Please paste the content draft URL');
      return;
    }
    setSubmitting(true);
    const res = await influencerApi.submitDeliverable(deliverable.id, {
      submitted_url: submitUrl.trim(),
    });
    setSubmitting(false);
    if (res.success) {
      setDeliverable(res.data?.deliverable || { ...deliverable, status: 'submitted' });
      Alert.alert('Submitted!', 'Your content has been sent for brand review.');
    } else {
      Alert.alert('Failed', res.error?.message || 'Submission failed');
    }
  }

  async function handleSubmitLive() {
    if (!liveUrl.trim()) {
      Alert.alert('URL required', 'Please paste the live post URL');
      return;
    }
    setSubmitting(true);
    const res = await influencerApi.submitLive(deliverable.id, { live_url: liveUrl.trim() });
    setSubmitting(false);
    if (res.success) {
      setDeliverable(res.data?.deliverable || { ...deliverable, status: 'live', live_url: liveUrl });
      Alert.alert('Done!', 'Live URL submitted. Brand will confirm and Tranche 2 will be released.');
    } else {
      Alert.alert('Failed', res.error?.message || 'Failed');
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={colors.navy} /></View>;
  }

  if (!deliverable) {
    return <View style={styles.center}><Text style={styles.errorText}>No deliverable data</Text></View>;
  }

  const isVideo = (selectedMedia?.type || deliverable?.media_type || '').startsWith('video');
  const isImage = (selectedMedia?.type || deliverable?.media_type || '').startsWith('image');
  const canSubmit = ['pending', 'revision_requested'].includes(deliverable.status);

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <View style={styles.headerRow}>
          <Text style={styles.title}>
            {TYPE_LABELS[deliverable.type] || deliverable.type?.toUpperCase() || 'DELIVERABLE'}
          </Text>
          <View style={[styles.statusBadge, { backgroundColor: statusCfg.bg }]}>
            <Text style={[styles.statusText, { color: statusCfg.color }]}>{statusCfg.label}</Text>
          </View>
        </View>
        {deliverable.submission_deadline && (
          <Text style={styles.sub}>
            Deadline: {new Date(deliverable.submission_deadline).toLocaleDateString('en-IN', {
              day: 'numeric', month: 'short', year: 'numeric',
            })}
          </Text>
        )}
      </View>

      {/* Info card */}
      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Type</Text>
          <Text style={styles.rowValue}>{deliverable.type?.replace(/_/g, ' ')}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Revisions</Text>
          <Text style={styles.rowValue}>{deliverable.revision_count || 0}/{deliverable.revision_limit || 2}</Text>
        </View>
        {deliverable.content_requirements && (
          <View style={styles.requirementsBox}>
            <Text style={styles.requirementsLabel}>Content Brief</Text>
            <Text style={styles.requirementsText}>{deliverable.content_requirements}</Text>
          </View>
        )}
      </View>

      {/* Brand feedback (revision) */}
      {deliverable.status === 'revision_requested' && deliverable.brand_feedback && (
        <View style={[styles.card, styles.revisionCard]}>
          <Text style={styles.revisionTitle}>⚠ Revision Requested</Text>
          <Text style={styles.revisionText}>{deliverable.brand_feedback}</Text>
        </View>
      )}

      {/* Existing media preview */}
      {deliverable.media_key && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Submitted Content</Text>
          {loadingMedia ? (
            <ActivityIndicator size="small" color={colors.navy} />
          ) : mediaUrl ? (
            <View>
              {(deliverable.media_type || '').startsWith('image') ? (
                <Image source={{ uri: mediaUrl }} style={styles.mediaPreview} resizeMode="contain" />
              ) : (
                <TouchableOpacity
                  style={styles.videoPreviewBox}
                  onPress={() => Linking.openURL(mediaUrl)}
                >
                  <Text style={styles.videoPlayIcon}>▶</Text>
                  <Text style={styles.videoPlayText}>Tap to play video</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <Text style={styles.hint}>Media uploaded</Text>
          )}
        </View>
      )}

      {/* Existing URL if submitted */}
      {deliverable.submitted_url && !deliverable.media_key && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Submitted URL</Text>
          <TouchableOpacity onPress={() => Linking.openURL(deliverable.submitted_url)}>
            <Text style={styles.link}>{deliverable.submitted_url}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── UPLOAD SECTION (pending / revision_requested) ─────────────── */}
      {canSubmit && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            {deliverable.status === 'revision_requested' ? 'Upload Revised Content' : 'Upload Content'}
          </Text>

          {/* Selected media preview */}
          {selectedMedia && (
            <View style={styles.previewContainer}>
              {selectedMedia.type?.startsWith('image') ? (
                <Image source={{ uri: selectedMedia.uri }} style={styles.mediaPreview} resizeMode="contain" />
              ) : (
                <View style={styles.videoSelected}>
                  <Text style={styles.videoSelectedIcon}>🎬</Text>
                  <Text style={styles.videoSelectedText}>
                    {selectedMedia.fileName}
                  </Text>
                  {selectedMedia.duration && (
                    <Text style={styles.videoSelectedDuration}>
                      {Math.round(selectedMedia.duration)}s
                      {selectedMedia.fileSize ? ` · ${(selectedMedia.fileSize / 1024 / 1024).toFixed(1)} MB` : ''}
                    </Text>
                  )}
                </View>
              )}
              <TouchableOpacity style={styles.removeBtn} onPress={() => setSelectedMedia(null)}>
                <Text style={styles.removeBtnText}>✕ Remove</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Upload progress */}
          {uploading && (
            <View style={styles.progressContainer}>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: `${Math.round(uploadProgress * 100)}%` }]} />
              </View>
              <Text style={styles.progressText}>{Math.round(uploadProgress * 100)}%</Text>
            </View>
          )}

          {/* Picker buttons */}
          {!selectedMedia && !uploading && (
            <View style={styles.pickerButtons}>
              <TouchableOpacity style={styles.pickerBtn} onPress={pickFromGallery}>
                <Text style={styles.pickerBtnIcon}>📁</Text>
                <Text style={styles.pickerBtnText}>Choose from Gallery</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.pickerBtn} onPress={recordVideo}>
                <Text style={styles.pickerBtnIcon}>📹</Text>
                <Text style={styles.pickerBtnText}>Record Video</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Submit button */}
          {selectedMedia && !uploading && (
            <TouchableOpacity style={styles.uploadBtn} onPress={handleMediaUpload}>
              <Text style={styles.uploadBtnText}>Upload & Submit for Review</Text>
            </TouchableOpacity>
          )}

          {/* Divider — OR paste URL */}
          {!selectedMedia && !uploading && (
            <>
              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>OR</Text>
                <View style={styles.dividerLine} />
              </View>
              <Text style={styles.hint}>Paste a URL instead (Google Drive, Dropbox, etc.)</Text>
              <TextInput
                style={styles.urlInput}
                value={submitUrl}
                onChangeText={setSubmitUrl}
                placeholder="https://drive.google.com/..."
                placeholderTextColor={colors.t3}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
              />
              <TouchableOpacity
                style={[styles.submitBtn, (submitting || !submitUrl.trim()) && { opacity: 0.5 }]}
                onPress={handleUrlSubmit}
                disabled={submitting || !submitUrl.trim()}
              >
                {submitting
                  ? <ActivityIndicator color={colors.white} />
                  : <Text style={styles.submitBtnText}>Submit URL for Review</Text>
                }
              </TouchableOpacity>
            </>
          )}
        </View>
      )}

      {/* Live URL if live */}
      {deliverable.live_url && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Live Post</Text>
          <TouchableOpacity onPress={() => Linking.openURL(deliverable.live_url)}>
            <Text style={styles.link}>{deliverable.live_url}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ACTION: Submit live URL (approved — waiting for brand confirm) */}
      {deliverable.status === 'approved' && !deliverable.live_url && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Submit Live Post URL</Text>
          <Text style={styles.hint}>Once your content is posted live on social media, paste the public URL here.</Text>
          <TextInput
            style={styles.urlInput}
            value={liveUrl}
            onChangeText={setLiveUrl}
            placeholder="https://instagram.com/p/..."
            placeholderTextColor={colors.t3}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />
          <TouchableOpacity
            style={[styles.liveBtn, (submitting || !liveUrl.trim()) && { opacity: 0.5 }]}
            onPress={handleSubmitLive}
            disabled={submitting || !liveUrl.trim()}
          >
            {submitting
              ? <ActivityIndicator color={colors.white} />
              : <Text style={styles.submitBtnText}>Mark as Live</Text>
            }
          </TouchableOpacity>
        </View>
      )}

      {/* Submitted — waiting for brand review */}
      {deliverable.status === 'submitted' && (
        <View style={[styles.card, { alignItems: 'center', paddingVertical: 24 }]}>
          <Text style={{ fontSize: 28, marginBottom: 8 }}>⏳</Text>
          <Text style={styles.cardTitle}>Waiting for Brand Review</Text>
          <Text style={styles.hint}>Your content has been submitted. The brand will review and approve or request changes.</Text>
        </View>
      )}

      {/* Live — Stats Dashboard */}
      {deliverable.status === 'live' && (
        <View style={styles.card}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <Text style={styles.cardTitle}>Live Performance</Text>
            <TouchableOpacity
              style={styles.refreshBtn}
              onPress={handleRefreshStats}
              disabled={refreshingStats}
            >
              {refreshingStats
                ? <ActivityIndicator size="small" color={colors.navy} />
                : <Text style={styles.refreshBtnText}>Refresh Stats</Text>
              }
            </TouchableOpacity>
          </View>

          {stats ? (
            <View>
              <View style={styles.statsGrid}>
                <View style={styles.statBox}>
                  <Text style={styles.statValue}>{_fmtNum(stats.likes)}</Text>
                  <Text style={styles.statLabel}>Likes</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={styles.statValue}>{_fmtNum(stats.comments)}</Text>
                  <Text style={styles.statLabel}>Comments</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={styles.statValue}>{_fmtNum(stats.saves)}</Text>
                  <Text style={styles.statLabel}>Saves</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={styles.statValue}>{_fmtNum(stats.shares)}</Text>
                  <Text style={styles.statLabel}>Shares</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={styles.statValue}>{_fmtNum(stats.reach)}</Text>
                  <Text style={styles.statLabel}>Reach</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={styles.statValue}>{_fmtNum(stats.impressions)}</Text>
                  <Text style={styles.statLabel}>Impressions</Text>
                </View>
              </View>
              {stats.engagement_rate != null && (
                <View style={styles.erBox}>
                  <Text style={styles.erValue}>{parseFloat(stats.engagement_rate).toFixed(2)}%</Text>
                  <Text style={styles.erLabel}>Engagement Rate</Text>
                </View>
              )}
              {stats.scraped_at && (
                <Text style={[styles.hint, { marginTop: 8, marginBottom: 0 }]}>
                  Last updated: {new Date(stats.scraped_at).toLocaleString('en-IN')}
                </Text>
              )}
            </View>
          ) : (
            <View style={{ alignItems: 'center', paddingVertical: 16 }}>
              <Text style={styles.hint}>No stats yet. Tap "Refresh Stats" to fetch live data from Instagram.</Text>
            </View>
          )}
        </View>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

function _fmtNum(n) {
  if (!n && n !== 0) return '--';
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return String(n);
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { fontSize: 14, color: colors.t2 },
  header: { backgroundColor: colors.navyDeep, padding: 20, paddingTop: 52 },
  back: { marginBottom: 12 },
  backText: { fontSize: 13, color: 'rgba(255,255,255,0.6)', fontWeight: '600' },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { fontSize: 18, fontWeight: '800', color: colors.white, flex: 1 },
  statusBadge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  statusText: { fontSize: 10, fontWeight: '700' },
  sub: { fontSize: 12, color: 'rgba(255,255,255,0.55)', marginTop: 4 },

  card: { margin: 16, marginBottom: 0, backgroundColor: colors.white, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.border },
  cardTitle: { fontSize: 14, fontWeight: '700', color: colors.t1, marginBottom: 10 },

  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
  rowLabel: { fontSize: 12, color: colors.t3, fontWeight: '600' },
  rowValue: { fontSize: 12, color: colors.t1, fontWeight: '700', textTransform: 'capitalize' },

  requirementsBox: { backgroundColor: colors.surface2, borderRadius: 10, padding: 12, marginTop: 10 },
  requirementsLabel: { fontSize: 10, fontWeight: '700', color: colors.t3, textTransform: 'uppercase', marginBottom: 4 },
  requirementsText: { fontSize: 12, color: colors.t2, lineHeight: 18 },

  link: { fontSize: 12, color: colors.navy, textDecorationLine: 'underline' },

  revisionCard: { borderColor: colors.red, borderWidth: 1.5 },
  revisionTitle: { fontSize: 13, fontWeight: '700', color: colors.red, marginBottom: 6 },
  revisionText: { fontSize: 12, color: colors.t2, lineHeight: 18 },

  hint: { fontSize: 11, color: colors.t3, marginBottom: 10, lineHeight: 16, textAlign: 'center' },

  // Picker buttons
  pickerButtons: { gap: 10, marginBottom: 12 },
  pickerBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: colors.surface2, borderRadius: 12, padding: 16,
    borderWidth: 2, borderColor: colors.border2, borderStyle: 'dashed',
  },
  pickerBtnIcon: { fontSize: 24 },
  pickerBtnText: { fontSize: 14, fontWeight: '600', color: colors.t1 },

  // Selected media preview
  previewContainer: { marginBottom: 12 },
  mediaPreview: { width: '100%', height: 200, borderRadius: 12, backgroundColor: colors.surface2, marginBottom: 8 },
  videoSelected: {
    backgroundColor: colors.surface2, borderRadius: 12, padding: 20,
    alignItems: 'center', marginBottom: 8,
  },
  videoSelectedIcon: { fontSize: 40, marginBottom: 8 },
  videoSelectedText: { fontSize: 12, color: colors.t2, textAlign: 'center' },
  videoSelectedDuration: { fontSize: 11, color: colors.t3, marginTop: 4 },
  removeBtn: { alignSelf: 'center', padding: 8 },
  removeBtnText: { fontSize: 12, color: colors.red, fontWeight: '600' },

  // Video preview for already-submitted content
  videoPreviewBox: {
    backgroundColor: '#000', borderRadius: 12, padding: 30,
    alignItems: 'center', justifyContent: 'center',
  },
  videoPlayIcon: { fontSize: 36, color: '#fff', marginBottom: 6 },
  videoPlayText: { fontSize: 12, color: 'rgba(255,255,255,0.7)' },

  // Progress bar
  progressContainer: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  progressBar: { flex: 1, height: 8, backgroundColor: colors.surface2, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: colors.navy, borderRadius: 4 },
  progressText: { fontSize: 12, fontWeight: '700', color: colors.navy, width: 40, textAlign: 'right' },

  // Buttons
  uploadBtn: { backgroundColor: colors.navy, borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 4 },
  uploadBtnText: { fontSize: 14, fontWeight: '700', color: colors.white },
  submitBtn: { backgroundColor: colors.t2, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  liveBtn: { backgroundColor: colors.teal, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  submitBtnText: { fontSize: 14, fontWeight: '700', color: colors.white },

  // Divider
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 16 },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { paddingHorizontal: 12, fontSize: 11, fontWeight: '700', color: colors.t3 },

  urlInput: { borderWidth: 2, borderColor: colors.border2, borderRadius: 12, padding: 12, fontSize: 13, color: colors.t1, marginBottom: 12 },

  // Stats
  refreshBtn: { backgroundColor: colors.surface2, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  refreshBtnText: { fontSize: 11, fontWeight: '700', color: colors.navy },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statBox: { width: '31%', backgroundColor: colors.surface2, borderRadius: 10, padding: 12, alignItems: 'center' },
  statValue: { fontSize: 18, fontWeight: '800', color: colors.t1 },
  statLabel: { fontSize: 10, fontWeight: '600', color: colors.t3, marginTop: 2, textTransform: 'uppercase' },
  erBox: { backgroundColor: colors.navy + '11', borderRadius: 10, padding: 12, marginTop: 10, alignItems: 'center' },
  erValue: { fontSize: 22, fontWeight: '800', color: colors.navy },
  erLabel: { fontSize: 10, fontWeight: '600', color: colors.t3, marginTop: 2, textTransform: 'uppercase' },
});
