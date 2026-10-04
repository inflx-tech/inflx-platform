/**
 * shopper-walk-fixes (W15) — Pay for Content, both sides: a video shows the picture taken from it,
 * and her phone makes and sends that picture right after the video is uploaded.
 * Contract: features/shopper-walk-fixes · BUILD_API.md §2 · frames B1, C2 (the same file tiles)
 *
 * The Going live twins are in goingLiveWalkFixes.test.js; the tile and the sender themselves in
 * components/content/__tests__/videoCover12.test.js; the picture-maker, with and without the
 * compressor, in utils/__tests__/videoPicture.test.js.
 */
import React from 'react';
import { StyleSheet } from 'react-native';
import { render, waitFor, fireEvent, within, act } from '@testing-library/react-native';

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (cb) => { const R = require('react'); R.useEffect(() => { const c = cb(); return typeof c === 'function' ? c : undefined; }, [cb]); },
}));
jest.mock('react-native-image-picker', () => ({ launchImageLibrary: jest.fn() }));
jest.mock('../../utils/videoPrep', () => ({ makeVideoPicture: jest.fn() }));
jest.mock('../../services/api', () => ({
  influencerApi: {
    myContent: jest.fn(), contentCaption: jest.fn(), contentSubmit: jest.fn(), contentSetProof: jest.fn(),
    contentClearProof: jest.fn(), contentPosted: jest.fn(), contentReport: jest.fn(), contentUploadUrl: jest.fn(),
    contentConfirmFile: jest.fn(), contentRemoveFile: jest.fn(), contentFileUrl: jest.fn(),
    contentCoverUrl: jest.fn(), contentConfirmCover: jest.fn(),
  },
  brandApi: {
    content: jest.fn(), contentApprove: jest.fn(), contentChanges: jest.fn(), contentConfirmLive: jest.fn(),
    contentReport: jest.fn(), contentFileUrl: jest.fn(),
  },
  uploadContentFile: jest.fn(),
}));
const api = require('../../services/api');
const { launchImageLibrary } = require('react-native-image-picker');
const { makeVideoPicture } = require('../../utils/videoPrep');
const { _setPlayerForTests } = require('../../utils/videoPlayer');
const { settingsTokens: T } = require('../../theme/tokens');
import ContentScreen from '../influencer/ContentScreen';
import BrandContentScreen from '../brand/BrandContentScreen';

const nav = { navigate: jest.fn(), goBack: jest.fn(), addListener: jest.fn(() => () => {}), setParams: jest.fn() };
const HER = { params: { ciId: 'ci1' } };
const BRAND = { params: { campaignId: 'c1', setId: 's1', ciId: 'ci1' } };
const D = (d) => `2026-10-${String(d).padStart(2, '0')}T06:00:00.000Z`;
const flat = (el) => StyleSheet.flatten(el.props.style) || {};
const settle = () => act(async () => { for (let i = 0; i < 25; i += 1) await Promise.resolve(); });   // eslint-disable-line no-await-in-loop

const reel = (files = [], proofs = []) => ({ key: 'reel', type: 'reel', count: 2, label: 'Instagram reel', platform: 'instagram', isStory: false, caption: '', files, have: files.length, proofs });
const story = (files = [], proofs = []) => ({ key: 'story', type: 'story', count: 1, label: 'Instagram story', platform: 'instagram', isStory: true, caption: '', files, have: files.length, proofs });
const withPic = { id: 'v1', kind: 'video', mime: 'video/mp4', durationS: 28, notes: [], pinnedNote: null, hasCover: true };
const without = { id: 'v2', kind: 'video', mime: 'video/mp4', durationS: 9, notes: [], pinnedNote: null, hasCover: false };
const photo = { id: 'p1', kind: 'photo', mime: 'image/jpeg', notes: [], pinnedNote: null };

