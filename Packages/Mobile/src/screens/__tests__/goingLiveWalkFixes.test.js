/**
 * shopper-walk-fixes — both Going live screens after the founder's walk of 3–4 Oct 2026.
 * Contract: features/shopper-walk-fixes · spec B2–B4, C1, C3–C7 · frames B1, B2, C1, C2
 *
 *   A · every post row shows its picture; every video she shares shows a picture taken from it,
 *       which her phone makes and sends right after the video is uploaded — and a picture that
 *       cannot be made or sent is never an error
 *   B · "4 approved · ✓ Minimum 1 met" once the minimum is met; "1 of 2 approved" while short
 *   C · her screen: "In the shop from …", "1 file" / "No file yet", the heading over the posts she
 *       can still add, a one-line Send button, and the reason a grey Send is grey
 *   D · the viewer is handed the post and the place (its title is two lines)
 *
 * The compressor is absent in jest, so the picture-maker is stood in for here; the maker itself
 * is tested with and without the compressor in utils/__tests__/videoPicture.test.js.
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
    contentClearProof: jest.fn(), contentPosted: jest.fn(), contentUploadUrl: jest.fn(), contentConfirmFile: jest.fn(),
    contentRemoveFile: jest.fn(), contentFileUrl: jest.fn(), contentCoverUrl: jest.fn(), contentConfirmCover: jest.fn(),
    createPost: jest.fn(), saleAddRows: jest.fn(), saleRemoveRow: jest.fn(), saleAddOutside: jest.fn(), contentReport: jest.fn(),
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
const { settingsTokens: T, fonts } = require('../../theme/tokens');
const { C14 } = require('../../components/sale/copy14');
import SaleLiveScreen, { Progress14, PostLine14, postSub14 } from '../influencer/SaleLiveScreen';
import BrandSaleLiveScreen from '../brand/BrandSaleLiveScreen';

const nav = { navigate: jest.fn(), goBack: jest.fn(), addListener: jest.fn(() => () => {}), setParams: jest.fn() };
const HER = { params: { ciId: 'ci1' } };
const BRAND = { params: { campaignId: 'c1', setId: 's1', ciId: 'ci1' } };
const D = (d) => `2026-10-${String(d).padStart(2, '0')}T06:00:00.000Z`;
const LONG_BRAND = 'Aveen fashion boutique and desiner studio';
const flat = (el) => StyleSheet.flatten(el.props.style) || {};
const settle = () => act(async () => { for (let i = 0; i < 25; i += 1) await Promise.resolve(); });   // eslint-disable-line no-await-in-loop

const post = (id, over = {}) => ({ id, title: 'Festive Sarees', code: 'K7M2F9', kind: 'offer', offerName: '20% off', state: 'live', goesLiveOn: null, counts: true, approvedAt: D(2), late: false, sharable: true, cover: null, inPackage: false, ...over });
const row = (key, type, label, over = {}) => ({ key, type, label, count: 1, platform: 'instagram', isStory: type === 'story', postId: 'p1', outside: false, caption: '', files: [], have: 0, proofs: [{ slot: 1, url: null, screenshotFileId: null, filled: false }], post: { id: 'p1', title: 'Festive Sarees', code: 'K7M2F9' }, ...over });
const destinations = [['reel', 'Instagram reel'], ['post', 'Instagram post'], ['story', 'Instagram story'], ['youtube_video', 'YouTube video'], ['youtube_short', 'YouTube Short']]
  .map(([type, label]) => ({ type, label, isStory: type === 'story' }));
const p1of = (over = {}) => ({ min: 1, approved: 1, short: 0, met: true, late: 0, inReview: 0, sentBack: 0, open: true, posts: [post('p1')], ...over });

/** The server's read (contentFlow.shapeSale) at whatever moment the test needs. */
function sale(over = {}) {
  return {
    aim: 'sale', invitationId: 'ci1', contentId: 'cc1', campaignName: 'Pay per sale offers testing', setName: 'Festive season offer', mode: 'shipment',
    brand: { name: 'Urban Threads' }, creator: { name: 'Akshaya Reddy' },
    stage: 'draft', frozen: false, shootDoneAt: D(1), postingDate: '2026-10-24', daysToPosting: 20,
    rows: [], missing: [], proofsLeft: [], round: { current: 1, allowed: 2, isLast: false, used: false, stamped: false }, rounds: [],
    approvedAt: null, postedAt: null, liveConfirmedAt: null, completedAt: null, money: null,
    path1: p1of(),
    notShared: [], sales: { orders: 0, sales: 0, commission: 0, pending: 0, inWallet: 0 },
    autoconfirmAt: null, liveConfirmedAuto: false, waitingOnPosts: false,
    reported: { brand: null, creator: null }, delayed: null, yourMove: true, move: { key: 'send_social', side: 'creator' },
    can: { addRows: true, removeRow: true, upload: true, submit: false }, destinations,
    steps: [],
    ...over,
  };
}
const ok = (c) => Promise.resolve({ success: true, data: { content: c } });
const her = (c) => { api.influencerApi.myContent.mockReturnValue(ok(c)); return render(<SaleLiveScreen navigation={nav} route={HER} />); };
const brand = (c) => { api.brandApi.content.mockReturnValue(ok(c)); return render(<BrandSaleLiveScreen navigation={nav} route={BRAND} />); };
/** A link for a file: the picture taken from a video when the last argument says so, else the file itself. */
const linkFor = (...args) => {
  const cover = args[args.length - 1] === true;
  const id = cover ? args[args.length - 2] : args[args.length - 1];
  return Promise.resolve({ success: true, data: { view: cover ? { url: `https://r2/${id}.cover.jpg`, kind: 'photo', mime: 'image/jpeg', cover: true } : { url: `https://r2/${id}`, kind: null } } });
};

