/**
 * PlatformCard — one card per platform (S1 for brands, R4/R5 for the creator), with every
 * state from the locked mockups. Contract: features/item3b-social-numbers · prompt §5
 *
 * props: platform · data (A1 block for brands, A3 block for the creator; null = not added)
 *        mode 'brand' | 'creator' · onPress (detail) · onFix · onAdd · onCheckAgain · checkBusy
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { settingsTokens as T, fonts } from '../../theme/tokens';
import { fmtCompact, fmtPct, fmtDate } from '../discovery/copy3';
import { C3B, PLATFORM_LABEL } from './copy3b';

export function MetricTile({ value, label, hero }) {
  const none = value == null || value === '—';
  return (
    <View style={[st.tile, hero && st.tileHero]}>
      <Text style={[st.tileV, hero && st.tileVHero, none && st.tileVNone]} numberOfLines={1}>{none ? '—' : value}</Text>
      <Text style={st.tileL} numberOfLines={2}>{label}</Text>
    </View>
  );
}

export function StateBox({ tone = 'wait', title, body, spinner, testID }) {
  const colors = tone === 'wait' ? T.state.waiting : tone === 'bad' ? T.state.declined : T.state.ended;
  return (
    <View style={[st.box, { backgroundColor: colors.bg }]} testID={testID}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        {spinner ? <ActivityIndicator size="small" color={colors.fg} style={{ marginRight: 8 }} /> : null}
        {title ? <Text style={[st.boxTitle, { color: colors.fg }]}>{title}</Text> : null}
      </View>
      {body ? <Text style={[st.boxBody, { color: colors.fg }]}>{body}</Text> : null}
    </View>
  );
}

function SmallButton({ label, onPress, busy, testID }) {
  return (
    <TouchableOpacity style={st.btn} onPress={onPress} disabled={busy} testID={testID} accessibilityRole="button">
      {busy ? <ActivityIndicator size="small" color={T.ink} /> : <Text style={st.btnText}>{label}</Text>}
    </TouchableOpacity>
  );
}

function Header({ platform, handle, verified, subtitle, chevron, onPress }) {
  const ig = platform === 'instagram';
  return (
    <TouchableOpacity style={st.head} onPress={onPress} disabled={!onPress} activeOpacity={0.7} accessibilityRole={onPress ? 'button' : undefined}>
      <View style={[st.pic, ig ? st.picIg : st.picYt]}><Text style={[st.picText, { color: ig ? '#B0306A' : '#C42B2B' }]}>{ig ? 'IG' : '▶'}</Text></View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={st.handle} numberOfLines={1}>{handle}{verified ? '  ✓' : ''}</Text>
        {subtitle ? <Text style={st.sub} numberOfLines={1}>{subtitle}</Text> : null}
      </View>
      {chevron ? <Text style={st.chev}>›</Text> : null}
    </TouchableOpacity>
  );
}

const igNum = (d) => ({ engagement: fmtPct(d.engagement), reelViews: fmtCompact(d.avgReelViews), posts: d.posts90d == null ? '—' : String(d.posts90d) });
const ytNum = (d) => ({ long: fmtCompact(d.avgLongViews), shorts: fmtCompact(d.avgShortsViews), uploads: d.uploads90d == null ? '—' : String(d.uploads90d) });

export default function PlatformCard({ platform, data, mode = 'brand', onPress, onFix, onAdd, onCheckAgain, checkBusy }) {
  const label = PLATFORM_LABEL[platform];
  const ig = platform === 'instagram';
  const testID = `platform-card-${platform}`;

  // Not added: brands get no card at all (the caller skips it); the creator gets Add.
  if (!data) {
    if (mode === 'brand') return null;
    return (
      <View style={st.card} testID={testID}>
        <Header platform={platform} handle={label} subtitle={C3B.r5.notAdded} />
        <SmallButton label={C3B.r5.add(label)} onPress={onAdd} testID={`add-${platform}`} />
      </View>
    );
  }
  const handleText = ig ? `@${data.handle}` : `@${data.handle}`;
  const state = data.state;

  if (mode === 'brand') {
    if (state === 'updating') {
      return (
        <View style={st.card} testID={testID}>
          <Header platform={platform} handle={handleText} subtitle={ig ? C3B.s1.igSub(data.accountTypeLabel) : C3B.s1.ytSub} />
          <StateBox tone="wait" spinner title={C3B.s1.updating[0]} body={C3B.s1.updating[1]} testID={`${testID}-updating`} />
        </View>
      );
    }
    if (state === 'unavailable') {
      return (
        <View style={st.card} testID={testID}>
          <Header platform={platform} handle={label} subtitle={C3B.s1.unavailableSub} />
          <StateBox tone="grey" body={C3B.s1.unavailableBox} testID={`${testID}-unavailable`} />
        </View>
      );
    }
    const n = ig ? igNum(data) : ytNum(data);
    const tiles = ig ? [[n.engagement, C3B.s1.igTiles[0]], [n.reelViews, C3B.s1.igTiles[1]], [n.posts, C3B.s1.igTiles[2]]]
      : [[n.long, C3B.s1.ytTiles[0]], [n.shorts, C3B.s1.ytTiles[1]], [n.uploads, C3B.s1.ytTiles[2]]];
    return (
      <View style={st.card} testID={testID}>
        <Header platform={platform} handle={handleText} verified={data.verified} subtitle={ig ? C3B.s1.igSub(data.accountTypeLabel) : C3B.s1.ytSub} chevron onPress={onPress} />
        <View style={st.grid}>{tiles.map(([v, l]) => <MetricTile key={l} value={v} label={l} />)}</View>
        {ig && data.posts90d === 0 ? <Text style={st.line} testID={`${testID}-noposts`}>{C3B.s1.noPosts(fmtCompact(data.followers))}</Text> : null}
        {state === 'stale' ? <Text style={st.line} testID={`${testID}-stale`}>{C3B.s1.stale(fmtDate(data.updatedAt))}</Text> : null}
      </View>
    );
  }

  // Creator mode — the internal state, each with its one action.
  const handleForCopy = data.handle;
  if (state === 'waiting_approval') return <View style={st.card} testID={testID}><Header platform={platform} handle={handleText} subtitle={label} /><StateBox tone="grey" title={C3B.r5.waitingApproval[0]} body={C3B.r5.waitingApproval[1]} testID={`${testID}-waiting-approval`} /></View>;
  if (state === 'waiting_check') return <View style={st.card} testID={testID}><Header platform={platform} handle={handleText} subtitle={label} /><StateBox tone="wait" spinner title={C3B.r5.waitingCheck[0]} body={C3B.r5.waitingCheck[1]} testID={`${testID}-waiting-check`} /></View>;
  if (state === 'measuring') return <View style={st.card} testID={testID}><Header platform={platform} handle={handleText} subtitle={label} /><StateBox tone="wait" spinner title={C3B.r5.measuring(label)[0]} body={C3B.r5.measuring(label)[1]} testID={`${testID}-measuring`} /></View>;
  if (state === 'not_found') {
    const [t, b] = C3B.r5.notFound(handleForCopy, label);
    return <View style={st.card} testID={testID}><Header platform={platform} handle={handleText} subtitle={label} /><StateBox tone="bad" title={t} body={b} testID={`${testID}-not-found`} /><SmallButton label={C3B.r5.fixUsername} onPress={onFix} testID={`fix-${platform}`} /></View>;
  }
  if (state === 'rejected') {
    const [t, b] = C3B.r5.rejected(handleForCopy);
    return <View style={st.card} testID={testID}><Header platform={platform} handle={handleText} subtitle={label} /><StateBox tone="bad" title={t} body={b} testID={`${testID}-rejected`} /><SmallButton label={C3B.r5.fixUsername} onPress={onFix} testID={`fix-${platform}`} /></View>;
  }
  if (state === 'private') {
    const [t, b] = C3B.r5.private(label);
    const blocked = !!data.checkAgainAvailableAt;
    return (
      <View style={st.card} testID={testID}>
        <Header platform={platform} handle={handleText} subtitle={label} />
        <StateBox tone="bad" title={t} body={b} testID={`${testID}-private`} />
        <SmallButton label={C3B.r5.checkAgainPublic} onPress={blocked ? undefined : onCheckAgain} busy={checkBusy} testID={`check-again-${platform}`} />
        <Text style={st.hint}>{C3B.r5.onceADay}</Text>
      </View>
    );
  }
  // ok / failing: numbers + the measured dates line.
  const tiles = ig
    ? [[fmtCompact(data.followers), C3B.r4.igTiles[0]], [fmtPct(data.engagement), C3B.r4.igTiles[1]], [data.posts90d == null ? '—' : String(data.posts90d), C3B.r4.igTiles[2]]]
    : [[fmtCompact(data.subscribers), C3B.r4.ytTiles[0]], [fmtCompact(data.avgLongViews), C3B.r4.ytTiles[1]], [fmtCompact(data.avgShortsViews), C3B.r4.ytTiles[2]]];
  const line = ig ? C3B.r4.igLine(fmtDate(data.lastProfileAt), fmtDate(data.lastPostsAt), fmtDate(data.postsDueAt)) : C3B.r4.ytLine(fmtDate(data.lastProfileAt), fmtDate(data.lastPostsAt), fmtDate(data.postsDueAt));
  return (
    <View style={st.card} testID={testID}>
      <Header platform={platform} handle={handleText} verified={data.verified} subtitle={label} chevron onPress={onPress} />
      <View style={st.grid}>{tiles.map(([v, l]) => <MetricTile key={l} value={v} label={l} />)}</View>
      <Text style={st.line} testID={`${testID}-dates`}>{line}</Text>
      {state === 'failing' ? (
        <View>
          <Text style={st.line} testID={`${testID}-failing`}>{C3B.r5.failing}</Text>
          <SmallButton label={C3B.r5.checkAgain} onPress={data.checkAgainAvailableAt ? undefined : onCheckAgain} busy={checkBusy} testID={`check-again-${platform}`} />
          <Text style={st.hint}>{C3B.r5.onceADay}</Text>
        </View>
      ) : null}
    </View>
  );
}

export const st = StyleSheet.create({
  card: { borderWidth: 1, borderColor: T.border, borderRadius: 14, padding: 12, marginBottom: 12, backgroundColor: T.bg },
  head: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  pic: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  picIg: { backgroundColor: '#FDE7F0' }, picYt: { backgroundColor: '#FDE8E8' },
  picText: { fontFamily: fonts.sansBold, fontSize: 12 },
  handle: { fontFamily: fonts.sansBold, fontSize: 13.5, color: T.ink },
  sub: { fontFamily: fonts.sansRegular, fontSize: 11.5, color: T.ink2, marginTop: 1 },
  chev: { fontFamily: fonts.sansBold, fontSize: 18, color: T.ink3, marginLeft: 6 },
  grid: { flexDirection: 'row' },
  tile: { flex: 1, backgroundColor: T.surface, borderRadius: 10, paddingHorizontal: 9, paddingVertical: 8, marginRight: 6, minWidth: 0 },
  tileHero: { backgroundColor: T.state.active.bg },
  tileV: { fontFamily: fonts.sansBold, fontSize: 15, color: T.ink },
  tileVHero: { fontSize: 20, color: T.state.active.fg },
  tileVNone: { color: T.ink3 },
  tileL: { fontFamily: fonts.sansRegular, fontSize: 10.5, color: T.ink2, marginTop: 1, lineHeight: 13 },
  line: { fontFamily: fonts.sansRegular, fontSize: 11.5, color: T.ink2, marginTop: 8 },
  hint: { fontFamily: fonts.sansRegular, fontSize: 11, color: T.ink3, marginTop: 6 },
  box: { borderRadius: 12, paddingHorizontal: 11, paddingVertical: 10 },
  boxTitle: { fontFamily: fonts.sansBold, fontSize: 12.5 },
  boxBody: { fontFamily: fonts.sansRegular, fontSize: 12, marginTop: 2, lineHeight: 17 },
  btn: { alignSelf: 'flex-start', borderWidth: 1.5, borderColor: T.ink, borderRadius: 9, paddingHorizontal: 10, paddingVertical: 7, marginTop: 10, minWidth: 90, alignItems: 'center' },
  btnText: { fontFamily: fonts.sansBold, fontSize: 12.5, color: T.ink },
});
