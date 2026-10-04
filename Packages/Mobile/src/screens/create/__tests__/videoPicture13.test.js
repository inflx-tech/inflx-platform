/**
 * shopper-walk-fixes (W15 · frame C3) — the post maker: a video she adds gets a picture taken from
 * it; the picture rides on its slide in every save; her tiles and post rows show it.
 * Contract: features/shopper-walk-fixes · spec C2 · BUILD_API.md §2 ("A shoppable post's video")
 *
 * The compressor is absent in jest, so both of its jobs (making a video smaller, taking a picture
 * from it) are stood in for here; the picture-maker itself is tested with and without the
 * compressor in utils/__tests__/videoPicture.test.js.
 */
import React from 'react';
import { StyleSheet, Image } from 'react-native';
import { render, fireEvent, waitFor, within, act } from '@testing-library/react-native';

jest.mock('../../../services/api', () => ({
  influencerApi: {
    createHome: jest.fn(), myShoppablePosts: jest.fn(), createPost: jest.fn(), getPost: jest.fn(), postOptions: jest.fn(),
    updatePost: jest.fn(), postUploadUrl: jest.fn(), submitPost: jest.fn(),
  },
  uploadContentFile: jest.fn(), brandApi: {}, referenceApi: {}, clearSession: jest.fn(), uploadFile: jest.fn(),
}));
jest.mock('../../../../App', () => ({ AuthContext: require('react').createContext({ setRole: () => {} }) }));
jest.mock('@react-navigation/native', () => ({ useFocusEffect: (cb) => { const R = require('react'); R.useEffect(() => cb(), [cb]); } }));
jest.mock('react-native-image-picker', () => ({ launchImageLibrary: jest.fn() }));
jest.mock('../../../utils/videoPrep', () => ({ prepareVideo: jest.fn(), makeVideoPicture: jest.fn() }));

const { influencerApi, uploadContentFile } = require('../../../services/api');
const { launchImageLibrary } = require('react-native-image-picker');
const { prepareVideo, makeVideoPicture } = require('../../../utils/videoPrep');
const { _setPlayerForTests } = require('../../../utils/videoPlayer');
const { settingsTokens: T } = require('../../../theme/tokens');
const PostMedia = require('../PostMediaScreen').default;
const { slideBody, isVideoSlide, uploadVideoPicture } = require('../PostMediaScreen');
const PostReview = require('../PostReviewScreen').default;
const CreateHome = require('../CreateHomeScreen').default;
const { PostCover } = require('../CreateHomeScreen');
const MyPosts = require('../MyPostsScreen').default;

const nav = () => ({ goBack: jest.fn(), navigate: jest.fn(), replace: jest.fn(), setParams: jest.fn(), addListener: jest.fn(() => () => {}), dispatch: jest.fn() });
const ok = (data) => ({ success: true, data });
const yr = new Date().getFullYear();
const flat = (el) => StyleSheet.flatten(el.props.style) || {};
const settle = () => act(async () => { for (let i = 0; i < 25; i += 1) await Promise.resolve(); });   // eslint-disable-line no-await-in-loop

const COLLAB = { id: 'ci1', brand_id: 'b1', brand_name: 'Urban Threads', brand_logo: null, campaign_name: 'Diwali Denim', set_name: 'Set A', posting_date: `${yr}-10-10` };
const POST = (over = {}) => ({
  id: 'p1', state: 'draft', status: 'draft', title: 'Weekend denim', caption: null, collaboration: COLLAB, kind: 'offer', offer_id: 'o1',
  offer: { type: 'Bundle', deal: 'Any 2 for ₹2,999', name: 'Any 2 Jeans for ₹2,999', ends_on: `${yr}-11-10` },
  products: [], theme_tags: [], media_kind: 'video', media_layout: 'carousel', tag_style: 'soft_editorial', media: [],
  facets: { category: ['Men › Bottomwear › Jeans'], offer: 'Bundle · Any 2 for ₹2,999', price_band: 'Under ₹2,999', top_price: 2499, theme: 'Winter' },
  draft_step: 7, draft_state: {}, sent_back: null, removed: null, sales: { orders: 0, commission: 0 }, sales_words: 'No sales yet',
  can: { edit: true, fix: false, send: true, delete: true, take_down: false }, updated_at: `${yr}-10-01T10:00:00Z`, ...over,
});
const V_KEY = 'posts/i/p1/v.mp4';
const C_KEY = 'posts/i/p1/c.jpg';
/** A video slide as the server sends it back — with the picture taken from it, or (an older one) without. */
const saved = (cover) => ({ id: 'm1', slide_index: 0, r2_key: V_KEY, mime: 'video/mp4', width: 720, height: 1280, size_bytes: 7600000, duration_s: 10,
  url: 'https://api/v1/media/post/m1', cover_r2_key: cover ? C_KEY : null, cover_url: cover ? 'https://api/v1/media/post/m1/cover' : null });
