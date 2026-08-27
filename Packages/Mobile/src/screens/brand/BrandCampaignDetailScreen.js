import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  RefreshControl, ActivityIndicator, Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { fmtRupees } from '../../theme/tokens';
import { ig } from '../../theme/ig';
import { brandApi } from '../../services/api';
import { openWebDashboard } from '../../utils/openWebDashboard';
import { campaignPrimeAction } from '../../utils/campaignPrime';
import { PrimeBar } from '../../components/brand/CampaignPrimeBar';

// ── locked palette (inline) ──
const P = {
  bg:'#FAFAFA', surface:'#FFFFFF', surface2:'#F4F4F5', bg2:'#F4F4F5',
  ink:'#0A0A0A', ink2:'#1F1F22',
  muted:'#52525B', muted2:'#71717A', muted3:'#A1A1AA',
  border:'#E4E4E7', border2:'#D4D4D8',
  warn:'#EA580C', warnPale:'#FFF7ED', warnText:'#C2410C',
  success:'#10B981', successPale:'#D1FAE5', successDeep:'#047857',
  danger:'#E8401A', dangerPale:'#FDEEE9', dangerDeep:'#B91C1C',
  white:'#FFFFFF',
};

const STATUS_BADGE = {
  draft:          { bg: P.surface2,   text: P.muted,        dot: P.muted2,     label: 'Draft' },
  pending_wallet: { bg: P.warnPale, text: P.warnText,   dot: P.warn, label: 'Needs funding' },
  published:      { bg: P.warnPale, text: P.warnText,   dot: P.warn, label: 'Published' },
  active:         { bg: P.successPale,text: P.successDeep,  dot: P.success,    label: 'Active' },
  live:           { bg: P.successPale,text: P.successDeep,  dot: P.success,    label: 'Live' },
  completed:      { bg: P.surface2,   text: P.ink2,         dot: P.muted2,     label: 'Completed' },
  cancelled:      { bg: P.dangerPale, text: P.dangerDeep,   dot: P.danger,     label: 'Cancelled' },
};

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * Hub view — replaces the 1281-LOC flat scroll. Shows summary KPI +
 * urgent action queue + 6 drill-down tiles + brief + web link. Detail
 * sections (sets / influencers / reviews / live confirms) live in
 * dedicated drill-down screens (see BrandCampaignInfluencersListScreen,
 * BrandCampaignSetsListScreen, BrandCampaignReviewQueueScreen).
 *
 * Data flow: parallel-fetches the same 5 endpoints as before
 * (campaign, escrow, engagement, conversions, products). All hub tiles
 * derive from this data — no new API needed. Tile-tap navigates to a
 * dedicated screen which re-fetches independently.
 */
