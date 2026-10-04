/**
 * follower-app-v2 — the video player (rules v1.7 §4.7, §5.14) and the creator's video shrink.
 * Older app builds show the photo note; the new build plays only while on screen and records
 * watching, finishing, replaying, pausing, sound and every pause to load.
 */
import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import { NativeModules } from 'react-native';

jest.mock('../../../services/events', () => ({ track: jest.fn() }));
const { track } = require('../../../services/events');
const ShopVideo = require('../ShopVideo').default;
const { _setPlayerForTests } = require('../ShopVideo');
const { prepareVideo } = require('../../../utils/videoPrep');

const POST = { id: 'v1', media: [{ id: 'm1', url: 'https://api/v1/media/post/m1' }], products: [{ image_url: 'https://x/p.jpg' }] };

// A stand-in for the native player: a View that keeps the props it was given.
let lastProps = null;
function FakeVideo(props) { lastProps = props; const { View } = require('react-native'); return <View testID="fake-player" />; }

beforeEach(() => { jest.clearAllMocks(); lastProps = null; });

it('an older app build (no player inside): the product photo and "Update INFLX to play videos"', () => {
  _setPlayerForTests(null);
  const { getByText, getByTestId } = render(<ShopVideo post={POST} height={400} />);
  getByTestId('video-placeholder');
  getByText('Update INFLX to play videos');
});

it('the new build: plays only while on screen, muted in the feed, from INFLX storage with a phone cache', () => {
  _setPlayerForTests(FakeVideo);
  const { rerender } = render(<ShopVideo post={POST} height={400} active={false} surface="home" />);
  expect(lastProps.paused).toBe(true);
  expect(lastProps.muted).toBe(true);
  expect(lastProps.source).toEqual({ uri: 'https://api/v1/media/post/m1' });
  expect(lastProps.bufferConfig.cacheSizeMB).toBe(200);
  expect(lastProps.poster).toBe('https://x/p.jpg');
  rerender(<ShopVideo post={POST} height={400} active surface="home" />);
  expect(lastProps.paused).toBe(false);
});

it('records seconds watched when it leaves the screen, finishing, replaying and every pause to load', () => {
  _setPlayerForTests(FakeVideo);
  const now = jest.spyOn(Date, 'now');
  now.mockReturnValue(1000);
  const { rerender } = render(<ShopVideo post={POST} height={400} active surface="play" />);
  act(() => { lastProps.onLoad({ duration: 29.6 }); });
  now.mockReturnValue(2000);
  act(() => { lastProps.onBuffer({ isBuffering: true }); });
  now.mockReturnValue(3200);
  act(() => { lastProps.onBuffer({ isBuffering: false }); });
  expect(track).toHaveBeenCalledWith('buffer', 'v1', 'play', { dwell_ms: 1200 });
  act(() => { lastProps.onEnd(); });
  act(() => { lastProps.onEnd(); });
  expect(track).toHaveBeenCalledWith('complete', 'v1', 'play');
  expect(track).toHaveBeenCalledWith('replay', 'v1', 'play');
  now.mockReturnValue(13000);
  rerender(<ShopVideo post={POST} height={400} active={false} surface="play" />);
  expect(track).toHaveBeenCalledWith('watch', 'v1', 'play', { dwell_ms: 12000, meta: { of_s: 30 } });
  now.mockRestore();
});

// shopper-walk-fixes V1: the pause layer is no longer on every video (in a feed it swallowed the tap
// that opens Play) — Play asks for it with `tapToPause`, so this render now passes it as Play does.
it('in Play: tap to pause (recorded), and the sound button turns sound on and off (recorded)', () => {
  _setPlayerForTests(FakeVideo);
  const onSound = jest.fn();
  const { getByTestId } = render(<ShopVideo post={POST} height={400} active surface="play" muted soundToggle tapToPause onSoundChange={onSound} />);
  fireEvent.press(getByTestId('video-sound-v1'));
  expect(lastProps.muted).toBe(false);
  expect(track).toHaveBeenCalledWith('sound_on', 'v1', 'play');
  expect(onSound).toHaveBeenCalledWith(true);
  fireEvent.press(getByTestId('video-tap-v1'));
  expect(lastProps.paused).toBe(true);
  expect(track).toHaveBeenCalledWith('pause', 'v1', 'play');
});

describe("the creator's video, made smaller before upload", () => {
  const asset = { uri: 'file:///big.mp4', fileSize: 48000000, type: 'video/mp4' };
  afterEach(() => { delete NativeModules.Compressor; jest.resetModules(); });

  it('an older build (no compressor): the original file, as before', async () => {
    delete NativeModules.Compressor;
    expect(await prepareVideo(asset)).toEqual({ uri: 'file:///big.mp4', size: 48000000, mime: 'video/mp4', shrunk: false });
  });

  it('the new build: about 720p at 2 Mbps; the smaller file and its size are uploaded', async () => {
    NativeModules.Compressor = {};
    jest.doMock('react-native-compressor', () => ({
      Video: { compress: jest.fn(() => Promise.resolve('file:///small.mp4')) },
      getFileSize: jest.fn(() => Promise.resolve('7600000')),
    }), { virtual: false });
    const { prepareVideo: prep } = require('../../../utils/videoPrep');
    const out = await prep(asset);
    expect(out).toEqual({ uri: 'file:///small.mp4', size: 7600000, mime: 'video/mp4', shrunk: true });
    expect(require('react-native-compressor').Video.compress).toHaveBeenCalledWith('file:///big.mp4', { compressionMethod: 'manual', maxSize: 1280, bitrate: 2000000 }, undefined);
  });

  it('if shrinking fails, the original is uploaded — never a lost post', async () => {
    NativeModules.Compressor = {};
    jest.doMock('react-native-compressor', () => ({ Video: { compress: jest.fn(() => Promise.reject(new Error('codec'))) }, getFileSize: jest.fn() }));
    const { prepareVideo: prep } = require('../../../utils/videoPrep');
    expect((await prep(asset)).shrunk).toBe(false);
  });
});