const photoSlide = { id: 'm2', slide_index: 0, r2_key: 'posts/i/p1/a.jpg', mime: 'image/jpeg', width: 1080, height: 1350, size_bytes: 2048, duration_s: null, url: 'https://api/v1/media/post/m2', cover_r2_key: null, cover_url: null };

const ASSET = { uri: 'file:///cache/picked.mp4', type: 'video/mp4', fileSize: 48000000, duration: 10, width: 1080, height: 1920, fileName: 'picked.mp4' };
const videoPut = { key: V_KEY, url: 'https://r2/put-v', method: 'PUT', headers: { 'Content-Type': 'video/mp4' } };
const coverPut = { key: C_KEY, url: 'https://r2/put-c', method: 'PUT', headers: { 'Content-Type': 'image/jpeg' } };
let order;

/** Everything answers well; each test then breaks one thing. */
function wire() {
  order = [];
  launchImageLibrary.mockResolvedValue({ assets: [ASSET] });
  prepareVideo.mockResolvedValue({ uri: 'file:///cache/small.mp4', size: 7600000, mime: 'video/mp4', shrunk: true });
  makeVideoPicture.mockImplementation(() => { order.push('picture'); return Promise.resolve({ uri: 'file:///cache/thumbnails/thumb-1', size: 96000, mime: 'image/jpeg' }); });
  influencerApi.postUploadUrl.mockImplementation((id, body) => {
    const image = body.content_type === 'image/jpeg';
    order.push(image ? 'upload-url picture' : 'upload-url video');
    return Promise.resolve(ok(image ? coverPut : videoPut));
  });
  uploadContentFile.mockImplementation((upload) => { order.push(upload === coverPut ? 'put picture' : 'put video'); return Promise.resolve({ ok: true }); });
}
const lastSave = () => influencerApi.updatePost.mock.calls[influencerApi.updatePost.mock.calls.length - 1][1];

let errors;
beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();                               // a touchable's press animation stays inside act()
  _setPlayerForTests(null);                           // jest has no native player
  influencerApi.getPost.mockResolvedValue(ok({ post: POST() }));
  influencerApi.updatePost.mockImplementation((id, body) => Promise.resolve(ok({ post: POST(body) })));
  makeVideoPicture.mockResolvedValue(null);
  errors = jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  const said = errors.mock.calls.map((args) => args.map(String).join(' ').split('\n')[0]);
  errors.mockRestore(); _setPlayerForTests(undefined);
  jest.useRealTimers();
  expect(said).toEqual([]);
});

async function openMedia(route = { params: { postId: 'p1' } }) {
  const n = nav();
  const r = render(<PostMedia navigation={n} route={route} />);
  await waitFor(() => r.getByTestId('add-media'));
  return { r, n };
}

