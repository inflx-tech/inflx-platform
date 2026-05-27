import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, ActivityIndicator, Alert, Linking, Image,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';
import { brandPalette as P, fonts } from '../../theme/tokens';
import { influencerApi, uploadFile } from '../../services/api';
import StatusPill from '../../components/brand/StatusPill';

const TYPE_LABELS = {
  reel: 'Instagram Reel',
  post: 'Instagram Post',
  story: 'Instagram Story',
  youtube_video: 'YouTube Video',
  youtube_short: 'YouTube Short',
};

/**
 * DeliverableScreen — single deliverable view with media picker + R2 upload
 * + URL fallback + live stats.
 *
 * Flow 33 restyle (2026-05-27): brandPalette + Outfit/Plus Jakarta Sans/
 * JetBrains Mono fonts + StatusPill canonical for status badge.
 * Image-picker SDK config + 3-step R2 upload state machine + onprogress
 * callback preserved verbatim. Picker emoji (📁/📹) → dashed ink-bordered
 * tiles with yellowPale MCI image-multi/video icons. Action emoji
 * (⏳/🎬 preview) replaced with MCI clock/video tiles per design call #4.
 * Type emoji (DELIVERABLE_ICONS) — N/A here, owned by DeliverableList.
 */

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
        Alert.alert('Submitted', 'Your content has been uploaded and sent for brand review.');
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
      Alert.alert('Submitted', 'Your content has been sent for brand review.');
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
      Alert.alert('Done', 'Live URL submitted. Brand will confirm and Tranche 2 will be released.');
    } else {
      Alert.alert('Failed', res.error?.message || 'Failed');
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={P.yellow} /></View>;
  }

  if (!deliverable) {
    return <View style={styles.center}><Text style={styles.errorText}>No deliverable data</Text></View>;
  }

  const canSubmit = ['pending', 'revision_requested'].includes(deliverable.status);

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backRow}>
          <Icon name="chevron-left" size={14} color="rgba(255,255,255,0.65)" />
          <Text style={styles.backText}>BACK</Text>
        </TouchableOpacity>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>
              {TYPE_LABELS[deliverable.type] || deliverable.type?.toUpperCase() || 'DELIVERABLE'}
            </Text>
            {deliverable.submission_deadline && (
              <Text style={styles.sub}>
                DEADLINE: {new Date(deliverable.submission_deadline).toLocaleDateString('en-IN', {
                  day: 'numeric', month: 'short', year: 'numeric',
                }).toUpperCase()}
              </Text>
            )}
          </View>
          <View style={{ alignSelf: 'flex-start', marginTop: 2 }}>
            <StatusPill status={deliverable.status} />
          </View>
        </View>
        <View style={styles.headerAccent} />
      </View>

      {/* Info card */}
      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Type</Text>
          <Text style={styles.rowValue}>{(deliverable.type || '').replace(/_/g, ' ').toUpperCase()}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Revisions</Text>
          <Text style={styles.rowValue}>{deliverable.revision_count || 0} / {deliverable.revision_limit || 2}</Text>
        </View>
        {deliverable.content_requirements && (
          <View style={styles.requirementsBox}>
            <Text style={styles.requirementsLabel}>CONTENT BRIEF</Text>
            <Text style={styles.requirementsText}>{deliverable.content_requirements}</Text>
          </View>
        )}
      </View>

      {/* Brand feedback (revision) */}
      {deliverable.status === 'revision_requested' && deliverable.brand_feedback && (
        <View style={styles.revisionCard}>
          <View style={styles.revisionHead}>
            <View style={styles.revisionIcoWrap}>
              <Text style={styles.revisionIco}>!</Text>
            </View>
            <Text style={styles.revisionTitle}>REVISION REQUESTED</Text>
          </View>
          <View style={styles.revisionBody}>
            <Text style={styles.revisionText}>{deliverable.brand_feedback}</Text>
          </View>
        </View>
      )}

      {/* Existing media preview */}
      {deliverable.media_key && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Submitted Content</Text>
          {loadingMedia ? (
            <ActivityIndicator size="small" color={P.yellow} />
          ) : mediaUrl ? (
            <View>
              {(deliverable.media_type || '').startsWith('image') ? (
                <Image source={{ uri: mediaUrl }} style={styles.mediaPreview} resizeMode="contain" />
              ) : (
                <TouchableOpacity
                  style={styles.videoPreviewBox}
                  onPress={() => Linking.openURL(mediaUrl)}
                >
                  <Icon name="play-circle" size={48} color={P.yellow} />
                  <Text style={styles.videoPlayText}>TAP TO PLAY VIDEO</Text>
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
          <TouchableOpacity onPress={() => Linking.openURL(deliverable.submitted_url)} style={styles.urlBox}>
            <Text style={styles.urlLabel}>DRAFT URL</Text>
            <Text style={styles.urlLink} numberOfLines={2}>{deliverable.submitted_url}</Text>
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
                  <View style={styles.previewIconTile}>
                    <Icon name="video-outline" size={26} color={P.yellow} />
                  </View>
                  <Text style={styles.videoSelectedText}>{selectedMedia.fileName}</Text>
                  {selectedMedia.duration && (
                    <Text style={styles.videoSelectedDuration}>
                      {Math.round(selectedMedia.duration)}S
                      {selectedMedia.fileSize ? ` · ${(selectedMedia.fileSize / 1024 / 1024).toFixed(1)} MB` : ''}
                    </Text>
                  )}
                </View>
              )}
              <TouchableOpacity style={styles.removeBtn} onPress={() => setSelectedMedia(null)}>
                <Text style={styles.removeBtnText}>REMOVE</Text>
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

          {/* Picker tiles */}
          {!selectedMedia && !uploading && (
            <View style={styles.pickerButtons}>
              <TouchableOpacity style={styles.pickerTile} onPress={pickFromGallery}>
                <View style={styles.pickerIcon}>
                  <Icon name="image-multiple-outline" size={20} color={P.yellowText} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.pickerLbl}>Choose from Gallery</Text>
                  <Text style={styles.pickerSub}>PHOTOS &amp; VIDEOS · SYSTEM PICKER</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity style={styles.pickerTile} onPress={recordVideo}>
                <View style={styles.pickerIcon}>
                  <Icon name="video-outline" size={20} color={P.yellowText} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.pickerLbl}>Record Video</Text>
                  <Text style={styles.pickerSub}>CAMERA · UP TO 5 MIN</Text>
                </View>
              </TouchableOpacity>
            </View>
          )}

          {/* Submit button (media selected) */}
          {selectedMedia && !uploading && (
            <TouchableOpacity style={styles.uploadBtn} onPress={handleMediaUpload}>
              <Text style={styles.uploadBtnText}>UPLOAD &amp; SUBMIT FOR REVIEW</Text>
            </TouchableOpacity>
          )}

          {/* Disabled CTA while uploading */}
          {uploading && (
            <View style={[styles.uploadBtn, { opacity: 0.5 }]}>
              <Text style={styles.uploadBtnText}>UPLOADING…</Text>
            </View>
          )}

          {/* Divider — OR paste URL */}
          {!selectedMedia && !uploading && (
            <>
              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>OR PASTE URL</Text>
                <View style={styles.dividerLine} />
              </View>
              <Text style={styles.hint}>Paste a URL instead (Google Drive, Dropbox, etc.)</Text>
              <TextInput
                style={styles.urlInput}
                value={submitUrl}
                onChangeText={setSubmitUrl}
                placeholder="https://drive.google.com/…"
                placeholderTextColor={P.muted3}
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
                  ? <ActivityIndicator color={P.yellow} />
                  : <Text style={styles.submitBtnText}>SUBMIT URL FOR REVIEW</Text>
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
          <TouchableOpacity onPress={() => Linking.openURL(deliverable.live_url)} style={styles.urlBox}>
            <Text style={styles.urlLabel}>LIVE URL</Text>
            <Text style={styles.urlLink} numberOfLines={2}>{deliverable.live_url}</Text>
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
            placeholder="https://instagram.com/p/…"
            placeholderTextColor={P.muted3}
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
              ? <ActivityIndicator color={P.white} />
              : <Text style={styles.liveBtnText}>MARK AS LIVE</Text>
            }
          </TouchableOpacity>
        </View>
      )}

      {/* Submitted — waiting for brand review */}
      {deliverable.status === 'submitted' && (
        <View style={styles.waitCard}>
          <View style={styles.waitTile}>
            <Icon name="clock-outline" size={26} color={P.yellowText} />
          </View>
          <Text style={styles.waitTitle}>Waiting for Brand Review</Text>
          <Text style={styles.waitText}>Your content has been submitted. The brand will review and approve or request changes.</Text>
        </View>
      )}

      {/* Live — Stats Dashboard */}
      {deliverable.status === 'live' && (
        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <Text style={styles.cardTitle}>Live Performance</Text>
            <TouchableOpacity
              style={styles.refreshBtn}
              onPress={handleRefreshStats}
              disabled={refreshingStats}
            >
              {refreshingStats
                ? <ActivityIndicator size="small" color={P.ink} />
                : (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                    <Icon name="refresh" size={11} color={P.ink} />
                    <Text style={styles.refreshBtnText}>REFRESH</Text>
                  </View>
                )
              }
            </TouchableOpacity>
          </View>

          {stats ? (
            <View>
              <View style={styles.statsGrid}>
                <View style={styles.statBox}>
                  <Text style={styles.statValue}>{_fmtNum(stats.likes)}</Text>
                  <Text style={styles.statLabel}>LIKES</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={styles.statValue}>{_fmtNum(stats.comments)}</Text>
                  <Text style={styles.statLabel}>COMMENTS</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={styles.statValue}>{_fmtNum(stats.saves)}</Text>
                  <Text style={styles.statLabel}>SAVES</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={styles.statValue}>{_fmtNum(stats.shares)}</Text>
                  <Text style={styles.statLabel}>SHARES</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={styles.statValue}>{_fmtNum(stats.reach)}</Text>
                  <Text style={styles.statLabel}>REACH</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={styles.statValue}>{_fmtNum(stats.impressions)}</Text>
                  <Text style={styles.statLabel}>IMPRESSIONS</Text>
                </View>
              </View>
              {stats.engagement_rate != null && (
                <View style={styles.erBox}>
                  <Text style={styles.erValue}>{parseFloat(stats.engagement_rate).toFixed(2)}%</Text>
                  <Text style={styles.erLabel}>ENGAGEMENT RATE</Text>
                </View>
              )}
              {stats.scraped_at && (
                <Text style={[styles.hint, { marginTop: 10, marginBottom: 0 }]}>
                  Last updated: {new Date(stats.scraped_at).toLocaleString('en-IN')}
                </Text>
              )}
            </View>
          ) : (
            <View style={{ alignItems: 'center', paddingVertical: 16 }}>
              <Text style={styles.hint}>No stats yet. Tap "Refresh" to fetch live data from Instagram.</Text>
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
  container: { flex: 1, backgroundColor: P.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: P.bg },
  errorText: { fontSize: 14, color: P.muted, fontFamily: fonts.sansRegular },

  // Header
  header: { backgroundColor: P.ink, padding: 18, paddingTop: 50, paddingBottom: 22, position: 'relative' },
  headerAccent: {
    position: 'absolute', left: 18, bottom: 8, width: 30, height: 3,
    backgroundColor: P.yellow, borderRadius: 2,
  },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 14 },
  backText: { fontSize: 10, color: 'rgba(255,255,255,0.65)', fontWeight: '800', letterSpacing: 0.3, fontFamily: fonts.monoBold },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 },
  title: { fontSize: 20, fontWeight: '900', color: P.white, letterSpacing: -0.3, fontFamily: fonts.displayBlack },
  sub: { fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 3, fontWeight: '700', letterSpacing: 0.2, fontFamily: fonts.monoMedium },

  card: {
    margin: 14, marginBottom: 0, backgroundColor: P.white, borderRadius: 14,
    padding: 14, borderWidth: 1, borderColor: P.border,
  },
  cardTitle: {
    fontSize: 12.5, fontWeight: '800', color: P.ink,
    textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 11,
    fontFamily: fonts.displayBlack,
  },
  cardTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },

  row: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: P.borderSoft,
  },
  rowLabel: { fontSize: 11.5, color: P.muted, fontWeight: '600', fontFamily: fonts.sansRegular },
  rowValue: { fontSize: 11.5, color: P.ink, fontWeight: '800', letterSpacing: 0.2, fontFamily: fonts.monoBold },

  requirementsBox: { backgroundColor: P.bg2, borderRadius: 10, padding: 11, marginTop: 11 },
  requirementsLabel: {
    fontSize: 9.5, fontWeight: '800', color: P.muted2,
    textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4,
    fontFamily: fonts.monoBold,
  },
  requirementsText: { fontSize: 11.5, color: P.ink, lineHeight: 17, fontFamily: fonts.sansRegular },

  // Revision card (PROMINENT — dangerPale per locked design call #2)
  revisionCard: {
    margin: 14, marginBottom: 0,
    backgroundColor: P.dangerPale, borderRadius: 14, padding: 14,
    borderWidth: 1.5, borderColor: P.danger,
  },
  revisionHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  revisionIcoWrap: {
    width: 26, height: 26, borderRadius: 13, backgroundColor: P.dangerText,
    alignItems: 'center', justifyContent: 'center',
  },
  revisionIco: { color: P.white, fontSize: 15, fontWeight: '900', fontFamily: fonts.displayBlack },
  revisionTitle: {
    fontSize: 13.5, fontWeight: '900', color: P.dangerText,
    textTransform: 'uppercase', letterSpacing: 0.3, fontFamily: fonts.displayBlack,
  },
  revisionBody: {
    backgroundColor: P.white, borderRadius: 11, padding: 12,
    borderWidth: 1, borderColor: '#F8D0C2',
  },
  revisionText: { fontSize: 12.5, color: P.ink, lineHeight: 18, fontFamily: fonts.sansRegular },

  // URL box
  urlBox: { backgroundColor: P.bg2, borderRadius: 10, padding: 11 },
  urlLabel: {
    fontSize: 9.5, fontWeight: '800', color: P.muted2,
    textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4,
    fontFamily: fonts.monoBold,
  },
  urlLink: { fontSize: 11.5, color: P.info, textDecorationLine: 'underline', fontWeight: '700', fontFamily: fonts.monoMedium },

  hint: { fontSize: 11, color: P.muted, marginBottom: 11, lineHeight: 16, fontFamily: fonts.sansRegular },

  // Picker tiles
  pickerButtons: { gap: 9, marginBottom: 12 },
  pickerTile: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: P.white, borderRadius: 12, padding: 14,
    borderWidth: 1.5, borderColor: P.ink, borderStyle: 'dashed',
  },
  pickerIcon: {
    width: 36, height: 36, borderRadius: 9, backgroundColor: P.yellowPale,
    alignItems: 'center', justifyContent: 'center',
  },
  pickerLbl: { fontSize: 13, fontWeight: '800', color: P.ink, fontFamily: fonts.displayBold },
  pickerSub: { fontSize: 10, color: P.muted2, marginTop: 2, fontWeight: '700', letterSpacing: 0.2, fontFamily: fonts.monoMedium },

  // Selected media preview
  previewContainer: { marginBottom: 12 },
  mediaPreview: { width: '100%', height: 200, borderRadius: 12, backgroundColor: P.bg2, marginBottom: 8 },
  videoSelected: {
    backgroundColor: P.bg2, borderRadius: 11, padding: 18,
    alignItems: 'center', marginBottom: 8,
    borderWidth: 1, borderColor: P.border,
  },
  previewIconTile: {
    width: 48, height: 48, borderRadius: 11, backgroundColor: P.ink,
    alignItems: 'center', justifyContent: 'center', marginBottom: 9,
  },
  videoSelectedText: { fontSize: 11, color: P.ink, fontWeight: '800', textAlign: 'center', fontFamily: fonts.monoBold },
  videoSelectedDuration: { fontSize: 9.5, color: P.muted2, marginTop: 3, fontWeight: '700', fontFamily: fonts.monoMedium },
  removeBtn: { alignSelf: 'center', padding: 8 },
  removeBtnText: {
    fontSize: 10.5, color: P.dangerText, fontWeight: '800',
    textTransform: 'uppercase', letterSpacing: 0.3,
    borderBottomWidth: 1, borderStyle: 'dashed', borderBottomColor: P.dangerText,
    fontFamily: fonts.monoBold,
  },

  // Video preview for already-submitted content
  videoPreviewBox: {
    backgroundColor: P.ink, borderRadius: 12, padding: 30,
    alignItems: 'center', justifyContent: 'center',
  },
  videoPlayText: { fontSize: 10, color: P.yellow, fontWeight: '800', marginTop: 8, letterSpacing: 0.3, fontFamily: fonts.monoBold },

  // Progress bar
  progressContainer: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 11 },
  progressBar: { flex: 1, height: 8, backgroundColor: P.bg2, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: P.ink, borderRadius: 4 },
  progressText: { fontSize: 11.5, fontWeight: '900', color: P.ink, width: 44, textAlign: 'right', fontFamily: fonts.monoBold },

  // Buttons
  uploadBtn: { backgroundColor: P.ink, borderRadius: 11, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  uploadBtnText: { fontSize: 13, fontWeight: '900', color: P.yellow, letterSpacing: 0.2, textTransform: 'uppercase', fontFamily: fonts.displayBlack },
  submitBtn: { backgroundColor: P.ink, borderRadius: 11, paddingVertical: 13, alignItems: 'center' },
  submitBtnText: { fontSize: 13, fontWeight: '900', color: P.yellow, letterSpacing: 0.2, textTransform: 'uppercase', fontFamily: fonts.displayBlack },
  liveBtn: { backgroundColor: P.success, borderRadius: 11, paddingVertical: 13, alignItems: 'center' },
  liveBtnText: { fontSize: 13, fontWeight: '900', color: P.white, letterSpacing: 0.2, textTransform: 'uppercase', fontFamily: fonts.displayBlack },

  // Divider
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 14 },
  dividerLine: { flex: 1, height: 1, backgroundColor: P.border },
  dividerText: {
    paddingHorizontal: 12, fontSize: 10, fontWeight: '800', color: P.muted2,
    letterSpacing: 0.3, fontFamily: fonts.monoBold,
  },

  urlInput: {
    borderWidth: 1.5, borderColor: P.ink, borderRadius: 10,
    padding: 11, fontSize: 11.5, color: P.ink, marginBottom: 11,
    fontFamily: fonts.monoMedium,
  },

  // Wait card (submitted state) — yellowPale tile per design call #4 (replaces ⏳ emoji)
  waitCard: {
    margin: 14, marginBottom: 0, backgroundColor: P.white,
    borderRadius: 14, padding: 22, alignItems: 'center',
    borderWidth: 1, borderColor: P.border,
  },
  waitTile: {
    width: 54, height: 54, borderRadius: 13, backgroundColor: P.yellowPale,
    alignItems: 'center', justifyContent: 'center', marginBottom: 11,
  },
  waitTitle: { fontSize: 14.5, fontWeight: '900', color: P.ink, marginBottom: 6, fontFamily: fonts.displayBlack },
  waitText: { fontSize: 11.5, color: P.muted, lineHeight: 17, textAlign: 'center', fontFamily: fonts.sansRegular },

  // Stats
  refreshBtn: { backgroundColor: P.bg2, borderRadius: 8, paddingHorizontal: 11, paddingVertical: 6 },
  refreshBtnText: { fontSize: 10, fontWeight: '800', color: P.ink, letterSpacing: 0.3, fontFamily: fonts.monoBold },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  statBox: { width: '31.5%', backgroundColor: P.bg2, borderRadius: 10, padding: 11, alignItems: 'center' },
  statValue: { fontSize: 16, fontWeight: '900', color: P.ink, fontFamily: fonts.monoBold },
  statLabel: {
    fontSize: 8.5, fontWeight: '800', color: P.muted2,
    marginTop: 3, textTransform: 'uppercase', letterSpacing: 0.3,
    fontFamily: fonts.monoBold,
  },
  erBox: {
    backgroundColor: P.yellowPale, borderRadius: 11, padding: 11,
    marginTop: 10, alignItems: 'center',
    borderWidth: 1, borderColor: '#F0DA88',
  },
  erValue: { fontSize: 22, fontWeight: '900', color: P.yellowText, fontFamily: fonts.monoBold },
  erLabel: { fontSize: 9, fontWeight: '800', color: P.yellowText, marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.3, fontFamily: fonts.monoBold },
});
