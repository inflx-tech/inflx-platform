import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { ig } from '../../theme/ig';
import { influencerApi } from '../../services/api';
import DateField from '../../components/DateField';
import * as setShape from '../../utils/setShape';

/**
 * CreatorDeferScreen — the single button on SC-05, "I have a different day or way of
 * shooting in mind", opened out into what it actually needs to collect.
 * Contract: features/stage-a-the-set
 * Board: features/screen-atlas SB-24's "Moved out" is the other end of this — see there.
 *
 * NOT A NEGOTIATION THREAD. She states a preference once; the brand acts on it later,
 * from the campaign builder, possibly alongside other creators who said the same thing.
 * There is no reply, no counter-to-her-counter here — that is deliberately out of scope
 * (the atlas calls the full back-and-forth Stage B; this is a smaller, founder-scoped
 * slice of it, 2026-09-02).
 *
 * WHY BOTH FIELDS ARE OPTIONAL, INDEPENDENTLY
 * She might only have an issue with the day, or only the shoot — not necessarily both.
 * Forcing an answer to a question she has no opinion on would just be noise for the
 * brand to read past.
 */
export default function CreatorDeferScreen({ route, navigation }) {
  const { campaignInfluencerId, brandName, campaignName } = route.params || {};

  const [goLiveDate, setGoLiveDate] = useState('');
  const [shootMode, setShootMode] = useState(null);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const earliest = setShape.earliestGoLiveDay();
  const canSend = !!(goLiveDate || shootMode);

  async function send() {
    if (!canSend || saving) return;
    setSaving(true);
    const res = await influencerApi.deferOffer(campaignInfluencerId, {
      go_live_date: goLiveDate || undefined,
      shoot_mode: shootMode || undefined,
      note: note.trim() || undefined,
    });
    setSaving(false);
    if (!res?.success) {
      Alert.alert('Could not send this', res?.error?.message || 'Please try again.');
      return;
    }
    Alert.alert(
      'Sent',
      `${brandName || 'The brand'} can see what you'd prefer, and may build a new set around it.`,
      [{ text: 'Done', onPress: () => navigation.navigate('CollabsList') }],
    );
  }

  return (
    <View style={s.container}>
      <View style={s.nav}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.back} activeOpacity={0.6}>
          <Icon name="chevron-left" size={24} color={ig.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>Ask for something else</Text>
          <Text style={s.sub} numberOfLines={1}>{(campaignName || '').toUpperCase()}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <View style={s.sec}>
          <View style={s.noteN}>
            <Text style={s.noteT}>
              This is not asking to change the fee or what you sell — those stay as
              offered. Say what day or shoot would actually work, and{' '}
              {brandName || 'the brand'} decides whether to build a set around it.
            </Text>
          </View>
        </View>

        <View style={s.sec2}>
          <Text style={s.label}>A day that would work · optional</Text>
          <DateField
            label="Preferred day"
            value={goLiveDate}
            onChange={setGoLiveDate}
            placeholder="Choose a day"
            minDate={earliest}
          />
        </View>

        <View style={s.sec2}>
          <Text style={s.label}>How you'd shoot · optional</Text>
          <View style={{ flexDirection: 'row', gap: 9, marginTop: 6 }}>
            {setShape.SHOOT_MODES_OFFERED.map((m) => {
              const on = shootMode === m;
              const copy = setShape.SHOOT_MODE_COPY[m];
              return (
                <TouchableOpacity
                  key={m}
                  style={[s.modeCard, on && s.modeCardOn]}
                  onPress={() => setShootMode(on ? null : m)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                >
                  <Text style={[s.modeTitle, on && s.modeTitleOn]}>{copy.title}</Text>
                  <Text style={[s.modeSub, on && s.modeSubOn]}>{copy.sub}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={s.sec2}>
          <Text style={s.label}>Why · optional</Text>
          <TextInput
            style={[s.input, s.inputMulti]}
            value={note}
            onChangeText={setNote}
            placeholder="e.g. I can only shoot on a weekend"
            placeholderTextColor={ig.mut2}
            multiline
          />
        </View>

        <View style={s.sec}>
          <TouchableOpacity
            style={[s.btn, s.btnPri, !canSend && s.btnOff]}
            disabled={!canSend || saving}
            onPress={send}
            activeOpacity={0.85}
          >
            {saving ? <ActivityIndicator color={ig.bg} /> : <Text style={s.btnPriT}>Send to {brandName || 'the brand'}</Text>}
          </TouchableOpacity>
          {!canSend && <Text style={s.help}>Pick a day, a shoot, or both.</Text>}
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: ig.bg },
  nav: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingTop: 12, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: ig.lineSoft },
  back: { padding: 4 },
  title: { fontSize: 16, fontWeight: '800', color: ig.text },
  sub: { fontSize: 10.5, fontWeight: '700', color: ig.mut, marginTop: 1, letterSpacing: 0.4 },

  sec: { paddingHorizontal: 14, paddingVertical: 11 },
  sec2: { paddingHorizontal: 14, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: ig.lineSoft },
  label: { fontSize: 9.5, fontWeight: '800', letterSpacing: 0.5, color: ig.mut, textTransform: 'uppercase', marginBottom: 6 },
  help: { fontSize: 10.5, color: ig.mut, fontWeight: '650', marginTop: 8, textAlign: 'center' },

  noteN: { backgroundColor: ig.bgSoft, borderRadius: 11, padding: 12 },
  noteT: { fontSize: 11.5, color: ig.mut, fontWeight: '700', lineHeight: 17 },

  input: { borderWidth: 1, borderColor: ig.line, borderRadius: 9, paddingHorizontal: 11, paddingVertical: 10, fontSize: 13, fontWeight: '700', color: ig.text },
  inputMulti: { minHeight: 70, textAlignVertical: 'top' },

  modeCard: { flex: 1, borderWidth: 1, borderColor: ig.line, borderRadius: 11, padding: 11 },
  modeCardOn: { borderColor: ig.text, borderWidth: 1.5, backgroundColor: ig.bgSoft },
  modeTitle: { fontSize: 12.5, fontWeight: '800', color: ig.text },
  modeTitleOn: { color: ig.text },
  modeSub: { fontSize: 10.5, color: ig.mut, fontWeight: '650', marginTop: 3, lineHeight: 14 },
  modeSubOn: { color: ig.text2 },

  btn: { borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
  btnPri: { backgroundColor: ig.text },
  btnPriT: { fontSize: 13, fontWeight: '800', color: ig.bg },
  btnOff: { backgroundColor: ig.lineSoft },
});
