import React from 'react';
import fs from 'fs';
import path from 'path';
import { render, screen } from '@testing-library/react-native';
import SplashScreen from '../SplashScreen';

// Regression guard: the splash used to render
// src/assets/images/inflx-app-icon.png, which was not an icon at all but a
// marketing mockup screenshot (it carried the heading "Updated Mobile App
// Icon" and tick bullets) and shipped to users on every launch. It now
// renders the real logo lockup. A missing/incorrect asset require would
// throw at import time, so simply mounting this screen catches a relapse.

describe('SplashScreen', () => {
  test('mounts and shows the INFLX lockup, not a bitmap screenshot', () => {
    const { toJSON } = render(<SplashScreen onFinish={() => {}} />);
    // The word is drawn as outlines, so the brand name is not a text node —
    // the accessible label is what proves the lockup is on screen.
    expect(screen.getByLabelText('inflx')).toBeTruthy();
    expect(screen.getByText('Powered by Creators, Driven by Community')).toBeTruthy();

    const images = [];
    (function walk(n) {
      if (!n || typeof n !== 'object') return;
      if (Array.isArray(n)) return n.forEach(walk);
      if (n.type === 'Image') images.push(n);
      if (n.children) n.children.forEach(walk);
    })(toJSON());
    expect(images).toHaveLength(0);
  });

  test('sits on the same ground as the launcher icon', () => {
    // Read the real Android colour resource rather than restating the hex,
    // so the splash and the launcher background cannot drift apart. If
    // someone recolours the icon and forgets the splash, this fails.
    const xml = fs.readFileSync(
      path.join(__dirname, '../../../android/app/src/main/res/values/ic_launcher_background.xml'),
      'utf8'
    );
    const launcherGround = xml
      .match(/<color name="ic_launcher_background">(#[0-9A-Fa-f]{6})<\/color>/)[1]
      .toUpperCase();

    const { toJSON } = render(<SplashScreen onFinish={() => {}} />);
    const found = [];
    (function walk(n) {
      if (!n || typeof n !== 'object') return;
      if (Array.isArray(n)) return n.forEach(walk);
      const style = Object.assign({}, ...[].concat(n.props && n.props.style).filter(Boolean));
      if (style.backgroundColor) found.push(String(style.backgroundColor).toUpperCase());
      if (n.children) n.children.forEach(walk);
    })(toJSON());

    expect(found).toContain(launcherGround);
  });
});