let errors;
beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();                               // a touchable's press animation stays inside act()
  _setPlayerForTests(null);                           // jest has no native player
  api.influencerApi.contentFileUrl.mockImplementation(linkFor);
  api.brandApi.contentFileUrl.mockImplementation(linkFor);
  makeVideoPicture.mockResolvedValue(null);           // "an older app build" unless the test says otherwise
  errors = jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  const said = errors.mock.calls.map((args) => args.map(String).join(' ').split('\n')[0]);
  errors.mockRestore(); _setPlayerForTests(undefined);
  jest.useRealTimers();
  expect(said).toEqual([]);                           // key clashes, act() warnings, a ref on a function component …
});

/* ───────────────────────────── B · the count line (frames B1, C1) */

describe('B3 · C3 · the count: "4 approved · ✓ Minimum 1 met", never "4 of 1 approved"', () => {
  it('past the minimum: the count alone, and the minimum said as met, in green', () => {
    const r = render(<Progress14 p1={{ approved: 4, min: 1 }} />);
    expect(r.getByTestId('progress-count').props.children).toBe('4 approved');
    const met = r.getByTestId('progress-met');
    expect(met.props.children).toBe('✓ Minimum 1 met');
    expect(flat(met).color).toBe(T.state.active.fg);
    expect(flat(met).fontFamily).toBe(fonts.sansBold);
    expect(r.queryByText(/of 1 approved/)).toBeNull();
    expect(r.queryByText(/set by INFLX/)).toBeNull();
  });

  it('exactly at the minimum is met', () => {
    const r = render(<Progress14 p1={{ approved: 2, min: 2 }} />);
    expect(r.getByText('2 approved')).toBeTruthy();
    expect(r.getByText('✓ Minimum 2 met')).toBeTruthy();
  });

  it('still short: exactly as before — "1 of 2 approved" and "Minimum 2 · set by INFLX", in grey', () => {
    const r = render(<Progress14 p1={{ approved: 1, min: 2 }} />);
    expect(r.getByTestId('progress-count').props.children).toBe('1 of 2 approved');
    const min = r.getByTestId('progress-min');
    expect(min.props.children).toBe('Minimum 2 · set by INFLX');
    expect(flat(min).color).toBe(T.ink2);
    expect(r.queryByTestId('progress-met')).toBeNull();
    const none = render(<Progress14 p1={{ approved: 0, min: 1 }} />);
    expect(none.getByText('0 of 1 approved')).toBeTruthy();
  });

  it('the line under the bar is still there', () => {
    const r = render(<Progress14 p1={{ approved: 4, min: 1 }} line="1 post is with INFLX for review." />);
    expect(r.getByText('1 post is with INFLX for review.')).toBeTruthy();
  });

  it('on her screen and on the brand\'s — the same piece', async () => {
    const p1 = p1of({ approved: 4, posts: [post('p1'), post('p2'), post('p3'), post('p4')] });
    const h = her(sale({ path1: p1 }));
    await waitFor(() => h.getByTestId('path1'));
    expect(within(h.getByTestId('path1')).getByText('4 approved')).toBeTruthy();
    expect(within(h.getByTestId('path1')).getByText('✓ Minimum 1 met')).toBeTruthy();
    const b = brand(sale({ path1: p1 }));
    await waitFor(() => b.getByTestId('path1'));
    expect(within(b.getByTestId('path1')).getByText('4 approved')).toBeTruthy();
    expect(within(b.getByTestId('path1')).getByText('✓ Minimum 1 met')).toBeTruthy();
    const short = her(sale({ path1: p1of({ min: 2, short: 1, met: false }) }));
    await waitFor(() => short.getByTestId('path1'));
    expect(short.getByText('1 of 2 approved')).toBeTruthy();
    expect(short.getByText('Minimum 2 · set by INFLX')).toBeTruthy();
  });
});

/* ───────────────────────────── A · a post's picture (frames B1, C1, C2) */

