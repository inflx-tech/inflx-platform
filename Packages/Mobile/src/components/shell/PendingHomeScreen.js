/**
 * PendingHomeScreen — C3 (creator) / B2 (brand): the Home tab for an account that is not yet
 * approved. "Under review — usually within 24 hours. You can look around while you wait.",
 * two soft cards, and the FinishProfileSheet on the first focus of the app session when the
 * profile is incomplete — carrying the reason, not just the ask.
 *
 * This screen decides for itself: it reads GET /…/me on mount, and when the account is
 * approved it renders Home (item 19: screens/home/HomeScreen — the four sections). Everything
 * for an account NOT yet approved is exactly as registration-and-profile built it.
 * Contract: features/registration-and-profile · spec §6.5 · features/item19-home
 */
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { settingsTokens as T, fonts } from '../../theme/tokens';
import { brandApi, influencerApi, emitAccountGate } from '../../services/api';
import { setAccountStatus } from '../../services/accountStatus';
import { gateEventFor } from '../../navigation/lockedTab';
import { PrimaryButton, SecondaryButton } from '../settings/primitives';
import { Sheet, sh } from '../settings/sheets';
import { Skeleton } from '../settings/feedback';
import HomeScreen from '../../screens/home/HomeScreen';
import { joinLabels } from '../registration/completeness';
import useTopInset, { TOP_GAP_TITLE } from '../../hooks/useTopInset';

export const PENDING_COPY = {
  underReview: 'Under review',
  underReviewLine: 'Usually within 24 hours. You can look around while you wait.',
  creator: {
    brandTitle: 'INFLX',
    cards: [
      { key: 'brands', title: 'Brands on INFLX', sub: "Browse who's here", tab: 'CollabsTab', screen: 'FindBrands' },
      { key: 'how', title: 'How collaborations work', sub: 'A 2-minute read', tab: 'ProfileTab', screen: 'LegalList', mainUnder: true },
    ],
    note: 'This gets you approved faster — an admin can only verify an account that\'s complete.',
  },
  brand: {
    cards: [
      { key: 'campaigns', title: 'Campaigns', sub: 'Locked until approved', locked: true },
      { key: 'creators', title: 'Find creators', sub: 'Locked until approved', locked: true },
    ],
    note: 'This gets you approved faster — an admin can only verify a business that\'s complete.',
  },
  sheet: {
    title: 'Finish your profile',
    line: (done, total, labels) => `${done} of ${total} done. Add your ${joinLabels(labels)}.`,
    complete: 'Complete profile',
    later: 'Later',
  },
};

// Once per app session, not once per visit to the tab (spec: "on first focus per app session").
let _sheetShownThisSession = false;
export function _resetFinishProfileSheet() { _sheetShownThisSession = false; }

export function FinishProfileSheet({ visible, done, total, labels, note, onComplete, onLater }) {
  return (
    <Sheet visible={visible} onClose={onLater} testID="finish-profile-sheet">
      <View style={sh.head}>
        <Text style={sh.title}>{PENDING_COPY.sheet.title}</Text>
        <TouchableOpacity onPress={onLater} accessibilityRole="button" accessibilityLabel="Close" testID="finish-profile-close"><Text style={sh.clear}>✕</Text></TouchableOpacity>
      </View>
      <Text style={sh.body} testID="finish-profile-line">{PENDING_COPY.sheet.line(done, total, labels)}</Text>
      <View style={s.green}><Text style={s.greenText}>{note}</Text></View>
      <View style={{ height: 16 }} />
      <PrimaryButton label={PENDING_COPY.sheet.complete} onPress={onComplete} testID="finish-profile-complete" />
      <SecondaryButton label={PENDING_COPY.sheet.later} onPress={onLater} testID="finish-profile-later" />
    </Sheet>
  );
}

