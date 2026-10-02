/**
 * useTopInset — how far below the top of the screen a title row starts.
 * Contract: features/ui-walk-fixes · decision D4 (board frame B9: no blank strip above any title).
 *
 * Every brand and creator screen used to hard-code 50–54 points of padding above its title. On a
 * phone whose status bar is opaque (every phone these apps run on today) the screen already
 * starts BELOW the status bar, so that padding was a blank strip. The title row now starts at the
 * phone's real top inset plus a small gap:
 *
 *   · opaque status bar  → the inset is 0, the title sits directly under the status bar;
 *   · edge-to-edge phone → the inset is the status bar's height, the title still clears it.
 *
 * One helper for every title, so a tab's main page and the screens pushed over it line up:
 *   TOP_GAP        above a bar that carries the 40-high back button (the shared Header);
 *   TOP_GAP_TITLE  above a bare title (the five main pages and the Home shells). The 4-point
 *                  difference is the one the old 50 / 54 pair had, so the titles keep their line.
 *
 * The inset comes from react-native-safe-area-context. Both tab navigators wrap themselves in
 * TopInsetProvider (below), so the hook always has a value inside the apps. If a title is ever
 * drawn outside a provider the library throws; this falls back to the gap alone rather than
 * taking the screen down.
 */
import React from 'react';
import { Dimensions } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets, initialWindowMetrics } from 'react-native-safe-area-context';

export const TOP_GAP = 4;
export const TOP_GAP_TITLE = 8;

/** Pure: the padding for a given inset. Junk, missing or negative insets count as none. */
export function topInsetOf(insets, gap = TOP_GAP) {
  const top = insets ? Number(insets.top) : 0;
  return (Number.isFinite(top) && top > 0 ? top : 0) + gap;
}

export default function useTopInset(gap = TOP_GAP) {
  let insets = null;
  // The hook itself always runs on every render (it is a single useContext, which keeps no hook
  // state); only its "no provider" throw is caught. Not a conditional call, whatever the linter says.
  // eslint-disable-next-line react-hooks/rules-of-hooks
  try { insets = useSafeAreaInsets(); } catch (_) { insets = null; }
  return topInsetOf(insets, gap);
}

/**
 * Where the first frame starts, before the phone has measured anything.
 *
 * React Navigation would otherwise seed its own provider with the library's `initialWindowMetrics`,
 * which is measured against the whole window: on a phone with an opaque status bar that reports
 * the status bar's height as the top inset, and the real value (0 — the screen starts below the
 * bar) only arrives a frame or two later. Nothing read that inset before; every title does now,
 * so the app would open with its titles a status bar too low and then snap up. Starting from 0
 * is right from the first frame on every phone these apps run on today, and the native
 * measurement still corrects it on a phone that draws edge to edge.
 */
const win = Dimensions.get('window');
export const START_METRICS = {
  frame: (initialWindowMetrics && initialWindowMetrics.frame) || { x: 0, y: 0, width: win.width, height: win.height },
  insets: { top: 0, right: 0, bottom: 0, left: 0 },
};

/** Wraps a whole app (a tab navigator and its sheet host): the one safe-area provider above every title. */
export function TopInsetProvider({ children }) {
  return <SafeAreaProvider initialMetrics={START_METRICS}>{children}</SafeAreaProvider>;
}