describe('B2 · C1 · a post row shows its picture', () => {
  const photoPost = post('ph', { title: 'Linen co-ord', cover: { url: 'https://api/v1/media/post/m1', isVideo: false } });
  const videoPost = post('vd', { title: 'This good offer', code: 'SHNCZW', cover: { url: 'https://api/v1/media/post/m2/cover', isVideo: true } });
  const oldVideo = post('ov', { title: 'This is for BOGI', code: 'JD54B4', cover: { url: null, isVideo: true } });
  const bare = post('nc', { title: 'No slide yet', cover: null });

  it('a photo post: the photo itself, no play mark', () => {
    const r = render(<PostLine14 post={photoPost} />);
    expect(r.getByTestId('post-picture').props.source).toEqual({ uri: 'https://api/v1/media/post/m1' });
    expect(r.queryByTestId('play-mark')).toBeNull();
  });

  it('a video post: the picture taken from it, with a small play mark over it', () => {
    const r = render(<PostLine14 post={videoPost} />);
    expect(r.getByTestId('video-picture').props.source).toEqual({ uri: 'https://api/v1/media/post/m2/cover' });
    expect(within(r.getByTestId('play-mark')).getByText('play')).toBeTruthy();
    expect(flat(r.getByTestId('play-mark')).width).toBe(22);               // the small mark (14) on its disc
  });

  it('a video uploaded before 4 Oct (no picture): the dark tile with the play mark, never a blank box', () => {
    const r = render(<PostLine14 post={oldVideo} />);
    expect(r.queryByTestId('video-picture')).toBeNull();
    expect(flat(r.getByTestId('video-face')).backgroundColor).toBe(T.ink);
    expect(within(r.getByTestId('play-mark')).getByText('play')).toBeTruthy();
    expect(r.queryByTestId('post-thumb-plain')).toBeNull();
  });

  it('no cover at all (an older server answer too): the plain box, as before', () => {
    expect(render(<PostLine14 post={bare} />).getByTestId('post-thumb-plain')).toBeTruthy();
    const { cover, ...older } = bare;
    const r = render(<PostLine14 post={older} />);
    expect(r.getByTestId('post-thumb-plain')).toBeTruthy();
    expect(r.queryByTestId('play-mark')).toBeNull();
  });

  it('her screen: in the Path 1 list, in the list of posts she can still add, and in the list outside the package', async () => {
    const r = her(sale({
      stage: 'approved', approvedAt: D(3),
      path1: p1of({ approved: 3, posts: [photoPost, videoPost, oldVideo] }),
      rows: [row('s1', 'reel', 'Instagram reel', { postId: 'vd', post: { id: 'vd', title: 'This good offer', code: 'SHNCZW' }, proofs: [{ slot: 1, url: 'https://www.instagram.com/reel/x', filled: true }] })],
      notShared: [{ postId: 'ph', inPackage: false, dueBy: D(26) }],
      can: { markPosted: true, addOutside: true },
    }));
    await waitFor(() => r.getByTestId('outside'));
    const list = within(r.getByTestId('path1'));
    expect(within(list.getByTestId('post-ph')).getByTestId('post-picture')).toBeTruthy();
    expect(within(list.getByTestId('post-vd')).getByTestId('video-picture').props.source).toEqual({ uri: 'https://api/v1/media/post/m2/cover' });
    expect(within(list.getByTestId('post-ov')).queryByTestId('video-picture')).toBeNull();
    expect(within(list.getByTestId('post-ov')).getByTestId('play-mark')).toBeTruthy();
    // … and the same post, again, in the list outside the package.
    expect(within(within(r.getByTestId('outside')).getByTestId('post-ph')).getByTestId('post-picture').props.source).toEqual({ uri: 'https://api/v1/media/post/m1' });

    const e = her(sale({ path1: p1of({ approved: 2, posts: [photoPost, videoPost] }) }));
    await waitFor(() => e.getByTestId('sharable-vd'));
    expect(within(e.getByTestId('sharable-vd')).getByTestId('video-picture')).toBeTruthy();
    expect(within(e.getByTestId('sharable-ph')).getByTestId('post-picture')).toBeTruthy();
  });

  it('the brand\'s screen: the same pictures on her posts', async () => {
    const r = brand(sale({ stage: 'draft', path1: p1of({ approved: 3, posts: [photoPost, videoPost, oldVideo] }) }));
    await waitFor(() => r.getByTestId('path1'));
    expect(within(r.getByTestId('post-ph')).getByTestId('post-picture')).toBeTruthy();
    expect(within(r.getByTestId('post-vd')).getByTestId('video-picture')).toBeTruthy();
    expect(within(r.getByTestId('post-ov')).getByTestId('play-mark')).toBeTruthy();
    expect(within(r.getByTestId('post-ov')).queryByTestId('video-picture')).toBeNull();
  });
});

/* ───────────────────────────── A · a shared video's picture on its tile (frames B1, C2) */

describe('B2 · C1 · a video she shared shows the picture taken from it', () => {
  const withPic = { id: 'f1', kind: 'video', mime: 'video/mp4', durationS: 14, hasCover: true };
  const without = { id: 'f2', kind: 'video', mime: 'video/mp4', durationS: 9, hasCover: false };
  const photo = { id: 'f3', kind: 'photo', mime: 'image/jpeg' };
  const filled = () => [row('s1', 'reel', 'Instagram reel', { files: [withPic, without, photo] })];

  it('her screen, editing: the PICTURE is asked for (cover), the tile draws it under the play mark and the length; a video without one stays dark and asks for nothing', async () => {
    const r = her(sale({ rows: filled() }));
    await waitFor(() => r.getByTestId('row-s1'));
    await waitFor(() => expect(within(r.getByTestId('file-f1')).getByTestId('video-picture').props.source).toEqual({ uri: 'https://r2/f1.cover.jpg' }));
    expect(api.influencerApi.contentFileUrl).toHaveBeenCalledWith('ci1', 'f1', true);
    expect(within(r.getByTestId('file-f1')).getByText('play')).toBeTruthy();
    expect(within(r.getByTestId('file-f1')).getByText('0:14')).toBeTruthy();
    // The video that has no picture: nothing is asked for it, and it is the dark tile it always was.
    expect(api.influencerApi.contentFileUrl.mock.calls.filter((c) => c[1] === 'f2')).toEqual([]);
    expect(within(r.getByTestId('file-f2')).queryByTestId('video-picture')).toBeNull();
    expect(flat(r.getByTestId('file-f2')).backgroundColor).toBe(T.ink);
    expect(within(r.getByTestId('file-f2')).getByText('0:09')).toBeTruthy();
    // A photo is asked for exactly as before.
    expect(api.influencerApi.contentFileUrl).toHaveBeenCalledWith('ci1', 'f3');
  });

  it('tapping the tile opens the viewer on the VIDEO — the viewer never uses the picture link', async () => {
    const r = her(sale({ rows: filled() }));
    await waitFor(() => r.getByTestId('row-s1'));
    await waitFor(() => within(r.getByTestId('file-f1')).getByTestId('video-picture'));
    api.influencerApi.contentFileUrl.mockClear();
    fireEvent.press(r.getByTestId('file-f1'));
    await waitFor(() => r.getByTestId('viewer-needs-update'));               // a video, on a build without the player
    expect(api.influencerApi.contentFileUrl.mock.calls).toEqual([['ci1', 'f1']]);
    expect(r.getByText('Update INFLX to play videos')).toBeTruthy();         // unchanged on an older build
    expect(r.queryByTestId('viewer-photo')).toBeNull();
  });

  it('her screen, while the brand reviews: the same picture', async () => {
    const r = her(sale({ stage: 'in_review', rows: filled(), can: {}, rounds: [{ no: 1, submittedAt: D(3), verdict: null, rows: [], notes: [] }], round: { current: 1, allowed: 2, isLast: false, used: false, stamped: true } }));
    await waitFor(() => r.getByTestId('path2-in-review'));
    await waitFor(() => within(r.getByTestId('file-f1')).getByTestId('video-picture'));
    expect(api.influencerApi.contentFileUrl).toHaveBeenCalledWith('ci1', 'f1', true);
  });

  it('the brand\'s review: the picture, asked for with the brand\'s own call; the tap opens the video', async () => {
    const r = brand(sale({ stage: 'in_review', rows: filled(), can: { approve: true, askChanges: true },
      rounds: [{ no: 1, submittedAt: D(3), verdict: null, rows: [], notes: [] }], round: { current: 1, allowed: 2, isLast: false, used: false, stamped: true } }));
    await waitFor(() => r.getByTestId('review'));
    await waitFor(() => expect(within(r.getByTestId('file-f1')).getByTestId('video-picture').props.source).toEqual({ uri: 'https://r2/f1.cover.jpg' }));
    expect(api.brandApi.contentFileUrl).toHaveBeenCalledWith('c1', 's1', 'ci1', 'f1', true);
    expect(api.brandApi.contentFileUrl.mock.calls.filter((c) => c[3] === 'f2')).toEqual([]);
    expect(within(r.getByTestId('file-f2')).queryByTestId('video-picture')).toBeNull();
    expect(api.brandApi.contentFileUrl).toHaveBeenCalledWith('c1', 's1', 'ci1', 'f3');
    api.brandApi.contentFileUrl.mockClear();
    fireEvent.press(r.getByTestId('file-f1'));
    await waitFor(() => r.getByTestId('viewer-needs-update'));
    expect(api.brandApi.contentFileUrl.mock.calls).toEqual([['c1', 's1', 'ci1', 'f1']]);
    // B4 — the title: the post with its code, then the place and which file.
    expect(r.getByTestId('viewer-title').props.children).toBe('Festive Sarees · K7M2F9');
    expect(r.getByTestId('viewer-which').props.children).toBe('Instagram reel · 1 of 3');
  });

  it('a picture link that is refused (404: there is none after all) leaves the dark tile and shows no error', async () => {
    api.influencerApi.contentFileUrl.mockImplementation((...args) => (args[2] === true ? Promise.resolve({ success: false, error: { code: 'NOT_FOUND', message: 'Not found' } }) : linkFor(...args)));
    const r = her(sale({ rows: filled() }));
    await waitFor(() => r.getByTestId('row-s1'));
    await settle();
    expect(within(r.getByTestId('file-f1')).queryByTestId('video-picture')).toBeNull();
    expect(within(r.getByTestId('file-f1')).getByText('play')).toBeTruthy();
    expect(r.queryByText('Not found')).toBeNull();
  });
});

