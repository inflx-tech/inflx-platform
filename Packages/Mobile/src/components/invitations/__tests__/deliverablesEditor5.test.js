/**
 * ui-walk-fixes — board D (frames D1–D8): the ONE chooser behind "What she delivers" on the brand
 * terms screen, the brand's counter pop-up, the creator's counter, her pitch form and the pitch
 * counter. Checks 12 and 14 of 03-expected-outputs.md.
 *
 *   one line per deliverable · a type box that opens the five types IN PLACE · minus / number /
 *   plus from 1 to 20 with no keypad · a type that has a line cannot be chosen again ("Added") ·
 *   "+ Add another" gone at five · counts that arrive wrong are put right · what is handed back
 *   is still [{ type, count }].
 */
import React, { useState } from 'react';
import { Modal, StyleSheet, TextInput } from 'react-native';
import { render, fireEvent, within, act } from '@testing-library/react-native';
import { DeliverablesEditor5, deliverableCount5, deliverableRowsError5, scrollForList5 } from '../bits5';
import { C5, MSG5, DELIVERABLE_TYPES } from '../copy5';

const REEL = { type: 'reel', count: 1 };
const STORY = { type: 'story', count: 2 };
const ALL_FIVE = [
  { type: 'reel', count: 1 }, { type: 'story', count: 20 }, { type: 'post', count: 1 },
  { type: 'youtube_video', count: 1 }, { type: 'youtube_short', count: 3 },
];

/** A screen in miniature: it keeps the rows, as each of the five homes does. */
function Host({ initial, spy, ...rest }) {
  const [rows, setRows] = useState(initial);
  return <DeliverablesEditor5 rows={rows} onChange={(next) => { if (spy) spy(next); setRows(next); }} testID="ed" {...rest} />;
}
const draw = (initial, props = {}) => {
  const spy = jest.fn();
  const r = render(<Host initial={initial} spy={spy} {...props} />);
  return { ...r, spy, last: () => spy.mock.calls[spy.mock.calls.length - 1][0] };
};

/** Where, among the chooser's own top-level pieces, the piece holding this node sits. */
const byId = (id) => (n) => !!n.props && n.props.testID === id;
const byText = (t) => (n) => n.type === 'Text' && n.props.children === t;
const place = (root, pred) => root.children.findIndex((c) => typeof c !== 'string' && c.findAll(pred).length > 0);
const disabledOf = (node) => node.props.accessibilityState && node.props.accessibilityState.disabled;

let errors;
beforeEach(() => { errors = jest.spyOn(console, 'error').mockImplementation(() => {}); });
afterEach(() => {
  // React reports a clash of keys, a hook out of order or an update on an unmounted piece only here.
  expect(errors).not.toHaveBeenCalled();
  errors.mockRestore();
});

/* ───────────────────────────────────────────────────────────── D1 */

