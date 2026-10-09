/**
 * Item 19 — Home, for an approved brand (BH1, BH4, BH5) and an approved creator (CH1, CH4, CH5).
 *
 * Four sections, always in this order (H1): Needs you · Waiting on others · Money · Campaigns
 * (brand) or Running now (creator). Each shows at most three things; its heading opens the rest
 * (H2). The lists are worked out by the server (GET …/home): this screen draws them and opens the
 * screen each row names — it decides nothing about whose move a row is.
 *
 * One read on every focus, so a row acted on is gone when the person comes back. A read that
 * fails after the first leaves what is on screen where it is. The same read feeds the count on
 * the Home tab (services/homeCount).
 *
 * Rendered by components/shell/PendingHomeScreen once the account is approved; an account still
 * under review never reaches this screen.
 * Contract: features/item19-home · board item19-home-v3 · rules v1.32 §24
 */
import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { brandApi, influencerApi } from '../../services/api';
import { setHomeCount } from '../../services/homeCount';
import { PrimaryButton, SecondaryButton } from '../../components/settings/primitives';
import { Skeleton, LoadError } from '../../components/settings/feedback';
import useTopInset, { TOP_GAP_TITLE } from '../../hooks/useTopInset';
import { H19 } from '../../components/home/copy19';
import {
  HomeHead, Section19, NeedCard19, WaitRows19, MoneyLines19, CampaignRows19, RunRows19, StoreLink19, Calm19, OpenRow19, s,
} from '../../components/home/bits19';
import { openRow, jumpFromHome, targetFor } from '../../components/home/open19';

/** The screens of the Home tab's own stack, per app. */
export const HOME_ROUTES = {
  brand: { needs: 'BrandNeedsYou', waiting: 'BrandWaiting', notifications: 'BrandNotifications' },
  creator: { needs: 'CreatorNeedsYou', waiting: 'CreatorWaiting' },
};

/** Where a money line opens: its own list in the Wallet tab (the heading opens the tab). */
const MONEY_SCREEN = {
  brand: { locked: 'BrandWalletLocked', sales: 'BrandWalletSales' },
  creator: { payments: 'CreatorWalletPayments', commission: 'CreatorWalletCommission' },
};