/* ───────────────────────────── A · her phone makes and sends the picture */

describe('C1 · adding a video: the video first, exactly as before — then its picture', () => {
  const VIDEO = { uri: 'file:///cache/reel.mp4', type: 'video/mp4', fileSize: 4200000, duration: 14, fileName: 'reel.mp4' };
  const PHOTO = { uri: 'file:///cache/look.jpg', type: 'image/jpeg', fileSize: 2048, fileName: 'look.jpg' };
  const videoUpload = { fileId: 'f9', url: 'https://r2/put-video', method: 'PUT', headers: { 'Content-Type': 'video/mp4' } };
  const coverUpload = { fileId: 'f9', url: 'https://r2/put-cover', method: 'PUT', headers: { 'Content-Type': 'image/jpeg' } };
  const empty = () => sale({ rows: [row('s1', 'reel', 'Instagram reel')] });
  const after = (hasCover) => sale({ rows: [row('s1', 'reel', 'Instagram reel', { files: [{ id: 'f9', kind: 'video', mime: 'video/mp4', durationS: 14, hasCover }] })], can: { addRows: true, removeRow: true, upload: true, submit: true } });
  let order;

  /** Everything answers well; each test then breaks one thing. */
  function wire({ picture = { uri: 'file:///cache/thumbnails/thumb-1', size: 184320, mime: 'image/jpeg' }, asset = VIDEO } = {}) {
    order = [];
    launchImageLibrary.mockResolvedValue({ assets: [asset] });
    makeVideoPicture.mockImplementation(() => { order.push('picture'); return Promise.resolve(picture); });
    api.influencerApi.contentUploadUrl.mockImplementation(() => { order.push('upload-url'); return Promise.resolve({ success: true, data: { upload: videoUpload } }); });
    api.uploadContentFile.mockImplementation((upload) => { order.push(upload === coverUpload ? 'put-picture' : 'put-video'); return Promise.resolve({ ok: true }); });
    api.influencerApi.contentConfirmFile.mockImplementation(() => { order.push('confirm'); return Promise.resolve({ success: true, data: { file: { id: 'f9' } } }); });
    api.influencerApi.contentCoverUrl.mockImplementation(() => { order.push('cover-url'); return Promise.resolve({ success: true, data: { upload: coverUpload } }); });
    api.influencerApi.contentConfirmCover.mockImplementation(() => { order.push('cover'); return Promise.resolve({ success: true, data: { file: { id: 'f9', hasCover: true } } }); });
  }
  /** She taps "+ Add" on the row; the screen is read again once the upload is over. */
  async function add(r, then) {
    api.influencerApi.myContent.mockReturnValue(ok(then));
    fireEvent.press(r.getByTestId('add-s1'));
    await waitFor(() => r.getByTestId('file-f9'));
    await settle();
  }
  const noRedLine = (r) => expect(r.queryAllByRole('alert')).toEqual([]);

  it('upload-url → PUT video → confirm → THEN picture → cover-url → PUT picture → cover; the tile then shows it', async () => {
    wire();
    const r = her(empty());
    await waitFor(() => r.getByTestId('row-s1'));
    await add(r, after(true));
    expect(order).toEqual(['upload-url', 'put-video', 'confirm', 'picture', 'cover-url', 'put-picture', 'cover']);
    expect(api.influencerApi.contentUploadUrl).toHaveBeenCalledWith('ci1', { rowKey: 's1', kind: 'video', mime: 'video/mp4', sizeBytes: 4200000, durationS: 14, purpose: 'content' });
    expect(api.uploadContentFile.mock.calls[0][0]).toBe(videoUpload);
    expect(api.uploadContentFile.mock.calls[0][1]).toBe('file:///cache/reel.mp4');
    expect(makeVideoPicture).toHaveBeenCalledWith('file:///cache/reel.mp4', { maxBytes: 1024 * 1024 });
    expect(api.influencerApi.contentCoverUrl).toHaveBeenCalledWith('ci1', 'f9', 184320);
    expect(api.uploadContentFile).toHaveBeenLastCalledWith(coverUpload, 'file:///cache/thumbnails/thumb-1', { timeoutMs: 30000 });
    expect(api.influencerApi.contentConfirmCover).toHaveBeenCalledWith('ci1', 'f9');
    await waitFor(() => expect(within(r.getByTestId('file-f9')).getByTestId('video-picture').props.source).toEqual({ uri: 'https://r2/f9.cover.jpg' }));
    noRedLine(r);
  });

  it('an older app build (no picture can be made): the video is uploaded as before and nothing more is asked', async () => {
    wire({ picture: null });
    const r = her(empty());
    await waitFor(() => r.getByTestId('row-s1'));
    await add(r, after(false));
    expect(order).toEqual(['upload-url', 'put-video', 'confirm', 'picture']);
    expect(api.influencerApi.contentCoverUrl).not.toHaveBeenCalled();
    expect(within(r.getByTestId('file-f9')).queryByTestId('video-picture')).toBeNull();
    expect(within(r.getByTestId('file-f9')).getByText('play')).toBeTruthy();
    noRedLine(r);
  });

  const breaks = [
    ['INFLX refuses the picture (cover-url)', () => api.influencerApi.contentCoverUrl.mockResolvedValue({ success: false, error: { code: 'FILE_TOO_LARGE_PHOTO', message: 'Photos have to be under 10 MB.' } }), ['upload-url', 'put-video', 'confirm', 'picture']],
    ['the signal is lost asking for it', () => api.influencerApi.contentCoverUrl.mockRejectedValue(new Error('Network request failed')), ['upload-url', 'put-video', 'confirm', 'picture']],
    ['storage refuses the picture (PUT)', () => api.uploadContentFile.mockImplementation((upload) => { order.push(upload === coverUpload ? 'put-picture' : 'put-video'); return upload === coverUpload ? Promise.reject(Object.assign(new Error('UPLOAD_REJECTED'), { code: 'UPLOAD_REJECTED' })) : Promise.resolve({ ok: true }); }), ['upload-url', 'put-video', 'confirm', 'picture', 'cover-url', 'put-picture']],
    ['INFLX does not keep it (cover)', () => api.influencerApi.contentConfirmCover.mockResolvedValue({ success: false, error: { code: 'UPLOAD_MISSING', message: "The upload didn't finish. Try again." } }), ['upload-url', 'put-video', 'confirm', 'picture', 'cover-url', 'put-picture']],
    ['making the picture blows up', () => makeVideoPicture.mockImplementation(() => { order.push('picture'); return Promise.reject(new Error('codec')); }), ['upload-url', 'put-video', 'confirm', 'picture']],
  ];
  it.each(breaks)('a failing picture never surfaces an error — %s', async (_, breakIt, expected) => {
    wire();
    breakIt();
    const r = her(empty());
    await waitFor(() => r.getByTestId('row-s1'));
    await add(r, after(false));
    expect(order).toEqual(expected);
    expect(r.getByTestId('file-f9')).toBeTruthy();                          // the video stays uploaded
    noRedLine(r);
    expect(r.queryByText('Photos have to be under 10 MB.')).toBeNull();
    expect(r.queryByText("The upload didn't finish. Try again.")).toBeNull();
    expect(r.getByTestId('send').props.accessibilityState.disabled).toBe(false);   // and she can send
  });

  it('a photo is unchanged: no picture is made and nothing more is asked', async () => {
    wire({ asset: PHOTO });
    api.influencerApi.contentUploadUrl.mockImplementation(() => { order.push('upload-url'); return Promise.resolve({ success: true, data: { upload: { ...videoUpload, fileId: 'f9' } } }); });
    const r = her(sale({ rows: [row('s1', 'post', 'Instagram post')] }));
    await waitFor(() => r.getByTestId('row-s1'));
    await add(r, sale({ rows: [row('s1', 'post', 'Instagram post', { files: [{ id: 'f9', kind: 'photo', mime: 'image/jpeg' }] })] }));
    expect(makeVideoPicture).not.toHaveBeenCalled();
    expect(api.influencerApi.contentCoverUrl).not.toHaveBeenCalled();
    expect(api.influencerApi.contentUploadUrl).toHaveBeenCalledWith('ci1', expect.objectContaining({ kind: 'photo', mime: 'image/jpeg', purpose: 'content' }));
  });

  it('a video that is NOT uploaded gets no picture, and its own error still shows', async () => {
    wire();
    api.uploadContentFile.mockImplementation(() => { order.push('put-video'); return Promise.reject(Object.assign(new Error('UPLOAD_NETWORK'), { code: 'UPLOAD_NETWORK' })); });
    const r = her(empty());
    await waitFor(() => r.getByTestId('row-s1'));
    api.influencerApi.myContent.mockReturnValue(ok(empty()));
    fireEvent.press(r.getByTestId('add-s1'));
    await waitFor(() => r.getByText("The upload didn't finish. Try again."));
    expect(makeVideoPicture).not.toHaveBeenCalled();
    expect(api.influencerApi.contentCoverUrl).not.toHaveBeenCalled();
  });
});