describe('D1 — one line per deliverable', () => {
  it('each line is the type with a down-arrow, minus / number / plus, and a remove button', () => {
    const { getByTestId, queryByTestId, getByText, UNSAFE_queryAllByType } = draw([REEL, STORY]);
    within(getByTestId('ed-row-0-type')).getByText('Instagram reel');
    within(getByTestId('ed-row-0-type')).getByText('chevron-down');
    within(getByTestId('ed-row-1-type')).getByText('Instagram story');
    within(getByTestId('ed-row-0-count-value')).getByText('1');
    within(getByTestId('ed-row-1-count-value')).getByText('2');
    getByTestId('ed-row-0-count-minus'); getByTestId('ed-row-0-count-plus');
    expect(getByTestId('ed-row-0-remove').props.accessibilityLabel).toBe('Remove');
    getByTestId('ed-row-1-remove');
    // the pile of five type pills is gone: only the chosen type's name is on the line
    for (const t of DELIVERABLE_TYPES) expect(queryByTestId(`ed-row-0-${t.code}`)).toBeNull();
    expect(queryByTestId('ed-list')).toBeNull();
    // no keypad anywhere in the block
    expect(UNSAFE_queryAllByType(TextInput)).toHaveLength(0);
    // "+ Add another" is the outlined button with a plus, and the hint stays
    const add = getByTestId('ed-add');
    expect(add.props.accessibilityRole).toBe('button');
    within(add).getByText('plus'); within(add).getByText('Add another');
    getByText('Reels, posts, stories, YouTube videos and shorts.');
  });

  it('the number goes from 1 to 20 by minus and plus: minus is off at 1, plus is off at 20', () => {
    const { getByTestId, spy, last } = draw([{ type: 'reel', count: 1 }, { type: 'story', count: 19 }]);
    expect(disabledOf(getByTestId('ed-row-0-count-minus'))).toBe(true);
    fireEvent.press(getByTestId('ed-row-0-count-minus'));
    expect(spy).not.toHaveBeenCalled();
    fireEvent.press(getByTestId('ed-row-0-count-plus'));
    expect(last()).toEqual([{ type: 'reel', count: 2 }, { type: 'story', count: 19 }]);
    expect(disabledOf(getByTestId('ed-row-0-count-minus'))).toBeFalsy();
    fireEvent.press(getByTestId('ed-row-0-count-minus'));
    expect(last()[0]).toEqual({ type: 'reel', count: 1 });
    // up to 20, and no further however often plus is pressed
    for (let i = 0; i < 6; i++) fireEvent.press(getByTestId('ed-row-1-count-plus'));
    within(getByTestId('ed-row-1-count-value')).getByText('20');
    expect(last()[1]).toEqual({ type: 'story', count: 20 });
    expect(disabledOf(getByTestId('ed-row-1-count-plus'))).toBe(true);
    expect(spy.mock.calls.every(([rows]) => rows.every((r) => Number.isInteger(r.count) && r.count >= 1 && r.count <= 20))).toBe(true);
  });

  it('the remove button takes its own line away and leaves the others as they were', () => {
    const { getByTestId, queryByTestId, last } = draw([REEL, STORY, { type: 'post', count: 4 }]);
    fireEvent.press(getByTestId('ed-row-1-remove'));
    expect(last()).toEqual([{ type: 'reel', count: 1 }, { type: 'post', count: 4 }]);
    within(getByTestId('ed-row-1-type')).getByText('Instagram post');
    within(getByTestId('ed-row-1-count-value')).getByText('4');
    expect(queryByTestId('ed-row-2')).toBeNull();
  });

  it('keeps the ids the other suites press: "-row-N-remove" and "-add", and "deliverables" when no id is given', () => {
    const { getByTestId } = render(<DeliverablesEditor5 rows={[REEL]} onChange={() => {}} />);
    getByTestId('deliverables'); getByTestId('deliverables-row-0'); getByTestId('deliverables-row-0-remove'); getByTestId('deliverables-add');
  });
});

/* ───────────────────────────────────────────────────────────── D2 */

