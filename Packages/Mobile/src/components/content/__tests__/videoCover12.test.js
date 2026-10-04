/**
 * shopper-walk-fixes (W15 · frames B1, C1–C3) — the pieces that draw and send the picture taken
 * from a video: VideoFace12, FileTile12 with `hasCover`, hasCover12, sendCover12; and the chip's
 * own words (frame C2).
 * Contract: features/shopper-walk-fixes · BUILD_API.md §2
 */
import React from 'react';
import { StyleSheet } from 'react-native';
import { render, fireEvent, within } from '@testing-library/react-native';

jest.mock('../../../utils/videoPrep', () => ({ makeVideoPicture: jest.fn() }));
const { makeVideoPicture } = require('../../../utils/videoPrep');
const { FileTile12, VideoFace12, CountChip12, hasCover12, sendCover12 } = require('../bits12');
const { COVER_MAX_12 } = require('../copy12');
const { settingsTokens: T } = require('../../../theme/tokens');

const flat = (el) => StyleSheet.flatten(el.props.style);
beforeEach(() => jest.clearAllMocks());

describe('the face of a video', () => {
  it('with its picture: the picture, the play mark over it on a soft dark disc, and its length', () => {
    const r = render(<VideoFace12 url="https://r2/cover.jpg" durationS={14} />);
    const pic = r.getByTestId('video-picture');
    expect(pic.props.source).toEqual({ uri: 'https://r2/cover.jpg' });
    expect(pic.props.resizeMode).toBe('cover');
    expect(within(r.getByTestId('play-mark')).getByText('play')).toBeTruthy();
    expect(flat(r.getByTestId('play-mark')).backgroundColor).toBe('rgba(0,0,0,0.45)');   // readable on a pale frame
    expect(within(r.getByTestId('duration-badge')).getByText('0:14')).toBeTruthy();
  });

  it('without one: the dark tile with the play mark — never an empty box', () => {
    const r = render(<VideoFace12 url={null} durationS={28} />);
    expect(r.queryByTestId('video-picture')).toBeNull();
    expect(flat(r.getByTestId('video-face')).backgroundColor).toBe(T.ink);
    expect(within(r.getByTestId('play-mark')).getByText('play')).toBeTruthy();
    expect(r.getByText('0:28')).toBeTruthy();
  });

  it('the same dark tile sits under the picture, so it is what shows while the picture is on its way', () => {
    const r = render(<VideoFace12 url="https://r2/cover.jpg" />);
    expect(flat(r.getByTestId('video-face')).backgroundColor).toBe(T.ink);
    expect(r.queryByTestId('duration-badge')).toBeNull();           // no length given, no badge
  });

  it('the small mark of a post row; it takes no touches (the box around it does)', () => {
    const r = render(<VideoFace12 url="https://r2/cover.jpg" mark={14} />);
    expect(flat(r.getByTestId('play-mark')).width).toBe(22);
    expect(r.getByTestId('video-face').props.pointerEvents).toBe('none');
  });
});