/* ───────────────────────────── C · her screen (frames C1, C2) */

describe('C4 · an approved post that is not in the shop yet says from which day', () => {
  it('postSub14: late › "In the shop from" (the offer\'s day, else the posting date) › nothing', () => {
    expect(postSub14(post('a', { state: 'approved', goesLiveOn: '2026-10-04' }), '2026-10-24')).toEqual({ sub: 'In the shop from 4 Oct', waiting: true });
    expect(postSub14(post('a', { state: 'approved', goesLiveOn: null }), '2026-10-24')).toEqual({ sub: 'In the shop from 24 Oct', waiting: true });
    expect(postSub14(post('a', { state: 'approved', goesLiveOn: null }), null)).toEqual({ sub: null, waiting: false });
    expect(postSub14(post('a', { state: 'live' }), '2026-10-24')).toEqual({ sub: null, waiting: false });
    expect(postSub14(post('a', { state: 'in_review' }), '2026-10-24')).toEqual({ sub: null, waiting: false });
    expect(postSub14(post('a', { state: 'approved', late: true, approvedAt: D(26), goesLiveOn: '2026-10-28' }), '2026-10-24')).toEqual({ sub: 'Approved 26 Oct · after the posting date', waiting: false });
  });

  it('her screen: under the post\'s code, beside "Approved", in the waiting blue; a live post says nothing', async () => {
    const r = her(sale({ path1: p1of({ approved: 2, posts: [post('p1', { title: 'This is one shoppable post', code: 'P4KGMB', state: 'approved', goesLiveOn: '2026-10-04' }), post('p2', { title: 'This is for BOGI', code: 'JD54B4' })] }) }));
    await waitFor(() => r.getByTestId('path1'));
    const waitingRow = within(within(r.getByTestId('path1')).getByTestId('post-p1'));
    const line = waitingRow.getByText('In the shop from 4 Oct');
    expect(flat(line).color).toBe(T.state.waiting.fg);
    expect(waitingRow.getByText('Approved')).toBeTruthy();
    expect(within(within(r.getByTestId('path1')).getByTestId('post-p2')).queryByText(/In the shop from/)).toBeNull();
    expect(within(within(r.getByTestId('path1')).getByTestId('post-p2')).getByText('Live')).toBeTruthy();
  });

  it('her screen: a late one keeps "Approved … after the posting date", in the plain grey', async () => {
    const r = her(sale({ path1: p1of({ late: 1, posts: [post('p1', { state: 'approved', late: true, approvedAt: D(26), goesLiveOn: '2026-10-28' })] }) }));
    await waitFor(() => r.getByTestId('path1'));
    const late = within(r.getByTestId('path1')).getByText('Approved 26 Oct · after the posting date');
    expect(flat(late).color).toBe(T.ink2);
    expect(within(r.getByTestId('path1')).queryByText(/In the shop from/)).toBeNull();
    expect(within(r.getByTestId('path1')).getByText('Late')).toBeTruthy();
  });

  it('the list of posts she can still add carries no such line', async () => {
    const r = her(sale({ path1: p1of({ posts: [post('p1', { state: 'approved', goesLiveOn: '2026-10-04' })] }) }));
    await waitFor(() => r.getByTestId('sharable-p1'));
    expect(within(r.getByTestId('sharable-p1')).queryByText(/In the shop from/)).toBeNull();
  });

  it('the brand\'s screen says it as it did — now in the same blue', async () => {
    const r = brand(sale({ path1: p1of({ posts: [post('p1', { state: 'approved', goesLiveOn: null })] }) }));
    await waitFor(() => r.getByTestId('path1'));
    const line = within(r.getByTestId('path1')).getByText('In the shop from 24 Oct');
    expect(flat(line).color).toBe(T.state.waiting.fg);
  });
});

