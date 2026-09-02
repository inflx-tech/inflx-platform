import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { ig } from '../../theme/ig';
import { brandApi } from '../../services/api';

/**
 * BrandCampaignCreateScreen — SB-23, "New campaign". Two fields, then the sets do the work.
 * Contract: features/stage-a-the-set
 * Board: features/screen-atlas/04-preview/mockups/atlas-brand.html → SB-23
 *
 * WHY IT ASKS SO LITTLE
 * Everything that used to sit at campaign level — budget, end date, who posts, and now the
 * date itself — either belongs to a set or was already settled at the handshake. What is
 * left is a name and an optional note to yourself.
 *
 * stage-a — the start date is GONE too, not just budget/end date. Founder, 2026-09-01: a
 * set is "one aim, one go-live day, one way of shooting" — the day that matters lives on
 * the set now (SB-26), not once on the campaign above it. The server no longer requires
 * start_date to create a campaign; the column stays, nullable, for a client that still
 * sends one.
 *
 * The lock note is not decoration. A brand who has used the web wizard will look for the
 * budget field; telling them where it went teaches the model, and a silent absence just
 * looks broken.
 */
export default function BrandCampaignCreateScreen({ navigation }) {
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const canGo = name.trim().length > 0;

  async function createIt() {
    if (!canGo || saving) return;
    setSaving(true);
    const res = await brandApi.createCampaign({ name: name.trim(), brief: note.trim() || null });
    setSaving(false);
    if (!res?.success) {
      Alert.alert('Could not start the campaign', res?.error?.message || 'Please try again.');
      return;
    }
    const campaign = res.data?.campaign;
    // replace, not push: the shell is a one-time question. Coming "back" to it from the
    // sets list would offer to create a second campaign, which is never what was meant.
    navigation.replace('BrandCampaignBuilder', { campaignId: campaign.id, campaignName: campaign.name });
  }

  return (
    <View style={s.container}>
      <View style={s.nav}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.back} activeOpacity={0.6}>
          <Icon name="chevron-left" size={24} color={ig.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>New campaign</Text>
          <Text style={s.sub}>STEP 1 · NAME IT</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <View style={s.sec}>
          <Text style={s.label}>Name it</Text>
          <TextInput
            style={s.input}
            value={name}
            onChangeText={setName}
            placeholder="e.g. Diwali Saree Edit"
            placeholderTextColor={ig.mut2}
            autoFocus
          />
          <Text style={s.help}>Creators see this name on their invite.</Text>
        </View>

        <View style={s.sec}>
          <Text style={s.label}>What is it for · optional</Text>
          <TextInput
            style={s.input}
            value={note}
            onChangeText={setNote}
            placeholder="A note to yourself"
            placeholderTextColor={ig.mut2}
          />
        </View>

        <View style={s.sec}>
          <View style={s.lock}>
            <Icon name="information-outline" size={15} color={ig.mut} />
            <Text style={s.lockT}>
              <Text style={s.lockB}>What a set is —</Text> one aim, one go-live day, one way
              of shooting. A different day or a different shoot is a second set.
            </Text>
          </View>
        </View>

        <View style={s.sec}>
          <TouchableOpacity
            style={[s.btn, s.btnPri, !canGo && s.btnOff]}
            disabled={!canGo || saving}
            onPress={createIt}
            activeOpacity={0.85}
          >
            {saving
              ? <ActivityIndicator color={ig.bg} />
              : <Text style={s.btnPriT}>Create · add a set</Text>}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: ig.bg },
  nav: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingTop: 12, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: ig.lineSoft },
  back: { padding: 4 },
  title: { fontSize: 17, fontWeight: '800', color: ig.text },
  sub: { fontSize: 10.5, fontWeight: '700', color: ig.mut, marginTop: 1, letterSpacing: 0.4 },
  sec: { paddingHorizontal: 14, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: ig.lineSoft },
  label: { fontSize: 9.5, fontWeight: '800', letterSpacing: 0.5, color: ig.mut, textTransform: 'uppercase', marginBottom: 6 },
  input: { borderWidth: 1, borderColor: ig.line, borderRadius: 9, paddingHorizontal: 11, paddingVertical: 10, fontSize: 13, fontWeight: '700', color: ig.text },
  help: { fontSize: 10.5, color: ig.mut, fontWeight: '650', marginTop: 7, lineHeight: 15 },
  err: { fontSize: 10.5, color: ig.red, fontWeight: '700', marginTop: 6 },
  lock: { flexDirection: 'row', gap: 9, alignItems: 'flex-start', backgroundColor: ig.bgSoft, borderWidth: 1, borderStyle: 'dashed', borderColor: ig.line, borderRadius: 11, padding: 12 },
  lockT: { flex: 1, fontSize: 11, color: ig.mut, fontWeight: '700', lineHeight: 16 },
  lockB: { color: ig.text, fontWeight: '800' },
  btn: { borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
  btnPri: { backgroundColor: ig.text },
  btnPriT: { fontSize: 13, fontWeight: '800', color: ig.bg },
  btnOff: { backgroundColor: ig.lineSoft },
});