describe('D2 — "+ Add another" opens the five types in place', () => {
  it('the list sits right under the button and above the hint: in the flow of the page, never floating, never a second pop-up', () => {
    const { getByTestId, queryByTestId, UNSAFE_queryAllByType, spy } = draw([REEL, STORY]);
    fireEvent.press(getByTestId('ed-add'));
    const root = getByTestId('ed');
    const list = getByTestId('ed-list');
    // order on the page: line 1, line 2, the button, the list, the hint
    expect(place(root, byId('ed-row-1'))).toBe(1);
    expect(place(root, byId('ed-add'))).toBe(2);
    expect(place(root, byId('ed-list'))).toBe(3);
    expect(place(root, byText(C5.terms.deliverHint))).toBe(4);
    // in the flow: nothing lifts it out of the page, and nothing is opened over the page
    const style = StyleSheet.flatten(list.props.style);
    expect(style.position).toBeUndefined();
    expect(style.zIndex).toBeUndefined();
    expect(UNSAFE_queryAllByType(Modal)).toHaveLength(0);
    // all five types, in the app's order
    expect(DELIVERABLE_TYPES.map((t) => t.label)).toEqual(['Instagram reel', 'Instagram post', 'Instagram story', 'YouTube video', 'YouTube short']);
    for (const t of DELIVERABLE_TYPES) within(getByTestId(`ed-add-${t.code}`)).getByText(t.label);
    // opening it adds nothing: the brand is asked which type first
    expect(spy).not.toHaveBeenCalled();
    expect(queryByTestId('ed-row-2')).toBeNull();
  });

  it('types that already have a line are grey with "Added" and cannot be picked twice', () => {
    const { getByTestId, getAllByText, spy } = draw([REEL, STORY]);
    fireEvent.press(getByTestId('ed-add'));
    expect(getAllByText('Added')).toHaveLength(2);
    for (const code of ['reel', 'story']) {
      within(getByTestId(`ed-add-${code}`)).getByText('Added');
      expect(disabledOf(getByTestId(`ed-add-${code}`))).toBe(true);
      fireEvent.press(getByTestId(`ed-add-${code}`));
    }
    expect(spy).not.toHaveBeenCalled();
    getByTestId('ed-list');   // still open: nothing was chosen
    for (const code of ['post', 'youtube_video', 'youtube_short']) {
      expect(within(getByTestId(`ed-add-${code}`)).queryByText('Added')).toBeNull();
      expect(disabledOf(getByTestId(`ed-add-${code}`))).toBe(false);
    }
  });

  it('tapping one of the others adds it as a new line with 1, and closes the list', () => {
    const { getByTestId, queryByTestId, last } = draw([REEL, STORY]);
    fireEvent.press(getByTestId('ed-add'));
    fireEvent.press(getByTestId('ed-add-youtube_video'));
    expect(last()).toEqual([{ type: 'reel', count: 1 }, { type: 'story', count: 2 }, { type: 'youtube_video', count: 1 }]);
    within(getByTestId('ed-row-2-type')).getByText('YouTube video');
    within(getByTestId('ed-row-2-count-value')).getByText('1');
    expect(queryByTestId('ed-list')).toBeNull();
  });

  it('a second tap on "+ Add another" closes the list without adding anything', () => {
    const { getByTestId, queryByTestId, spy } = draw([REEL]);
    fireEvent.press(getByTestId('ed-add'));
    getByTestId('ed-list');
    fireEvent.press(getByTestId('ed-add'));
    expect(queryByTestId('ed-list')).toBeNull();
    expect(spy).not.toHaveBeenCalled();
  });
});

/* ───────────────────────────────────────────────────────────── D3 */

