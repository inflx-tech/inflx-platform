/**
 * ui-walk-fixes board J — the self-saving link box and the screen's one line of saves.
 * Contract: features/ui-walk-fixes · checks 34–36 · frames J1–J7 · decisions U13, D5
 * Research: features/ui-walk-fixes/research/C11-live-link-button-disabled.md (FIX FINAL 1, 2)
 *
 * The two screens that use them are mounted in screens/__tests__/contentScreens.test.js and
 * saleLiveScreens.test.js; here the pieces are held on their own, with the calls in the test's
 * hands, so the ORDER of what is sent and applied can be shown.
 */
import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { render, fireEvent, act } from '@testing-library/react-native';
import { LinkBox12, useSaves12, withHttps12, shortLink12, SAVE_PAUSE_12, LinkLine12 } from '../bits12';

const IG = 'https://www.instagram.com/reel/C8xK2';
const IG2 = 'https://www.instagram.com/reel/D4pQ9';
const REFUSED = { success: false, error: { code: 'LINK_INVALID', message: 'Paste the full link to the post.', field: 'url' } };
const LOST = { success: false, error: { code: 'NETWORK_ERROR', message: 'Cannot connect to server. Check your connection.' } };
const answer = (links) => ({ success: true, data: { content: links } });
const pending = () => { let resolve; let reject; const promise = new Promise((y, n) => { resolve = y; reject = n; }); return { promise, resolve, reject }; };
const settle = () => act(async () => { for (let i = 0; i < 25; i += 1) await Promise.resolve(); });   // eslint-disable-line no-await-in-loop

/** Two link boxes on one line of saves; `content` is what INFLX has: { a: url, b: url }. */
function Harness({ send, hold, first }) {
  const [content, setContent] = useState(first || {});
  const saves = useSaves12({ onContent: setContent, failed: "Couldn't save." });
  hold.saves = saves;
  hold.content = content;
  hold.set = setContent;                                // the content changing by another road (a read, a row taken out)
  return (
    <View>
      <LinkBox12 saves={saves} id="a" url={content.a} send={(v) => send('a', v)} placeholder="Paste the link" testID="link-a" />
      <LinkBox12 saves={saves} id="b" url={content.b} send={(v) => send('b', v)} placeholder="Paste the link" testID="link-b" />
    </View>
  );
}
const mount = (send, first) => { const hold = {}; const r = render(<Harness send={send} hold={hold} first={first} />); return { r, hold }; };
const type = (box, text) => { for (let i = 1; i <= text.length; i += 1) fireEvent.changeText(box, text.slice(0, i)); };
/** What she SEES in a box: the short form laid over it when there is one, otherwise the box's own text. */
const shown = (r, id) => { const over = r.queryByTestId(`${id}-short`); return over ? over.props.children : r.getByTestId(id).props.value; };

let errors;
beforeEach(() => {
  jest.useFakeTimers();
  errors = jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  const said = errors.mock.calls.map((args) => args.map(String).join(' ').split('\n')[0]);
  errors.mockRestore();
  jest.useRealTimers();
  expect(said).toEqual([]);                             // act() warnings, key clashes …
});

describe('D5 · "https://" is added to a link that comes without it — and nothing else is decided on the phone', () => {
  it('adds it to a bare link, trims, and leaves alone what already says how it opens', () => {
    expect(withHttps12('instagram.com/reel/C8xK2')).toBe('https://instagram.com/reel/C8xK2');
    expect(withHttps12('  www.instagram.com/reel/C8xK2?igsh=abc \n')).toBe('https://www.instagram.com/reel/C8xK2?igsh=abc');
    expect(withHttps12('youtu.be/dQ7vL2?si=x')).toBe('https://youtu.be/dQ7vL2?si=x');
    expect(withHttps12(IG)).toBe(IG);
    expect(withHttps12('HTTPS://www.instagram.com/reel/C8xK2')).toBe('HTTPS://www.instagram.com/reel/C8xK2');
    expect(withHttps12('http://instagram.com/reel/C8xK2')).toBe('http://instagram.com/reel/C8xK2');   // the server still refuses it
    expect(withHttps12('')).toBe('');
    expect(withHttps12('   ')).toBe('');
    expect(withHttps12(null)).toBe('');
  });
  it('no list of allowed sites lives in the app: a link to anywhere is sent, and INFLX is the judge', async () => {
    const send = jest.fn(() => Promise.resolve(REFUSED));
    const { r } = mount(send);
    fireEvent.changeText(r.getByTestId('link-a'), 'example.com/not-a-post');
    expect(send).toHaveBeenCalledWith('a', 'https://example.com/not-a-post');
    await settle();
    expect(r.getByText('Paste the full link to the post.')).toBeTruthy();
    const src = require('fs').readFileSync(require('path').resolve(__dirname, '..', 'bits12.js'), 'utf8');
    expect(src).not.toMatch(/instagram\.com['"`]|youtu\.be['"`]|youtube\.com['"`]|facebook\.com['"`]|fb\.watch/);
  });
});

