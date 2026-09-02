/**
 * A creator can START a negotiation.
 * Contract: features/negotiation-door
 *
 * THE BUG THIS EXISTS FOR
 * `influencerApi.negotiateOffer` — the only call that creates a negotiation thread —
 * worked for months and was called by NOTHING. A creator who tapped "Negotiate" landed
 * on NegotiationScreen, which fetched a thread, found none, and rendered "No negotiation
 * yet — tap Negotiate on an offer to start a conversation." That was the button that
 * brought her there.
 *
 * So every offer on the platform was take-it-or-leave-it, on a product whose whole
 * premise is brands and creators agreeing terms.
 *
 * These mount the real screen and press the real button, rather than checking source
 * text — the discipline that caught the "storys" bug and the shadowed-import bug.
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';

jest.mock('../../../services/api', () => ({
  influencerApi: {
    getNegotiation: jest.fn(),
    getNegotiationByCampaignInfluencer: jest.fn(),
    negotiateOffer: jest.fn(),
    submitNegotiationTurn: jest.fn(),
  },
}));

import NegotiationScreen from '../NegotiationScreen';
import { influencerApi } from '../../../services/api';

const nav = { goBack: jest.fn(), navigate: jest.fn() };
const NO_THREAD = { success: false, error: { code: 'NOT_FOUND', message: 'none' } };

beforeEach(() => {
  jest.clearAllMocks();
  influencerApi.getNegotiationByCampaignInfluencer.mockResolvedValue(NO_THREAD);
  influencerApi.negotiateOffer.mockResolvedValue({ success: true, data: { negotiation: { id: 'n1' } } });
});

const mount = (params) =>
  render(<NegotiationScreen navigation={nav} route={{ params }} />);

test('⚠️ with no thread yet she gets a form to open one, not a dead end', async () => {
  mount({ campaign_influencer_id: 'ci1', goal: 'engagement' });
  expect(await screen.findByText('Ask for different terms')).toBeTruthy();
  // The exact sentence that made this a closed loop.
  expect(screen.queryByText(/tap "Negotiate" on an offer/i)).toBeNull();
});

test('a paid-content collab asks for a fee', async () => {
  mount({ campaign_influencer_id: 'ci1', goal: 'engagement' });
  await screen.findByText('Ask for different terms');
  expect(screen.getByPlaceholderText('The fee you want')).toBeTruthy();
  expect(screen.queryByPlaceholderText('The commission you want')).toBeNull();
});

test('a commission collab asks for a commission, not a fee', async () => {
  // Before the goal was passed through, this screen defaulted to "engagement" and would
  // have asked a commission-only creator for a fee she is not being paid.
  mount({ campaign_influencer_id: 'ci1', goal: 'conversion' });
  await screen.findByText('Ask for different terms');
  expect(screen.getByPlaceholderText('The commission you want')).toBeTruthy();
  expect(screen.queryByPlaceholderText('The fee you want')).toBeNull();
});

test('⚠️ sending actually calls the endpoint that creates the thread', async () => {
  mount({ campaign_influencer_id: 'ci1', goal: 'engagement' });
  await screen.findByText('Ask for different terms');
  fireEvent.changeText(screen.getByPlaceholderText('The fee you want'), '8000');
  fireEvent.press(screen.getByText('Send to the brand'));

  await waitFor(() => expect(influencerApi.negotiateOffer).toHaveBeenCalled());
  const [ciId, body] = influencerApi.negotiateOffer.mock.calls[0];
  expect(ciId).toBe('ci1');
  expect(body.proposed_fee).toBe(8000);
});

test('the send button stays disabled until she has entered a number', async () => {
  mount({ campaign_influencer_id: 'ci1', goal: 'engagement' });
  await screen.findByText('Ask for different terms');
  fireEvent.press(screen.getByText('Send to the brand'));
  expect(influencerApi.negotiateOffer).not.toHaveBeenCalled();
});

test("the server's refusal is shown to her, not swallowed", async () => {
  // The server refuses for real reasons — terms already settled, the brand fixed them,
  // a thread already exists — and its message is written for her.
  influencerApi.negotiateOffer.mockResolvedValue({
    success: false,
    error: { message: 'You already agreed these terms with the brand.' },
  });
  const spy = jest.spyOn(require('react-native').Alert, 'alert').mockImplementation(() => {});

  mount({ campaign_influencer_id: 'ci1', goal: 'engagement' });
  await screen.findByText('Ask for different terms');
  fireEvent.changeText(screen.getByPlaceholderText('The fee you want'), '8000');
  fireEvent.press(screen.getByText('Send to the brand'));

  await waitFor(() => expect(spy).toHaveBeenCalledWith(
    'Could not start',
    'You already agreed these terms with the brand.',
  ));
  spy.mockRestore();
});

test('opened without a collaboration, it says so instead of offering a broken form', async () => {
  mount({});
  expect(await screen.findByText('Nothing to negotiate')).toBeTruthy();
});
