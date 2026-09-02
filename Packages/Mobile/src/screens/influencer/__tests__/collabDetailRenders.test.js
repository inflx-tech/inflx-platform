/**
 * ⚠️ THE COLLAB DETAIL SCREEN MUST ACTUALLY RENDER.
 *
 * Contract: features/brief-straight-to-signing
 *
 * Founder, 2026-08-28, on the deployed build:
 *   "it is landed correctly into sign tab, but when i am trying click review, again a blank
 *   screen"
 *
 * Tapping a row in To sign opens THIS screen, not the contract screen. The row's label says
 * "Review & sign", which is why it reads as "click review".
 *
 * THE BUG THIS FILE EXISTS FOR
 * useCreatorSteps() — a React hook — was called AFTER two early returns:
 *
 *     if (loading)          return <Spinner/>;      // first render stops here
 *     if (error || !data)   return <Error/>;
 *     ...
 *     const { data: stepData } = useCreatorSteps(); // second render calls it
 *
 * First render: 8 hooks. Second render: 9. React throws "Rendered more hooks than during the
 * previous render" and the screen renders NOTHING. Every time, for every creator, on every
 * collaboration — it has nothing to do with her data.
 *
 * WHY I MISSED IT EARLIER TODAY
 * I fixed this screen's blank page once already, by correcting the stage vocabulary in heroFor
 * and sectionsFor. That was a real bug and the fix was right. But I proved it by testing the
 * HELPERS, never by mounting the SCREEN — so the crash sitting underneath survived the fix and
 * the founder saw the same blank page twice.
 *
 * The file next door said this in its own closing comment, about a function deleted in Stage 3
 * for the same reason:
 *   "the strongest argument in this repo for testing what the screen actually does rather than
 *   what a helper can do when fed ideal input."
 *
 * Twice now. Hence: mount it.
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';

jest.mock('../../../services/api', () => ({
  influencerApi: {
    getMyCampaignDetail: jest.fn(),
    // The six-step ladder comes from /needs-you, shared with the brand's own screen.
    getNeedsYou: jest.fn(),
    declineOffer: jest.fn(),
    acceptOffer: jest.fn(),
  },
}));

jest.mock('@react-navigation/native', () => ({
  // The real one only fires on focus; in a test the screen is never "focused", so nothing
  // would load at all. Run the effect once, like a real navigation focus does.
  useFocusEffect: (cb) => require('react').useEffect(cb, [cb]),
}));

import CollabDetailScreen from '../CollabDetailScreen';
import { influencerApi } from '../../../services/api';

const CI = '0c7b5d40-d4f9-4b5b-af4b-e80cbe8bf157';

/**
 * Asha M. on "New test campaign 1234" from Label Fern — the row the founder tapped.
 * status 'accepted' is what briefing now writes, which deriveStage maps to 'to_sign'.
 */
const PAYLOAD = {
  campaign: {
    campaign_id: 'c1',
    campaign_name: 'New test campaign 1234',
    brand_name: 'Label Fern (practice)',
    influencer_status: 'accepted',
    goal: 'conversion',
    commission_pct: '14.00',
    influencer_fee: '0.00',
    physical_delivery: false,
  },
  deliverables: [],
  products_total: 0,
};

const nav = { navigate: jest.fn(), goBack: jest.fn() };
const route = { params: { campaignInfluencerId: CI } };

beforeEach(() => {
  jest.clearAllMocks();
  influencerApi.getMyCampaignDetail.mockResolvedValue({ success: true, data: PAYLOAD });
  influencerApi.getNeedsYou.mockResolvedValue({ success: true, data: { collaborations: [] } });
});

describe('the screen the founder tapped', () => {
  test('⚠️ it renders at all — this is the whole bug', async () => {
    render(<CollabDetailScreen navigation={nav} route={route} />);
    // The load resolves, loading flips to false, and the screen re-renders. If the hook order
    // changes between those two renders, React throws here and nothing appears.
    expect(await screen.findByText('New test campaign 1234')).toBeTruthy();
  });

  test('and it offers her the one thing she is there to do', async () => {
    render(<CollabDetailScreen navigation={nav} route={route} />);
    expect(await screen.findByText('Review & sign')).toBeTruthy();
  });

  test('a failed load shows the error state, not a blank screen', async () => {
    influencerApi.getMyCampaignDetail.mockResolvedValue({ success: false, error: { message: 'nope' } });
    render(<CollabDetailScreen navigation={nav} route={route} />);
    expect(await screen.findByText('nope')).toBeTruthy();
  });
});