describe('C3 · she adds a video in "Photos or video"', () => {
  it('the video is uploaded as before; THEN a picture is taken from the uploaded file and sent through the post\'s own upload-url call as a JPEG', async () => {
    wire();
    const { r } = await openMedia();
    fireEvent.press(r.getByTestId('add-media'));
    await waitFor(() => r.getByTestId('slide-0'));
    expect(order).toEqual(['upload-url video', 'put video', 'picture', 'upload-url picture', 'put picture']);
    expect(influencerApi.postUploadUrl).toHaveBeenNthCalledWith(1, 'p1', { content_type: 'video/mp4', size_bytes: 7600000, filename: 'picked.mp4' });
    expect(makeVideoPicture).toHaveBeenCalledWith('file:///cache/small.mp4', { maxBytes: 2 * 1024 * 1024 });   // the file that went up; the server's 2 MB
    expect(influencerApi.postUploadUrl).toHaveBeenNthCalledWith(2, 'p1', { content_type: 'image/jpeg', size_bytes: 96000 });
    expect(uploadContentFile).toHaveBeenNthCalledWith(1, videoPut, 'file:///cache/small.mp4');
    expect(uploadContentFile).toHaveBeenNthCalledWith(2, coverPut, 'file:///cache/thumbnails/thumb-1', { timeoutMs: 30000 });   // never the video's 45 minutes
    expect(r.queryByTestId('step-error')).toBeNull();
  });

  it('the tile shows the picture (her phone\'s own copy), a play mark and the video\'s length — it was an empty tile', async () => {
    wire();
    const { r } = await openMedia();
    fireEvent.press(r.getByTestId('add-media'));
    const tile = await waitFor(() => r.getByTestId('slide-0'));
    expect(within(tile).getByTestId('video-picture').props.source).toEqual({ uri: 'file:///cache/thumbnails/thumb-1' });
    expect(within(tile).getByText('play')).toBeTruthy();
    expect(within(tile).getByText('0:10')).toBeTruthy();
    expect(within(tile).getByText('1')).toBeTruthy();                       // its place in the carousel, as before
    expect(within(tile).getByTestId('remove-0')).toBeTruthy();
    // Nothing on the tile is an <Image> pointed at the video itself.
    const drawn = within(tile).UNSAFE_getAllByType(Image).map((i) => i.props.source.uri);
    expect(drawn).toEqual(['file:///cache/thumbnails/thumb-1']);
  });

  it('Next saves the slide WITH its picture\'s key', async () => {
    wire();
    const { r, n } = await openMedia();
    fireEvent.press(r.getByTestId('add-media'));
    await waitFor(() => r.getByTestId('slide-0'));
    fireEvent.press(r.getByTestId('next'));
    await waitFor(() => expect(n.navigate).toHaveBeenCalledWith('PostReview', { postId: 'p1' }));
    expect(lastSave()).toEqual({
      media_kind: 'video', media_layout: 'carousel', tag_style: 'soft_editorial',
      media: [{ r2_key: V_KEY, mime: 'video/mp4', width: 1080, height: 1920, duration_s: 10, cover_r2_key: C_KEY }], draft_step: 8,
    });
  });

  const breaks = [
    ['an older app build — no picture can be made', () => makeVideoPicture.mockImplementation(() => { order.push('picture'); return Promise.resolve(null); }), ['upload-url video', 'put video', 'picture']],
    ['INFLX refuses the picture\'s upload', () => influencerApi.postUploadUrl.mockImplementation((id, body) => { const image = body.content_type === 'image/jpeg'; order.push(image ? 'upload-url picture' : 'upload-url video'); return Promise.resolve(image ? { success: false, error: { message: "That file can't be more than 10 MB." } } : ok(videoPut)); }), ['upload-url video', 'put video', 'picture', 'upload-url picture']],
    ['storage refuses the picture', () => uploadContentFile.mockImplementation((upload) => { order.push(upload === coverPut ? 'put picture' : 'put video'); return upload === coverPut ? Promise.reject(Object.assign(new Error('UPLOAD_REJECTED'), { code: 'UPLOAD_REJECTED' })) : Promise.resolve({ ok: true }); }), ['upload-url video', 'put video', 'picture', 'upload-url picture', 'put picture']],
    ['making the picture blows up', () => makeVideoPicture.mockImplementation(() => { order.push('picture'); return Promise.reject(new Error('codec')); }), ['upload-url video', 'put video', 'picture']],
  ];
  it.each(breaks)('a failed picture never blocks adding the video — %s', async (_, breakIt, expected) => {
    wire();
    breakIt();
    const { r, n } = await openMedia();
    fireEvent.press(r.getByTestId('add-media'));
    const tile = await waitFor(() => r.getByTestId('slide-0'));
    expect(order).toEqual(expected);
    expect(r.queryByTestId('step-error')).toBeNull();                       // no error line
    expect(r.queryByText("A file didn't upload. Try again.")).toBeNull();
    expect(r.queryByText("That file can't be more than 10 MB.")).toBeNull();
    // The video is there, with the dark tile and the play mark; and it saves without a picture's key.
    expect(within(tile).queryByTestId('video-picture')).toBeNull();
    expect(flat(within(tile).getByTestId('video-face')).backgroundColor).toBe(T.ink);
    expect(within(tile).getByText('play')).toBeTruthy();
    expect(within(tile).getByText('0:10')).toBeTruthy();
    fireEvent.press(r.getByTestId('next'));
    await waitFor(() => expect(n.navigate).toHaveBeenCalledWith('PostReview', { postId: 'p1' }));
    expect(lastSave().media).toEqual([{ r2_key: V_KEY, mime: 'video/mp4', width: 1080, height: 1920, duration_s: 10 }]);
    expect('cover_r2_key' in lastSave().media[0]).toBe(false);              // a key INFLX would refuse is never sent
  });

  it('a video that does NOT upload still says so, and no picture is made for it', async () => {
    wire();
    uploadContentFile.mockRejectedValue(new Error("A file didn't upload. Try again."));
    const { r } = await openMedia();
    fireEvent.press(r.getByTestId('add-media'));
    await waitFor(() => r.getByTestId('step-error'));
    expect(makeVideoPicture).not.toHaveBeenCalled();
    expect(r.queryByTestId('slide-0')).toBeNull();
  });

  it('a photo is unchanged: no picture is made, and its slide is saved exactly as before', async () => {
    wire();
    influencerApi.getPost.mockResolvedValue(ok({ post: POST({ media_kind: 'image' }) }));
    launchImageLibrary.mockResolvedValue({ assets: [{ uri: 'file:///a.jpg', type: 'image/jpeg', fileSize: 2048, width: 1080, height: 1350 }] });
    influencerApi.postUploadUrl.mockResolvedValue(ok({ key: 'posts/i/p1/a.jpg', url: 'https://r2/put', method: 'PUT', headers: { 'Content-Type': 'image/jpeg' } }));
    const { r, n } = await openMedia();
    fireEvent.press(r.getByTestId('add-media'));
    const tile = await waitFor(() => r.getByTestId('slide-0'));
    expect(makeVideoPicture).not.toHaveBeenCalled();
    expect(prepareVideo).not.toHaveBeenCalled();
    expect(influencerApi.postUploadUrl).toHaveBeenCalledTimes(1);
    expect(within(tile).queryByTestId('video-face')).toBeNull();
    expect(within(tile).UNSAFE_getAllByType(Image).map((i) => i.props.source.uri)).toEqual(['file:///a.jpg']);
    fireEvent.press(r.getByTestId('next'));
    await waitFor(() => expect(n.navigate).toHaveBeenCalledWith('PostReview', { postId: 'p1' }));
    expect(lastSave().media).toEqual([{ r2_key: 'posts/i/p1/a.jpg', mime: 'image/jpeg', width: 1080, height: 1350, duration_s: null }]);
    expect('cover_r2_key' in lastSave().media[0]).toBe(false);
  });
});