describe('the short form a saved link is shown in', () => {
  it('is the one the brand\'s link line already uses', () => {
    expect(shortLink12('https://www.instagram.com/reel/C8xK2')).toBe('instagram.com/reel/C8xK2');
    expect(shortLink12('https://m.youtube.com/shorts/Xk3f9/')).toBe('youtube.com/shorts/Xk3f9');
    expect(shortLink12('https://www.instagram.com/reel/C8xK2abcdefghijk')).toBe('instagram.com/reel/C8xK2ab…');
    expect(shortLink12(null)).toBe('');
    expect(render(<LinkLine12 url="https://www.instagram.com/reel/C8xK2" />).getByText('instagram.com/reel/C8xK2')).toBeTruthy();
  });
});

describe('LinkBox12 · what the box shows (J1–J4)', () => {
  it('J1 · empty: the placeholder, no word at its right, no tick, no red line', () => {
    const { r } = mount(jest.fn());
    const box = r.getByTestId('link-a');
    expect(box.props.value).toBe('');
    expect(box.props.placeholder).toBe('Paste the link');
    expect(box.props.returnKeyType).toBe('done');
    expect(box.props.keyboardType).toBe('url');
    expect(box.props.autoCapitalize).toBe('none');
    expect(box.props.autoCorrect).toBe(false);
    expect(r.queryByTestId('link-a-saving')).toBeNull();
    expect(r.queryByTestId('link-a-saved')).toBeNull();
  });

  // ASSERTION DRIFT — ui-walk-fixes wave-2 review (drift/C1c.md). This used to assert that the
  // box's own VALUE was the short form while she was not in it. That was the fault: an edit that
  // landed before the box swapped back to the full link was saved, dots and all, as the link. The
  // short form is now only DRAWN over the box; the box's text is always the real link.
  it('J3 · a link INFLX has: the tick beside it and the short form on show; inside the box, the whole link', () => {
    const { r } = mount(jest.fn(), { a: IG });
    expect(r.getByTestId('link-a-saved')).toBeTruthy();
    expect(shown(r, 'link-a')).toBe('instagram.com/reel/C8xK2');
    expect(r.getByTestId('link-a').props.value).toBe(IG);                   // …but what the box HOLDS is the link itself
    expect(r.queryByTestId('link-b-saved')).toBeNull();                     // a box without a tick is not saved
    expect(r.queryByTestId('link-b-short')).toBeNull();                     // …and an empty box has nothing laid over it
    fireEvent(r.getByTestId('link-a'), 'focus');
    expect(shown(r, 'link-a')).toBe(IG);
    expect(r.getByTestId('link-a-saved')).toBeTruthy();
    fireEvent(r.getByTestId('link-a'), 'blur');
    expect(shown(r, 'link-a')).toBe('instagram.com/reel/C8xK2');
  });

  it('the short form is drawn OVER the box, never put in it: the real link is the box\'s text (unseen), and touches pass through to the box', () => {
    const { r } = mount(jest.fn(), { a: 'https://www.instagram.com/reel/C8xK2abcdefghijk' });
    const box = r.getByTestId('link-a');
    expect(box.props.value).toBe('https://www.instagram.com/reel/C8xK2abcdefghijk');
    expect(StyleSheet.flatten(box.props.style).color).toBe('transparent');
    const over = r.getByTestId('link-a-short');
    expect(over.props.children).toBe('instagram.com/reel/C8xK2ab…');
    expect(over.props.numberOfLines).toBe(1);
    let wrap = over.parent;                                                  // the View the short form sits in
    while (wrap && wrap.props.pointerEvents === undefined) wrap = wrap.parent;
    expect(wrap.props.pointerEvents).toBe('none');
    expect(StyleSheet.flatten(wrap.props.style)).toMatchObject({ position: 'absolute', left: 10, right: 10, top: 0, bottom: 0 });
    // Same type as the box's own text, so the swap is not a jump.
    const { fontFamily, fontSize } = StyleSheet.flatten(box.props.style);
    expect(StyleSheet.flatten(over.props.style)).toMatchObject({ fontFamily, fontSize });
    // In the box: the short form is gone and the link can be seen.
    fireEvent(box, 'focus');
    expect(r.queryByTestId('link-a-short')).toBeNull();
    expect(StyleSheet.flatten(r.getByTestId('link-a').props.style).color).not.toBe('transparent');
  });

  it('an edit that lands BEFORE the box has swapped to the full link edits the real link — the cut-down form is never saved as the link', async () => {
    const LONG = 'https://www.instagram.com/reel/C8xK2abcdefghijk';
    const send = jest.fn((id, v) => Promise.resolve(answer({ [id]: v })));
    const { r } = mount(send, { a: LONG });
    const box = r.getByTestId('link-a');
    expect(shown(r, 'link-a')).toBe('instagram.com/reel/C8xK2ab…');
    // No focus event has been handled yet: the phone reports the box's text plus her keystroke.
    fireEvent.changeText(box, `${box.props.value}x`);
    act(() => { jest.advanceTimersByTime(SAVE_PAUSE_12); });
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith('a', `${LONG}x`);
    expect(send.mock.calls[0][1]).not.toContain('…');
    await settle();
    expect(r.getByTestId('link-a-saved')).toBeTruthy();
  });

  it('J2 → J3 · pasted: "Saving…" at the right end until INFLX answers, then the tick', async () => {
    const save = pending();
    const send = jest.fn(() => save.promise);
    const { r, hold } = mount(send);
    fireEvent.changeText(r.getByTestId('link-a'), IG);
    expect(send).toHaveBeenCalledTimes(1);                                  // at once: the text jumped in one change
    expect(r.getByTestId('link-a-saving').props.children).toBe('Saving…');
    expect(r.queryByTestId('link-a-saved')).toBeNull();
    expect(hold.saves.busy.a).toBe(true);
    await act(async () => { save.resolve(answer({ a: IG })); });
    await settle();
    expect(r.queryByTestId('link-a-saving')).toBeNull();
    expect(r.getByTestId('link-a-saved')).toBeTruthy();
    expect(hold.saves.text.a).toBeUndefined();                              // the phone's copy is let go
    expect(hold.content).toEqual({ a: IG });
  });

  it('J4 · refused: the red line under the box, her text kept, no tick; `refused` is true only for INFLX\'s own "no"', async () => {
    const send = jest.fn().mockReturnValueOnce(Promise.resolve(REFUSED)).mockReturnValueOnce(Promise.resolve(LOST));
    const { r, hold } = mount(send);
    fireEvent.changeText(r.getByTestId('link-a'), 'https://youtu.be/dQ7vL2');
    await settle();
    expect(r.getByText('Paste the full link to the post.')).toBeTruthy();
    expect(r.getByTestId('link-a').props.value).toBe('https://youtu.be/dQ7vL2');
    expect(r.queryByTestId('link-a-saved')).toBeNull();
    expect(hold.saves.refused('a')).toBe(true);
    expect(hold.saves.errorOf('a')).toBe('Paste the full link to the post.');

    fireEvent.changeText(r.getByTestId('link-b'), IG);                      // no signal: not a verdict on the link
    await settle();
    expect(r.getByText('Cannot connect to server. Check your connection.')).toBeTruthy();
    expect(hold.saves.refused('b')).toBe(false);
    expect(hold.saves.errorOf('b')).toBe('Cannot connect to server. Check your connection.');
  });

  it('a call that fails without an answer at all shows the screen\'s own "couldn\'t save" sentence', async () => {
    const send = jest.fn(() => Promise.reject(new Error('boom')));
    const { r, hold } = mount(send);
    fireEvent.changeText(r.getByTestId('link-a'), IG);
    await settle();
    expect(r.getByText("Couldn't save.")).toBeTruthy();
    expect(hold.saves.refused('a')).toBe(false);
    expect(r.getByTestId('link-a').props.value).toBe(IG);
  });
});