describe('every stage renders, not just the one that was reported', () => {
  // The hook-order crash does not care which stage she is in — it fires on the second render of
  // any of them. Walking all six proves the fix is structural and not a patch for to_sign.
  const CASES = [
    ['invitations', 'invited'],
    ['pitches', 'applied'],
    ['to_sign', 'accepted'],
    ['shoot', 'contracted'],
    ['content', 'active'],
    ['done', 'completed'],
  ];

  test.each(CASES)('%s (status %s) renders', async (_stage, status) => {
    influencerApi.getMyCampaignDetail.mockResolvedValue({
      success: true,
      data: { ...PAYLOAD, campaign: { ...PAYLOAD.campaign, influencer_status: status } },
    });
    render(<CollabDetailScreen navigation={nav} route={route} />);
    expect(await screen.findByText('New test campaign 1234')).toBeTruthy();
  });
});

/**
 * SC-05 — "What they're offering". The four fields that reach here already resolved
 * server-side (her value else the set's), so this test proves they REACH THE SCREEN, not
 * that the resolution itself works — that is covered where the resolvers live.
 * Contract: features/stage-a-the-set
 */
describe('SC-05 · what SB-30 gave her, and the two things she cannot change', () => {
  const WITH_TERMS = {
    ...PAYLOAD,
    campaign: {
      ...PAYLOAD.campaign,
      influencer_status: 'invited',
      go_live_date: '2026-09-12',
      shoot_mode: 'visit',
      channels_summary: 'Instagram — at least 1',
      formats_json: [{ type: 'reel', count: 1 }, { type: 'story', count: 2 }],
      usage_text: 'Your content stays yours. The brand and INFLX may repost it on their own social accounts, with credit — nothing more.',
    },
  };

  test('the two things she cannot change render together, labelled as such', async () => {
    influencerApi.getMyCampaignDetail.mockResolvedValue({ success: true, data: WITH_TERMS });
    render(<CollabDetailScreen navigation={nav} route={route} />);
    expect(await screen.findByText('Two things you cannot change')).toBeTruthy();
    expect(screen.getByText('Store visit')).toBeTruthy();
  });

  test('where she posts and what she makes render as their own rows', async () => {
    influencerApi.getMyCampaignDetail.mockResolvedValue({ success: true, data: WITH_TERMS });
    render(<CollabDetailScreen navigation={nav} route={route} />);
    expect(await screen.findByText('Instagram — at least 1')).toBeTruthy();
    expect(screen.getByText('1 reel + 2 stories')).toBeTruthy();
  });

  test('the usage sentence renders even when nothing commercial was agreed', async () => {
    influencerApi.getMyCampaignDetail.mockResolvedValue({ success: true, data: WITH_TERMS });
    render(<CollabDetailScreen navigation={nav} route={route} />);
    expect(await screen.findByText(/Your content stays yours/)).toBeTruthy();
  });

  test('the single reservation button shows before she has settled in, and navigates with what it needs', async () => {
    influencerApi.getMyCampaignDetail.mockResolvedValue({ success: true, data: WITH_TERMS });
    render(<CollabDetailScreen navigation={nav} route={route} />);
    const btn = await screen.findByText('I have a different day or way of shooting in mind');
    fireEvent.press(btn);
    expect(nav.navigate).toHaveBeenCalledWith('CreatorDefer', {
      campaignInfluencerId: CI, brandName: 'Label Fern (practice)', campaignName: 'New test campaign 1234',
    });
  });

  test('the reservation button is gone once she has already settled in', async () => {
    influencerApi.getMyCampaignDetail.mockResolvedValue({
      success: true,
      data: { ...WITH_TERMS, campaign: { ...WITH_TERMS.campaign, agreement_id: 'ag1', settled_terms: { agreement_id: 'ag1', items: [{ key: 'commission', label: 'Commission', value: '14%' }] } } },
    });
    render(<CollabDetailScreen navigation={nav} route={route} />);
    expect(await screen.findByText('Two things you cannot change')).toBeTruthy();
    expect(screen.queryByText('I have a different day or way of shooting in mind')).toBeNull();
  });

  test('none of the four blocks appear when the server sends none of them', async () => {
    // The ordinary case for a set built before Stage A, or a cold invite with nothing set
    // yet — must not crash, and must not show an empty "Two things you cannot change" card.
    render(<CollabDetailScreen navigation={nav} route={route} />);
    expect(await screen.findByText('New test campaign 1234')).toBeTruthy();
    expect(screen.queryByText('Two things you cannot change')).toBeNull();
  });
});
