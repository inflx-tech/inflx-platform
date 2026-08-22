import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
  ActivityIndicator, Alert, Switch,
} from 'react-native';
import { ig } from '../../theme/ig';
// Stage 1 — restyled from brandPalette to the ig kit as part of moving into Collabs.
// A yellow screen one tap inside a white tab reads as a different app.
import { influencerApi } from '../../services/api';

/**
 * CollabPreferencesScreen — the creator's mute and their own bar.
 * Contract: features/collab-part2-precampaign-handshake (mockup tab ⑪).
 *
 * Creators are reachable BY DEFAULT (founder: a creator who cannot be found cannot get
 * work) and control it here: mute brand requests entirely, opt out of bulk outreach
 * only, or set a bar — minimum commission, minimum fee, aims they take. A brand whose
 * terms fall below the bar is told the request cannot be sent, rather than the creator
 * being silently spammed or the brand silently ignored.
 */

const AIMS = [
  { v: 'conversion', label: 'Pay per sale' },
  { v: 'engagement', label: 'Pay for content' },
  { v: 'hybrid', label: 'Both' },
];

export default function CollabPreferencesScreen() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [accepts, setAccepts] = useState(true);
  const [broadcasts, setBroadcasts] = useState(true);
  const [minCommission, setMinCommission] = useState('');
  const [minFee, setMinFee] = useState('');
  const [aims, setAims] = useState([]);

  useEffect(() => {
    influencerApi.getCollabPreferences().then(res => {
      if (res.success) {
        const p = res.data?.preferences || {};
        setAccepts(p.accepts_brand_requests !== false);
        setBroadcasts(p.include_in_broadcasts !== false);
        setMinCommission(p.min_commission_pct != null ? String(p.min_commission_pct) : '');
        setMinFee(p.min_fee != null ? String(p.min_fee) : '');
        setAims(p.accepted_aims || []);
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    const res = await influencerApi.updateCollabPreferences({
      accepts_brand_requests: accepts,
      include_in_broadcasts: broadcasts,
      min_commission_pct: minCommission === '' ? null : Number(minCommission),
      min_fee: minFee === '' ? null : Number(minFee),
      accepted_aims: aims,
    });
    setSaving(false);
    if (res.success) Alert.alert('Saved', 'Your collaboration preferences are updated.');
    else Alert.alert('Could not save', res.error?.message || 'Try again.');
  };

  if (loading) return <View style={s.center}><ActivityIndicator color={ig.y} /></View>;

  return (
    <ScrollView style={s.wrap} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <View style={s.row}>
        <View style={{ flex: 1, paddingRight: 10 }}>
          <Text style={s.rk}>Brands can ask me</Text>
          <Text style={s.rs}>Turn off and no brand can send you a collaboration request — they are told why, not ignored.</Text>
        </View>
        <Switch value={accepts} onValueChange={setAccepts} trackColor={{ true: ig.y }} thumbColor={ig.bg} />
      </View>

      <View style={[s.row, !accepts && { opacity: 0.45 }]}>
        <View style={{ flex: 1, paddingRight: 10 }}>
          <Text style={s.rk}>Include me in bulk outreach</Text>
          <Text style={s.rs}>Filter-matched requests sent to many creators at once. You stay open to a brand approaching you directly.</Text>
        </View>
        <Switch value={broadcasts} onValueChange={setBroadcasts} disabled={!accepts} trackColor={{ true: ig.y }} thumbColor={ig.bg} />
      </View>

      <Text style={s.h}>ONLY ASK ME IF</Text>
      <Text style={s.fl}>Minimum commission %</Text>
      <TextInput style={s.inp} value={minCommission} onChangeText={setMinCommission} keyboardType="numeric" placeholder="No minimum" placeholderTextColor={ig.mut2} />
      <Text style={s.fl}>Minimum fee (₹)</Text>
      <TextInput style={s.inp} value={minFee} onChangeText={setMinFee} keyboardType="numeric" placeholder="No minimum" placeholderTextColor={ig.mut2} />

      <Text style={s.fl}>Aims I take (none selected = all)</Text>
      <View style={s.chips}>
        {AIMS.map(a => {
          const on = aims.includes(a.v);
          return (
            <TouchableOpacity key={a.v} style={[s.chip, on && s.chipAct]}
              onPress={() => setAims(on ? aims.filter(x => x !== a.v) : [...aims, a.v])}>
              <Text style={[s.chipTxt, on && s.chipTxtAct]}>{a.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <TouchableOpacity style={s.cta} disabled={saving} onPress={save}>
        <Text style={s.ctaTxt}>{saving ? 'SAVING…' : 'SAVE PREFERENCES'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: ig.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: ig.bg },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: ig.bg, borderRadius: 11, borderWidth: 1, borderColor: ig.line, padding: 13, marginBottom: 9 },
  rk: { fontSize: 13, color: ig.text },
  rs: { fontSize: 10.5, color: ig.mut, marginTop: 3, lineHeight: 14 },
  h: { fontSize: 9.5, color: ig.mut, letterSpacing: 0.5, marginTop: 14, marginBottom: 8 },
  fl: { fontSize: 9, color: ig.text2, letterSpacing: 0.4, marginBottom: 4, marginTop: 8, textTransform: 'uppercase' },
  inp: { backgroundColor: ig.bg, borderWidth: 1, borderColor: ig.line, borderRadius: 9, paddingHorizontal: 11, paddingVertical: 9, fontSize: 13, color: ig.text },
  chips: { flexDirection: 'row', gap: 7, flexWrap: 'wrap', marginTop: 2 },
  chip: { backgroundColor: ig.bg, borderWidth: 1, borderColor: ig.line, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  chipAct: { backgroundColor: ig.text, borderColor: ig.text },
  chipTxt: { fontSize: 11.5, color: ig.text2 },
  chipTxtAct: { color: ig.y },
  cta: { backgroundColor: ig.y, borderRadius: 11, paddingVertical: 13, alignItems: 'center', marginTop: 20 },
  ctaTxt: { fontSize: 13, color: ig.text, letterSpacing: 0.4 },
});
