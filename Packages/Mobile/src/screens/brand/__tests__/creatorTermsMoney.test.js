/**
 * CreatorTermsScreen (SB-30) — the opening-offer editor for a cold-invited creator.
 * Contract: features/stage-a-the-set
 *
 * Architecture change, founder 2026-09-02: a creator found by search has nothing
 * settled — money becomes something the brand STATES here, not something read back from
 * an agreement. campaignDraft is used for real (not mocked) — it has no React Native
 * imports, so seeding through its own real functions is a genuine integration check, the
 * same choice that caught the draft/filterDraft shadowing bug in the search screen.
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (cb) => require('react').useEffect(cb, [cb]),
}));

import CreatorTermsScreen from '../CreatorTermsScreen';
import * as draft from '../../../utils/campaignDraft';

const nav = { navigate: jest.fn(), goBack: jest.fn() };

function seedColdCreator(campaignId, setId) {
  draft.addColdInvite(campaignId, setId, { influencer_id: 'i9', name: 'Nisha P.', handle: 'nisha.p' });
  return draft.getSetDraft(campaignId, setId).creators[0];
}

test('a cold-invited creator sees an editable opening offer, not a read-only "already agreed" line', () => {
  const creator = seedColdCreator('c1', 's1');
  const route = { params: { campaignId: 'c1', setId: 's1', agreementId: creator.agreement_id, creatorName: 'Nisha P.', selling: true, buyingContent: false, current: creator } };
  render(<CreatorTermsScreen navigation={nav} route={route} />);
  expect(screen.getByText('Your opening offer')).toBeTruthy();
  expect(screen.queryByText('Already agreed')).toBeNull();
  expect(screen.getByPlaceholderText('e.g. 14')).toBeTruthy();
});

test('Save is disabled until she has a real commission stated, on a selling set', () => {
  const creator = seedColdCreator('c2', 's1');
  const route = { params: { campaignId: 'c2', setId: 's1', agreementId: creator.agreement_id, creatorName: 'Nisha P.', selling: true, buyingContent: false, current: creator } };
  render(<CreatorTermsScreen navigation={nav} route={route} />);
  expect(screen.getByText('State her commission before saving.')).toBeTruthy();

  fireEvent.changeText(screen.getByPlaceholderText('e.g. 14'), '15');
  expect(screen.queryByText('State her commission before saving.')).toBeNull();
});

test('saving writes her stated commission to the shared draft, as a number', async () => {
  const creator = seedColdCreator('c3', 's1');
  const route = { params: { campaignId: 'c3', setId: 's1', agreementId: creator.agreement_id, creatorName: 'Nisha P.', selling: true, buyingContent: false, current: creator } };
  render(<CreatorTermsScreen navigation={nav} route={route} />);

  fireEvent.changeText(screen.getByPlaceholderText('e.g. 14'), '15');
  fireEvent.press(screen.getByText('Save · she sees all of this'));

  await waitFor(() => expect(nav.goBack).toHaveBeenCalled());
  const saved = draft.getSetDraft('c3', 's1').creators[0];
  expect(saved.terms.money).toEqual({ commission_pct: 15, fee: null });
});

test('a buying-content set asks for a fee instead, in rupees', () => {
  const creator = seedColdCreator('c4', 's1');
  const route = { params: { campaignId: 'c4', setId: 's1', agreementId: creator.agreement_id, creatorName: 'Nisha P.', selling: false, buyingContent: true, current: creator } };
  render(<CreatorTermsScreen navigation={nav} route={route} />);
  expect(screen.getByText('Her fee')).toBeTruthy();
  expect(screen.getByPlaceholderText('e.g. 5000')).toBeTruthy();
  expect(screen.queryByPlaceholderText('e.g. 14')).toBeNull();
});

test('an agreement-sourced creator is unaffected — still the familiar read-only line', () => {
  const settled = {
    agreement_id: 'a1', influencer_id: 'i1', name: 'Asha M.',
    terms: { money: { commission_pct: 14 } }, alloc: { alloc_scope: 'store' },
  };
  const route = { params: { campaignId: 'c5', setId: 's1', agreementId: 'a1', creatorName: 'Asha M.', selling: true, buyingContent: false, current: settled } };
  render(<CreatorTermsScreen navigation={nav} route={route} />);
  expect(screen.getByText('Already agreed')).toBeTruthy();
  expect(screen.queryByText('Your opening offer')).toBeNull();
  expect(screen.queryByPlaceholderText('e.g. 14')).toBeNull();
});
