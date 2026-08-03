import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, Dimensions } from 'react-native';
import Logo from '../components/Logo';

const { width, height } = Dimensions.get('window');

/**
 * SplashScreen — animated app launch screen.
 *
 * The white background + yellow mark deliberately match the launcher icon,
 * so the splash is continuous with the icon the user just tapped.
 *
 * Animation sequence:
 * 1. White background fades in (0-300ms)
 * 2. INFLX lockup scales up with spring (200-800ms)
 * 3. Glow pulse around logo (600-1200ms)
 * 4. Hold for 500ms
 * 5. Fade out (1700-2200ms)
 * 6. Call onFinish
 */

export default function SplashScreen({ onFinish }) {
  const bgOpacity = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.3)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const glowScale = useRef(new Animated.Value(0.5)).current;
  const glowOpacity = useRef(new Animated.Value(0)).current;
  const fadeOut = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.sequence([
      // 1. Background fade in
      Animated.timing(bgOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),

      // 2. Logo spring in
      Animated.parallel([
        Animated.spring(logoScale, { toValue: 1, tension: 60, friction: 8, useNativeDriver: true }),
        Animated.timing(logoOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      ]),

      // 3. Glow pulse
      Animated.parallel([
        Animated.timing(glowOpacity, { toValue: 0.6, duration: 400, useNativeDriver: true }),
        Animated.spring(glowScale, { toValue: 1.5, tension: 30, friction: 5, useNativeDriver: true }),
      ]),

      // 4. Glow fade
      Animated.timing(glowOpacity, { toValue: 0, duration: 300, useNativeDriver: true }),

      // 5. Hold
      Animated.delay(500),

      // 6. Fade out everything
      Animated.timing(fadeOut, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start(() => {
      if (onFinish) onFinish();
    });
  }, []);

  return (
    <Animated.View style={[styles.container, { opacity: fadeOut }]}>
      <Animated.View style={[styles.bg, { opacity: bgOpacity }]}>
        {/* Glow effect */}
        <Animated.View style={[styles.glow, {
          opacity: glowOpacity,
          transform: [{ scale: glowScale }],
        }]} />

        {/* Logo */}
        <Animated.View style={{
          opacity: logoOpacity,
          transform: [{ scale: logoScale }],
        }}>
          <Logo tone="dark" size="xl" />
        </Animated.View>

        {/* Tagline */}
        <Animated.Text style={[styles.tagline, { opacity: logoOpacity }]}>
          Connecting Brands & Influencers
        </Animated.Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 999,
  },
  bg: {
    flex: 1,
    // Matches @color/ic_launcher_background so the splash is continuous
    // with the launcher icon.
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  glow: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(253, 182, 2, 0.16)',
  },
  tagline: {
    marginTop: 20,
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(13, 22, 48, 0.55)',
    letterSpacing: 0.5,
  },
});
