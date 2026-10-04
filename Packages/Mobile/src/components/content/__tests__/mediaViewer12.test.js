/**
 * ui-walk-fixes · board H — the file viewer (frames H1–H7).
 * Contract: features/ui-walk-fixes · checks 30–33 · research/C10-content-opens-cloudflare.md
 *
 * A content file opens INSIDE the app: a fresh private link every time, photo or video by the
 * server's word, the player loaded lazily, no video cached on the phone, the link renewed when it
 * dies mid-play, and a stated fallback on an app build that has no player.
 *
 * "Not cached" is a promise about VIDEOS only (spec U8, U26). A photo is drawn by the phone's
 * standard picture component, which keeps a copy in the app's own private picture cache.
 *
 * react-native-video is NOT mocked in jest.setup.js and must never be loaded here: the player is
 * handed in through the runtime check's test seam, exactly as the shopper's video tests do.
 */
import React from 'react';
import { Linking, Modal, StyleSheet } from 'react-native';
import { render, waitFor, fireEvent, act } from '@testing-library/react-native';
import MediaViewer12 from '../MediaViewer12';
import { C12 } from '../copy12';
import { CS } from '../../shop/copyShop';
import { _setPlayerForTests, hasPlayer } from '../../../utils/videoPlayer';

// A stand-in for the native player: keeps the props it was given, counts how often it was put on
// and taken off the screen, and answers "where are you?" the way the test says the real one would.
let lastProps = null;
let mounts = 0;
let unmounts = 0;
let position;            // () => a promise of the second it is at; undefined = "it cannot say" (it rejects)
let bare = false;        // true = a player with no such calls at all
const seek = jest.fn();
const setFullScreen = jest.fn();
const FakeVideo = React.forwardRef((props, ref) => {
  lastProps = props;
  React.useEffect(() => { mounts += 1; return () => { unmounts += 1; }; }, []);
  React.useImperativeHandle(ref, () => (bare ? { seek } : {
    seek,
    setFullScreen,
    getCurrentPosition: () => (position ? position() : Promise.reject(new Error('PLAYER_NOT_AVAILABLE'))),
  }));
  const { View } = require('react-native');
  return <View testID={props.testID} />;
});

const link = (url, more = {}) => Promise.resolve({ success: true, data: { view: { url, ...more } } });
const photo = (id) => ({ id, kind: 'photo' });
const video = (id) => ({ id, kind: 'video', durationS: 28 });
const open = (over = {}) => ({ label: 'Instagram post', files: [photo('p1'), photo('p2')], index: 0, ...over });
/** shopper-walk-fixes (frame B2): the title's two lines — what it is, and under it the place (if named) and which file. */
const titled = (r, head, which) => {
  expect(r.getByTestId('viewer-title').props.children).toBe(head);
  expect(r.getByTestId('viewer-which').props.children).toBe(which);
  return true;
};

let errors;
let openURL;
beforeEach(() => {
  jest.useFakeTimers();                      // a touchable's press animation stays inside act()
  jest.clearAllMocks();
  lastProps = null; mounts = 0; unmounts = 0; position = undefined; bare = false;
  _setPlayerForTests(FakeVideo);
  openURL = jest.spyOn(Linking, 'openURL').mockImplementation(() => Promise.resolve());
  errors = jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  const said = errors.mock.calls.map((args) => args.map(String).join(' ').split('\n')[0]);
  errors.mockRestore();
  openURL.mockRestore();
  jest.useRealTimers();
  expect(said).toEqual([]);                  // key clashes, refs on function components, act() …
});