/** The server's G1 shape (contentFlow.shape) at whatever stage the test needs. */
function content(over = {}) {
  return {
    invitationId: 'ci1', contentId: 'cc1', campaignName: 'Diwali Edit 2026', setName: 'Set A', mode: 'visit',
    brand: { name: 'Urban Threads' }, creator: { name: 'Tanvi Suresh' },
    stage: 'draft', frozen: false, shootDoneAt: D(19), postingDate: '2026-10-24', daysToPosting: 5,
    rows: [reel([withPic, without]), story([photo])], missing: [],
    proofsLeft: [], round: { current: 1, allowed: 2, isLast: false, used: false, stamped: false }, rounds: [], changesAsked: 0,
    approvedAt: null, postedAt: null, reportFrom: null, liveConfirmedAt: null, finalDueAt: null, completedAt: null, proofCount: 0,
    money: { fee: 12000, waitDays: 7, stillLocked: 9000, campaignFee: 960, t1: { amount: 3000, paidAt: '2026-09-14T06:00:00Z', status: 'released' }, t2: { amount: 3000, paidAt: null, status: 'locked' }, t3: { amount: 6000, paidAt: null, status: 'locked', dueAt: null } },
    usageRights: { on: true, durationDays: 90, places: ['social'], words: '90 days · social' },
    reported: { brand: null, creator: null }, delayed: null, yourMove: true, move: { key: 'send_content', side: 'creator' },
    can: { submit: true, upload: true },
    steps: [{ key: 'signed', label: 'Agreement signed', state: 'done', at: '2026-09-14T06:00:00Z' }, { key: 'shoot', label: 'Shoot', state: 'done', at: D(19) }, { key: 'content', label: 'Content', state: 'now', at: null }, { key: 'live', label: 'Live and paid', state: 'later', at: null }],
    ...over,
  };
}
const ok = (c) => Promise.resolve({ success: true, data: { content: c } });
const her = (c) => { api.influencerApi.myContent.mockReturnValue(ok(c)); return render(<ContentScreen navigation={nav} route={HER} />); };
const brand = (c) => { api.brandApi.content.mockReturnValue(ok(c)); return render(<BrandContentScreen navigation={nav} route={BRAND} />); };
/** A link for a file: the picture taken from a video when the last argument says so, else the file itself. */
const linkFor = (...args) => {
  const cover = args[args.length - 1] === true;
  const id = cover ? args[args.length - 2] : args[args.length - 1];
  return Promise.resolve({ success: true, data: { view: cover ? { url: `https://r2/${id}.cover.jpg`, kind: 'photo', mime: 'image/jpeg', cover: true } : { url: `https://r2/${id}`, kind: null } } });
};

let errors;
beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  _setPlayerForTests(null);
  api.influencerApi.contentFileUrl.mockImplementation(linkFor);
  api.brandApi.contentFileUrl.mockImplementation(linkFor);
  makeVideoPicture.mockResolvedValue(null);
  errors = jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  const said = errors.mock.calls.map((args) => args.map(String).join(' ').split('\n')[0]);
  errors.mockRestore(); _setPlayerForTests(undefined);
  jest.useRealTimers();
  expect(said).toEqual([]);
});

describe('her content screen', () => {
  it('editing: a video with a picture shows it under the play mark and the length; one without stays the dark tile; a photo is as before', async () => {
    const r = her(content());
    await waitFor(() => r.getByTestId('edit-row-reel'));
    await waitFor(() => expect(within(r.getByTestId('file-v1')).getByTestId('video-picture').props.source).toEqual({ uri: 'https://r2/v1.cover.jpg' }));
    expect(api.influencerApi.contentFileUrl).toHaveBeenCalledWith('ci1', 'v1', true);
    expect(within(r.getByTestId('file-v1')).getByText('play')).toBeTruthy();
    expect(within(r.getByTestId('file-v1')).getByText('0:28')).toBeTruthy();
    expect(api.influencerApi.contentFileUrl.mock.calls.filter((c) => c[1] === 'v2')).toEqual([]);
    expect(within(r.getByTestId('file-v2')).queryByTestId('video-picture')).toBeNull();
    expect(flat(r.getByTestId('file-v2')).backgroundColor).toBe(T.ink);
    expect(api.influencerApi.contentFileUrl).toHaveBeenCalledWith('ci1', 'p1');
  });

  it('with the brand: the same picture; the tap opens the VIDEO, with the deliverable over "1 of 2"', async () => {
    const r = her(content({ stage: 'in_review', can: {}, rounds: [{ no: 1, verdict: null, submittedAt: D(20), rows: [], notes: [] }] }));
    await waitFor(() => r.getByTestId('with-them'));
    await waitFor(() => within(r.getByTestId('file-v1')).getByTestId('video-picture'));
    api.influencerApi.contentFileUrl.mockClear();
    fireEvent.press(r.getByTestId('file-v1'));
    await waitFor(() => r.getByTestId('viewer-needs-update'));
    expect(api.influencerApi.contentFileUrl.mock.calls).toEqual([['ci1', 'v1']]);     // never the picture's link
    expect(r.getByTestId('viewer-title').props.children).toBe('Instagram reel');
    expect(r.getByTestId('viewer-which').props.children).toBe('1 of 2');
    expect(r.getByText('Update INFLX to play videos')).toBeTruthy();
  });
});

