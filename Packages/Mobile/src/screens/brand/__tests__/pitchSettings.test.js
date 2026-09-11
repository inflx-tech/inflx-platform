/**
 * Item 2 — B2 · B3 · B5 · B6 · B8 on the brand's Pitch settings screen.
 * Every state the mockups show: loading, couldn't load, default, errors, saving, saved, paused.
 * Contract: features/item2-pitch-invitation-settings
 */
import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';

jest.mock('../../../services/api', () => ({
  brandApi: { getPitchSettings: jest.fn(), putPitchSettings: jest.fn() },
  referenceApi: {
    creatorNiches: jest.fn().mockResolvedValue({ success: true, data: { items: [{ code: 'fashion', label: 'Fashion' }, { code: 'comedy', label: 'Comedy' }] } }),
    languages: jest.fn().mockResolvedValue({ success: true, data: { items: [{ code: 'Hindi', label: 'Hindi' }] } }),
    states: jest.fn().mockResolvedValue({ success: true, data: { items: [{ id: 1, name: 'Telangana', cities: [{ id: 10, name: 'Hyderabad' }] }] } }),
  },
}));
const { brandApi } = require('../../../services/api');
const BrandPitchSettingsScreen = require('../BrandPitchSettingsScreen').default;

const DEFAULTS = {
  accepting: true, pausedAt: null, acceptedAims: ['conversion', 'engagement', 'hybrid'], acceptedModes: ['visit', 'shipment'],
  nicheCodes: null, minFollowersInstagram: null, minFollowersYoutube: null, minEngagementRate: null,
  languageCodes: null, cityIds: null, allowPastCreators: true, updatedAt: null, saved: false,
};
const ok = (settings, extra = {}) => ({ success: true, data: { settings, openPitches: 0, blockedCount: 0, ...extra } });
const nav = () => ({ goBack: jest.fn(), navigate: jest.fn(), addListener: jest.fn(() => () => {}), dispatch: jest.fn() });

beforeEach(() => { jest.clearAllMocks(); });