describe('D3 — a line\'s own type box', () => {
  it('opens the same list under THAT line; "Add another" and everything after it move down', () => {
    const { getByTestId, UNSAFE_queryAllByType } = draw([REEL, STORY]);
    fireEvent.press(getByTestId('ed-row-1-type'));
    const root = getByTestId('ed');
    // the list is inside line 2's own piece of the page, after its row…
    expect(place(root, byId('ed-list'))).toBe(1);
    let line = root.children[1];
    while (typeof line.type !== 'string') line = line.children[0];   // down to the drawn box itself
    expect(place(line, byId('ed-row-1'))).toBe(0);
    expect(place(line, byId('ed-list'))).toBe(1);
    // …and the button and the hint come after it
    expect(place(root, byId('ed-add'))).toBe(2);
    expect(place(root, byText(C5.terms.deliverHint))).toBe(3);
    expect(StyleSheet.flatten(getByTestId('ed-list').props.style).position).toBeUndefined();
    expect(UNSAFE_queryAllByType(Modal)).toHaveLength(0);
    // the box shows it is open
    within(getByTestId('ed-row-1-type')).getByText('chevron-up');
    expect(getByTestId('ed-row-1-type').props.accessibilityState.expanded).toBe(true);
    expect(getByTestId('ed-row-0-type').props.accessibilityState.expanded).toBe(false);
  });

  it('this line\'s own type is ticked; a type on another line is grey with "Added"', () => {
    const { getByTestId, getAllByText } = draw([REEL, STORY]);
    fireEvent.press(getByTestId('ed-row-1-type'));
    const own = getByTestId('ed-row-1-story');
    within(own).getByText('check');
    expect(own.props.accessibilityState).toEqual({ disabled: false, selected: true });
    expect(within(own).queryByText('Added')).toBeNull();
    within(getByTestId('ed-row-1-reel')).getByText('Added');
    expect(getByTestId('ed-row-1-reel').props.accessibilityState).toEqual({ disabled: true, selected: false });
    expect(getAllByText('Added')).toHaveLength(1);
    expect(getAllByText('check')).toHaveLength(1);
  });

  it('tapping one of the other three changes this line to that type and keeps its number', () => {
    const { getByTestId, queryByTestId, last } = draw([REEL, STORY]);
    fireEvent.press(getByTestId('ed-row-1-type'));
    fireEvent.press(getByTestId('ed-row-1-youtube_short'));
    expect(last()).toEqual([{ type: 'reel', count: 1 }, { type: 'youtube_short', count: 2 }]);
    within(getByTestId('ed-row-1-type')).getByText('YouTube short');
    within(getByTestId('ed-row-1-count-value')).getByText('2');
    expect(queryByTestId('ed-list')).toBeNull();   // choosing closes it
  });

  it('a type already on another line cannot be chosen from here either', () => {
    const { getByTestId, spy } = draw([REEL, STORY]);
    fireEvent.press(getByTestId('ed-row-1-type'));
    fireEvent.press(getByTestId('ed-row-1-reel'));
    expect(spy).not.toHaveBeenCalled();
    within(getByTestId('ed-row-1-type')).getByText('Instagram story');
  });

  it('a second tap on the box closes the list; so does choosing the type it already has (spec U12)', () => {
    const { getByTestId, queryByTestId, spy } = draw([REEL, STORY]);
    fireEvent.press(getByTestId('ed-row-0-type'));
    getByTestId('ed-list');
    fireEvent.press(getByTestId('ed-row-0-type'));
    expect(queryByTestId('ed-list')).toBeNull();
    within(getByTestId('ed-row-0-type')).getByText('chevron-down');
    fireEvent.press(getByTestId('ed-row-0-type'));
    fireEvent.press(getByTestId('ed-row-0-reel'));
    expect(queryByTestId('ed-list')).toBeNull();
    expect(spy).not.toHaveBeenCalled();
  });

  it('only one list is open at a time: another box, or "+ Add another", takes it over', () => {
    const { getByTestId, getAllByTestId, queryByTestId } = draw([REEL, STORY]);
    fireEvent.press(getByTestId('ed-row-0-type'));
    fireEvent.press(getByTestId('ed-row-1-type'));
    expect(getAllByTestId('ed-list')).toHaveLength(1);
    getByTestId('ed-row-1-story');
    expect(queryByTestId('ed-row-0-reel')).toBeNull();
    fireEvent.press(getByTestId('ed-add'));
    expect(getAllByTestId('ed-list')).toHaveLength(1);
    getByTestId('ed-add-post');
    expect(queryByTestId('ed-row-1-story')).toBeNull();
  });

  it('the open list stays open, on its own line, while another line\'s number changes (a line keeps its place)', () => {
    const { getByTestId } = draw([REEL, STORY]);
    fireEvent.press(getByTestId('ed-row-1-type'));
    fireEvent.press(getByTestId('ed-row-0-count-plus'));
    within(getByTestId('ed-row-0-count-value')).getByText('2');
    getByTestId('ed-row-1-story');
    expect(place(getByTestId('ed'), byId('ed-list'))).toBe(1);
  });

  it('a list left open on a line the screen then takes away is closed, and does not come back under a later line', () => {
    const onChange = jest.fn();
    const { getByTestId, queryByTestId, rerender } = render(<DeliverablesEditor5 rows={[REEL, STORY]} onChange={onChange} testID="ed" />);
    fireEvent.press(getByTestId('ed-row-1-type'));
    getByTestId('ed-list');
    rerender(<DeliverablesEditor5 rows={[REEL]} onChange={onChange} testID="ed" />);
    expect(queryByTestId('ed-list')).toBeNull();
    rerender(<DeliverablesEditor5 rows={[REEL, { type: 'post', count: 1 }]} onChange={onChange} testID="ed" />);
    expect(queryByTestId('ed-list')).toBeNull();
    within(getByTestId('ed-row-1-type')).getByText('chevron-down');
  });

  it('removing a line closes whatever list was open', () => {
    const { getByTestId, queryByTestId } = draw([REEL, STORY]);
    fireEvent.press(getByTestId('ed-row-1-type'));
    fireEvent.press(getByTestId('ed-row-0-remove'));
    expect(queryByTestId('ed-list')).toBeNull();
    within(getByTestId('ed-row-0-type')).getByText('Instagram story');
  });
});