describe('LinkBox12 · when it saves (FIX FINAL 1)', () => {
  it('typed a character at a time: only once she has stopped for the pause', async () => {
    const send = jest.fn((id, v) => Promise.resolve(answer({ [id]: v })));
    const { r } = mount(send);
    type(r.getByTestId('link-a'), IG);
    expect(send).not.toHaveBeenCalled();
    expect(r.queryByTestId('link-a-saving')).toBeNull();                    // nothing is on its way while she types
    act(() => { jest.advanceTimersByTime(SAVE_PAUSE_12 - 1); });
    expect(send).not.toHaveBeenCalled();
    act(() => { jest.advanceTimersByTime(1); });
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith('a', IG);
    await settle();
    expect(r.getByTestId('link-a-saved')).toBeTruthy();
    expect(SAVE_PAUSE_12).toBe(700);
  });

  it('each keystroke restarts the pause; the Done key sends at once and the pause never sends it again', async () => {
    const send = jest.fn((id, v) => Promise.resolve(answer({ [id]: v })));
    const { r } = mount(send);
    const box = r.getByTestId('link-a');
    fireEvent.changeText(box, 'h');
    act(() => { jest.advanceTimersByTime(600); });
    fireEvent.changeText(box, 'ht');
    act(() => { jest.advanceTimersByTime(600); });
    expect(send).not.toHaveBeenCalled();
    fireEvent(box, 'submitEditing');
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith('a', 'https://ht');
    await settle();
    act(() => { jest.advanceTimersByTime(5000); });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('leaving the box sends at once; Android\'s blur + end-editing + Done for one tap are ONE save', async () => {
    const save = pending();
    const send = jest.fn(() => save.promise);
    const { r } = mount(send);
    const box = r.getByTestId('link-a');
    type(box, IG);
    fireEvent(box, 'submitEditing');
    fireEvent(box, 'endEditing');
    fireEvent(box, 'blur');
    expect(send).toHaveBeenCalledTimes(1);
    await act(async () => { save.resolve(answer({ a: IG })); });
    await settle();
    fireEvent(box, 'endEditing');
    fireEvent(box, 'blur');
    await settle();
    expect(send).toHaveBeenCalledTimes(1);                                  // equal to the last one sent: skipped
  });

  it('after a save that got NO answer, one leaving of the box — Android\'s end-editing + blur, or Done + both — sends the link once more, not twice', async () => {
    // The fault (wave-2 review): the first of the two events started the retry, the second queued
    // another behind it — and when the retry got no answer either, the same link went out again.
    const send = jest.fn(() => Promise.resolve(LOST));
    const { r, hold } = mount(send);
    const box = r.getByTestId('link-a');
    fireEvent.changeText(box, IG);                                          // pasted: sent at once
    await settle();
    expect(send).toHaveBeenCalledTimes(1);
    expect(r.getByText('Cannot connect to server. Check your connection.')).toBeTruthy();

    fireEvent(box, 'endEditing');
    fireEvent(box, 'blur');
    await settle();
    expect(send).toHaveBeenCalledTimes(2);                                  // ONE retry for one leaving
    expect(send).toHaveBeenLastCalledWith('a', IG);
    expect(r.getByTestId('link-a').props.value).toBe(IG);                   // her text is still there to try again
    expect(hold.saves.busy.a).toBe(false);

    fireEvent(box, 'focus');
    fireEvent(box, 'submitEditing');                                        // the Done key, then the same two
    fireEvent(box, 'endEditing');
    fireEvent(box, 'blur');
    await settle();
    expect(send).toHaveBeenCalledTimes(3);

    // Leaving it again later is a new leaving: one more try, and this one is answered.
    send.mockImplementation((id, v) => Promise.resolve(answer({ [id]: v })));
    fireEvent(box, 'focus');
    fireEvent(box, 'endEditing');
    fireEvent(box, 'blur');
    await settle();
    expect(send).toHaveBeenCalledTimes(4);
    expect(r.getByTestId('link-a-saved')).toBeTruthy();
  });

  it('leaving the box while a paste is still on its way: nothing more is sent if it is answered, and ONE retry if it got no answer', async () => {
    const first = pending();
    const send = jest.fn().mockReturnValueOnce(first.promise).mockImplementation((id, v) => Promise.resolve(answer({ [id]: v })));
    const { r } = mount(send);
    const box = r.getByTestId('link-a');
    fireEvent.changeText(box, IG);
    fireEvent(box, 'endEditing');
    fireEvent(box, 'blur');
    expect(send).toHaveBeenCalledTimes(1);
    await act(async () => { first.resolve(LOST); });
    await settle();
    expect(send).toHaveBeenCalledTimes(2);                                  // the leaving's own try — once
    expect(r.getByTestId('link-a-saved')).toBeTruthy();
  });

  it('text she changed while a leaving\'s save was on its way is still sent when she leaves again', async () => {
    const first = pending();
    const send = jest.fn().mockReturnValueOnce(first.promise).mockImplementation((id, v) => Promise.resolve(answer({ [id]: v })));
    const { r, hold } = mount(send);
    const box = r.getByTestId('link-a');
    type(box, IG);
    fireEvent(box, 'endEditing');
    fireEvent(box, 'blur');
    expect(send).toHaveBeenCalledTimes(1);
    fireEvent(box, 'focus');
    fireEvent.changeText(box, `${IG}x`);                                    // a different text now
    fireEvent(box, 'endEditing');
    fireEvent(box, 'blur');
    await act(async () => { first.resolve(answer({ a: IG })); });
    await settle();
    expect(send).toHaveBeenCalledTimes(2);
    expect(send).toHaveBeenLastCalledWith('a', `${IG}x`);
    expect(hold.content).toEqual({ a: `${IG}x` });
  });

  it('a link she empties is cleared on the server; emptying a box INFLX has nothing for sends nothing', async () => {
    const send = jest.fn((id, v) => Promise.resolve(answer({ a: v || null })));
    const { r } = mount(send, { a: IG });
    fireEvent(r.getByTestId('link-a'), 'focus');
    fireEvent.changeText(r.getByTestId('link-a'), '');
    fireEvent(r.getByTestId('link-a'), 'blur');
    expect(send).toHaveBeenCalledWith('a', '');
    await settle();
    expect(r.queryByTestId('link-a-saved')).toBeNull();
    fireEvent.changeText(r.getByTestId('link-b'), 'x');
    fireEvent.changeText(r.getByTestId('link-b'), '');
    fireEvent(r.getByTestId('link-b'), 'blur');
    await settle();
    expect(send).toHaveBeenCalledTimes(1);
  });
});

describe('useSaves12 · one line, in order (FIX FINAL 2)', () => {
  it('36 · the second save is not sent until the first has answered, and each answer is applied as it comes', async () => {
    const a = pending();
    const b = pending();
    const send = jest.fn().mockReturnValueOnce(a.promise).mockReturnValueOnce(b.promise);
    const { r, hold } = mount(send);
    fireEvent.changeText(r.getByTestId('link-a'), IG);
    fireEvent.changeText(r.getByTestId('link-b'), IG2);
    await settle();
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenLastCalledWith('a', IG);
    // The first answer was read before the second link existed: it must not empty the second box.
    await act(async () => { a.resolve(answer({ a: IG })); });
    await settle();
    expect(hold.content).toEqual({ a: IG });
    expect(r.getByTestId('link-b').props.value).toBe(IG2);
    expect(send).toHaveBeenCalledTimes(2);
    expect(send).toHaveBeenLastCalledWith('b', IG2);
    await act(async () => { b.resolve(answer({ a: IG, b: IG2 })); });
    await settle();
    expect(hold.content).toEqual({ a: IG, b: IG2 });
    expect(r.getByTestId('link-a-saved')).toBeTruthy();
    expect(r.getByTestId('link-b-saved')).toBeTruthy();
  });

  it('a read asked for while a save is on its way waits its turn, so the older read can never land on top of the save', async () => {
    const save = pending();
    const send = jest.fn(() => save.promise);
    const { r, hold } = mount(send);
    fireEvent.changeText(r.getByTestId('link-a'), IG);
    const read = jest.fn(() => Promise.resolve('read'));
    let got = null;
    act(() => { hold.saves.run(read).then((x) => { got = x; }); });
    await settle();
    expect(read).not.toHaveBeenCalled();                                    // behind the save
    await act(async () => { save.resolve(answer({ a: IG })); });
    await settle();
    expect(read).toHaveBeenCalledTimes(1);
    expect(got).toBe('read');
  });

  it('with nothing ahead of it a call starts at once; one that throws or is refused does not stop the line', async () => {
    const send = jest.fn((id, v) => Promise.resolve(answer({ [id]: v })));
    const { r, hold } = mount(send);
    const now = jest.fn(() => Promise.resolve(1));
    act(() => { hold.saves.run(now); });
    expect(now).toHaveBeenCalledTimes(1);                                   // not a tick later
    await settle();
    let failed = null;
    await act(async () => { await hold.saves.run(() => { throw new Error('boom'); }).catch((e) => { failed = e.message; }); });
    expect(failed).toBe('boom');
    let rejected = null;
    await act(async () => { await hold.saves.run(() => Promise.reject(new Error('later'))).catch((e) => { rejected = e.message; }); });
    expect(rejected).toBe('later');
    fireEvent.changeText(r.getByTestId('link-a'), IG);
    expect(send).toHaveBeenCalledTimes(1);
    await settle();
    expect(r.getByTestId('link-a-saved')).toBeTruthy();
  });

  it('an answer about text she has since changed lets nothing go and says nothing; what is in the box now is sent next', async () => {
    const first = pending();
    const send = jest.fn().mockReturnValueOnce(first.promise).mockImplementation((id, v) => Promise.resolve(answer({ [id]: v })));
    const { r, hold } = mount(send);
    const box = r.getByTestId('link-a');
    fireEvent.changeText(box, 'https://www.instagram.com/reel/C8');         // pasted short
    fireEvent.changeText(box, 'https://www.instagram.com/reel/C8x');        // … and typing on while it saves
    await act(async () => { first.resolve(answer({ a: 'https://www.instagram.com/reel/C8' })); });
    await settle();
    expect(box.props.value).toBe('https://www.instagram.com/reel/C8x');     // no character eaten
    expect(r.queryByTestId('link-a-saved')).toBeNull();
    expect(hold.saves.text.a).toBe('https://www.instagram.com/reel/C8x');
    act(() => { jest.advanceTimersByTime(SAVE_PAUSE_12); });
    expect(send).toHaveBeenCalledTimes(2);
    expect(send).toHaveBeenLastCalledWith('a', 'https://www.instagram.com/reel/C8x');
    await settle();
    expect(r.getByTestId('link-a-saved')).toBeTruthy();
    expect(hold.content).toEqual({ a: 'https://www.instagram.com/reel/C8x' });
  });

  it('a refusal for text she has since changed is held back; the same refused text is not sent twice, and its red line comes back', async () => {
    const first = pending();
    const send = jest.fn().mockReturnValueOnce(first.promise).mockImplementation(() => Promise.resolve(REFUSED));
    const { r, hold } = mount(send);
    const box = r.getByTestId('link-a');
    fireEvent.changeText(box, 'https://youtu.be/dQ7vL2');
    fireEvent.changeText(box, 'https://youtu.be/dQ7vL2x');
    await act(async () => { first.resolve(REFUSED); });
    await settle();
    expect(r.queryByText('Paste the full link to the post.')).toBeNull();   // she is still typing
    fireEvent.changeText(box, 'https://youtu.be/dQ7vL2');                   // back to exactly what was refused
    fireEvent(box, 'blur');
    await settle();
    expect(send).toHaveBeenCalledTimes(1);
    expect(r.getByText('Paste the full link to the post.')).toBeTruthy();
    expect(hold.saves.refused('a')).toBe(true);
  });

  it('a save that got no answer is tried again when she leaves the box, and when the screen asks for everything to be saved', async () => {
    const send = jest.fn().mockReturnValueOnce(Promise.resolve(LOST)).mockReturnValueOnce(Promise.resolve(LOST))
      .mockImplementation((id, v) => Promise.resolve(answer({ [id]: v })));
    const { r, hold } = mount(send);
    fireEvent.changeText(r.getByTestId('link-a'), IG);
    await settle();
    expect(send).toHaveBeenCalledTimes(1);
    fireEvent(r.getByTestId('link-a'), 'blur');
    await settle();
    expect(send).toHaveBeenCalledTimes(2);
    let done = null;
    await act(async () => { done = await hold.saves.flush(); });
    expect(send).toHaveBeenCalledTimes(3);
    expect(done.unsaved('a')).toBe(false);
    expect(r.getByTestId('link-a-saved')).toBeTruthy();
  });

  it('35 · flush(): everything typed and not yet sent goes now; it resolves when every answer is in and says what INFLX still does not have', async () => {
    const a = pending();
    const send = jest.fn().mockReturnValueOnce(a.promise).mockReturnValueOnce(Promise.resolve(REFUSED));
    const { r, hold } = mount(send);
    type(r.getByTestId('link-a'), IG);
    type(r.getByTestId('link-b'), 'https://youtu.be/dQ7vL2');
    expect(send).not.toHaveBeenCalled();
    let done = null;
    act(() => { hold.saves.flush().then((x) => { done = x; }); });
    expect(send).toHaveBeenCalledTimes(1);
    await settle();
    expect(done).toBeNull();                                                // still waiting for the first answer
    await act(async () => { a.resolve(answer({ a: IG })); });
    await settle();
    expect(send).toHaveBeenCalledTimes(2);
    expect(done.unsaved('a')).toBe(false);
    expect(done.unsaved('b')).toBe(true);
    expect(done.unsaved('never-touched')).toBe(false);
    act(() => { jest.advanceTimersByTime(5000); });                         // the pauses it replaced are gone
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('a link INFLX no longer has — the content changed by another road — is sent again when she pastes the very same link', async () => {
    const send = jest.fn((id, v) => Promise.resolve(answer({ [id]: v })));
    const { r, hold } = mount(send);
    fireEvent.changeText(r.getByTestId('link-a'), IG);
    await settle();
    expect(send).toHaveBeenCalledTimes(1);
    expect(r.getByTestId('link-a-saved')).toBeTruthy();
    act(() => { hold.set({}); });                                           // e.g. the row was taken out and its key given to a new one
    expect(r.getByTestId('link-a').props.value).toBe('');
    expect(r.queryByTestId('link-a-saved')).toBeNull();
    fireEvent.changeText(r.getByTestId('link-a'), IG);
    expect(send).toHaveBeenCalledTimes(2);                                  // not "INFLX already has this"
    expect(send).toHaveBeenLastCalledWith('a', IG);
    expect(r.getByTestId('link-a').props.value).toBe(IG);                   // and not wiped from the box
    await settle();
    expect(r.getByTestId('link-a-saved')).toBeTruthy();
    expect(hold.content).toEqual({ a: IG });
    fireEvent(r.getByTestId('link-a'), 'blur');                             // now the two agree again: nothing more to send
    await settle();
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('when the content on the screen and the last save from this box disagree, nothing is taken as "already saved": text equal to the older save is sent', async () => {
    const send = jest.fn((id, v) => Promise.resolve(answer({ [id]: v })));
    const { r, hold } = mount(send);
    fireEvent.changeText(r.getByTestId('link-a'), IG);
    await settle();
    act(() => { hold.set({ a: IG2 }); });                                   // a later read: INFLX now has another link here
    fireEvent(r.getByTestId('link-a'), 'focus');
    type(r.getByTestId('link-a'), IG);                                      // back to the one saved first
    fireEvent(r.getByTestId('link-a'), 'blur');
    expect(send).toHaveBeenCalledTimes(2);
    expect(send).toHaveBeenLastCalledWith('a', IG);
    await settle();
    expect(hold.content).toEqual({ a: IG });
  });

  it('a refusal is remembered only for the content it was given against: once the content has changed, the same text is asked again', async () => {
    const send = jest.fn(() => Promise.resolve(REFUSED));
    const { r, hold } = mount(send);
    fireEvent.changeText(r.getByTestId('link-a'), 'https://youtu.be/dQ7vL2');
    await settle();
    expect(send).toHaveBeenCalledTimes(1);
    fireEvent(r.getByTestId('link-a'), 'blur');
    await settle();
    expect(send).toHaveBeenCalledTimes(1);                                  // same text, same content: not asked twice
    act(() => { hold.set({ a: IG }); });
    fireEvent(r.getByTestId('link-a'), 'focus');
    fireEvent.changeText(r.getByTestId('link-a'), 'https://youtu.be/dQ7vL2x');
    fireEvent.changeText(r.getByTestId('link-a'), 'https://youtu.be/dQ7vL2');
    fireEvent(r.getByTestId('link-a'), 'blur');
    await settle();
    expect(send).toHaveBeenLastCalledWith('a', 'https://youtu.be/dQ7vL2');
    expect(send.mock.calls.filter(([, v]) => v === 'https://youtu.be/dQ7vL2')).toHaveLength(2);
    expect(r.getByText('Paste the full link to the post.')).toBeTruthy();
  });

  it('forget(key): her unsaved text, the red line and everything remembered about that box go — the key may now belong to another row', async () => {
    const send = jest.fn().mockReturnValueOnce(Promise.resolve(REFUSED)).mockImplementation((id, v) => Promise.resolve(answer({ [id]: v })));
    const { r, hold } = mount(send);
    fireEvent.changeText(r.getByTestId('link-a'), 'https://youtu.be/dQ7vL2');
    await settle();
    expect(r.getByText('Paste the full link to the post.')).toBeTruthy();
    type(r.getByTestId('link-b'), IG2);                                     // typed, its pause still running
    act(() => { hold.saves.forget('a'); hold.saves.forget('b'); hold.saves.forget('never-touched'); });
    expect(r.getByTestId('link-a').props.value).toBe('');
    expect(r.getByTestId('link-b').props.value).toBe('');
    expect(r.queryByText('Paste the full link to the post.')).toBeNull();
    expect(hold.saves.refused('a')).toBe(false);
    act(() => { jest.advanceTimersByTime(5000); });
    expect(send).toHaveBeenCalledTimes(1);                                  // b's pause went with it: nothing is sent for a forgotten box
    let done = null;
    await act(async () => { done = await hold.saves.flush(); });
    expect(send).toHaveBeenCalledTimes(1);
    expect(done.unsaved('a')).toBe(false);
    fireEvent.changeText(r.getByTestId('link-a'), 'https://youtu.be/dQ7vL2');   // the same text, for whatever has the key now
    expect(send).toHaveBeenCalledTimes(2);                                  // asked afresh, not answered from memory
    await settle();
    expect(r.getByTestId('link-a-saved')).toBeTruthy();
  });

  it('leaving the screen: what is still only on her phone is sent, and the late answer touches nothing', async () => {
    const save = pending();
    const send = jest.fn(() => save.promise);
    const { r } = mount(send);
    type(r.getByTestId('link-a'), 'instagram.com/reel/C8xK2');
    expect(send).not.toHaveBeenCalled();
    r.unmount();
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith('a', 'https://instagram.com/reel/C8xK2');
    await act(async () => { save.resolve(answer({ a: 'https://instagram.com/reel/C8xK2' })); });
    await settle();
    act(() => { jest.advanceTimersByTime(5000); });
    expect(send).toHaveBeenCalledTimes(1);
  });
});
