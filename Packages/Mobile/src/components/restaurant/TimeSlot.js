import React from 'react';
import { Pressable, Text, View, StyleSheet } from 'react-native';
import { creatorVibe as C, fonts } from '../../theme/tokens';

// Flow 52.D — Creator Vibe recolor shim (restaurant component lib). Visual only.
const lightColors = {
  white: C.card, paper: C.card, bg: C.screenBg, bg2: C.soft, surface: C.soft, surface2: C.line,
  ink: C.ink, ink2: C.ink, muted: C.muted, muted2: C.muted, muted3: C.muted, muted4: C.line,
  border: C.line, borderSoft: C.line, border2: C.line,
  yellow: C.brown, yellowHover: C.brownDark, yellowDeep: C.brownDark, yellowLight: C.star,
  yellowPale: C.soft, yellow50: C.soft, yellow100: C.soft, yellow200: C.soft, yellowText: C.brown,
  success: '#1E9E5A', successPale: C.soft, successText: '#1E9E5A', success50: C.soft, success100: C.soft,
  warning: C.star, warning50: C.soft, warning100: C.soft,
  danger: C.offer, dangerPale: C.soft, dangerText: C.offer, danger50: C.soft,
  star: C.star, black: C.ink,
};

/**
 * TimeSlot — tap-to-select time slot button for PreBookScreen and the
 * upcoming BookTableScreen redesign.
 *
 * States:
 *   - default:  white bg, line border, ink time text
 *   - selected: yellow bg, ink time text (per "yellow primary, ink
 *               text" rule)
 *   - full:     paper-surface bg, muted text, strikethrough — slot is
 *               sold out for the requested party size
 *   - disabled: muted text + reduced opacity — past time or outside
 *               operating hours
 *
 * The label is mono so 7:30 PM / 12:00 PM line up neatly in a grid.
 *
 * Props:
 *   time      — display string e.g. "7:30 PM"
 *   selected  — bool
 *   full      — bool (sold out)
 *   disabled  — bool (not selectable)
 *   subtitle  — optional small line below time ("2 left" / "Last call")
 *   onPress   — callback
 */

export default function TimeSlot({ time, selected, full, disabled, subtitle, onPress }) {
  const inactive = full || disabled;

  return (
    <Pressable
      onPress={inactive ? null : onPress}
      style={({ pressed }) => [
        styles.slot,
        selected   && styles.selected,
        full       && styles.full,
        disabled   && styles.disabled,
        !selected && !inactive && styles.default,
        pressed && !inactive && { opacity: 0.85 },
      ]}
    >
      <Text style={[
        styles.time,
        selected   && styles.timeSelected,
        full       && styles.timeFull,
        disabled   && styles.timeDisabled,
      ]}>
        {time}
      </Text>
      {subtitle && (
        <Text style={[
          styles.subtitle,
          selected   && styles.subtitleSelected,
          inactive   && styles.subtitleInactive,
        ]}>
          {subtitle}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  slot: {
    minWidth: 84,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
  },
  default:  { backgroundColor: lightColors.white,    borderColor: lightColors.muted4 },
  selected: { backgroundColor: lightColors.yellow,   borderColor: lightColors.yellow },
  full:     { backgroundColor: lightColors.bg2,  borderColor: lightColors.border },
  disabled: { backgroundColor: lightColors.bg2,  borderColor: lightColors.border, opacity: 0.5 },

  time: {
    fontFamily: fonts.monoBold,
    fontSize: 14,
    color: lightColors.ink,
  },
  timeSelected: { color: lightColors.ink },
  timeFull:     { color: lightColors.muted2, textDecorationLine: 'line-through' },
  timeDisabled: { color: lightColors.muted2 },

  subtitle: {
    fontFamily: fonts.sansMedium,
    fontSize: 10,
    color: lightColors.muted,
    marginTop: 2,
  },
  subtitleSelected: { color: lightColors.ink2 },
  subtitleInactive: { color: lightColors.muted3 },
});
