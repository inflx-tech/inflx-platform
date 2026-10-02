/**
 * BottomBar — the strip a screen's main button lives in.
 * Contract: features/ui-walk-fixes · board C (rule 1) · research C03
 *
 * It is IN the layout, under the form — never `position: 'absolute'` over it. That is the whole
 * point: a floating bar rides up with the keypad and sits on top of the box being typed in; a
 * strip that is part of the column is simply the last thing above the keypad, and the form
 * scrolls in the room that is left.
 *
 *   <View style={{ flex: 1 }}>
 *     <Header … />
 *     <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled">…the form…</ScrollView>
 *     <BottomBar hint="Saving your link…" testID="content-actions">
 *       <PrimaryButton label="I've posted everything" … testID="mark-posted" />
 *     </BottomBar>
 *   </View>
 *
 * A top hairline, the usual 14 padding, and the phone's bottom safe-area inset added underneath.
 * Its children are stacked 8 apart; an outline SecondaryButton stacked in it drops its built-in
 * top gap by itself, so the 8 is really 8. `hint` is the small centred grey line under the
 * button(s): a string, or your own element. With no child and no hint it draws nothing — and a
 * fragment that holds only null / false counts as no child. (A child that is a component which
 * itself draws nothing cannot be seen from here: make that condition around the bar.)
 *
 * Modelled on the Create tab's `Footer` (components/create/bitsCreate.js), which was already in
 * the layout and is why those screens never had the keypad problem.
 */
import React, { createContext, useContext } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import * as SafeArea from 'react-native-safe-area-context';
import { settingsTokens as T, fonts } from '../../theme/tokens';
import { ButtonSlot, buttonsOf } from '../settings/primitives';

// Read the inset from the context rather than through useSafeAreaInsets(): that hook THROWS when
// no provider is above it, and a main button must never be the thing that closes the app. With no
// provider (or under jest, where the package is stubbed) the inset is simply 0.
const NoInsets = createContext(null);

const PAD = 14;

function useBottomInset() {
  const insets = useContext(SafeArea.SafeAreaInsetsContext || NoInsets);
  const bottom = insets && typeof insets.bottom === 'number' ? insets.bottom : 0;
  return bottom > 0 ? bottom : 0;
}

export function BottomBar({ children, hint, hintTestID, style, testID }) {
  const inset = useBottomInset();
  // Counted the way ButtonRow counts: `<>{null}{false}</>` is one element to React but nothing to
  // draw, and must not leave an empty strip with a hairline at the foot of the screen.
  const hasChild = buttonsOf(children).length > 0;
  if (!hasChild && !hint) return null;
  return (
    <View style={[s.bar, { paddingBottom: PAD + inset }, style]} testID={testID}>
      <ButtonSlot.Provider value="stack">{children}</ButtonSlot.Provider>
      {hint ? (typeof hint === 'string' ? <Text style={s.hint} testID={hintTestID}>{hint}</Text> : hint) : null}
    </View>
  );
}

export default BottomBar;

export const s = StyleSheet.create({
  bar: { padding: PAD, gap: 8, backgroundColor: T.bg, borderTopWidth: 1, borderTopColor: T.border },
  hint: { fontFamily: fonts.sansRegular, fontSize: 12, color: T.ink2, lineHeight: 17, textAlign: 'center' },
});