describe('C7 · a row\'s chip says what it has: "1 file", "2 files", "No file yet"', () => {
  const pic = (id) => ({ id, kind: 'photo', mime: 'image/jpeg' });
  const rows = () => [
    row('s1', 'reel', 'Instagram reel', { files: [pic('a')] }),
    row('s2', 'post', 'Instagram post', { files: [pic('b'), pic('c')] }),
    row('s3', 'youtube_short', 'YouTube Short'),
  ];

  it('the words', () => {
    expect(C14.files(0)).toBe('No file yet');
    expect(C14.files(1)).toBe('1 file');
    expect(C14.files(2)).toBe('2 files');
  });

  it('while she is editing: green with a file, grey without — never "1 of 1" / "0 of 1"', async () => {
    const r = her(sale({ rows: rows() }));
    await waitFor(() => r.getByTestId('row-s1'));
    const one = within(r.getByTestId('row-s1'));
    expect(one.getByText('1 file')).toBeTruthy();
    expect(flat(one.getByTestId('count-met')).backgroundColor).toBe(T.state.active.bg);
    expect(within(r.getByTestId('row-s2')).getByText('2 files')).toBeTruthy();
    const none = within(r.getByTestId('row-s3'));
    expect(none.getByText('No file yet')).toBeTruthy();
    expect(flat(none.getByTestId('count-short')).backgroundColor).toBe(T.state.ended.bg);
    expect(r.queryByText('1 of 1')).toBeNull();
    expect(r.queryByText('0 of 1')).toBeNull();
    expect(r.queryByText('2 of 1')).toBeNull();
  });

  it('the same wording while the brand reviews it', async () => {
    const r = her(sale({ stage: 'in_review', rows: rows().slice(0, 2), can: {}, rounds: [{ no: 1, submittedAt: D(3), verdict: null, rows: [], notes: [] }], round: { current: 1, allowed: 2, isLast: false, used: false, stamped: true } }));
    await waitFor(() => r.getByTestId('path2-in-review'));
    expect(within(r.getByTestId('path2-in-review')).getByText('1 file')).toBeTruthy();
    expect(within(r.getByTestId('path2-in-review')).getByText('2 files')).toBeTruthy();
    expect(r.queryByText('1 of 1')).toBeNull();
  });

  it('after approval the chip on a link / screenshot row is a different thing, and is left as it was', async () => {
    const r = her(sale({ stage: 'approved', approvedAt: D(3), can: { markPosted: false, addOutside: true },
      rows: [row('s1', 'reel', 'Instagram reel', { proofs: [{ slot: 1, url: 'https://www.instagram.com/reel/x', filled: true }] }), row('s2', 'story', 'Instagram story'), row('o1', 'reel', 'Instagram reel', { outside: true })],
      proofsLeft: [{ rowKey: 's2', slot: 1, isStory: true }] }));
    await waitFor(() => r.getByTestId('path2-approved'));
    expect(within(r.getByTestId('proof-row-s1')).getByText('1 of 1')).toBeTruthy();
    expect(within(r.getByTestId('proof-row-s2')).getByText('0 of 1')).toBeTruthy();
    expect(within(r.getByTestId('outside-o1')).getByText('0 of 1')).toBeTruthy();
    expect(r.queryByText('No file yet')).toBeNull();
    expect(r.queryByText('1 file')).toBeNull();
  });
});