export default function BrandCampaignDetailScreen({ navigation, route }) {
  const { campaignId } = route.params || {};
  const [campaign, setCampaign]     = useState(null);
  const [escrow, setEscrow]         = useState(null);
  const [engagement, setEngagement] = useState(null);
  const [conversions, setConversions] = useState(null);
  const [productsData, setProductsData] = useState(null);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [briefOpen, setBriefOpen]   = useState(false);
  const [error, setError]           = useState(null);
  const [publishing, setPublishing] = useState(false);
  const [ending, setEnding]         = useState(false);

  // collab-part5 — the deliberate finish, on the phone too (only campaign creation and
  // listing are web-only). Completing takes every participating creator's products out of
  // the follower app, so the consequence is spelled out before confirming; the server
  // refuses while a creator is owed money or has work awaiting review, and its message
  // names which.
  function confirmEnd() {
    Alert.alert(
      'End this campaign?',
      "Creators' products will leave the shopping app and their share links will stop earning. They are notified. Commission already earned is unaffected, and this is recorded as Completed — not cancelled.",
      [
        { text: 'Keep it running', style: 'cancel' },
        {
          text: 'End campaign',
          style: 'destructive',
          onPress: async () => {
            setEnding(true);
            const res = await brandApi.endCampaign(campaignId);
            setEnding(false);
            if (res.success) {
              Alert.alert('Campaign ended', `${res.data?.creators_notified ?? 0} creator(s) notified.`);
              load();
            } else {
              Alert.alert('Could not end', res.error?.message || 'Try again.');
            }
          },
        },
      ]
    );
  }

  async function load() {
    setError(null);
    const [campRes, escRes, engRes, convRes, prodRes] = await Promise.all([
      brandApi.getCampaign(campaignId),
      brandApi.getCampaignEscrow(campaignId),
      brandApi.getCampaignEngagement(campaignId).catch(() => ({ success: false })),
      brandApi.getCampaignConversions(campaignId).catch(() => ({ success: false })),
      brandApi.getCampaignAllProducts(campaignId).catch(() => ({ success: false })),
    ]);
    setLoading(false);
    if (campRes.success) setCampaign(campRes.data?.campaign);
    else setError(campRes.error?.message || 'Failed to load campaign');
    if (escRes?.success)  setEscrow(escRes.data);
    if (engRes?.success)  setEngagement(engRes.data);
    if (convRes?.success) setConversions(convRes.data);
    if (prodRes?.success) setProductsData(prodRes.data);
  }

  useFocusEffect(useCallback(() => { load(); }, [campaignId]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [campaignId]);

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={P.ink} /></View>;
  }
  if (error || !campaign) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error || 'Campaign not found'}</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.goBackBtn}>
          <Text style={styles.goBackBtnText}>← Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Derived rollups (all from backend data) ──
  const sets = campaign.sets || [];
  const allInfluencers = sets.flatMap(s => (s.influencers || []).map(ci => ({ ...ci, set_name: s.name, set_goal: s.goal, set_mode: s.influencer_mode })));
  const activeInfCount = allInfluencers.filter(ci => ['active', 'live'].includes(ci.status)).length;
  const negotiatingCount = allInfluencers.filter(ci => ci.status === 'negotiating').length;
  const totalInfCount = allInfluencers.length;
  const openCallSetsCount = sets.filter(s => s.influencer_mode === 'open_group').length;

  // Deliverable rollups
  let totalDeliv = 0, doneDeliv = 0, reviewsCount = 0, liveConfirmCount = 0;
  for (const ci of allInfluencers) {
    const dc = ci.deliverable_counts || {};
    totalDeliv += (dc.total || 0);
    doneDeliv += (dc.live || 0) + (dc.approved || 0);
    for (const d of (ci.deliverables || [])) {
      if (d.status === 'submitted' || d.status === 'under_review') reviewsCount++;
      if (d.status === 'approved' && d.live_url) liveConfirmCount++;
    }
  }
  const progressPct = totalDeliv > 0 ? Math.round((doneDeliv / totalDeliv) * 100) : 0;

  // Applications waiting (open-group only, status='applied')
  const applicationsCount = sets
    .filter(s => s.influencer_mode === 'open_group')
    .flatMap(s => s.influencers || [])
    .filter(ci => ci.status === 'applied').length;

  // Budget
  const totalBudget = Number(campaign.total_budget) || 0;
  const allocatedBudget = allInfluencers.reduce((sum, ci) => sum + (Number(ci.agreed_fee) || 0), 0);
  const budgetPct = totalBudget > 0 ? Math.round((allocatedBudget / totalBudget) * 100) : 0;

  // Goal awareness
  const setGoals = sets.map(s => (s.goal || '').toLowerCase()).filter(Boolean);
  const hasFeeBearing = setGoals.some(g => g === 'engagement' || g === 'hybrid');
  const hasConversion = setGoals.some(g => g === 'conversion' || g === 'hybrid');

  // Engagement
  const engagementTotals = engagement?.totals || {};
  const totalLikes = engagementTotals.total_likes;
  const avgER = engagementTotals.avg_er;

  // Escrow rollup
  const escrowEntries = escrow?.entries || escrow?.escrow_entries || [];
  const escrowLocked   = escrowEntries.filter(e => e.status === 'locked').reduce((s, e) => s + Number(e.amount || 0), 0);
  const escrowReleased = escrowEntries.filter(e => e.status === 'released').reduce((s, e) => s + Number(e.amount || 0), 0);
  const t2LockedAmount = escrowEntries.filter(e => e.tranche_number === 2 && e.status === 'locked').reduce((s, e) => s + Number(e.amount || 0), 0);

  // Conversions
  const convSummary = conversions?.summary || {};
  const convCount   = conversions?.total_transactions ?? convSummary.total_transactions ?? 0;
  const convRevenue = conversions?.total_revenue      ?? convSummary.total_revenue      ?? 0;

  // Status badge for header
  const statusCfg = STATUS_BADGE[campaign.status] || STATUS_BADGE.draft;

  // Action queue items (only built when count > 0)
  const actionItems = [];
  if (applicationsCount > 0) {
    actionItems.push({
      key: 'apps',
      tone: 'pending',
      icon: '!',
      title: `${applicationsCount} application${applicationsCount !== 1 ? 's' : ''} waiting`,
      meta: 'Open-call applicants to approve / reject',
      count: applicationsCount,
      onPress: () => navigation.navigate('BrandCampaignInfluencersList', { campaignId, statusFilter: 'applied' }),
    });
  }
  if (reviewsCount > 0) {
    actionItems.push({
      key: 'reviews',
      tone: 'pending',
      icon: '⌕',
      title: `${reviewsCount} deliverable${reviewsCount !== 1 ? 's' : ''} to review`,
      meta: 'Approve or request revision',
      count: reviewsCount,
      onPress: () => navigation.navigate('BrandCampaignReviewQueue', { campaignId, initialTab: 'reviews' }),
    });
  }
  if (liveConfirmCount > 0) {
    actionItems.push({
      key: 'live',
      tone: 'danger',
      icon: '▶',
      title: `${liveConfirmCount} live URL${liveConfirmCount !== 1 ? 's' : ''} to confirm`,
      meta: t2LockedAmount > 0 ? `Releases up to ${fmtRupees(t2LockedAmount)} Tranche-2` : 'Releases Tranche-2 once all confirmed',
      count: liveConfirmCount,
      onPress: () => navigation.navigate('BrandCampaignReviewQueue', { campaignId, initialTab: 'live' }),
    });
  }

  // ── Command-center stage + primary action (A6) ──
  const stageInfo = campaignPrimeAction(campaign.status, {
    applicationsCount, reviewsCount, liveConfirmCount, negotiatingCount,
  });

  // Fund & Publish — the action mobile never had (funding/publishing an already
  // created campaign is post-creation, so it belongs here; creation stays on web).
  async function handlePublish() {
    setPublishing(true);
    const res = await brandApi.publishCampaign(campaignId);
    setPublishing(false);
    if (res.success) {
      Alert.alert('Campaign published', 'Your campaign is live and creators can be invited.');
      load();
    } else if (res.error?.code === 'WALLET_INSUFFICIENT') {
      Alert.alert(
        'Wallet needs funding',
        res.error?.message || 'Add the full campaign budget to your wallet, then publish.',
        [{ text: 'Later', style: 'cancel' }, { text: 'Open wallet', onPress: () => navigation.navigate('Wallet') }],
      );
    } else {
      Alert.alert('Could not publish', res.error?.message || 'Please try again.');
    }
  }

  function onPrimePress() {
    switch (stageInfo.prime.kind) {
      case 'publish':      return handlePublish();
      case 'applications': return navigation.navigate('BrandCampaignInfluencersList', { campaignId, statusFilter: 'applied' });
      case 'negotiations': return navigation.navigate('BrandCampaignInfluencersList', { campaignId, statusFilter: 'negotiating' });
      case 'reviews':      return navigation.navigate('BrandCampaignReviewQueue', { campaignId, initialTab: 'reviews' });
      case 'live':         return navigation.navigate('BrandCampaignReviewQueue', { campaignId, initialTab: 'live' });
      case 'payout':       return navigation.navigate('Wallet');
      default:             return undefined;
    }
  }

  const primeSubtitle =
    stageInfo.prime.kind === 'publish' && totalBudget > 0 ? `${fmtRupees(totalBudget)} budget needed to go live`
      : stageInfo.prime.kind === 'live' && t2LockedAmount > 0 ? `Releases up to ${fmtRupees(t2LockedAmount)} Tranche-2`
        : null;

  return (
    <View style={styles.container}>
      {/* ── Ink header ── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← Back</Text>
        </TouchableOpacity>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle} numberOfLines={2}>{campaign.name}</Text>
            {/* collab-part5 — a sales campaign has no end date by design, so it reads
                "Ongoing" rather than an em-dash that looks like missing data. */}
            <Text style={styles.headerDates}>
              {formatDate(campaign.start_date)} → {campaign.end_date ? formatDate(campaign.end_date) : 'Ongoing'}
            </Text>
            <Text style={styles.headerMeta}>
              <Text style={styles.headerMetaV}>{sets.length}</Text> set{sets.length !== 1 ? 's' : ''}
              {'  ·  '}
              <Text style={styles.headerMetaV}>{totalInfCount}</Text> influencer{totalInfCount !== 1 ? 's' : ''}
              {totalDeliv > 0 && <>
                {'  ·  '}
                <Text style={styles.headerMetaV}>{totalDeliv}</Text> deliverable{totalDeliv !== 1 ? 's' : ''}
              </>}
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusCfg.bg }]}>
            <View style={[styles.statusDot, { backgroundColor: statusCfg.dot }]} />
            <Text style={[styles.statusText, { color: statusCfg.text }]}>{statusCfg.label}</Text>
          </View>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={P.ink} />}
      >

        {/* ── One primary action. ──────────────────────────────────────────
            The six-stage rail that used to sit above this is gone. Founder,
            2026-08-27, having spotted it in a screenshot: it showed
            Fund · Roster · Contracts · Production · Review · Payout, which is a
            DIFFERENT six from the one Stage 3 agreed — Agree · Sign · Shoot ·
            Shop posts · Go live · Complete — with half the words colliding, and
            measuring the campaign rather than one collaboration.
            Contract: features/retire-old-campaign-stage-rail */}
        <PrimeBar prime={stageInfo.prime} onPress={onPrimePress} busy={publishing} subtitle={primeSubtitle} />

        {['published', 'active', 'live'].includes(campaign.status) && (
          <TouchableOpacity style={styles.endBtn} onPress={confirmEnd} disabled={ending}>
            <Text style={styles.endBtnTxt}>{ending ? 'ENDING…' : 'END CAMPAIGN'}</Text>
          </TouchableOpacity>
        )}

        {/* ── Summary card ── */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryTop}>
            <View>
              <Text style={styles.summaryLabel}>Campaign progress</Text>
              <Text style={styles.summaryPct}>{progressPct}<Text style={styles.summaryPctMute}>%</Text></Text>
            </View>
            {totalDeliv > 0 ? (
              <Text style={styles.summaryFraction}>{doneDeliv} of {totalDeliv} deliverables{'\n'}complete</Text>
            ) : (
              <Text style={styles.summaryFraction}>No deliverables yet</Text>
            )}
          </View>
          <View style={styles.summaryProgressBg}>
            <View style={[styles.summaryProgressFill, { width: `${progressPct}%` }]} />
          </View>
          <View style={styles.summaryStats}>
            <View style={styles.summaryStat}>
              <Text style={styles.summaryStatLabel}>Budget</Text>
              <Text style={styles.summaryStatV}>{totalBudget > 0 ? `${budgetPct}%` : '—'}</Text>
              <Text style={styles.summaryStatSub}>{totalBudget > 0 ? `${fmtRupees(allocatedBudget)} / ${fmtRupees(totalBudget)}` : 'No budget set'}</Text>
            </View>
            <View style={[styles.summaryStat, styles.summaryStatDivided]}>
              <Text style={styles.summaryStatLabel}>Active</Text>
              <Text style={styles.summaryStatV}>{activeInfCount} / {totalInfCount}</Text>
              <Text style={styles.summaryStatSub}>influencers</Text>
            </View>
            <View style={[styles.summaryStat, styles.summaryStatDivided]}>
              <Text style={styles.summaryStatLabel}>Reach</Text>
              <Text style={styles.summaryStatV}>
                {totalLikes != null ? Number(totalLikes).toLocaleString('en-IN') : '—'}
              </Text>
              <Text style={styles.summaryStatSub}>
                {avgER != null ? `${Number(avgER).toFixed(1)}% ER` : 'likes'}
              </Text>
            </View>
          </View>
        </View>

        {/* ── Action queue (conditional) ── */}
        {actionItems.length > 0 && (
          <>
            <View style={styles.sectionHeadInline}>
              <View style={styles.sectionPill} />
              <Text style={styles.sectionHead}>Needs your attention</Text>
              <Text style={styles.sectionHeadCount}>{actionItems.length}</Text>
            </View>
            {actionItems.map(a => (
              <TouchableOpacity
                key={a.key}
                style={[styles.actionRow, a.tone === 'danger' ? styles.actionRowDanger : styles.actionRowPending]}
                activeOpacity={0.85}
                onPress={a.onPress}
              >
                <View style={[styles.actionIcon, a.tone === 'danger' ? styles.actionIconDanger : styles.actionIconPending]}>
                  <Text style={[styles.actionIconGlyph, a.tone === 'danger' ? { color: P.danger } : { color: P.ink }]}>{a.icon}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.actionTitle}>{a.title}</Text>
                  <Text style={styles.actionMeta}>{a.meta}</Text>
                </View>
                <View style={[styles.actionCountPill, a.tone === 'danger' ? styles.actionCountPillDanger : styles.actionCountPillPending]}>
                  <Text style={[styles.actionCountText, a.tone === 'danger' && { color: P.white }]}>{a.count}</Text>
                </View>
                <Text style={styles.actionArrow}>›</Text>
              </TouchableOpacity>
            ))}
          </>
        )}

        {/* ── Section grid (6 drill-down tiles) ── */}
        <View style={styles.sectionHeadInline}>
          <View style={styles.sectionPill} />
          <Text style={styles.sectionHead}>Explore</Text>
        </View>
        <View style={styles.tileGrid}>

          {/* Sets */}
          <TouchableOpacity
            style={styles.tile}
            activeOpacity={0.85}
            onPress={() => navigation.navigate('BrandCampaignSetsList', { campaignId })}
          >
            <View style={styles.tileHead}>
              <View style={styles.tileIcon}><Icon name="view-grid-outline" size={17} color={ig.text} /></View>
              <Text style={styles.tileArrow}>›</Text>
            </View>
            <Text style={styles.tileLabel}>Sets</Text>
            <Text style={styles.tileValue}>{sets.length}</Text>
            <Text style={styles.tileSub}>
              {openCallSetsCount > 0
                ? <><Text style={styles.tileSubV}>{openCallSetsCount}</Text> open call{openCallSetsCount !== 1 ? 's' : ''}</>
                : 'handpick only'}
            </Text>
          </TouchableOpacity>

          {/* Influencers */}
          <TouchableOpacity
            style={styles.tile}
            activeOpacity={0.85}
            onPress={() => navigation.navigate('BrandCampaignInfluencersList', { campaignId })}
          >
            <View style={styles.tileHead}>
              <View style={styles.tileIcon}><Icon name="account-multiple-outline" size={17} color={ig.text} /></View>
              <Text style={styles.tileArrow}>›</Text>
            </View>
            <Text style={styles.tileLabel}>Influencers</Text>
            <Text style={styles.tileValue}>{totalInfCount}</Text>
            <Text style={styles.tileSub}>
              <Text style={styles.tileSubV}>{activeInfCount}</Text> active
              {negotiatingCount > 0 && <> · <Text style={styles.tileSubV}>{negotiatingCount}</Text> negotiating</>}
            </Text>
          </TouchableOpacity>

          {/* Analytics (only when engagement data exists) */}
          {(totalLikes != null || avgER != null) && (
            <TouchableOpacity
              style={styles.tile}
              activeOpacity={0.85}
              onPress={() => navigation.navigate('BrandConversions', { campaignId, campaignName: campaign.name })}
            >
              <View style={styles.tileHead}>
                <View style={styles.tileIcon}><Icon name="chart-line" size={17} color={ig.text} /></View>
                <Text style={styles.tileArrow}>›</Text>
              </View>
              <Text style={styles.tileLabel}>Analytics</Text>
              <Text style={styles.tileValue}>
                {totalLikes != null
                  ? (totalLikes >= 1000 ? `${(totalLikes / 1000).toFixed(1)}K` : Number(totalLikes).toLocaleString('en-IN'))
                  : '—'}
              </Text>
              <Text style={styles.tileSub}>
                likes
                {avgER != null && <> · <Text style={styles.tileSubV}>{Number(avgER).toFixed(1)}%</Text> ER</>}
              </Text>
            </TouchableOpacity>
          )}

          {/* Escrow (only when fee-bearing sets exist) */}
          {hasFeeBearing && escrowEntries.length > 0 && (
            <TouchableOpacity
              style={styles.tile}
              activeOpacity={0.85}
              onPress={() => navigation.navigate('Wallet')}
            >
              <View style={styles.tileHead}>
                <View style={[styles.tileIcon, styles.tileIconDark]}><Icon name="currency-inr" size={17} color={P.white} /></View>
                <Text style={styles.tileArrow}>›</Text>
              </View>
              <Text style={styles.tileLabel}>Escrow</Text>
              <Text style={styles.tileValue}>{fmtRupees(escrowReleased)}</Text>
              <Text style={styles.tileSub}>released · <Text style={styles.tileSubV}>{fmtRupees(escrowLocked)}</Text> locked</Text>
            </TouchableOpacity>
          )}

          {/* Content (when any deliverables exist) */}
          {totalDeliv > 0 && (
            <TouchableOpacity
              style={styles.tile}
              activeOpacity={0.85}
              onPress={() => navigation.navigate('BrandCampaignReviewQueue', { campaignId, initialTab: 'reviews' })}
            >
              <View style={styles.tileHead}>
                <View style={styles.tileIcon}><Icon name="play-circle-outline" size={17} color={ig.text} /></View>
                <Text style={styles.tileArrow}>›</Text>
              </View>
              <Text style={styles.tileLabel}>Content</Text>
              <Text style={styles.tileValue}>{doneDeliv} / {totalDeliv}</Text>
              <Text style={styles.tileSub}>
                live
                {(reviewsCount + liveConfirmCount) > 0 && <> · <Text style={styles.tileSubV}>{reviewsCount + liveConfirmCount}</Text> in queue</>}
              </Text>
            </TouchableOpacity>
          )}

          {/* Conversions (only when conversion/hybrid) */}
          {hasConversion && (convCount > 0 || convRevenue > 0) && (
            <TouchableOpacity
              style={styles.tile}
              activeOpacity={0.85}
              onPress={() => navigation.navigate('BrandConversions', { campaignId, campaignName: campaign.name })}
            >
              <View style={styles.tileHead}>
                <View style={[styles.tileIcon, styles.tileIconDark]}><Icon name="cart-outline" size={17} color={P.white} /></View>
                <Text style={styles.tileArrow}>›</Text>
              </View>
              <Text style={styles.tileLabel}>Conversions</Text>
              <Text style={styles.tileValue}>{Number(convCount).toLocaleString('en-IN')}</Text>
              <Text style={styles.tileSub}><Text style={styles.tileSubV}>{fmtRupees(convRevenue)}</Text> revenue</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ── Brief (collapsible) ── */}
        {campaign.brief ? (
          <TouchableOpacity
            style={styles.briefCard}
            activeOpacity={0.9}
            onPress={() => setBriefOpen(o => !o)}
          >
            <View style={styles.briefHead}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                <View style={styles.sectionPill} />
                <Text style={styles.briefTitle}>Campaign brief</Text>
              </View>
              <Text style={styles.briefToggle}>{briefOpen ? '∧' : '∨'}</Text>
            </View>
            {briefOpen && <Text style={styles.briefText}>{campaign.brief}</Text>}
          </TouchableOpacity>
        ) : null}

        {/* ── Web dashboard link ── */}
        <TouchableOpacity
          style={styles.webLink}
          activeOpacity={0.85}
          onPress={() => openWebDashboard(`/dashboard/campaigns/${campaignId}`)}
        >
          <Text style={styles.webLinkIcon}>🌐</Text>
          <Text style={styles.webLinkText}>Full details on web dashboard</Text>
          <Text style={styles.webLinkArrow}>›</Text>
        </TouchableOpacity>

        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  endBtn: { backgroundColor: '#0A0A0A', borderRadius: 11, paddingVertical: 12, alignItems: 'center', marginHorizontal: 14, marginTop: 10 },
  endBtnTxt: { color: P.white, fontSize: 12.5, fontWeight: '800', letterSpacing: 0.4 },
  container: { flex: 1, backgroundColor: P.bg },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: P.bg, padding: 24 },
  errorText: { fontSize: 13, color: P.dangerDeep, marginBottom: 16, textAlign: 'center' },
  goBackBtn: { paddingHorizontal: 18, paddingVertical: 10, backgroundColor: P.surface2, borderRadius: 10 },
  goBackBtnText: { fontSize: 13, fontWeight: '700', color: P.ink },

  // Header
  header: { backgroundColor: P.white, paddingHorizontal: 16, paddingTop: 52, paddingBottom: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: P.border },
  backBtn: { paddingVertical: 4 },
  backBtnText: { fontSize: 12.5, fontWeight: '600', color: P.muted2 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginTop: 8 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: P.ink, letterSpacing: -0.3 },
  headerDates: { fontFamily: 'monospace', fontSize: 10.5, color: P.muted2, marginTop: 3 },
  headerMeta: { fontSize: 11, color: P.muted2, marginTop: 5 },
  headerMetaV: { color: P.ink, fontWeight: '600' },

  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 100 },
  statusDot: { width: 4, height: 4, borderRadius: 2 },
  statusText: { fontSize: 9.5, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3 },

  scroll: { padding: 12, gap: 10 },

  // Summary card
  summaryCard: { backgroundColor: P.bg2, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: P.border, position: 'relative', overflow: 'hidden' },
  // IG-clean: decorative corner blobs removed.
  summaryTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 10 },
  summaryLabel: { fontSize: 11, fontWeight: '700', color: P.ink, letterSpacing: 0.5, textTransform: 'uppercase' },
  summaryPct: { fontFamily: 'monospace', fontWeight: '700', fontSize: 36, color: P.ink, letterSpacing: -1, lineHeight: 36 },
  summaryPctMute: { fontSize: 22, color: P.muted2 },
  summaryFraction: { fontSize: 10.5, color: P.muted, textAlign: 'right' },
  summaryProgressBg: { height: 6, backgroundColor: 'rgba(10,10,10,0.1)', borderRadius: 100, overflow: 'hidden', marginBottom: 14 },
  summaryProgressFill: { height: '100%', backgroundColor: P.ink, borderRadius: 100 },
  summaryStats: { flexDirection: 'row', gap: 8 },
  summaryStat: { flex: 1, paddingVertical: 6 },
  summaryStatDivided: { paddingLeft: 10, borderLeftWidth: 1, borderLeftColor: 'rgba(10,10,10,0.12)' },
  summaryStatLabel: { fontSize: 9.5, fontWeight: '600', color: P.muted, letterSpacing: 0.3, textTransform: 'uppercase', marginBottom: 2 },
  summaryStatV: { fontFamily: 'monospace', fontWeight: '700', fontSize: 15, color: P.ink, letterSpacing: -0.3 },
  summaryStatSub: { fontSize: 10, color: P.muted2, marginTop: 1 },

  // Section headers (inline)
  sectionHeadInline: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 6, marginBottom: 2 },
  sectionPill: { width: 3, height: 11, backgroundColor: P.ink, borderRadius: 2 },
  sectionHead: { fontSize: 11, fontWeight: '700', color: P.ink, letterSpacing: 0.4, textTransform: 'uppercase' },
  sectionHeadCount: { marginLeft: 'auto', fontFamily: 'monospace', fontSize: 11, color: P.muted2, fontWeight: '700' },

  // Action queue
  actionRow: { backgroundColor: P.surface, borderWidth: 1, borderColor: P.border, borderRadius: 12, padding: 11, paddingLeft: 12, flexDirection: 'row', alignItems: 'center', gap: 11 },
  actionRowPending: { borderLeftWidth: 3, borderLeftColor: P.warn },
  actionRowDanger:  { borderLeftWidth: 3, borderLeftColor: P.danger },
  actionIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  actionIconPending: { backgroundColor: P.warnPale },
  actionIconDanger:  { backgroundColor: P.dangerPale },
  actionIconGlyph: { fontSize: 13, fontWeight: '800' },
  actionTitle: { fontSize: 12.5, fontWeight: '700', color: P.ink, marginBottom: 2 },
  actionMeta:  { fontSize: 10.5, color: P.muted },
  actionCountPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 100 },
  actionCountPillPending: { backgroundColor: P.warn },
  actionCountPillDanger:  { backgroundColor: P.danger },
  actionCountText: { fontSize: 11, fontWeight: '700', color: P.ink, fontFamily: 'monospace' },
  actionArrow: { fontSize: 18, color: P.muted2, fontWeight: '700' },

  // Tile grid
  tileGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: {
    width: '48.5%',
    backgroundColor: P.surface,
    borderWidth: 1, borderColor: P.border,
    borderRadius: 14,
    padding: 13,
    gap: 6,
  },
  tileHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  tileIcon: { width: 28, height: 28, borderRadius: 14, backgroundColor: P.ink, alignItems: 'center', justifyContent: 'center' },
  tileIconDark: { backgroundColor: P.ink },
  tileArrow: { fontFamily: 'monospace', fontWeight: '700', color: P.muted3, fontSize: 14 },
  tileLabel: { fontSize: 9.5, fontWeight: '700', color: P.muted2, letterSpacing: 0.4, textTransform: 'uppercase', marginTop: 4 },
  tileValue: { fontFamily: 'monospace', fontWeight: '700', fontSize: 18, color: P.ink, letterSpacing: -0.3, lineHeight: 22 },
  tileSub: { fontSize: 10.5, color: P.muted, marginTop: 1 },
  tileSubV: { color: P.ink, fontWeight: '600', fontFamily: 'monospace' },

  // Brief
  briefCard: { backgroundColor: P.surface, borderWidth: 1, borderColor: P.border, borderRadius: 12, padding: 12 },
  briefHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  briefTitle: { fontSize: 12.5, fontWeight: '700', color: P.ink },
  briefToggle: { fontFamily: 'monospace', fontWeight: '700', color: P.muted2, fontSize: 14 },
  briefText: { fontSize: 12, color: P.ink2, lineHeight: 18, marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: P.border },

  // Web link
  webLink: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, paddingHorizontal: 14, backgroundColor: P.surface, borderWidth: 1, borderColor: P.border, borderRadius: 12 },
  webLinkIcon: { fontSize: 15 },
  webLinkText: { flex: 1, fontSize: 11.5, fontWeight: '600', color: P.ink },
  webLinkArrow: { fontFamily: 'monospace', fontWeight: '700', color: P.muted2 },
});