describe('the picture\'s key rides on its slide in EVERY later save (the server replaces the list whole)', () => {
  it('a saved video opened again: the tile shows INFLX\'s copy of the picture, and saving sends the key again', async () => {
    influencerApi.getPost.mockResolvedValue(ok({ post: POST({ media: [saved(true)] }) }));
    const { r, n } = await openMedia();
    const tile = await waitFor(() => r.getByTestId('slide-0'));
    expect(within(tile).getByTestId('video-picture').props.source).toEqual({ uri: 'https://api/v1/media/post/m1/cover' });
    expect(within(tile).getByText('0:10')).toBeTruthy();
    fireEvent.press(r.getByTestId('next'));
    await waitFor(() => expect(n.navigate).toHaveBeenCalled());
    expect(lastSave().media).toEqual([{ r2_key: V_KEY, mime: 'video/mp4', width: 720, height: 1280, duration_s: 10, cover_r2_key: C_KEY }]);
  });

  it('fixing a sent-back post: adding a second clip keeps the first one\'s picture and carries the new one\'s', async () => {
    wire();
    influencerApi.getPost.mockResolvedValue(ok({ post: POST({ status: 'rejected', state: 'sent_back', media: [saved(true)] }) }));
    influencerApi.postUploadUrl.mockImplementation((id, body) => Promise.resolve(ok(body.content_type === 'image/jpeg'
      ? { ...coverPut, key: 'posts/i/p1/c2.jpg' } : { ...videoPut, key: 'posts/i/p1/v2.mp4' })));
    const { r, n } = await openMedia({ params: { postId: 'p1', fix: true } });
    await waitFor(() => r.getByTestId('slide-0'));
    fireEvent.press(r.getByTestId('add-media'));
    await waitFor(() => r.getByTestId('slide-1'));
    fireEvent.press(r.getByTestId('next'));
    await waitFor(() => expect(n.goBack).toHaveBeenCalled());
    expect(lastSave()).toEqual({ media_kind: 'video', media_layout: 'carousel', tag_style: 'soft_editorial', media: [
      { r2_key: V_KEY, mime: 'video/mp4', width: 720, height: 1280, duration_s: 10, cover_r2_key: C_KEY },
      { r2_key: 'posts/i/p1/v2.mp4', mime: 'video/mp4', width: 1080, height: 1920, duration_s: 10, cover_r2_key: 'posts/i/p1/c2.jpg' },
    ] });
  });

  it('a video saved before 4 Oct (no picture): the dark tile, and it is saved as before — no key is made up', async () => {
    influencerApi.getPost.mockResolvedValue(ok({ post: POST({ media: [saved(false)] }) }));
    const { r, n } = await openMedia();
    const tile = await waitFor(() => r.getByTestId('slide-0'));
    expect(within(tile).queryByTestId('video-picture')).toBeNull();
    expect(within(tile).getByText('play')).toBeTruthy();
    fireEvent.press(r.getByTestId('next'));
    await waitFor(() => expect(n.navigate).toHaveBeenCalled());
    expect(lastSave().media).toEqual([{ r2_key: V_KEY, mime: 'video/mp4', width: 720, height: 1280, duration_s: 10 }]);
    expect('cover_r2_key' in lastSave().media[0]).toBe(false);
  });

  it('slideBody, isVideoSlide', () => {
    expect(slideBody({ r2_key: 'k', mime: 'video/mp4', width: 1, height: 2, duration_s: 3, cover_r2_key: 'c', cover_local: 'file:///x', local: 'file:///v', url: 'u' }))
      .toEqual({ r2_key: 'k', mime: 'video/mp4', width: 1, height: 2, duration_s: 3, cover_r2_key: 'c' });
    expect(Object.keys(slideBody({ r2_key: 'k', mime: 'image/jpeg', width: 1, height: 2, duration_s: null, cover_r2_key: null }))).toEqual(['r2_key', 'mime', 'width', 'height', 'duration_s']);
    expect(isVideoSlide({ mime: 'video/mp4' })).toBe(true);
    expect(isVideoSlide({ mime: 'image/jpeg' })).toBe(false);
    expect(isVideoSlide(null)).toBe(false);
  });

  it('uploadVideoPicture never throws: an answer that is not an answer is "no picture"', async () => {
    makeVideoPicture.mockResolvedValue({ uri: 'file:///cache/thumb', size: 96000, mime: 'image/jpeg' });
    influencerApi.postUploadUrl.mockResolvedValue(undefined);
    await expect(uploadVideoPicture('p1', 'file:///v.mp4')).resolves.toBeNull();
    influencerApi.postUploadUrl.mockRejectedValue(new Error('Network request failed'));
    await expect(uploadVideoPicture('p1', 'file:///v.mp4')).resolves.toBeNull();
    influencerApi.postUploadUrl.mockResolvedValue(ok(coverPut));
    uploadContentFile.mockResolvedValue({ ok: true });
    await expect(uploadVideoPicture('p1', 'file:///v.mp4')).resolves.toEqual({ key: C_KEY, uri: 'file:///cache/thumb' });
  });
});

