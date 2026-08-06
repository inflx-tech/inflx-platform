import React from 'react';
import fs from 'fs';
import path from 'path';
import { render, screen, fireEvent } from '@testing-library/react-native';
import LegalListScreen from '../LegalListScreen';
import LegalDocumentScreen from '../LegalDocumentScreen';
import { LEGAL_DOCUMENTS, docsForAudience, getDocument } from '../../../legal/content';

// The Legal section ships the same text in three apps, but a DIFFERENT SLICE
// of it per app — a shopper must not be shown the Creator Agreement, and a
// creator must not be shown a refund policy they cannot act on. These tests
// guard that slicing, the renderer, and the generated-content contract.

const nav = () => ({ navigate: jest.fn(), push: jest.fn(), goBack: jest.fn() });

describe('legal content (generated)', () => {
  test('is generated, not hand-written', () => {
    const file = fs.readFileSync(
      path.join(__dirname, '../../../legal/content.js'),
      'utf8',
    );
    expect(file).toContain('GENERATED FILE — DO NOT EDIT');
    expect(file).toContain('export const CHECKSUM');
  });

  test('every company token was resolved before shipping', () => {
    // An unresolved {{TOKEN}} would render literally in the app, which is
    // exactly the fabricated-fact failure the web side guards against.
    expect(JSON.stringify(LEGAL_DOCUMENTS)).not.toMatch(/\{\{[A-Z_]+\}\}/);
  });

  test('no document is empty, and every section has content', () => {
    expect(LEGAL_DOCUMENTS.length).toBeGreaterThan(0);
    for (const doc of LEGAL_DOCUMENTS) {
      expect(doc.title).toBeTruthy();
      expect(doc.sections.length).toBeGreaterThan(0);
      for (const s of doc.sections) {
        expect(s.heading).toBeTruthy();
        expect(s.blocks.length).toBeGreaterThan(0);
      }
    }
  });
});

describe('per-app document slicing', () => {
  test('each audience gets its own set, and none is empty', () => {
    for (const a of ['brand', 'creator', 'shopper']) {
      expect(docsForAudience(a).length).toBeGreaterThan(0);
    }
  });

  test('the six common documents reach every app', () => {
    const common = ['terms', 'privacy', 'community-guidelines', 'grievance', 'account-deletion', 'contact'];
    for (const a of ['brand', 'creator', 'shopper']) {
      const slugs = docsForAudience(a).map((d) => d.slug);
      for (const c of common) {
        expect(slugs).toContain(c);
      }
    }
  });

  test('role documents do not leak into the wrong app', () => {
    const shopper = docsForAudience('shopper').map((d) => d.slug);
    const creator = docsForAudience('creator').map((d) => d.slug);
    const brand = docsForAudience('brand').map((d) => d.slug);

    // A shopper is not a party to either side agreement.
    expect(shopper).not.toContain('creator-agreement');
    expect(shopper).not.toContain('brand-agreement');
    // A creator cannot action a refund, and does not sign the Brand Agreement.
    expect(creator).not.toContain('brand-agreement');
    expect(creator).not.toContain('refunds');
    // A brand does not sign the Creator Agreement.
    expect(brand).not.toContain('creator-agreement');

    // …but each does get the one that binds them.
    expect(creator).toContain('creator-agreement');
    expect(brand).toContain('brand-agreement');
    expect(shopper).toContain('refunds');
  });

  test('the shopper set is the leanest of the three', () => {
    expect(docsForAudience('shopper').length).toBeLessThan(docsForAudience('creator').length);
    expect(docsForAudience('creator').length).toBeLessThan(docsForAudience('brand').length);
  });
});

describe('LegalListScreen', () => {
  test('lists this app’s documents and nothing else', () => {
    const navigation = nav();
    render(<LegalListScreen route={{ params: { audience: 'shopper' } }} navigation={navigation} />);

    expect(screen.getByText('Legal')).toBeTruthy();
    expect(screen.getByText('Refund & Cancellation Policy')).toBeTruthy();
    expect(screen.queryByText('Creator Agreement')).toBeNull();
  });

  test('opening a row navigates to that document', () => {
    const navigation = nav();
    render(<LegalListScreen route={{ params: { audience: 'creator' } }} navigation={navigation} />);

    fireEvent.press(screen.getByText('Creator Agreement'));
    expect(navigation.navigate).toHaveBeenCalledWith('LegalDocument', {
      slug: 'creator-agreement',
      audience: 'creator',
    });
  });

  test('defaults to the shopper set rather than crashing on a missing param', () => {
    const navigation = nav();
    render(<LegalListScreen route={{}} navigation={navigation} />);
    expect(screen.getByText('Legal')).toBeTruthy();
  });
});

describe('LegalDocumentScreen', () => {
  test('renders a document’s headings and body', () => {
    const navigation = nav();
    render(
      <LegalDocumentScreen
        route={{ params: { slug: 'privacy', audience: 'shopper' } }}
        navigation={navigation}
      />,
    );

    const doc = getDocument('privacy');
    expect(screen.getByText(doc.title)).toBeTruthy();

    // A section heading renders as "1  Who we are" — the number is a nested
    // Text node, so the parent's text content is number + heading and an
    // exact-string match cannot see it. Match the heading within it.
    const escaped = doc.sections[0].heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    expect(screen.getByText(new RegExp(escaped))).toBeTruthy();

    // And prove the body actually rendered, not just the chrome.
    const firstParagraph = doc.sections[0].blocks.find((b) => b.p);
    if (firstParagraph) {
      const words = firstParagraph.p.replace(/\*\*/g, '').split(' ').slice(0, 5).join(' ');
      const wordsEscaped = words.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      expect(screen.getByText(new RegExp(wordsEscaped))).toBeTruthy();
    }
  });

  test('every shipped document mounts without throwing', () => {
    // Cheap but broad: a malformed block key or a bad table row anywhere in
    // the set would throw here rather than in a user’s hands.
    for (const doc of LEGAL_DOCUMENTS) {
      const navigation = nav();
      expect(() =>
        render(
          <LegalDocumentScreen
            route={{ params: { slug: doc.slug, audience: 'brand' } }}
            navigation={navigation}
          />,
        ),
      ).not.toThrow();
    }
  });

  test('an unknown slug offers the website instead of rendering a blank page', () => {
    const navigation = nav();
    render(
      <LegalDocumentScreen
        route={{ params: { slug: 'not-a-real-document' } }}
        navigation={navigation}
      />,
    );
    expect(screen.getByText('Open inflx.in/legal')).toBeTruthy();
  });
});
