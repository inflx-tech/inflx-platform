// Layer 3 jest setup — stub native modules that have no JS impl under
// node so transactional-screen flow tests run without a device.

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'));

// react-native-svg is a native module — stub under node so any screen
// importing svg primitives renders without the native impl.
jest.mock('react-native-svg', () => {
  const React = require('react');
  const { View } = require('react-native');
  const P = (name) => (props) => React.createElement(View, props, props.children);
  return { __esModule: true, SvgXml: P('SvgXml'), Svg: P('Svg'), default: P('Svg'),
    Rect: P('Rect'), Circle: P('Circle'), Path: P('Path'), G: P('G'), Text: P('Text'),
    TSpan: P('TSpan'), Line: P('Line'), Defs: P('Defs'), ClipPath: P('ClipPath') };
});

// react-native-vector-icons ships untransformed ESM — stub the icon sets any
// follower screen imports (FollowerWalletScreen etc.) so their suites load.
// (This suite-level load failure predates C2 and was masked by reading only
// the test-count lines; fixed properly here, not skipped.)
jest.mock('react-native-vector-icons/MaterialCommunityIcons', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return { __esModule: true, default: (props) => React.createElement(Text, props, props.name || 'icon') };
});

jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  const { View } = require('react-native');
  const Passthrough = ({ children, ...rest }) =>
    React.createElement(View, rest, children);
  return {
    SafeAreaProvider: Passthrough,
    SafeAreaView: Passthrough,
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  };
});