export default function PendingHomeScreen(props) {
  const { navigation, route } = props;
  const kind = (props.kind || route?.params?.kind || 'brandHome');
  const isBrand = kind.startsWith('brand');
  const [status, setStatus] = useState('loading');
  const [me, setMe] = useState(null);
  const [sheet, setSheet] = useState(false);
  // ui-walk-fixes D4 — no blank strip above the title: the phone's real top inset plus a small gap.
  const top = useTopInset(TOP_GAP_TITLE);

  const load = useCallback(async () => {
    const r = isBrand ? await brandApi.getMe() : await influencerApi.getMe();
    if (!r || !r.success) { setStatus('unknown'); return; }
    setMe(r.data || {});
    // Keep the tab lock's store current — this screen reads /me on every mount anyway.
    if (r.data && r.data.user_status) setAccountStatus(r.data.user_status);
    setStatus('ready');
  }, [isBrand]);
  useEffect(() => { load(); }, [load]);

  const userStatus = me ? (me.user_status || (me.brand && me.brand.user_status) || (me.influencer && me.influencer.user_status) || 'pending') : null;
  const completeness = (me && me.completeness) || null;

  useFocusEffect(useCallback(() => {
    if (status !== 'ready' || userStatus === 'approved' || !completeness) return;
    if (_sheetShownThisSession) return;
    if (Number(completeness.done) < Number(completeness.total)) { _sheetShownThisSession = true; setSheet(true); }
  }, [status, userStatus, completeness]));

  // Approved → Home. Unknown (the /me read failed) → Home too: it has its own retry state, and an
  // approved person whose connection dropped must not be shown "Under review".
  if (status === 'unknown' || (status === 'ready' && userStatus === 'approved')) return <HomeScreen navigation={navigation} side={isBrand ? 'brand' : 'creator'} />;
  if (status === 'loading') return <View style={s.screen} testID="pending-home-loading"><Text style={[s.tabTitle, { paddingTop: top }]}>{route?.params?.tabTitle || 'Home'}</Text><Skeleton rows={3} /></View>;

  const copy = isBrand ? PENDING_COPY.brand : PENDING_COPY.creator;
  const heading = isBrand ? ((me.brand && me.brand.business_name) || 'Home') : PENDING_COPY.creator.brandTitle;
  const goProfile = () => { setSheet(false); navigation.navigate('ProfileTab'); };
  // A locked tile stays visually locked but is not silently dead: a tap raises the same sheet a
  // locked tab press (or the server's 403) raises, with the server's words for this status.
  const pressCard = (c) => {
    if (c.locked) { emitAccountGate(gateEventFor(userStatus)); return; }
    // ui-walk-fixes D3 — a card that opens a screen inside another tab. Where that tab is open to
    // a pending account (Profile), the tab's main page is put underneath (`mainUnder`): the screen
    // then has no bottom tabs and Back reaches the main page. A LOCKED tab's main page must never
    // be built, so that card ("Brands on INFLX") jumps as before and keeps the tabs.
    if (c.screen) navigation.navigate(c.tab, c.mainUnder ? { screen: c.screen, initial: false } : { screen: c.screen });
    else if (c.tab) navigation.navigate(c.tab);
  };

  return (
    <View style={s.screen} testID={`pending-home-${isBrand ? 'brand' : 'creator'}`}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <Text style={[s.tabTitle, { paddingTop: top }]}>{heading}</Text>
        <View style={s.note} testID="pending-home-note">
          <Text style={s.noteTitle}>{PENDING_COPY.underReview}</Text>
          <Text style={s.noteBody}>{PENDING_COPY.underReviewLine}</Text>
        </View>
        {copy.cards.map((c) => (
          <TouchableOpacity
            key={c.key}
            style={[s.card, c.locked && s.cardLocked]}
            onPress={() => pressCard(c)}
            accessibilityRole="button"
            accessibilityHint={c.locked ? c.sub : undefined}
            testID={`pending-card-${c.key}`}
          >
            <Text style={s.cardTitle}>{c.title}</Text>
            <Text style={s.cardSub}>{c.sub}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      <FinishProfileSheet
        visible={sheet}
        done={completeness ? completeness.done : 0}
        total={completeness ? completeness.total : 10}
        labels={completeness ? completeness.missing_labels : []}
        note={copy.note}
        onComplete={goProfile}
        onLater={() => setSheet(false)}
      />
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: T.bg },
  tabTitle: { fontFamily: fonts.sansBold, fontSize: 20, color: T.ink, paddingTop: TOP_GAP_TITLE, paddingHorizontal: 18, paddingBottom: 12 },
  note: { marginHorizontal: 18, backgroundColor: T.state.yourMove.bg, borderRadius: 12, padding: 14, marginBottom: 14 },
  noteTitle: { fontFamily: fonts.sansBold, fontSize: 14, color: T.state.yourMove.fg },
  noteBody: { fontFamily: fonts.sansRegular, fontSize: 12.5, color: T.state.yourMove.fg, marginTop: 3, lineHeight: 18 },
  card: { marginHorizontal: 18, backgroundColor: T.surface, borderRadius: 12, padding: 16, marginBottom: 10 },
  cardLocked: { opacity: 0.6 },
  cardTitle: { fontFamily: fonts.sansSemiBold, fontSize: 15, color: T.ink },
  cardSub: { fontFamily: fonts.sansRegular, fontSize: 12.5, color: T.ink2, marginTop: 3 },
  green: { backgroundColor: T.state.active.bg, borderRadius: 10, padding: 12, marginTop: 12 },
  greenText: { fontFamily: fonts.sansMedium, fontSize: 12.5, color: T.state.active.fg, lineHeight: 18 },
});