describe('the brand\'s content screen', () => {
  const sent = () => content({ stage: 'in_review', yourMove: true, can: { approve: true, askChanges: true }, rounds: [{ no: 1, verdict: null, submittedAt: D(20), rows: [], notes: [] }] });

  it('reviewing: the picture, asked for with the brand\'s own call; nothing is asked for a video that has none', async () => {
    const r = brand(sent());
    await waitFor(() => r.getByTestId('review-row-reel'));
    await waitFor(() => expect(within(r.getByTestId('file-v1')).getByTestId('video-picture').props.source).toEqual({ uri: 'https://r2/v1.cover.jpg' }));
    expect(api.brandApi.contentFileUrl).toHaveBeenCalledWith('c1', 's1', 'ci1', 'v1', true);
    expect(api.brandApi.contentFileUrl.mock.calls.filter((c) => c[3] === 'v2')).toEqual([]);
    expect(within(r.getByTestId('file-v2')).queryByTestId('video-picture')).toBeNull();
    expect(within(r.getByTestId('file-v2')).getByText('play')).toBeTruthy();
    expect(api.brandApi.contentFileUrl).toHaveBeenCalledWith('c1', 's1', 'ci1', 'p1');
  });

  it('the tap opens the VIDEO, and "Add a note" is still under it', async () => {
    const r = brand(sent());
    await waitFor(() => r.getByTestId('review-row-reel'));
    await waitFor(() => within(r.getByTestId('file-v1')).getByTestId('video-picture'));
    api.brandApi.contentFileUrl.mockClear();
    fireEvent.press(r.getByTestId('file-v1'));
    await waitFor(() => r.getByTestId('viewer-needs-update'));
    expect(api.brandApi.contentFileUrl.mock.calls).toEqual([['c1', 's1', 'ci1', 'v1']]);
    expect(r.getByTestId('viewer-title').props.children).toBe('Instagram reel');
    expect(r.getByTestId('viewer-which').props.children).toBe('1 of 2');
    expect(r.getByTestId('viewer-add-note')).toBeTruthy();
  });
});

