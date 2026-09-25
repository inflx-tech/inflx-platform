/**
 * UploadProbeScreen — the real-phone proof of item 12's uploads (Phase 2b, check 45).
 * Contract: features/item12-content · approval §1 ("proved with a real 200 MB video on a real
 * phone … If the streaming PUT does not survive on a device, stop").
 *
 * A test harness, not a product screen (item 11's "Test parcels" is the precedent). It is
 * reachable only while the server's CONTENT_UPLOAD_PROBE switch is on, and it keeps nothing:
 * the server signs a PUT exactly as the content step will, the file goes STRAIGHT to storage
 * through uploadContentFile (streamed from disk, never read into memory), the server measures
 * what landed and deletes it.
 *
 * Two checks: "Upload it" (a real file, must arrive byte for byte) and "Check the size lock"
 * (a URL signed one byte short — storage must refuse it).
 */

import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import { influencerApi, uploadContentFile } from '../../services/api';
import { PrimaryButton, SecondaryButton, FieldError } from '../../components/settings/primitives';
import { Header, s as base } from '../brand/BrandPitchSettingsScreen';
import { settingsTokens as T, fonts } from '../../theme/tokens';

const MB = 1024 * 1024;
const LIMIT = { 'video/mp4': 200 * MB, 'image/jpeg': 10 * MB, 'image/png': 10 * MB };
const mb = (n) => `${(Number(n || 0) / MB).toFixed(1)} MB`;
const secs = (ms) => (ms >= 60000 ? `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s` : `${(ms / 1000).toFixed(1)}s`);

export default function UploadProbeScreen({ navigation }) {
  const [asset, setAsset] = useState(null);
  const [busy, setBusy] = useState(null);          // 'upload' | 'lock' | null
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState([]);
  const [error, setError] = useState('');

  async function pick() {
    setError('');
    const r = await launchImageLibrary({ mediaType: 'mixed', selectionLimit: 1 });
    if (r.didCancel) return;
    const a = r.assets && r.assets[0];
    if (!a || !a.uri) return;
    const type = String(a.type || '').toLowerCase();
    if (!LIMIT[type]) { setError('Pick an MP4 video, or a JPG or PNG photo.'); return; }
    if (Number(a.fileSize) > LIMIT[type]) { setError(`That file is ${mb(a.fileSize)} — over the limit for this type.`); return; }
    setAsset({ uri: a.uri, type, size: Number(a.fileSize), name: a.fileName || 'file', duration: a.duration || null });
  }

  async function run(kind) {
    if (!asset || busy) return;
    setBusy(kind); setProgress(0); setError('');
    const started = Date.now();
    const line = { kind, name: asset.name, size: asset.size };
    try {
      const u = await influencerApi.uploadProbeUrl({ mime: asset.type, sizeBytes: asset.size, lieAboutSize: kind === 'lock' });
      if (!u.success) throw new Error(u.error ? u.error.message : 'Could not start the test.');
      let put = { ok: false };
      try {
        put = await uploadContentFile(u.data.upload, asset.uri, { onProgress: setProgress });
      } catch (e) {
        put = { ok: false, code: e.code || e.message, status: e.status || null };
      }
      const c = await influencerApi.uploadProbeConfirm({ probeToken: u.data.probeToken });
      const verdict = c.success ? c.data : null;
      if (kind === 'upload') {
        line.pass = !!(put.ok && verdict && verdict.match && verdict.deleted);
        line.text = put.ok
          ? `${verdict && verdict.match ? 'Arrived byte for byte' : 'Arrived, but it did not match'}: ${verdict && verdict.landed ? `${verdict.landed.size.toLocaleString('en-IN')} bytes, ${verdict.landed.contentType}` : 'nothing landed'} · ${secs(Date.now() - started)}${verdict && verdict.deleted ? ' · deleted' : ''}`
          : `The upload failed: ${put.code}${put.status ? ` (${put.status})` : ''} after ${secs(Date.now() - started)}`;
      } else {
        line.pass = !put.ok && put.status === 403 && verdict && !verdict.landed;
        line.text = !put.ok
          ? `Storage refused a file one byte longer than it was signed for${put.status ? ` (${put.status})` : ''} · nothing kept`
          : 'Storage ACCEPTED a file of the wrong size — the size lock did not hold.';
      }
    } catch (e) {
      line.pass = false;
      line.text = e.message || 'Something went wrong.';
    }
    setResults((prev) => [line, ...prev]);
    setBusy(null);
  }

  return (
    <View style={base.screen} testID="upload-probe">
      <Header title="Upload test" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={st.body}>
        <Text style={st.lead}>
          This checks that a large video reaches INFLX's storage from this phone. Nothing is kept: the file is measured and deleted.
        </Text>
        <PrimaryButton label={asset ? 'Pick a different file' : 'Pick a video'} onPress={pick} disabled={!!busy} testID="probe-pick" />
        <FieldError text={error} />
        {asset ? (
          <View style={st.card} testID="probe-asset">
            <Text style={st.name} numberOfLines={1}>{asset.name}</Text>
            <Text style={st.meta}>{`${mb(asset.size)} · ${asset.type}${asset.duration ? ` · ${Math.round(asset.duration)}s` : ''}`}</Text>
          </View>
        ) : null}
        {asset ? (
          <View style={{ marginTop: 12 }}>
            <PrimaryButton label="Upload it" onPress={() => run('upload')} busy={busy === 'upload'} disabled={!!busy}
              busyLabel={`Uploading ${Math.round(progress * 100)}%`} testID="probe-upload" />
            <View style={st.bar}><View style={[st.fill, { width: `${Math.round(progress * 100)}%` }]} /></View>
            {busy ? <Text style={st.meta}>Keep the app open until it finishes.</Text> : null}
            <View style={{ marginTop: 12 }}>
              <SecondaryButton label="Check the size lock" onPress={() => { if (!busy) run('lock'); }} testID="probe-lock" />
            </View>
          </View>
        ) : null}
        {results.map((r, i) => (
          <View key={`${i}-${r.kind}`} style={[st.card, r.pass ? st.pass : st.fail]} testID={`probe-result-${r.pass ? 'pass' : 'fail'}`}>
            <Text style={st.name}>{r.kind === 'upload' ? 'Upload' : 'Size lock'} · {r.pass ? 'passed' : 'FAILED'}</Text>
            <Text style={st.meta}>{r.text}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  body: { padding: 16, paddingBottom: 48 },
  lead: { fontFamily: fonts.sansRegular, fontSize: 14, color: T.ink2, lineHeight: 20, marginBottom: 16 },
  card: { borderWidth: 1, borderColor: T.border, backgroundColor: T.surface, borderRadius: 12, padding: 12, marginTop: 12 },
  pass: { borderColor: T.state.active.fg },
  fail: { borderColor: T.danger },
  name: { fontFamily: fonts.sansBold, fontSize: 14, color: T.ink },
  meta: { fontFamily: fonts.sansRegular, fontSize: 12, color: T.ink3, marginTop: 4 },
  bar: { height: 6, borderRadius: 3, backgroundColor: T.border, marginTop: 10, overflow: 'hidden' },
  fill: { height: 6, backgroundColor: T.ink },
});
