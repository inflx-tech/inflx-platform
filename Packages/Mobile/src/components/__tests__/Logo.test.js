import React from 'react';
import { render, screen } from '@testing-library/react-native';
import Logo from '../Logo';
import InflxLockup, { LOCKUP_ASPECT } from '../InflxLockup';
import InflxMark, { MARK_YELLOW, MARK_INK, MARK_ASPECT } from '../InflxMark';

// Walk the rendered tree for nodes carrying a `d` prop — under the
// react-native-svg stub in jest.setup.js, <Path> becomes a <View> that
// still receives its props.
function paths(tree) {
  const out = [];
  (function walk(n) {
    if (!n || typeof n !== 'object') return;
    if (Array.isArray(n)) return n.forEach(walk);
    if (n.props && typeof n.props.d === 'string') out.push(n.props);
    if (n.children) n.children.forEach(walk);
  })(tree);
  return out;
}

describe('InflxMark', () => {
  test('draws the silhouette and the band, in that order', () => {
    const p = paths(render(<InflxMark height={100} />).toJSON());
    expect(p).toHaveLength(2);
    expect(p[0].fill).toBe(MARK_YELLOW);
    expect(p[1].fill).toBe(MARK_INK);
    // Band must be the shorter path — it is a stripe, not the whole bar.
    expect(p[1].d.length).toBeLessThan(p[0].d.length);
  });

  test('holds the traced aspect ratio so the mark never distorts', () => {
    const { toJSON } = render(<InflxMark height={200} />);
    expect(toJSON().props.width).toBeCloseTo(200 * MARK_ASPECT, 5);
  });
});

describe('InflxLockup', () => {
  test('draws the mark plus the word as one vector', () => {
    const p = paths(render(<InflxLockup height={64} />).toJSON());
    // mark silhouette + mark band + the "nflx" outlines
    expect(p).toHaveLength(3);
    expect(p[0].fill).toBe(MARK_YELLOW);
    expect(p[1].fill).toBe(MARK_INK);
  });

  test('spells the name once — the mark IS the i, so no separate text node', () => {
    const { toJSON } = render(<InflxLockup height={64} />);
    const texts = [];
    (function walk(n) {
      if (!n || typeof n !== 'object') return;
      if (Array.isArray(n)) return n.forEach(walk);
      if (typeof n === 'string') texts.push(n);
      if (n.children) n.children.forEach((c) => (typeof c === 'string' ? texts.push(c) : walk(c)));
    })(toJSON());
    // The word is outlines. Critically there must be no literal "inflx"
    // rendered beside the mark, which would write the i twice.
    expect(texts.join('')).not.toMatch(/inflx/i);
  });

  test('carries an accessible name, since the word is not text', () => {
    const { toJSON } = render(<InflxLockup height={64} />);
    expect(toJSON().props.accessibilityLabel).toBe('inflx');
  });

  test('is wider than it is tall, and holds its aspect', () => {
    const { toJSON } = render(<InflxLockup height={100} />);
    expect(toJSON().props.width).toBeCloseTo(100 * LOCKUP_ASPECT, 5);
    expect(LOCKUP_ASPECT).toBeGreaterThan(1);
  });
});

describe('Logo', () => {
  test('renders the lockup', () => {
    expect(paths(render(<Logo />).toJSON())).toHaveLength(3);
  });

  test('only the word colour responds to tone; the mark is constant', () => {
    const wordOf = (tone) => {
      const { toJSON, unmount } = render(<Logo tone={tone} />);
      const p = paths(toJSON());
      const out = { word: p[2].fill, mark: p[0].fill, band: p[1].fill };
      unmount();
      return out;
    };
    const light = wordOf('light');
    const dark = wordOf('dark');
    expect(light.word).toBe('#FFFFFF');
    expect(dark.word).toBe('#0D1630');
    // The mark never changes with tone — it carries its own colours.
    expect(light.mark).toBe(dark.mark);
    expect(light.band).toBe(dark.band);
  });

  test('scales as one unit across sizes', () => {
    const h = (size) => {
      const { toJSON, unmount } = render(<Logo size={size} />);
      const v = toJSON().props.height;
      unmount();
      return v;
    };
    expect(h('sm')).toBeLessThan(h('md'));
    expect(h('md')).toBeLessThan(h('lg'));
    expect(h('lg')).toBeLessThan(h('xl'));
  });

  test('falls back to md for an unknown size rather than rendering nothing', () => {
    expect(render(<Logo size="nonsense" />).toJSON().props.height).toBe(34);
  });
});
