import React, { useEffect, useRef } from 'react';
import { View, Image, Animated, StyleSheet, Dimensions } from 'react-native';

const { width, height } = Dimensions.get('window');

/**
 * SplashScreen — animated app launch screen.
 *
 * Animation sequence:
 * 1. Golden background fades in (0-300ms)
 * 2. INFLX "lx" swoosh logo scales up with spring (200-800ms)
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
          <Image
            source={require('../assets/images/inflx-app-icon.png')}
            style={styles.logo}
            resizeMode="contain"
          />
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
    backgroundColor: '#F5A623',
    alignItems: 'center',
    justifyContent: 'center',
  },
  glow: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  logo: {
    width: 120,
    height: 120,
    borderRadius: 28,
  },
  tagline: {
    marginTop: 16,
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.85)',
    letterSpacing: 0.5,
  },
});