describe('H3, H1 · it opens on a spinner, then the photo, whole, inside the app', () => {
  it('closed, it draws nothing and asks for no link', () => {
    const fetchUrl = jest.fn();
    const r = render(<MediaViewer12 open={null} fetchUrl={fetchUrl} onClose={() => {}} />);
    expect(r.queryByTestId('media-viewer')).toBeNull();
    expect(fetchUrl).not.toHaveBeenCalled();
  });

  it('the top bar and its ✕ are there while the file is still being fetched', async () => {
    let answer;
    const fetchUrl = jest.fn(() => new Promise((res) => { answer = res; }));
    const onClose = jest.fn();
    const r = render(<MediaViewer12 open={open()} fetchUrl={fetchUrl} onClose={onClose} />);
    expect(r.getByTestId('viewer-loading')).toBeTruthy();
    titled(r, 'Instagram post', '1 of 2'); // ASSERTION DRIFT — shopper-walk-fixes B2: the title is two lines (the name, then which file)
    fireEvent.press(r.getByTestId('viewer-close'));
    expect(onClose).toHaveBeenCalledTimes(1);
    await act(async () => { answer({ success: true, data: { view: { url: 'https://r2/p1', kind: 'photo', mime: 'image/jpeg' } } }); });
    await waitFor(() => r.getByTestId('viewer-photo'));
  });

  it('a photo is the core Image, fitted whole, resized for large files; the spinner goes when it has drawn', async () => {
    const fetchUrl = jest.fn(() => link('https://r2/p1?sig=fresh', { kind: 'photo', mime: 'image/jpeg' }));
    const r = render(<MediaViewer12 open={open()} fetchUrl={fetchUrl} onClose={() => {}} />);
    const img = await waitFor(() => r.getByTestId('viewer-photo'));
    expect(fetchUrl).toHaveBeenCalledWith('p1');
    expect(img.props.source).toEqual({ uri: 'https://r2/p1?sig=fresh' });
    expect(img.props.resizeMode).toBe('contain');
    expect(img.props.resizeMethod).toBe('resize');
    expect(r.getByTestId('viewer-loading')).toBeTruthy();          // still arriving
    fireEvent(img, 'load');
    expect(r.queryByTestId('viewer-loading')).toBeNull();
    expect(r.queryByTestId('viewer-actions')).toBeNull();          // the file and nothing else
    expect(openURL).not.toHaveBeenCalled();
  });

  it('a FRESH link every time it opens — the one from the last time is never reused', async () => {
    let n = 0;
    const fetchUrl = jest.fn(() => link(`https://r2/p1?sig=${++n}`, { kind: 'photo' }));
    const r = render(<MediaViewer12 open={open()} fetchUrl={fetchUrl} onClose={() => {}} />);
    await waitFor(() => expect(r.getByTestId('viewer-photo').props.source.uri).toBe('https://r2/p1?sig=1'));
    r.rerender(<MediaViewer12 open={null} fetchUrl={fetchUrl} onClose={() => {}} />);
    expect(r.queryByTestId('media-viewer')).toBeNull();
    r.rerender(<MediaViewer12 open={open()} fetchUrl={fetchUrl} onClose={() => {}} />);
    await waitFor(() => expect(r.getByTestId('viewer-photo').props.source.uri).toBe('https://r2/p1?sig=2'));
    expect(fetchUrl).toHaveBeenCalledTimes(2);
  });

  it("the phone's Back button closes it (onRequestClose)", async () => {
    const onClose = jest.fn();
    const r = render(<MediaViewer12 open={open()} fetchUrl={() => link('https://r2/p1')} onClose={onClose} />);
    await waitFor(() => r.getByTestId('viewer-photo'));
    act(() => { r.UNSAFE_getByType(Modal).props.onRequestClose(); });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('H1 · the title, and stepping through the row', () => {
  it('the row label, and "{n} of {m}" under it; the arrow with nothing that way is faded and does nothing', async () => {
    const fetchUrl = jest.fn((id) => link(`https://r2/${id}`, { kind: 'photo' }));
    const r = render(<MediaViewer12 open={open()} fetchUrl={fetchUrl} onClose={() => {}} />);
    await waitFor(() => r.getByTestId('viewer-photo'));
    titled(r, 'Instagram post', '1 of 2'); // ASSERTION DRIFT — shopper-walk-fixes B2: the title is two lines (the name, then which file)
    expect(r.getByTestId('viewer-prev').props.accessibilityState).toEqual({ disabled: true });
    expect(StyleSheet.flatten(r.getByTestId('viewer-prev').props.style).opacity).toBe(0.35);
    expect(r.getByTestId('viewer-next').props.accessibilityState).toEqual({ disabled: false });
    fireEvent.press(r.getByTestId('viewer-prev'));
    expect(fetchUrl).toHaveBeenCalledTimes(1);

    fireEvent.press(r.getByTestId('viewer-next'));
    await waitFor(() => expect(r.getByTestId('viewer-photo').props.source.uri).toBe('https://r2/p2'));
    titled(r, 'Instagram post', '2 of 2'); // ASSERTION DRIFT — shopper-walk-fixes B2: the title is two lines (the name, then which file)
    expect(fetchUrl).toHaveBeenLastCalledWith('p2');               // its own fresh link
    expect(r.getByTestId('viewer-next').props.accessibilityState).toEqual({ disabled: true });
    fireEvent.press(r.getByTestId('viewer-prev'));
    await waitFor(() => titled(r, 'Instagram post', '1 of 2')); // ASSERTION DRIFT — shopper-walk-fixes B2: the title is two lines (the name, then which file)
    expect(fetchUrl).toHaveBeenCalledTimes(3);
  });

  it('it opens at the tile that was tapped', async () => {
    const fetchUrl = jest.fn((id) => link(`https://r2/${id}`));
    const r = render(<MediaViewer12 open={open({ index: 1 })} fetchUrl={fetchUrl} onClose={() => {}} />);
    await waitFor(() => titled(r, 'Instagram post', '2 of 2')); // ASSERTION DRIFT — shopper-walk-fixes B2: the title is two lines (the name, then which file)
    expect(fetchUrl).toHaveBeenCalledWith('p2');
  });

  it('a row with one file shows no arrows', async () => {
    const r = render(<MediaViewer12 open={open({ label: 'Instagram reel', files: [photo('p1')] })} fetchUrl={() => link('https://r2/p1')} onClose={() => {}} />);
    await waitFor(() => titled(r, 'Instagram reel', '1 of 1')); // ASSERTION DRIFT — shopper-walk-fixes B2: the title is two lines (the name, then which file)
    expect(r.queryByTestId('viewer-prev')).toBeNull();
    expect(r.queryByTestId('viewer-next')).toBeNull();
  });
});

/* shopper-walk-fixes · frame B2 — "This good offer · SH…Instagram reel · 1 of 1" was one line cut
 * in the middle. The title is two lines: the post, then the place and which file. */
describe('shopper-walk-fixes B2 · the title is two lines', () => {
  const flat = (el) => StyleSheet.flatten(el.props.style);

  it('a caller that names the post and the place: the post in bold, cut at its END; under it the place and which file', async () => {
    const fetchUrl = jest.fn((id) => link(`https://r2/${id}`, { kind: 'photo' }));
    const r = render(<MediaViewer12 open={{ title: 'This good offer · SHNCZW', place: 'Instagram reel', files: [photo('p1'), photo('p2')], index: 0 }} fetchUrl={fetchUrl} onClose={() => {}} />);
    await waitFor(() => r.getByTestId('viewer-photo'));
    titled(r, 'This good offer · SHNCZW', 'Instagram reel · 1 of 2');
    const head = r.getByTestId('viewer-title');
    expect(head.props.numberOfLines).toBe(1);
    expect(head.props.ellipsizeMode).toBe('tail');                  // "…" at the end — never in the middle of it
    expect(flat(head).fontFamily).toBe(require('../../../theme/tokens').fonts.sansBold);
    expect(r.getByTestId('viewer-which').props.numberOfLines).toBe(1);
    expect(r.queryByText(/This good offer.*Instagram reel/)).toBeNull();   // never one run-on line again
    fireEvent.press(r.getByTestId('viewer-next'));
    await waitFor(() => titled(r, 'This good offer · SHNCZW', 'Instagram reel · 2 of 2'));
  });

  it('a caller that still passes only `label` keeps working: the label, and "1 of 1" under it', async () => {
    const r = render(<MediaViewer12 open={{ label: 'Instagram reel', files: [photo('p1')], index: 0 }} fetchUrl={() => link('https://r2/p1')} onClose={() => {}} />);
    await waitFor(() => r.getByTestId('viewer-photo'));
    titled(r, 'Instagram reel', '1 of 1');
  });

  it('Pay for Content: the deliverable\'s name, and "2 of 3" under it', async () => {
    const r = render(<MediaViewer12 open={{ label: 'Instagram story', files: [photo('p1'), photo('p2'), photo('p3')], index: 1 }} fetchUrl={(id) => link(`https://r2/${id}`)} onClose={() => {}} />);
    await waitFor(() => r.getByTestId('viewer-photo'));
    titled(r, 'Instagram story', '2 of 3');
  });

  it('a row whose post has no name: the place is the title, and is not said twice', async () => {
    const r = render(<MediaViewer12 open={{ title: '', place: 'Instagram reel', files: [photo('p1')], index: 0 }} fetchUrl={() => link('https://r2/p1')} onClose={() => {}} />);
    await waitFor(() => r.getByTestId('viewer-photo'));
    titled(r, 'Instagram reel', '1 of 1');
  });

  it('the words of the second line', () => {
    expect(C12.viewer.which('Instagram reel', 1, 1)).toBe('Instagram reel · 1 of 1');
    expect(C12.viewer.which(null, 2, 3)).toBe('2 of 3');
    expect(C12.viewer.which('', 2, 3)).toBe('2 of 3');
  });
});

describe('H4 · couldn\'t load', () => {
  it('a refused or lost request says so in one line; "Try again" fetches it afresh', async () => {
    const fetchUrl = jest.fn()
      .mockImplementationOnce(() => Promise.resolve({ success: false, error: { message: 'Not found' } }))
      .mockImplementationOnce(() => Promise.reject(new Error('Network request failed')))
      .mockImplementationOnce(() => link('https://r2/p1?sig=3', { kind: 'photo' }));
    const r = render(<MediaViewer12 open={open()} fetchUrl={fetchUrl} onClose={() => {}} />);
    await waitFor(() => r.getByTestId('viewer-error'));
    expect(r.getByText("Couldn't load this file")).toBeTruthy();
    expect(r.queryByTestId('viewer-loading')).toBeNull();
    fireEvent.press(r.getByText('Try again'));
    await waitFor(() => expect(fetchUrl).toHaveBeenCalledTimes(2));
    await waitFor(() => r.getByTestId('viewer-error'));             // a thrown request is the same sentence
    fireEvent.press(r.getByTestId('viewer-retry'));
    await waitFor(() => r.getByTestId('viewer-photo'));
    expect(r.queryByTestId('viewer-error')).toBeNull();
    expect(fetchUrl).toHaveBeenCalledTimes(3);
  });

  it('a photo that will not draw is the same screen', async () => {
    const r = render(<MediaViewer12 open={open()} fetchUrl={() => link('https://r2/p1', { kind: 'photo' })} onClose={() => {}} />);
    fireEvent(await waitFor(() => r.getByTestId('viewer-photo')), 'error');
    expect(r.getByText("Couldn't load this file")).toBeTruthy();
    expect(r.queryByTestId('viewer-photo')).toBeNull();
  });
});

describe('H2 · a video plays inside the app', () => {
  const reel = () => open({ label: 'Instagram reel', files: [video('v1')] });

  it('photo or video is the SERVER\'s word, not the tile\'s', async () => {
    // The brand's Story tile hands over { kind: 'photo' }; the server says what the file really is.
    const r = render(<MediaViewer12 open={open({ files: [photo('x1')] })} fetchUrl={() => link('https://r2/x1', { kind: 'video', mime: 'video/mp4' })} onClose={() => {}} />);
    await waitFor(() => r.getByTestId('viewer-video'));
    expect(r.queryByTestId('viewer-photo')).toBeNull();
    const m = render(<MediaViewer12 open={open({ files: [video('x2')] })} fetchUrl={() => link('https://r2/x2', { mime: 'image/png' })} onClose={() => {}} />);
    await waitFor(() => m.getByTestId('viewer-photo'));
    // The server said nothing (an older API): the tile's kind decides.
    const t = render(<MediaViewer12 open={reel()} fetchUrl={() => link('https://r2/v1')} onClose={() => {}} />);
    await waitFor(() => t.getByTestId('viewer-video'));
  });

  it('shown whole, with the player\'s own control bar, and NOTHING cached on the phone', async () => {
    const r = render(<MediaViewer12 open={reel()} fetchUrl={() => link('https://r2/v1?sig=a', { kind: 'video', mime: 'video/mp4' })} onClose={() => {}} />);
    await waitFor(() => r.getByTestId('viewer-video'));
    expect(lastProps.source).toEqual({ uri: 'https://r2/v1?sig=a' });
    expect(lastProps.controls).toBe(true);
    expect(lastProps.resizeMode).toBe('contain');
    expect(lastProps.paused).toBe(false);
    expect(lastProps.muted).toBe(false);
    expect(lastProps.repeat).toBe(false);
    expect(lastProps.playInBackground).toBe(false);
    expect(lastProps.bufferConfig).toBeUndefined();                 // no cacheSizeMB — a private video is never stored
    expect(lastProps.source.shouldCache).toBeUndefined();
    titled(r, 'Instagram reel', '1 of 1'); // ASSERTION DRIFT — shopper-walk-fixes B2: the title is two lines (the name, then which file)
    expect(r.getByTestId('viewer-loading')).toBeTruthy();
    act(() => { lastProps.onLoad({ duration: 28, currentTime: 0 }); });
    expect(r.queryByTestId('viewer-loading')).toBeNull();
    expect(seek).not.toHaveBeenCalled();                            // a first play starts at the beginning
    expect(openURL).not.toHaveBeenCalled();
  });

  it('it waits while the caller has something open on top (the note box)', async () => {
    const r = render(<MediaViewer12 open={reel()} fetchUrl={() => link('https://r2/v1', { kind: 'video' })} onClose={() => {}} held />);
    await waitFor(() => r.getByTestId('viewer-video'));
    expect(lastProps.paused).toBe(true);
  });

  it('closing it takes the player off the screen, so nothing keeps playing', async () => {
    const fetchUrl = () => link('https://r2/v1', { kind: 'video' });
    const r = render(<MediaViewer12 open={reel()} fetchUrl={fetchUrl} onClose={() => {}} />);
    await waitFor(() => r.getByTestId('viewer-video'));
    r.rerender(<MediaViewer12 open={null} fetchUrl={fetchUrl} onClose={() => {}} />);
    expect(r.queryByTestId('viewer-video')).toBeNull();
  });
});

describe('32 · the 5-minute link dies mid-play: a fresh one, and on from the same second', () => {
  const reel = () => open({ label: 'Instagram reel', files: [video('v1')] });
  const links = () => { let n = 0; return jest.fn(() => link(`https://r2/v1?sig=${++n}`, { kind: 'video', mime: 'video/mp4' })); };

  it('an error from the player fetches a new link and hands it to the SAME player, which starts at the second she is at', async () => {
    const fetchUrl = links();
    const r = render(<MediaViewer12 open={reel()} fetchUrl={fetchUrl} onClose={() => {}} />);
    await waitFor(() => r.getByTestId('viewer-video'));
    act(() => { lastProps.onLoad({ duration: 400 }); });
    act(() => { lastProps.onProgress({ currentTime: 312.4 }); });
    expect(fetchUrl).toHaveBeenCalledTimes(1);
    expect(r.queryByTestId('viewer-loading')).toBeNull();

    // The connection drops at 5:12: the player reports it, and says where it is.
    position = () => Promise.resolve(312.4);
    await act(async () => { lastProps.onError({ error: { errorString: 'Response code: 403' } }); });
    await waitFor(() => expect(lastProps.source).toEqual({ uri: 'https://r2/v1?sig=2', startPosition: 312400 }));
    expect(fetchUrl).toHaveBeenCalledTimes(2);
    expect(fetchUrl).toHaveBeenLastCalledWith('v1');
    expect(mounts).toBe(1);                                         // the player that was there — not a new one
    expect(unmounts).toBe(0);
    expect(r.queryByTestId('viewer-error')).toBeNull();             // quietly — no error screen
    expect(r.getByTestId('viewer-loading')).toBeTruthy();           // a spinner over it until it plays again
    act(() => { lastProps.onLoad({ duration: 400 }); });
    expect(r.queryByTestId('viewer-loading')).toBeNull();
    expect(seek).not.toHaveBeenCalled();                            // it OPENS at that second; it never shows 0:00 and jumps
    expect(openURL).not.toHaveBeenCalled();
  });

  it('she watched to 5:30 and dragged back to 0:40 on the dead link: it carries on from 0:40 — where she dragged to, not where she was', async () => {
    const fetchUrl = links();
    const r = render(<MediaViewer12 open={reel()} fetchUrl={fetchUrl} onClose={() => {}} />);
    await waitFor(() => r.getByTestId('viewer-video'));
    act(() => { lastProps.onLoad({ duration: 400 }); });
    act(() => { lastProps.onProgress({ currentTime: 330 }); });     // the last second the player REPORTED

    // The drag needs data the dead link will not give. No progress report is sent from 0:40 — the
    // player stops reporting while it waits — so only the player itself knows where she dragged to.
    position = () => Promise.resolve(40.2);
    await act(async () => { lastProps.onError({ error: { errorString: 'Response code: 403' } }); });
    await waitFor(() => expect(lastProps.source).toEqual({ uri: 'https://r2/v1?sig=2', startPosition: 40200 }));
    expect(mounts).toBe(1);
    expect(seek).not.toHaveBeenCalled();

    // The renewed link fails again before the video has moved: still from 0:40, not from 5:30.
    position = undefined;
    await act(async () => { lastProps.onError({}); });
    await waitFor(() => expect(lastProps.source).toEqual({ uri: 'https://r2/v1?sig=3', startPosition: 40200 }));
  });

  it('dragged right back to the start on the dead link: it starts from the beginning', async () => {
    const fetchUrl = links();
    const r = render(<MediaViewer12 open={reel()} fetchUrl={fetchUrl} onClose={() => {}} />);
    await waitFor(() => r.getByTestId('viewer-video'));
    act(() => { lastProps.onProgress({ currentTime: 330 }); });
    position = () => Promise.resolve(0);
    await act(async () => { lastProps.onError({}); });
    await waitFor(() => expect(lastProps.source).toEqual({ uri: 'https://r2/v1?sig=2' }));
    expect(mounts).toBe(1);
  });

  it('a player that cannot say where it is — it refuses, it has no such call, or it never answers — carries on from the last second it reported', async () => {
    // It refuses (the stand-in's default).
    const a = render(<MediaViewer12 open={reel()} fetchUrl={links()} onClose={() => {}} />);
    await waitFor(() => a.getByTestId('viewer-video'));
    act(() => { lastProps.onProgress({ currentTime: 312.4 }); });
    await act(async () => { lastProps.onError({}); });
    await waitFor(() => expect(lastProps.source).toEqual({ uri: 'https://r2/v1?sig=2', startPosition: 312400 }));
    a.unmount();

    // It has no such call.
    bare = true;
    const b = render(<MediaViewer12 open={reel()} fetchUrl={links()} onClose={() => {}} />);
    await waitFor(() => b.getByTestId('viewer-video'));
    act(() => { lastProps.onProgress({ currentTime: 95 }); });
    await act(async () => { lastProps.onError({}); });
    await waitFor(() => expect(lastProps.source).toEqual({ uri: 'https://r2/v1?sig=2', startPosition: 95000 }));
    b.unmount();

    // It never answers: the renewal waits a moment, then goes ahead without it.
    bare = false;
    position = () => new Promise(() => {});
    const fetchUrl = links();
    const c = render(<MediaViewer12 open={reel()} fetchUrl={fetchUrl} onClose={() => {}} />);
    await waitFor(() => c.getByTestId('viewer-video'));
    act(() => { lastProps.onProgress({ currentTime: 61 }); });
    await act(async () => { lastProps.onError({}); });
    expect(fetchUrl).toHaveBeenCalledTimes(1);                      // still asking
    expect(c.getByTestId('viewer-loading')).toBeTruthy();
    await act(async () => { jest.advanceTimersByTime(800); });
    await waitFor(() => expect(lastProps.source).toEqual({ uri: 'https://r2/v1?sig=2', startPosition: 61000 }));
    expect(fetchUrl).toHaveBeenCalledTimes(2);
  });

  it('two errors from the same dead link are one renewal, not two', async () => {
    const fetchUrl = links();
    const r = render(<MediaViewer12 open={reel()} fetchUrl={fetchUrl} onClose={() => {}} />);
    await waitFor(() => r.getByTestId('viewer-video'));
    const dead = lastProps;
    await act(async () => { dead.onError({}); dead.onError({}); });
    await waitFor(() => expect(lastProps.source.uri).toBe('https://r2/v1?sig=2'));
    expect(fetchUrl).toHaveBeenCalledTimes(2);
  });

  it('a video that keeps failing without moving stops renewing and says it could not load; Try again starts over', async () => {
    const fetchUrl = links();
    const r = render(<MediaViewer12 open={reel()} fetchUrl={fetchUrl} onClose={() => {}} />);
    await waitFor(() => r.getByTestId('viewer-video'));
    await act(async () => { lastProps.onError({}); });
    await waitFor(() => expect(lastProps.source.uri).toBe('https://r2/v1?sig=2'));
    await act(async () => { lastProps.onError({}); });
    await waitFor(() => expect(lastProps.source.uri).toBe('https://r2/v1?sig=3'));
    await act(async () => { lastProps.onError({}); });
    await waitFor(() => r.getByTestId('viewer-error'));
    expect(fetchUrl).toHaveBeenCalledTimes(3);                      // not a loop against the server
    fireEvent.press(r.getByTestId('viewer-retry'));
    await waitFor(() => r.getByTestId('viewer-video'));
    expect(fetchUrl).toHaveBeenCalledTimes(4);
  });

  it('"Try again" after it gave up picks the video up where she was, not at 0:00', async () => {
    const fetchUrl = links();
    const r = render(<MediaViewer12 open={reel()} fetchUrl={fetchUrl} onClose={() => {}} />);
    await waitFor(() => r.getByTestId('viewer-video'));
    act(() => { lastProps.onProgress({ currentTime: 330 }); });
    position = () => Promise.resolve(40);
    await act(async () => { lastProps.onError({}); });
    await waitFor(() => expect(lastProps.source.uri).toBe('https://r2/v1?sig=2'));
    await act(async () => { lastProps.onError({}); });
    await waitFor(() => expect(lastProps.source.uri).toBe('https://r2/v1?sig=3'));
    await act(async () => { lastProps.onError({}); });
    await waitFor(() => r.getByTestId('viewer-error'));
    fireEvent.press(r.getByTestId('viewer-retry'));
    await waitFor(() => r.getByTestId('viewer-video'));
    expect(lastProps.source).toEqual({ uri: 'https://r2/v1?sig=4', startPosition: 40000 });
  });

  it('a video that has moved on since its last renewal may be renewed again, as often as it takes', async () => {
    const fetchUrl = links();
    const r = render(<MediaViewer12 open={reel()} fetchUrl={fetchUrl} onClose={() => {}} />);
    await waitFor(() => r.getByTestId('viewer-video'));
    for (let i = 1; i <= 4; i += 1) {
      act(() => { lastProps.onProgress({ currentTime: i * 300 }); });
      // eslint-disable-next-line no-await-in-loop
      await act(async () => { lastProps.onError({}); });
      // eslint-disable-next-line no-await-in-loop, no-loop-func
      await waitFor(() => expect(lastProps.source).toEqual({ uri: `https://r2/v1?sig=${i + 1}`, startPosition: i * 300000 }));
      act(() => { lastProps.onLoad({}); });
    }
    expect(mounts).toBe(1);
    expect(r.queryByTestId('viewer-error')).toBeNull();
  });

  it('after it has played to the end, a replay on a dead link starts from the beginning', async () => {
    const fetchUrl = links();
    const r = render(<MediaViewer12 open={reel()} fetchUrl={fetchUrl} onClose={() => {}} />);
    await waitFor(() => r.getByTestId('viewer-video'));
    act(() => { lastProps.onProgress({ currentTime: 27.9 }); lastProps.onEnd(); });
    await act(async () => { lastProps.onError({}); });
    await waitFor(() => expect(lastProps.source).toEqual({ uri: 'https://r2/v1?sig=2' }));
    expect(seek).not.toHaveBeenCalled();
  });

  it('she steps to another file while the dead link is being renewed: the other file is not disturbed', async () => {
    const fetchUrl = jest.fn((id) => link(`https://r2/${id}`, { kind: 'video' }));
    const r = render(<MediaViewer12 open={open({ label: 'Instagram reel', files: [video('v1'), video('v2')] })} fetchUrl={fetchUrl} onClose={() => {}} />);
    await waitFor(() => r.getByTestId('viewer-video'));
    position = () => new Promise(() => {});                         // the player is still being asked
    await act(async () => { lastProps.onError({}); });
    fireEvent.press(r.getByTestId('viewer-next'));
    await waitFor(() => expect(lastProps.source).toEqual({ uri: 'https://r2/v2' }));
    await act(async () => { jest.advanceTimersByTime(800); });
    expect(fetchUrl.mock.calls.map((c) => c[0])).toEqual(['v1', 'v2']);   // no late link for the file she left
    expect(lastProps.source).toEqual({ uri: 'https://r2/v2' });
    titled(r, 'Instagram reel', '2 of 2'); // ASSERTION DRIFT — shopper-walk-fixes B2: the title is two lines (the name, then which file)
  });
});

describe("32 · the player's own full-screen mode (its bar has that button, and it cannot be hidden)", () => {
  const reel = (files = [video('v1')]) => open({ label: 'Instagram reel', files });
  const links = () => { let n = 0; return jest.fn((id) => link(`https://r2/${id}?sig=${++n}`, { kind: 'video' })); };

  it('a renewal does not take the player off the screen, so its full-screen layer is never left behind, black, over the renewed video', async () => {
    const r = render(<MediaViewer12 open={reel()} fetchUrl={links()} onClose={() => {}} />);
    await waitFor(() => r.getByTestId('viewer-video'));
    position = () => Promise.resolve(40);
    await act(async () => { lastProps.onError({}); });
    await waitFor(() => expect(lastProps.source.uri).toBe('https://r2/v1?sig=2'));
    expect(mounts).toBe(1);
    expect(unmounts).toBe(0);                                       // she stays in full screen, and the video carries on there
    expect(setFullScreen).not.toHaveBeenCalled();
  });

  it('when it gives up, the player is told to leave full screen before "Couldn\'t load this file" replaces it', async () => {
    const r = render(<MediaViewer12 open={reel()} fetchUrl={links()} onClose={() => {}} />);
    await waitFor(() => r.getByTestId('viewer-video'));
    await act(async () => { lastProps.onError({}); });
    await waitFor(() => expect(lastProps.source.uri).toBe('https://r2/v1?sig=2'));
    await act(async () => { lastProps.onError({}); });
    await waitFor(() => expect(lastProps.source.uri).toBe('https://r2/v1?sig=3'));
    expect(setFullScreen).not.toHaveBeenCalled();
    await act(async () => { lastProps.onError({}); });
    await waitFor(() => r.getByTestId('viewer-error'));
    expect(setFullScreen).toHaveBeenCalledTimes(1);
    expect(setFullScreen).toHaveBeenCalledWith(false);
    expect(unmounts).toBe(1);
  });

  it('a renewal whose new link cannot be fetched: the same', async () => {
    const fetchUrl = jest.fn()
      .mockImplementationOnce(() => link('https://r2/v1?sig=1', { kind: 'video' }))
      .mockImplementationOnce(() => Promise.reject(new Error('Network request failed')));
    const r = render(<MediaViewer12 open={reel()} fetchUrl={fetchUrl} onClose={() => {}} />);
    await waitFor(() => r.getByTestId('viewer-video'));
    await act(async () => { lastProps.onError({}); });
    await waitFor(() => r.getByTestId('viewer-error'));
    expect(setFullScreen).toHaveBeenCalledWith(false);
    expect(r.queryByTestId('viewer-video')).toBeNull();
  });

  it('closing the viewer, or stepping to another file, tells the player the same before it goes', async () => {
    const fetchUrl = links();
    const r = render(<MediaViewer12 open={reel([video('v1'), video('v2')])} fetchUrl={fetchUrl} onClose={() => {}} />);
    await waitFor(() => r.getByTestId('viewer-video'));
    fireEvent.press(r.getByTestId('viewer-next'));
    expect(setFullScreen).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(lastProps.source.uri).toBe('https://r2/v2?sig=2'));
    expect(mounts).toBe(2);                                         // another file is another player
    r.rerender(<MediaViewer12 open={null} fetchUrl={fetchUrl} onClose={() => {}} />);
    expect(setFullScreen).toHaveBeenCalledTimes(2);
    expect(setFullScreen).toHaveBeenLastCalledWith(false);
  });

  it('a player without that call (the stand-in of an older test) is simply taken off', async () => {
    bare = true;
    const fetchUrl = links();
    const r = render(<MediaViewer12 open={reel()} fetchUrl={fetchUrl} onClose={() => {}} />);
    await waitFor(() => r.getByTestId('viewer-video'));
    r.rerender(<MediaViewer12 open={null} fetchUrl={fetchUrl} onClose={() => {}} />);
    expect(r.queryByTestId('viewer-video')).toBeNull();
    expect(setFullScreen).not.toHaveBeenCalled();
  });

  it('the very same link again at the very same second (two made within one second) would reload nothing: only then a new player, full screen left first', async () => {
    const fetchUrl = jest.fn(() => link('https://r2/v1?sig=same', { kind: 'video' }));
    const r = render(<MediaViewer12 open={reel()} fetchUrl={fetchUrl} onClose={() => {}} />);
    await waitFor(() => r.getByTestId('viewer-video'));
    position = () => Promise.resolve(12);
    await act(async () => { lastProps.onError({}); });
    await waitFor(() => expect(lastProps.source).toEqual({ uri: 'https://r2/v1?sig=same', startPosition: 12000 }));
    expect(mounts).toBe(1);                                         // same address, another second: the player reloads it
    await act(async () => { lastProps.onError({}); });
    await waitFor(() => expect(mounts).toBe(2));
    expect(unmounts).toBe(1);
    expect(setFullScreen).toHaveBeenCalledWith(false);
    expect(lastProps.source).toEqual({ uri: 'https://r2/v1?sig=same', startPosition: 12000 });
  });
});

describe('H2 · sound', () => {
  it("the player's bar has no sound button, so the viewer has its own: one tap turns the sound off, another turns it back on", async () => {
    const r = render(<MediaViewer12 open={open({ label: 'Instagram reel', files: [video('v1'), video('v2')] })} fetchUrl={(id) => link(`https://r2/${id}`, { kind: 'video' })} onClose={() => {}} />);
    await waitFor(() => r.getByTestId('viewer-video'));
    const btn = () => r.getByTestId('viewer-sound');
    expect(lastProps.muted).toBe(false);
    expect(btn().props.accessibilityLabel).toBe('Turn sound off');
    fireEvent.press(btn());
    expect(lastProps.muted).toBe(true);
    expect(btn().props.accessibilityLabel).toBe('Turn sound on');
    expect(mounts).toBe(1);                                         // the video is not restarted by it

    // Her choice stays while she steps through the row.
    fireEvent.press(r.getByTestId('viewer-next'));
    await waitFor(() => expect(lastProps.source).toEqual({ uri: 'https://r2/v2' }));
    expect(lastProps.muted).toBe(true);
    fireEvent.press(btn());
    expect(lastProps.muted).toBe(false);
  });

  it('no sound button on a photo, while loading, on "Couldn\'t load", or on an app build without the player', async () => {
    let answer;
    const p = render(<MediaViewer12 open={open()} fetchUrl={() => new Promise((res) => { answer = res; })} onClose={() => {}} />);
    expect(p.queryByTestId('viewer-sound')).toBeNull();             // loading
    await act(async () => { answer({ success: true, data: { view: { url: 'https://r2/p1', kind: 'photo' } } }); });
    await waitFor(() => p.getByTestId('viewer-photo'));
    expect(p.queryByTestId('viewer-sound')).toBeNull();             // a photo
    p.unmount();

    const e = render(<MediaViewer12 open={open()} fetchUrl={() => Promise.resolve({ success: false })} onClose={() => {}} />);
    await waitFor(() => e.getByTestId('viewer-error'));
    expect(e.queryByTestId('viewer-sound')).toBeNull();
    e.unmount();

    _setPlayerForTests(null);
    const o = render(<MediaViewer12 open={open({ files: [video('v1')] })} fetchUrl={() => link('https://r2/v1', { kind: 'video' })} onClose={() => {}} />);
    await waitFor(() => o.getByTestId('viewer-needs-update'));
    expect(o.queryByTestId('viewer-sound')).toBeNull();
  });
});

describe('H5 · 31 · an app build without the player', () => {
  it('a video shows "Update INFLX to play videos" and "Open in browser"; the browser gets a link made now', async () => {
    _setPlayerForTests(null);
    expect(hasPlayer()).toBe(false);
    let n = 0;
    const fetchUrl = jest.fn(() => link(`https://r2/v1?sig=${++n}`, { kind: 'video', mime: 'video/mp4' }));
    const r = render(<MediaViewer12 open={open({ label: 'Instagram reel', files: [video('v1')] })} fetchUrl={fetchUrl} onClose={() => {}} />);
    await waitFor(() => r.getByTestId('viewer-needs-update'));
    expect(r.getByText('Update INFLX to play videos')).toBeTruthy();
    expect(C12.viewer.needsUpdate).toBe(CS.videoNeedsUpdate);       // the shopper app's sentence, one string
    expect(r.getByText('Open in browser')).toBeTruthy();
    expect(r.queryByTestId('viewer-video')).toBeNull();
    expect(r.queryByTestId('viewer-loading')).toBeNull();
    expect(openURL).not.toHaveBeenCalled();                         // only when she asks for it
    fireEvent.press(r.getByTestId('viewer-open-browser'));
    await waitFor(() => expect(openURL).toHaveBeenCalledWith('https://r2/v1?sig=2'));
    expect(fetchUrl).toHaveBeenCalledTimes(2);
  });

  it('photos are not affected: they open inside the app on every build', async () => {
    _setPlayerForTests(null);
    const r = render(<MediaViewer12 open={open()} fetchUrl={() => link('https://r2/p1', { kind: 'photo', mime: 'image/jpeg' })} onClose={() => {}} />);
    await waitFor(() => r.getByTestId('viewer-photo'));
    expect(r.queryByTestId('viewer-needs-update')).toBeNull();
    expect(openURL).not.toHaveBeenCalled();
  });
});

describe('H6, H7 · 33 · what sits under the file is the caller\'s decision', () => {
  it('nothing given: the file and nothing else', async () => {
    const r = render(<MediaViewer12 open={open()} fetchUrl={() => link('https://r2/p1')} onClose={() => {}} />);
    await waitFor(() => r.getByTestId('viewer-photo'));
    expect(r.queryByTestId('viewer-add-note')).toBeNull();
    expect(r.queryByTestId('viewer-remove')).toBeNull();
    expect(r.queryByTestId('viewer-note')).toBeNull();
  });

  it('H6 · "Add a note" hands back the file on screen; a note already written shows in amber above it', async () => {
    const onAddNote = jest.fn();
    const notes = { p2: 'Brighten the first 3 seconds' };
    const r = render(<MediaViewer12 open={open()} fetchUrl={(id) => link(`https://r2/${id}`)} onClose={() => {}} noteOf={(f) => notes[f.id]} onAddNote={onAddNote} />);
    await waitFor(() => r.getByTestId('viewer-photo'));
    expect(r.getByText('Add a note')).toBeTruthy();
    expect(r.queryByTestId('viewer-note')).toBeNull();              // no note on file 1
    expect(r.queryByTestId('viewer-remove')).toBeNull();
    fireEvent.press(r.getByTestId('viewer-next'));
    await waitFor(() => r.getByTestId('viewer-note'));
    expect(r.getByText('Brighten the first 3 seconds')).toBeTruthy();
    fireEvent.press(r.getByTestId('viewer-add-note'));
    expect(onAddNote).toHaveBeenCalledWith(expect.objectContaining({ id: 'p2' }));
  });

  it('H7 · "Remove" is the outline red button and hands back the file; the brand\'s pinned note sits above it', async () => {
    const onRemove = jest.fn();
    const files = [{ ...photo('p1'), pinnedNote: 'Full length, please.' }, photo('p2')];
    const r = render(<MediaViewer12 open={open({ files })} fetchUrl={(id) => link(`https://r2/${id}`)} onClose={() => {}} noteOf={(f) => f.pinnedNote} onRemove={onRemove} />);
    await waitFor(() => r.getByTestId('viewer-photo'));
    expect(r.getByText('Full length, please.')).toBeTruthy();
    expect(r.queryByTestId('viewer-add-note')).toBeNull();
    const btn = r.getByTestId('viewer-remove');
    expect(r.getByText('Remove')).toBeTruthy();
    expect(StyleSheet.flatten(btn.props.style).backgroundColor).toBe('#FFFFFF');   // .b-dan: white, red label
    fireEvent.press(btn);
    expect(onRemove).toHaveBeenCalledWith(expect.objectContaining({ id: 'p1' }));
  });
});