describe('C3 · "Tapping it plays it"', () => {
  let given;
  const FakeVideo = React.forwardRef((props, ref) => {
    given = props;
    React.useImperativeHandle(ref, () => ({ setFullScreen: () => {} }));
    const { View } = require('react-native');
    return <View testID={props.testID} />;
  });
  beforeEach(() => { given = null; });

  it('a video she has just added plays from her phone\'s own copy, in the file viewer', async () => {
    wire();
    _setPlayerForTests(FakeVideo);
    const { r } = await openMedia();
    fireEvent.press(r.getByTestId('add-media'));
    await waitFor(() => r.getByTestId('slide-0'));
    expect(r.queryByTestId('media-viewer')).toBeNull();
    fireEvent.press(r.getByTestId('slide-0'));
    await waitFor(() => r.getByTestId('viewer-video'));
    expect(given.source).toEqual({ uri: 'file:///cache/picked.mp4' });
    expect(r.getByTestId('viewer-title').props.children).toBe('Video');
    expect(r.getByTestId('viewer-which').props.children).toBe('1 of 1');
    expect(r.queryByTestId('viewer-actions')).toBeNull();                   // the video and nothing else
    fireEvent.press(r.getByTestId('viewer-close'));
    expect(r.queryByTestId('media-viewer')).toBeNull();
  });

  it('a saved video plays from INFLX\'s address for it; on a build without the player the viewer says so, as everywhere', async () => {
    influencerApi.getPost.mockResolvedValue(ok({ post: POST({ media: [saved(true)] }) }));
    _setPlayerForTests(FakeVideo);
    const { r } = await openMedia();
    fireEvent.press(await waitFor(() => r.getByTestId('slide-0')));
    await waitFor(() => r.getByTestId('viewer-video'));
    expect(given.source).toEqual({ uri: 'https://api/v1/media/post/m1' });
    r.unmount();

    _setPlayerForTests(null);
    const old = await openMedia();
    fireEvent.press(await waitFor(() => old.r.getByTestId('slide-0')));
    await waitFor(() => old.r.getByTestId('viewer-needs-update'));
    expect(old.r.getByText('Update INFLX to play videos')).toBeTruthy();
  });

  it('removing the video (×) does not open it; a photo\'s tap still opens tagging', async () => {
    influencerApi.getPost.mockResolvedValue(ok({ post: POST({ media: [saved(true)] }) }));
    const { r } = await openMedia();
    await waitFor(() => r.getByTestId('slide-0'));
    fireEvent.press(r.getByTestId('remove-0'));
    expect(r.queryByTestId('slide-0')).toBeNull();
    expect(r.queryByTestId('media-viewer')).toBeNull();
    r.unmount();

    influencerApi.getPost.mockResolvedValue(ok({ post: POST({ media_kind: 'image', media: [photoSlide] }) }));
    const p = await openMedia();
    fireEvent.press(await waitFor(() => p.r.getByTestId('slide-0')));
    await waitFor(() => expect(p.n.navigate).toHaveBeenCalledWith('PostTag', { postId: 'p1', index: 0 }));
    expect(p.r.queryByTestId('media-viewer')).toBeNull();
  });
});