export default function HomeScreen({ navigation, side = 'brand' }) {
  const creator = side === 'creator';
  const api = creator ? influencerApi : brandApi;
  const R = HOME_ROUTES[side];
  const [status, setStatus] = useState('loading');
  const [d, setD] = useState(null);
  const top = useTopInset(TOP_GAP_TITLE);

  const load = useCallback(async () => {
    const r = await api.getHome();
    if (!r || !r.success || !r.data || !r.data.needs) { setStatus((st) => (st === 'ready' ? 'ready' : 'error')); return; }
    setD(r.data);
    setStatus('ready');
    setHomeCount({ needs: r.data.needs.total, unread: r.data.unread });
  }, [api]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const bell = creator
    // Her notices live in the Collabs tab's stack, where they always were.
    ? () => jumpFromHome(navigation, { tab: 'CollabsTab', screen: 'CreatorNotifications', params: {} })
    : () => navigation.navigate(R.notifications);

  if (status !== 'ready') {
    return (
      <View style={s.screen} testID={`home-${side}-${status}`}>
        <View style={{ paddingHorizontal: 18 }}><HomeHead title={H19.hi('')} top={top} /></View>
        {status === 'loading' ? <Skeleton rows={5} /> : <LoadError onRetry={() => { setStatus('loading'); load(); }} />}
      </View>
    );
  }

  const title = creator ? H19.hi(d.me && d.me.name) : ((d.me && d.me.name) || 'Home');
  const open = (row) => openRow(navigation, side, row);
  const head = <HomeHead title={title} unread={d.unread} onBell={bell} top={top} />;

  if (d.firstDay) return creator ? <CreatorFirstDay head={head} d={d} navigation={navigation} /> : <BrandFirstDay head={head} navigation={navigation} />;

  const money = (l) => {
    const screen = MONEY_SCREEN[side][l.key];
    jumpFromHome(navigation, screen ? { tab: 'WalletTab', screen, params: {} } : { tab: 'WalletTab' });
  };
  const run = d.running || { rows: [], total: 0 };
  const seeRunning = () => jumpFromHome(navigation, creator
    ? { tab: 'CollabsTab', root: 'Collabs', params: { segment: 'Active' } }
    : { tab: 'CampaignsTab', root: 'BrandCampaigns', params: { segment: 'Live' } });

  return (
    <View style={s.screen} testID={`home-${side}`}>
      <ScrollView contentContainerStyle={s.body}>
        {head}

        {/* 1 · Needs you */}
        <Section19 testID="section-needs" title={H19.needs} count={d.needs.total || null} urgent
          link={d.needs.total ? H19.seeAll : null} onPress={d.needs.total ? () => navigation.navigate(R.needs) : null} />
        {d.needs.total
          ? d.needs.rows.map((row, i) => <NeedCard19 key={row.id} row={row} side={side} onPress={() => open(row)} testID={`need-${i}`} />)
          : <Calm19 text={H19.nothingNeeds} testID="needs-none" />}

        {/* 2 · Waiting on others */}
        <Section19 testID="section-waiting" title={H19.waiting} count={d.waiting.total || null}
          link={d.waiting.total ? H19.seeAll : null} onPress={d.waiting.total ? () => navigation.navigate(R.waiting) : null} />
        {d.waiting.total
          ? <WaitRows19 rows={d.waiting.rows} onPress={open} />
          : <Calm19 text={H19.nothingWaiting} tone="plain" testID="waiting-none" />}

        {/* 3 · Money */}
        <Section19 testID="section-money" title={H19.money} link={H19.wallet} onPress={() => jumpFromHome(navigation, { tab: 'WalletTab' })} />
        <MoneyLines19 lines={d.money.lines} open={money} />

        {/* 4 · Campaigns / Running now */}
        <Section19 testID="section-running" title={creator ? H19.running : H19.campaigns}
          count={creator ? (run.total || null) : (run.total ? H19.liveCount(run.total) : null)} link={H19.seeAll} onPress={seeRunning} />
        {run.total === 0
          ? <Calm19 text={creator ? H19.nothingRunning : H19.noCampaignLive} tone="plain" testID="running-none" />
          : creator
            ? <RunRows19 rows={run.rows} onPress={(r) => jumpFromHome(navigation, targetFor('creator', r.open))} />
            : <CampaignRows19 rows={run.rows} onPress={(c) => jumpFromHome(navigation, { tab: 'CampaignsTab', screen: 'BrandCampaignDetail', params: { campaignId: c.id } })} />}

        {creator ? <StoreLink19 link={d.storeLink} /> : null}
      </ScrollView>
    </View>
  );
}

/** BH5 — approved, with no campaign yet. The only state in which Home has a main button. */
function BrandFirstDay({ head, navigation }) {
  const F = H19.brandFirst;
  return (
    <View style={s.screen} testID="home-brand-first-day">
      <ScrollView contentContainerStyle={s.body}>
        {head}
        <View style={s.note}><Text style={s.noteText}><Text style={s.noteBold}>{F.approved}</Text>{` ${F.lead}`}</Text></View>
        {F.steps.map(([t, sub], i) => (
          <View key={t} style={s.step}>
            <View style={s.stepN}><Text style={s.stepNText}>{i + 1}</Text></View>
            <View style={{ flex: 1, marginLeft: 10 }}><Text style={s.stepTitle}>{t}</Text><Text style={s.stepSub}>{sub}</Text></View>
          </View>
        ))}
        <View style={{ height: 14 }} />
        <PrimaryButton label={F.create} icon="plus" testID="first-create"
          onPress={() => jumpFromHome(navigation, { tab: 'CampaignsTab', screen: 'BrandCampaignNew', params: {} })} />
        <SecondaryButton label={F.find} testID="first-find" onPress={() => navigation.navigate('CreatorsTab')} />
      </ScrollView>
    </View>
  );
}

/** CH5 — approved, with no invitation yet. */
function CreatorFirstDay({ head, d, navigation }) {
  const F = H19.creatorFirst;
  const setup = d.setup || {};
  return (
    <View style={s.screen} testID="home-creator-first-day">
      <ScrollView contentContainerStyle={s.body}>
        {head}
        <View style={s.note}><Text style={s.noteText}><Text style={s.noteBold}>{F.approved}</Text>{` ${F.lead}`}</Text></View>
        <View style={{ height: 14 }} />
        <PrimaryButton label={F.find} icon="magnify" testID="first-find"
          onPress={() => jumpFromHome(navigation, { tab: 'CollabsTab', screen: 'FindBrands', params: {} })} />
        <OpenRow19 icon="tune-variant" title={F.settings} sub={F.settingsSub(setup.invitations)} testID="first-settings"
          onPress={() => jumpFromHome(navigation, { tab: 'ProfileTab', screen: 'InvitationSettings', params: {} })} />
        <OpenRow19 icon="instagram" title={F.numbers} sub={F.numbersSub(setup.numbers)} testID="first-numbers"
          onPress={() => jumpFromHome(navigation, { tab: 'ProfileTab', screen: 'YourNumbers', params: {} })} />
        <StoreLink19 link={d.storeLink} />
      </ScrollView>
    </View>
  );
}