describe('adding a video on her content screen: the video first, exactly as before — then its picture', () => {
  const VIDEO = { uri: 'file:///cache/reel.mp4', type: 'video/mp4', fileSize: 4200000, duration: 28, fileName: 'reel.mp4' };
  const videoUpload = { fileId: 'f9', url: 'https://r2/put-video', method: 'PUT', headers: { 'Content-Type': 'video/mp4' } };
  const coverUpload = { fileId: 'f9', url: 'https://r2/put-cover', method: 'PUT', headers: { 'Content-Type': 'image/jpeg' } };
  const empty = () => content({ rows: [reel(), story()], missing: [{ key: 'reel', label: 'Instagram reel', need: 2, have: 0, short: 2 }], can: { upload: true } });
  const after = (hasCover) => content({ rows: [reel([{ id: 'f9', kind: 'video', mime: 'video/mp4', durationS: 28, notes: [], pinnedNote: null, hasCover }]), story()] });
  let order;

  function wire(picture = { uri: 'file:///cache/thumbnails/thumb-1', size: 184320, mime: 'image/jpeg' }) {
    order = [];
    launchImageLibrary.mockResolvedValue({ assets: [VIDEO] });
    makeVideoPicture.mockImplementation(() => { order.push('picture'); return Promise.resolve(picture); });
    api.influencerApi.contentUploadUrl.mockImplementation(() => { order.push('upload-url'); return Promise.resolve({ success: true, data: { upload: videoUpload } }); });
    api.uploadContentFile.mockImplementation((upload) => { order.push(upload === coverUpload ? 'put-picture' : 'put-video'); return Promise.resolve({ ok: true }); });
    api.influencerApi.contentConfirmFile.mockImplementation(() => { order.push('confirm'); return Promise.resolve({ success: true, data: { file: { id: 'f9' } } }); });
    api.influencerApi.contentCoverUrl.mockImplementation(() => { order.push('cover-url'); return Promise.resolve({ success: true, data: { upload: coverUpload } }); });
    api.influencerApi.contentConfirmCover.mockImplementation(() => { order.push('cover'); return Promise.resolve({ success: true, data: { file: { id: 'f9', hasCover: true } } }); });
  }
  /** Past "what you agreed", then "+ Add" on the reel row; the screen is read again when the upload is over. */
  async function add(then) {
    const r = her(empty());
    await waitFor(() => r.getByTestId('start-uploading'));
    fireEvent.press(r.getByTestId('start-uploading'));
    await waitFor(() => r.getByTestId('add-reel'));
    api.influencerApi.myContent.mockReturnValue(ok(then));
    fireEvent.press(r.getByTestId('add-reel'));
    await waitFor(() => r.getByTestId('file-f9'));
    await settle();
    return r;
  }

  it('upload-url → PUT video → confirm → THEN picture → cover-url → PUT picture → cover; the tile then shows it', async () => {
    wire();
    const r = await add(after(true));
    expect(order).toEqual(['upload-url', 'put-video', 'confirm', 'picture', 'cover-url', 'put-picture', 'cover']);
    expect(makeVideoPicture).toHaveBeenCalledWith('file:///cache/reel.mp4', { maxBytes: 1024 * 1024 });
    expect(api.influencerApi.contentCoverUrl).toHaveBeenCalledWith('ci1', 'f9', 184320);
    expect(api.uploadContentFile).toHaveBeenLastCalledWith(coverUpload, 'file:///cache/thumbnails/thumb-1', { timeoutMs: 30000 });
    expect(api.influencerApi.contentConfirmCover).toHaveBeenCalledWith('ci1', 'f9');
    await waitFor(() => expect(within(r.getByTestId('file-f9')).getByTestId('video-picture').props.source).toEqual({ uri: 'https://r2/f9.cover.jpg' }));
    expect(r.queryAllByRole('alert')).toEqual([]);
  });

  it('an older app build: the video is uploaded as before, nothing more is asked, nothing is said', async () => {
    wire(null);
    const r = await add(after(false));
    expect(order).toEqual(['upload-url', 'put-video', 'confirm', 'picture']);
    expect(api.influencerApi.contentCoverUrl).not.toHaveBeenCalled();
    expect(within(r.getByTestId('file-f9')).queryByTestId('video-picture')).toBeNull();
    expect(r.queryAllByRole('alert')).toEqual([]);
  });

  it('a failing picture never surfaces an error: refused, lost, not kept — the video stays and no red line is shown', async () => {
    for (const breakIt of [
      () => api.influencerApi.contentCoverUrl.mockResolvedValue({ success: false, error: { code: 'FILE_TOO_LARGE_PHOTO', message: 'Photos have to be under 10 MB.' } }),
      () => api.uploadContentFile.mockImplementation((upload) => (upload === coverUpload ? Promise.reject(Object.assign(new Error('UPLOAD_NETWORK'), { code: 'UPLOAD_NETWORK' })) : Promise.resolve({ ok: true }))),
      () => api.influencerApi.contentConfirmCover.mockResolvedValue({ success: false, error: { code: 'UPLOAD_MISSING', message: "The upload didn't finish. Try again." } }),
      () => makeVideoPicture.mockRejectedValue(new Error('codec')),
    ]) {
      wire();
      breakIt();
      const r = await add(after(false));                                     // eslint-disable-line no-await-in-loop
      expect(r.getByTestId('file-f9')).toBeTruthy();
      expect(r.queryAllByRole('alert')).toEqual([]);
      expect(r.queryByText('Photos have to be under 10 MB.')).toBeNull();
      expect(r.queryByText("The upload didn't finish. Try again.")).toBeNull();
      r.unmount();
    }
  });
});
