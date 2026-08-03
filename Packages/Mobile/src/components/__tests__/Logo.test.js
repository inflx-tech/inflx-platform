import React from 'react';
import { render, screen } from '@testing-library/react-native';
import Logo from '../Logo';
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
    const { toJSON } = render(<InflxMark height={100} />);
    const p = paths(toJSON());
    expect(p).toHaveLength(2);
    expect(p[0].fill).toBe(MARK_YELLOW);
    expect(p[1].fill).toBe(MARK_INK);
    // Band must be the shorter path — it is a stripe, not the whole bar.
    expect(p[1].d.length).toBeLessThan(p[0].d.length);
  });

  test('holds the traced aspect ratio so the mark never distorts', () => {
    const { toJSON } = render(<InflxMark height={200} />);
    expect(toJSON().props.width).toBeCloseTo(200 * MARK_ASPECT, 5);
    expect(toJSON().props.height).toBe(200);
  });

  test('inverts for a coloured surface when both fills are supplied', () => {
    const { toJSON } = render(<InflxMark height={48} fill={MARK_INK} bandFill="#FDB602" />);
    const p = paths(toJSON());
    expect(p[0].fill).toBe(MARK_INK);
    expect(p[1].fill).toBe('#FDB602');
  });
});

describe('Logo lockup', () => {
  test('pairs the mark with the wordmark', () => {
    const { toJSON } = render(<Logo />);
    expect(screen.getByText('inflx')).toBeTruthy();
    expect(paths(toJSON())).toHaveLength(2);
  });

  test('only the wordmark colour responds to tone', () => {
    const colourOf = (tone) => {
      const { unmount } = render(<Logo tone={tone} />);
      const flat = [].concat(screen.getByText('inflx').props.style).filter(Boolean);
      const c = Object.assign({}, ...flat).color;
      unmount();
      return c;
    };
    expect(colourOf('light')).toBe('#FFFFFF');
    expect(colourOf('dark')).toBe('#0D1630');
  });

  test('scales as one unit across sizes', () => {
    const heightOf = (size) => {
      const { toJSON, unmount } = render(<Logo size={size} />);
      const h = toJSON().children.find((c) => c.props && c.props.height).props.height;
      unmount();
      return h;
    };
    expect(heightOf('sm')).toBeLessThan(heightOf('md'));
    expect(heightOf('md')).toBeLessThan(heightOf('lg'));
    expect(heightOf('lg')).toBeLessThan(heightOf('xl'));
  });

  test('falls back to md for an unknown size rather than rendering nothing', () => {
    const { toJSON } = render(<Logo size="nonsense" />);
    expect(toJSON().children.find((c) => c.props && c.props.height).props.height).toBe(34);
  });
});