describe('C6 · the approved posts under her rows have a heading: "Share another post, or another place"', () => {
  const two = p1of({ approved: 2, posts: [post('p1'), post('p2', { title: 'This is for BOGI', code: 'JD54B4' })] });

  it('with rows above it, the heading sits between the last row and the list', async () => {
    const r = her(sale({ path1: two, rows: [row('s1', 'reel', 'Instagram reel')] }));
    await waitFor(() => r.getByTestId('row-s1'));
    const head = r.getByTestId('share-another');
    expect(head.props.children).toBe('Share another post, or another place');
    expect(flat(head).fontFamily).toBe(fonts.sansBold);
    const ids = [];
    const walk = (n) => { if (!n || typeof n !== 'object') return; if (Array.isArray(n)) { n.forEach(walk); return; } if (n.props && n.props.testID) ids.push(n.props.testID); walk(n.children); };
    walk(r.toJSON());
    const at = (id) => ids.indexOf(id);
    expect(at('row-s1')).toBeGreaterThan(-1);
    expect(at('share-another')).toBeGreaterThan(at('row-s1'));
    expect(at('sharable-p1')).toBeGreaterThan(at('share-another'));
    expect(at('sharable-p2')).toBeGreaterThan(at('sharable-p1'));
  });

  it('no heading when the list does not show: she may not add rows, or no post can be shared', async () => {
    const locked = her(sale({ path1: two, rows: [row('s1', 'reel', 'Instagram reel')], can: { addRows: false, removeRow: true, upload: true } }));
    await waitFor(() => locked.getByTestId('row-s1'));
    expect(locked.queryByTestId('share-another')).toBeNull();
    expect(locked.queryByTestId('sharable-p1')).toBeNull();
    const none = her(sale({ path1: p1of({ posts: [post('p1', { sharable: false })] }), rows: [row('s1', 'reel', 'Instagram reel')] }));
    await waitFor(() => none.getByTestId('row-s1'));
    expect(none.queryByTestId('share-another')).toBeNull();
  });

  it('with no row yet the list is the first thing, not "another": no heading, the list as it was', async () => {
    const r = her(sale({ path1: two, rows: [] }));
    await waitFor(() => r.getByTestId('sharable-p1'));
    expect(r.queryByTestId('share-another')).toBeNull();
    expect(r.getByText('Only posts INFLX has approved appear here.')).toBeTruthy();
  });

  it('the "+" still opens the place sheet', async () => {
    const r = her(sale({ path1: two, rows: [row('s1', 'reel', 'Instagram reel')] }));
    await waitFor(() => r.getByTestId('share-another'));
    fireEvent.press(r.getByTestId('add-place-p2'));
    await waitFor(() => r.getByTestId('destination-sheet'));
  });
});

describe('C5 · "Send to …" is one centred line however long the brand\'s name is', () => {
  it('one line, cut at the end with "…"; the label is the whole sentence', async () => {
    const r = her(sale({ brand: { name: LONG_BRAND }, rows: [row('s1', 'reel', 'Instagram reel', { files: [{ id: 'a', kind: 'photo', mime: 'image/jpeg' }] })], can: { addRows: true, removeRow: true, upload: true, submit: true } }));
    await waitFor(() => r.getByTestId('send'));
    const label = within(r.getByTestId('send')).getByText(`Send to ${LONG_BRAND}`);
    expect(label.props.numberOfLines).toBe(1);
    expect(label.props.ellipsizeMode).toBe('tail');
    expect(flat(label).textAlign).toBe('center');
    expect(flat(r.getByTestId('send')).paddingHorizontal).toBe(16);
  });

  it('"Send again" (after changes) is the same button', async () => {
    const r = her(sale({ stage: 'changes', rows: [row('s1', 'reel', 'Instagram reel', { files: [{ id: 'a', kind: 'photo', mime: 'image/jpeg' }] })],
      rounds: [{ no: 1, submittedAt: D(3), verdict: 'changes', verdictAt: D(4), reason: 'Too dark.', rows: [], notes: [] }], round: { current: 2, allowed: 2, isLast: true, used: false, stamped: true },
      can: { addRows: true, removeRow: true, upload: true, submit: true } }));
    await waitFor(() => r.getByTestId('send'));
    expect(within(r.getByTestId('send')).getByText('Send again').props.numberOfLines).toBe(1);
  });
});

