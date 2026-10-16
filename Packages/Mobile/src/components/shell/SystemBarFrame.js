/**
 * SystemBarFrame — keeps every screen between the status bar and the navigation bar.
 *
 * WHY
 * Google Play now requires apps to target Android 16 (API 36). On Android 15 and 16 such an
 * app is drawn edge-to-edge: the status bar and the navigation bar become see-through and
 * the screens slide underneath them, and the app can no longer ask to fit inside the bars.
 * MainActivity makes the window edge-to-edge on every Android version, so every phone
 * behaves the same.
 *
 * The screens were designed for bars that sit OUTSIDE the app. Rather than move every
 * screen, the app is framed: the two strips are painted in the colours the phone painted
 * the bars before (grey status bar, black navigation bar; black for both in dark mode), and
 * everything inside sees a top and bottom inset of 0, exactly as before. Titles, tab bars
 * and pinned buttons keep the positions they have on every phone today.
 *
 * What it does not need to do:
 *  - the keyboard: MainActivity pads the window's content by the keyboard, so the frame
 *    simply ends at the keyboard's top edge (and its bottom strip is no longer under it);
 *  - pop-ups: React Native's Modal fits itself inside the bars and above the keyboard on
 *    its own, as long as its edge-to-edge switch stays off (android/gradle.properties).
 */
import React from 'react';
import { StatusBar, StyleSheet, View, useColorScheme } from 'react-native';
import { SafeAreaProvider, initialWindowMetrics, useSafeAreaInsets } from 'react-native-safe-area-context';

/** The colours the phone painted the bars before (AppCompat DayNight theme defaults). */
export const BAR_COLORS = {
  light: { top: '#757575', bottom: '#000000' },
  dark: { top: '#000000', bottom: '#000000' },
};

const NONE = { top: 0, right: 0, bottom: 0, left: 0 };

/** Inside the frame nothing overlaps a bar: start from 0, as the phones always reported. */
const INNER_METRICS = {
  frame: (initialWindowMetrics && initialWindowMetrics.frame) || { x: 0, y: 0, width: 0, height: 0 },
  insets: NONE,
};

function Frame({ children }) {
  const i = useSafeAreaInsets() || NONE;
  const c = useColorScheme() === 'dark' ? BAR_COLORS.dark : BAR_COLORS.light;
  return (
    <View
      testID="system-bar-frame"
      style={[st.fill, { paddingTop: i.top, paddingBottom: i.bottom, paddingLeft: i.left, paddingRight: i.right }]}
    >
      {/* White clock and battery on the strip, as before. */}
      <StatusBar barStyle="light-content" />
      <SafeAreaProvider initialMetrics={INNER_METRICS} style={st.fill}>{children}</SafeAreaProvider>
      {i.top > 0 ? <View pointerEvents="none" style={[st.strip, { top: 0, height: i.top, backgroundColor: c.top }]} /> : null}
      {i.bottom > 0 ? <View pointerEvents="none" style={[st.strip, { bottom: 0, height: i.bottom, backgroundColor: c.bottom }]} /> : null}
    </View>
  );
}

/** Wraps the whole app, once, in App.js. */
export default function SystemBarFrame({ children }) {
  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics} style={st.fill}>
      <Frame>{children}</Frame>
    </SafeAreaProvider>
  );
}

const st = StyleSheet.create({
  fill: { flex: 1 },
  strip: { position: 'absolute', left: 0, right: 0 },
});
