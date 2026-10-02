/**
 * MoveRequestScreen — N4: "Ask for a change". A set has one date and one mode for everyone, so
 * this is not a counter. It costs no round, it is possible even when countering is off, and the
 * original invitation stays alive whichever way the brand answers.
 * Contract: features/item6-negotiation · rules v1.18 §7B · prompt §6.3
 *
 * ui-walk-fixes (board C): "Send request" sits in its own strip under the form (BottomBar), never
 * over it, and the form is a FormScroll — the note she is typing, with its counter and error
 * line, stays in view above the strip.
 *
 * A REFUSED "SEND REQUEST" IS SHOWN (final review, finding C-3): the form is scrolled to the first
 * line that was refused, top to bottom — under the date box, under the note, or the form line at
 * the very end — with the helper the pop-ups use (useSheetReveal). The red line stays where it
 * was; nothing moves when it is already on show.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { settingsTokens as T, fonts } from '../../theme/tokens';
import { influencerApi } from '../../services/api';
import { PrimaryButton, FieldError } from '../../components/settings/primitives';
import { useSheetReveal } from '../../components/settings/sheets';
import { useToast, Skeleton, LoadError } from '../../components/settings/feedback';
import { BottomBar } from '../../components/shell/BottomBar';
import { FormScroll, FormArea } from '../../components/shell/FormScroll';
import { COPY } from '../../components/settings/copy';
import { Header, s as base } from '../brand/BrandPitchSettingsScreen';
import DateField from '../../components/DateField';
import { TextField4 } from '../../components/campaigns/bits4';
import { earliestGoLiveDay } from '../../utils/setShape';
import { C6, MSG6, longDate6, modeLabel6 } from '../../components/negotiation/copy6';

/** The lines "Send request" can refuse, in the order the form draws them; 'form' is the line at the end. */
const MOVE_FIELDS = ['day', 'note', 'form'];