describe('a file tile', () => {
  const video = (over = {}) => ({ id: 'f1', kind: 'video', mime: 'video/mp4', durationS: 14, ...over });

  it('hasCover12: only a video with a picture taken from it', () => {
    expect(hasCover12(video({ hasCover: true }))).toBe(true);
    expect(hasCover12(video({ hasCover: false }))).toBe(false);
    expect(hasCover12(video())).toBe(false);                                   // an older server answer
    expect(hasCover12({ id: 'p', kind: 'photo', hasCover: true })).toBe(false);
    expect(hasCover12(null)).toBe(false);
  });

  it('B1 · C2 · a video with `hasCover`: its picture under the play mark and the length badge; the tap still reports the press', () => {
    const onPress = jest.fn();
    const r = render(<FileTile12 file={video({ hasCover: true })} url="https://r2/f1.cover.jpg" onPress={onPress} />);
    const tile = r.getByTestId('file-f1');
    expect(within(tile).getByTestId('video-picture').props.source).toEqual({ uri: 'https://r2/f1.cover.jpg' });
    expect(within(tile).getByText('play')).toBeTruthy();
    expect(within(tile).getByText('0:14')).toBeTruthy();
    fireEvent.press(tile);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('a video with `hasCover` whose picture link has not come yet: the dark tile with the play mark', () => {
    const r = render(<FileTile12 file={video({ hasCover: true })} url={undefined} />);
    expect(r.queryByTestId('video-picture')).toBeNull();
    expect(r.getByText('play')).toBeTruthy();
    expect(flat(r.getByTestId('file-f1')).backgroundColor).toBe(T.ink);
  });

  it('a video WITHOUT one stays the dark tile — and an address handed to it is never drawn (it could only be the video\'s)', () => {
    const r = render(<FileTile12 file={video()} url="https://r2/f1.mp4" />);
    expect(r.queryByTestId('video-picture')).toBeNull();
    expect(r.UNSAFE_queryAllByType(require('react-native').Image)).toHaveLength(0);
    expect(r.getByText('play')).toBeTruthy();
    expect(r.getByText('0:14')).toBeTruthy();
    expect(flat(r.getByTestId('file-f1')).backgroundColor).toBe(T.ink);
  });

  it('a photo is unchanged: itself, no play mark', () => {
    const r = render(<FileTile12 file={{ id: 'p1', kind: 'photo' }} url="https://r2/p1.jpg" />);
    const images = r.UNSAFE_getAllByType(require('react-native').Image);
    expect(images).toHaveLength(1);
    expect(images[0].props.source).toEqual({ uri: 'https://r2/p1.jpg' });
    expect(r.queryByTestId('play-mark')).toBeNull();
    expect(r.queryByTestId('video-face')).toBeNull();
  });

  it('an upload in flight is unchanged', () => {
    const r = render(<FileTile12 progress={0.42} />);
    expect(r.getByText('42%')).toBeTruthy();
    expect(r.queryByTestId('video-face')).toBeNull();
  });
});

describe('C2 · the chip in the caller\'s own words', () => {
  it('"1 file" green, "No file yet" grey; without `text` it is "n of m" as before', () => {
    const one = render(<CountChip12 have={1} need={1} text="1 file" />);
    expect(one.getByText('1 file')).toBeTruthy();
    expect(flat(one.getByTestId('count-met')).backgroundColor).toBe(T.state.active.bg);
    const none = render(<CountChip12 have={0} need={1} text="No file yet" />);
    expect(none.getByText('No file yet')).toBeTruthy();
    expect(flat(none.getByTestId('count-short')).backgroundColor).toBe(T.state.ended.bg);
    expect(render(<CountChip12 have={0} need={1} />).getByText('0 of 1')).toBeTruthy();
    expect(render(<CountChip12 have={1} need={1} />).getByText('1 of 1')).toBeTruthy();
  });
});

describe('sendCover12 — her phone sends the picture after the video is uploaded', () => {
  const upload = { fileId: 'f9', url: 'https://r2/put-cover', method: 'PUT', headers: { 'Content-Type': 'image/jpeg' } };
  const calls = () => {
    const order = [];
    const api = {
      contentCoverUrl: jest.fn(() => { order.push('cover-url'); return Promise.resolve({ success: true, data: { upload } }); }),
      contentConfirmCover: jest.fn(() => { order.push('cover'); return Promise.resolve({ success: true, data: { file: { id: 'f9', hasCover: true } } }); }),
    };
    const put = jest.fn(() => { order.push('put'); return Promise.resolve({ ok: true }); });
    return { api, put, order };
  };
  const send = (c) => sendCover12({ api: c.api, put: c.put, ciId: 'ci1', fileId: 'f9', uri: 'file:///cache/reel.mp4' });

  it('the picture is made within the server\'s 1 MB, then: cover-url (its exact size) → PUT → cover', async () => {
    makeVideoPicture.mockResolvedValue({ uri: 'file:///cache/thumb-1', size: 184320, mime: 'image/jpeg' });
    const c = calls();
    await expect(send(c)).resolves.toBe(true);
    expect(COVER_MAX_12).toBe(1024 * 1024);
    expect(makeVideoPicture).toHaveBeenCalledWith('file:///cache/reel.mp4', { maxBytes: COVER_MAX_12 });
    expect(c.api.contentCoverUrl).toHaveBeenCalledWith('ci1', 'f9', 184320);
    expect(c.put).toHaveBeenCalledWith(upload, 'file:///cache/thumb-1', { timeoutMs: 30000 });   // a small, optional picture never holds her row for the video's 45 minutes
    expect(c.api.contentConfirmCover).toHaveBeenCalledWith('ci1', 'f9');
    expect(c.order).toEqual(['cover-url', 'put', 'cover']);
  });

  it('a phone that cannot make the picture (an older app build): nothing is asked of the server', async () => {
    makeVideoPicture.mockResolvedValue(null);
    const c = calls();
    await expect(send(c)).resolves.toBe(false);
    expect(c.order).toEqual([]);
  });

  it('every way it can fail ends quietly with false — it never throws', async () => {
    makeVideoPicture.mockResolvedValue({ uri: 'file:///cache/thumb-1', size: 184320, mime: 'image/jpeg' });

    const refused = calls();
    refused.api.contentCoverUrl.mockResolvedValue({ success: false, error: { code: 'FILE_TOO_LARGE_PHOTO', message: 'Photos have to be under 10 MB.' } });
    await expect(send(refused)).resolves.toBe(false);
    expect(refused.put).not.toHaveBeenCalled();

    const lost = calls();
    lost.api.contentCoverUrl.mockRejectedValue(new Error('Network request failed'));
    await expect(send(lost)).resolves.toBe(false);

    const noAnswer = calls();
    noAnswer.api.contentCoverUrl.mockResolvedValue(undefined);
    await expect(send(noAnswer)).resolves.toBe(false);

    const putFails = calls();
    putFails.put.mockRejectedValue(Object.assign(new Error('UPLOAD_REJECTED'), { code: 'UPLOAD_REJECTED' }));
    await expect(send(putFails)).resolves.toBe(false);
    expect(putFails.api.contentConfirmCover).not.toHaveBeenCalled();

    const notKept = calls();
    notKept.api.contentConfirmCover.mockResolvedValue({ success: false, error: { code: 'UPLOAD_MISSING', message: "The upload didn't finish. Try again." } });
    await expect(send(notKept)).resolves.toBe(false);

    makeVideoPicture.mockRejectedValue(new Error('it should never, but'));
    await expect(send(calls())).resolves.toBe(false);
  });
});