/* ───────────────────────────────────────────────────────────── D4 */

describe('D4 — all five types added', () => {
  it('five lines in the order they were added, the hint stays, and "+ Add another" is gone', () => {
    const { getByTestId, queryByTestId, getByText } = draw(ALL_FIVE);
    ['Instagram reel', 'Instagram story', 'Instagram post', 'YouTube video', 'YouTube short']
      .forEach((label, i) => within(getByTestId(`ed-row-${i}-type`)).getByText(label));
    expect(queryByTestId('ed-add')).toBeNull();
    getByText(C5.terms.deliverHint);
    // the story line is at 20, the most allowed: its plus is off
    expect(disabledOf(getByTestId('ed-row-1-count-plus'))).toBe(true);
  });

  it('adding the fifth type takes the button away; removing a line brings it back', () => {
    const { getByTestId, queryByTestId, last } = draw(ALL_FIVE.slice(0, 4));
    fireEvent.press(getByTestId('ed-add'));
    fireEvent.press(getByTestId('ed-add-youtube_short'));
    expect(last()).toHaveLength(5);
    expect(queryByTestId('ed-add')).toBeNull();
    expect(queryByTestId('ed-list')).toBeNull();
    fireEvent.press(getByTestId('ed-row-2-remove'));
    fireEvent.press(getByTestId('ed-add'));
    // the one type with no line is the only one that can be picked
    expect(DELIVERABLE_TYPES.filter((t) => !disabledOf(getByTestId(`ed-add-${t.code}`))).map((t) => t.code)).toEqual(['post']);
  });

  it('with five lines every type in a line\'s own list is taken, bar its own', () => {
    const { getByTestId, getAllByText } = draw(ALL_FIVE);
    fireEvent.press(getByTestId('ed-row-0-type'));
    expect(getAllByText('Added')).toHaveLength(4);
    within(getByTestId('ed-row-0-reel')).getByText('check');
  });
});

/* ───────────────────────────────────────────────────────────── D5 */

describe('D5 — every line removed', () => {
  it('only the button and the hint are left, with the red line under them', () => {
    const { getByTestId, queryByTestId, getByText } = render(
      <DeliverablesEditor5 rows={[]} onChange={() => {}} error={MSG5.DELIVERABLES_EMPTY} testID="ed" />);
    expect(queryByTestId('ed-row-0')).toBeNull();
    const root = getByTestId('ed');
    expect(place(root, byId('ed-add'))).toBe(0);
    expect(place(root, byText(C5.terms.deliverHint))).toBe(1);
    expect(place(root, byText('Add at least one thing she delivers.'))).toBe(2);
    expect(getByText('Add at least one thing she delivers.').props.accessibilityRole).toBe('alert');
  });

  it('from nothing, "+ Add another" offers all five and the one chosen becomes the first line', () => {
    const { getByTestId, queryAllByText, last } = draw([]);
    fireEvent.press(getByTestId('ed-add'));
    expect(queryAllByText('Added')).toHaveLength(0);
    fireEvent.press(getByTestId('ed-add-post'));
    expect(last()).toEqual([{ type: 'post', count: 1 }]);
  });
});