describe('C3 · the review step that follows', () => {
  const review = async (media, media_kind = 'video') => {
    influencerApi.getPost.mockResolvedValue(ok({ post: POST({ media, media_kind, draft_step: 8 }) }));
    const r = render(<PostReview navigation={nav()} route={{ params: { postId: 'p1' } }} />);
    await waitFor(() => r.getByTestId('post-review-scroll'));
    return r;
  };

  it('the video shows its picture with a play mark and its length — no bare "▶"', async () => {
    const r = await review([saved(true)]);
    const tile = r.getByTestId('review-slide-0');
    expect(within(tile).getByTestId('video-picture').props.source).toEqual({ uri: 'https://api/v1/media/post/m1/cover' });
    expect(within(tile).getByText('play')).toBeTruthy();
    expect(within(tile).getByText('0:10')).toBeTruthy();
    expect(within(tile).getByText('1')).toBeTruthy();
    expect(r.queryByText('▶')).toBeNull();
  });

  it('a video with no picture: the dark tile with the play mark — still no bare "▶"', async () => {
    const r = await review([saved(false)]);
    const tile = r.getByTestId('review-slide-0');
    expect(within(tile).queryByTestId('video-picture')).toBeNull();
    expect(flat(within(tile).getByTestId('video-face')).backgroundColor).toBe(T.ink);
    expect(within(tile).getByText('play')).toBeTruthy();
    expect(r.queryByText('▶')).toBeNull();
  });

  it('tapping it plays it', async () => {
    let given = null;
    _setPlayerForTests(React.forwardRef((props, ref) => { given = props; React.useImperativeHandle(ref, () => ({ setFullScreen: () => {} })); const { View } = require('react-native'); return <View testID={props.testID} />; }));
    const r = await review([saved(true)]);
    fireEvent.press(r.getByTestId('review-slide-0'));
    await waitFor(() => r.getByTestId('viewer-video'));
    expect(given.source).toEqual({ uri: 'https://api/v1/media/post/m1' });
    expect(r.getByTestId('viewer-title').props.children).toBe('Video');
  });

  it('a photo post is unchanged', async () => {
    const r = await review([photoSlide], 'image');
    expect(r.queryByTestId('review-slide-0')).toBeNull();
    expect(r.queryByTestId('video-face')).toBeNull();
    expect(r.UNSAFE_getAllByType(Image).map((i) => i.props.source.uri)).toEqual(['https://api/v1/media/post/m2']);
  });
});