describe('C7 · a grey Send says which row still needs its file', () => {
  const pic = (id) => ({ id, kind: 'photo', mime: 'image/jpeg' });
  const off = (r) => r.getByTestId('send').props.accessibilityState.disabled;
  const why = (r) => r.getByTestId('send-why').props.children;
  const open = async (c) => { const r = her(c); await waitFor(() => r.getByTestId('sale-actions')); return r; };

  it('the words', () => {
    expect(C14.addVideoToSend('This is one shoppable post · YouTube Short')).toBe('Add the video for "This is one shoppable post · YouTube Short" to send.');
    expect(C14.addFileToSend('Festive Sarees · Instagram post')).toBe('Add the file for "Festive Sarees · Instagram post" to send.');
  });

  it.each([
    ['reel', 'Instagram reel'], ['youtube_video', 'YouTube video'], ['youtube_short', 'YouTube Short'],
  ])('a row that is a video (%s): "Add the video for …"', async (type, label) => {
    const r = await open(sale({ rows: [row('s1', type, label)] }));
    expect(off(r)).toBe(true);
    expect(why(r)).toBe(`Add the video for "Festive Sarees · ${label}" to send.`);
    expect(flat(r.getByTestId('send-why')).color).toBe(T.state.yourMove.fg);
    expect(r.queryByTestId('send-hint')).toBeNull();
  });

  it.each([
    ['post', 'Instagram post'], ['story', 'Instagram story'], ['facebook_post', 'Facebook post'],
  ])('any other row (%s): "Add the file for …"', async (type, label) => {
    const r = await open(sale({ rows: [row('s1', type, label)] }));
    expect(why(r)).toBe(`Add the file for "Festive Sarees · ${label}" to send.`);
  });

  it('it names the FIRST row without a file, by the row\'s own title', async () => {
    const r = await open(sale({ rows: [
      row('s1', 'reel', 'Instagram reel', { files: [pic('a')] }),
      row('s2', 'post', 'Instagram post', { postId: 'p2', post: { id: 'p2', title: 'This is for BOGI', code: 'JD54B4' } }),
      row('s3', 'youtube_short', 'YouTube Short'),
    ] }));
    expect(why(r)).toBe('Add the file for "This is for BOGI · Instagram post" to send.');
  });

  it('no rows at all: the line that was always there stays, and no reason line', async () => {
    const r = await open(sale({ rows: [] }));
    expect(off(r)).toBe(true);
    expect(r.queryByTestId('send-why')).toBeNull();
    expect(r.getByTestId('send-hint').props.children).toBe('Pick an approved post and where you will share it.');
  });

  it('the button is on: no such line', async () => {
    const r = await open(sale({ rows: [row('s1', 'reel', 'Instagram reel', { files: [pic('a')] })], can: { addRows: true, removeRow: true, upload: true, submit: true } }));
    expect(off(r)).toBe(false);
    expect(r.queryByTestId('send-why')).toBeNull();
    expect(r.queryByText(/to send\.$/)).toBeNull();
    expect(r.getByTestId('send-hint').props.children).toBe('');
  });

  it('grey for another reason (every row has its file, INFLX still says no): no row is blamed', async () => {
    const r = await open(sale({ rows: [row('s1', 'reel', 'Instagram reel', { files: [pic('a')] })], can: { addRows: true, removeRow: true, upload: true, submit: false } }));
    expect(off(r)).toBe(true);
    expect(r.queryByTestId('send-why')).toBeNull();
  });

  it('after changes were asked for: the reason wins over "Round 2 is the last."; with every file in, that line is back', async () => {
    const changes = (files, submit) => sale({ stage: 'changes', rows: [row('s1', 'reel', 'Instagram reel', { files })],
      rounds: [{ no: 1, submittedAt: D(3), verdict: 'changes', verdictAt: D(4), reason: 'Too dark.', rows: [], notes: [] }], round: { current: 2, allowed: 2, isLast: true, used: false, stamped: true },
      can: { addRows: true, removeRow: true, upload: true, submit } });
    const missing = await open(changes([], false));
    expect(why(missing)).toBe('Add the video for "Festive Sarees · Instagram reel" to send.');
    expect(missing.queryByText('Round 2 is the last.')).toBeNull();
    const full = await open(changes([pic('a')], true));
    expect(full.queryByTestId('send-why')).toBeNull();
    expect(full.getByTestId('send-hint').props.children).toBe('Round 2 is the last.');
  });

  it('a row whose file is on its way up is not asked for again', async () => {
    launchImageLibrary.mockResolvedValue({ assets: [{ uri: 'file:///cache/look.jpg', type: 'image/jpeg', fileSize: 2048 }] });
    api.influencerApi.contentUploadUrl.mockReturnValue(new Promise(() => {}));     // still asking
    const r = await open(sale({ rows: [row('s1', 'post', 'Instagram post')] }));
    expect(why(r)).toBe('Add the file for "Festive Sarees · Instagram post" to send.');
    fireEvent.press(r.getByTestId('add-s1'));
    await waitFor(() => r.getByTestId('file-uploading'));
    expect(off(r)).toBe(true);                                               // still grey — the file is not there yet
    expect(r.queryByTestId('send-why')).toBeNull();                          // but she has done her part
  });
});

/* ───────────────────────────── D · the viewer's title (frame B2) */

describe('B4 · the viewer is handed the post and the place', () => {
  const pic = (id) => ({ id, kind: 'photo', mime: 'image/jpeg' });

  it('her screen: the post, then "place · n of m"', async () => {
    const r = her(sale({ rows: [row('s1', 'post', 'Instagram post', { files: [pic('a'), pic('b')] })] }));
    await waitFor(() => r.getByTestId('row-s1'));
    fireEvent.press(r.getByTestId('file-b'));
    await waitFor(() => r.getByTestId('viewer-photo'));
    expect(r.getByTestId('viewer-title').props.children).toBe('Festive Sarees');
    expect(r.getByTestId('viewer-which').props.children).toBe('Instagram post · 2 of 2');
    expect(r.getByTestId('viewer-title').props.ellipsizeMode).toBe('tail');
  });

  it('the brand\'s screen: "title · CODE", then "place · n of m" — a post without a code yet is its title alone', async () => {
    const reviewing = (p) => sale({ stage: 'in_review', rows: [row('s1', 'reel', 'Instagram reel', { post: p, files: [pic('a')] })], can: { approve: true, askChanges: true },
      rounds: [{ no: 1, submittedAt: D(3), verdict: null, rows: [], notes: [] }], round: { current: 1, allowed: 2, isLast: false, used: false, stamped: true } });
    const r = brand(reviewing({ id: 'p1', title: 'This good offer', code: 'SHNCZW' }));
    await waitFor(() => r.getByTestId('review'));
    expect(r.getByText('This good offer · SHNCZW · Instagram reel')).toBeTruthy();    // the row's own label is unchanged
    fireEvent.press(r.getByTestId('file-a'));
    await waitFor(() => r.getByTestId('viewer-photo'));
    expect(r.getByTestId('viewer-title').props.children).toBe('This good offer · SHNCZW');
    expect(r.getByTestId('viewer-which').props.children).toBe('Instagram reel · 1 of 1');
    const n = brand(reviewing({ id: 'p1', title: 'This good offer', code: null }));
    await waitFor(() => n.getByTestId('review'));
    fireEvent.press(n.getByTestId('file-a'));
    await waitFor(() => n.getByTestId('viewer-photo'));
    expect(n.getByTestId('viewer-title').props.children).toBe('This good offer');
  });
});