/* ─────────────────────────────────── rows the chooser did not make */

describe('counts that arrive from the server or the pool', () => {
  it('deliverableCount5 — a whole number from 1 to 20, whatever arrived', () => {
    expect([1, 7, 20].map(deliverableCount5)).toEqual([1, 7, 20]);
    expect(['3', '20', ' 5 '].map(deliverableCount5)).toEqual([3, 20, 5]);
    expect([0, -4, 21, 250].map(deliverableCount5)).toEqual([1, 1, 20, 20]);
    expect([2.4, 2.6, '7.5'].map(deliverableCount5)).toEqual([2, 3, 8]);
    expect(['', null, undefined, 'two', NaN, {}, Infinity].map(deliverableCount5)).toEqual([1, 1, 1, 1, 1, 1, 1]);
  });

  it('a count sent as text, too big, zero or missing is shown as a number the stepper can hold, and handed back that way once', () => {
    const arrived = [{ type: 'reel', count: '2' }, { type: 'story', count: 25 }, { type: 'post', count: 0 }, { type: 'youtube_video' }];
    const { getByTestId, spy } = draw(arrived);
    ['2', '20', '1', '1'].forEach((n, i) => within(getByTestId(`ed-row-${i}-count-value`)).getByText(n));
    // put right straight away, so the rule underneath never judges a number the line does not show
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith([{ type: 'reel', count: 2 }, { type: 'story', count: 20 }, { type: 'post', count: 1 }, { type: 'youtube_video', count: 1 }]);
    expect(deliverableRowsError5(spy.mock.calls[0][0])).toBeNull();
    // and it steps from the number shown
    fireEvent.press(getByTestId('ed-row-1-count-minus'));
    within(getByTestId('ed-row-1-count-value')).getByText('19');
    expect(disabledOf(getByTestId('ed-row-2-count-minus'))).toBe(true);
  });

  it('rows that are already right are left alone: nothing is handed back until something is tapped', () => {
    const { spy } = draw([REEL, STORY]);
    expect(spy).not.toHaveBeenCalled();
  });

  it('a screen that does not take the corrected rows is asked once, not for ever', () => {
    const onChange = jest.fn();   // keeps handing the same bad rows back
    const rows = [{ type: 'reel', count: 99 }];
    const { rerender, getByTestId } = render(<DeliverablesEditor5 rows={rows} onChange={onChange} testID="ed" />);
    rerender(<DeliverablesEditor5 rows={rows} onChange={onChange} testID="ed" />);
    rerender(<DeliverablesEditor5 rows={[{ type: 'reel', count: 99 }]} onChange={onChange} testID="ed" />);
    expect(onChange).toHaveBeenCalledTimes(1);
    within(getByTestId('ed-row-0-count-value')).getByText('20');
  });

  it('a type the app does not know is shown as sent, ticks nothing, and can be changed or removed', () => {
    const { getByTestId, queryAllByText, last } = draw([{ type: 'facebook_post', count: 1 }, REEL]);
    within(getByTestId('ed-row-0-type')).getByText('facebook_post');
    fireEvent.press(getByTestId('ed-row-0-type'));
    expect(queryAllByText('check')).toHaveLength(0);
    fireEvent.press(getByTestId('ed-row-0-post'));
    expect(last()).toEqual([{ type: 'post', count: 1 }, { type: 'reel', count: 1 }]);
    fireEvent.press(getByTestId('ed-row-0-remove'));
    expect(last()).toEqual([{ type: 'reel', count: 1 }]);
  });

  it('the same type sent twice: both lines are drawn, either can be removed or changed, and the rule still refuses them as they are', () => {
    const twice = [{ type: 'reel', count: 1 }, { type: 'reel', count: 2 }];
    expect(deliverableRowsError5(twice)).toBe(MSG5.DELIVERABLE_DUP);
    const { getByTestId, last } = draw(twice);
    within(getByTestId('ed-row-0-type')).getByText('Instagram reel');
    within(getByTestId('ed-row-1-type')).getByText('Instagram reel');
    fireEvent.press(getByTestId('ed-row-1-type'));
    within(getByTestId('ed-row-1-reel')).getByText('check');      // its own type, not "Added"
    fireEvent.press(getByTestId('ed-row-1-story'));
    expect(last()).toEqual([{ type: 'reel', count: 1 }, { type: 'story', count: 2 }]);
    expect(deliverableRowsError5(last())).toBeNull();
  });

  it('no rows at all (nothing sent) draws the empty block and does not throw', () => {
    const { getByTestId, queryByTestId } = render(<DeliverablesEditor5 rows={undefined} onChange={() => {}} testID="ed" />);
    getByTestId('ed-add');
    expect(queryByTestId('ed-row-0')).toBeNull();
  });
});