describe('her post rows show the post\'s own picture (Create tab, Your posts)', () => {
  it('PostCover: a photo post is its first photo; a video the picture taken from it with a play mark; a video without one the dark tile; no slide yet the plain box', () => {
    const photo = render(<PostCover post={POST({ media_kind: 'image', media: [photoSlide] })} />);
    expect(photo.getByTestId('post-picture').props.source).toEqual({ uri: 'https://api/v1/media/post/m2' });
    expect(photo.queryByTestId('play-mark')).toBeNull();

    const video = render(<PostCover post={POST({ media: [saved(true)] })} />);
    expect(video.getByTestId('video-picture').props.source).toEqual({ uri: 'https://api/v1/media/post/m1/cover' });
    expect(within(video.getByTestId('play-mark')).getByText('play')).toBeTruthy();
    expect(video.queryByTestId('duration-badge')).toBeNull();               // a row's small picture carries no length

    const old = render(<PostCover post={POST({ media: [saved(false)] })} />);
    expect(old.queryByTestId('video-picture')).toBeNull();
    expect(flat(old.getByTestId('video-face')).backgroundColor).toBe(T.ink);
    expect(within(old.getByTestId('play-mark')).getByText('play')).toBeTruthy();
    // Never the video's own address drawn as a picture.
    expect(old.UNSAFE_queryAllByType(Image)).toHaveLength(0);

    expect(render(<PostCover post={POST({ media: [] })} />).getByTestId('post-cover-plain')).toBeTruthy();
    expect(render(<PostCover post={POST({ media_kind: 'image', media: [] })} />).getByTestId('post-cover-plain')).toBeTruthy();
    const { media, ...older } = POST();
    expect(render(<PostCover post={older} />).getByTestId('post-cover-plain')).toBeTruthy();   // an older server answer
  });

  it('the Create tab\'s rows', async () => {
    influencerApi.createHome.mockResolvedValue(ok({ needs: [], counts: {}, total: 3, collections: 0, can_post: true, store_link: 'inflx.in/s/priya',
      recent: [
        POST({ id: 'a', state: 'live', status: 'approved', code: 'K7M2F9', media: [saved(true)] }),
        POST({ id: 'b', state: 'live', status: 'approved', code: 'JD54B4', media_kind: 'image', media: [photoSlide] }),
        POST({ id: 'c', state: 'draft', media: [] }),
      ] }));
    const r = render(<CreateHome navigation={nav()} />);
    await waitFor(() => r.getByTestId('create-home'));
    expect(within(r.getByTestId('post-a')).getByTestId('video-picture').props.source).toEqual({ uri: 'https://api/v1/media/post/m1/cover' });
    expect(within(r.getByTestId('post-a')).getByTestId('play-mark')).toBeTruthy();
    expect(within(r.getByTestId('post-b')).getByTestId('post-picture').props.source).toEqual({ uri: 'https://api/v1/media/post/m2' });
    expect(within(r.getByTestId('post-c')).getByTestId('post-cover-plain')).toBeTruthy();
    await settle();
  });

  it('"Your posts" uses the same row', async () => {
    influencerApi.myShoppablePosts.mockResolvedValue(ok({ counts: { live: 2, approved: 0, in_review: 0, sent_back: 0, removed: 0, draft: 0 },
      posts: [POST({ id: 'a', state: 'live', status: 'approved', media: [saved(true)] }), POST({ id: 'd', state: 'live', status: 'approved', media: [saved(false)] })] }));
    const r = render(<MyPosts navigation={nav()} />);
    await waitFor(() => r.getByTestId('my-posts'));
    expect(within(r.getByTestId('post-a')).getByTestId('video-picture')).toBeTruthy();
    expect(within(r.getByTestId('post-d')).queryByTestId('video-picture')).toBeNull();
    expect(within(r.getByTestId('post-d')).getByTestId('play-mark')).toBeTruthy();
  });
});