export default function MoveRequestScreen({ navigation, route }) {
  const { ciId } = route?.params || {};
  const [status, setStatus] = useState('loading');
  const [thread, setThread] = useState(null);
  const [wantDate, setWantDate] = useState(false);
  const [wantMode, setWantMode] = useState(false);
  const [day, setDay] = useState(null);
  const [note, setNote] = useState('');
  const [errs, setErrs] = useState({});
  const [saving, setSaving] = useState(false);
  // Board C: the toast is drawn in the box above the button strip, just above it.
  const { toast, show } = useToast({ inFlow: true });
  // A refused "Send request" scrolls the form to the first line it refused (see the note at the
  // top). A hook — it must stay above the two early returns below.
  const reveal = useSheetReveal();

  const load = useCallback(async () => {
    setStatus('loading');
    const r = await influencerApi.myThread(ciId);
    if (!r.success) { setStatus('error'); return; }
    setThread(r.data.thread); setStatus('ready');
  }, [ciId]);
  useEffect(() => { load(); }, [load]);

  if (status === 'loading') return <View style={base.screen}><Header title={C6.move.title} onBack={() => navigation.goBack()} /><Skeleton /></View>;
  if (status === 'error') return <View style={base.screen}><Header title={C6.move.title} onBack={() => navigation.goBack()} /><LoadError onRetry={load} /></View>;

  // Item 4's floor: a posting date is at least seven days out, so that is the earliest she can ask for.
  const earliest = earliestGoLiveDay();
  const setMode = thread.shootMode || (thread.set && thread.set.shootMode);
  const otherMode = setMode === 'visit' ? 'shipment' : 'visit';

  function send() {
    const e = {};
    if (!wantDate && !wantMode) e.form = MSG6.MOVE_NOTHING;
    if (wantDate && !day) e.day = MSG6.MOVE_NOTHING;
    if (wantDate && day && day === thread.postingDate) e.day = MSG6.MOVE_SAME_DATE;
    if (note.length > 300) e.note = MSG6.NOTE_LONG;
    setErrs(e);
    // The red line stays where it is drawn; the form is scrolled to the first one refused.
    const refused = MOVE_FIELDS.find(k => e[k]);
    if (refused) reveal.show(refused);
    if (Object.keys(e).length) return;
    setSaving(true);
    influencerApi.requestMove(ciId, { goLiveDate: wantDate ? day : undefined, shootMode: wantMode ? otherMode : undefined, note: note.trim() || undefined }).then(r => {
      setSaving(false);
      if (!r.success) { setErrs({ form: r.error?.message || COPY.saveFailed }); reveal.show('form'); return; }
      navigation.replace('Thread', { ciId, toast: C6.move.sent });
    });
  }

  const Option = ({ on, onPress, title, sub, testID }) => (
    <TouchableOpacity style={[s.option, on && s.optionOn]} onPress={onPress} testID={testID} accessibilityRole="checkbox" accessibilityState={{ checked: !!on }}>
      <View style={{ flex: 1 }}><Text style={s.optionT}>{title}</Text><Text style={s.optionS}>{sub}</Text></View>
      <View style={[s.box, on && s.boxOn]}>{on ? <Text style={s.tick}>✓</Text> : null}</View>
    </TouchableOpacity>
  );

  return (
    <View style={base.screen} testID="move-request">
      <Header title={C6.move.title} onBack={() => navigation.goBack()} />
      <FormArea>
      <FormScroll ref={reveal.bodyRef} contentContainerStyle={{ padding: 18 }} testID="move-scroll">
        <View style={s.locked} testID="this-set">
          <Text style={s.lockedTitle}>{C6.move.thisSet}</Text>
          <View style={s.kv}><Text style={s.k}>{C6.counter.rows.posts}</Text><Text style={s.v}>{longDate6(thread.postingDate)}</Text></View>
          <View style={s.kv}><Text style={s.k}>{C6.counter.rows.mode}</Text><Text style={s.v}>{[modeLabel6(setMode), thread.cityName || (thread.set && thread.set.cityName)].filter(Boolean).join(' · ')}</Text></View>
        </View>

        <Text style={s.label}>{C6.move.what}</Text>
        <Option on={wantDate} onPress={() => { setWantDate(v => !v); setErrs({}); }} title={C6.move.dateOpt} sub={C6.move.dateOptSub} testID="want-date" />
        <Option on={wantMode} onPress={() => { setWantMode(v => !v); setErrs({}); }} title={C6.move.modeOpt} sub={setMode === 'visit' ? C6.move.modeOptSub : "You'd rather come to the store"} testID="want-mode" />

        {/* Each line "Send request" can refuse is marked so the form can be scrolled to it. The
            marks add no space: nothing has moved. */}
        {wantDate ? (
          <View ref={reveal.mark('day')} collapsable={false} style={{ marginTop: 12 }} testID="move-date-field">
            <DateField label={C6.move.dateLabel} value={day} onChange={(d) => { setDay(d); setErrs({}); }} minDate={earliest} confirmLabel="Use this date" error={errs.day} testID="move-date" />
          </View>
        ) : null}

        <View ref={reveal.mark('note')} collapsable={false} testID="move-note-field">
          <TextField4 label={C6.move.why} value={note} onChangeText={(v) => { setNote(v); setErrs(x => ({ ...x, note: undefined })); }} max={300} multiline error={errs.note} testID="move-note" />
        </View>
        <View style={s.explain} testID="move-explain">
          <Text style={s.explainText}>{wantDate && day ? C6.move.explain(thread.brand.name, day) : C6.move.explainMode(thread.brand.name)}</Text>
        </View>
        <View ref={reveal.mark('form')} collapsable={false} testID="move-form-line">
          <FieldError text={errs.form} />
        </View>
      </FormScroll>
      {toast}
      </FormArea>
      <BottomBar testID="move-actions">
        <PrimaryButton label={C6.move.send} onPress={send} busy={saving} testID="send-move" />
      </BottomBar>
    </View>
  );
}

const s = StyleSheet.create({
  locked: { backgroundColor: T.surface, borderRadius: 14, padding: 12, marginBottom: 16 },
  lockedTitle: { fontFamily: fonts.sansBold, fontSize: 12.5, color: T.ink2, marginBottom: 4 },
  kv: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, gap: 10 },
  k: { fontFamily: fonts.sansRegular, fontSize: 13, color: T.ink2 },
  v: { fontFamily: fonts.sansBold, fontSize: 13, color: T.ink, textAlign: 'right', flexShrink: 1 },
  label: { fontFamily: fonts.sansBold, fontSize: 13, color: T.ink, marginBottom: 8 },
  option: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: T.border, borderRadius: 12, padding: 12, marginBottom: 8 },
  optionOn: { borderColor: T.ink, backgroundColor: T.surface },
  optionT: { fontFamily: fonts.sansBold, fontSize: 14, color: T.ink },
  optionS: { fontFamily: fonts.sansRegular, fontSize: 12, color: T.ink2, marginTop: 2 },
  box: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: T.border, alignItems: 'center', justifyContent: 'center', marginLeft: 10, backgroundColor: T.bg },
  boxOn: { backgroundColor: T.ink, borderColor: T.ink },
  tick: { color: '#FFFFFF', fontSize: 13, fontFamily: fonts.sansBold },
  explain: { borderRadius: 12, padding: 11, backgroundColor: T.state.waiting.bg, marginTop: 4 },
  explainText: { fontFamily: fonts.sansSemiBold, fontSize: 12.5, color: T.state.waiting.fg, lineHeight: 18 },
});