describe('deliverableRowsError5 — the no-repeat / 1-to-20 rule the counter pop-up and the pitch form now share', () => {
  it('passes good lines and an empty list (each screen has its own sentence for "none")', () => {
    expect(deliverableRowsError5([REEL, STORY])).toBeNull();
    expect(deliverableRowsError5([])).toBeNull();
    expect(deliverableRowsError5(undefined)).toBeNull();
  });
  it('refuses a count outside 1 to 20 and a type twice, in the server\'s words', () => {
    for (const bad of [0, 21, 1.5, '', null, 'x']) expect(deliverableRowsError5([{ type: 'reel', count: bad }])).toBe('Choose between 1 and 20.');
    expect(deliverableRowsError5([REEL, { type: 'reel', count: 3 }])).toBe("You've already added that. Change the count instead.");
  });
});

/* ───────────────────────────────── the opened list is moved into view */

describe('the screen moves so the whole opened list is in view (D2, D7)', () => {
  it('scrollForList5 — moves the page just far enough, and never pushes the tapped box off the top', () => {
    // ASSERTION DRIFT — ui-walk-fixes closing item (06-diff/drift/E.md): the room kept clear under
    // an opened list was 96, for a button strip that floated over the page. No home of the chooser
    // has one any more (board C: every strip is in the column, under the page), so it is an
    // ordinary gap of 16 — and the page moves 80 less: 716 → 636 here, 86 → 6 at the end.
    // already in view, with an ordinary gap under it → nothing to do
    expect(scrollForList5({ offset: 300, viewTop: 100, viewHeight: 500, anchorTop: 150, listBottom: 420 })).toBeNull();
    // a list that ends exactly one gap above the bottom edge is in view; one more point is not
    expect(scrollForList5({ offset: 300, viewTop: 100, viewHeight: 500, anchorTop: 150, listBottom: 584 })).toBeNull();
    expect(scrollForList5({ offset: 300, viewTop: 100, viewHeight: 500, anchorTop: 150, listBottom: 585 })).toBe(301);
    // the list runs under the bottom → move by exactly the overlap: 690 − (600 − 16) = 106
    expect(scrollForList5({ offset: 530, viewTop: 100, viewHeight: 500, anchorTop: 420, listBottom: 690 })).toBe(636);
    // a short view (the counter pop-up): move only until the tapped box reaches the top
    expect(scrollForList5({ offset: 40, viewTop: 200, viewHeight: 240, anchorTop: 260, listBottom: 530 })).toBe(92);
    // the tapped box is already at the top → no move at all
    expect(scrollForList5({ offset: 40, viewTop: 200, viewHeight: 240, anchorTop: 205, listBottom: 530 })).toBeNull();
    // the room under the list can be set by the caller
    expect(scrollForList5({ offset: 0, viewTop: 0, viewHeight: 600, anchorTop: 300, listBottom: 590, room: 0 })).toBeNull();
    expect(scrollForList5({ offset: 0, viewTop: 0, viewHeight: 600, anchorTop: 300, listBottom: 590 })).toBe(6);
    expect(scrollForList5({ offset: 0, viewTop: 0, viewHeight: 600, anchorTop: 300, listBottom: 590, room: 96 })).toBe(86);
  });

  describe('wired to the page it sits in', () => {
    const Native = require('react-native/jest/MockNativeMethods');
    const WINDOW = { 'ed-row-1': [18, 420, 324, 42], 'ed-list': [18, 470, 324, 220] };
    beforeEach(() => {
      Native.measureInWindow.mockImplementation(function measure(cb) { cb(...(WINDOW[this.props.testID] || [18, 420, 172, 48])); });
      Native.measureLayout.mockImplementation((within_, ok) => ok(18, 900, 324, 220));
    });
    afterEach(() => { Native.measureInWindow.mockReset(); Native.measureLayout.mockReset(); });
    const page = () => ({ current: { scrollTo: jest.fn(), measureInWindow: (cb) => cb(0, 100, 360, 500), getInnerViewRef: () => ({}) } });
    const laidOut = (node) => act(() => { fireEvent(node, 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 324, height: 220 } } }); });

    it('once the list is laid out the page is scrolled to show all of it — once for each opening', () => {
      const scrollRef = page();
      const { getByTestId } = draw([REEL, STORY], { scrollRef });
      fireEvent.press(getByTestId('ed-row-1-type'));
      laidOut(getByTestId('ed-list'));
      expect(scrollRef.current.scrollTo).toHaveBeenCalledTimes(1);
      expect(scrollRef.current.scrollTo).toHaveBeenCalledWith({ y: 636, animated: true });   // was 716 with the 96 (drift/E.md)
      laidOut(getByTestId('ed-list'));                         // a re-layout of the same opening
      expect(scrollRef.current.scrollTo).toHaveBeenCalledTimes(1);
      fireEvent.press(getByTestId('ed-row-1-type'));            // closed…
      fireEvent.press(getByTestId('ed-row-1-type'));            // …and opened again
      laidOut(getByTestId('ed-list'));
      expect(scrollRef.current.scrollTo).toHaveBeenCalledTimes(2);
    });

    it('the list under "+ Add another" is moved into view the same way', () => {
      const scrollRef = page();
      const { getByTestId } = draw([REEL], { scrollRef });
      fireEvent.press(getByTestId('ed-add'));
      laidOut(getByTestId('ed-list'));
      expect(scrollRef.current.scrollTo).toHaveBeenCalledWith({ y: 636, animated: true });   // was 716 with the 96 (drift/E.md)
    });

    it('a list already in view moves nothing', () => {
      const scrollRef = page();
      scrollRef.current.measureInWindow = (cb) => cb(0, 100, 360, 900);
      const { getByTestId } = draw([REEL, STORY], { scrollRef });
      fireEvent.press(getByTestId('ed-row-1-type'));
      laidOut(getByTestId('ed-list'));
      expect(scrollRef.current.scrollTo).not.toHaveBeenCalled();
    });

    it('with no page handed in, or one that cannot be measured, opening the list still works', () => {
      const a = draw([REEL, STORY]);
      fireEvent.press(a.getByTestId('ed-row-1-type'));
      expect(() => laidOut(a.getByTestId('ed-list'))).not.toThrow();
      const b = draw([REEL, STORY], { scrollRef: { current: { scrollTo: jest.fn() } } });
      fireEvent.press(b.getByTestId('ed-add'));
      expect(() => laidOut(b.getByTestId('ed-list'))).not.toThrow();
      const c = draw([REEL, STORY], { scrollRef: { current: null } });
      fireEvent.press(c.getByTestId('ed-add'));
      expect(() => laidOut(c.getByTestId('ed-list'))).not.toThrow();
      const boom = { current: { scrollTo: jest.fn(), measureInWindow: () => { throw new Error('no native view'); }, getInnerViewRef: () => ({}) } };
      const e = draw([REEL, STORY], { scrollRef: boom });
      fireEvent.press(e.getByTestId('ed-add'));
      expect(() => laidOut(e.getByTestId('ed-list'))).not.toThrow();
    });
  });
});