describe('Pitch settings (brand)', () => {
  it('shows a skeleton while loading, then the defaults with Save grey (check 1)', async () => {
    let resolve;
    brandApi.getPitchSettings.mockReturnValue(new Promise(r => { resolve = r; }));
    const { getByTestId, queryByTestId } = render(<BrandPitchSettingsScreen navigation={nav()} />);
    expect(getByTestId('skeleton')).toBeTruthy();
    await act(async () => { resolve(ok(DEFAULTS)); });
    await waitFor(() => expect(queryByTestId('skeleton')).toBeNull());
    expect(getByTestId('accepting-switch').props.value).toBe(true);
    expect(getByTestId('save-button').props.accessibilityState.disabled).toBe(true);
    expect(queryByTestId('paused-banner')).toBeNull();
  });

  it('shows "Couldn\'t load your settings" and Try again retries (check 14)', async () => {
    brandApi.getPitchSettings.mockResolvedValueOnce({ success: false, error: { message: 'x' } }).mockResolvedValueOnce(ok(DEFAULTS));
    const { getByText, getByTestId, queryByTestId } = render(<BrandPitchSettingsScreen navigation={nav()} />);
    await waitFor(() => getByText("Couldn't load your settings"));
    fireEvent.press(getByTestId('try-again'));
    await waitFor(() => expect(queryByTestId('load-error')).toBeNull());
    expect(getByTestId('accepting-switch')).toBeTruthy();
  });

  it('unselecting every Aim shows the exact error and makes saving impossible (check 2)', async () => {
    brandApi.getPitchSettings.mockResolvedValue(ok(DEFAULTS));
    const { getByTestId, getByText } = render(<BrandPitchSettingsScreen navigation={nav()} />);
    await waitFor(() => getByTestId('aim-conversion'));
    fireEvent.press(getByTestId('aim-conversion'));
    fireEvent.press(getByTestId('aim-engagement'));
    fireEvent.press(getByTestId('aim-hybrid'));
    getByText('Pick at least one Aim. To stop all pitches, turn off Accepting pitches instead.');
    expect(getByTestId('save-bar-fix').props.children).toBe('Fix 1 thing above to save');
    expect(getByTestId('save-button').props.accessibilityState.disabled).toBe(true);
    fireEvent.changeText(getByTestId('min-er'), '140');
    getByText('Enter a rate between 0 and 100.');
    expect(getByTestId('save-bar-fix').props.children).toBe('Fix 2 things above to save');
  });

  it('a change enables Save; saving shows the toast and Save goes grey again', async () => {
    brandApi.getPitchSettings.mockResolvedValue(ok(DEFAULTS));
    brandApi.putPitchSettings.mockResolvedValue(ok({ ...DEFAULTS, minFollowersInstagram: 10000, saved: true }));
    const { getByTestId, getByText } = render(<BrandPitchSettingsScreen navigation={nav()} />);
    await waitFor(() => getByTestId('min-ig'));
    fireEvent.changeText(getByTestId('min-ig'), '10000');
    expect(getByTestId('save-button').props.accessibilityState.disabled).toBe(false);
    await act(async () => { fireEvent.press(getByTestId('save-button')); });
    await waitFor(() => getByText('Pitch settings saved.'));
    expect(brandApi.putPitchSettings).toHaveBeenCalledWith(expect.objectContaining({ minFollowersInstagram: 10000 }));
    expect(getByTestId('save-button').props.accessibilityState.disabled).toBe(true);
  });

  it('a failed save keeps the edits and says so (check 14)', async () => {
    brandApi.getPitchSettings.mockResolvedValue(ok(DEFAULTS));
    brandApi.putPitchSettings.mockResolvedValue({ success: false, error: { code: 'INTERNAL_ERROR', message: 'boom' } });
    const { getByTestId, getByText } = render(<BrandPitchSettingsScreen navigation={nav()} />);
    await waitFor(() => getByTestId('min-ig'));
    fireEvent.changeText(getByTestId('min-ig'), '10000');
    await act(async () => { fireEvent.press(getByTestId('save-button')); });
    await waitFor(() => getByText("Couldn't save. Your changes are still here, so try again."));
    expect(getByTestId('min-ig').props.value).toBe('10000');
  });

  it('turning the switch off asks first; confirming pauses, saving shows the paused banner (check 5)', async () => {
    brandApi.getPitchSettings.mockResolvedValue(ok(DEFAULTS, { openPitches: 2 }));
    brandApi.putPitchSettings.mockResolvedValue(ok({ ...DEFAULTS, accepting: false, pausedAt: '2026-09-11T05:00:00Z', saved: true }, { openPitches: 2 }));
    const { getByTestId, getByText, queryByText } = render(<BrandPitchSettingsScreen navigation={nav()} />);
    await waitFor(() => getByTestId('accepting-switch'));
    fireEvent(getByTestId('accepting-switch'), 'valueChange', false);
    getByText('Pause pitches?');
    getByText("Pitches you've already received stay open for you to answer.");
    expect(queryByText(/30 days/)).toBeNull();
    // Keep accepting → nothing changes
    fireEvent.press(getByTestId('confirm-secondary'));
    expect(getByTestId('accepting-switch').props.value).toBe(true);
    // Pause → dirty, then save
    fireEvent(getByTestId('accepting-switch'), 'valueChange', false);
    fireEvent.press(getByTestId('confirm-primary'));
    expect(getByTestId('accepting-switch').props.value).toBe(false);
    await act(async () => { fireEvent.press(getByTestId('save-button')); });
    await waitFor(() => getByTestId('paused-banner'));
    getByText('Pitches paused');
    getByText('Creators see "Not accepting pitches right now". 2 open pitches still need your answer.');
    getByText('Paused since 11 Sep');
    getByText('Kept for when you turn pitches back on.');
    getByTestId('row-open-pitches');
  });
});
